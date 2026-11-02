/**
 * POST /api/resume/analyze
 *
 * 1. multipart/form-data — upload a resume:
 *      file           PDF file (required unless `text` is sent), max 5 MB
 *      text           plain resume text, instead of a file
 *      manualSkills   optional, JSON array or comma-separated list of skills to add
 *      removedSkills  optional, JSON array or comma-separated list of skill names to drop
 *      useAI          optional, "false" to skip AI analysis
 *
 * 2. application/json — re-analyse after the user edits the extracted data:
 *      { "resume": ResumeData, "manualSkills"?: [...], "removedSkills"?: [...], "useAI"?: boolean }
 *    or analyse pasted text:
 *      { "text": "...", ... }
 *
 * Returns AnalysisResult (see features/resume-analysis/types.ts) plus `matchingResume`,
 * the shared Resume the job search reads. Errors: { error: { code, message } }.
 */
import { allowRequest } from '@/features/job-matching/rate-limit'
import { analyzeResume } from '@/features/resume-analysis/analyze'
import { extractPdfText, looksLikePdf, PdfError } from '@/features/resume-analysis/pdf'
import { toSharedResume } from '@/features/resume-analysis/to-shared-resume'
import type { AnalyzeOptions, AnalysisResult, ManualSkillInput } from '@/features/resume-analysis/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_TEXT = 100_000

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

function respond(result: AnalysisResult) {
  return Response.json({ ...result, matchingResume: toSharedResume(result) })
}

function parseList(v: unknown): (string | ManualSkillInput)[] {
  if (Array.isArray(v)) {
    return v
      .filter((x) => typeof x === 'string' || (x && typeof x === 'object' && typeof (x as ManualSkillInput).name === 'string'))
      .slice(0, 100) as (string | ManualSkillInput)[]
  }
  if (typeof v !== 'string' || !v.trim()) return []
  const s = v.trim()
  if (s.startsWith('[')) {
    try {
      return parseList(JSON.parse(s))
    } catch {
      return []
    }
  }
  return s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 100)
}

function options(src: { manualSkills?: unknown; removedSkills?: unknown; useAI?: unknown }): AnalyzeOptions {
  return {
    manualSkills: parseList(src.manualSkills),
    removedSkills: parseList(src.removedSkills).map((x) => (typeof x === 'string' ? x : x.name)),
    useAI: !(src.useAI === false || src.useAI === 'false' || src.useAI === '0'),
  }
}

export async function POST(req: Request) {
  if (!allowRequest(req)) return fail(429, 'too_many_requests', 'Too many requests. Wait a minute and try again.')
  const type = req.headers.get('content-type') ?? ''
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES + 512 * 1024) return fail(413, 'file_too_large', 'The resume must be 5 MB or smaller.')

  try {
    if (type.includes('multipart/form-data')) {
      let form: FormData
      try {
        form = await req.formData()
      } catch {
        return fail(400, 'bad_form', 'Could not read the upload. Send the PDF as multipart/form-data in a field named "file".')
      }
      const opts = options({
        manualSkills: form.get('manualSkills') ?? undefined,
        removedSkills: form.get('removedSkills') ?? undefined,
        useAI: form.get('useAI') ?? undefined,
      })
      const file = form.get('file') ?? form.get('resume')
      if (file && typeof file !== 'string') {
        if (file.size === 0) return fail(400, 'empty_file', 'The uploaded file is empty.')
        if (file.size > MAX_BYTES) return fail(413, 'file_too_large', 'The resume must be 5 MB or smaller.')
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (!looksLikePdf(bytes)) return fail(415, 'not_pdf', 'Please upload the resume as a PDF file.')
        const { text, pageCount } = await extractPdfText(bytes)
        return respond(await analyzeResume({ kind: 'text', text, source: 'pdf', pageCount }, opts))
      }
      const text = form.get('text')
      if (typeof text === 'string' && text.trim()) {
        if (text.length > MAX_TEXT) return fail(413, 'text_too_long', 'The resume text is too long.')
        return respond(await analyzeResume({ kind: 'text', text, source: 'text' }, opts))
      }
      return fail(400, 'missing_file', 'Attach a PDF resume in a field named "file".')
    }

    if (type.includes('application/json')) {
      let body: Record<string, unknown>
      try {
        body = (await req.json()) as Record<string, unknown>
      } catch {
        return fail(400, 'bad_json', 'The request body is not valid JSON.')
      }
      const opts = options(body)
      if (body.resume && typeof body.resume === 'object') {
        return respond(await analyzeResume({ kind: 'edited', resume: body.resume as never }, opts))
      }
      if (typeof body.text === 'string' && body.text.trim()) {
        if (body.text.length > MAX_TEXT) return fail(413, 'text_too_long', 'The resume text is too long.')
        return respond(await analyzeResume({ kind: 'text', text: body.text, source: 'text' }, opts))
      }
      return fail(400, 'missing_input', 'Send "resume" (edited data) or "text" (resume text).')
    }

    return fail(415, 'unsupported_type', 'Use multipart/form-data to upload a PDF, or application/json for edits.')
  } catch (err) {
    if (err instanceof PdfError) return fail(422, `pdf_${err.code}`, err.message)
    console.error('[resume/analyze] failed', err)
    return fail(500, 'analysis_failed', 'Something went wrong while analysing the resume.')
  }
}
