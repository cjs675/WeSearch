import type { JobType } from "@/types";
import { norm } from "../text";
import { type Employer, employerSource } from "./employers";
import { BOARD_TTL_MS, getJson } from "./http";
import { detectJobType, isUsLocation, makeJob, money, parseSalaryText, present, type Raw } from "./job";
import type { SourceJob } from "./types";

const COMMITMENTS: [RegExp, JobType][] = [[/intern/, "internship"], [/part/, "part_time"], [/full/, "full_time"], [/contract/, "contract"], [/temp|season/, "temporary"]];

function leverSalary(r: Raw, description: string) {
  const range = r.salaryRange;
  if (range && range.currency === "USD") {
    const hourly = /hour/i.test(range.interval ?? "");
    const factor = hourly ? 2080 : 1;
    const min = money(range.min);
    const max = money(range.max);
    const text = hourly && min ? `$${min}${max && max !== min ? ` to $${max}` : ""} an hour` : undefined;
    if (min || max) return { min: min ? min * factor : undefined, max: max ? max * factor : undefined, text, estimated: false };
  }
  return parseSalaryText(description);
}

export function parseLever(r: Raw, employer: Employer): SourceJob | null {
  const title = String(r.text ?? "");
  const description = [r.descriptionPlain, ...(r.lists ?? []).flatMap((l: Raw) => [l.text, String(l.content ?? "").replace(/<\/li>/g, "\n")]), r.additionalPlain].filter(Boolean).join("\n");
  const commitment = norm(r.categories?.commitment);
  const fromCommitment = COMMITMENTS.find(([pattern]) => pattern.test(commitment))?.[1];
  const created = money(r.createdAt);
  return makeJob("Lever", r.id, {
    title, employer: employer.name, location: r.categories?.location ?? null, description, url: r.hostedUrl ?? r.applyUrl,
    posted: created ? new Date(created).toISOString() : null,
    salary: leverSalary(r, description),
    jobType: fromCommitment ?? detectJobType(title, description),
    remote: r.workplaceType === "remote" || /remote/i.test(r.categories?.location ?? ""),
    verifiedOpen: true,
  });
}

export const lever = employerSource("Lever employer boards", "lever", async (employer) => {
  const data = await getJson<Raw[]>(`https://api.lever.co/v0/postings/${employer.token}`, { params: { mode: "json" }, ttlMs: BOARD_TTL_MS });
  const us = data.filter((r) => (r.country ? r.country === "US" : isUsLocation(r.categories?.location)));
  return present(us.map((r) => parseLever(r, employer)));
});
