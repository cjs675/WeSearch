# Job matching

Branch: `feature/job-matching`

Searches real job APIs, filters and removes duplicates, then ranks listings against a resume. If a source fails or finds nothing, the response says so. Sample listings are never shown as real.

## Using it

The frontend calls `POST /api/jobs/search` with the fields of `JobSearchRequest`, plus an optional `resume` in the shared `Resume` shape. It gets back a `JobSearchResponse`. Both types are in `src/types`.

```json
{
  "categories": ["Fast Food"],
  "keywords": "cashier, part-time",
  "location": "Chicago, IL",
  "distanceMiles": 25,
  "remote": "any",
  "jobType": "part_time",
  "minSalary": 30000,
  "salaryRequired": false,
  "minScore": 40,
  "maxAgeDays": 90,
  "resume": { "skills": [{ "name": "cash handling", "source": "manual" }], "experience": [], "education": [], "certifications": [], "isStudent": false }
}
```

The frontend must:

- Show each source's `message`, so a failed source is never mistaken for no jobs.
- Credit and link to each source that has an `attributionUrl`. Remotive and Jobicy require this.
- Never put a sign-up or email form in front of Remotive listings. Its terms forbid that.
- Label skills in `skillsTypicalForRole` as typical for the role, and pay with `estimated: true` as an estimate.

## Adding API keys

Without keys, only The Muse, Remotive, and Jobicy are used. They are mostly remote, tech, or a limited set of store jobs. Fast-food and other local searches need Adzuna.

1. Get a free key at https://developer.adzuna.com/signup.
2. Copy `.env.example` to `.env.local`.
3. Fill in `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`, then restart the app.

USAJOBS keys are optional and add government listings.

## Testing

```bash
npm test
```

This runs logic tests with made-up inputs. To test against the live APIs, start the app with `npm run dev`, then in a second Terminal window run:

```bash
node scripts/verify-job-matching.mjs "Chicago, IL"
```

## How results are decided

1. A listing must fit the selected categories and keywords. Category fit comes from the title, employer, and the board's label, not from a passing mention in the description.
2. Fitting listings are ranked by keyword fit, then compatibility score, then date.
3. With no category or keyword, the resume's own and transferable categories are searched. A resume with no work history gets internships and entry-level roles.

The score adds up to 100: skills 45, experience 25, level fit 15, qualifications 15. Transferable skills earn 60% credit. Skills typical for a role but not stated in the posting count half. A missing mandatory qualification costs 8 points and is flagged, but never removes the job.

## Known limits

- Adzuna returns only a snippet of each posting, so requirements can be missed. `descriptionIsPartial` marks these.
- Adzuna's apply link goes through Adzuna to reach the posting. It isn't always the employer's own page.
- Distance is only applied by Adzuna and USAJOBS. Other sources match on city name or remote.
- Listings older than 90 days are hidden by default, because many of The Muse's are over a year old.
- The Muse has no text search, so it only contributes when a category applies.
- Adzuna and USAJOBS field mapping is written from their documentation, and hasn't yet been run against the live APIs.
