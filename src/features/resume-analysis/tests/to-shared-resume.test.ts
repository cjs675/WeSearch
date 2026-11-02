import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildProfile, suggestedCategories } from '@/features/job-matching/profile'
import { analyzeResume } from '@/features/resume-analysis/analyze'
import { toSharedResume } from '@/features/resume-analysis/to-shared-resume'

const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8')
const shared = async (name: string) =>
  toSharedResume(await analyzeResume({ kind: 'text', text: fixture(name), source: 'text' }, { useAI: false }))

describe('analyzer to job matching', () => {
  it('gives a fast-food worker related job categories', async () => {
    const resume = await shared('example-cashier.txt')
    expect(resume.experience.length).toBeGreaterThan(0)
    expect(new Set(resume.skills.map((s) => s.name)).size).toBe(resume.skills.length)
    const categories = suggestedCategories(buildProfile(resume))
    expect(categories).toEqual(expect.arrayContaining(['Retail', 'Customer Service']))
  })
  it('treats a student with no work history as entry-level', async () => {
    const resume = await shared('no-experience-hs.txt')
    expect(resume.experience).toEqual([])
    expect(resume.isStudent).toBe(true)
    expect(suggestedCategories(buildProfile(resume))).toEqual(expect.arrayContaining(['Internships', 'Entry-Level']))
  })
  it('only lists categories the app knows', async () => {
    const resume = await shared('recent-grad-nursing.txt')
    expect(resume.suggestedCategories).not.toContain('Other')
    expect(resume.suggestedCategories).toContain('Healthcare')
  })
})
