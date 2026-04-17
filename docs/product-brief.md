# Trusted Data Question Workspace — Product Brief

## User
- **Primary**: analytics engineers and analysts at mid-to-large enterprises
- **Secondary**: data stewards and domain data product owners (reviewers / escalations)

## Problem
Users start with a business question (“Which revenue table should I trust for QBR?”) but can’t quickly answer:
- **Which dataset is the best source of truth** for the *intent* (exec reporting vs reconciliation vs modeling)
- **Why it’s trustworthy** (certification, ownership, freshness, checks, lineage, adoption)
- **Whether it’s safe and allowed** (governance/PII/policy fit)

Result: slow delivery, duplicated logic, inconsistent KPIs, and avoidable governance risk.

## Goals
- **Help users choose a dataset confidently** in under a minute for common questions.
- **Make the decision defensible**: show “why” and “why not” with clear trust signals.
- **Reduce policy misses** by surfacing governance/PII constraints at decision time.

## Non-goals (intentionally out of scope)
- Building a catalog UI, full search, or browsing experience
- Real warehouse connectivity, live queries, or metric computation
- Auth, permissions, approval workflows, or admin configuration
- AI “assistant” behavior without auditable reasoning

## Why now
- Self-serve analytics and AI/ML increase the blast radius of “wrong table” decisions.
- Enterprises have more metadata than ever, but the **decision** is still manual (Slack threads, guesses, and rework).
- Trust needs to be **explainable**: not just “what exists,” but “what should I use for this purpose, and what are the risks?”

## Proposed approach
An opinionated, narrow workflow:
**Business question → ranked trusted datasets → trust explanation → caveats + next step → shareable decision memo**

This prototype intentionally uses:
- **Seeded enterprise metadata** (owner/steward, certification, freshness, quality checks, lineage, downstream usage, governance tags, approved use cases)
- **Transparent heuristics** for scoring (no “black box chatbot” behavior)

## Core workflow
1. **Question entry**: user pastes a business/data question in plain English.
2. **Recommendation**: app returns a top dataset + 1–2 alternatives with a label:
   - Recommended / Use with caution / Not recommended
3. **Why this recommendation**: plain-English justification plus an auditable score breakdown.
4. **Trust signals**: certification, owner/steward accountability, freshness, quality checks, lineage, adoption, governance.
5. **Why not alternatives**: explicit tradeoffs so the user can defend the decision.
6. **Decision memo**: copy/paste summary for Slack/tickets/PRs.

## Success metrics (for a real rollout)
- **Decision time**: median time from question to “dataset selected” down by 50%+
- **Rework**: fewer dashboard rewrites caused by incorrect sources/definitions
- **Policy adherence**: fewer governance escalations and PII policy misses
- **Adoption**: % of questions that end with a decision memo and dataset reference in the artifact
- **Trust shift**: increased usage of certified/curated datasets vs raw sources for exec reporting

## Risks / tradeoffs
- **Overconfidence**: users may treat a recommendation as approval. Mitigation: explicit labels, caveats, and policy-fit penalties.
- **Metadata gaps**: missing freshness/lineage/checks reduce confidence. Mitigation: surface missingness directly in the score and memo.
- **One-size scoring**: different teams prefer different tradeoffs. Mitigation: keep weights configurable in a future iteration.

## Open questions (if this moved beyond a prototype)
- How should teams express “policy” in a way that is both enforceable and explainable (e.g., exec reporting requires certification; PII requires approval)?
- Where should feedback land (thumbs up/down, “this was wrong because…”) so the system improves without becoming a support burden?
- How do we measure “trust improvement” beyond adoption (e.g., fewer backchannels, fewer metric disputes, fewer incidents)?

## Future expansion (deliberately not in this prototype)
- Integrate real metadata, lineage, and data health signals (catalog + dbt + observability)
- “Definition comparison” for competing sources of truth
- Team policy packs (e.g., exec reporting must be certified; PII requires approval)
- Slack/Jira integration to attach memos to work items and approvals

