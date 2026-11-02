import { JOB_CATEGORIES, type Education, type EducationLevel as SharedLevel, type JobCategory, type Resume, type Skill as SharedSkill, type WorkExperience } from '@/types'
import type { AnalysisResult, EducationLevel } from './types'

const LEVELS: Partial<Record<EducationLevel, SharedLevel>> = {
  high_school: 'high_school',
  ged: 'high_school',
  associate: 'associate',
  bachelor: 'bachelor',
  master: 'master',
  doctorate: 'doctorate',
}

/** The analyzer's detailed result, reduced to the shared `Resume` that job matching reads. */
export function toSharedResume(result: AnalysisResult): Resume {
  const seen = new Set<string>()
  const skills: SharedSkill[] = []
  for (const skill of [...result.skills.hard, ...result.skills.soft, ...result.skills.transferable]) {
    const key = skill.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    skills.push({ name: skill.name, source: skill.source === 'user' ? 'manual' : 'extracted', evidence: skill.evidence[0]?.text })
  }
  const experience: WorkExperience[] = result.resume.experience
    .filter((job) => job.kind !== 'volunteer' && (job.title || job.organization))
    .map((job) => ({
      title: job.title ?? job.organization ?? '',
      employer: job.title ? job.organization : undefined,
      years: job.months === undefined ? undefined : Math.round((job.months / 12) * 10) / 10,
      description: job.bullets.join(' ') || undefined,
    }))
  const education: Education[] = result.resume.education.map((entry) => ({
    level: LEVELS[entry.level] ?? 'other',
    field: entry.field,
    institution: entry.institution || undefined,
    inProgress: entry.inProgress,
  }))
  const shared: readonly string[] = JOB_CATEGORIES
  return {
    skills,
    experience,
    education,
    certifications: [...new Set([...result.credentials.map((c) => c.name), ...result.resume.certifications])],
    isStudent: result.applicant.flags.includes('high_school_student') || result.applicant.flags.includes('college_student'),
    projects: result.resume.projects.map((p) => [p.name, ...p.description].join(' ')),
    keywords: result.searchKeywords,
    suggestedCategories: result.suggestedCategories.map((c): string => c.category).filter((c): c is JobCategory => shared.includes(c)),
  }
}
