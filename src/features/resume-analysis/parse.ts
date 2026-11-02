/**
 * Rule-based resume parser: text in, `ResumeData` out.
 *
 * It only copies what the resume says. Lines it can't place go into
 * `otherSections` or an entry's details, so no content is silently dropped
 * (except a "References" section, which holds other people's contact details).
 */
import { findDates, monthSpan, stripDates, type DateInfo } from './dates'
import type {
  ContactInfo,
  EducationEntry,
  EducationLevel,
  ExperienceEntry,
  ExperienceKind,
  ProjectEntry,
  ResumeData,
} from './types'

type SectionKey =
  | 'summary'
  | 'education'
  | 'experience'
  | 'volunteer'
  | 'skills'
  | 'certifications'
  | 'projects'
  | 'awards'
  | 'activities'
  | 'languages'
  | 'coursework'
  | 'references'
  | 'other'

const HEADINGS: Record<string, SectionKey> = {}
function heads(key: SectionKey, names: string[]) {
  for (const n of names) HEADINGS[n] = key
}
heads('summary', ['summary', 'professional summary', 'career summary', 'objective', 'career objective', 'professional objective', 'profile', 'professional profile', 'personal profile', 'about me', 'about', 'personal statement', 'introduction'])
heads('education', ['education', 'education and training', 'academic background', 'academics', 'educational background', 'academic history', 'schooling', 'education history'])
heads('experience', ['experience', 'work experience', 'employment', 'employment history', 'professional experience', 'work history', 'relevant experience', 'job experience', 'career history', 'related experience', 'internship experience', 'internships', 'internship', 'work', 'professional history', 'experience and employment', 'other experience', 'additional experience', 'paid experience'])
heads('volunteer', ['volunteer experience', 'volunteering', 'volunteer work', 'community service', 'community involvement', 'volunteer', 'volunteer and community service', 'service', 'community service and volunteering'])
heads('skills', ['skills', 'technical skills', 'key skills', 'core skills', 'core competencies', 'competencies', 'skills and abilities', 'abilities', 'areas of expertise', 'expertise', 'qualifications', 'skills summary', 'summary of skills', 'computer skills', 'relevant skills', 'strengths', 'soft skills', 'hard skills', 'skill set', 'skillset', 'professional skills', 'skills and interests', 'skills and qualifications', 'technologies', 'tools', 'technical proficiencies', 'additional skills', 'key qualifications', 'summary of qualifications', 'highlights of qualifications'])
heads('certifications', ['certifications', 'certificates', 'certification', 'licenses', 'license', 'licenses and certifications', 'certifications and licenses', 'credentials', 'training', 'training and certifications', 'certifications and training', 'professional development'])
heads('projects', ['projects', 'academic projects', 'personal projects', 'relevant projects', 'key projects', 'project experience', 'selected projects', 'class projects', 'school projects', 'portfolio'])
heads('awards', ['awards', 'honors', 'honors and awards', 'awards and honors', 'achievements', 'accomplishments', 'awards and achievements', 'recognition', 'honours', 'awards and recognition'])
heads('activities', ['activities', 'extracurricular activities', 'extracurriculars', 'extra curricular activities', 'leadership', 'leadership experience', 'clubs', 'involvement', 'organizations', 'clubs and organizations', 'athletics', 'sports', 'leadership and activities', 'activities and leadership', 'campus involvement', 'school activities', 'memberships', 'affiliations', 'professional affiliations'])
heads('languages', ['languages', 'language skills', 'language'])
heads('coursework', ['relevant coursework', 'coursework', 'courses', 'relevant courses', 'related coursework'])
heads('references', ['references', 'reference'])
heads('other', ['interests', 'hobbies', 'hobbies and interests', 'interests and hobbies', 'additional information', 'other', 'publications', 'portfolio links'])

