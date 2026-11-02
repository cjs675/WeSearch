"use client";

import { type FormEvent, useState } from "react";
import { JOB_CATEGORIES, type JobCategory, type JobMatch, type JobSearchResponse, type JobType, type Resume, type ResumeAnalysis, type Salary } from "@/types";

type Mode = "resume" | "explore";

const JOB_TYPE_LABELS: Record<JobType, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", temporary: "Temporary", internship: "Internship" };
const QUALIFICATION_LABELS = { met: "You have this", missing: "Missing", in_progress: "In progress", check_yourself: "Check this yourself" };
const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2";
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function payText(salary: Salary | null): string {
  if (!salary) return "Pay not listed";
  if (salary.text) return salary.text; // As the posting states it, since an hourly job may not be full-time
  const range = [salary.min, salary.max].filter((n): n is number => Boolean(n)).map(money).join(" to ");
  return range ? `${range} a year` : "Pay not listed";
}

function SkillList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <p className="mt-2 text-sm"><span className="font-medium">{title}:</span> {items.join(", ")}</p>;
}

function JobCard({ match }: { match: JobMatch }) {
  const { job, compatibility: fit } = match;
  const typical = new Set(fit?.skillsTypicalForRole ?? []);
  const label = (skill: string) => (typical.has(skill) ? `${skill} (typical for this role)` : skill);
  const details = [payText(job.salary), job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Job type not listed", job.postedAt ? `Posted ${job.postedAt.slice(0, 10)}` : "Posting date not given", match.entryLevel ? "Entry-level friendly" : null].filter(Boolean);
  const required = fit?.qualifications ?? [];
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{job.title}</h3>
          <p className="text-slate-600">{job.employer ?? "Employer not listed"} · {job.location ?? "Location not listed"}</p>
        </div>
        {fit && (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold tabular-nums">{fit.score}%</div>
            <div className="text-xs text-slate-600">estimated fit</div>
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">{details.join(" · ")}</p>
      {required.filter((q) => q.status !== "met").map((q) => (
        <p key={q.label} className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {QUALIFICATION_LABELS[q.status]}: {q.label}{q.canGetAfterHire ? " (can be obtained after hire)" : ""}. The posting says: &ldquo;{q.evidence}&rdquo;
        </p>
      ))}
      {fit && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-medium text-blue-800">Why this score</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {fit.components.map((c) => <li key={c.name}>{c.name}: {c.points} of {c.maxPoints}. {c.explanation}</li>)}
          </ul>
          <SkillList title="Matching skills" items={fit.matchedSkills.map(label)} />
          <SkillList title="Transferable skills" items={fit.transferableSkills.map((t) => `${t.have} counts toward ${label(t.countsToward)}`)} />
          <SkillList title="Not on your resume" items={fit.missingSkills.map(label)} />
          <SkillList title="Required qualifications found" items={required.map((q) => `${q.label} (${QUALIFICATION_LABELS[q.status].toLowerCase()})`)} />
          <SkillList title="Relevant experience" items={fit.relevantExperience} />
          {job.descriptionIsPartial && <p className="mt-2 text-slate-600">Only part of this posting was available, so it may list more requirements.</p>}
        </details>
      )}
      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium text-blue-800 underline">
        Apply (via {job.sources.join(", ")})
      </a>
    </article>
  );
}

export function JobSearchApp() {
  const [mode, setMode] = useState<Mode>("resume");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [skillsText, setSkillsText] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [remote, setRemote] = useState("any");
  const [jobType, setJobType] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [salaryRequired, setSalaryRequired] = useState(false);
  const [minScore, setMinScore] = useState("");
  const [results, setResults] = useState<JobSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploadStatus("Reading your resume...");
    setAnalysis(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/resume/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setUploadStatus(data.error ?? "That resume couldn't be read.");
        return;
      }
      const result = data as ResumeAnalysis;
      setAnalysis(result);
      setSkillsText(result.resume.skills.map((s) => s.name).join(", "));
      setUploadStatus("");
    } catch {
      setUploadStatus("That resume couldn't be read. Please try again.");
    }
  }

  /** The resume as the user last edited it. */
  function editedResume(): Resume | null {
    if (!analysis) return null;
    const original = new Map(analysis.resume.skills.map((s) => [s.name, s]));
    const names = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    return { ...analysis.resume, skills: names.map((name) => original.get(name) ?? { name, source: "manual" }) };
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const resume = mode === "resume" ? editedResume() : null;
    if (mode === "resume" && !resume) {
      setError("Upload a resume first, or switch to Explore All Jobs.");
      return;
    }
    setError("");
    setSearching(true);
    setResults(null);
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, keywords, location, distanceMiles, remote, jobType, minSalary, salaryRequired, minScore: mode === "resume" ? minScore : "", resume }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The search couldn't be completed.");
      else setResults(data as JobSearchResponse);
    } catch {
      setError("The search couldn't be completed. No results are shown because none were received.");
    } finally {
      setSearching(false);
    }
  }

  const toggle = (category: JobCategory) =>
    setCategories((current) => (current.includes(category) ? current.filter((c) => c !== category) : [...current, category]));
  const credited = (results?.sources ?? []).filter((s) => s.attributionUrl);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">WeSearch</h1>
      <div role="tablist" className="mt-4 flex gap-2">
        {([["resume", "AI Resume Matches"], ["explore", "Explore All Jobs"]] as const).map(([value, label]) => (
          <button key={value} role="tab" type="button" aria-selected={mode === value} onClick={() => { setMode(value); setResults(null); setError(""); }}
            className={`rounded-md border px-4 py-2 font-medium ${mode === value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "resume" && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <label htmlFor="resume-file" className="font-semibold">Your resume (PDF)</label>
          <input id="resume-file" type="file" accept="application/pdf" className={fieldClass} onChange={(e) => upload(e.target.files?.[0])} />
          <p role="status" className="mt-2 text-sm text-slate-600">{uploadStatus}</p>
          {analysis && (
            <>
              <label htmlFor="skills" className="mt-2 block font-medium">Skills (edit freely, separated by commas)</label>
              <textarea id="skills" rows={3} className={fieldClass} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
              <div className="mt-2 text-sm text-slate-700">
                <SkillList title="Work experience" items={analysis.resume.experience.map((e) => (e.employer ? `${e.title}, ${e.employer}` : e.title))} />
                <SkillList title="Education" items={analysis.resume.education.map((e) => [e.level.replace("_", " "), e.field, e.institution, e.inProgress ? "in progress" : null].filter(Boolean).join(", "))} />
                <SkillList title="Certifications" items={analysis.resume.certifications} />
                <SkillList title="Projects" items={(analysis.resume.projects ?? []).map((p) => p.slice(0, 80))} />
                <SkillList title="Transferable skills" items={[...new Set(analysis.transferableSkills.map((t) => t.countsToward))]} />
                <SkillList title="Suggested categories" items={analysis.suggestedCategories} />
              </div>
              <p className="mt-2 text-sm text-slate-600">Please check this: it&apos;s read by rules, so it can miss things. You can also pick any category below, even one your resume doesn&apos;t suggest.</p>
            </>
          )}
        </section>
      )}

      <form onSubmit={search} className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{mode === "resume" ? "Search (leave blank to use your resume's suggestions)" : "What are you looking for?"}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((category) => (
            <label key={category} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${categories.includes(category) ? "border-blue-700 bg-blue-50" : "border-slate-300"}`}>
              <input type="checkbox" className="mr-2" checked={categories.includes(category)} onChange={() => toggle(category)} />
              {category}
            </label>
          ))}
        </div>
        <label htmlFor="keywords" className="mt-4 block text-sm font-medium">Keywords or company, separated by commas</label>
        <input id="keywords" className={fieldClass} placeholder="Cashier, Crew Member, Part-Time, Paid Internship" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label htmlFor="location" className="text-sm font-medium">Location</label><input id="location" className={fieldClass} placeholder="Chicago, IL" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><label htmlFor="distance" className="text-sm font-medium">Distance (miles)</label><input id="distance" type="number" min="1" className={fieldClass} value={distanceMiles} onChange={(e) => setDistanceMiles(e.target.value)} /></div>
          <div><label htmlFor="remote" className="text-sm font-medium">Remote work</label>
            <select id="remote" className={fieldClass} value={remote} onChange={(e) => setRemote(e.target.value)}><option value="any">Any</option><option value="only">Remote only</option><option value="exclude">No remote</option></select></div>
          <div><label htmlFor="type" className="text-sm font-medium">Job type</label>
            <select id="type" className={fieldClass} value={jobType} onChange={(e) => setJobType(e.target.value)}><option value="">Any</option>{Object.entries(JOB_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><label htmlFor="salary" className="text-sm font-medium">Minimum pay per year ($)</label><input id="salary" type="number" min="0" className={fieldClass} value={minSalary} onChange={(e) => setMinSalary(e.target.value)} /></div>
          {mode === "resume" && <div><label htmlFor="score" className="text-sm font-medium">Minimum fit (%)</label><input id="score" type="number" min="0" max="100" className={fieldClass} value={minScore} onChange={(e) => setMinScore(e.target.value)} /></div>}
        </div>
        <label className="mt-3 block text-sm"><input type="checkbox" className="mr-2" checked={salaryRequired} onChange={(e) => setSalaryRequired(e.target.checked)} />Only jobs that list their pay</label>
        <button type="submit" disabled={searching} className="mt-4 rounded-md bg-blue-700 px-5 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60">
          {searching ? "Searching..." : mode === "resume" ? "Find my matches" : "Search jobs"}
        </button>
      </form>

      {error && <p role="alert" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-amber-900">{error}</p>}

      {results && (
        <section className="mt-4">
          <h2 className="text-xl font-semibold">{results.total} jobs found{results.total > results.matches.length ? `, showing the top ${results.matches.length}` : ""}</h2>
          {results.message && <p className="mt-1">{results.message}</p>}
          {mode === "resume" && results.total > 0 && <p className="mt-1 text-sm text-slate-600">Fit estimates how well your qualifications match a posting. It isn&apos;t a chance of being hired.</p>}
          {results.notes.map((note) => <p key={note} className="mt-1 text-sm text-slate-600">{note}</p>)}
          <details className="mt-1 text-sm text-slate-600">
            <summary className="cursor-pointer">Sources and search terms</summary>
            <ul className="mt-1 list-disc pl-5">{results.sources.map((s) => <li key={s.name}>{s.name}: {s.message}</li>)}</ul>
            {results.relatedTitles.length > 0 && <p className="mt-1">Related titles: {results.relatedTitles.join(", ")}</p>}
          </details>
          <div className="mt-3 space-y-3">{results.matches.map((match) => <JobCard key={match.job.id} match={match} />)}</div>
          {credited.length > 0 && <p className="mt-4 text-sm text-slate-600">Some listings provided by {credited.map((s) => <a key={s.name} href={s.attributionUrl} className="underline" target="_blank" rel="noopener noreferrer">{s.name}</a>)}.</p>}
        </section>
      )}
    </main>
  );
}
