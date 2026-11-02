/**
 * Optional AI analysis.
 *
 * Talks to any OpenAI-compatible chat endpoint — a local Ollama/Gemma model by
 * default, matching the team's Gemma notes. It is never required: when it is
 * not configured, times out, or returns junk, the rule-based result stands.
 *
 * The model may only *add* skills, categories and titles. Every skill it
 * returns must quote a resume line as evidence; if that line isn't in the
 * resume, the skill is dropped. Contact details are never sent.
 */
import { CREDENTIAL_TITLE_RE } from './careers'
import type { CorpusLine } from './parse'
import type { DetectedSkill } from './skills'
import { JOB_CATEGORIES, type JobCategory, type SkillType } from './types'

export interface AiConfig {
  provider: string
  baseUrl: string
  model: string
  apiKey?: string
  timeoutMs: number
}

export function aiConfigFromEnv(env: Record<string, string | undefined> = process.env): AiConfig | undefined {
  const provider = (env.RESUME_AI_PROVIDER ?? '').trim().toLowerCase()
  if (!provider || provider === 'none' || provider === 'off') return undefined
  const timeoutMs = Number(env.RESUME_AI_TIMEOUT_MS) || 20000
  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      baseUrl: (env.RESUME_AI_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, ''),
      model: env.RESUME_AI_MODEL || 'gemma3:4b',
      timeoutMs,
    }
  }
  if (!env.RESUME_AI_BASE_URL || !env.RESUME_AI_MODEL) return undefined
  return {
    provider,
    baseUrl: env.RESUME_AI_BASE_URL.replace(/\/$/, ''),
    model: env.RESUME_AI_MODEL,
    apiKey: env.RESUME_AI_API_KEY,
    timeoutMs,
  }
}

export interface AiSuggestions {
  skills: DetectedSkill[]
  categories: JobCategory[]
  titles: string[]
}

const SYSTEM_PROMPT = `You review resumes for job seekers, including students and people with no work experience.
Rules:
- Only report skills the resume text clearly supports. For each skill, copy one resume line word for word as "evidence".
- Never add degrees, certifications, licenses, employers, dates or experience the resume does not state.
- Transferable skills are abilities that carry across jobs (teamwork, communication, leadership, customer service, cash handling, problem-solving, time management, …).
- Categories must come from this list: ${JOB_CATEGORIES.join(', ')}.
- Job titles must be ones this person could realistically apply for today. Do not suggest titles that need a license or certification the resume doesn't show.
Reply with JSON only, in this shape:
{"skills":[{"name":"","type":"hard|soft","transferable":true,"evidence":""}],"categories":[""],"jobTitles":[""]}`

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim()

/** True when the quoted evidence is (nearly) a line of the resume. */
export function isGrounded(evidence: string, corpus: CorpusLine[]): CorpusLine | undefined {
  const e = norm(evidence)
  if (e.length < 3) return undefined
  const eTokens = e.split(' ')
  for (const line of corpus) {
    const l = norm(line.text)
    if (l.includes(e) || (e.includes(l) && l.length >= 12)) return line
    const lTokens = new Set(l.split(' '))
    const overlap = eTokens.filter((t) => lTokens.has(t)).length / eTokens.length
    if (eTokens.length >= 4 && overlap >= 0.85) return line
  }
  return undefined
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI reply had no JSON object')
  return JSON.parse(body.slice(start, end + 1))
}

export function groundSuggestions(raw: unknown, corpus: CorpusLine[], known: Set<string>): AiSuggestions {
  const out: AiSuggestions = { skills: [], categories: [], titles: [] }
  const obj = (raw ?? {}) as Record<string, unknown>
  const corpusText = norm(corpus.map((c) => c.text).join(' '))

  for (const s of Array.isArray(obj.skills) ? obj.skills.slice(0, 40) : []) {
    const item = s as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 60) : ''
    const evidence = typeof item.evidence === 'string' ? item.evidence : ''
    if (!name || known.has(name.toLowerCase())) continue
    const line = isGrounded(evidence, corpus)
    if (!line) continue
    // A skill that claims a credential must name something the resume itself says.
    if (CREDENTIAL_TITLE_RE.test(name) && !corpusText.includes(norm(name))) continue
    known.add(name.toLowerCase())
    out.skills.push({
      name,
      type: (item.type === 'soft' ? 'soft' : 'hard') as SkillType,
      transferable: item.transferable === true,
      source: 'ai',
      evidence: [{ text: line.text, where: line.where }],
      direct: false,
      practiced: ['experience', 'volunteer', 'projects', 'activities'].includes(line.section),
    })
  }
  for (const c of Array.isArray(obj.categories) ? obj.categories : []) {
    const match = JOB_CATEGORIES.find((j) => typeof c === 'string' && j.toLowerCase() === c.trim().toLowerCase())
    if (match && !out.categories.includes(match)) out.categories.push(match)
  }
  for (const t of Array.isArray(obj.jobTitles) ? obj.jobTitles.slice(0, 12) : []) {
    if (typeof t !== 'string') continue
    const title = t.trim().replace(/\s+/g, ' ')
    if (!title || title.length > 60) continue
    if (CREDENTIAL_TITLE_RE.test(title) && !corpusText.includes(norm(title))) continue
    out.titles.push(title)
  }
  return out
}

export async function aiAnalyze(
  cfg: AiConfig,
  corpus: CorpusLine[],
  knownSkills: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<AiSuggestions> {
  const resumeText = corpus.map((c) => `[${c.where}] ${c.text}`).join('\n').slice(0, 12000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Skills already found (don't repeat): ${knownSkills.join(', ') || 'none'}\n\nResume:\n${resumeText}`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`AI service returned HTTP ${res.status}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('AI reply was empty')
    return groundSuggestions(extractJson(content), corpus, new Set(knownSkills.map((k) => k.toLowerCase())))
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`AI analysis timed out after ${cfg.timeoutMs} ms`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
