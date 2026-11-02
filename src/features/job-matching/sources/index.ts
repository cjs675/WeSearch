import type { JobCategory, JobSearchRequest, JobSourceStatus } from "@/types";
import { ashby } from "./ashby";
import { greenhouse } from "./greenhouse";
import { jobicy } from "./jobicy";
import { lever } from "./lever";
import { theMuse } from "./muse";
import { remoteOk } from "./remoteok";
import { type JobSource, type SourceJob, SourceUnavailable } from "./types";

/** Every job website in use. Remove one from this list and the rest keep working. */
export const SOURCES: JobSource[] = [greenhouse, lever, ashby, theMuse, jobicy, remoteOk];

/** Ask every source at once. Returns the listings and one status per source, including failures. */
export async function fetchAll(categories: JobCategory[], request: JobSearchRequest, sources: JobSource[] = SOURCES) {
  const results = await Promise.all(sources.map(async (source): Promise<[SourceJob[], JobSourceStatus]> => {
    const base = { name: source.name, attributionUrl: source.attributionUrl };
    try {
      const { jobs, note } = await source.fetch(categories, request);
      const message = jobs.length ? `${jobs.length} listings read.` : "Responded, but had no listings for this search.";
      return [jobs, { ...base, state: "ok", count: jobs.length, message: note ? `${message} ${note}` : message }];
    } catch (error) {
      const reason = error instanceof SourceUnavailable ? error.message : "something went wrong reading its response";
      return [[], { ...base, state: "error", count: 0, message: `Unavailable: ${reason}.` }];
    }
  }));
  return { jobs: results.flatMap(([jobs]) => jobs), statuses: results.map(([, status]) => status) };
}
