import type {
  Dataset,
  QuestionIntent,
  Recommendation,
  RecommendationLabel,
  RecommendationResult,
  ScoreBreakdown,
} from "@/lib/types";
import { DATASETS } from "@/lib/datasets";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function daysSince(iso: string, now = new Date()) {
  const d = new Date(iso);
  return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
}

function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function inferIntent(question: string): QuestionIntent {
  const t = tokenize(question);
  const hasAny = (...words: string[]) => words.some((w) => t.includes(w));

  if (hasAny("qbr", "board", "exec", "executive", "cfo", "ceo")) return "executive_reporting";
  if (hasAny("forecast", "pipeline")) return "qbr_reporting";
  if (hasAny("model", "modeling", "train", "training", "ml", "prediction", "churn"))
    return "ml_modeling";
  if (hasAny("reconcile", "reconciliation", "ledger", "invoice", "billing")) return "finance_reconciliation";
  if (hasAny("experiment", "ab", "a/b", "test", "variant", "exposure")) return "experimentation";
  if (hasAny("support", "tickets", "sla", "csat")) return "support_ops";
  if (t.length > 0) return "self_serve_analytics";
  return "unknown";
}

function semanticScore(questionTokens: string[], dataset: Dataset) {
  const keywords = dataset.semanticKeywords.map((k) => k.toLowerCase());
  const nameBits = dataset.name.toLowerCase().split(/[._]/g);
  const textBag = new Set([...keywords, ...nameBits]);

  let matched: string[] = [];
  for (const token of questionTokens) {
    if (token.length < 3) continue;
    if ([...textBag].some((k) => k.includes(token))) matched.push(token);
  }
  matched = Array.from(new Set(matched));

  // 0..30. Cap matches to keep explainable and avoid overfitting.
  const score = clamp(matched.length * 6, 0, 30);
  return { score, matched };
}

function trustScore(dataset: Dataset) {
  const base =
    dataset.certification === "certified"
      ? 25
      : dataset.certification === "curated"
        ? 18
        : dataset.certification === "in_review"
          ? 12
          : dataset.certification === "uncertified"
            ? 6
            : 0;

  const categoryPenalty = dataset.category === "raw" ? -4 : 0;
  return clamp(base + categoryPenalty, 0, 25);
}

function freshnessScore(dataset: Dataset, now = new Date()) {
  const d = daysSince(dataset.lastUpdatedAt, now);
  const sla = dataset.freshnessSla;

  // 0..15. Simple heuristic: compare age to SLA expectation.
  // hourly: good if < 3h; daily: < 36h; weekly: < 9d; monthly: < 40d; ad_hoc: mostly neutral.
  const hours = d * 24;
  let score = 8;
  if (sla === "hourly") score = hours <= 3 ? 15 : hours <= 12 ? 10 : 3;
  if (sla === "daily") score = hours <= 36 ? 15 : hours <= 72 ? 9 : 3;
  if (sla === "weekly") score = d <= 9 ? 12 : d <= 14 ? 7 : 2;
  if (sla === "monthly") score = d <= 40 ? 10 : 3;
  if (sla === "ad_hoc") score = 7;
  return clamp(score, 0, 15);
}

function qualityScore(dataset: Dataset) {
  // 0..15. Pass helps; fail is a big hit; warn is a small hit.
  let score = 10;
  for (const qc of dataset.qualityChecks) {
    if (qc.status === "pass") score += 1.2;
    if (qc.status === "warn") score -= 1.2;
    if (qc.status === "fail") score -= 5;
  }
  return clamp(Math.round(score), 0, 15);
}

function lineageScore(dataset: Dataset) {
  // 0..10 proportional.
  return clamp(Math.round((dataset.lineageCompletenessScore / 100) * 10), 0, 10);
}

function governanceFit(dataset: Dataset, intent: QuestionIntent) {
  // -10..10. Penalize obvious mismatch: PII/restricted for exec or self-serve.
  let score = 6;
  const isRestricted = dataset.governanceTags.includes("Restricted") || dataset.governanceTags.includes("PCI");

  if (intent === "executive_reporting" || intent === "qbr_reporting") {
    if (dataset.containsPii) score -= 6;
    if (isRestricted) score -= 6;
  }

  if (intent === "ml_modeling") {
    // ML use cases sometimes require restricted datasets, but enforce "approvedUseCases".
    score += dataset.approvedUseCases.includes("ml_modeling") ? 4 : -8;
  }

  if (intent === "finance_reconciliation") {
    score += dataset.approvedUseCases.includes("finance_reconciliation") ? 4 : -6;
  }

  if (intent === "experimentation") {
    score += dataset.approvedUseCases.includes("experimentation") ? 4 : -3;
  }

  if (intent === "support_ops") {
    score += dataset.approvedUseCases.includes("support_ops") ? 4 : -3;
  }

  if (intent === "self_serve_analytics") {
    score += dataset.approvedUseCases.includes("self_serve_analytics") ? 3 : -2;
    if (dataset.containsPii) score -= 3;
    if (isRestricted) score -= 4;
  }

  return clamp(score, -10, 10);
}

