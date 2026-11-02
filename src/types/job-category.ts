export const JOB_CATEGORIES = [
  "Fast Food",
  "Retail",
  "Restaurants",
  "Warehouse",
  "Customer Service",
  "Internships",
  "Office",
  "Healthcare",
  "Security",
  "Skilled Trades",
  "Technology",
  "Government",
  "Education",
  "Hospitality",
  "Delivery",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
