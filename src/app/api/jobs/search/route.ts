import { NextResponse } from "next/server";
import { searchJobs } from "@/features/job-matching/search";
import type { JobSearchRequest, Resume } from "@/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobSearchRequest: JobSearchRequest = body.request || {
      keywords: [],
      categories: [],
    };
    const resume: Resume | undefined = body.resume;

    const response = await searchJobs(jobSearchRequest, resume);
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      {
        matches: [],
        sources: [],
        message: `Failed to search jobs: ${message}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || "";
    const location = url.searchParams.get("location") || "";
    const category = url.searchParams.get("category");

    const jobSearchRequest: JobSearchRequest = {
      keywords: query ? [query] : [],
      location: location || undefined,
      categories: category ? [category as any] : [],
    };

    const response = await searchJobs(jobSearchRequest);
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      {
        matches: [],
        sources: [],
        message: `Failed to search jobs: ${message}`,
      },
      { status: 500 }
    );
  }
}
