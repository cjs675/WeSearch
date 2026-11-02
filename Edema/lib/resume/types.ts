/**
 * Shared types for resume analysis.
 *
 * Design rule: everything in `ResumeData` comes from the resume text or from
 * the user's own edits. Nothing is ever generated to fill a gap — a missing
 * field stays empty.
 */

export const JOB_CATEGORIES = [
  'Fast Food',
  'Retail',
  'Restaurants',
  'Warehouse',
  'Customer Service',
  'Internships',
  'Office',
  'Healthcare',
  'Security',
  'Skilled Trades',
  'Technology',
  'Government',
  'Education',
  'Hospitality',
  'Delivery',
  'Other',
] as const

export type JobCategory = (typeof JOB_CATEGORIES)[number]

export type SkillType = 'hard' | 'soft'

/** Where a skill came from. `ai` skills are only kept when their evidence is found in the resume. */
export type SkillSource = 'resume' | 'user' | 'ai'

export interface ContactInfo {
  name?: string
  email?: string
  phone?: string
  location?: string
  links: string[]
}

export type EducationLevel =
  | 'high_school'
  | 'ged'
  | 'certificate'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'doctorate'
  | 'college'
  | 'unknown'

export interface EducationEntry {
  institution: string
  degree?: string
  field?: string
  level: EducationLevel
  dates?: string
  /** Year the program ended or is expected to end, if stated. */
  endYear?: number
  /** True when the resume says "expected", "present", "current", "anticipated", or the end year is in the future. */
  inProgress: boolean
  gpa?: string
  details: string[]
}

export type ExperienceKind = 'job' | 'internship' | 'volunteer'

export interface ExperienceEntry {
  title?: string
  organization?: string
  location?: string
  dates?: string
  current: boolean
  /** Months covered by the stated dates. Undefined when dates are missing or unreadable. */
  months?: number
  kind: ExperienceKind
  bullets: string[]
}

export interface ProjectEntry {
  name: string
  dates?: string
  description: string[]
}

export interface OtherSection {
  heading: string
  lines: string[]
}

export interface ResumeData {
  contact: ContactInfo
  summary: string[]
  education: EducationEntry[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  certifications: string[]
  /** Skills exactly as written in the resume's skills section. */
  listedSkills: string[]
  awards: string[]
  activities: string[]
  languages: string[]
  coursework: string[]
  /** Sections the parser didn't recognise, kept verbatim so nothing is lost. */
  otherSections: OtherSection[]
}

export interface SkillEvidence {
  /** The resume line that supports the skill. */
  text: string
  /** Where that line sits, e.g. "Experience · Cashier, McDonald's". */
  where: string
}

export interface Skill {
  name: string
  type: SkillType
  /** True for skills that carry across jobs and industries (teamwork, cash handling, …). */
  transferable: boolean
  source: SkillSource
  /** Up to three resume lines that support the skill. Empty for skills the user added. */
  evidence: SkillEvidence[]
}

export type ApplicantFlag =
  | 'no_work_experience'
  | 'high_school_student'
  | 'college_student'
  | 'recent_graduate'
  | 'experienced'

export interface ApplicantProfile {
  /** The single label that best describes the applicant. */
  stage: ApplicantFlag
  /** Every label that applies (e.g. a college student with no work experience). */
  flags: ApplicantFlag[]
  hasWorkExperience: boolean
  /** Total paid work + internships, from stated dates, overlaps merged. Volunteer work excluded. */
  yearsOfExperience: number
  /** Highest level the resume shows as finished. In-progress programs don't count. */
  highestCompletedEducation: EducationLevel | 'none_listed'
  notes: string[]
}

export interface CategorySuggestion {
  category: JobCategory
  /** 0–100, relative strength of the match. */
  score: number
  /** Plain-language reasons, e.g. "Skill: Cash handling". */
  reasons: string[]
  /** True when suggested because the applicant is entry-level, not because of resume evidence. */
  entryLevelSuggestion?: boolean
}

export interface AnalysisResult {
  resume: ResumeData
  skills: {
    hard: Skill[]
    soft: Skill[]
    transferable: Skill[]
  }
  /** Certifications and licenses recognised in the resume, with the line that mentions them. */
  credentials: { id: string; name: string; evidence: SkillEvidence[] }[]
  applicant: ApplicantProfile
  suggestedCategories: CategorySuggestion[]
  /** Ready-to-use job search terms: best-fit titles first, then skill keywords. */
  searchKeywords: string[]
  /** Job titles worth searching that the applicant hasn't already held. */
  alternativeJobTitles: string[]
  /** Optional search filters that fit the applicant (e.g. "Part time" for students). */
  searchFilters: string[]
  meta: {
    analysisMode: 'rules' | 'ai+rules'
    aiProvider?: string
    aiError?: string
    source: 'pdf' | 'text' | 'edited'
    pageCount?: number
    textLength: number
    warnings: string[]
    analyzedAt: string
  }
}

export interface ManualSkillInput {
  name: string
  type?: SkillType
  transferable?: boolean
}

export interface AnalyzeOptions {
  /** Skills the user typed in. Always kept, marked `source: 'user'`. */
  manualSkills?: (string | ManualSkillInput)[]
  /** Skill names the user removed. Excluded from the result even if detected. */
  removedSkills?: string[]
  /** Use AI analysis when configured. Defaults to true. */
  useAI?: boolean
  /** Override "now" (for tests). */
  now?: Date
}
