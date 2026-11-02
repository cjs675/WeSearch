import type { JobCategory, JobMatch, JobSearchRequest, JobSearchResponse, JobSourceStatus, Resume } from "@/types";
import { buildProfile, roleCategories, suggestedCategories } from "./profile";
import { isEntryLevel, isSenior, requiredYears, scoreJob } from "./scoring";
import { fetchAll } from "./sources";
import type { JobSource, SourceJob } from "./sources/types";
import { CATEGORIES, CATEGORY_NAMES, CORPORATE_TITLE_TERMS, JOB_TYPE_KEYWORDS, KEYWORD_CATEGORY_ALIASES, RELATED_KEYWORDS } from "./taxonomy";
import { hasAny, hasTerm, norm } from "./text";

const DEFAULT_MAX_AGE_DAYS = 90;
const MAX_RESULTS = 100;
const EMPLOYER_TERMS = CATEGORY_NAMES.flatMap((c) => CATEGORIES[c].employers ?? []);

/** Categories a listing belongs to, judged on title, employer and board label, never on the description alone. */
export function jobCategories(job: Pick<SourceJob, "title" | "employer" | "description" | "labels">): JobCategory[] {
  const title = norm(job.title);
  const employer = norm(job.employer);
  return CATEGORY_NAMES.filter((name) => {
    const category = CATEGORIES[name];
    if (hasAny(title, category.exclude)) return false;
    const context = category.contextTitles;
    return (
      hasAny(title, category.titles) ||
      (hasAny(employer, category.employers) && !hasAny(title, CORPORATE_TITLE_TERMS)) ||
      (context !== undefined && hasAny(title, context.titles) && hasAny(norm(`${job.title} ${job.description}`), context.context)) ||
      job.labels.includes(name)
    );
  });
}

/** How well a listing fits one keyword: 3 in title or employer, 2 related title, 1 description only, 0 no fit. */
export function keywordTier(job: SourceJob, keyword: string): number {
  const key = norm(keyword);
  const title = norm(job.title);
  const employer = norm(job.employer);
  const text = norm(job.description);
  if (JOB_TYPE_KEYWORDS[key]) {
    if (job.jobType === JOB_TYPE_KEYWORDS[key] || hasTerm(title, key)) return 3;
    return job.jobType === null && hasTerm(text, key) ? 1 : 0;
  }
  if (key === "paid internship") {
    if (!hasAny(title, ["intern", "internship"]) || hasTerm(`${title} ${text}`, "unpaid")) return 0;
    return hasTerm(`${title} ${text}`, "paid") || job.salary ? 3 : 2;
  }
  if (KEYWORD_CATEGORY_ALIASES[key]) return job.categories.includes(KEYWORD_CATEGORY_ALIASES[key]) ? 3 : 0;
  if (hasTerm(title, key) || hasTerm(employer, key)) return 3;
  if (EMPLOYER_TERMS.includes(key)) return 0; // "McDonald's experience a plus" isn't a McDonald's job
  if (hasAny(title, RELATED_KEYWORDS[key])) return 2;
  return hasTerm(text, key) ? 1 : 0;
}

/** Queries to send to the APIs and job titles to show the user. Explicit choices always come first. */
export function generateTerms(categories: JobCategory[], keywords: string[]) {
  const queries: string[] = [];
  const titles: string[] = [];
  for (const keyword of keywords) {
    const key = norm(keyword);
    const related = RELATED_KEYWORDS[key] ?? [];
    queries.push(keyword, ...related.slice(0, 1));
    titles.push(...related.map((r) => r.replace(/\b[a-z]/g, (c) => c.toUpperCase())));
    const alias = KEYWORD_CATEGORY_ALIASES[key];
    if (alias) titles.push(...CATEGORIES[alias].titlesToTry);
  }
  if (keywords.length && categories.length) {
    const primary = CATEGORIES[categories[0]].queries[0];
    queries.unshift(...keywords.slice(0, 2).map((k) => `${k} ${primary}`));
  }
  // First query of each category, then second, so several categories share the query budget fairly
  for (let depth = 0; depth < 3; depth++) {
    for (const category of categories) {
      const option = CATEGORIES[category].queries[depth];
      if (option) queries.push(option);
    }
  }
  for (const category of categories) titles.push(...CATEGORIES[category].titlesToTry);
  return { queries: [...new Set(queries)], titles: [...new Set(titles)] };
}

