import { JOB_CATEGORIES } from "@/types";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">WeSearch</h1>
      <p className="mt-2 text-slate-600">Match your resume to real job listings, or explore jobs without one.</p>
      <a href="/search" className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800">
        Search jobs
      </a>
      <h2 className="mt-8 text-lg font-semibold">Job categories</h2>
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
