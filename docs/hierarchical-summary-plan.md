# Hierarchical Summary Plan (Future)

## Problem
Current summary behavior uses top-K retrieval (for example, 8 chunks). That is good for focused questions, but it does not cover very large requests like:

- "Give me status across all 20 clients."
- "Summarize everything from this month."

## Goal
Produce trustworthy "global" summaries across many notes without blowing token limits or latency.

## Proposed Approach
Use a two-pass hierarchical summary flow.

### Pass 1: Per-client or per-note mini summaries
1. Retrieve candidate notes/chunks for the query with generous recall (for example, top 80-200 chunks).
2. Group by client (or by note/date buckets for very large clients).
3. Summarize each group into a compact structured output:
   - `client`
   - `key updates`
   - `risks/blockers`
   - `next steps`
   - `supporting citations`

### Pass 2: Global rollup
1. Feed only the mini summaries into a second model call.
2. Produce:
   - cross-client themes
   - exceptions/outliers
   - client-by-client status table
   - explicit confidence limits

## Output Modes
- `Focused` (today): top-K summary, fastest.
- `Portfolio` (future): hierarchical summary across many clients.

## Safety and Quality Rules
1. Always preserve citations from pass 1 into pass 2.
2. If coverage is low, state it explicitly ("covered 12 of 20 clients").
3. Cap per-client context in pass 1 to avoid single-client domination.
4. Prefer deterministic structure over prose-only output.

## Suggested API Shape
- Existing `/summarize`: keep as focused mode.
- Future `/summarize-portfolio`:
  - inputs: `query`, `scope`, `clientIds?`, `maxClients`, `maxChunks`, `timeRange?`
  - returns:
    - `coverage`
    - `clientSummaries[]`
    - `portfolioSummary`
    - `citations[]`

## Rollout Plan
1. Add backend-only prototype (no UI changes).
2. Validate on demo + real anonymized datasets.
3. Add UI mode toggle only if quality is stable and understandable to coaches.
