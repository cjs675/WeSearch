import type { Metadata } from "next";
import { JobSearchApp } from "@/features/job-matching/components/JobSearchApp";

export const metadata: Metadata = {
  title: "Search jobs | WeSearch",
  description: "Match your resume to real job listings, or explore jobs without one.",
};

export default function SearchPage() {
  return <JobSearchApp />;
}
