import type {
  JobCategory,
  JobListing,
  JobMatch,
  JobSearchRequest,
  JobSearchResponse,
  JobSourceStatus,
  JobType,
  Resume,
  CompatibilityScore,
} from "@/types";
import { findSkillNames, escapeRegExp } from "@/lib/skills";

/**
 * Scope of the whole app: tech jobs only, located in Florida or remote.
 * Everything below enforces that on fetched listings before they reach the UI.
 */

// ---------------------------------------------------------------------------
// Source payload shapes
// ---------------------------------------------------------------------------

interface AdzunaJob {
  id?: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string | null };
  location?: {
    display_name?: string | null;
    area?: string[];
  };
  contract_time?: string | null;
  category?: { label?: string; tag?: string };
  salary_min?: number | null;
  salary_max?: number | null;
}

interface RemotiveJob {
  id?: string | number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  /** A comma-separated string on Remotive, e.g. "react, node". */
  tags?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
}

interface RemoteOKJob {
  id?: string | number;
  position?: string;
  company?: string;
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  tags?: string[];
  date?: string | number;
  salary_min?: number;
  salary_max?: number;
}

// ---------------------------------------------------------------------------
// Small text / date helpers
// ---------------------------------------------------------------------------

/** Long descriptions are cut server-side; the flag tells the UI to say so. */
const MAX_DESCRIPTION_CHARS = 2000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", middot: "·", bull: "•", euro: "€", deg: "°",
  copy: "©", reg: "®", trade: "™", pound: "£", yen: "¥", szlig: "ß",
  auml: "ä", ouml: "ö", uuml: "ü", eacute: "é", egrave: "è", agrave: "à",
  ccedil: "ç", bsol: "\\", sol: "/", excl: "!", quest: "?",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&#(\d+);/g, (m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      NAMED_ENTITIES[name.toLowerCase()] ?? NAMED_ENTITIES[name] ?? m
    );
}

