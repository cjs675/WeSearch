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
}
