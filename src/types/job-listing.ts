import type { JobCategory } from "./job-category";

export type JobType = "full_time" | "part_time" | "contract" | "temporary" | "internship";

export interface Salary {
  /** Yearly amounts in US dollars. Hourly pay assumes full-time hours, so show `text` when there is one. */
  min?: number;
  max?: number;
  /** Pay as the source states it, like "$18 an hour". */
  text?: string;
  /** True when the job board estimated the pay and the employer didn't state it. */
  estimated: boolean;
}

/** One real listing from a job API. Unknown values stay null rather than being filled in. */
export interface JobListing {
  id: string;
  /** Every job API this listing was found on, after duplicates are merged. */
  sources: string[];
  title: string;
  employer: string | null;
  location: string | null;
  remote: boolean;
  description: string;
  /** True when the API returned only part of the posting. */
  descriptionIsPartial: boolean;
  /** Link to apply, exactly as the API gave it. */
  applyUrl: string;
  /** ISO 8601 date, or null when the API gives none. */
  postedAt: string | null;
  salary: Salary | null;
  jobType: JobType | null;
  categories: JobCategory[];
}

export interface JobSearchRequest {
  keywords: string[];
  categories: JobCategory[];
  location?: string;
  distanceMiles?: number;
  remote?: "any" | "only" | "exclude";
  jobType?: JobType;
  minSalary?: number;
  /** With minSalary, also hide listings that don't state their pay. */
  salaryRequired?: boolean;
  minScore?: number;
  /** Hide older listings. Defaults to 90 days; null shows every age. */
  maxAgeDays?: number | null;
}

export type JobSourceState = "ok" | "not_configured" | "error";

/** Lets the page say a source failed or returned nothing instead of showing an empty list as if it were complete. */
export interface JobSourceStatus {
  name: string;
  state: JobSourceState;
  count: number;
  message: string;
  /** When set, the source's terms require the page to credit it and link here. */
  attributionUrl?: string;
}