const BULLET_RE = /^\s*(?:[•●▪◦■□►▸‣⁃∙·*➢✓✔→–—-]|o(?=\s)|\d{1,2}[.)](?=\s))\s*/
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
const URL_RE = /\b(?:https?:\/\/[^\s|,]+|(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\/[^\s|,]+)/gi
const STATES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR'
const STATE_NAMES =
  'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Puerto Rico'
const LOCATION_RE = new RegExp(
  `\\b([A-Z][A-Za-z.'’]+(?:[ -][A-Z][A-Za-z.'’]+){0,3}),\\s*(${STATES}|${STATE_NAMES})\\b(?:\\s*\\d{5})?|\\bRemote\\b`,
)

/** Words that signal a job title. Used to tell "Cashier" apart from "McDonald's" in an entry header. */
const TITLE_WORDS =
  /\b(?:cashier|associate|crew|member|server|waiter|waitress|cook|chef|dishwasher|host|hostess|busser|barista|bartender|runner|intern|internship|assistant|manager|supervisor|lead|leader|representative|rep|agent|technician|tech|developer|engineer|programmer|clerk|aide|tutor|volunteer|specialist|coordinator|driver|courier|attendant|officer|guard|analyst|operator|helper|counselor|counsellor|teacher|instructor|coach|nanny|babysitter|sitter|lifeguard|housekeeper|janitor|custodian|cleaner|laborer|labourer|handler|picker|packer|stocker|loader|mover|receptionist|secretary|administrator|admin|consultant|designer|writer|editor|photographer|mentor|ambassador|president|vice president|treasurer|secretary|captain|founder|owner|freelancer|contractor|apprentice|mechanic|electrician|plumber|carpenter|welder|landscaper|groundskeeper|caregiver|caretaker|nurse|cna|medical assistant|phlebotomist|pharmacy|scribe|dispatcher|bagger|greeter|merchandiser|stylist|trainer|worker|staff|team member|crew member|employee|researcher|scientist|accountant|bookkeeper|teller|banker|sales|salesperson|organizer|planner|director|chair|delegate|tester|support)\b/i

const HUMAN_LANGUAGE_RE =
  /^(?:english|spanish|french|portuguese|haitian creole|creole|mandarin|chinese|cantonese|vietnamese|arabic|tagalog|filipino|korean|german|italian|russian|japanese|hindi|urdu|bengali|punjabi|polish|ukrainian|greek|turkish|farsi|persian|hebrew|swahili|american sign language|asl|sign language)\b/i

const SCHOOL_WORDS = /\b(?:high school|school|university|college|academy|institute|polytechnic|community college|vocational|technical college|conservatory|seminary|hs)\b/i
const DEGREE_RE =
  /\b(?:high school diploma|diploma|g\.?e\.?d\.?|associate(?:'s|s)?(?: degree)?(?: of (?:arts|science|applied science))?|a\.a\.s?\.?|a\.s\.|a\.a\.|bachelor(?:'s|s)?(?: degree)?(?: of (?:arts|science|fine arts|business administration))?|b\.s\.?|b\.a\.?|bsc|bba|bsn|bfa|master(?:'s|s)?(?: degree)?(?: of (?:arts|science|business administration))?|m\.s\.?|m\.a\.?|mba|msc|ph\.?\s?d\.?|doctorate|doctor of [a-z]+|certificate|certification program)\b/i

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/||||/g, '•') // Symbol-font bullets from Word exports
}

/** "E D U C A T I O N" → "EDUCATION". */
function unspace(s: string): string {
  return /^(?:[A-Za-z&] ){3,}[A-Za-z&]$/.test(s) ? s.replace(/ /g, '') : s
}

function headingKey(line: string): { key: SectionKey; rest: string } | undefined {
  const t = unspace(line.trim())
  if (!t || t.length > 60) return undefined
  // Heading on its own line, optionally with a trailing colon.
  const clean = t
    .replace(/[:\-–—_=|•]+$/, '')
    .replace(/^[#\-–—_=|•\s]+/, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
  if (HEADINGS[clean]) return { key: HEADINGS[clean], rest: '' }
  // "Skills: Excel, Word" — heading with content on the same line (list-style sections only).
  const m = t.match(/^([A-Za-z &]{3,40}):\s*(.+)$/)
  if (m) {
    const k = HEADINGS[m[1].toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim()]
    if (k && ['skills', 'certifications', 'languages', 'coursework', 'awards', 'activities'].includes(k))
      return { key: k, rest: m[2] }
  }
  return undefined
}

const isBullet = (l: string) => BULLET_RE.test(l)
const unbullet = (l: string) => l.replace(BULLET_RE, '').trim()
const words = (l: string) => l.trim().split(/\s+/).filter(Boolean).length

/** Split a list-style line ("Excel, Word • Canva | Spanish") into items. */
export function splitList(line: string): string[] {
  let l = unbullet(line)
  // Drop a short category label: "Technical: Excel, Word" → "Excel, Word"
  l = l.replace(/^[A-Za-z][A-Za-z /&-]{1,30}:\s+(?=\S)/, '')
  // Split on commas/semicolons/bullets/pipes/tabs, but not inside parentheses.
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of l) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && /[,;•|·\t●▪]/.test(ch)) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim().replace(/\.$/, '').trim()).filter((s) => s.length > 0 && s.length <= 80)
}

