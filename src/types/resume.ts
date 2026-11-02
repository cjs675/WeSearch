import type { TransferableSkill } from "./compatibility";
import type { JobCategory } from "./job-category";
import type { Skill } from "./skill";

export interface WorkExperience {
  title: string;
  employer?: string;
  /** Leave undefined when the resume doesn't make this clear. Don't guess. */
  years?: number;
  description?: string;
}

export type EducationLevel = "high_school" | "associate" | "bachelor" | "master" | "doctorate" | "other";

export interface Education {
  level: EducationLevel;
  field?: string;
  institution?: string;
  inProgress: boolean;
}

/** What feature/resume-analysis produces and feature/job-matching consumes. */
export interface Resume {
  skills: Skill[];
  experience: WorkExperience[];
  education: Education[];
  certifications: string[];
  isStudent: boolean;
  projects?: string[];
  /** Terms from the resume that help find relevant jobs. */
  keywords?: string[];
}

/** What resume analysis returns: the resume plus what was worked out from it. */
export interface ResumeAnalysis {
  resume: Resume;
  transferableSkills: TransferableSkill[];
  suggestedCategories: JobCategory[];
}
