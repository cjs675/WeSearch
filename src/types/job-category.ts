/**
 * Tech subcategories used as filter chips. These scope the app:
 * every listing shown is a tech job, located in Florida or remote.
 */
export const JOB_CATEGORIES = [
  "Software Engineering",
  "Data & AI",
  "DevOps & Cloud",
  "QA",
  "Security",
  "Design",
  "Product",
  "IT & Support",
  "Internships",
  "Other Tech",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
