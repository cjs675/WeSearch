import { aiAnalyze, aiConfigFromEnv, type AiConfig } from './ai'
import { buildKeywords, scoreCategories } from './careers'
import { findDates, mergedMonths, monthSpan } from './dates'
import { parseResume, resumeCorpus, type CorpusLine } from './parse'
import { detectCredentials, detectSkills, manualToSkills, mergeSkills, publicSkill } from './skills'
import {
  JOB_CATEGORIES,
  type AnalysisResult,
  type AnalyzeOptions,
  type ApplicantFlag,
  type ApplicantProfile,
  type EducationLevel,
  type ResumeData,
} from './types'

export type AnalyzeInput =
  | { kind: 'text'; text: string; source: 'pdf' | 'text'; pageCount?: number }
  | { kind: 'edited'; resume: ResumeData }

const LEVEL_RANK: EducationLevel[] = ['unknown', 'certificate', 'high_school', 'ged', 'college', 'associate', 'bachelor', 'master', 'doctorate']
const COLLEGE_LEVELS: EducationLevel[] = ['college', 'associate', 'bachelor', 'master', 'doctorate']

export function profileApplicant(resume: ResumeData, corpus: CorpusLine[], now: Date): ApplicantProfile {
  const jobs = resume.experience.filter((e) => e.kind !== 'volunteer')
  const hasWorkExperience = jobs.length > 0
  const spans = jobs.map((e) => monthSpan(findDates(e.dates ?? ''), now)).filter((s): s is [number, number] => Boolean(s))
  const months = mergedMonths(spans)
  const undated = jobs.length - spans.length
  const nowY = now.getFullYear()

  const text = corpus.map((c) => c.text).join('\n')
  const hsStudent =
    resume.education.some((e) => e.level === 'high_school' && e.inProgress) ||
    /\b(high school (student|junior|senior|sophomore|freshman)|(junior|senior|sophomore|freshman|rising senior|rising junior) at [\w .'-]*high school)\b/i.test(text)
  const collegeStudent = resume.education.some((e) => COLLEGE_LEVELS.includes(e.level) && e.inProgress)
  const recentGrad =
    !collegeStudent &&
    resume.education.some((e) => COLLEGE_LEVELS.includes(e.level) && !e.inProgress && e.endYear !== undefined && e.endYear >= nowY - 2 && e.endYear <= nowY)

  const flags: ApplicantFlag[] = []
  if (!hasWorkExperience) flags.push('no_work_experience')
  if (hsStudent) flags.push('high_school_student')
  if (collegeStudent) flags.push('college_student')
  if (recentGrad) flags.push('recent_graduate')
  if (hasWorkExperience && (months >= 12 || jobs.length >= 2)) flags.push('experienced')

  const stage: ApplicantFlag = hsStudent
    ? 'high_school_student'
    : collegeStudent
      ? 'college_student'
      : recentGrad
        ? 'recent_graduate'
        : hasWorkExperience
          ? 'experienced'
          : 'no_work_experience'

  const completed = resume.education.filter((e) => !e.inProgress && e.level !== 'unknown')
  const highest = completed.reduce<EducationLevel | undefined>(
    (best, e) => (!best || LEVEL_RANK.indexOf(e.level) > LEVEL_RANK.indexOf(best) ? e.level : best),
    undefined,
  )

  const notes: string[] = []
  if (!hasWorkExperience) {
    notes.push('No paid work experience is listed. Skills were taken from school, volunteer work, activities and projects instead.')
  }
  if (resume.experience.some((e) => e.kind === 'volunteer')) notes.push('Volunteer work counts toward skills but not toward years of experience.')
  if (undated > 0) notes.push(`${undated} job${undated > 1 ? 's have' : ' has'} no readable dates, so years of experience may be undercounted.`)

  return {
    stage,
    flags,
    hasWorkExperience,
    yearsOfExperience: Math.round((months / 12) * 10) / 10,
    highestCompletedEducation: highest ?? 'none_listed',
    notes,
  }
}

/** Accept user-edited resume JSON, keeping only known fields with sane sizes. */
export function normalizeResume(input: unknown): ResumeData {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  const strs = (v: unknown, maxItems = 100) =>
    Array.isArray(v) ? v.map((x) => str(x)).filter((x): x is string => Boolean(x)).slice(0, maxItems) : []
  const objs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').slice(0, 50) : []) as Record<string, unknown>[]
  const c = (o.contact && typeof o.contact === 'object' ? o.contact : {}) as Record<string, unknown>
  const levels: EducationLevel[] = ['high_school', 'ged', 'certificate', 'associate', 'bachelor', 'master', 'doctorate', 'college', 'unknown']

  return {
    contact: { name: str(c.name, 100), email: str(c.email, 200), phone: str(c.phone, 50), location: str(c.location, 100), links: strs(c.links, 10) },
    summary: strs(o.summary),
    education: objs(o.education).map((e) => ({
      institution: str(e.institution, 200) ?? '',
      degree: str(e.degree, 200),
      field: str(e.field, 200),
      level: levels.includes(e.level as EducationLevel) ? (e.level as EducationLevel) : 'unknown',
      dates: str(e.dates, 80),
      endYear: typeof e.endYear === 'number' && e.endYear > 1900 && e.endYear < 2100 ? e.endYear : undefined,
      inProgress: e.inProgress === true,
      gpa: str(e.gpa, 20),
      details: strs(e.details, 30),
    })),
    experience: objs(o.experience).map((e) => ({
      title: str(e.title, 200),
      organization: str(e.organization, 200),
      location: str(e.location, 100),
      dates: str(e.dates, 80),
      current: e.current === true,
      months: typeof e.months === 'number' ? e.months : undefined,
      kind: e.kind === 'volunteer' || e.kind === 'internship' ? e.kind : 'job',
      bullets: strs(e.bullets, 40),
    })),
    projects: objs(o.projects).map((p) => ({ name: str(p.name, 200) ?? '', dates: str(p.dates, 80), description: strs(p.description, 30) })),
    certifications: strs(o.certifications),
    listedSkills: strs(o.listedSkills, 200),
    awards: strs(o.awards),
    activities: strs(o.activities),
    languages: strs(o.languages, 30),
    coursework: strs(o.coursework),
    otherSections: objs(o.otherSections).map((s) => ({ heading: str(s.heading, 100) ?? 'Other', lines: strs(s.lines) })),
  }
}

export interface AnalyzeDeps {
  aiConfig?: AiConfig | null
  fetchImpl?: typeof fetch
}

export async function analyzeResume(input: AnalyzeInput, opts: AnalyzeOptions = {}, deps: AnalyzeDeps = {}): Promise<AnalysisResult> {
  const now = opts.now ?? new Date()
  const warnings: string[] = []

  let resume: ResumeData
  let textLength: number
  if (input.kind === 'text') {
    resume = parseResume(input.text, now)
    textLength = input.text.length
  } else {
    resume = normalizeResume(input.resume)
    // Recompute fields derived from dates, since the user may have edited them.
    resume.experience = resume.experience.map((e) => {
      const span = monthSpan(findDates(e.dates ?? ''), now)
      return { ...e, months: span ? span[1] - span[0] + 1 : undefined, current: e.current || /present|current/i.test(e.dates ?? '') }
    })
    textLength = JSON.stringify(resume).length
  }

  const corpus = resumeCorpus(resume)
  if (corpus.length < 3) warnings.push('Very little text was found in the resume, so results may be thin.')
  if (
    input.kind === 'text' &&
    !resume.education.length &&
    !resume.experience.length &&
    !resume.listedSkills.length &&
    corpus.length > 0
  ) {
    warnings.push("No standard section headings (Education, Experience, Skills …) were recognised. Skills were still searched across the whole text — check the extracted details and edit them if needed.")
  }

  const detected = detectSkills(corpus, resume)
  const credentials = detectCredentials(corpus)
  const applicant = profileApplicant(resume, corpus, now)

  // Optional AI pass.
  const aiCfg = deps.aiConfig === undefined ? aiConfigFromEnv() : deps.aiConfig ?? undefined
  let aiSkills: typeof detected = []
  let aiCategories: string[] = []
  let aiTitles: string[] = []
  let aiError: string | undefined
  let aiUsed = false
  if (aiCfg && opts.useAI !== false && corpus.length) {
    try {
      const s = await aiAnalyze(aiCfg, corpus, detected.map((d) => d.name), deps.fetchImpl)
      aiSkills = s.skills
      aiCategories = s.categories
      aiTitles = s.titles
      aiUsed = true
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err)
      warnings.push('AI analysis was unavailable, so the standard rule-based analysis was used.')
    }
  }

  const skills = mergeSkills([detected, aiSkills, manualToSkills(opts.manualSkills ?? [])], opts.removedSkills)
  const categories = scoreCategories(resume, skills, credentials, applicant)
  for (const c of aiCategories) {
    const cat = JOB_CATEGORIES.find((j) => j === c)
    if (cat && cat !== 'Other' && categories.length < 6 && !categories.some((x) => x.category === cat)) {
      categories.push({ category: cat, score: 15, reasons: ['Suggested by AI review of the resume'] })
    }
  }
  if (categories.length > 1) {
    const i = categories.findIndex((c) => c.category === 'Other')
    if (i >= 0) categories.splice(i, 1)
  }

  const keywords = buildKeywords(resume, skills, credentials, applicant, categories, aiTitles)
  if (!skills.length) warnings.push('No skills were found. You can add skills yourself and re-run the analysis.')

  const pub = skills.map(publicSkill)
  return {
    resume,
    skills: {
      hard: pub.filter((s) => s.type === 'hard'),
      soft: pub.filter((s) => s.type === 'soft'),
      transferable: pub.filter((s) => s.transferable),
    },
    credentials,
    applicant,
    suggestedCategories: categories,
    ...keywords,
    meta: {
      analysisMode: aiUsed ? 'ai+rules' : 'rules',
      aiProvider: aiCfg ? `${aiCfg.provider}:${aiCfg.model}` : undefined,
      aiError,
      source: input.kind === 'edited' ? 'edited' : input.source,
      pageCount: input.kind === 'text' ? input.pageCount : undefined,
      textLength,
      warnings,
      analyzedAt: now.toISOString(),
    },
  }
}
