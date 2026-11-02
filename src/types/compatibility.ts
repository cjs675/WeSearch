import type { JobCategory } from "./job-category";
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
  /** The posting says this can be obtained after hiring, so it doesn't lower the score. */
  canGetAfterHire: boolean;
}

export interface CompatibilityScore {
  /** Estimated qualification fit from 0 to 100, not a chance of being hired. Always the sum of the components' points. */
  score: number;
  components: ScoreComponent[];
  matchedSkills: string[];
  transferableSkills: TransferableSkill[];
  missingSkills: string[];
  /** Skills scored because they're usual for the role, not because the posting states them. Label these on screen. */
  skillsTypicalForRole: string[];
  qualifications: Qualification[];
  /** Past roles and projects from the resume that relate to this job. */
  relevantExperience: string[];
}

export interface JobMatch {
  job: JobListing;
  /** Null when no resume was provided. */
  compatibility: CompatibilityScore | null;
  entryLevel: boolean;
  matchedKeywords: string[];
}

/** What feature/job-matching returns and feature/frontend displays. */
export interface JobSearchResponse {
  matches: JobMatch[];
  /** All matches found, which can be more than the number returned. */
  total: number;
  sources: JobSourceStatus[];
  searchTerms: string[];
  relatedTitles: string[];
  /** Categories the resume points to, whether or not they were searched. */
  suggestedCategories: JobCategory[];
  notes: string[];
  /** Explains an empty result. Sample listings must never stand in for real ones. */
  message: string | null;
}
