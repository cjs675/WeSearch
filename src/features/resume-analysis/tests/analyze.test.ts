import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeResume } from '@/features/resume-analysis/analyze'
import type { AnalysisResult } from '@/features/resume-analysis/types'

const NOW = new Date('2026-11-02T12:00:00Z')
const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8')
const run = (text: string, opts = {}) => analyzeResume({ kind: 'text', text, source: 'text' }, { now: NOW, ...opts }, { aiConfig: null })
const names = (r: AnalysisResult, k: 'hard' | 'soft' | 'transferable') => r.skills[k].map((s) => s.name)
const cats = (r: AnalysisResult) => r.suggestedCategories.map((c) => c.category)
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

const FIXTURES = ['example-cashier.txt', 'no-experience-hs.txt', 'college-cs.txt', 'recent-grad-nursing.txt', 'experienced-warehouse.txt']

describe('spec example: cashier, teamwork, food preparation, customer service', () => {
  it('suggests Fast Food, Retail, Restaurants and Customer Service', async () => {
    const r = await run(fixture('example-cashier.txt'))
    expect(cats(r)).toEqual(expect.arrayContaining(['Fast Food', 'Retail', 'Restaurants', 'Customer Service']))
    expect(cats(r)[0]).toBe('Fast Food')
  })

  it('generates the expected search keywords', async () => {
    const r = await run(fixture('example-cashier.txt'))
    for (const k of ['Crew Member', 'Cashier', 'Team Member', 'Food Service Worker', 'Sales Associate', 'Customer Service Representative']) {
      expect(r.searchKeywords).toContain(k)
    }
    // Already held, so not an "alternative" title.
    expect(r.alternativeJobTitles).not.toContain('Cashier')
  })

  it('extracts the job, the school and the skills', async () => {
    const r = await run(fixture('example-cashier.txt'))
    expect(r.resume.contact).toMatchObject({ name: 'Jordan Smith', email: 'jordan.smith@email.com', phone: '(239) 555-0142', location: 'Fort Myers, FL' })
    expect(r.resume.experience).toHaveLength(1)
    expect(r.resume.experience[0]).toMatchObject({ title: 'Cashier', organization: 'Taco Bell', current: true, kind: 'job' })
    expect(r.resume.experience[0].bullets).toHaveLength(3)
    expect(r.resume.education[0]).toMatchObject({ institution: 'Riverdale High School', level: 'high_school', inProgress: true })
    expect(names(r, 'transferable')).toEqual(expect.arrayContaining(['Customer service', 'Cash handling', 'Teamwork']))
    expect(names(r, 'hard')).toContain('Food preparation')
  })
})

