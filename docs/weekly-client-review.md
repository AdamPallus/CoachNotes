# Weekly Client Review

The Weekly Client Review is an on-demand Mission Control briefing that helps a coach consider every accepted client deliberately. It complements the deterministic Attention, Activity, and Segments views; it does not replace them.

## Product behavior

- The coach starts generation manually from Mission Control.
- The report covers every accepted client exactly once.
- It opens with a short practice-level orientation and up to three supported cross-client patterns.
- Clients are grouped into Needs Attention, Watch, Insufficient Evidence, Expected Pauses, and Routine Follow-Through.
- Each client receives a current focus, a short weekly assessment, a suggested coach focus, and limited evidence or counterevidence when useful.
- Attention cases open by default. Routine clients remain compact until expanded.
- A client review links directly to the client profile. Back returns to the same report scroll position.
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

The proxy returns `weekly_client_review.v1`. Contract validation requires the exact client roster, unique IDs, allowed labels, and required prose before the desktop can save the result.

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

On the September 1, 2026 Vercel preview, Luna classified all 12 scenarios within their accepted attention and retention labels. The tuned response completed on its first attempt in 22.1 seconds with 5,469 input tokens and 2,126 output tokens, including 657 reasoning tokens. Visible report prose was 792 words.

The older 22-client Mission Control portfolio produced a complete report in 42.6 seconds with 16,667 input tokens and 5,023 output tokens. All retention judgments were conservatively marked insufficient because that fixture's activity dates were stale. This validates coverage and caution, not retention accuracy.

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

Evaluate a protected Vercel preview and save the successful report into CoachNotes Dev:

```bash
npm --workspace apps/desktop run evaluate:weekly -- \
  --prefix "Weekly Review Demo - " \
  --url https://preview.example.vercel.app \
  --vercel-preview \
  --save
```

The evaluator reads the CoachNotes invite token from `COACHNOTES_INVITE_TOKEN` or the existing macOS Keychain entry. Generated evaluation artifacts are written under ignored `output/weekly-review/`.
