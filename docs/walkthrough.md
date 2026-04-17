# Walkthrough Script (60–90s)

Hi — this is **Trusted Data Question Workspace**, a narrowly scoped prototype for making trusted dataset decisions faster.

The user problem: an analyst asks **“Which revenue dataset should I trust for QBR reporting?”** and hits friction — multiple tables exist, trust signals are scattered, and governance risk is easy to miss. Even with a catalog, the decision often ends up in Slack.

This product is an opinionated first bet: **question → trusted dataset recommendation**, with an **audit trail**.
You enter a question, and the app ranks a mocked enterprise catalog using transparent signals: **certification, accountable owner/steward, freshness SLA, quality checks, lineage completeness, downstream usage, and governance/PII fit**.

The key is explainability. It doesn’t just recommend a table — it shows **Why this recommendation**, the **score breakdown**, and **Why not the alternatives**, so the user can defend the decision.

It also generates a **shareable decision memo** you can paste into Slack or a ticket to document the choice, caveats, and next step.

I intentionally scoped out real warehouse connections, auth, and a full catalog UI. The goal is to showcase a focused workflow that turns metadata into an actionable, repeatable decision.

