"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXAMPLE_QUESTIONS } from "@/lib/exampleQuestions";

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

  const examples = useMemo(() => EXAMPLE_QUESTIONS, []);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-900/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-400 text-xs font-bold text-white shadow-sm ring-1 ring-zinc-900/10">
              TD
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-zinc-900">
                Trusted Data Question Workspace
              </div>
              <div className="text-xs text-zinc-600">
                Prototype: question → trusted dataset recommendation
              </div>
            </div>
          </div>
          <div className="text-xs text-zinc-600">Mock catalog • Explainable scoring</div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
            <div className="max-w-2xl">
              <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-900">
                Start with the question. Get a trusted dataset with an audit trail.
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                This prototype simulates an enterprise metadata layer (owner, steward, certification,
                freshness, quality checks, lineage, downstream usage, governance) and ranks the
                best dataset for your intent — with transparent reasoning.
              </p>
            </div>

            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const q = question.trim();
                if (!q) return;
                router.push(`/results?q=${encodeURIComponent(q)}`);
              }}
            >
              <label className="text-xs font-medium text-zinc-700">
                Business / data question
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder='e.g. "Which revenue dataset should I trust for QBR reporting?"'
                  className="h-12 w-full rounded-xl border border-zinc-900/10 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none ring-0 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
                >
                  Find trusted data
                </button>
              </div>
              <div className="mt-3 text-xs text-zinc-600">
                No warehouse connection. Everything is mocked — the goal is product clarity and
                believable governance/trust logic.
              </div>
            </form>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-700">Example questions</div>
                <div className="text-xs text-zinc-500">Click to load</div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {examples.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setQuestion(ex.question)}
                    className="rounded-xl border border-zinc-900/10 bg-white p-3 text-left transition hover:bg-zinc-50"
                  >
                    <div className="text-xs font-semibold text-zinc-900">{ex.label}</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-600">{ex.question}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold text-zinc-900">What this prototype is optimizing for</div>
            <ul className="mt-3 space-y-3 text-sm text-zinc-700">
              <li>
                <div className="text-xs font-semibold text-zinc-900">Fast decision-making</div>
                <div className="mt-1 text-xs leading-5 text-zinc-600">
                  Reduce “which table do we trust?” back-and-forth by making the first recommendation defensible.
                </div>
              </li>
              <li>
                <div className="text-xs font-semibold text-zinc-900">Explainability over magic</div>
                <div className="mt-1 text-xs leading-5 text-zinc-600">
                  Every score component is visible. You can see exactly what drove the recommendation.
                </div>
              </li>
              <li>
                <div className="text-xs font-semibold text-zinc-900">Governance-aware guidance</div>
                <div className="mt-1 text-xs leading-5 text-zinc-600">
                  “Trusted” includes freshness, checks, lineage, and policy fit — not just popularity.
                </div>
              </li>
            </ul>
          </aside>
        </div>

        <footer className="flex flex-col gap-2 border-t border-zinc-900/10 pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <div>Designed as a narrow, believable first bet for trusted data decisions.</div>
          <div>Tip: try “revenue QBR” or “WAU executive dashboard”.</div>
        </footer>
      </main>
    </div>
  );
}
