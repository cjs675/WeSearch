import { BOARD_TTL_MS, getJson } from "./http";
import { detectJobType, isUsLocation, makeJob, money, present, type Raw } from "./job";
import type { JobSource, SourceJob } from "./types";

/** The feed's first entry is its terms, not a job. They ask for credit and a followed link back. */
export function parseRemoteOk(r: Raw): SourceJob | null {
  if (!r.position) return null;
  const place = String(r.location ?? "");
  if (place && !isUsLocation(place) && !/worldwide|anywhere/i.test(place)) return null;
  const min = money(r.salary_min);
  const max = money(r.salary_max);
  return makeJob("Remote OK", r.id, {
    title: r.position, employer: r.company, location: place ? `Remote (${place})` : "Remote", description: r.description,
    url: r.url ?? r.apply_url, posted: r.date, remote: true,
    salary: min || max ? { min: min ?? undefined, max: max ?? undefined, estimated: false } : null,
    jobType: detectJobType(String(r.position)),
  });
}

export const remoteOk: JobSource = {
  name: "Remote OK",
  attributionUrl: "https://remoteok.com",
  async fetch() {
    const data = await getJson<Raw[]>("https://remoteok.com/api", { ttlMs: BOARD_TTL_MS });
    return { jobs: present(data.map(parseRemoteOk)) };
  },
};
