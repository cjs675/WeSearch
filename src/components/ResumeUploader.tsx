'use client'

import React, { useState } from 'react'
import type { Resume, Skill } from '@/types'
import type { AnalysisResult } from '@/features/resume-analysis/types'
import { Sparkles, FileText, Plus, X, Upload } from 'lucide-react'

interface ResumeUploaderProps {
  resume: Resume | null
  onResumeChange: (resume: Resume | null) => void
}

export function ResumeUploader({ resume, onResumeChange }: ResumeUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [newSkill, setNewSkill] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')

  const analyze = async (init: RequestInit) => {
    setIsAnalyzing(true)
    setError('')
    try {
      const res = await fetch('/api/resume/analyze', { method: 'POST', ...init })
      const data = await res.json()
      if (res.ok) {
        setAnalysis(data)
        onResumeChange(data.matchingResume)
        setIsOpen(false)
      } else {
        setError(data.error?.message ?? 'That resume could not be read.')
      }
    } catch {
      setError('That resume could not be read. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyze = () => {
    if (!pasteText.trim()) return
    analyze({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pasteText }) })
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    analyze({ body: form })
  }

  const handleLoadSample = (type: 'frontend' | 'designer') => {
    if (type === 'frontend') {
      const sample: Resume = {
        skills: [
          { name: 'TypeScript', source: 'manual' },
          { name: 'React', source: 'manual' },
          { name: 'Next.js', source: 'manual' },
          { name: 'Tailwind CSS', source: 'manual' },
          { name: 'Node.js', source: 'manual' },
        ],
        experience: [
          {
            title: 'Frontend Engineer',
            employer: 'Tech Studio',
            years: 3,
            description: 'Built interactive web applications in Next.js',
          },
        ],
        education: [
          {
            level: 'bachelor',
            field: 'Computer Science',
            inProgress: false,
          },
        ],
        certifications: [],
        isStudent: false,
      }
      onResumeChange(sample)
    } else {
      const sample: Resume = {
        skills: [
          { name: 'Figma', source: 'manual' },
          { name: 'UI/UX', source: 'manual' },
          { name: 'Product Design', source: 'manual' },
          { name: 'Communication', source: 'manual' },
        ],
        experience: [
          {
            title: 'Product Designer',
            employer: 'Creative Labs',
            years: 4,
            description: 'Designed user experiences for web and mobile apps',
          },
        ],
        education: [
          {
            level: 'bachelor',
            field: 'Interaction Design',
            inProgress: false,
          },
        ],
        certifications: [],
        isStudent: false,
      }
      onResumeChange(sample)
    }
  }

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkill.trim()) return
    const skillName = newSkill.trim()
    const currentSkills = resume ? [...resume.skills] : []
    if (!currentSkills.some((s) => s.name.toLowerCase() === skillName.toLowerCase())) {
      const updated: Skill = { name: skillName, source: 'manual' }
      const newResume: Resume = resume
        ? { ...resume, skills: [...currentSkills, updated] }
        : {
            skills: [updated],
            experience: [],
            education: [],
            certifications: [],
            isStudent: false,
          }
      onResumeChange(newResume)
    }
    setNewSkill('')
  }

  const handleRemoveSkill = (skillName: string) => {
    if (!resume) return
    const updatedSkills = resume.skills.filter((s) => s.name !== skillName)
    if (updatedSkills.length === 0) {
      onResumeChange(null)
    } else {
      onResumeChange({ ...resume, skills: updatedSkills })
    }
  }

  return (
    <div className="rounded-xl border border-[#dededb] bg-[#fafaf9] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#18181b]" />
            <h3 className="text-sm font-semibold text-[#18181b]">Candidate Profile & Skills</h3>
          </div>
          <p className="mt-1 text-xs text-[#71717a]">
            {resume && resume.skills.length > 0
              ? `${resume.skills.length} skills active for personalized fit scoring.`
              : 'Upload your resume as a PDF, paste it, or add skills to rank listings by fit.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!resume && (
            <>
              <button
                type="button"
                onClick={() => handleLoadSample('frontend')}
                className="rounded-lg border border-[#dededb] bg-white px-2.5 py-1.5 text-xs font-medium text-[#71717a] transition hover:bg-[#f0f0ee] hover:text-[#18181b]"
              >
                Sample: Frontend
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample('designer')}
                className="rounded-lg border border-[#dededb] bg-white px-2.5 py-1.5 text-xs font-medium text-[#71717a] transition hover:bg-[#f0f0ee] hover:text-[#18181b]"
              >
                Sample: Designer
              </button>
            </>
          )}

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#3f3f46]">
            <FileText className="size-3.5" />
            {isAnalyzing ? 'Reading...' : 'Upload PDF'}
            <input
              type="file"
              accept="application/pdf"
              aria-label="Upload resume PDF"
              className="sr-only"
              disabled={isAnalyzing}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-[#dededb] bg-white px-3 py-1.5 text-xs font-medium text-[#18181b] shadow-sm transition hover:bg-[#f0f0ee]"
          >
            <Upload className="size-3.5" />
            {isOpen ? 'Close' : 'Paste Background'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-[#dededb] pt-4">
          <label className="block text-xs font-medium text-[#71717a]">
            Paste resume text or job history:
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="e.g. Senior Software Engineer with 4 years building React, TypeScript, Node.js applications..."
            className="mt-1.5 w-full rounded-lg border border-[#dededb] bg-white p-3 text-xs text-[#18181b] outline-none placeholder:text-[#a1a1aa] focus:border-[#71717a]"
            rows={4}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={isAnalyzing || !pasteText.trim()}
              onClick={handleAnalyze}
              className="rounded-lg bg-[#18181b] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#3f3f46] disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing...' : 'Extract Skills & Profile'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      )}

      {analysis && resume && (
        <dl className="mt-4 space-y-1.5 border-t border-[#dededb] pt-4 text-xs text-[#71717a]">
          {[
            ['Work experience', resume.experience.map((e) => (e.employer ? `${e.title}, ${e.employer}` : e.title))],
            ['Education', resume.education.map((e) => [e.field, e.institution, e.inProgress ? 'in progress' : null].filter(Boolean).join(', '))],
            ['Certifications', resume.certifications],
            ['Projects', (resume.projects ?? []).map((p) => p.slice(0, 80))],
            ['Transferable skills', analysis.skills.transferable.map((t) => t.name)],
            ['Suggested categories', (resume.suggestedCategories ?? []).slice(0, 6)],
            ['Notes', analysis.meta.warnings],
          ].filter(([, items]) => items.length > 0).map(([title, items]) => (
            <div key={title as string}>
              <dt className="inline font-medium text-[#18181b]">{title}: </dt>
              <dd className="inline">{(items as string[]).join('; ')}</dd>
            </div>
          ))}
          <p className="pt-1">Please check this. You can also search any category, even one your resume doesn&apos;t suggest.</p>
        </dl>
      )}

      {(
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#dededb] pt-4">
          <span className="text-[11px] font-medium text-[#71717a] mr-1">{resume?.skills.length ? 'Active skills:' : 'Skills:'}</span>
          {resume?.skills.map((skill) => (
            <span
              key={skill.name}
              className="inline-flex items-center gap-1 rounded-md border border-[#dededb] bg-white px-2 py-1 text-xs text-[#18181b]"
            >
              {skill.name}
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill.name)}
                className="text-[#a1a1aa] hover:text-[#18181b]"
                aria-label={`Remove ${skill.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          <form onSubmit={handleAddSkill} className="inline-flex items-center ml-1">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="+ add skill"
              className="h-6 w-24 rounded border border-dashed border-[#dededb] bg-transparent px-2 text-xs text-[#18181b] outline-none placeholder:text-[#a1a1aa] focus:border-[#71717a]"
            />
          </form>
        </div>
      )}
    </div>
  )
}
