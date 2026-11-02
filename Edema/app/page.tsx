'use client'

import { useState } from 'react'
import { BriefcaseBusiness, ChevronDown, CircleHelp, FileText, LayoutDashboard, Menu, Settings, Sparkles, Target, X } from 'lucide-react'
import { ResumeAnalyzer } from '@/components/resume-analyzer'

// Same shell as the team's job-search app (sidebar + sticky top bar), with the resume page active.
const navItems = [
  { label: 'Overview', icon: LayoutDashboard, href: '/' },
  { label: 'Resume analyzer', icon: FileText, href: '#upload', active: true },
  { label: 'My matches', icon: Target, href: '#results' },
  { label: 'Saved roles', icon: BriefcaseBusiness, href: '#' },
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <main className="min-h-screen bg-[#f5f5f4] text-[#18181b]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#dededb] bg-[#fafaf9] px-5 py-6 lg:flex">
        <a href="#top" className="flex items-center gap-2 px-2 text-[15px] font-semibold tracking-[-0.03em]">
          <span className="grid size-7 place-items-center rounded-lg bg-[#18181b] text-white">
            <Sparkles className="size-3.5" />
          </span>
          scout<span className="text-[#a1a1aa]">.</span>
        </a>
        <div className="mt-12 flex flex-col gap-1">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]">Workspace</p>
          {navItems.map(({ label, icon: Icon, href, active }) => (
            <a key={label} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? 'bg-[#ededeb] font-medium text-[#18181b]' : 'text-[#71717a] hover:bg-[#f0f0ee] hover:text-[#18181b]'}`}>
              <Icon className="size-4" />
              {label}
            </a>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1 border-t border-[#dededb] pt-5">
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#71717a] hover:bg-[#f0f0ee] hover:text-[#18181b]">
            <Settings className="size-4" /> Preferences
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#71717a] hover:bg-[#f0f0ee] hover:text-[#18181b]">
            <CircleHelp className="size-4" /> Help center
          </a>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f0f0ee] p-3">
            <div className="grid size-8 place-items-center rounded-full bg-[#d4d4d0] text-xs font-semibold">
              <FileText className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">Your resume</p>
              <p className="text-[11px] text-[#a1a1aa]">Analyzed, never saved</p>
            </div>
            <ChevronDown className="ml-auto size-3.5 text-[#a1a1aa]" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-[#dededb]/80 bg-[#f5f5f4]/90 px-5 py-4 backdrop-blur-xl lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-[#18181b] text-white">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">scout.</span>
          </div>
          <p className="hidden text-xs text-[#a1a1aa] lg:block" suppressHydrationWarning>
            {today}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg border border-[#dededb] p-2 lg:hidden">
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
          {menuOpen && (
            <div className="absolute right-5 top-14 flex w-48 flex-col gap-2 rounded-xl border border-[#dededb] bg-[#fafaf9] p-3 text-sm shadow-xl lg:hidden">
              {navItems.map(({ label, href, active }) => (
                <a key={label} href={href} onClick={() => setMenuOpen(false)} className={`rounded-lg px-3 py-2 ${active ? 'bg-[#ededeb]' : 'text-[#71717a]'}`}>
                  {label}
                </a>
              ))}
            </div>
          )}
        </nav>

        <div className="mx-auto max-w-6xl px-5 py-10 lg:px-10 lg:py-14">
          <section id="top" className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d4d4d0] bg-[#fafaf9] px-3 py-1.5 text-xs text-[#71717a]">
                <span className="live-dot" /> Resume analyzer
              </div>
              <h1 className="max-w-2xl text-5xl font-medium leading-[0.96] tracking-[-0.075em] sm:text-7xl">
                Your resume,
                <br />
                <span className="text-[#a1a1aa]">read closely.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-[#71717a]">
                Upload a PDF and see the skills you already have, the kinds of jobs that fit, and what to type into the search bar. No experience? School, sports and volunteering count too.
              </p>
            </div>
            <div className="relative hidden h-48 overflow-hidden rounded-2xl border border-[#dededb] bg-[#fafaf9] lg:block">
              <div className="grid-pattern absolute inset-0" />
              <div className="absolute inset-x-8 top-1/2 h-px bg-[#d4d4d0]" />
              <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#a1a1aa] bg-[#f5f5f4] p-2">
                <div className="grid size-full place-items-center rounded-full bg-[#18181b] text-white">
                  <FileText className="size-6" />
                </div>
              </div>
              <span className="absolute left-4 top-4 font-mono text-[10px] text-[#a1a1aa]">READING RESUME</span>
              <span className="absolute bottom-4 right-4 font-mono text-[10px] text-[#a1a1aa]">16 categories</span>
              <span className="scan-line" />
            </div>
          </section>

          <ResumeAnalyzer />
        </div>
      </div>
    </main>
  )
}
