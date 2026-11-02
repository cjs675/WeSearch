import { JOB_CATEGORIES } from "@/types";

// Foundation placeholder. feature/frontend replaces this with the dashboard.
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">WeSearch</h1>
      <p className="mt-2 text-slate-600">
        Project foundation. Resume upload and job search aren&apos;t built yet.
      </p>
      <h2 className="mt-8 text-lg font-semibold">Planned job categories</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {JOB_CATEGORIES.map((category) => (
          <li key={category} className="rounded-full border border-slate-300 px-3 py-1 text-sm">
            {category}
          </li>
        ))}
      </ul>
    </main>
  );
}
