import type { JobType } from "@/types";
import { type Employer, employerSource } from "./employers";
import { BOARD_TTL_MS, getJson } from "./http";
import { detectJobType, isUsLocation, makeJob, parseSalaryText, present, type Raw } from "./job";
import type { SourceJob } from "./types";

const TYPES: Record<string, JobType> = { FullTime: "full_time", PartTime: "part_time", Intern: "internship", Contract: "contract", Temporary: "temporary" };

export function parseAshby(r: Raw, employer: Employer): SourceJob | null {
  if (r.isListed === false) return null;
  const title = String(r.title ?? "");
  const description = r.descriptionPlain ?? r.descriptionHtml;
  const compensation = r.compensation?.scrapeableCompensationSalarySummary ?? r.compensation?.compensationTierSummary;
  return makeJob("Ashby", r.id, {
    title, employer: employer.name, location: r.location ?? null, description, url: r.applyUrl ?? r.jobUrl, posted: r.publishedAt,
    salary: parseSalaryText(compensation) ?? parseSalaryText(description),
    jobType: TYPES[r.employmentType] ?? detectJobType(title, description),
    remote: r.isRemote === true || r.workplaceType === "Remote",
    verifiedOpen: true,
  });
}

function inUs(r: Raw): boolean {
  const country = r.address?.postalAddress?.addressCountry;
  return country ? /^(us|usa|united states)/i.test(country) : isUsLocation(r.location);
}

export const ashby = employerSource("Ashby employer boards", "ashby", async (employer) => {
  const data = await getJson<Raw>(`https://api.ashbyhq.com/posting-api/job-board/${employer.token}`, { params: { includeCompensation: "true" }, ttlMs: BOARD_TTL_MS });
  return present((data.jobs ?? []).filter(inUs).map((r: Raw) => parseAshby(r, employer)));
});
