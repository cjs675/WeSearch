import { allowRequest } from "@/features/job-matching/rate-limit";
import { searchJobs } from "@/features/job-matching/search";
import { CATEGORY_NAMES } from "@/features/job-matching/taxonomy";
import type { JobCategory, JobSearchRequest, JobType, Resume } from "@/types";

const JOB_TYPES: JobType[] = ["full_time", "part_time", "contract", "temporary", "internship"];
const MAX_BODY_BYTES = 1_000_000;

function positive(value: unknown): number | undefined {
  const n = Number(value);
  return value !== "" && value !== null && Number.isFinite(n) && n > 0 ? n : undefined;
}

function toRequest(body: Record<string, unknown>): JobSearchRequest {
  const rawKeywords = typeof body.keywords === "string" ? body.keywords.split(/[,;\n]/) : Array.isArray(body.keywords) ? body.keywords : [];
  const remote = body.remote === "only" || body.remote === "exclude" ? body.remote : "any";
  return {
    keywords: rawKeywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean).slice(0, 10),
    categories: (Array.isArray(body.categories) ? body.categories : []).filter((c): c is JobCategory => CATEGORY_NAMES.includes(c)),
    location: typeof body.location === "string" ? body.location.trim() || undefined : undefined,
    distanceMiles: positive(body.distanceMiles),
    remote,
    jobType: JOB_TYPES.includes(body.jobType as JobType) ? (body.jobType as JobType) : undefined,
    minSalary: positive(body.minSalary),
    salaryRequired: body.salaryRequired === true,
    minScore: positive(body.minScore),
    maxAgeDays: body.maxAgeDays === null ? null : positive(body.maxAgeDays),
  };
}

/** Body: the fields of JobSearchRequest, plus an optional `resume`. Returns a JobSearchResponse. */
export async function POST(httpRequest: Request) {
  if (!allowRequest(httpRequest)) return Response.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  const text = await httpRequest.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const fields = body as Record<string, unknown>;
  return Response.json(await searchJobs(toRequest(fields), (fields.resume as Resume | undefined) ?? null));
}