function usageScore(dataset: Dataset) {
  // 0..10 with diminishing returns. "Production usage" proxy.
  const { dashboards, models, queryWeeklyActiveUsers } = dataset.downstreamUsage;
  const raw = dashboards * 1.2 + models * 1.0 + Math.log10(1 + queryWeeklyActiveUsers) * 3.2;
  return clamp(Math.round(raw), 0, 10);
}

function penalties(dataset: Dataset, intent: QuestionIntent) {
  let p = 0;
  const failed = dataset.qualityChecks.some((q) => q.status === "fail");
  if (failed) p -= 10;

  if (dataset.category === "raw" && (intent === "executive_reporting" || intent === "qbr_reporting"))
    p -= 10;

  if (dataset.certification === "deprecated") p -= 20;

  // If a curated/certified option exists in the same "concept space", penalize raw a bit more.
  if (dataset.category === "raw") p -= 4;

  // If not approved for inferred use case, penalize hard.
  const intentToUseCase: Record<QuestionIntent, Dataset["approvedUseCases"][number] | null> = {
    executive_reporting: "executive_reporting",
    qbr_reporting: "qbr_reporting",
    self_serve_analytics: "self_serve_analytics",
    ml_modeling: "ml_modeling",
    finance_reconciliation: "finance_reconciliation",
    experimentation: "experimentation",
    support_ops: "support_ops",
    unknown: null,
  };
  const expected = intentToUseCase[intent];
  if (expected && !dataset.approvedUseCases.includes(expected)) p -= 8;

  return p; // negative or 0
}

function labelFromScore(total: number): RecommendationLabel {
  if (total >= 78) return "Recommended";
  if (total >= 55) return "Use with caution";
  return "Not recommended";
}

function buildSummary(dataset: Dataset, label: RecommendationLabel, matched: string[]) {
  const certPhrase =
    dataset.certification === "certified"
      ? "certified"
      : dataset.certification === "curated"
        ? "curated"
        : dataset.certification === "in_review"
          ? "in review"
          : dataset.certification;

  const usage = dataset.downstreamUsage.dashboards;
  const usagePhrase =
    usage >= 6 ? `already powers ${usage} production dashboards` : usage >= 1 ? `is used in ${usage} dashboard(s)` : "has limited downstream usage";

  const keywordHint = matched.length ? `Matches: ${matched.slice(0, 3).join(", ")}.` : "";

  if (label === "Recommended") {
    return `Best fit because it is ${certPhrase}, refreshed ${dataset.freshnessSla}, and ${usagePhrase}. ${keywordHint}`.trim();
  }

  if (label === "Use with caution") {
    return `Potential fit, but has trust or policy caveats. It is ${certPhrase} and refreshed ${dataset.freshnessSla}; verify governance and definitions before reuse. ${keywordHint}`.trim();
  }

  return `Not recommended for this question without additional validation. It is ${certPhrase} and may be better suited for other workflows (e.g., reconciliation or investigation). ${keywordHint}`.trim();
}

function buildWhyThisRecommendation(dataset: Dataset, score: ScoreBreakdown, intent: QuestionIntent) {
  const parts: string[] = [];

  // Lead with "fit + trust" in crisp enterprise tone.
  parts.push(
    `This recommendation is driven by a combination of semantic fit for your question and trust posture for ${intent.replaceAll(
      "_",
      " ",
    )}.`,
  );

  const trustLead =
    dataset.certification === "certified"
      ? "It is certified with clear ownership."
      : dataset.certification === "curated"
        ? "It is curated with an accountable owner/steward."
        : dataset.certification === "in_review"
          ? "It is in review; treat the definition as provisional."
          : "It is not certified; treat it as higher risk.";
  parts.push(trustLead);

  if (score.freshness >= 12) parts.push("Freshness is within SLA for reliable reporting.");
  if (score.quality >= 12) parts.push("Quality signals are strong (no failing checks).");
  if (dataset.lineageCompletenessScore >= 85) parts.push("Lineage is sufficiently complete to explain how the metric is produced.");

  if (dataset.containsPii) {
    parts.push("Governance is a constraint: it contains PII, so usage should stay within approved workflows.");
  } else if (score.governanceFit < 0) {
    parts.push("Governance fit is weaker for the inferred intent; confirm policy before publishing or sharing broadly.");
  }

  if (score.usage >= 7) {
    parts.push("Downstream adoption suggests it is already a de-facto source of truth in production analytics.");
  }

  // Keep it short and decisive.
  return parts.slice(0, 5).join(" ");
}