function dedupeKey(job: SourceJob): string {
  const title = norm(job.title.replace(/\(.*?\)|\[.*?\]/g, " ").split(/\s[-–|]\s/)[0]);
  const employer = norm(job.employer).replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b/g, "").trim();
  return [title, employer.replace(/\s+/g, " "), norm((job.location ?? "").split(",")[0])].join("|");
}

/** One entry per real job, keeping the richest copy and every source it came from. */
export function dedupe(jobs: SourceJob[]): SourceJob[] {
  const byKey = new Map<string, SourceJob>();
  const byUrl = new Map<string, SourceJob>();
  for (const job of jobs) {
    const key = dedupeKey(job);
    const existing = byKey.get(key) ?? byUrl.get(job.applyUrl);
    if (!existing) {
      const copy = { ...job, sources: [...job.sources] };
      byKey.set(key, copy);
      byUrl.set(job.applyUrl, copy);
      continue;
    }
    for (const source of job.sources) if (!existing.sources.includes(source)) existing.sources.push(source);
    existing.salary ??= job.salary;
    existing.postedAt ??= job.postedAt;
    existing.jobType ??= job.jobType;
    if (job.description.length > existing.description.length) {
      existing.description = job.description;
      existing.descriptionIsPartial = job.descriptionIsPartial;
    }
  }
  return [...byKey.values()];
}

function ageInDays(job: SourceJob, now: number): number | null {
  const posted = job.postedAt ? Date.parse(job.postedAt) : NaN;
  return Number.isNaN(posted) ? null : Math.floor((now - posted) / 86_400_000);
}

function locationFits(job: SourceJob, wanted: string): boolean {
  if (job.remote || job.locationCheckedByApi) return true;
  const city = norm(wanted.split(",")[0]);
  return Boolean(city) && hasTerm(norm(job.location), city);
}

const yearlyPay = (job: SourceJob) => job.salary?.max ?? job.salary?.min ?? null;

interface Scored { job: SourceJob; match: JobMatch; relevance: number }

export function applyFilters(items: Scored[], request: JobSearchRequest, now = Date.now()) {
  const counts: Record<string, number> = {};
  const count = (reason: string) => { counts[reason] = (counts[reason] ?? 0) + 1; return false; };
  const maxAge = request.maxAgeDays === undefined ? DEFAULT_MAX_AGE_DAYS : request.maxAgeDays;
  const remote = request.remote ?? "any";
  const kept = items.filter(({ job, match }) => {
    const age = ageInDays(job, now);
    if (maxAge !== null && age !== null && age > maxAge) return count("age");
    if (request.location && !locationFits(job, request.location)) return count("location");
    if ((remote === "only" && !job.remote) || (remote === "exclude" && job.remote)) return count("remote");
    if (request.jobType && job.jobType !== null && job.jobType !== request.jobType) return count("jobType");
    if (request.minSalary) {
      const pay = yearlyPay(job);
      if (pay === null ? request.salaryRequired : pay < request.minSalary) return count("salary");
    }
    if (request.minScore && match.compatibility && match.compatibility.score < request.minScore) return count("score");
    return true;
  });
  const notes: string[] = [];
  if (counts.age) notes.push(`${counts.age} listings hidden for being posted over ${maxAge} days ago.`);
  if (request.distanceMiles) notes.push("Distance is only applied by USAJOBS. Other sources match the same city name or remote.");
  if (request.jobType && kept.some(({ job }) => job.jobType === null)) notes.push("Listings that don't state a job type stay in the results.");
  if (request.minSalary && !request.salaryRequired && kept.some(({ job }) => yearlyPay(job) === null)) notes.push("Listings with no stated pay stay in the results.");
  return { kept, counts, notes };
}

