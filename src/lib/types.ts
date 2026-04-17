export type Certification =
  | "certified"
  | "curated"
  | "in_review"
  | "uncertified"
  | "deprecated";

export type DatasetCategory = "gold" | "mart" | "curated" | "enriched" | "raw";

export type GovernanceTag =
  | "PII"
  | "PCI"
  | "SOX"
  | "GDPR"
  | "Restricted"
  | "Public"
  | "Internal";

export type QualityCheck = {
  id: string;
  name: string;
  status: "pass" | "fail" | "warn";
  lastRunAt: string; // ISO
  notes?: string;
};

export type Dataset = {
  id: string;
  name: string; // schema.table style
  description: string;
  businessDomain:
    | "Finance"
    | "Product"
    | "Marketing"
    | "Sales"
    | "Support"
    | "Customer"
    | "Analytics"
    | "ML";
  category: DatasetCategory;
  owner: string;
  steward: string;
  certification: Certification;

  // Product-ish metadata (lightweight but realistic):
  // Keep intentionally lightweight but realistic.
  primaryOwnerTeam?: string;
  sourceSystems?: string[];
  grain?: string; // e.g. "customer_id x fiscal_week"
  primaryKeys?: string[];
  retention?: string; // e.g. "24 months"
  slaNotes?: string;

  freshnessSla: "hourly" | "daily" | "weekly" | "monthly" | "ad_hoc";
  lastUpdatedAt: string; // ISO

  qualityChecks: QualityCheck[];
  lineageCompletenessScore: number; // 0..100
  downstreamUsage: {
    dashboards: number;
    models: number;
    queryWeeklyActiveUsers: number; // "popularity" proxy
  };

  governanceTags: GovernanceTag[];
  containsPii: boolean;
  piiNotes?: string;
  policyNotes?: string;
  approvedUseCases: Array<
    | "executive_reporting"
    | "qbr_reporting"
    | "self_serve_analytics"
    | "ml_modeling"
    | "finance_reconciliation"
    | "experimentation"
    | "support_ops"
  >;

  caveats: string[];
  semanticKeywords: string[]; // business concepts and synonyms
  powerUsers?: string[]; // optional social proof
};

export type QuestionIntent =
  | "executive_reporting"
  | "qbr_reporting"
  | "self_serve_analytics"
  | "ml_modeling"
  | "finance_reconciliation"
  | "experimentation"
  | "support_ops"
  | "unknown";

export type ScoreBreakdown = {
  total: number; // 0..100
  semanticMatch: number; // 0..30
  trust: number; // 0..25
  freshness: number; // 0..15
  quality: number; // 0..15
  lineage: number; // 0..10
  governanceFit: number; // -10..10 (can penalize)
  usage: number; // 0..10
  penalties: number; // negative number (e.g. -12)
};

export type RecommendationLabel = "Recommended" | "Use with caution" | "Not recommended";

export type Recommendation = {
  dataset: Dataset;
  label: RecommendationLabel;
  score: ScoreBreakdown;
  summary: string;
  whyThisRecommendation: string;
  rationaleBullets: string[];
  caveats: string[];
  nextActions: string[];
  whyNotChosen?: string[]; // for alternatives
};

export type RecommendationResult = {
  question: string;
  intent: QuestionIntent;
  ranked: Recommendation[];
  generatedAt: string; // ISO
};
