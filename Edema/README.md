# Edema — resume analyzer

Resume processing, skill identification and career keyword generation for the scout job search app.

Upload a PDF resume and get back structured resume data, hard / soft / transferable skills, suggested job categories, search keywords and alternative job titles. Built for everyone from high school students with no work history to experienced workers.

Same stack as the team's `job-search` app: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, pnpm.

## Run it

```bash
cd Edema
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # 45 tests
pnpm build
```

No configuration is needed. AI analysis is optional — see `.env.example`.

## API

### `POST /api/resume/analyze`

**Upload a PDF** (`multipart/form-data`):

| Field | Required | |
|---|---|---|
| `file` | yes (or `text`) | PDF, max 5 MB |
| `text` | | Plain resume text instead of a file |
| `manualSkills` | | JSON array (`["Excel", {"name":"Latte art","type":"hard"}]`) or comma list |
| `removedSkills` | | JSON array or comma list of skill names to drop |
| `useAI` | | `"false"` to skip AI for this request |

```bash
curl -F file=@resume.pdf http://localhost:3000/api/resume/analyze
```

**Re-analyse after edits** (`application/json`): send the `resume` object from a previous response, changed however the user likes.

```json
{ "resume": { ...edited ResumeData... }, "manualSkills": ["Forklift"], "removedSkills": ["Teamwork"] }
```

`{ "text": "..." }` also works for pasted text.

**Response** (full types in `lib/resume/types.ts`):

```jsonc
{
  "resume": { "contact", "summary", "education", "experience", "projects", "certifications",
              "listedSkills", "awards", "activities", "languages", "coursework", "otherSections" },
  "skills": {
    "hard": [{ "name": "Food preparation", "type": "hard", "transferable": false, "source": "resume",
               "evidence": [{ "text": "Helped with food preparation…", "where": "Experience · Cashier, Taco Bell" }] }],
    "soft": [...],
    "transferable": [...]          // hard or soft skills that carry across jobs
  },
  "credentials": [{ "id": "cpr", "name": "CPR / First Aid", "evidence": [...] }],
  "applicant": { "stage": "high_school_student", "flags": [...], "hasWorkExperience": true,
                 "yearsOfExperience": 2.5, "highestCompletedEducation": "none_listed", "notes": [...] },
  "suggestedCategories": [{ "category": "Fast Food", "score": 100, "reasons": ["Past role: Cashier", ...] }],
  "searchKeywords": ["Crew Member", "Cashier", "Team Member", "Food Service Worker", ...],
  "alternativeJobTitles": [...],   // titles they haven't already held
  "searchFilters": ["Part time", "Entry level", ...],
  "meta": { "analysisMode": "rules" | "ai+rules", "source": "pdf" | "text" | "edited", "warnings": [...] }
}
```

Errors return `{ "error": { "code", "message" } }`: `400` missing/bad input, `413` over 5 MB, `415` not a PDF, `422` PDF unreadable / password-protected / scanned image with no text.

## How it works

```
PDF ──unpdf──▶ text lines ──parse.ts──▶ ResumeData ──▶ corpus lines (labelled by section)
                                                         │
                     skills.ts (dictionary match) ◀──────┤
                     ai.ts (optional, grounded)  ◀───────┘
                                │
              careers.ts: categories ▶ job titles ▶ search keywords
```

| File | Purpose |
|---|---|
| `lib/resume/pdf.ts` | PDF → text, rebuilding lines from text positions so right-aligned dates stay with their job |
| `lib/resume/parse.ts` | Finds sections and splits them into jobs, schools, projects; pulls contact info |
| `lib/resume/dates.ts` | Reads date ranges ("Jun 2023 – Present", "06/2021 - 08/2022", "Class of 2028") |
| `lib/resume/skills-dictionary.ts` | ~120 skills and ~20 credentials with match phrases and category weights |
| `lib/resume/skills.ts` | Detects skills with evidence; handles manual adds and removals |
| `lib/resume/careers.ts` | Scores the 16 job categories, picks job titles, builds keywords |
| `lib/resume/ai.ts` | Optional AI pass via any OpenAI-compatible endpoint (Ollama + Gemma by default) |
| `lib/resume/analyze.ts` | Ties it together; works out applicant stage and years of experience |
| `app/api/resume/analyze/route.ts` | The endpoint |
| `app/page.tsx`, `components/` | Upload page and editor, styled to match `job-search` |

## Never inventing qualifications

- Every extracted field is copied from the resume text. Missing fields stay empty.
- Every skill carries the resume line it came from (`evidence`). Skills the user typed are marked `source: "user"`.
- Employer and school names are never skill evidence ("Ida Baker High School" is not baking).
- Job titles that need a credential — CNA, Pharmacy Technician, Security Officer, Forklift Operator, Delivery Driver, CDL Driver, Substitute Teacher… — are only suggested when the resume shows that credential or a matching past job.
- AI output is filtered: a skill is kept only if the line it quotes really is in the resume; titles or skills that claim a license the resume doesn't mention are dropped; the AI can't change extracted resume data. Contact details are never sent to the AI.
- Tests check all of this against every sample resume (`tests/analyze.test.ts`, `tests/ai.test.ts`).

## Applicants with little or no experience

Skills are found anywhere on the resume — volunteering, sports, clubs, school projects — not just jobs. The analyzer flags `no_work_experience`, `high_school_student`, `college_student` and `recent_graduate`, adds entry-level-friendly categories (marked `entryLevelSuggestion`), always shows Internships to college students and new grads, and suggests filters like "Part time" and "No experience required".

## Extending

- **New skill:** add an entry to `SKILLS` in `skills-dictionary.ts` with `terms`, and `categories` weights.
- **New job title:** add it under its category in `TITLES` in `careers.ts`. Use `credentials` / `heldTitle` if it needs a license.
- Sample resumes for tests live in `tests/fixtures/`.
