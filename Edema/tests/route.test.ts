import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/resume/analyze/route'
import { extractPdfText } from '@/lib/resume/pdf'

const fx = (n: string) => readFileSync(path.join(import.meta.dirname, 'fixtures', n))
const URL_ = 'http://localhost/api/resume/analyze'

function upload(bytes: Buffer, name = 'resume.pdf', extra: Record<string, string> = {}) {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }))
  for (const [k, v] of Object.entries(extra)) form.append(k, v)
  return POST(new Request(URL_, { method: 'POST', body: form }))
}

describe('PDF text extraction', () => {
  it('keeps right-aligned dates on the same line as the job title', async () => {
    const { text, pageCount } = await extractPdfText(new Uint8Array(fx('cashier-two-column.pdf')))
    expect(pageCount).toBe(1)
    expect(text).toMatch(/Cashier\s+June 2024 – Present/)
    expect(text).toContain('• Took customer orders')
  })
})

describe('POST /api/resume/analyze', () => {
  it('analyses an uploaded PDF', async () => {
    const res = await upload(fx('cashier-two-column.pdf'), 'resume.pdf', { useAI: 'false' })
    expect(res.status).toBe(200)
    const r = await res.json()
    expect(r.meta).toMatchObject({ source: 'pdf', pageCount: 1, analysisMode: 'rules' })
    expect(r.resume.contact.name).toBe('Jordan Smith')
    expect(r.resume.experience[0]).toMatchObject({ title: 'Cashier', organization: 'Taco Bell', dates: 'June 2024 – Present' })
    expect(r.resume.education[0]).toMatchObject({ institution: 'Riverdale High School', inProgress: true })
    expect(r.suggestedCategories.map((c: { category: string }) => c.category)).toEqual(
      expect.arrayContaining(['Fast Food', 'Retail', 'Restaurants', 'Customer Service']),
    )
    expect(r.searchKeywords).toEqual(expect.arrayContaining(['Crew Member', 'Cashier', 'Team Member', 'Food Service Worker', 'Sales Associate', 'Customer Service Representative']))
  })

  it('analyses a PDF from a student with no work experience', async () => {
    const res = await upload(fx('student-no-experience.pdf'), 'resume.pdf', { useAI: 'false' })
    const r = await res.json()
    expect(res.status).toBe(200)
    expect(r.applicant.flags).toEqual(expect.arrayContaining(['no_work_experience', 'high_school_student']))
    expect(r.resume.education[0]).toMatchObject({ institution: 'Ida Baker High School', gpa: '3.7' })
    expect(r.skills.transferable.map((s: { name: string }) => s.name)).toEqual(expect.arrayContaining(['Customer service', 'Leadership', 'Bilingual']))
  })

  it('accepts manual skills with the upload', async () => {
    const res = await upload(fx('cashier-two-column.pdf'), 'resume.pdf', { manualSkills: '["Spanish", "Microsoft Excel"]', useAI: 'false' })
    const r = await res.json()
    const user = [...r.skills.hard, ...r.skills.soft].filter((s: { source: string }) => s.source === 'user').map((s: { name: string }) => s.name)
    expect(user).toEqual(expect.arrayContaining(['Spanish', 'Microsoft Excel']))
  })

  it('re-analyses edited JSON', async () => {
    const first = await (await upload(fx('cashier-two-column.pdf'), 'resume.pdf', { useAI: 'false' })).json()
    const edited = { ...first.resume, listedSkills: [...first.resume.listedSkills, 'Forklift'] }
    const res = await POST(
      new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resume: edited, useAI: false }) }),
    )
    const r = await res.json()
    expect(res.status).toBe(200)
    expect(r.meta.source).toBe('edited')
    expect(r.skills.hard.map((s: { name: string }) => s.name)).toContain('Forklift operation')
  })

  it('accepts pasted text as JSON', async () => {
    const res = await POST(
      new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'SKILLS\nCustomer service, Cash handling', useAI: false }) }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).meta.source).toBe('text')
  })

  it('rejects a file that is not a PDF', async () => {
    const res = await upload(fx('not-a-pdf.pdf'))
    expect(res.status).toBe(415)
    expect((await res.json()).error.code).toBe('not_pdf')
  })

  it('rejects files over 5 MB', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10)])
    const res = await upload(big)
    expect(res.status).toBe(413)
  })

  it('rejects a damaged PDF with a clear message', async () => {
    const res = await upload(Buffer.from('%PDF-1.4\nthis is garbage, not a real pdf body'))
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toMatch(/^pdf_/)
  })

  it('asks for a file when none is sent', async () => {
    const res = await POST(new Request(URL_, { method: 'POST', body: new FormData() }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('missing_file')
  })

  it('rejects bad JSON and unsupported content types', async () => {
    const bad = await POST(new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' }))
    expect(bad.status).toBe(400)
    const xml = await POST(new Request(URL_, { method: 'POST', headers: { 'content-type': 'text/xml' }, body: '<a/>' }))
    expect(xml.status).toBe(415)
  })
})
