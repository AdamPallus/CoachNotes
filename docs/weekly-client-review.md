# Weekly Client Review

The Weekly Client Review is an on-demand Mission Control briefing that helps a coach consider every accepted client deliberately. It complements the deterministic Attention, Activity, and Segments views; it does not replace them.

## Product behavior

- The coach starts generation manually from Mission Control.
- The report covers every accepted client exactly once.
- It opens with a short practice-level orientation and up to three supported cross-client patterns.
- Clients appear alphabetically by default. The coach can regroup the same scrolling document by retention concern, cohort, or curriculum.
- Each client receives a current focus, a short weekly assessment, a suggested coach focus, and limited evidence or counterevidence when useful.
- Attention cases open by default. Routine clients remain compact until expanded.
- A client review links directly to the client profile. Back returns to the same report scroll position.
- Generation runs in bounded groups with at most two model requests in flight. CoachNotes remains usable while it runs.
- Each completed group is checkpointed locally. If the app closes or a later request fails, the coach can resume compatible work instead of starting over.
- The most recent successful report is saved locally in SQLite. Regeneration replaces only that week's report.
- Failed, timed-out, malformed, or incomplete generation never replaces the prior saved report.

## AI judgment boundary

The report asks the model to make grounded coaching judgments rather than merely restating deterministic counts. The coach remains the decision-maker and relationship owner.

Retention concern uses four labels:

- `low`: communication and follow-through appear intact, or a pause is expected and explained.
- `some`: one meaningful concern or several softer signals appear.
- `high`: strong evidence suggests disengagement, such as direct exit intent, sustained unexplained silence, or repeated non-response after troubleshooting.
- `insufficient_evidence`: the current dashboard does not support a responsible judgment.

The prompt explicitly prevents planned travel, bereavement, overdue coach work, health conditions, diagnoses, age, or demographics from becoming retention evidence by themselves. It does not produce numeric retention probabilities.

## Data sent to the proxy

The desktop builds `weekly_review_context.v1` from accepted structured dashboards. It sends only a bounded projection of:

- deterministic update and source-activity dates;
- overview and selected program context;
- active coach tasks and radar items;
- client goals and coaching approach;
- engagement, progress, recent timeline, and program changes;
- active flags, missing information, and confidence notes.

Raw note bodies and source documents are not included. Text lengths and section item counts are capped before the request leaves the desktop.

The desktop splits the projection into groups of no more than 12 clients and approximately 100,000 context characters. Each proxy call returns `weekly_client_review_batch.v1`; contract validation requires the exact assigned roster, unique IDs, allowed labels, and required prose. A final synthesis call receives the validated assessments and returns only `weekly_client_review_synthesis.v1` opening and pattern fields, so it cannot relabel clients. The desktop adds cohort and curriculum grouping metadata directly from each saved profile, orders the final report alphabetically, and saves `weekly_client_review.v1` only after complete coverage.

Local drafts are keyed to a hash of the complete projected context. A draft resumes only when the current client dashboards still match that snapshot; otherwise CoachNotes starts a fresh review rather than mixing assessments from different data states. This is resumable foreground work, not a server-side background job: requests continue while CoachNotes is open, and completed groups survive closing the app.

## Evaluation fixture

The local fixture contains 12 curated scenarios:

- steady engagement;
- planned travel and bereavement pauses;
- sustained unexplained silence;
- direct cancellation/value concern;
- discouragement with continued engagement;
- goal/constraint mismatch;
- overdue coach work with an engaged client;
- health context without disengagement;
- stale, insufficient evidence;
- successful graduation;
- inconsistent follow-through with continued contact.

On the September 1, 2026 batched Vercel preview, Luna classified 11 of 12 scenarios within their accepted attention and retention labels. The one miss escalated a constraint mismatch from the expected `watch` label to `needs_attention`; its retention label remained the expected `some`. The batch plus synthesis completed on their first attempts in 25.5 seconds with 6,993 input tokens and 2,106 output tokens, including 672 reasoning tokens.

The older 22-client Mission Control portfolio produced a complete report in 42.6 seconds with 16,667 input tokens and 5,023 output tokens. All retention judgments were conservatively marked insufficient because that fixture's activity dates were stale. This validates coverage and caution, not retention accuracy.

A 50-client benchmark used the full local demo portfolio repeated to current Liz-scale volume. Its projected context was 148,292 characters. Five assessment groups and one synthesis request all completed on their first attempts with two-way concurrency in 74.1 seconds wall-clock. Total usage was 47,773 input tokens and 10,590 output tokens, including 3,822 reasoning tokens. The final report covered all 50 clients exactly once and was alphabetized. This validates batching, coverage, and runtime behavior; duplicated demo clients make its portfolio-level patterns unsuitable as domain evidence.

These are engineering fixtures. Liz's review with real coaching data remains the domain validation step.

## Development commands

Seed or reset only the dedicated weekly-review demo clients:

```bash
npm --workspace apps/desktop run fixture:weekly
```

Inspect projected context size without calling the API:

```bash
npm --workspace apps/desktop run evaluate:weekly -- --prefix "Weekly Review Demo - "
```

Project the current demo portfolio at 50-client scale without calling the API:

```bash
npm --workspace apps/desktop run evaluate:weekly -- --repeat-to 50
```

Evaluate a protected Vercel preview and save the successful report into CoachNotes Dev:

```bash
npm --workspace apps/desktop run evaluate:weekly -- \
  --prefix "Weekly Review Demo - " \
  --url https://preview.example.vercel.app \
  --vercel-preview \
  --save
```

The evaluator reads the CoachNotes invite token from `COACHNOTES_INVITE_TOKEN` or the existing macOS Keychain entry. Generated evaluation artifacts are written under ignored `output/weekly-review/`.
