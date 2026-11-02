# Job matching

Branch: `feature/job-matching`

Takes a `JobSearchRequest` and an optional `Resume`, searches real job APIs, and returns a `JobSearchResponse` from `src/types`. If a source fails or finds nothing, say so in the response. Never show sample listings as real.