interface Section {
  key: SectionKey
  heading: string
  lines: string[]
}

function splitSections(lines: string[]): { header: string[]; sections: Section[] } {
  const header: string[] = []
  const sections: Section[] = []
  let cur: Section | undefined
  for (const line of lines) {
    let h = !isBullet(line) ? headingKey(line) : undefined
    // "Languages: Python, Java" inside a Skills section is a sub-label, not a new section.
    if (h && h.rest && cur?.key === 'skills') h = undefined
    if (h) {
      cur = { key: h.key, heading: unspace(line.trim()).replace(/:.*$/, '').trim(), lines: [] }
      sections.push(cur)
      if (h.rest) cur.lines.push(h.rest)
      continue
    }
    if (cur) cur.lines.push(line)
    else header.push(line)
  }
  return { header, sections }
}

function parseContact(header: string[]): { contact: ContactInfo; leftover: string[] } {
  const contact: ContactInfo = { links: [] }
  const leftover: string[] = []
  for (const rawLine of header) {
    if (!rawLine.trim()) continue
    let line = rawLine
    const links = line.match(URL_RE)
    if (links) {
      for (const l of links) if (!contact.links.includes(l)) contact.links.push(l.replace(/[.)]+$/, ''))
      line = line.replace(URL_RE, ' ')
    }
    const email = line.match(EMAIL_RE)
    if (email) {
      contact.email ??= email[0]
      line = line.replace(EMAIL_RE, ' ')
    }
    const phone = line.match(PHONE_RE)
    if (phone) {
      contact.phone ??= phone[0].trim()
      line = line.replace(PHONE_RE, ' ')
    }
    const loc = line.match(LOCATION_RE)
    if (loc && !contact.location && words(line) <= 8) {
      contact.location = loc[0].trim()
      line = line.replace(loc[0], ' ')
    }
    // Whatever is left, split on separators.
    const parts = line
      .split(/\s*(?:\||•|·|\t|\s{2,}|\s[–—-]\s)\s*/)
      .map((p) => p.trim().replace(/^[,:;–—-]+|[,:;–—-]+$/g, '').trim())
      .filter(Boolean)
    for (const p of parts) {
      if (!contact.name && /^[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){1,3}$/.test(p) && p.length <= 40 && !TITLE_WORDS.test(p) && !SCHOOL_WORDS.test(p)) {
        contact.name = p
      } else if (p.length > 1) leftover.push(p)
    }
  }
  return { contact, leftover }
}

