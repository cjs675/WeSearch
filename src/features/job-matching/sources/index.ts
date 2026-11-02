import type { JobCategory, JobSearchRequest, JobSourceStatus, JobType } from "@/types";
import { MUSE_CATEGORIES } from "../taxonomy";
import { hasAny, hasTerm, norm, safeUrl, stripHtml } from "../text";
import { FEED_TTL_MS, getJson } from "./http";
import { type JobSource, type SourceJob, SourceUnavailable } from "./types";

const PARTIAL_DESCRIPTION_CHARS = 600;
const MAX_QUERIES = 6;
const HOURS_PER_YEAR = 2080;
// A snippet can say "contract" or "full time" about something else, so job type is read from the title first
const TITLE_JOB_TYPES: [string, JobType][] = [
  ["internship", "internship"], ["intern", "internship"], ["part time", "part_time"], ["full time", "full_time"],
  ["contract", "contract"], ["temporary", "temporary"], ["seasonal", "temporary"],
];

type Raw = Record<string, any>; // Untyped API JSON, read defensively below

function money(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function salary(min: number | null, max: number | null) {
  return min === null && max === null ? null : { min: min ?? undefined, max: max ?? undefined, estimated: false };
}

export function detectJobType(title: string, description: string): JobType | null {
  const titleNorm = norm(title);
  const fromTitle = TITLE_JOB_TYPES.find(([term]) => hasTerm(titleNorm, term));
  if (fromTitle) return fromTitle[1];
  const text = norm(description);
  return hasTerm(text, "part time") ? "part_time" : hasTerm(text, "full time") ? "full_time" : null;
}

/** Null for a listing with no safe link: without one it can't be applied to. */
function toJob(source: string, id: unknown, fields: {
  title: unknown; employer: unknown; location: string | null; description: unknown; url: unknown; posted: unknown;
} & Partial<SourceJob>): SourceJob | null {
  const { title, employer, location, description, url, posted, ...extra } = fields;
  const applyUrl = safeUrl(url);
  const text = stripHtml(description as string);
  const cleanTitle = stripHtml(title as string);
  if (!applyUrl || !cleanTitle) return null;
  return {
    id: `${source}:${String(id)}`, sources: [source], title: cleanTitle, employer: stripHtml(employer as string) || null,
    location: location || null, remote: false, description: text, descriptionIsPartial: text.length < PARTIAL_DESCRIPTION_CHARS,
    applyUrl, postedAt: typeof posted === "string" && posted ? posted : null, salary: null, jobType: null, categories: [],
    level: null, labels: [], locationCheckedByApi: false, ...extra,
  };
}

const present = (jobs: (SourceJob | null)[]) => jobs.filter((j): j is SourceJob => j !== null);

/** One request per query. A source only counts as failed if every request failed and nothing came back. */
async function runQueries(queries: string[], request: (query: string) => Promise<(SourceJob | null)[]>) {
  const results = await Promise.allSettled(queries.map(request));
  const jobs = present(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
  const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failure && !jobs.length) throw failure.reason;
  return jobs;
}

export function parseUsaJobs(d: Raw, locationChecked: boolean): SourceJob | null {
  const pay = d.PositionRemuneration?.[0] ?? {};
  const factor = pay.RateIntervalCode === "PH" ? HOURS_PER_YEAR : 1;
  const scale = (n: number | null) => (n === null ? null : n * factor);
  const details = d.UserArea?.Details ?? {};
  const schedule = norm((d.PositionSchedule ?? []).map((s: Raw) => s.Name ?? "").join(" "));
  return toJob("USAJOBS", d.PositionID, {
    title: d.PositionTitle, employer: d.OrganizationName, location: d.PositionLocationDisplay ?? null,
    description: [d.QualificationSummary, details.JobSummary].filter(Boolean).join("\n"),
    url: d.ApplyURI?.[0] ?? d.PositionURI, posted: d.PublicationStartDate,
    salary: salary(scale(money(pay.MinimumRange)), scale(money(pay.MaximumRange))),
    jobType: schedule.includes("part time") ? "part_time" : schedule.includes("full time") ? "full_time" : null,
    remote: details.RemoteIndicator === true || details.RemoteIndicator === "True",
    labels: ["Government"],
    locationCheckedByApi: locationChecked,
  });
}

const usaJobs: JobSource = {
  name: "USAJOBS",
  needsKey: "USAJOBS_EMAIL and USAJOBS_API_KEY",
  configured: () => Boolean(process.env.USAJOBS_EMAIL && process.env.USAJOBS_API_KEY),
  fetch(queries, _categories, request) {
    const headers = { Host: "data.usajobs.gov", "User-Agent": process.env.USAJOBS_EMAIL ?? "", "Authorization-Key": process.env.USAJOBS_API_KEY ?? "" };
    const params: Record<string, string | number> = { ResultsPerPage: 50 };
    if (request.location) {
      params.LocationName = request.location;
      if (request.distanceMiles) params.Radius = Math.round(request.distanceMiles);
    }
    return runQueries(queries, async (Keyword) => {
      const data = await getJson<Raw>("https://data.usajobs.gov/api/search", { params: { ...params, Keyword }, headers });
      return (data.SearchResult?.SearchResultItems ?? []).map((item: Raw) => parseUsaJobs(item.MatchedObjectDescriptor ?? {}, Boolean(request.location)));
    });
  },
};

const MUSE_MAX_CATEGORIES = 5;
const MUSE_PAGES = [0, 1, 2]; // Results aren't reliably newest-first, so one page misses recent listings

export function parseMuse(r: Raw): SourceJob | null {
  const locations: string[] = (r.locations ?? []).map((l: Raw) => l.name ?? "");
  const levels = norm((r.levels ?? []).map((l: Raw) => l.name ?? "").join(" "));
  const level = levels.includes("internship") ? "internship" : levels.includes("entry") ? "entry"
    : levels.includes("senior") || levels.includes("management") ? "senior" : null;
  return toJob("The Muse", r.id, {
    title: r.name, employer: r.company?.name, location: locations.join("; "), description: r.contents,
    url: r.refs?.landing_page, posted: r.publication_date,
    remote: locations.some((l) => /remote|flexible/i.test(l)),
    level, jobType: level === "internship" ? "internship" : detectJobType(String(r.name ?? ""), ""),
  });
}

const theMuse: JobSource = {
  name: "The Muse",
  needsKey: null,
  configured: () => true,
  async fetch(_queries, categories: JobCategory[], request) {
    // The API has no text search, so without a category it has nothing to offer
    const museCategories = [...new Set(categories.flatMap((c) => MUSE_CATEGORIES[c] ?? []))].slice(0, MUSE_MAX_CATEGORIES);
    const params: Record<string, string | number> = { descending: "true" };
    if (request.location?.includes(",")) params.location = request.location; // Exact "City, ST" names only
    // Internships are a level in this API, not a category
    const searches: Record<string, string>[] = museCategories.map((category) => ({ category }));
    if (categories.includes("Internships")) searches.push({ level: "Internship" });
    const pages = searches.flatMap((search) => MUSE_PAGES.map((page) => ({ ...params, ...search, page })));
    const jobs = await runQueries(pages.map((p) => JSON.stringify(p)), async (page) => {
      const data = await getJson<Raw>("https://www.themuse.com/api/public/jobs", { params: JSON.parse(page) });
      return (data.results ?? []).map(parseMuse);
    });
    return jobs.filter((j) => j.remote || /, [A-Z]{2}\b/.test(j.location ?? "")); // US jobs only for now
  },
};

const US_REMOTE = ["worldwide", "anywhere", "usa", "us", "united states", "north america", "americas", "global"];

export function parseRemotive(r: Raw): SourceJob | null {
  const jobType = ({ full_time: "full_time", part_time: "part_time", contract: "contract", freelance: "contract", internship: "internship" } as Record<string, JobType>)[r.job_type] ?? null;
  return toJob("Remotive", r.id, {
    title: r.title, employer: r.company_name, location: `Remote (${r.candidate_required_location})`, description: r.description,
    url: r.url, posted: r.publication_date, remote: true, jobType,
    salary: r.salary ? { text: String(r.salary), estimated: false } : null,
  });
}

const remotive: JobSource = {
  name: "Remotive",
  needsKey: null,
  attributionUrl: "https://remotive.com",
  configured: () => true,
  async fetch() {
    const data = await getJson<Raw>("https://remotive.com/api/remote-jobs", { params: { limit: 300 }, ttlMs: FEED_TTL_MS });
    return present((data.jobs ?? [])
      .filter((r: Raw) => hasAny(norm(r.candidate_required_location), US_REMOTE))
      .map(parseRemotive));
  },
};

export function parseJobicy(r: Raw): SourceJob | null {
  const factor = ({ hourly: HOURS_PER_YEAR, weekly: 52, monthly: 12 } as Record<string, number>)[r.salaryPeriod] ?? 1;
  const usd = r.salaryCurrency === "USD";
  const scale = (n: number | null) => (n === null || !usd ? null : n * factor);
  const types = norm((r.jobType ?? []).join(" "));
  return toJob("Jobicy", r.id, {
    title: r.jobTitle, employer: r.companyName, location: `Remote (${r.jobGeo})`, description: r.jobDescription ?? r.jobExcerpt,
    url: r.url, posted: r.pubDate, remote: true,
    salary: salary(scale(money(r.salaryMin)), scale(money(r.salaryMax))),
    jobType: detectJobType(types, ""),
    level: ["senior", "director", "manager"].includes(norm(r.jobLevel)) ? "senior" : null,
  });
}

const jobicy: JobSource = {
  name: "Jobicy",
  needsKey: null,
  attributionUrl: "https://jobicy.com",
  configured: () => true,
  async fetch() {
    const data = await getJson<Raw>("https://jobicy.com/api/v2/remote-jobs", { params: { count: 100, geo: "usa" }, ttlMs: FEED_TTL_MS });
    return present((data.jobs ?? []).map(parseJobicy));
  },
};

export const SOURCES: JobSource[] = [usaJobs, theMuse, remotive, jobicy];

/** Ask every source at once. Returns the listings and one status per source, including failures. */
export async function fetchAll(queries: string[], categories: JobCategory[], request: JobSearchRequest, sources: JobSource[] = SOURCES) {
  const limited = queries.slice(0, MAX_QUERIES);
  const results = await Promise.all(sources.map(async (source): Promise<[SourceJob[], JobSourceStatus]> => {
    const base = { name: source.name, attributionUrl: source.attributionUrl };
    if (!source.configured()) {
      return [[], { ...base, state: "not_configured", count: 0, message: `Not used: set ${source.needsKey} in .env.local.` }];
    }
    try {
      const jobs = await source.fetch(limited, categories, request);
      return [jobs, { ...base, state: "ok", count: jobs.length, message: jobs.length ? `${jobs.length} listings returned.` : "Responded, but returned no listings." }];
    } catch (error) {
      const reason = error instanceof SourceUnavailable ? error.message : "something went wrong reading its response";
      return [[], { ...base, state: "error", count: 0, message: `Unavailable: ${reason}.` }];
    }
  }));
  return { jobs: results.flatMap(([jobs]) => jobs), statuses: results.map(([, status]) => status) };
}
