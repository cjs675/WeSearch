# Resume analysis

Takes a PDF or pasted text and returns what the resume supports, without inventing anything. It's Dio's analyzer from the `Dio-resume-analyzer` branch.

`POST /api/resume/analyze` takes a PDF as a form field named `file`, or JSON with `text`. It returns an `AnalysisResult` (see `types.ts`), plus `matchingResume`: the shared `Resume` that the job search reads, built by `to-shared-resume.ts`.

It runs on rules and needs no setup. An AI pass is optional and stays off unless `RESUME_AI_PROVIDER` is set (see `.env.example`). With a remote provider, resume text is sent to that service, so prefer a local one like Ollama.
