# Luna model comparison - September 23, 2026

## Status and recommendation

Production rollout approved by the user on September 23 after the additional
checks below. No desktop version bump, tag, or installer is required. The
server routing change maps existing desktop
requests for `gpt-5.6-luna` to `gpt-6-luna` and reports the selected model honestly.

Decision: proceed with a controlled GPT-6 Luna rollout, including citation
validation and date/attention clarifications. The
sample supports trying the new model with Liz, not a guarantee of equivalent or
better behavior on every real client. The measurable downside was latency.
The original comparison below is retained as the pre-hardening record.

## Launch validation

After the initial comparison, the user approved these server-only safeguards:

- Pin `reasoning.effort` explicitly to `medium` for all text workflows.
- Normalize citation whitespace and reject unknown or unfinished references in
  Ask and summaries, including streamed output before a citation reaches the UI.
- Check references in intake/update output. Changed object items in update
  arrays need their own evidence; section-level references alone are not enough.
  Unchanged coach-entered items may remain uncited. Invalid workflow references
  use the existing single bounded retry, never an arbitrary replacement source.
- Supply a reference date for Ask/summary. Existing desktops do not send their
  local date here, so the fallback is explicitly labeled UTC rather than assumed
  to be the coach's local day. Unknown meeting timing must remain conditional.
- Compute weekly-review task due states in code, and distinguish routine
  scheduled work from situations needing extra attention. Retention criteria
  and coach-owned priority/status remain unchanged.

The launch comparison made **24 successful API calls**: 11 paired cases plus a
paired uncited-coach-edit preservation case. All responses completed on the
first attempt, with no timeouts, truncation, or citation-validation failures.
Both models matched all **12/12 attention and retention expectations**. Both
described the trip as upcoming in session prep and correctly distinguished a
due-today task from overdue work. The manual task retained its text, priority,
planning status, and date without acquiring a fabricated source reference.

For the main 11-case comparison, estimated cost was $0.0206 for 5.6 versus
$0.0089 for 6; mean elapsed time was 11.5 versus 16.5 seconds. The additional
manual-edit pair cost approximately $0.0037 combined. These figures use the
same pricing methodology as the original comparison below.

Validation also includes 39 automated tests, lint, direct helper syntax checks,
and whitespace checks. Tests exercise normalization at every citation split
boundary, both streaming and non-streaming endpoints, a successful citation
retry, exhausted retries, preserved uncited coach edits, and date classification.
No desktop code or stored client data was changed.

Launch run artifacts:

- `output/model-comparison/2026-09-23T16-01-09-228Z`: main paired comparison.
- `output/model-comparison/2026-09-23T16-05-18-246Z`: coach-edit preservation.

Production uses the existing `https://coach-notes-five.vercel.app` endpoint;
the GitHub main-branch commit is the server release identity. Desktop stays at
0.2.19. Production verification must check health and real synthetic legacy-model
requests, not just deployment readiness. See the rollback procedure in
[deploy-vercel.md](deploy-vercel.md).

## Method

- Real OpenAI Responses API calls, executed locally through the existing proxy
  handlers. Not Codex subagents and not the Vercel production endpoint.
- Only synthetic data: the existing 12-client weekly-review fixture, a synthetic
  Maya chronology, and a repetitive 37-event history stress case. No Liz data,
  vault modifications, or saved client dashboard changes.
- Same prompt, input, output ceiling, and effective default reasoning effort
  (`medium`) for each paired call. Request hashes confirmed equality apart from
  model selection. Test requests used `store: false`.
- 32 calls across 16 pairs: 10 initial cases, one larger-history case, repeated
  weekly review and current-note cases, then three paired checks after clarifying
  the citation requirement. Both models were tested after the prompt change.
- Additionally, one real local HTTP/streaming smoke request sent the legacy 5.6
  model name without the comparison harness's model override. The response
  announced GPT-6 Luna and returned valid streamed answer/citation events.
- All 32 comparison responses completed on the first formatting attempt, with
  no truncation or timeouts. All 16 returned update patches passed the actual
  desktop parser and application function. These are technical checks, not
  proof of semantic correctness.

## Measured performance

Across all 16 matched requests per model:

| Metric | GPT-5.6 Luna | GPT-6 Luna |
| --- | ---: | ---: |
| Input tokens | 44,835 | 44,835 |
| Output tokens, including reasoning | 13,937 | 16,347 |
| Reasoning tokens | 4,252 | 6,857 |
| Mean end-to-end request time | 10.7 s | 15.7 s |
| Estimated API cost | $0.0252 | $0.0124 |

GPT-6 cost about **51% less**, despite using more reasoning/output tokens in this
mix. Total comparison cost was approximately **$0.038**, excluding the tiny
extra HTTP smoke request. This is an estimate from returned token usage and
published standard prices, including cache hits and cache writes, not a billing
statement. Latency was about 47% higher in aggregate; the second weekly-review
pair was effectively tied at 20 seconds each. Test order was always 5.6 then 6,
and this is too small a sample for a production latency forecast.

