import type { JobCategory } from "./job-category";

export type JobType = "full_time" | "part_time" | "contract" | "temporary" | "internship";

export interface Salary {
  /** Yearly amounts in US dollars. */
  min?: number;
  max?: number;
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
  minScore?: number;
}

export type JobSourceState = "ok" | "not_configured" | "error";

/** Lets the page say a source failed or returned nothing instead of showing an empty list as if it were complete. */
export interface JobSourceStatus {
  name: string;
  state: JobSourceState;
  count: number;
  message: string;
}
