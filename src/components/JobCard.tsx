'use client'

import React, { useState } from 'react'
import type { JobMatch, Salary } from '@/types'
import { ArrowUpRight, ChevronDown, ChevronUp, MapPin, Building2, CheckCircle2, AlertCircle } from 'lucide-react'

interface JobCardProps {
  match: JobMatch
}

const QUALIFICATION_LABELS = {
  met: 'You have this',
  missing: 'Missing',
  in_progress: 'In progress',
  check_yourself: 'Check this yourself',
}

function payText(salary: Salary): string {
  if (salary.text) return salary.text
  const range = [salary.min, salary.max].filter((n): n is number => Boolean(n))
  return range.map((n) => `$${Math.round(n).toLocaleString('en-US')}`).join(' - ') + ' a year'
}

export function JobCard({ match }: JobCardProps) {
  const { job, compatibility } = match
  const [expanded, setExpanded] = useState(false)
  const typical = new Set(compatibility?.skillsTypicalForRole ?? [])
  const label = (skill: string) => (typical.has(skill) ? `${skill} (typical for this role)` : skill)
  const qualifications = compatibility?.qualifications ?? []

  const initial = (job.employer || job.title).charAt(0).toUpperCase()

  return (
    <div className="flex flex-col rounded-xl border border-[#dededb] bg-[#fafaf9] p-5 transition hover:border-[#a1a1aa]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#d4d4d0] bg-[#f0f0ee] text-sm font-semibold text-[#18181b]">
            {initial}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[#18181b]">{job.title}</h3>
              {job.remote && (
                <span className="rounded bg-[#ededeb] px-1.5 py-0.5 text-[11px] font-medium text-[#71717a]">
                  Remote
                </span>
              )}
              {job.jobType && (
                <span className="rounded bg-[#f0f0ee] px-1.5 py-0.5 text-[11px] font-medium text-[#a1a1aa] uppercase">
                  {job.jobType.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#71717a]">
              {job.employer && (
                <span className="flex items-center gap-1 font-medium text-[#52525b]">
                  <Building2 className="size-3.5 text-[#a1a1aa]" />
                  {job.employer}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1 text-[#a1a1aa]">
                  <MapPin className="size-3.5" />
                  {job.location}
                </span>
              )}
              {job.salary && (
                <span className="text-[#52525b]">{payText(job.salary)}</span>
              )}
              <span className="text-[#a1a1aa]">
                {job.postedAt ? `Posted ${job.postedAt.slice(0, 10)}` : 'Posting date not given'}
              </span>
              {match.entryLevel && <span className="text-[#52525b]">Entry-level friendly</span>}
              <span className="text-[10px] text-[#c4c4c0]">via {job.sources.join(', ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {compatibility ? (
            <div className="flex items-center gap-1 rounded-full border border-[#dededb] bg-white px-3 py-1 text-xs shadow-sm">
              <span className="text-[#a1a1aa]">estimated fit</span>
              <span className="font-semibold text-[#18181b]">{compatibility.score}%</span>
            </div>
          ) : (
            <span className="text-xs text-[#a1a1aa]">live listing</span>
          )}

          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[#18181b] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#3f3f46]"
          >
            Apply <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>

      {compatibility && compatibility.matchedSkills.length > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-[#71717a]">Matches:</span>
          {compatibility.matchedSkills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded bg-[#ededeb] px-2 py-0.5 text-[11px] font-medium text-[#18181b]"
            >
              <CheckCircle2 className="size-3 text-[#18181b]" />
              {skill}
            </span>
          ))}
          {compatibility.missingSkills.length > 0 && (
            <>
              <span className="ml-2 text-[11px] font-medium text-[#a1a1aa]">Wanted:</span>
              {compatibility.missingSkills.slice(0, 2).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 rounded bg-[#f5f5f4] px-2 py-0.5 text-[11px] text-[#71717a]"
                >
                  <AlertCircle className="size-3 text-[#a1a1aa]" />
                  {skill}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {qualifications.filter((q) => q.status !== 'met').map((q) => (
        <p key={q.label} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {QUALIFICATION_LABELS[q.status]}: {q.label}
          {q.canGetAfterHire ? ' (can be obtained after hire)' : ''}. The posting says: &ldquo;{q.evidence}&rdquo;
        </p>
      ))}

      <div className="mt-3 flex items-center justify-between border-t border-[#dededb]/60 pt-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-[#71717a] hover:text-[#18181b]"
        >
          {expanded ? (
            <>
              Hide details <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              Show details & description <ChevronDown className="size-3" />
            </>
          )}
        </button>
        {job.categories.length > 0 && (
          <span className="text-[10px] text-[#a1a1aa]">
            {job.categories.join(' · ')}
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-[#dededb] pt-3 text-xs leading-relaxed text-[#52525b]">
          {compatibility && compatibility.components.length > 0 && (
            <div className="rounded-lg border border-[#dededb] bg-white p-3">
              <h4 className="font-semibold text-[#18181b] mb-2">Score Breakdown</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {compatibility.components.map((c) => (
                  <div key={c.name} className="rounded bg-[#f5f5f4] p-2">
                    <div className="flex items-center justify-between font-medium text-[#18181b]">
                      <span>{c.name}</span>
                      <span>
                        {c.points}/{c.maxPoints}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#71717a]">{c.explanation}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-3 space-y-1.5 text-[11px] text-[#71717a]">
                {[
                  ['Matching skills', compatibility.matchedSkills.map(label)],
                  ['Transferable skills', compatibility.transferableSkills.map((t) => `${t.have} counts toward ${label(t.countsToward)}`)],
                  ['Not on your resume', compatibility.missingSkills.map(label)],
                  ['Required qualifications found', qualifications.map((q) => `${q.label} (${QUALIFICATION_LABELS[q.status].toLowerCase()})`)],
                  ['Relevant experience', compatibility.relevantExperience],
                ].filter(([, items]) => items.length > 0).map(([title, items]) => (
                  <div key={title as string}>
                    <dt className="inline font-medium text-[#18181b]">{title}: </dt>
                    <dd className="inline">{(items as string[]).join(', ')}</dd>
                  </div>
                ))}
              </dl>
              {job.descriptionIsPartial && (
                <p className="mt-2 text-[11px] text-[#71717a]">
                  Only part of this posting was available, so it may list more requirements.
                </p>
              )}
            </div>
          )}

          <div>
            <h4 className="font-semibold text-[#18181b] mb-1">About the Role</h4>
            <p className="whitespace-pre-line text-[#71717a]">{job.description || 'No description provided.'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
