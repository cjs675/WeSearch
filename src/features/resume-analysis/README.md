# Resume analysis

Branch: `feature/resume-analysis`

Takes an uploaded PDF, extracts skills and qualifications, and returns a `ResumeAnalysis` from `src/types`. Only report what the resume supports.

`parser.ts` is a rule-based reader added from `feature/job-matching` so the app works end to end with no API keys. Replace or extend it here, and keep returning the same shape.
