# Job matching

Branch: `feature/job-matching`

Finds real listings on public job feeds, filters them, removes duplicates, and ranks them against a resume. It needs no API keys or accounts. If a source fails or finds nothing, the response says so. Sample listings are never shown as real.

The home page has two modes: **AI Resume Matches** uses an uploaded PDF, and **Explore All Jobs** needs no resume.

## Using the API

`POST /api/jobs/search` takes the fields of `JobSearchRequest`, plus an optional `resume` in the shared `Resume` shape. It returns a `JobSearchResponse`. Both types are in `src/types`.

```json
{
  "categories": ["Fast Food"],
  "keywords": "cashier, part-time",
  "location": "Chicago, IL",
  "remote": "any",
  "jobType": "part_time",
  "minSalary": 30000,
  "minScore": 40,
  "resume": { "skills": [{ "name": "cash handling", "source": "manual" }], "experience": [], "education": [], "certifications": [], "isStudent": false }
}
```

Resume reading is covered in `src/features/resume-analysis/README.md`. Its `matchingResume` field is what goes in `resume` here.

Any page using these must:

- Show each source's `message`, so a failed source is never mistaken for no jobs.
- Credit and link to each source that has an `attributionUrl`. Jobicy and Remote OK require this.
- Label skills in `skillsTypicalForRole` as typical for the role.

## Job sources

| Source | Why it's allowed |
|---|---|
| Greenhouse boards | Its docs say job board data is public and needs no authentication |
| Lever boards | `robots.txt` allows it, with a 1-second delay that the app follows |
| Ashby boards | It publishes no `robots.txt` rules for this API |
| The Muse | `robots.txt` allows its public jobs API |
| Jobicy | `robots.txt` allows its API, and it asks for credit and a link |
| Remote OK | `robots.txt` allows it, and its terms ask for credit and a followed link |

**Not used, because `robots.txt` blocks automated access:** SmartRecruiters' API, Remotive's API, and the USAJOBS API. Arbeitnow is allowed but mostly lists European jobs, so it isn't used. Don't work around these. Sites like Indeed and LinkedIn aren't used either.

Every request checks `robots.txt` first, so a site that starts blocking access is skipped and reported on its own.

To add an employer on Greenhouse, Lever, or Ashby, add a line to `sources/employers.json`. To add a website, write an adapter like `sources/muse.ts` and list it in `sources/index.ts`. Removing one from that list doesn't affect the others.

## Testing

```bash
npm test
```

This runs logic tests with made-up inputs. To test against the live sources, start the app with `npm run dev`, then in a second Terminal window run:

```bash
node scripts/verify-job-matching.mjs "Chicago, IL"
```

## How results are decided

1. A listing must fit the selected categories and keywords. Category fit comes from the title and employer, not from a passing mention in the description.
2. Fitting listings are ranked by keyword fit, then compatibility score, then date.
3. With no category or keyword, the resume's own and transferable categories are searched. A resume with no work history gets internships and entry-level roles.

The score estimates how well a resume fits a posting's stated qualifications. It isn't a chance of being hired. It adds up to 100: skills 45, experience 25, level fit 15, qualifications 15. Transferable skills earn 60% credit. Skills typical for a role but not stated in the posting count half. A missing mandatory qualification costs 8 points and is flagged, but never removes the job.

## Known limits

- **Coverage is limited to the employers listed.** This doesn't search the whole web, and it isn't nationwide coverage. Most major fast-food, grocery, and big-box chains don't publish a feed this app is allowed to read.
- **No government feed.** The USAJOBS API is blocked by `robots.txt` and needs a key, so Government results are rare.
- **Distance is approximate.** Sources don't give coordinates, so a distance filter shows the same city, the same state, or remote.
- **Listing age.** Listings from The Muse and Jobicy older than 90 days are hidden. Listings on live employer boards are hidden after a year, since older ones tend to be standing ads.
- **Resume reading** is rule-based by default, so unusual layouts can be misread and scanned PDFs can't be read. People can edit the skills it finds.