/** HTML to readable text: real line breaks at block boundaries, decoded entities. */
function stripHtml(html: string): string {
  let out = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  out = out.replace(/<[^>]*>/g, " ");
  out = decodeEntities(out);
  out = out.replace(/[ \t\u00a0]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

function cleanDescription(html?: string | null): { text: string; partial: boolean } {
  const stripped = stripHtml(html || "");
  if (!stripped) return { text: "", partial: false };
  if (stripped.length <= MAX_DESCRIPTION_CHARS) return { text: stripped, partial: false };
  return { text: `${stripped.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()}…`, partial: true };
}

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const n = typeof value === "string" ? parseInt(value, 10) : value;
    const ms = n >= 1e12 ? n : n * 1000; // seconds vs milliseconds epochs
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapJobType(fragment?: string | null): JobType | null {
  if (!fragment) return null;
  const lower = fragment.toLowerCase();
  if (lower.includes("full") || lower.includes("permanent")) return "full_time";
  if (lower.includes("part")) return "part_time";
  if (lower.includes("contract")) return "contract";
  if (lower.includes("intern")) return "internship";
  if (lower.includes("temp")) return "temporary";
  return null;
}

// ---------------------------------------------------------------------------
// Tech-only categorization (also the tech-only scope filter)
// ---------------------------------------------------------------------------

/** Trusted source categories mapped onto our categories, without guessing. */
const REMOTIVE_CATEGORY_MAP: Record<string, JobCategory[]> = {
  "Software Development": ["Software Engineering"],
  "DevOps and Sysadmin": ["DevOps & Cloud", "IT & Support"],
  Data: ["Data & AI"],
  QA: ["QA"],
  Product: ["Product"],
  Design: ["Design"],
};

const CATEGORY_KEYWORDS: Array<[JobCategory, string[]]> = [
  ["Software Engineering", [
    "software", "engineer", "engineering", "developer", "programmer",
    "full stack", "fullstack", "backend", "back end", "frontend", "front end",
    "web", "mobile", "ios", "android", "api", "python", "javascript", "typescript",
    "java", "php", "ruby", "golang", "rust", "scala", "kotlin", "swift",
    "react", "angular", "vue", "node", "wordpress", "shopify", "salesforce", "sap",
  ]],
  ["Data & AI", [
    "data scientist", "data engineer", "data analyst", "data science", "data manager",
    "database", "analytics", "machine learning", "nlp", "sql",
    "bi analyst", "bi developer", "data warehouse", "etl",
  ]],
  ["DevOps & Cloud", [
    "devops", "sre", "cloud", "aws", "azure", "gcp", "kubernetes", "docker",
    "terraform", "linux", "infrastructure", "platform engineer",
  ]],
  ["QA", ["qa", "test", "quality assurance", "sdet"]],
  ["Security", ["security", "cyber", "infosec", "appsec", "penetration", "soc"]],
  ["Design", ["ux", "ui", "designer", "design", "figma", "graphic", "illustration", "motion", "creative"]],
  ["Product", ["product"]],
  ["IT & Support", [
    "it support", "it manager", "it specialist", "it technician", "sysadmin",
    "system administrator", "systems administrator", "helpdesk", "help desk",
    "support engineer", "technical support", "desktop support", "network",
  ]],
  ["Internships", ["intern", "internship", "trainee"]],
];

// Keywords that always mean a non-US / not-FL-accessible remote listing —
// unless the same location also mentions a US-accessible marker.
const BLOCKED_REMOTE_LOCATIONS = /europe|european|uk|united kingdom|germany|india|australia|philippines|latin america|latam|brazil|france|spain|poland|netherlands|portugal|italy|africa|asia|singapore|japan|middle east|uae|dubai|israel|argentina|mexico|colombia/i;
const US_ACCESSIBLE_LOCATION = /\b(usa|us only|us &|u\.s\.|united states|worldwide|anywhere|remote|north america|florida)\b/i;

/** Title words that make a role clearly non-tech, even if the source misfiled it. */
const NON_TECH_TITLE_RE =
  /\b(assistant|coordinator|receptionist|recruiter|bookkeep|accountant|accounting|payroll|customer (service|support)|office manager|virtual assistant|data entry|sales|marketing)\b/i;
const FL_CITIES_RE = new RegExp(
  [
    "tallahassee", "jacksonville", "miami", "tampa", "orlando", "st\\. petersburg",
    "hialeah", "fort lauderdale", "port st\\. lucie", "pembroke pines", "homestead",
    "davie", "pompano beach", "sarasota", "gainesville", "clearwater", "palm bay",
    "west palm beach", "boca raton", "lakeland", "brandon", "naples", "bradenton",
    "melbourne", "ocala", "pensacola", "panama city", "coral springs", "miramar",
    "daytona beach", "deltona", "palm coast", "palm harbor", "lehigh acres",
    "punta gorda", "port charlotte", "spring hill", "winter haven", "kissimmee",
    "new port richey", "tampa bay",
  ].join("|"),
  "i"
);

function isTechCategories(text: string): JobCategory[] {
  const matched: JobCategory[] = [];
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`(^|\\W)${escapeRegExp(keyword)}s?(\\W|$)`, "i");
      if (pattern.test(text)) {
        matched.push(cat);
        break;
      }
    }
  }
  return matched;
}

/** True when the listing is reachable from Florida: remote, a Florida place, or a Florida city. */
function isInScopeLocation(job: { remote: boolean; location: string | null }): boolean {
  if (job.remote) return true;
  const loc = job.location || "";
  if (/florida|(^|\s)fl\b/i.test(loc)) return true;
  return FL_CITIES_RE.test(loc);
}

// ---------------------------------------------------------------------------
// Source fetchers (each returns listings within scope, plus a status)
// ---------------------------------------------------------------------------

