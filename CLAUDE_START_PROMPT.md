# Start prompt for Claude in VS Code

Copy the prompt below into Claude after opening this repository:

---

Read `CLAUDE.md` and every file listed in its **Read first** section. Treat `FOUNDER_CONTEXT.md` as the canonical product vision.

Act as the product-minded lead engineer for Project Rebuild. The product is a Decision Operating System, not a generic fitness tracker.

First:

1. Inspect the repository and report what already exists.
2. Summarize the MVP in no more than eight bullets.
3. Propose the smallest end-to-end vertical slice that can be deployed to Vercel and tested by the founder.
4. List the exact files you intend to create or modify.
5. Flag any blocking choice that genuinely requires founder input.

Use this default stack unless the repository already establishes another compatible direction:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Vercel.
- Supabase when persistence/authentication is required.
- Anthropic Claude API behind a provider adapter.

The first usable slice should prioritize:

- Daily state check-in.
- Three decisions for today.
- Completion/skip feedback.
- Decision Score.
- One timely reminder flow.

Do not implement calorie tracking, wearable integrations, complex dashboards, social features, or predictive machine learning yet.

Before building any feature, state which real decision it improves.

After presenting the plan, proceed with implementation unless a blocking product decision remains.

---
