# WeSearch

An AI resume-to-job matching app. Upload a PDF resume, review the skills it finds, search real job listings by keyword or category, and see an explained compatibility score with a direct link to apply.

## Setup

You need [Node.js](https://nodejs.org) version 20.9 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. No API keys or accounts are needed. See `src/features/job-matching/README.md` and `src/features/resume-analysis/README.md` for how search and resume reading work.

Other useful commands:

```bash
npm run typecheck
```

```bash
npm run build
```

```bash
npm test
```

## Who works where

| Branch | Owns | Delivers |
|---|---|---|
| `feature/frontend` | `src/app`, `src/components` | Responsive dashboard, PDF upload screen, manual skill editing, search and category controls, results with apply links |
| `feature/resume-analysis` | `src/features/resume-analysis` | PDF reading, AI analysis, skills and qualifications extraction |
| `feature/job-matching` | `src/features/job-matching` | Real job API integrations, filtering, duplicate removal, compatibility scoring |

Staying in your own folders keeps merge conflicts rare.

`src/types` is shared by everyone, and it's how the three parts fit together. Agree with your teammates before changing it, and make those changes in a small commit of their own.

## Working on your branch

1. Get your branch: `git checkout feature/your-branch`
2. Save your work: `git add <files>`, then `git commit -m "what you changed"`
3. Share it: `git push`
4. Pick up foundation updates: `git merge BigDillo`

When a feature works, open a pull request into `BigDillo`. Run `npm run build` first to catch errors.

## Project rules

- Show only real listings. If a job API fails or returns nothing, say so, and never use sample data in its place.
- Never make up qualifications or skills.
- Never commit API keys.
- Only read sources that allow automated access. Respect `robots.txt`, and never work around a block.
