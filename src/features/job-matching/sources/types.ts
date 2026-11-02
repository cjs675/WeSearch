import type { JobCategory, JobListing, JobSearchRequest } from "@/types";

/** A listing plus details only the matching pipeline uses. */
export interface SourceJob extends JobListing {
  level: "entry" | "internship" | "senior" | null;
  /** Categories known from the employer or the job board itself. */
  labels: JobCategory[];
  /** It's on the employer's live job board right now, so its age doesn't suggest it has closed. */
  verifiedOpen: boolean;
}

export interface SourceResult {
  jobs: SourceJob[];
  /** Shown to the user, such as when only part of a source could be read. */
  note?: string;
}

/** One job website. To add one, write an adapter and list it in sources/index.ts. */
export interface JobSource {
  name: string;
  /** Page the app must credit and link to under the source's terms. */
  attributionUrl?: string;
  fetch(categories: JobCategory[], request: JobSearchRequest): Promise<SourceResult>;
}

export class SourceUnavailable extends Error {}
