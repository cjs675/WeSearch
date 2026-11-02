'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { AnalysisResult, ResumeData, Skill, SkillType } from '@/lib/resume/types'
import { ResumeEditor } from './resume-editor'

const STAGE_LABEL: Record<string, string> = {
  no_work_experience: 'No work experience yet',
  high_school_student: 'High school student',
  college_student: 'College student',
  recent_graduate: 'Recent graduate',
  experienced: 'Has work experience',
}
const EDU_LABEL: Record<string, string> = {
  none_listed: 'None listed as finished',
  high_school: 'High school',
  ged: 'GED',
  certificate: 'Certificate',
  associate: "Associate's",
  bachelor: "Bachelor's",
  master: "Master's",
  doctorate: 'Doctorate',
  college: 'College',
  unknown: 'Other',
}

const eyebrow = 'text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]'
const card = 'rounded-2xl border border-[#dededb] bg-[#fafaf9] p-5 shadow-[0_16px_40px_rgba(24,24,27,.04)] sm:p-7'

type Manual = { name: string; type: SkillType }

export function ResumeAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasted, setPasted] = useState('')
  const [useAI, setUseAI] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [draft, setDraft] = useState<ResumeData | null>(null)
  const [manual, setManual] = useState<Manual[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send(body: FormData | object) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/resume/analyze', {
        method: 'POST',
        ...(body instanceof FormData ? { body } : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? 'Something went wrong.')
      setResult(data)
      setDraft(structuredClone(data.resume))
      setDirty(false)
      return data as AnalysisResult
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function analyzeUpload() {
    const form = new FormData()
    if (pasteMode) form.append('text', pasted)
    else if (file) form.append('file', file)
    form.append('useAI', String(useAI))
    if (manual.length) form.append('manualSkills', JSON.stringify(manual))
    if (removed.length) form.append('removedSkills', JSON.stringify(removed))
    void send(form).then((r) => r && document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }))
  }

  function reanalyze(nextManual = manual, nextRemoved = removed) {
    if (!draft) return
    void send({ resume: draft, manualSkills: nextManual, removedSkills: nextRemoved, useAI })
  }

  function pick(f: File | undefined) {
    if (!f) return
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return setError('Please choose a PDF file.')
    if (f.size > 5 * 1024 * 1024) return setError('The resume must be 5 MB or smaller.')
    setError(null)
    setFile(f)
  }

  function addSkill(name: string, type: SkillType) {
    const n = name.trim()
    if (!n) return
    const nextManual = [...manual.filter((m) => m.name.toLowerCase() !== n.toLowerCase()), { name: n, type }]
    const nextRemoved = removed.filter((r) => r.toLowerCase() !== n.toLowerCase())
    setManual(nextManual)
    setRemoved(nextRemoved)
    reanalyze(nextManual, nextRemoved)
  }

  function removeSkill(s: Skill) {
    const nextManual = manual.filter((m) => m.name.toLowerCase() !== s.name.toLowerCase())
    const nextRemoved = s.source === 'user' ? removed : [...removed, s.name]
    setManual(nextManual)
    setRemoved(nextRemoved)
    reanalyze(nextManual, nextRemoved)
  }

  const canAnalyze = pasteMode ? pasted.trim().length > 0 : Boolean(file)

  return (
    <>
      <section id="upload" className={`mt-12 ${card}`}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className={eyebrow}>Step 1</p>
            <h2 className="mt-1 text-lg font-medium tracking-[-0.03em]">Add your resume</h2>
          </div>
          <button onClick={() => setPasteMode(!pasteMode)} className="text-xs text-[#71717a] underline decoration-[#d4d4d0] underline-offset-4 hover:text-[#18181b]">
            {pasteMode ? 'Upload a PDF instead' : 'Paste text instead'}
          </button>
        </div>

        {pasteMode ? (
          <textarea
            aria-label="Resume text"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste your resume text here…"
            className="h-56 w-full resize-y rounded-lg border border-[#dededb] bg-[#f5f5f4] p-3.5 text-sm outline-none placeholder:text-[#a1a1aa] focus:border-[#a1a1aa]"
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pick(e.dataTransfer.files[0])
            }}
            className={`relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed px-6 py-12 text-center transition ${dragging ? 'border-[#18181b] bg-[#ededeb]' : 'border-[#c4c4c0] bg-[#f5f5f4] hover:border-[#a1a1aa]'}`}
          >
            <div className="grid-pattern absolute inset-0 opacity-60" />
            <span className="relative grid size-11 place-items-center rounded-xl bg-[#18181b] text-white">
              {file ? <FileText className="size-5" /> : <Upload className="size-5" />}
            </span>
            <span className="relative text-sm font-medium">{file ? file.name : 'Drop your PDF here, or click to choose'}</span>
            <span className="relative text-xs text-[#a1a1aa]">{file ? `${(file.size / 1024).toFixed(0)} KB · click to change` : 'PDF only · up to 5 MB'}</span>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </button>
        )}

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#52525b]">
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} className="size-4 accent-[#18181b]" />
            Use AI analysis when available
            <span className="text-xs text-[#a1a1aa]">(falls back to standard analysis)</span>
          </label>
          <button
            disabled={!canAnalyze || loading}
            onClick={analyzeUpload}
            className="rounded-lg bg-[#18181b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3f3f46] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="mr-1.5 inline size-4 animate-spin" /> : <Sparkles className="mr-1.5 inline size-3.5" />}
            {loading ? 'Reading your resume…' : 'Analyze resume'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-[#f0d4d4] bg-[#fdf6f6] px-3.5 py-3 text-sm text-[#9f1239]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </section>

      {result && draft && (
        <div id="results" className="scroll-mt-20">
          <Overview result={result} />
          <Categories result={result} />
          <Keywords result={result} />
          <Skills result={result} onAdd={addSkill} onRemove={removeSkill} busy={loading} />
          <section className="mt-20 pb-10">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className={eyebrow}>Step 2 · Check what we found</p>
                <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em]">Edit your details.</h2>
                <p className="mt-2 max-w-md text-sm text-[#71717a]">Fix anything that was read wrong, then re-run the analysis. Only what you see here is used.</p>
              </div>
              <button
                disabled={!dirty || loading}
                onClick={() => reanalyze()}
                className="rounded-lg bg-[#18181b] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3f3f46] disabled:opacity-40"
              >
                {loading ? <Loader2 className="mr-1.5 inline size-4 animate-spin" /> : <RotateCcw className="mr-1.5 inline size-3.5" />}
                Re-run analysis
              </button>
            </div>
            <ResumeEditor
              value={draft}
              onChange={(r) => {
                setDraft(r)
                setDirty(true)
              }}
            />
          </section>
        </div>
      )}
    </>
  )
}

