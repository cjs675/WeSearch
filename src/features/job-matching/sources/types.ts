import type { JobCategory, JobListing, JobSearchRequest } from "@/types";

/** A listing plus details only the matching pipeline uses. */
export interface SourceJob extends JobListing {
  level: "entry" | "internship" | "senior" | null;
  /** Categories the job board itself assigned. */
  labels: JobCategory[];
  /** The API already applied the location and distance, so don't filter on text again. */
  locationCheckedByApi: boolean;
}

export interface JobSource {
  name: string;
  /** Env vars to set, or null if no key is needed. */
  needsKey: string | null;
  /** Page the app must credit and link to under the source's terms. */
  attributionUrl?: string;
  configured(): boolean;
  fetch(queries: string[], categories: JobCategory[], request: JobSearchRequest): Promise<SourceJob[]>;
}

export class SourceUnavailable extends Error {}