function adzunaConfigured(): boolean {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

async function fetchAdzunaFlorida(): Promise<{ jobs: JobListing[]; status: JobSourceStatus }> {
  const name = "Adzuna (Florida)";
  if (!adzunaConfigured()) {
    return {
      jobs: [],
      status: {
        name,
        state: "not_configured",
        count: 0,
        message: `${name}: set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env.local to show statewide Florida jobs.`,
      },
    };
  }
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    const url =
      `https://api.adzuna.com/v1/api/jobs/us/search/1` +
      `?app_id=${encodeURIComponent(appId!)}&app_key=${encodeURIComponent(appKey!)}` +
      `&results_per_page=50&where=${encodeURIComponent("Florida")}&category=it-jobs`;

    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        jobs: [],
        status: {
          name,
          state: "error",
          count: 0,
          message: `${name} returned HTTP ${res.status}${res.status === 401 || res.status === 403 ? " (check the API keys)" : ""}`,
        },
      };
    }

    const data = (await res.json()) as { results?: AdzunaJob[] };
    const rawJobs = Array.isArray(data.results) ? data.results : [];

    // Adzuna's `where` parameter is advisory in practice — enforce with the area
    // hierarchy so a misbehaving response can't leak out-of-state jobs in.
    const scoped = rawJobs.filter((item) => Boolean(item.location?.area?.includes("Florida")));

    const jobs: JobListing[] = scoped
      .map((item) => {
        const title = item.title || "";
        const locationLabel = item.location?.display_name || "Florida";
        const text = `${title} ${item.category?.label ?? ""}`;
        let categories = isTechCategories(text);
        if (categories.length === 0) categories = ["Other Tech"];

        // Free text salaries come without currency, so only exact numbers count.
        const salary =
          typeof item.salary_min === "number" || typeof item.salary_max === "number"
            ? { min: item.salary_min ?? undefined, max: item.salary_max ?? undefined, estimated: false }
            : null;

        const desc = cleanDescription(item.description);

        return {
          id: `adzuna-${item.id}`,
          sources: [name],
          title,
          employer: item.company?.display_name || null,
          location: locationLabel,
          remote: /remote/i.test(title) || /remote/i.test(locationLabel),
          description: desc.text,
          descriptionIsPartial: desc.partial,
          applyUrl: item.redirect_url || "",
          postedAt: toIso(item.created),
          salary,
          jobType: mapJobType(item.contract_time),
          categories,
        } satisfies JobListing;
      })
      .filter((job) => job.title.trim().length > 0);

    return {
      jobs,
      status: {
        name,
        state: "ok",
        count: jobs.length,
        message: `Fetched ${jobs.length} Florida listings from Adzuna`,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch from Adzuna";
    return { jobs: [], status: { name, state: "error", count: 0, message: `${name}: ${message}` } };
  }
}

