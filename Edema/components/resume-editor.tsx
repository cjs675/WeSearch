'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { EducationEntry, EducationLevel, ExperienceEntry, ExperienceKind, ResumeData } from '@/lib/resume/types'

const box = 'rounded-xl border border-[#dededb] bg-[#fafaf9] p-5'
const input =
  'w-full rounded-lg border border-[#dededb] bg-[#f5f5f4] px-3 py-2 text-sm outline-none placeholder:text-[#a1a1aa] focus:border-[#a1a1aa]'
const label = 'text-[11px] font-medium text-[#71717a]'

function Field({ name, value, onChange, placeholder }: { name: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{name}</span>
      <input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={input} />
    </label>
  )
}

/** One item per line. */
function Lines({ name, value, onChange, rows = 3, hint }: { name: string; value: string[]; onChange: (v: string[]) => void; rows?: number; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>
        {name} <span className="font-normal text-[#a1a1aa]">{hint ?? '· one per line'}</span>
      </span>
      <textarea
        rows={rows}
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        onBlur={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        className={`${input} resize-y leading-relaxed`}
      />
    </label>
  )
}

function Heading({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between">
      <h3 className="text-sm font-medium">{title}</h3>
      {onAdd && (
        <button type="button" onClick={onAdd} className="flex items-center gap-1 rounded-lg border border-[#dededb] px-2.5 py-1.5 text-xs text-[#71717a] hover:text-[#18181b]">
          <Plus className="size-3.5" /> {addLabel}
        </button>
      )}
    </div>
  )
}

function RemoveBtn({ onClick, what }: { onClick: () => void; what: string }) {
  return (
    <button type="button" aria-label={`Remove ${what}`} onClick={onClick} className="rounded-lg p-1.5 text-[#a1a1aa] hover:bg-[#ededeb] hover:text-[#18181b]">
      <Trash2 className="size-4" />
    </button>
  )
}

const LEVELS: { v: EducationLevel; l: string }[] = [
  { v: 'high_school', l: 'High school' },
  { v: 'ged', l: 'GED' },
  { v: 'certificate', l: 'Certificate / trade' },
  { v: 'associate', l: "Associate's" },
  { v: 'bachelor', l: "Bachelor's" },
  { v: 'master', l: "Master's" },
  { v: 'doctorate', l: 'Doctorate' },
  { v: 'college', l: 'College (other)' },
  { v: 'unknown', l: 'Other' },
]

export function ResumeEditor({ value: r, onChange }: { value: ResumeData; onChange: (r: ResumeData) => void }) {
  const set = <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => onChange({ ...r, [k]: v })
  const setExp = (i: number, patch: Partial<ExperienceEntry>) => set('experience', r.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const setEdu = (i: number, patch: Partial<EducationEntry>) => set('education', r.education.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  return (
    <div className="mt-7">
      <div className={box}>
        <h3 className="text-sm font-medium">Contact</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="Name" value={r.contact.name} onChange={(v) => set('contact', { ...r.contact, name: v })} />
          <Field name="Email" value={r.contact.email} onChange={(v) => set('contact', { ...r.contact, email: v })} />
          <Field name="Phone" value={r.contact.phone} onChange={(v) => set('contact', { ...r.contact, phone: v })} />
          <Field name="Location" value={r.contact.location} onChange={(v) => set('contact', { ...r.contact, location: v })} placeholder="City, ST" />
        </div>
        <div className="mt-3">
          <Lines name="Summary / objective" value={r.summary} onChange={(v) => set('summary', v)} rows={2} hint="" />
        </div>
      </div>

      <Heading
        title="Work, internships & volunteering"
        addLabel="Add entry"
        onAdd={() => set('experience', [...r.experience, { title: '', organization: '', dates: '', current: false, kind: 'job', bullets: [] }])}
      />
      <div className="flex flex-col gap-3">
        {r.experience.length === 0 && <p className="rounded-xl border border-dashed border-[#d4d4d0] p-5 text-sm text-[#a1a1aa]">No entries. That’s fine — add babysitting, lawn mowing, volunteering or anything you’ve done.</p>}
        {r.experience.map((e, i) => (
          <div key={i} className={box}>
            <div className="flex items-start gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Field name="Job title" value={e.title} onChange={(v) => setExp(i, { title: v })} />
                <Field name="Employer / organization" value={e.organization} onChange={(v) => setExp(i, { organization: v })} />
                <Field name="Dates" value={e.dates} onChange={(v) => setExp(i, { dates: v })} placeholder="June 2024 – Present" />
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Type</span>
                  <select value={e.kind} onChange={(ev) => setExp(i, { kind: ev.target.value as ExperienceKind })} className={input}>
                    <option value="job">Job</option>
                    <option value="internship">Internship</option>
                    <option value="volunteer">Volunteer</option>
                  </select>
                </label>
              </div>
              <RemoveBtn what="entry" onClick={() => set('experience', r.experience.filter((_, j) => j !== i))} />
            </div>
            <div className="mt-3">
              <Lines name="What you did" value={e.bullets} onChange={(v) => setExp(i, { bullets: v })} rows={Math.max(3, e.bullets.length + 1)} />
            </div>
          </div>
        ))}
      </div>

      <Heading
        title="Education"
        addLabel="Add school"
        onAdd={() => set('education', [...r.education, { institution: '', level: 'unknown', inProgress: false, details: [] }])}
      />
      <div className="flex flex-col gap-3">
        {r.education.map((e, i) => (
          <div key={i} className={box}>
            <div className="flex items-start gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Field name="School" value={e.institution} onChange={(v) => setEdu(i, { institution: v })} />
                <Field name="Degree / diploma" value={e.degree} onChange={(v) => setEdu(i, { degree: v })} />
                <Field name="Field of study" value={e.field} onChange={(v) => setEdu(i, { field: v })} />
                <Field name="Dates" value={e.dates} onChange={(v) => setEdu(i, { dates: v, endYear: Number(v.match(/(19|20)\d\d(?!.*(19|20)\d\d)/)?.[0]) || undefined })} />
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Level</span>
                  <select value={e.level} onChange={(ev) => setEdu(i, { level: ev.target.value as EducationLevel })} className={input}>
                    {LEVELS.map((l) => (
                      <option key={l.v} value={l.v}>
                        {l.l}
                      </option>
                    ))}
                  </select>
                </label>
                <Field name="GPA" value={e.gpa} onChange={(v) => setEdu(i, { gpa: v })} />
                <label className="flex items-center gap-2 text-sm text-[#52525b]">
                  <input type="checkbox" checked={e.inProgress} onChange={(ev) => setEdu(i, { inProgress: ev.target.checked })} className="size-4 accent-[#18181b]" />
                  Still in school
                </label>
              </div>
              <RemoveBtn what="school" onClick={() => set('education', r.education.filter((_, j) => j !== i))} />
            </div>
          </div>
        ))}
      </div>

      <Heading title="Skills, certifications & more" />
      <div className={`${box} grid gap-4 sm:grid-cols-2`}>
        <Lines name="Skills listed on your resume" value={r.listedSkills} onChange={(v) => set('listedSkills', v)} rows={5} />
        <Lines name="Certifications & licenses" value={r.certifications} onChange={(v) => set('certifications', v)} rows={5} />
        <Lines name="Languages" value={r.languages} onChange={(v) => set('languages', v)} />
        <Lines name="Activities, clubs & sports" value={r.activities} onChange={(v) => set('activities', v)} />
        <Lines name="Awards" value={r.awards} onChange={(v) => set('awards', v)} />
        <Lines name="Coursework" value={r.coursework} onChange={(v) => set('coursework', v)} />
      </div>

      {r.projects.length > 0 && (
        <>
          <Heading title="Projects" addLabel="Add project" onAdd={() => set('projects', [...r.projects, { name: '', description: [] }])} />
          <div className="flex flex-col gap-3">
            {r.projects.map((p, i) => (
              <div key={i} className={box}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <Field name="Project" value={p.name} onChange={(v) => set('projects', r.projects.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
                  </div>
                  <RemoveBtn what="project" onClick={() => set('projects', r.projects.filter((_, j) => j !== i))} />
                </div>
                <div className="mt-3">
                  <Lines name="Details" value={p.description} onChange={(v) => set('projects', r.projects.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
