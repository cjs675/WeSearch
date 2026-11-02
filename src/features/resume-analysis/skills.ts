import { CREDENTIALS, SKILLS, type SkillDef } from './skills-dictionary'
import type { CorpusLine } from './parse'
import type { ManualSkillInput, ResumeData, Skill, SkillEvidence, SkillType } from './types'

/** Compile a phrase so it matches whole words only. Works for terms like "C++" and "C#". */
export function compileTerm(term: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])(?:${term})(?![A-Za-z0-9+#])`, 'i')
}

const compiled = new Map<SkillDef, { terms: RegExp[]; infer: RegExp[] }>()
for (const def of SKILLS) {
  compiled.set(def, { terms: def.terms.map(compileTerm), infer: (def.infer ?? []).map(compileTerm) })
}
const compiledCreds = CREDENTIALS.map((c) => ({ def: c, terms: c.terms.map(compileTerm) }))

/** Experience lines make the best evidence; a bare skills-list line is the weakest. */
const SECTION_RANK: Record<CorpusLine['section'], number> = {
  experience: 0,
  volunteer: 1,
  projects: 2,
  activities: 3,
  certifications: 4,
  education: 5,
  coursework: 6,
  awards: 7,
  summary: 8,
  languages: 9,
  skills: 10,
  other: 11,
}

export interface DetectedSkill extends Skill {
  /** True when the resume names the skill outright (not inferred from an activity). */
  direct: boolean
  /** True when supported by a line from work, volunteer, project or activity history. */
  practiced: boolean
  def?: SkillDef
}

export interface DetectedCredential {
  id: string
  name: string
  evidence: SkillEvidence[]
}

function evidenceFor(lines: CorpusLine[], patterns: RegExp[]): CorpusLine[] {
  return lines.filter((l) => !l.isName && patterns.some((p) => p.test(l.text)))
}

function toEvidence(lines: CorpusLine[]): SkillEvidence[] {
  const seen = new Set<string>()
  const out: SkillEvidence[] = []
  for (const l of [...lines].sort((a, b) => SECTION_RANK[a.section] - SECTION_RANK[b.section])) {
    const key = l.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text: l.text.length > 220 ? l.text.slice(0, 217) + '…' : l.text, where: l.where })
    if (out.length === 3) break
  }
  return out
}

const PRACTICED = new Set<CorpusLine['section']>(['experience', 'volunteer', 'projects', 'activities'])

/** Detect skills that the resume actually supports. */
export function detectSkills(corpus: CorpusLine[], resume: ResumeData): DetectedSkill[] {
  const found: DetectedSkill[] = []

  for (const def of SKILLS) {
    const c = compiled.get(def)!
    let hits = evidenceFor(corpus, c.terms)
    let direct = hits.length > 0
    if (!direct && def.transferable && c.infer.length) {
      hits = evidenceFor(corpus, c.infer)
    }
    if (!hits.length) continue
    found.push({
      name: def.name,
      type: def.type,
      transferable: Boolean(def.transferable),
      source: 'resume',
      evidence: toEvidence(hits),
      direct,
      practiced: hits.some((h) => PRACTICED.has(h.section)),
      def,
    })
  }

  // Languages listed in a Languages section (other than English) show the applicant is bilingual.
  const otherLangs = resume.languages.filter((l) => !/^english\b/i.test(l.trim()))
  if (otherLangs.length && !found.some((s) => s.name === 'Bilingual')) {
    const def = SKILLS.find((d) => d.name === 'Bilingual')!
    found.push({
      name: 'Bilingual',
      type: 'hard',
      transferable: true,
      source: 'resume',
      evidence: otherLangs.slice(0, 3).map((l) => ({ text: l, where: 'Languages' })),
      direct: true,
      practiced: false,
      def,
    })
  }

  // Skills written in the resume's skills section that the dictionary doesn't know — keep them as written.
  for (const listed of resume.listedSkills) {
    const covered = found.some((s) => {
      const c = s.def && compiled.get(s.def)
      return s.name.toLowerCase() === listed.toLowerCase() || (c && c.terms.some((t) => t.test(listed)))
    })
    if (covered || found.some((s) => s.name.toLowerCase() === listed.toLowerCase())) continue
    if (words(listed) > 6) continue // long sentences in a skills section are descriptions, not skill names
    found.push({
      name: tidy(listed),
      type: guessType(listed),
      transferable: false,
      source: 'resume',
      evidence: [{ text: listed, where: 'Skills' }],
      direct: true,
      practiced: false,
    })
  }
  return found
}

export function detectCredentials(corpus: CorpusLine[]): DetectedCredential[] {
  const out: DetectedCredential[] = []
  for (const { def, terms } of compiledCreds) {
    const hits = evidenceFor(corpus, terms)
    if (hits.length) out.push({ id: def.id, name: def.name, evidence: toEvidence(hits) })
  }
  return out
}

const SOFT_HINT = /\b(?:skills?|ability|able to|attitude|ethic|minded|oriented|player|motivat|friendly|patient|reliable|honest|punctual|respectful|listening|empath|leadership|communication|teamwork)\b/i

function guessType(s: string): SkillType {
  return SOFT_HINT.test(s) ? 'soft' : 'hard'
}

const words = (s: string) => s.trim().split(/\s+/).length

function tidy(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > 1 && t === t.toLowerCase() ? t[0].toUpperCase() + t.slice(1) : t
}

/** Turn user-typed skills into `Skill`s, using the dictionary to classify known ones. */
export function manualToSkills(inputs: (string | ManualSkillInput)[]): DetectedSkill[] {
  const out: DetectedSkill[] = []
  for (const input of inputs) {
    const m = typeof input === 'string' ? { name: input } : input
    const name = (m.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!name) continue
    // Map to a known skill only on a whole-phrase match ("Forklift" → Forklift operation, but "Latte art" stays as typed).
    const def = SKILLS.find(
      (d) => d.name.toLowerCase() === name.toLowerCase() || d.terms.some((t) => new RegExp(`^(?:${t})$`, 'i').test(name)),
    )
    out.push({
      name: def?.name ?? tidy(name),
      type: m.type ?? def?.type ?? guessType(name),
      transferable: m.transferable ?? Boolean(def?.transferable),
      source: 'user',
      evidence: [],
      direct: true,
      practiced: false,
      def,
    })
  }
  return out
}

/** Merge lists by skill name. Resume evidence wins over a manual duplicate; removed names are dropped. */
export function mergeSkills(lists: DetectedSkill[][], removed: string[] = []): DetectedSkill[] {
  const gone = new Set(removed.map((r) => r.trim().toLowerCase()))
  const byName = new Map<string, DetectedSkill>()
  for (const list of lists) {
    for (const s of list) {
      const key = s.name.toLowerCase()
      if (gone.has(key)) continue
      const prev = byName.get(key)
      if (!prev) byName.set(key, s)
      else if (prev.source !== 'resume' && s.source === 'resume') byName.set(key, s)
      else if (prev.source === s.source) prev.evidence = toEvidence([...prev.evidence, ...s.evidence].map((e) => ({ text: e.text, where: e.where, section: 'other' as const })))
    }
  }
  return [...byName.values()]
}

/** Public shape (drops internal fields). */
export function publicSkill(s: DetectedSkill): Skill {
  return { name: s.name, type: s.type, transferable: s.transferable, source: s.source, evidence: s.evidence }
}
