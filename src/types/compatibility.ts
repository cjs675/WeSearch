import type { JobListing, JobSourceStatus } from "./job-listing";

export interface ScoreComponent {
  name: string;
  points: number;
  maxPoints: number;
  explanation: string;
}

export interface TransferableSkill {
  have: string;
  countsToward: string;
  explanation: string;
}

export type QualificationStatus = "met" | "missing" | "in_progress" | "check_yourself";

/** A requirement stated in the posting. A missing one is flagged, and never removes the job from results. */
export interface Qualification {
  label: string;
  status: QualificationStatus;
  /** The posting's own words. */
  evidence: string;
}

export interface CompatibilityScore {
  /** 0 to 100. Always the sum of the components' points. */
  score: number;
  components: ScoreComponent[];
  matchedSkills: string[];
  transferableSkills: TransferableSkill[];
  missingSkills: string[];
  qualifications: Qualification[];
}

export interface JobMatch {
  job: JobListing;
  /** Null when no resume was provided. */
  compatibility: CompatibilityScore | null;
}

/** What feature/job-matching returns and feature/frontend displays. */
export interface JobSearchResponse {
  matches: JobMatch[];
  sources: JobSourceStatus[];
  /** Explains an empty result. Sample listings must never stand in for real ones. */
  message: string | null;
}