function emptyMessage(statuses: JobSourceStatus[], filtered: Record<string, number>): string {
  if (!statuses.some((s) => s.state === "ok")) return "No job source could be reached, so there are no results.";
  const reasons = Object.keys(filtered);
  if (reasons.length === 1 && reasons[0] === "age") return "The only matches are old listings, which are hidden because they may have closed.";
  if (reasons.length) return "Job sources responded, but your filters removed every match. Try loosening them.";
  return "Job sources responded, but none of their listings match this search.";
}

/** Strips pipeline-only fields so they don't leak into the API response. */
function publicJob({ level: _level, labels: _labels, locationCheckedByApi: _checked, ...job }: SourceJob) {
  return job;
}

export async function searchJobs(request: JobSearchRequest, resume?: Resume | null, sources?: JobSource[]): Promise<JobSearchResponse> {
  const { keywords, categories } = request;
  const profile = resume ? buildProfile(resume) : null;
  const explicit = categories.length > 0 || keywords.length > 0;
  const suggested = profile ? suggestedCategories(profile) : [];
  const base = { suggestedCategories: suggested, sources: [] as JobSourceStatus[], searchTerms: [] as string[], relatedTitles: [] as string[], notes: [] as string[] };
  if (!explicit && !profile) {
    return { ...base, matches: [], total: 0, message: "Choose a category, type a keyword, or add a resume to search." };
  }

  const searchCategories = explicit ? categories : suggested;
  // Sources with no text search are browsed by category, so work out which ones a keyword points to.
  // This only widens what's fetched: listings still have to match the keyword below.
  const keywordCategories = keywords.flatMap((k) => KEYWORD_CATEGORY_ALIASES[norm(k)] ?? roleCategories(k, k));
  const { queries, titles } = generateTerms(searchCategories, keywords);
  const { jobs: raw, statuses } = await fetchAll(queries, [...new Set([...searchCategories, ...keywordCategories])], request, sources);
  const entryOnly = !explicit && profile !== null && !profile.hasExperience;

  const scored: Scored[] = [];
  for (const unique of dedupe(raw)) {
    const job = { ...unique, categories: jobCategories(unique) };
    const tiers = keywords.map((k) => keywordTier(job, k));
    const inCategory = !searchCategories.length || searchCategories.some((c) => job.categories.includes(c));
    if (!inCategory || tiers.includes(0)) continue;
    if (entryOnly && (isSenior(job) || (requiredYears(job) ?? 0) >= 3)) continue;
    scored.push({
      job,
      relevance: tiers.length ? Math.min(...tiers) : 2,
      match: {
        job: publicJob(job),
        compatibility: profile ? scoreJob(job, profile) : null,
        entryLevel: isEntryLevel(job),
        matchedKeywords: keywords.filter((_, i) => tiers[i] > 0),
      },
    });
  }

  const { kept, counts, notes } = applyFilters(scored, request);
  // Category and keyword fit come first, resume compatibility second, recency last
  kept.sort((a, b) =>
    b.relevance - a.relevance ||
    (b.match.compatibility?.score ?? -1) - (a.match.compatibility?.score ?? -1) ||
    (b.job.postedAt ?? "").localeCompare(a.job.postedAt ?? ""));

  return {
    ...base,
    matches: kept.slice(0, MAX_RESULTS).map((item) => item.match),
    total: kept.length,
    sources: statuses,
    searchTerms: queries.slice(0, 6),
    relatedTitles: titles,
    notes,
    message: kept.length ? null : emptyMessage(statuses, counts),
  };
}
