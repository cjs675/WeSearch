import { stripHtml } from "../text";
import { type Employer, employerSource } from "./employers";
import { BOARD_TTL_MS, getJson } from "./http";
import { detectJobType, detectRemote, isUsLocation, makeJob, parseSalaryText, present, type Raw } from "./job";
import type { SourceJob } from "./types";

/** https://docs.greenhouse.io/job-board.html says GET endpoints are public and need no authentication. */
export function parseGreenhouse(r: Raw, employer: Employer): SourceJob | null {
  const title = String(r.title ?? "");
  const location = r.location?.name ?? null;
  const description = stripHtml(r.content);
  const deadline = r.application_deadline ? Date.parse(r.application_deadline) : NaN;
  if (deadline < Date.now()) return null;
  const typeField = (r.metadata ?? []).find((m: Raw) => /employment type/i.test(m?.name ?? ""))?.value;
  return makeJob("Greenhouse", r.id, {
    title, employer: employer.name, location, description, url: r.absolute_url, posted: r.first_published ?? r.updated_at,
    salary: parseSalaryText(description),
    jobType: detectJobType(`${title} ${typeField ?? ""}`, description),
    remote: detectRemote(title, location ?? "", description),
    verifiedOpen: true,
  });
}

export const greenhouse = employerSource("Greenhouse employer boards", "greenhouse", async (employer) => {
  const data = await getJson<Raw>(`https://boards-api.greenhouse.io/v1/boards/${employer.token}/jobs`, { params: { content: "true" }, ttlMs: BOARD_TTL_MS });
  return present((data.jobs ?? []).filter((r: Raw) => isUsLocation(r.location?.name)).map((r: Raw) => parseGreenhouse(r, employer)));
});
