import type { JobCategory, JobSearchRequest } from "@/types";
import { norm } from "../text";
import data from "./employers.json";
import { type JobSource, type SourceJob, SourceUnavailable } from "./types";

export type Platform = "greenhouse" | "lever" | "ashby";

export interface Employer {
  name: string;
  platform: Platform;
  token: string;
  /** Which searches read this board. Its listings must still fit the category by title or employer. */
  categories: JobCategory[];
}

export const EMPLOYERS = data as Employer[];
const READ_BUDGET_MS = 25_000;

/** Which boards to read: a named company, else those in the chosen categories, else all of them for a general keyword. */
export function selectEmployers(employers: Employer[], categories: JobCategory[], request: JobSearchRequest): Employer[] {
  const keywords = request.keywords.map(norm);
  const named = employers.filter((e) => keywords.some((k) => k === norm(e.name) || k === norm(e.token)));
  if (named.length) return named;
  if (categories.length) return employers.filter((e) => e.categories.some((c) => categories.includes(c)));
  return keywords.length ? employers : [];
}

/** A source made of many employer boards. Boards that fail or run out of time are reported, not fatal. */
export function employerSource(name: string, platform: Platform, readBoard: (employer: Employer) => Promise<SourceJob[]>): JobSource {
  const boards = EMPLOYERS.filter((e) => e.platform === platform);
  return {
    name,
    async fetch(categories, request) {
      const selected = selectEmployers(boards, categories, request);
      const jobs: SourceJob[] = [];
      let answered = 0;
      const work = Promise.allSettled(selected.map(async (employer) => {
        jobs.push(...(await readBoard(employer)));
        answered += 1;
      }));
      let timer: ReturnType<typeof setTimeout> | undefined;
      // Slower boards keep filling the cache after this, so the next search has them
      await Promise.race([work, new Promise((resolve) => { timer = setTimeout(resolve, READ_BUDGET_MS); })]);
      clearTimeout(timer);
      if (selected.length && !answered) throw new SourceUnavailable("none of its employer boards answered");
      const note = answered < selected.length ? `${answered} of ${selected.length} employer boards answered in time.` : undefined;
      return { jobs: [...jobs], note };
    },
  };
}