describe('never invents qualifications', () => {
  it.each(FIXTURES)('%s: every skill from the resume quotes a line that is in the resume', async (f) => {
    const text = squash(fixture(f))
    const r = await run(fixture(f))
    const all = [...r.skills.hard, ...r.skills.soft]
    expect(all.length).toBeGreaterThan(0)
    for (const s of all) {
      expect(s.source).toBe('resume')
      expect(s.evidence.length).toBeGreaterThan(0)
      for (const e of s.evidence) expect(text).toContain(squash(e.text))
    }
    for (const c of r.credentials) for (const e of c.evidence) expect(text).toContain(squash(e.text))
  })

  it.each(FIXTURES)('%s: every extracted field is copied from the resume', async (f) => {
    const text = squash(fixture(f))
    const r = await run(fixture(f))
    const fields = [
      ...r.resume.experience.flatMap((e) => [e.title, e.organization, e.location, e.dates, ...e.bullets]),
      ...r.resume.education.flatMap((e) => [e.institution, e.degree, e.field, e.dates, ...e.details]),
      ...r.resume.certifications,
      ...r.resume.listedSkills,
    ].filter((x): x is string => Boolean(x))
    for (const v of fields) expect(text).toContain(squash(v))
  })

  it('does not suggest licensed titles without the license', async () => {
    const r = await run(fixture('recent-grad-nursing.txt'))
    const all = [...r.searchKeywords, ...r.alternativeJobTitles].join(' | ')
    expect(all).not.toMatch(/Certified Nursing Assistant|Medical Assistant|Pharmacy Technician|Phlebotomist|\bEMT\b|Nurse/)
    expect(r.credentials.map((c) => c.id)).toEqual(['cpr'])
  })

  it('suggests the licensed title once the resume shows the license', async () => {
    const text = fixture('recent-grad-nursing.txt').replace('CPR / BLS (American Heart Association)', 'CPR / BLS (American Heart Association)\nCertified Nursing Assistant (CNA), Florida, 2025')
    const r = await run(text)
    expect(r.credentials.map((c) => c.id)).toContain('cna')
    expect(r.searchKeywords).toContain('Certified Nursing Assistant (CNA)')
  })

  it('does not read skills out of employer or school names', async () => {
    const r = await run(fixture('no-experience-hs.txt')) // "Ida Baker High School"
    expect(names(r, 'hard')).not.toContain('Baking')
  })

  it('does not treat a "Spanish Club" membership as being bilingual', async () => {
    const text = fixture('no-experience-hs.txt').replace(/LANGUAGES\n.*\n/, '')
    const r = await run(text)
    expect(names(r, 'transferable')).not.toContain('Bilingual')
  })

  it('only offers driving jobs to someone with a license', async () => {
    const r = await run(fixture('experienced-warehouse.txt'))
    expect(r.alternativeJobTitles).toContain('Forklift Operator')
    const noLicense = await run(fixture('experienced-warehouse.txt').replace("Valid Florida driver's license\n", ''))
    expect(noLicense.searchKeywords).not.toContain('Delivery Driver')
  })
})

describe('applicants with little or no experience', () => {
  it('high school student with no work history', async () => {
    const r = await run(fixture('no-experience-hs.txt'))
    expect(r.applicant.stage).toBe('high_school_student')
    expect(r.applicant.flags).toEqual(expect.arrayContaining(['no_work_experience', 'high_school_student']))
    expect(r.applicant.hasWorkExperience).toBe(false)
    expect(r.applicant.yearsOfExperience).toBe(0)
    // Skills still found from volunteering and activities.
    expect(names(r, 'transferable')).toEqual(expect.arrayContaining(['Customer service', 'Teamwork', 'Leadership', 'Bilingual']))
    const leadership = r.skills.soft.find((s) => s.name === 'Leadership')!
    expect(leadership.evidence[0].text).toMatch(/team captain/)
    // Entry-level friendly categories and filters.
    expect(cats(r)).toEqual(expect.arrayContaining(['Fast Food', 'Retail']))
    expect(r.searchFilters).toEqual(expect.arrayContaining(['Part time', 'No experience required']))
    expect(r.resume.experience[0].kind).toBe('volunteer')
  })

  it('college student with an internship', async () => {
    const r = await run(fixture('college-cs.txt'))
    expect(r.applicant.stage).toBe('college_student')
    expect(cats(r)[0]).toBe('Technology')
    expect(cats(r)).toContain('Internships')
    expect(r.resume.education[0]).toMatchObject({ level: 'bachelor', field: 'Computer Science', inProgress: true, gpa: '3.5/4.0' })
    expect(r.resume.experience[0].kind).toBe('internship')
    expect(r.resume.languages).toEqual([]) // "Languages: Python, …" is a skills sub-label
    expect(names(r, 'hard')).toEqual(expect.arrayContaining(['Python', 'Java', 'JavaScript', 'SQL / databases', 'Git / version control']))
    expect(names(r, 'transferable')).not.toContain('Bilingual')
    expect(r.searchKeywords).toContain('Computer Science Intern')
    expect(r.resume.contact.links).toEqual(['linkedin.com/in/alexchen', 'github.com/alexchen'])
  })

  it('recent graduate', async () => {
    const r = await run(fixture('recent-grad-nursing.txt'))
    expect(r.applicant.stage).toBe('recent_graduate')
    expect(r.applicant.highestCompletedEducation).toBe('bachelor')
    // Volunteer months don't count, the 3 yr 5 mo serving job does.
    expect(r.applicant.yearsOfExperience).toBe(3.4)
    expect(cats(r)[0]).toBe('Healthcare')
    expect(cats(r)).toContain('Internships')
  })

  it('experienced worker: years of experience merges overlapping jobs', async () => {
    const r = await run(fixture('experienced-warehouse.txt'))
    expect(r.applicant.stage).toBe('experienced')
    expect(r.applicant.yearsOfExperience).toBe(5.8) // Mar 2021 → Nov 2026
    expect(cats(r)[0]).toBe('Warehouse')
  })
})

