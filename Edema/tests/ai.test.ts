import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aiConfigFromEnv } from '@/lib/resume/ai'
import { analyzeResume } from '@/lib/resume/analyze'

const NOW = new Date('2026-11-02T12:00:00Z')
const text = readFileSync(path.join(import.meta.dirname, 'fixtures', 'example-cashier.txt'), 'utf8')
const cfg = { provider: 'ollama', baseUrl: 'http://ai.test/v1', model: 'gemma3:4b', timeoutMs: 2000 }

function fakeFetch(reply: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) } }] }), { status })) as typeof fetch
}

describe('optional AI analysis', () => {
  it('is off unless configured', () => {
    expect(aiConfigFromEnv({})).toBeUndefined()
    expect(aiConfigFromEnv({ RESUME_AI_PROVIDER: 'ollama' })).toMatchObject({ model: 'gemma3:4b', baseUrl: 'http://localhost:11434/v1' })
    expect(aiConfigFromEnv({ RESUME_AI_PROVIDER: 'openai-compatible' })).toBeUndefined() // needs URL + model
  })

  it('keeps AI skills only when their evidence is really in the resume', async () => {
    const reply = {
      skills: [
        { name: 'Order accuracy', type: 'hard', transferable: true, evidence: 'Took customer orders and handled cash and card payments at the register' },
        { name: 'Forklift operation', type: 'hard', evidence: 'Operated a forklift in the stockroom' }, // not in resume
        { name: 'Certified Food Protection Manager', type: 'hard', evidence: 'Helped with food preparation and kept the kitchen clean' }, // credential not stated
      ],
      categories: ['Hospitality', 'Not A Category'],
      jobTitles: ['Order Taker', 'Registered Nurse'],
    }
    const r = await analyzeResume({ kind: 'text', text, source: 'text' }, { now: NOW }, { aiConfig: cfg, fetchImpl: fakeFetch(reply) })
    const all = [...r.skills.hard, ...r.skills.soft]
    expect(r.meta.analysisMode).toBe('ai+rules')
    expect(all.find((s) => s.name === 'Order accuracy')).toMatchObject({ source: 'ai', transferable: true })
    expect(all.map((s) => s.name)).not.toContain('Forklift operation')
    expect(all.map((s) => s.name)).not.toContain('Certified Food Protection Manager')
    expect(r.suggestedCategories.map((c) => c.category)).not.toContain('Not A Category')
    expect(r.searchKeywords).toContain('Order Taker')
    expect(r.searchKeywords).not.toContain('Registered Nurse')
  })

  it('falls back to rules when the AI fails', async () => {
    const r = await analyzeResume({ kind: 'text', text, source: 'text' }, { now: NOW }, { aiConfig: cfg, fetchImpl: fakeFetch('oops', 500) })
    expect(r.meta.analysisMode).toBe('rules')
    expect(r.meta.aiError).toMatch(/500/)
    expect(r.suggestedCategories.map((c) => c.category)).toContain('Fast Food')
  })

  it('falls back to rules when the AI reply is not JSON', async () => {
    const r = await analyzeResume({ kind: 'text', text, source: 'text' }, { now: NOW }, { aiConfig: cfg, fetchImpl: fakeFetch('Sure! Here are some skills.') })
    expect(r.meta.analysisMode).toBe('rules')
    expect(r.skills.hard.length).toBeGreaterThan(0)
  })

  it('can be switched off per request', async () => {
    let called = false
    const spy = (async () => {
      called = true
      return new Response('{}')
    }) as typeof fetch
    const r = await analyzeResume({ kind: 'text', text, source: 'text' }, { now: NOW, useAI: false }, { aiConfig: cfg, fetchImpl: spy })
    expect(called).toBe(false)
    expect(r.meta.analysisMode).toBe('rules')
  })

  it('never sends contact details to the AI', async () => {
    let sent = ''
    const spy = (async (_url: unknown, init?: RequestInit) => {
      sent = String(init?.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"skills":[]}' } }] }))
    }) as typeof fetch
    await analyzeResume({ kind: 'text', text, source: 'text' }, { now: NOW }, { aiConfig: cfg, fetchImpl: spy })
    expect(sent).toContain('Taco Bell')
    expect(sent).not.toContain('jordan.smith@email.com')
    expect(sent).not.toContain('555-0142')
  })
})
