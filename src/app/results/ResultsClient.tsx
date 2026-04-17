"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { recommendDatasets } from "@/lib/recommend";
import type { Recommendation, RecommendationLabel, ScoreBreakdown } from "@/lib/types";

function labelStyles(label: RecommendationLabel) {
  if (label === "Recommended") return "bg-emerald-600 text-white";
  if (label === "Use with caution") return "bg-amber-600 text-white";
  return "bg-rose-600 text-white";
}

function scorePill(total: number) {
  const bg =
    total >= 78
      ? "bg-emerald-600/10 ring-emerald-600/20"
      : total >= 55
        ? "bg-amber-600/10 ring-amber-600/20"
        : "bg-rose-600/10 ring-rose-600/20";
  const text =
    total >= 78 ? "text-emerald-900" : total >= 55 ? "text-amber-900" : "text-rose-900";
  return `${bg} ${text}`;
}

function ScoreRow({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="grid grid-cols-[120px_1fr_52px] items-center gap-3">
      <div className="text-xs text-zinc-700">
        {label}
        {hint ? <span className="ml-1 text-zinc-500">({hint})</span> : null}
      </div>
      <div className="h-2 rounded-full bg-zinc-900/10">
        <div className="h-2 rounded-full bg-zinc-900/50" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs text-zinc-700 tabular-nums">
        {value}/{max}
      </div>
    </div>
  );
}

function buildDecisionMemo(question: string, rec: Recommendation) {
  const ds = rec.dataset;
  const governance = ds.governanceTags.length ? ds.governanceTags.join(", ") : "None";
  const pii = ds.containsPii ? "Yes" : "No";
  const lines = [
    "Trusted Data Decision Memo",
    "--------------------------",
    `Question: ${question}`,
    `Recommendation: ${ds.name} (${rec.label}, score ${rec.score.total}/100)`,
    "",
    "Why this dataset",
    `- ${rec.whyThisRecommendation}`,
    "",
    "Trust signals",
    `- Certification: ${ds.certification}`,
    `- Owner: ${ds.owner}`,
    `- Steward: ${ds.steward}`,
    `- Freshness SLA: ${ds.freshnessSla} (last updated ${new Date(ds.lastUpdatedAt).toISOString()})`,
    `- Lineage completeness: ${ds.lineageCompletenessScore}/100`,
    `- Downstream usage: ${ds.downstreamUsage.dashboards} dashboards, ${ds.downstreamUsage.models} models`,
    `- Governance tags: ${governance} (contains PII: ${pii})`,
    "",
    "Caveats",
    ...rec.caveats.map((c) => `- ${c}`),
    "",
    "Next action",
    ...rec.nextActions.map((a) => `- ${a}`),
  ];
  return lines.join("\n");
}

function TrustSignal({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-zinc-900/10 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium text-zinc-500">{k}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{v}</div>
    </div>
  );
}

function formatUseCases(useCases: string[]) {
  return useCases
    .map((u) => u.replaceAll("_", " "))
    .map((u) => u.replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" • ");
}