describe('user edits and manual skills', () => {
  it('adds manual skills and removes skills the user rejects', async () => {
    const r = await run(fixture('example-cashier.txt'), {
      manualSkills: ['Forklift', { name: 'Latte art', type: 'hard' }, 'Patience'],
      removedSkills: ['Teamwork'],
    })
    const all = [...r.skills.hard, ...r.skills.soft]
    expect(all.find((s) => s.name === 'Forklift operation')).toMatchObject({ source: 'user', evidence: [] })
    expect(all.find((s) => s.name === 'Latte art')).toMatchObject({ source: 'user', type: 'hard' })
    expect(all.map((s) => s.name)).not.toContain('Teamwork')
    expect(cats(r)).toContain('Warehouse') // the added skill counts toward categories
  })

  it('re-analyses edited data: removing the only job changes the profile', async () => {
    const first = await run(fixture('example-cashier.txt'))
    const edited = structuredClone(first.resume)
    edited.experience = []
    edited.listedSkills = ['Customer service']
    const r = await analyzeResume({ kind: 'edited', resume: edited }, { now: NOW }, { aiConfig: null })
    expect(r.meta.source).toBe('edited')
    expect(r.applicant.hasWorkExperience).toBe(false)
    expect(names(r, 'hard')).not.toContain('Cash handling')
    expect(names(r, 'transferable')).toContain('Customer service')
  })

  it('ignores unknown or oversized fields in edited data', async () => {
    const r = await analyzeResume(
      { kind: 'edited', resume: { contact: { name: 'x'.repeat(5000) }, experience: [{ title: 'Cashier', bullets: 'not-an-array', evil: true }], hacked: 1 } as never },
      { now: NOW },
      { aiConfig: null },
    )
    expect(r.resume.contact.name).toHaveLength(100)
    expect(r.resume.experience[0]).toMatchObject({ title: 'Cashier', bullets: [], kind: 'job' })
    expect((r.resume as unknown as Record<string, unknown>).hacked).toBeUndefined()
  })
})

describe('messy input', () => {
  it('handles a resume with no headings', async () => {
    const r = await run('Sam Rivera\nsam@email.com\nI babysat my neighbors kids every weekend and helped at my church bake sale handling cash.')
    expect(r.resume.contact.name).toBe('Sam Rivera')
    expect(names(r, 'hard')).toEqual(expect.arrayContaining(['Childcare', 'Cash handling']))
    expect(r.meta.warnings.join(' ')).toMatch(/No standard section headings/)
  })

  it('handles empty-ish text without crashing', async () => {
    const r = await run('   \n\n  ')
    expect(cats(r)).toEqual(expect.arrayContaining(['Fast Food', 'Retail']))
    expect(r.skills.hard).toEqual([])
    expect(r.meta.warnings.length).toBeGreaterThan(0)
  })

  it('spaced-out headings and Word bullet characters', async () => {
    const r = await run('Lee Park\n\nE X P E R I E N C E\nStock Associate, Target   May 2025 - Present\n Restocked shelves and helped shoppers\n\nS K I L L S\nInventory, Teamwork')
    expect(r.resume.experience[0]).toMatchObject({ title: 'Stock Associate', organization: 'Target' })
    expect(r.resume.experience[0].bullets).toEqual(['Restocked shelves and helped shoppers'])
    expect(cats(r)[0]).toBe('Retail')
  })
})