async function fetchRemotive(): Promise<{ jobs: JobListing[]; status: JobSourceStatus }> {
  const name = "Remotive";
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=100", {
      next: { revalidate: 60 },
      headers: { Accept: "application/json", "User-Agent": "WeSearch/1.0" },
    });
    if (!res.ok) {
      return {
        jobs: [],
        status: { name, state: "error", count: 0, message: `${name} returned HTTP ${res.status}` },
      };
    }

    const data = (await res.json()) as { jobs?: RemotiveJob[] };
    const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];

    const jobs: JobListing[] = rawJobs
      .map((item): JobListing | null => {
        // Location is the candidate's own location, so keep only listings a
        // Florida resident is actually eligible for. Everything else is remote.
        const candidateLocation = item.candidate_required_location || "";
        const usAccessible =
          !BLOCKED_REMOTE_LOCATIONS.test(candidateLocation) ||
          US_ACCESSIBLE_LOCATION.test(candidateLocation);
        if (!usAccessible) return null;

        const cleanDesc = cleanDescription(item.description);
        // Remotive's own categories are trustworthy; titles/tags refine the chips.
        const trusted = REMOTIVE_CATEGORY_MAP[item.category?.trim() ?? ""] ?? [];
        const refined = isTechCategories(`${item.title ?? ""} ${item.tags ?? ""}`);
        // Sources sometimes file clearly non-tech roles under a tech category and
        // tag them with keyword spam — judge the title, not the tags.
        const titleTech = isTechCategories(item.title ?? "");
        if (titleTech.length === 0 && NON_TECH_TITLE_RE.test(item.title ?? "")) return null;
        const categories = Array.from(new Set([...trusted, ...refined]));
        if (categories.length === 0) return null; // tech only

        return {
          id: `remotive-${item.id}`,
          sources: [name],
          title: item.title ?? "Untitled Role",
          employer: item.company_name || null,
          location: candidateLocation || null,
          remote: true,
          description: cleanDesc.text,
          descriptionIsPartial: cleanDesc.partial,
          applyUrl: item.url || "",
          postedAt: toIso(item.publication_date),
          salary: null,
          jobType: mapJobType(item.job_type),
          categories,
        };
      })
      .filter((job): job is JobListing => job !== null)
      .filter((job) => job.applyUrl.length > 0);

    return {
      jobs,
      status: {
        name,
        state: "ok",
        count: jobs.length,
        message: `Fetched ${jobs.length} remote listings from Remotive`,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch from Remotive";
    return { jobs: [], status: { name, state: "error", count: 0, message: `${name}: ${message}` } };
  }
}