function Overview({ result }: { result: AnalysisResult }) {
  const a = result.applicant
  const m = result.meta
  return (
    <section className="mt-20">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className={eyebrow}>Your profile</p>
          <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em] sm:text-4xl">{result.resume.contact.name ? `Hi, ${result.resume.contact.name.split(' ')[0]}.` : 'Here’s what we found.'}</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d4d4d0] bg-[#fafaf9] px-3 py-1.5 text-xs text-[#71717a]">
          <span className="live-dot" /> {m.analysisMode === 'ai+rules' ? 'AI + standard analysis' : 'Standard analysis'}
        </span>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Stage', value: STAGE_LABEL[a.stage] },
          { label: 'Work experience', value: a.hasWorkExperience ? `${a.yearsOfExperience} yr${a.yearsOfExperience === 1 ? '' : 's'}` : 'None listed' },
          { label: 'Education finished', value: EDU_LABEL[a.highestCompletedEducation] ?? a.highestCompletedEducation },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#dededb] bg-[#fafaf9] p-5">
            <p className={eyebrow}>{s.label}</p>
            <p className="mt-3 text-lg font-medium tracking-[-0.03em]">{s.value}</p>
          </div>
        ))}
      </div>
      {(a.notes.length > 0 || m.warnings.length > 0) && (
        <ul className="mt-3 flex flex-col gap-2">
          {[...m.warnings, ...a.notes].map((n) => (
            <li key={n} className="flex items-start gap-2 rounded-lg border border-[#dededb] bg-[#f0f0ee] px-3.5 py-2.5 text-xs text-[#52525b]">
              <GraduationCap className="mt-0.5 size-3.5 shrink-0 text-[#a1a1aa]" /> {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Categories({ result }: { result: AnalysisResult }) {
  return (
    <section className="mt-20">
      <p className={eyebrow}>Where you fit</p>
      <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em]">Suggested job categories.</h2>
      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {result.suggestedCategories.map((c, i) => (
          <article key={c.category} className="group rounded-xl border border-[#dededb] bg-[#fafaf9] p-5 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{c.category}</h3>
              <span className="font-mono text-[10px] text-[#c4c4c0]">0{i + 1}</span>
            </div>
            <div className="mt-6 h-1 overflow-hidden rounded-full bg-[#ededeb]">
              <div className="h-full rounded-full bg-[#18181b]" style={{ width: `${c.score}%` }} />
            </div>
            <ul className="mt-4 flex flex-col gap-1 text-xs leading-relaxed text-[#71717a]">
              {c.reasons.slice(0, 3).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {c.entryLevelSuggestion && <p className="mt-3 text-[11px] text-[#a1a1aa]">Entry-level friendly</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

function Keywords({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.searchKeywords.join(', '))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked; nothing to do */
    }
  }
  return (
    <section className={`mt-20 ${card}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={eyebrow}>Search the market</p>
          <h2 className="mt-1 text-lg font-medium tracking-[-0.03em]">Keywords to search with</h2>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-[#dededb] px-3 py-2 text-xs text-[#71717a] hover:text-[#18181b]">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy all'}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {result.searchKeywords.map((k) => (
          <a
            key={k}
            href={`https://www.google.com/search?q=${encodeURIComponent(`${k} jobs`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[#dededb] bg-[#f5f5f4] px-3 py-2 text-sm transition hover:border-[#a1a1aa]"
          >
            <Search className="size-3.5 text-[#a1a1aa]" /> {k}
          </a>
        ))}
      </div>
      {result.alternativeJobTitles.length > 0 && (
        <>
          <p className={`mt-7 ${eyebrow}`}>Other job titles to try</p>
          <p className="mt-2 text-sm leading-relaxed text-[#52525b]">{result.alternativeJobTitles.join(' · ')}</p>
        </>
      )}
      {result.searchFilters.length > 0 && (
        <>
          <p className={`mt-6 ${eyebrow}`}>Helpful filters</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.searchFilters.map((f) => (
              <span key={f} className="rounded-full bg-[#ededeb] px-3 py-1 text-xs text-[#52525b]">
                {f}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Skills({ result, onAdd, onRemove, busy }: { result: AnalysisResult; onAdd: (n: string, t: SkillType) => void; onRemove: (s: Skill) => void; busy: boolean }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<SkillType>('hard')
  const [open, setOpen] = useState<string | null>(null)
  const groups: { key: 'hard' | 'soft' | 'transferable'; title: string; hint: string }[] = [
    { key: 'hard', title: 'Hard skills', hint: 'Tools, tasks and know-how' },
    { key: 'soft', title: 'Soft skills', hint: 'How you work with people' },
    { key: 'transferable', title: 'Transferable', hint: 'Carry into any job' },
  ]
  return (
    <section className="mt-20">
      <p className={eyebrow}>Your edge</p>
      <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em]">Skills we found.</h2>
      <p className="mt-2 max-w-lg text-sm text-[#71717a]">Click a skill to see the line from your resume it came from. Remove anything that isn’t right, or add skills we missed.</p>
      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {groups.map((g) => (
          <article key={g.key} className="rounded-xl border border-[#dededb] bg-[#fafaf9] p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium">{g.title}</h3>
              <span className="text-[11px] text-[#a1a1aa]">{g.hint}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.skills[g.key].length === 0 && <p className="text-xs text-[#a1a1aa]">None found yet.</p>}
              {result.skills[g.key].map((s) => {
                const id = `${g.key}:${s.name}`
                return (
                  <span key={id} className="group/chip inline-flex items-center rounded-lg border border-[#dededb] bg-[#f5f5f4] text-xs">
                    <button onClick={() => setOpen(open === id ? null : id)} className="px-2.5 py-1.5 text-left">
                      {s.name}
                      {s.source !== 'resume' && <span className="ml-1.5 rounded bg-[#ededeb] px-1 text-[10px] uppercase text-[#a1a1aa]">{s.source === 'user' ? 'added' : 'AI'}</span>}
                    </button>
                    <button disabled={busy} aria-label={`Remove ${s.name}`} onClick={() => onRemove(s)} className="border-l border-[#dededb] px-1.5 py-1.5 text-[#a1a1aa] hover:text-[#18181b]">
                      <X className="size-3" />
                    </button>
                  </span>
                )
              })}
            </div>
            {result.skills[g.key]
              .filter((s) => open === `${g.key}:${s.name}`)
              .map((s) => (
                <div key={s.name} className="mt-3 rounded-lg bg-[#f0f0ee] p-3 text-xs text-[#52525b]">
                  {s.evidence.length ? (
                    s.evidence.map((e) => (
                      <p key={e.text} className="mt-1 first:mt-0">
                        <span className="text-[#a1a1aa]">{e.where}:</span> “{e.text}”
                      </p>
                    ))
                  ) : (
                    <p>You added this skill.</p>
                  )}
                </div>
              ))}
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onAdd(name, type)
          setName('')
        }}
        className="mt-3 grid gap-3 rounded-xl border border-[#dededb] bg-[#fafaf9] p-4 sm:grid-cols-[1fr_auto_auto]"
      >
        <label className="flex items-center gap-3 rounded-lg border border-[#dededb] bg-[#f5f5f4] px-3.5 py-2.5 focus-within:border-[#a1a1aa]">
          <Plus className="size-4 text-[#a1a1aa]" />
          <input aria-label="Skill to add" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a skill, e.g. Microsoft Excel" className="w-full bg-transparent text-sm outline-none placeholder:text-[#a1a1aa]" />
        </label>
        <select aria-label="Skill type" value={type} onChange={(e) => setType(e.target.value as SkillType)} className="rounded-lg border border-[#dededb] bg-[#f5f5f4] px-3 py-2.5 text-sm">
          <option value="hard">Hard skill</option>
          <option value="soft">Soft skill</option>
        </select>
        <button disabled={!name.trim() || busy} className="rounded-lg bg-[#18181b] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3f3f46] disabled:opacity-40">
          Add skill <ArrowUpRight className="ml-1 inline size-3.5" />
        </button>
      </form>
    </section>
  )
}