Pricing references: [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
and [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

## Quality review

### Current and historical notes

Both models correctly retained the current two-session plan and resolved knee
pain when a June note described a five-day plan, knee pain, and doubts about
continuing coaching. Neither reopened the historical coach task or overwrote
the current snapshot. Both returned no changes for the duplicate-note case.

For a current travel update, both added the hotel-workout task, preserved the
existing meal-guide task, and captured the planned check-in pause/resume date.

The intake outputs differed in useful ways: GPT-6 was more compact and avoided
inventing a separate client-values entry from a preference for a manageable
routine. It combined two same-deadline deliverables into one to-do, whereas 5.6
kept them separate. That is a usability preference worth watching with Liz, not
evidence that one model is universally better.

In the deliberately repetitive large-history test, 5.6 made no change and
omitted the newly supplied historical concern. GPT-6 added it and condensed the
36 repetitive historical review entries into one dated-range entry. Current
state was preserved. This is not a test of preserving 36 distinct milestones;
that remains an evaluation gap for real, heterogeneous long client histories.

### A real citation regression found and addressed

In both initial current-note runs, GPT-6 put a source reference on the
`coachingPlanApproach` section update but omitted it on the new list item itself.
The desktop displays citations from the item, so that item would have no
clickable source link. GPT-5.6 included it in both runs.

The server prompt now explicitly requires `evidenceIds` on every newly added or
modified object item, explains that section-level references are insufficient,
and tells the model to preserve references on unchanged items. There is no
blind copying of section evidence to individual items.

Both subsequent current-note pairs included item-level references for every
changed item. A further backdated-note pair also passed citation and
current-state-preservation checks. This improves prompting; it is not a strict
schema-enforced guarantee and should remain in future evaluations.

### Weekly review

Both models matched **12/12 expected retention ratings in both runs**. Travel and
bereavement remained expected pauses with low retention concern; cancellation
and sustained unexplained silence were high; sparse data remained insufficient
evidence. Health conditions and overdue coach work were not treated as client
retention risks.

Attention labels varied: 5.6 matched the fixture expectations on 10/12 clients
in both runs; GPT-6 matched 8/12, then 11/12. The existing prompt calls a concrete
action or due item `needs_attention`, while several fixture expectations label
routine upcoming work `routine` or `watch`. The fixture score therefore does not
cleanly measure degradation. Do not silently rewrite expected labels to make
the new model pass. We did not change the attention rubric for this migration.

One GPT-6 review called a task due today "overdue." That is a small observed
factual error, not something the successful contract/rubric checks detect. It
was not repeated in the second review, but remains a reason not to promise that
every output is at least as good as 5.6.

### Ask and summary

Both produced relevant short coach questions, session preparation, and a source
summary. Both correctly said the notes lacked blood pressure and medication
information rather than inventing values. GPT-5.6 included whitespace inside
its citation IDs in the missing-evidence answer, which our exact-ID check
flagged; GPT-6 used valid IDs. No unrelated citation-renderer change was made.

Both session-prep outputs assumed a meeting after the upcoming trip, although
the question did not specify the meeting date. The Ask request does not supply
an explicit current date. This is a shared existing weakness, not a new-model
regression; temporal grounding deserves a separate follow-up.

## Side-by-side examples

For "Give me 1-3 questions to ask Maya based on the recent update":

**GPT-5.6 Luna**

1. How would you like the two-session training plan to fit around your time away
   from September 26 through October 4?
2. Are there any specific preferences or limitations I should consider for your
   hotel workout options?
3. Is there anything you'd like adjusted or clarified in the meal guide before
   you leave?

**GPT-6 Luna**

1. What's been working well about the two short sessions that you'd like to keep
   in your plan?
2. Is there anything you'd like to adjust about the two-session plan or hotel
   workout options before check-ins resume October 5?

Citations are omitted from these reading excerpts; the raw outputs preserve
them. Both are useful, with different emphasis rather than an obvious winner.
The first 5.6 answer also assumes an already available meal guide even though
the notes describe it as pending.

## Reproduce and inspect

From the repository root, with `OPENAI_API_KEY` set or available in the local
`apps/proxy/.env`:

```bash
node apps/proxy/scripts/compare-luna.js --run
node apps/proxy/scripts/compare-luna.js --run --case current-note
```

These commands spend API credits. Without `--run`, the script makes no requests.
It does not use the configured production invite token or contact Vercel. Its
model override is confined to the standalone comparison process so physical
5.6 and 6 models remain comparable after the production alias changes.

Output is stored beneath ignored `output/model-comparison/`. Each JSON contains
the exact synthetic input, model request, prompt hash, raw result, usage,
timing, rubric scores where applicable, and automated checks. Content is never
sent to application logs or committed as real client data. Normal production
logging remains metadata-only.

Runs in this comparison:

- `2026-09-23T15-31-46-935Z`: initial 10-case comparison, unchanged prompts.
- `2026-09-23T15-35-44-057Z`: larger synthetic history.
- `2026-09-23T15-36-26-935Z`: repeated weekly review.
- `2026-09-23T15-36-28-105Z`: repeated current note, original prompt.
- `2026-09-23T15-37-44-813Z`: current note, clarified citation prompt.
- `2026-09-23T15-38-51-544Z`: repeated current note, clarified prompt.
- `2026-09-23T15-38-52-723Z`: backdated note, clarified prompt.

Remaining validation: Liz's naturally messy notes, full coach-specific template,
larger distinct histories, and real production load. Her review should focus
on preserved commitments, clickable sources, useful question suggestions,
attention-label noise, and whether waits feel longer. There is no new desktop
installation needed for either the upgrade or a server-side rollback.