async function fetchRemoteOK(): Promise<{ jobs: JobListing[]; status: JobSourceStatus }> {
  const name = "RemoteOK";
  try {
    const res = await fetch("https://remoteok.com/api", {
      next: { revalidate: 60 },
      headers: { "User-Agent": "WeSearch/1.0", Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        jobs: [],
        status: { name, state: "error", count: 0, message: `${name} returned HTTP ${res.status}` },
      };
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return {
        jobs: [],
        status: { name, state: "error", count: 0, message: `${name}: unexpected response format` },
      };
    }

    // The first element of the feed is legal metadata, not a job.
    const jobItems = (data as RemoteOKJob[]).filter((item) => item.position && item.id);
    const jobs: JobListing[] = jobItems
      .slice(0, 50)
      .map((item): JobListing | null => {
        const cleanDesc = cleanDescription(item.description);
        // RemoteOK's tag list is noisy, so tech classification is title-first.
        const categories = isTechCategories(item.position || "");
        if (categories.length === 0) return null;

        const salary =
          typeof item.salary_min === "number" || typeof item.salary_max === "number"
            ? { min: item.salary_min, max: item.salary_max, estimated: false }
            : null;

        return {
          id: `remoteok-${item.id}`,
          sources: [name],
          title: item.position || "Untitled Role",
          employer: item.company || null,
          location: item.location || null,
          remote: true,
          description: cleanDesc.text,
          descriptionIsPartial: cleanDesc.partial,
          applyUrl: item.apply_url || item.url || `https://remoteok.com/l/${item.id}`,
          postedAt: toIso(item.date),
          salary,
          // RemoteOK doesn't say the contract type; null beats a guess.
          jobType: null,
          categories,
        };
      })
      .filter((job): job is JobListing => job !== null);

    return {
      jobs,
      status: {
        name,
        state: "ok",
        count: jobs.length,
        message: `Fetched ${jobs.length} remote listings from RemoteOK`,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch from RemoteOK";
    return { jobs: [], status: { name, state: "error", count: 0, message: `${name}: ${message}` } };
  }
}

// ---------------------------------------------------------------------------
// Deduplication across sources
// ---------------------------------------------------------------------------

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Merge the same role found on two boards into one listing with combined sources. */
function dedupeJobs(listings: JobListing[]): JobListing[] {
  const byKey = new Map<string, JobListing>();
  const out: JobListing[] = [];

  for (const job of listings) {
    const key =
      job.employer
        ? `${normalizeKey(job.title)}::${normalizeKey(job.employer)}`
        : `${normalizeKey(job.title)}::${normalizeKey(job.applyUrl)}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, job);
      out.push(job);
      continue;
    }

    const base = job.description.length >= existing.description.length ? job : existing;
    const other = base === job ? existing : job;
    const merged: JobListing = {
      ...base,
      sources: Array.from(new Set([...existing.sources, ...job.sources])),
      categories: Array.from(new Set([...existing.categories, ...job.categories])),
      remote: existing.remote || other.remote,
      salary: base.salary ?? other.salary,
      jobType: base.jobType ?? other.jobType,
      postedAt: base.postedAt ?? other.postedAt,
      employer: base.employer ?? other.employer,
      location: base.location ?? other.location,
    };
    const index = out.indexOf(existing);
    out[index] = merged;
    byKey.set(key, merged);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Compatibility scoring
// ---------------------------------------------------------------------------

function computeCompatibility(job: JobListing, resume: Resume): CompatibilityScore {
  const candidateSkills = resume.skills.map((s) => s.name);
  const candidateLower = new Set(candidateSkills.map((n) => n.toLowerCase()));
  const jobText = `${job.title} ${job.description}`.toLowerCase();

  const matchedSkills = candidateSkills.filter((name) =>
    new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`).test(jobText)
  );

  // Skills the posting itself asks for that the candidate doesn't list.
  // Only the posting's own text counts, so techniques are never invented.
  const jobTextClean = `${job.title} ${job.description}`;
  const missingSkills = findSkillNames(jobTextClean)
    .filter((name) => !candidateLower.has(name.toLowerCase()))
    .slice(0, 3);

  const skillScore =
    candidateSkills.length > 0
      ? Math.min(60, Math.round((matchedSkills.length / candidateSkills.length) * 60))
      : 0;

  const experienceYears = resume.experience.reduce(
    (acc, exp) => acc + (typeof exp.years === "number" && exp.years > 0 ? exp.years : 0),
    0
  );
  const experienceScore = Math.min(25, Math.round(experienceYears * 5));

  // Points reflect only what the profile actually states.
  const educationScore = resume.education.length > 0 ? 10 : 0;
  const certificationScore = resume.certifications.length > 0 ? 5 : 0;
  const backgroundScore = Math.min(15, educationScore + certificationScore);

  const totalScore = Math.min(100, Math.max(0, skillScore + experienceScore + backgroundScore));

  const hasCertifications = resume.certifications.length > 0;
  const hasEducation = resume.education.length > 0;
  const backgroundParts = [hasEducation ? "education" : null, hasCertifications ? "certifications" : null]
    .filter(Boolean)
    .join(" and ");

  return {
    score: totalScore,
    components: [
      {
        name: "Skill Match",
        points: skillScore,
        maxPoints: 60,
        explanation:
          candidateSkills.length > 0
            ? `${matchedSkills.length} of your ${candidateSkills.length} skills appear in this posting.`
            : "Your profile has no skills listed yet.",
      },
      {
        name: "Experience",
        points: experienceScore,
        maxPoints: 25,
        explanation:
          experienceYears > 0
            ? `${experienceYears} years across the roles stated in your profile.`
            : "No years of experience are stated in your profile yet.",
      },
      {
        name: "Background",
        points: backgroundScore,
        maxPoints: 15,
        explanation: backgroundScore > 0
          ? `Based on the ${backgroundParts} listed in your profile.`
          : "No education or certifications are listed in your profile yet.",
      },
    ],
    matchedSkills,
    transferableSkills: [],
    missingSkills,
    qualifications: [
      {
        label: "Relevant Domain Experience",
        status: matchedSkills.length > 0 ? "met" : "check_yourself",
        evidence:
          matchedSkills.length > 0
            ? `Your skills found in this posting: ${matchedSkills.join(", ")}`
            : "No skills from your profile appear in this posting. Read it yourself to decide fit.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchJobs(
  request: JobSearchRequest,
  resume?: Resume
): Promise<JobSearchResponse> {
  const [adzunaResult, remotiveResult, remoteokResult] = await Promise.all([
    fetchAdzunaFlorida(),
    fetchRemotive(),
    fetchRemoteOK(),
  ]);

  const sources: JobSourceStatus[] = [
    adzunaResult.status,
    remotiveResult.status,
    remoteokResult.status,
  ];

  let allListings = dedupeJobs([
    ...adzunaResult.jobs,
    ...remotiveResult.jobs,
    ...remoteokResult.jobs,
  ]);

  // The scope filter itself: tech only is applied in the fetchers above; here
  // we enforce location — the job must be in Florida, or remote.
  allListings = allListings.filter((job) => isInScopeLocation(job));

  // Keyword filter — every keyword must hit; fall back to any-keyword only
  // when strict matching would return nothing.
  const kws = (request.keywords ?? [])
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);

  if (kws.length > 0) {
    const isMatch = (job: JobListing, kw: string) =>
      job.title.toLowerCase().includes(kw) ||
      job.description.toLowerCase().includes(kw) ||
      (job.employer || "").toLowerCase().includes(kw);

    const everyKeyword = allListings.filter((job) => kws.every((kw) => isMatch(job, kw)));
    allListings =
      everyKeyword.length > 0
        ? everyKeyword
        : allListings.filter((job) => kws.some((kw) => isMatch(job, kw)));
  }

  // Refine by location (narrows within the FL + remote scope). A specific
  // city narrows on-site Florida jobs only — remote roles still apply to you.
  if (request.location && request.location.trim().length > 0) {
    const loc = request.location.toLowerCase().trim();
    // "Tampa, FL" -> "tampa"; just "FL"/"Florida" matches the whole scope.
    const place = loc.replace(/,?\s*(fl(a)?\.?|florida)$/i, "").trim();
    allListings = allListings.filter((job) => {
      if (loc === "remote" || place === "" || place === "remote") {
        return job.remote || (job.location || "").toLowerCase().includes(loc);
      }
      const jobLoc = (job.location || "").toLowerCase();
      return job.remote || jobLoc.includes(place);
    });
  }

  if (request.remote === "only") {
    allListings = allListings.filter((job) => job.remote);
  } else if (request.remote === "exclude") {
    allListings = allListings.filter((job) => !job.remote);
  }

  if (request.categories && request.categories.length > 0) {
    allListings = allListings.filter((job) =>
      job.categories.some((cat) => request.categories!.includes(cat))
    );
  }

  const matches: JobMatch[] = allListings.map((job) => ({
    job,
    compatibility: resume ? computeCompatibility(job, resume) : null,
  }));

  // Best fit first when scoring is on; otherwise keep source order.
  if (resume) {
    matches.sort((a, b) => (b.compatibility?.score ?? 0) - (a.compatibility?.score ?? 0));
  }

  const unconstrainedScore = request.minScore;
  const filteredMatches = unconstrainedScore
    ? matches.filter((m) => (m.compatibility?.score ?? 0) >= unconstrainedScore)
    : matches;

  const finalMatches = filteredMatches.slice(0, 30);

  // Say what happened instead of letting an empty list look like a full answer.
  const failing = sources.filter((s) => s.state === "error");
  const workingSources = sources.filter((s) => s.state === "ok");
  const totalReturned = workingSources.reduce((n, s) => n + s.count, 0);

  let message: string | null = null;
  if (workingSources.length === 0) {
    message =
      failing.length > 0
        ? `No live listings could be fetched right now. ${failing.map((f) => f.message).join(" ")}`
        : "No live listings are available right now.";
  } else if (finalMatches.length === 0) {
    message =
      failing.length > 0
        ? `No matches for your search. Note: ${failing
            .map((f) => f.name)
            .join(" and ")} could not be reached.`
        : "No matching tech jobs found in Florida or remote for the given criteria.";
  }

  return {
    matches: finalMatches,
    sources,
    message,
  };
}