/** Merge wrapped lines: a line starting lowercase continues the previous one. */
function mergeWrapped(lines: string[]): string[] {
  const out: string[] = []
  for (const raw of lines) {
    if (!raw.trim()) continue
    const l = raw.trim()
    if (out.length && !isBullet(l) && /^[a-z(&]/.test(l) && !/[.!?:]$/.test(out[out.length - 1])) {
      out[out.length - 1] += ' ' + l
    } else out.push(l)
  }
  return out
}

interface Group {
  header: string[]
  body: string[]
  dates?: DateInfo
}

/**
 * Group a section's lines into entries (one job, one school, one project).
 * Header lines are non-bullet lines before the bullets; body lines are bullets
 * and sentence-like descriptions.
 */
function groupEntries(lines: string[], isEntryStart?: (line: string, g: Group) => boolean): Group[] {
  const groups: Group[] = []
  let cur: Group | undefined
  let afterBlank = false

  const start = (line: string) => {
    cur = { header: [line.trim()], body: [] }
    const d = findDates(line)
    if (d) cur.dates = d
    groups.push(cur)
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) {
      afterBlank = true
      continue
    }
    if (isBullet(line)) {
      if (!cur) start('')
      cur!.body.push(unbullet(line))
      afterBlank = false
      continue
    }
    const d = findDates(line)
    const short = words(line) <= 10 && !/[.!?]$/.test(line)
    const continuation = /^[a-z(&]/.test(line)

    if (!cur) {
      start(line)
    } else if (continuation && (cur.body.length || cur.header.length)) {
      if (cur.body.length) cur.body[cur.body.length - 1] += ' ' + line
      else cur.header[cur.header.length - 1] += ' ' + line
    } else if (isEntryStart?.(line, cur)) {
      start(line)
    } else if (cur.body.length === 0 && cur.header.length < 3 && (short || d) && !(d && cur.dates) && !afterBlank) {
      cur.header.push(line)
      if (d && !cur.dates) cur.dates = d
    } else if (d && (cur.dates || cur.body.length)) {
      start(line)
    } else if (short && (cur.body.length > 0 || afterBlank)) {
      // A short line after bullets is usually the next entry's header — unless the next line is also prose.
      start(line)
    } else {
      cur.body.push(line)
    }
    afterBlank = false
  }
  return groups.filter((g) => g.header.join('').trim() || g.body.length)
}

function splitHeader(text: string): string[] {
  return text
    .split(/\s*(?:\t|\||•|·|\s[–—-]\s|\s{2,}|,\s+(?=[A-Z])|\s+at\s+|\s+@\s+)\s*/)
    .map((s) => s.trim().replace(/^[,;:()–—-]+|[,;:()–—-]+$/g, '').trim())
    .filter((s) => s.length > 1)
}

function parseExperience(lines: string[], kindDefault: ExperienceKind, now: Date): ExperienceEntry[] {
  return groupEntries(lines).map((g) => {
    let headerText = g.header.filter(Boolean).join('\t')
    if (g.dates) headerText = stripDates(headerText, findDates(headerText) ?? g.dates)
    const locMatch = headerText.match(LOCATION_RE)
    let location: string | undefined
    if (locMatch) {
      location = locMatch[0].trim()
      headerText = headerText.replace(locMatch[0], '\t')
    }
    const parts = splitHeader(headerText)
    let title: string | undefined
    let organization: string | undefined
    const titleIdx = parts.findIndex((p) => TITLE_WORDS.test(p))
    if (titleIdx >= 0) {
      title = parts[titleIdx]
      organization = parts.find((_, i) => i !== titleIdx)
    } else if (parts.length) {
      ;[title, organization] = parts
    }
    const extra = parts.filter((p) => p !== title && p !== organization)
    const span = monthSpan(g.dates, now)
    const text = `${title ?? ''} ${organization ?? ''}`
    let kind: ExperienceKind = kindDefault
    if (/\bvolunteer/i.test(text)) kind = 'volunteer'
    else if (/\bintern(ship)?\b/i.test(text)) kind = 'internship'
    return {
      title,
      organization,
      location,
      dates: g.dates?.text,
      current: Boolean(g.dates?.current),
      months: span ? span[1] - span[0] + 1 : undefined,
      kind,
      bullets: [...extra, ...g.body],
    }
  })
}

function educationLevel(text: string): EducationLevel {
  const t = text.toLowerCase()
  if (/ph\.?\s?d|doctorate|doctor of/.test(t)) return 'doctorate'
  if (/\bmaster|\bm\.s\b|\bm\.a\b|\bmba\b|\bmsc\b/.test(t)) return 'master'
  if (/bachelor|\bb\.s\b|\bb\.a\b|\bbsc\b|\bbba\b|\bbsn\b|\bbfa\b/.test(t)) return 'bachelor'
  if (/associate|\ba\.a\.?s?\b|\ba\.s\b/.test(t)) return 'associate'
  if (/\bg\.?e\.?d\b/.test(t)) return 'ged'
  if (/high school|secondary school|\bhs\b|high school diploma/.test(t)) return 'high_school'
  if (/certificate|certification program|vocational|technical (?:college|school|center)/.test(t)) return 'certificate'
  if (/university|college/.test(t)) return 'college'
  return 'unknown'
}

function parseEducation(lines: string[], now: Date): EducationEntry[] {
  const isStart = (line: string, g: Group) =>
    SCHOOL_WORDS.test(line) && g.header.some((h) => SCHOOL_WORDS.test(h)) && !DEGREE_RE.test(line)
  return groupEntries(lines, isStart).map((g) => {
    const all = [...g.header, ...g.body]
    const allText = all.join(' \n ')
    let institution = ''
    let degree: string | undefined
    let field: string | undefined
    let gpa: string | undefined
    const details: string[] = []

    const gpaM = allText.match(/\bGPA\s*:?\s*(\d(?:\.\d{1,2})?(?:\s*\/\s*\d(?:\.\d)?)?)|(\d\.\d{1,2})\s*GPA/i)
    if (gpaM) gpa = (gpaM[1] ?? gpaM[2]).replace(/\s/g, '')

    for (const raw of all) {
      let line = raw
      const d = findDates(line)
      if (d) line = stripDates(line, d)
      const loc = line.match(LOCATION_RE)
      if (loc) line = line.replace(loc[0], '\t')
      for (const part of splitHeader(line)) {
        const clean = part.replace(/\bGPA\s*:?\s*[\d./\s]+/i, '').replace(/[\d.]+\s*GPA/i, '').trim()
        if (!clean) continue
        if (!institution && SCHOOL_WORDS.test(clean) && !DEGREE_RE.test(clean)) institution = clean
        else if (!degree && DEGREE_RE.test(clean)) {
          degree = clean
          // "B.S. in Computer Science", "Bachelor of Science in Biology", "Associate of Arts"
          const f = clean.match(/\bin\s+([A-Z][A-Za-z &/,-]+)$/) ?? clean.match(/\bof\s+([A-Z][A-Za-z &/,-]+)$/)
          if (f && !/^(arts|science|applied science|fine arts|business administration)$/i.test(f[1].trim())) field = f[1].trim()
        } else if (!field && /^(?:major|concentration|field of study|program|focus)\s*:/i.test(clean)) {
          field = clean.replace(/^[^:]+:\s*/, '')
        } else details.push(clean)
      }
    }
    if (!institution && details.length && !degree) institution = details.shift()!
    if (!institution && details.length) institution = details.shift()!

    const level = educationLevel(`${degree ?? ''} ${institution}`)
    const endYear = g.dates?.end?.year ?? (g.dates?.current ? undefined : g.dates?.start?.year)
    const endMonth = g.dates?.end?.month || 6
    const nowY = now.getFullYear()
    const nowM = now.getMonth() + 1
    const inProgress =
      Boolean(g.dates?.current) ||
      /\b(expected|anticipated|in progress|currently (?:enrolled|attending|pursuing)|pursuing|candidate|present|rising (?:junior|senior|sophomore))\b/i.test(allText) ||
      (endYear !== undefined && (endYear > nowY || (endYear === nowY && endMonth > nowM)))
    return {
      institution,
      degree,
      field,
      level,
      dates: g.dates?.text,
      endYear,
      inProgress,
      gpa,
      details: details.filter((d) => d !== institution),
    }
  })
}

function parseProjects(lines: string[]): ProjectEntry[] {
  return groupEntries(lines).map((g) => {
    let name = g.header.filter(Boolean).join(' – ')
    if (g.dates) name = stripDates(name, findDates(name) ?? g.dates)
    name = name.replace(/\t/g, ' – ').replace(/\s{2,}/g, ' ').trim()
    const description = [...g.body]
    if (!name && description.length) name = description.shift()!
    return { name, dates: g.dates?.text, description }
  })
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  return items.filter((i) => {
    const k = i.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function parseResume(rawText: string, now = new Date()): ResumeData {
  const lines = normalizeText(rawText).split('\n').map((l) => l.replace(/\s+$/, ''))
  const { header, sections } = splitSections(lines)
  const { contact, leftover } = parseContact(header)

  const resume: ResumeData = {
    contact,
    summary: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    listedSkills: [],
    awards: [],
    activities: [],
    languages: [],
    coursework: [],
    otherSections: [],
  }
  if (leftover.length) resume.summary.push(...leftover)

  for (const s of sections) {
    const nonEmpty = s.lines.filter((l) => l.trim())
    switch (s.key) {
      case 'summary':
        resume.summary.push(...mergeWrapped(nonEmpty).map(unbullet))
        break
      case 'education':
        resume.education.push(...parseEducation(s.lines, now))
        break
      case 'experience':
        resume.experience.push(...parseExperience(s.lines, 'job', now))
        break
      case 'volunteer':
        resume.experience.push(...parseExperience(s.lines, 'volunteer', now).map((e) => ({ ...e, kind: 'volunteer' as const })))
        break
      case 'projects':
        resume.projects.push(...parseProjects(s.lines))
        break
      case 'skills':
        for (const l of nonEmpty) {
          // "Languages: English, Spanish" → spoken languages; "Languages: Python, Java" → skills.
          if (/^\s*(?:spoken |foreign )?languages?\s*:/i.test(unbullet(l))) {
            for (const item of splitList(l)) (HUMAN_LANGUAGE_RE.test(item) ? resume.languages : resume.listedSkills).push(item)
          } else resume.listedSkills.push(...splitList(l))
        }
        break
      case 'languages':
        resume.languages.push(...nonEmpty.flatMap(splitList))
        break
      case 'coursework':
        resume.coursework.push(...nonEmpty.flatMap(splitList))
        break
      case 'certifications':
        for (const l of mergeWrapped(nonEmpty)) {
          const parts = splitList(l)
          // Split "CPR, First Aid, Food Handler" but keep "ServSafe Food Handler, 2024" together.
          if (parts.length > 1 && parts.every((p) => words(p) <= 6 && !/^\d{4}$/.test(p) && !findDates(p))) resume.certifications.push(...parts)
          else resume.certifications.push(unbullet(l))
        }
        break
      case 'awards':
        resume.awards.push(...mergeWrapped(nonEmpty).map(unbullet))
        break
      case 'activities':
        resume.activities.push(...mergeWrapped(nonEmpty).map(unbullet))
        break
      case 'references':
        break
      default:
        resume.otherSections.push({ heading: s.heading, lines: mergeWrapped(nonEmpty).map(unbullet) })
    }
  }

  resume.listedSkills = dedupe(resume.listedSkills)
  resume.languages = dedupe(resume.languages)
  resume.coursework = dedupe(resume.coursework)
  resume.certifications = dedupe(resume.certifications.filter(Boolean))
  return resume
}

/**
 * Flatten structured resume data back into labelled lines. Skill detection
 * runs on these, so edits the user makes are what gets analysed.
 */
export interface CorpusLine {
  text: string
  where: string
  /** Employer or school name. Used for category signals, never as skill evidence ("Ida Baker High School" is not baking). */
  isName?: boolean
  section: 'summary' | 'education' | 'experience' | 'volunteer' | 'projects' | 'skills' | 'certifications' | 'awards' | 'activities' | 'languages' | 'coursework' | 'other'
}

export function resumeCorpus(r: ResumeData): CorpusLine[] {
  const out: CorpusLine[] = []
  const push = (section: CorpusLine['section'], where: string, text: string | undefined, isName = false) => {
    if (text && text.trim()) out.push({ section, where, text: text.trim(), ...(isName ? { isName } : {}) })
  }
  r.summary.forEach((t) => push('summary', 'Summary', t))
  for (const e of r.experience) {
    const label = [e.title, e.organization].filter(Boolean).join(', ') || 'Entry'
    const section = e.kind === 'volunteer' ? 'volunteer' : 'experience'
    const where = `${e.kind === 'volunteer' ? 'Volunteer' : e.kind === 'internship' ? 'Internship' : 'Experience'} · ${label}`
    push(section, where, e.title)
    push(section, where, e.organization, true)
    e.bullets.forEach((b) => push(section, where, b))
  }
  for (const ed of r.education) {
    const where = `Education · ${ed.institution || ed.degree || 'School'}`
    push('education', where, ed.institution, true)
    push('education', where, ed.degree)
    push('education', where, ed.field)
    ed.details.forEach((d) => push('education', where, d))
  }
  for (const p of r.projects) {
    const where = `Project · ${p.name}`
    push('projects', where, p.name)
    p.description.forEach((d) => push('projects', where, d))
  }
  r.listedSkills.forEach((s) => push('skills', 'Skills', s))
  r.certifications.forEach((c) => push('certifications', 'Certifications', c))
  r.awards.forEach((a) => push('awards', 'Awards', a))
  r.activities.forEach((a) => push('activities', 'Activities', a))
  r.languages.forEach((l) => push('languages', 'Languages', l))
  r.coursework.forEach((c) => push('coursework', 'Coursework', c))
  for (const o of r.otherSections) o.lines.forEach((l) => push('other', o.heading, l))
  return out
}
