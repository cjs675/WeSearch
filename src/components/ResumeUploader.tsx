'use client'

import React, { useState } from 'react'
import type { Resume, Skill } from '@/types'
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

  const handleAnalyze = async () => {
    if (!pasteText.trim()) return
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.resume) {
          onResumeChange(data.resume)
          setIsOpen(false)
        }
      }
    } catch (err) {
      console.error('Failed to parse resume:', err)
    } finally {
      setIsAnalyzing(false)
    }
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
              : 'Add skills or paste your background to rank listings by compatibility.'}
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

      {resume && resume.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#dededb] pt-4">
          <span className="text-[11px] font-medium text-[#71717a] mr-1">Active skills:</span>
          {resume.skills.map((skill) => (
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