function buildRationaleBullets(dataset: Dataset, score: ScoreBreakdown, matched: string[]) {
  const bullets: string[] = [];

  if (matched.length) bullets.push(`Strong semantic match to question terms: ${matched.slice(0, 5).join(", ")}.`);
  if (dataset.certification === "certified") bullets.push("Certified dataset with an explicit owner/steward accountable for definitions.");
  if (dataset.freshnessSla === "hourly" || dataset.freshnessSla === "daily")
    bullets.push(`Freshness SLA is ${dataset.freshnessSla}; last updated ${new Date(dataset.lastUpdatedAt).toLocaleString()}.`);

  const failed = dataset.qualityChecks.filter((q) => q.status === "fail");
  const warned = dataset.qualityChecks.filter((q) => q.status === "warn");
  if (failed.length) bullets.push(`Quality checks failing: ${failed.map((f) => f.name).join("; ")}.`);
  else if (warned.length) bullets.push(`Quality warnings: ${warned.map((w) => w.name).join("; ")}.`);
  else bullets.push("Quality checks are passing for key completeness/reconciliation signals.");

  if (dataset.lineageCompletenessScore >= 85)
    bullets.push(`Lineage is complete enough for trust surfacing (lineage score ${dataset.lineageCompletenessScore}/100).`);
  else bullets.push(`Lineage is partial (lineage score ${dataset.lineageCompletenessScore}/100); expect blind spots.`);

  if (dataset.containsPii) bullets.push("Contains PII; governance review may be required depending on usage.");
  if (score.usage >= 7) bullets.push("High downstream usage suggests it is an established source of truth.");
  return bullets.slice(0, 6);
}

function buildNextActions(dataset: Dataset, intent: QuestionIntent, label: RecommendationLabel) {
  const actions: string[] = [];
  const hasRestricted = dataset.governanceTags.includes("Restricted") || dataset.governanceTags.includes("PCI");

  if (label === "Recommended") {
    if (intent === "executive_reporting" || intent === "qbr_reporting") actions.push("Use this dataset for your exec/QBR metric and cite the dataset name in the dashboard description.");
    if (intent === "self_serve_analytics") actions.push("Start with the curated fields; avoid re-deriving metric logic unless necessary.");
    if (intent === "experimentation") actions.push("Use it as the canonical attribution join point; keep raw events for deep investigations.");
  } else if (label === "Use with caution") {
    actions.push(`Review the caveats and confirm the definition with the steward: ${dataset.steward}.`);
    actions.push("Validate freshness and any recent incidents before publishing results.");
  } else {
    actions.push(`Escalate to the dataset steward (${dataset.steward}) to confirm if this is acceptable for your use case.`);
    actions.push("Prefer a certified/curated alternative if available.");
  }

  if (dataset.containsPii || hasRestricted) actions.push("Review governance tags and policy restrictions before using outside approved workflows.");
  return Array.from(new Set(actions)).slice(0, 4);
}

export function recommendDatasets(question: string): RecommendationResult {
  const intent = inferIntent(question);
  const tokens = tokenize(question);
  const now = new Date();

  const ranked = DATASETS.map((dataset) => {
    const semantic = semanticScore(tokens, dataset);
    const trust = trustScore(dataset);
    const freshness = freshnessScore(dataset, now);
    const quality = qualityScore(dataset);
    const lineage = lineageScore(dataset);
    const gov = governanceFit(dataset, intent);
    const usage = usageScore(dataset);
    const p = penalties(dataset, intent);

    const breakdown: ScoreBreakdown = {
      semanticMatch: semantic.score,
      trust,
      freshness,
      quality,
      lineage,
      governanceFit: gov,
      usage,
      penalties: p,
      total: 0,
    };

    const rawTotal =
      breakdown.semanticMatch +
      breakdown.trust +
      breakdown.freshness +
      breakdown.quality +
      breakdown.lineage +
      breakdown.governanceFit +
      breakdown.usage +
      breakdown.penalties;

    breakdown.total = clamp(Math.round(rawTotal), 0, 100);
    const label = labelFromScore(breakdown.total);

    const summary = buildSummary(dataset, label, semantic.matched);
    const whyThisRecommendation = buildWhyThisRecommendation(dataset, breakdown, intent);
    const rationaleBullets = buildRationaleBullets(dataset, breakdown, semantic.matched);
    const nextActions = buildNextActions(dataset, intent, label);

    const rec: Recommendation = {
      dataset,
      label,
      score: breakdown,
      summary,
      whyThisRecommendation,
      rationaleBullets,
      caveats: dataset.caveats,
      nextActions,
    };
    return rec;
  })
    .sort((a, b) => b.score.total - a.score.total)
    .map((rec, idx) => {
      // Add "why not chosen" for alternatives (relative to top pick).
      if (idx === 0) return rec;
      const reasons: string[] = [];
      if (rec.dataset.certification !== "certified") reasons.push("Not certified (or not fully certified) compared to the top pick.");
      if (rec.dataset.category === "raw") reasons.push("Raw table; requires additional modeling/guardrails for consistent reporting.");
      if (rec.dataset.containsPii) reasons.push("Contains PII; governance constraints may limit reuse.");
      if (rec.dataset.lineageCompletenessScore < 75) reasons.push("Lineage is less complete; harder to trust end-to-end transformations.");
      if (rec.dataset.qualityChecks.some((q) => q.status === "fail"))
        reasons.push("Has failing quality checks; increased risk of incorrect results.");
      return { ...rec, whyNotChosen: reasons.slice(0, 4) };
    });

  return {
    question,
    intent,
    ranked,
    generatedAt: now.toISOString(),
  };
}

