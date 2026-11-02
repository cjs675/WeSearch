import type { JobType, Salary } from "@/types";
import { hasAny, hasTerm, norm, safeUrl, stripHtml } from "../text";
import type { SourceJob } from "./types";

const PARTIAL_DESCRIPTION_CHARS = 600;
const HOURS_PER_YEAR = 2080;
// A description can say "contract" or "full time" about something else, so job type is read from the title first
const TITLE_JOB_TYPES: [string, JobType][] = [
  ["internship", "internship"], ["intern", "internship"], ["part time", "part_time"], ["full time", "full_time"],
  ["contract", "contract"], ["temporary", "temporary"], ["seasonal", "temporary"],
];
const US_STATES = new Set(("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split(" "));
const US_STATE_NAMES = ["alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming"];
const FOREIGN_RE = /\b(canada|uk|united kingdom|england|ireland|germany|france|spain|india|mexico|brazil|australia|japan|korea|china|singapore|philippines|netherlands|poland|emea|apac|latam|europe)\b/i;

// Boards use these for collecting resumes. They aren't openings.
const NOT_A_JOB_RE = /\b(general application|talent (pool|community|network)|future opportunit|don'?t see|join our talent)/i;

export type Raw = Record<string, any>; // Untyped API JSON, read defensively by each adapter

export function money(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function isUsLocation(location: string | null | undefined): boolean {
  const text = location ?? "";
  if (/\b(united states|usa|u\.s\.)\b/i.test(text)) return true;
  if (FOREIGN_RE.test(text)) return false;
  if (/\bremote|flexible\b/i.test(text)) return true;
  const hasState = [...text.matchAll(/(?:,|^)\s*([A-Z]{2})\b/g)].some((m) => US_STATES.has(m[1]));
  return hasState || hasAny(norm(text), US_STATE_NAMES);
}

export function detectJobType(title: string, description = ""): JobType | null {
  const titleNorm = norm(title);
  const fromTitle = TITLE_JOB_TYPES.find(([term]) => hasTerm(titleNorm, term));
  if (fromTitle) return fromTitle[1];
  const text = norm(description);
  return hasTerm(text, "part time") ? "part_time" : hasTerm(text, "full time") ? "full_time" : null;
}

export function detectRemote(title: string, location: string, description: string): boolean {
  if (/\b(not|no|non)[ -]remote\b/i.test(description)) return false;
  return hasAny(norm(`${title} ${location}`), ["remote", "work from home", "wfh"]) ||
    hasAny(norm(description), ["fully remote", "100 remote", "work from home", "remote position", "remote role"]);
}

/** Pay as stated in text, like "$18 - $22 per hour" or "$211.4K - $290.6K". Null when no pay is stated. */
export function parseSalaryText(text: string | null | undefined): Salary | null {
  const match = (text ?? "").match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?([kK])?(?:\s*(?:-|–|—|to)\s*\$?\s?(\d[\d,]*(?:\.\d+)?)\s?([kK])?)?(\s*(?:\/|per|an?)\s*(?:hr|hour|yr|year|annum))?/);
  if (!match) return null;
  const amount = (digits: string | undefined, k: string | undefined) => (digits ? Number(digits.replace(/,/g, "")) * (k ? 1000 : 1) : null);
  const low = amount(match[1], match[2]);
  const high = amount(match[3], match[4] ?? match[2]);
  const unit = (match[5] ?? "").toLowerCase();
  const top = high ?? low ?? 0;
  const hourly = /hr|hour/.test(unit) || (!unit && top >= 7 && top < 200);
  const yearly = /yr|year|annum/.test(unit) || (!unit && top >= 15_000);
  if (!hourly && !yearly) return null;
  const factor = hourly ? HOURS_PER_YEAR : 1;
  return { min: low ? low * factor : undefined, max: high ? high * factor : undefined, text: match[0].trim(), estimated: false };
}

export function makeJob(source: string, id: unknown, fields: {
  title: unknown; employer: unknown; location: string | null; description: unknown; url: unknown; posted: unknown;
} & Partial<SourceJob>): SourceJob | null {
  const { title, employer, location, description, url, posted, ...extra } = fields;
  const applyUrl = safeUrl(url);
  const text = stripHtml(description as string);
  const cleanTitle = stripHtml(title as string);
  if (!applyUrl || !cleanTitle) return null; // Without a link it can't be applied to
  if (NOT_A_JOB_RE.test(cleanTitle)) return null;
  return {
    id: `${source}:${String(id)}`, sources: [source], title: cleanTitle, employer: stripHtml(employer as string) || null,
    location: location || null, remote: false, description: text, descriptionIsPartial: text.length < PARTIAL_DESCRIPTION_CHARS,
    applyUrl, postedAt: typeof posted === "string" && posted ? posted : null, salary: null, jobType: null, categories: [],
    level: null, labels: [], verifiedOpen: false, ...extra,
  };
}

export const present = (jobs: (SourceJob | null)[]) => jobs.filter((j): j is SourceJob => j !== null);
