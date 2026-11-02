import type { JobCategory, JobType } from "@/types";
import data from "./taxonomy-data.json";

export interface CategoryDefinition {
  titles: string[];
  queries: string[];
  titlesToTry: string[];
  exclude?: string[];
  employers?: string[];
  /** Titles that only count when the posting also mentions one of the context words. */
  contextTitles?: { titles: string[]; context: string[] };
}

export const CATEGORIES = data.categories as Record<JobCategory, CategoryDefinition>;
export const CATEGORY_NAMES = Object.keys(CATEGORIES) as JobCategory[];
/** The job board's own label, where the board labels reliably. */
export const ADZUNA_LABELS = data.adzunaLabels as Record<string, JobCategory>;
export const MUSE_CATEGORIES = data.museCategories as Partial<Record<JobCategory, string[]>>;
/** A resume in this category is also suggested these. */
export const TRANSFERABLE_CATEGORIES = data.transferableCategories as Record<JobCategory, JobCategory[]>;
export const STUDENT_CATEGORIES = data.studentCategories as JobCategory[];
/** Canonical skill name to the ways a resume or posting says it. */
export const SKILLS: Record<string, string[]> = data.skills;
/** What a skill on the resume also counts toward, and why. */
export const TRANSFERABLE_SKILLS: Record<string, Record<string, string>> = data.transferableSkills;
/** Skills usual for a role. APIs often return a snippet, so these fill the gap at lower weight, always labelled. */
export const TYPICAL_SKILLS = data.typicalSkills as Record<JobCategory, string[]>;
export const RELATED_KEYWORDS: Record<string, string[]> = data.relatedKeywords;
export const KEYWORD_CATEGORY_ALIASES = data.keywordCategoryAliases as Record<string, JobCategory>;
export const JOB_TYPE_KEYWORDS = data.jobTypeKeywords as Record<string, JobType>;
export const ENTRY_LEVEL_TERMS: string[] = data.entryLevelTerms;
export const SENIOR_TITLE_TERMS: string[] = data.seniorTitleTerms;
/** Titles at big employers that are corporate roles, not store or restaurant jobs. */
export const CORPORATE_TITLE_TERMS: string[] = data.corporateTitleTerms;
