# Liz Feedback v1 Status (Post v0.1.4)

> **Historical, pre-dashboard-pivot status record.** This document references a previous generation of CoachNotes. See [README.md](README.md) for current documentation.

This file tracks what from `docs/liz-feedback-v1-spec.md` is done vs pending.

## Completed

1. Include profile data in search and Q&A
   - `_client-profile.md` is indexed with profile-aware synthetic content.
   - Profile updates are re-indexed on save.
   - Profile hits are labeled as `Client Profile`.

2. Save AI answers to client notes
   - Answer panel includes `Save as Note`.
   - Scoped client behavior:
     - `This Client` scope: saves directly to that client.
     - `All Clients` scope: prompts for client.
   - Saved notes include AI metadata and stable human-readable `Sources`.

3. Tags visible during Q&A (client context strip)
   - Added collapsible client context panel for client-scoped workflows.
   - Shows tags, top priorities, ongoing medical considerations, and acute injuries.

4. Custom tag colors (phase 1 category mapping)
   - Added automatic category-based tag color rendering (medical/training/goal/personal/admin/default).
   - Added fixed client color palette (10 preset colors) in profile.

## Pending

5. Interactive focus areas (check/complete/move between lists)
   - Not implemented yet.
   - Current profile lists remain manual text lists.

6. Smart profile suggestions on note save
   - Not implemented yet.
   - Open concern: doing an LLM pass inline on every note save can add noticeable latency and hurt the "save note -> done" UX.
   - Proposed direction for future:
     - Keep note save synchronous and fast.
     - Run suggestions asynchronously after save.
     - Show non-blocking suggestion banner/toast only when high-confidence suggestions exist.
     - Optionally gate by toggle in settings (`Enable profile suggestions`).

## Open Product Questions for Future Iteration

- Do we want per-tag custom colors (manual tag color assignment), or keep category auto-coloring?
- Should profile suggestions be:
  - fully optional per workspace/user, and/or
  - only run when notes exceed a minimum length threshold?