function ScoreTable({ s }: { s: ScoreBreakdown }) {
  return (
    <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">Score breakdown</div>
        <div className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${scorePill(s.total)}`}>
          Total {s.total}/100
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <ScoreRow label="Semantic fit" value={s.semanticMatch} max={30} hint="keywords + name" />
        <ScoreRow label="Trust" value={s.trust} max={25} hint="certification + category" />
        <ScoreRow label="Freshness" value={s.freshness} max={15} hint="SLA vs last update" />
        <ScoreRow label="Quality" value={s.quality} max={15} hint="checks pass/warn/fail" />
        <ScoreRow label="Lineage" value={s.lineage} max={10} hint="completeness" />
        <ScoreRow
          label="Governance fit"
          value={Math.max(0, s.governanceFit)}
          max={10}
          hint="policy alignment"
        />
        <ScoreRow label="Adoption" value={s.usage} max={10} hint="dashboards/models" />
        <div className="grid grid-cols-[120px_1fr_52px] items-center gap-3">
          <div className="text-xs text-zinc-700">Penalties</div>
          <div className="h-2 rounded-full bg-zinc-900/10">
            <div
              className="h-2 rounded-full bg-rose-600/40"
              style={{ width: `${Math.min(100, Math.abs(s.penalties) * 5)}%` }}
            />
          </div>
          <div className="text-right text-xs text-zinc-700 tabular-nums">{s.penalties}</div>
        </div>
      </div>
      <div className="mt-4 text-xs leading-5 text-zinc-600">
        Scoring is intentionally simple and transparent. It is not an “AI answer” — it is a
        trust-aware ranking of a mock catalog.
      </div>
    </div>
  );
}

export function ResultsClient({ question }: { question: string }) {
  const q = (question ?? "").trim();
  const result = useMemo(() => (q ? recommendDatasets(q) : null), [q]);
  const ranked = result?.ranked ?? [];

  const [selectedId, setSelectedId] = useState<string>(ranked[0]?.dataset.id ?? "");
  const selected = ranked.find((r) => r.dataset.id === selectedId) ?? ranked[0];
  const top = ranked[0];
  const alternatives = ranked.slice(1, 3);

  // Intentionally computed without memoization to keep lint/React compiler predictable.
  // Cost is trivial (small string build) and improves reliability.
  const memo = q && selected ? buildDecisionMemo(q, selected) : "";

  if (!q) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">No question provided</div>
          <div className="mt-2 text-sm text-zinc-700">
            Go back and enter a business question to get a trusted dataset recommendation.
          </div>
          <div className="mt-5">
            <Link className="text-sm font-semibold text-amber-700 hover:text-amber-800" href="/">
              ← Back to question entry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!selected || !top) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">No recommendations</div>
          <div className="mt-2 text-sm text-zinc-700">
            Try a more specific question (e.g., “WAU executive dashboard”).
          </div>
          <div className="mt-5">
            <Link className="text-sm font-semibold text-amber-700 hover:text-amber-800" href="/">
              ← Back to question entry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ds = selected.dataset;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-900/10 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-900">Recommendation results</div>
            <div className="mt-1 text-xs text-zinc-600">
              Intent inferred: {result?.intent.replaceAll("_", " ")}
            </div>
          </div>
          <Link className="text-xs font-semibold text-amber-700 hover:text-amber-800" href="/">
            ← New question
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-6 py-8 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-medium text-zinc-500">Question</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">{q}</div>
            <div className="mt-3 text-xs text-zinc-600">
              Ranked against {ranked.length} datasets using trust + governance heuristics.
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900/10 bg-white p-2 shadow-sm">
            <div className="px-3 pt-3 text-xs font-semibold text-zinc-900">Ranked datasets</div>
            <div className="mt-2">
              {ranked.slice(0, 6).map((r, idx) => (
                <button
                  key={r.dataset.id}
                  onClick={() => setSelectedId(r.dataset.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition ${
                    r.dataset.id === selectedId
                      ? "bg-amber-50 ring-1 ring-amber-200"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-500">#{idx + 1}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-zinc-900">
                        {r.dataset.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">
                        {r.summary}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${labelStyles(r.label)}`}>
                        {r.label}
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${scorePill(r.score.total)}`}>
                        {r.score.total}/100
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-lg font-semibold text-zinc-900">{ds.name}</div>
                  <div className={`rounded-full px-2 py-1 text-xs font-semibold ${labelStyles(selected.label)}`}>
                    {selected.label}
                  </div>
                </div>
                <div className="mt-2 text-sm leading-6 text-zinc-700">{ds.description}</div>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${scorePill(selected.score.total)}`}>
                  Score {selected.score.total}/100
                </div>
                <div className="text-xs text-zinc-600">
                  {ds.businessDomain} • {ds.category} • {ds.certification}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <TrustSignal k="Owner" v={ds.owner} />
              <TrustSignal k="Steward" v={ds.steward} />
              <TrustSignal
                k="Freshness"
                v={`${ds.freshnessSla} (updated ${new Date(ds.lastUpdatedAt).toLocaleString()})`}
              />
              <TrustSignal k="Lineage completeness" v={`${ds.lineageCompletenessScore}/100`} />
              <TrustSignal
                k="Downstream usage"
                v={`${ds.downstreamUsage.dashboards} dashboards • ${ds.downstreamUsage.models} models`}
              />
              <TrustSignal
                k="Governance"
                v={`${ds.governanceTags.join(", ") || "None"} • PII: ${ds.containsPii ? "Yes" : "No"}`}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Why this recommendation</div>
                <div className="mt-2 text-sm leading-6 text-zinc-700">{selected.whyThisRecommendation}</div>
                <div className="mt-4">
                  <div className="text-xs font-semibold text-zinc-900">Key rationale</div>
                  <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                    {selected.rationaleBullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-500/70" />
                        <span className="leading-6">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <ScoreTable s={selected.score} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Caveats & risks</div>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {selected.caveats.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-500/70" />
                    <span className="leading-6">{c}</span>
                  </li>
                ))}
              </ul>
              {ds.policyNotes ? (
                <div className="mt-4 rounded-xl border border-zinc-900/10 bg-amber-50 p-4">
                  <div className="text-xs font-semibold text-zinc-900">Policy notes</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-700">{ds.policyNotes}</div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Next actions</div>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {selected.nextActions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-500/70" />
                    <span className="leading-6">{a}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-zinc-600">
                Approved use cases: {formatUseCases(ds.approvedUseCases)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Why not the alternatives?</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Alternatives are valid in specific contexts, but carry higher risk for this question.
                </div>
              </div>
              <div className="text-xs text-zinc-600">Top pick: {top.dataset.name}</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {alternatives.map((alt) => (
                <div key={alt.dataset.id} className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">{alt.dataset.name}</div>
                      <div className="mt-1 text-xs leading-5 text-zinc-600">{alt.summary}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${labelStyles(alt.label)}`}>
                        {alt.label}
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${scorePill(alt.score.total)}`}>
                        {alt.score.total}/100
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-zinc-900">Why not chosen</div>
                    <ul className="mt-2 space-y-2 text-xs text-zinc-700">
                      {(alt.whyNotChosen ?? ["Lower overall trust posture for this intent."]).map((r) => (
                        <li key={r} className="flex gap-2">
                          <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-rose-600/40" />
                          <span className="leading-5">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Shareable decision memo</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Copy/paste into Slack, a ticket, or a PR description to document the decision.
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-500"
                onClick={async () => {
                  await navigator.clipboard.writeText(memo);
                }}
              >
                Copy memo
              </button>
            </div>
            <pre className="mt-4 max-h-[320px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-900/10 bg-zinc-50 p-4 text-xs leading-5 text-zinc-900">
{memo}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}

