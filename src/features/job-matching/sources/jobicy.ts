import { norm } from "../text";
import { BOARD_TTL_MS, getJson } from "./http";
import { detectJobType, makeJob, money, present, type Raw } from "./job";
import type { JobSource, SourceJob } from "./types";

export function parseJobicy(r: Raw): SourceJob | null {
  const factor = ({ hourly: 2080, weekly: 52, monthly: 12 } as Record<string, number>)[r.salaryPeriod] ?? 1;
  const usd = r.salaryCurrency === "USD";
  const scale = (n: number | null) => (n === null || !usd ? undefined : n * factor);
  const min = scale(money(r.salaryMin));
  const max = scale(money(r.salaryMax));
  return makeJob("Jobicy", r.id, {
    title: r.jobTitle, employer: r.companyName, location: `Remote (${r.jobGeo})`, description: r.jobDescription ?? r.jobExcerpt,
    url: r.url, posted: r.pubDate, remote: true,
    salary: min || max ? { min, max, estimated: false } : null,
    jobType: detectJobType(norm((r.jobType ?? []).join(" "))),
    level: ["senior", "director", "manager"].includes(norm(r.jobLevel)) ? "senior" : null,
  });
}

export const jobicy: JobSource = {
  name: "Jobicy",
  attributionUrl: "https://jobicy.com",
  async fetch() {
    const data = await getJson<Raw>("https://jobicy.com/api/v2/remote-jobs", { params: { count: 100, geo: "usa" }, ttlMs: BOARD_TTL_MS });
    return { jobs: present((data.jobs ?? []).map(parseJobicy)) };
  },
};
