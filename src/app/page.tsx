'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Filter,
  LayoutDashboard,
  MapPin,
  Menu,
  Search,
  Settings,
  Sparkles,
  Target,
  X,
  Loader2,
} from 'lucide-react'
import type { JobMatch, JobCategory, Resume, JobSourceStatus } from '@/types'
import { CategoryFilter } from '@/components/CategoryFilter'
import { ResumeUploader } from '@/components/ResumeUploader'
import { JobCard } from '@/components/JobCard'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'My matches', icon: Target, count: '12' },
  { label: 'Saved roles', icon: BriefcaseBusiness, count: '4' },
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<JobCategory[]>([])
  const [resume, setResume] = useState<Resume | null>(null)

  const [matches, setMatches] = useState<JobMatch[]>([])
  const [sources, setSources] = useState<JobSourceStatus[]>([])
  const [sourceMessage, setSourceMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback(async (currentResume?: Resume | null) => {
    setLoading(true)
    setHasSearched(true)
    try {
      const activeResume = currentResume !== undefined ? currentResume : resume
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: {
            keywords: query.trim() ? query.trim().split(/\s+/) : [],
            categories: selectedCategories,
            location: location.trim() || undefined,
          },
          resume: activeResume || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMatches(data.matches || [])
        setSources(data.sources || [])
        setSourceMessage(data.message || null)
      } else {
        setSourceMessage('Failed to fetch job listings from server.')
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
      setSourceMessage('Unable to reach job search service.')
    } finally {
      setLoading(false)
    }
  }, [query, selectedCategories, location, resume])

  useEffect(() => {
    // Initial fetch of jobs on load
    handleSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleCategory = (cat: JobCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleResumeChange = (newResume: Resume | null) => {
    setResume(newResume)
    handleSearch(newResume)
  }

  return (
    <main className="min-h-screen bg-[#f5f5f4] text-[#18181b]">
      {/* Sidebar navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#dededb] bg-[#fafaf9] px-5 py-6 lg:flex">
        <a href="#top" className="flex items-center gap-2 px-2 text-[15px] font-semibold tracking-[-0.03em]">
          <span className="grid size-7 place-items-center rounded-lg bg-[#18181b] text-white">
            <Sparkles className="size-3.5" />
          </span>
          WeSearch<span className="text-[#a1a1aa]">.</span>
        </a>
        <div className="mt-12 flex flex-col gap-1">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]">
            Workspace
          </p>
          {navItems.map(({ label, icon: Icon, count }, index) => (
            <a
              key={label}
              href={index === 0 ? '#top' : '#stories'}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                index === 0
                  ? 'bg-[#ededeb] font-medium text-[#18181b]'
                  : 'text-[#71717a] hover:bg-[#f0f0ee] hover:text-[#18181b]'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4" />
                {label}
              </span>
              {count && <span className="text-xs text-[#a1a1aa]">{count}</span>}
            </a>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1 border-t border-[#dededb] pt-5">
          <a
            href="#profile"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#71717a] hover:bg-[#f0f0ee] hover:text-[#18181b]"
          >
            <Settings className="size-4" /> Preferences
          </a>
          <a
            href="#signals"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#71717a] hover:bg-[#f0f0ee] hover:text-[#18181b]"
          >
            <CircleHelp className="size-4" /> Help center
          </a>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f0f0ee] p-3">
            <div className="grid size-8 place-items-center rounded-full bg-[#d4d4d0] text-xs font-semibold">
              CS
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">Chris Silva</p>
              <p className="text-[11px] text-[#a1a1aa]">WeSearch Candidate</p>
            </div>
            <ChevronDown className="ml-auto size-3.5 text-[#a1a1aa]" />
          </div>
        </div>
      </aside>

      {/* Main content body */}
      <div className="lg:pl-64">
        {/* Top Navbar */}
        <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-[#dededb]/80 bg-[#f5f5f4]/90 px-5 py-4 backdrop-blur-xl lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-[#18181b] text-white">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">WeSearch.</span>
          </div>
          <p className="hidden text-xs text-[#a1a1aa] lg:block">
            Group 5 · AI Day Job Matching Foundation
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              aria-label="Notifications"
              className="rounded-lg p-2 text-[#71717a] hover:bg-[#e9e9e6]"
            >
              <Bell className="size-4" />
            </button>
            <button
              aria-label="Toggle menu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-[#dededb] p-2 lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
          {menuOpen && (
            <div className="absolute right-5 top-14 flex w-48 flex-col gap-2 rounded-xl border border-[#dededb] bg-[#fafaf9] p-3 text-sm shadow-xl lg:hidden">
              <a href="#top" onClick={() => setMenuOpen(false)} className="rounded-lg bg-[#ededeb] px-3 py-2">
                Overview
              </a>
              <a href="#stories" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-[#71717a]">
                My matches
              </a>
              <a href="#profile" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-[#71717a]">
                Resume & Profile
              </a>
            </div>
          )}
        </nav>

        <div className="mx-auto max-w-6xl px-5 py-10 lg:px-10 lg:py-14">
          {/* Hero Section */}
          <section id="top" className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d4d4d0] bg-[#fafaf9] px-3 py-1.5 text-xs text-[#71717a]">
                <span className="live-dot" /> Live Job Sources Active
              </div>
              <h1 className="max-w-2xl text-5xl font-medium leading-[0.96] tracking-[-0.075em] sm:text-7xl">
                Find work that<br />
                <span className="text-[#a1a1aa]">fits you.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-[#71717a]">
                A quieter, smarter way to search. WeSearch connects your background with real live job opportunities using AI compatibility matching.
              </p>
            </div>

            <div className="relative hidden h-48 overflow-hidden rounded-2xl border border-[#dededb] bg-[#fafaf9] lg:block">
              <div className="grid-pattern absolute inset-0" />
              <div className="absolute inset-x-8 top-1/2 h-px bg-[#d4d4d0]" />
              <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#a1a1aa] bg-[#f5f5f4] p-2">
                <div className="grid size-full place-items-center rounded-full bg-[#18181b] text-white">
                  <Target className="size-6" />
                </div>
              </div>
              <span className="absolute left-4 top-4 font-mono text-[10px] text-[#a1a1aa]">
                SCANNING SIGNAL
              </span>
              <span className="absolute bottom-4 right-4 font-mono text-[10px] text-[#a1a1aa]">
                {matches.length} active matches
              </span>
              <span className="scan-line" />
            </div>
          </section>

          {/* Search Box */}
          <section
            id="search"
            className="mt-12 rounded-2xl border border-[#dededb] bg-[#fafaf9] p-5 shadow-[0_16px_40px_rgba(24,24,27,.04)] sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]">
                  Search the market
                </p>
                <h2 className="mt-1 text-lg font-medium tracking-[-0.03em]">
                  What are you looking for?
                </h2>
              </div>
              <Command className="hidden size-4 text-[#c4c4c0] sm:block" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSearch()
              }}
              className="grid gap-3 lg:grid-cols-[1fr_.75fr_auto]"
            >
              <label className="flex items-center gap-3 rounded-lg border border-[#dededb] bg-[#f5f5f4] px-3.5 py-3 focus-within:border-[#a1a1aa]">
                <Search className="size-4 text-[#a1a1aa]" />
                <input
                  aria-label="Role, skill, or company"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Role, skill, or company"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#a1a1aa]"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-[#dededb] bg-[#f5f5f4] px-3.5 py-3 focus-within:border-[#a1a1aa]">
                <MapPin className="size-4 text-[#a1a1aa]" />
                <input
                  aria-label="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location or remote"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#a1a1aa]"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#18181b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3f3f46] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Searching
                  </>
                ) : (
                  <>
                    Find matches <ArrowUpRight className="size-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 border-t border-[#dededb]/60 pt-3">
              <span className="text-[11px] font-medium text-[#71717a]">Filter by category:</span>
              <CategoryFilter
                selectedCategories={selectedCategories}
                onToggleCategory={handleToggleCategory}
              />
            </div>

            {hasSearched && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#52525b]">
                <Check className="size-4 text-[#18181b]" />
                Search tuned for {query || 'all open roles'}
                {location ? ` in ${location}` : ''}
                {selectedCategories.length > 0 ? ` (${selectedCategories.join(', ')})` : ''}.
              </div>
            )}
          </section>

          {/* Profile / Resume Matching Section */}
          <section id="profile" className="mt-10">
            <ResumeUploader resume={resume} onResumeChange={handleResumeChange} />
          </section>

          {/* Live matches / feed */}
          <section id="stories" className="mt-16 pb-12">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]">
                  Live from verified job boards
                </p>
                <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em]">
                  Roles with a reason.
                </h2>
              </div>

              {/* Source indicators */}
              <div className="flex flex-wrap items-center gap-2">
                {sources.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#dededb] bg-white px-3 py-1 text-xs text-[#71717a]"
                  >
                    <span
                      className={`size-2 rounded-full ${
                        s.state === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {s.name} ({s.count})
                  </span>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="mt-10 flex flex-col items-center justify-center py-16 text-[#71717a]">
                <Loader2 className="size-8 animate-spin text-[#18181b]" />
                <p className="mt-3 text-sm">Querying job APIs and computing compatibility scores...</p>
              </div>
            ) : matches.length > 0 ? (
              <div className="mt-7 flex flex-col gap-3">
                {matches.map((match) => (
                  <JobCard key={match.job.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-xl border border-dashed border-[#dededb] bg-[#fafaf9] p-8 text-center text-sm text-[#71717a]">
                <p className="font-medium text-[#18181b]">No listings found</p>
                <p className="mt-1 text-xs">
                  {sourceMessage || 'Try adjusting your search query, location, or selected categories.'}
                </p>
              </div>
            )}
          </section>

          {/* Edge / Signals Section */}
          <section id="signals" className="mt-8 border-t border-[#dededb] pt-16 pb-12">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]">
                  Your edge
                </p>
                <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em] sm:text-4xl">
                  Less noise. More signal.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hidden items-center gap-2 rounded-lg border border-[#dededb] px-3 py-2 text-xs text-[#71717a] sm:flex"
              >
                <Filter className="size-3.5" /> Back to filters
              </button>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: BriefcaseBusiness,
                  title: 'Reads your edge',
                  body: 'Go beyond keywords. WeSearch understands the shape of your experience and matches it with job requirements.',
                },
                {
                  icon: Sparkles,
                  title: 'Maps the market',
                  body: 'Real live signals from verified job APIs surface actual open opportunities without fake mock listings.',
                },
                {
                  icon: Bell,
                  title: 'Keeps watch',
                  body: 'Compatibility scoring highlights exactly where your skills meet job demands and identifies transferrable qualifications.',
                },
              ].map(({ icon: Icon, title, body }, i) => (
                <article
                  key={title}
                  className="group rounded-xl border border-[#dededb] bg-[#fafaf9] p-5 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-[#71717a] transition group-hover:text-[#18181b]" />
                    <span className="font-mono text-[10px] text-[#c4c4c0]">0{i + 1}</span>
                  </div>
                  <h3 className="mt-12 text-sm font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#71717a]">{body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
