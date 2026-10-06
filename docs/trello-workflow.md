# CoachNotes Trello Workflow

Canonical board process, agreed with Adam on 2026-10-05. This supersedes the old
Feature Requests / Planned / In Review / Completed process and per-release lists.
Release mechanics remain in [release-desktop.md](release-desktop.md).

Board: [CoachNotes](https://trello.com/b/DFSU7js7/coachnotes)
(`6a07a16709f9138f2e6b7353`). Fetch live lists and card discussions before acting;
the IDs below are a lookup aid, not a substitute for checking current state.

## Five Lists

| List | Purpose | ID |
| --- | --- | --- |
| Feedback | Incoming bugs, requests, annoyances, or a question needing clarification. | `6a07a1b98a6aa73ccfa5f517` |
| Next | Agreed, build-ready work. | `6a07a1c8244232631bc97ebb` |
| Ready to Release | Implemented and technically verified, but not shipped. | `6a0f4afc6db49a9b735adb4a` |
| Try in CoachNotes | One current release card with a brief summary and focused feedback prompts. | `6a07a1cae7ff7423202e4642` |
| Later | Accepted/deferred ideas, including ideas whose details can wait until we prioritize them. | `6a0f501b868601ad66e59ea8` |

Do not recreate Completed, Won't Fix, or version-specific lists. Archived cards
are the history. Do not add lists, labels, scheduled polling, or extra process
without a user request. Cleanup/triage is not authorization to release software.

## Card Lifecycle

- One concrete issue per card. Search existing cards and read comments before
  creating a duplicate. Prefer continuing a relevant comment thread.
- Use short, nontechnical descriptions: the coaching problem, intended outcome,
  and only the decisions that matter. Engineering plans and test detail belong
  in repo documentation, linked from Trello when useful.
- When triaging, explicitly say **build-ready**, **needs clarification**, or
  **deferred**. Only move agreed, actionable work into Next. Do not invent a
  priority or make every old idea a commitment for the next release.
- Move implemented work into Ready to Release with a concise change/test note.
  Distinguish automated checks and Adam's demo testing from Liz's real-data
  feedback. Never call unreleased changes available to Liz.
- After verified shipment, link the feature card and the release summary both
  ways, add an outcome/release comment to the feature card, and archive it.
  Liz can keep discussing the release card or create a new Feedback card.
- If work is partially shipped, narrow the remaining card or split out the
  remaining scope. A shipped first version does not complete future extensions.

## Release Handoff

Use one card per release, never a list per release. Check for an existing card
before creating one. Verify the GitHub release and downloadable assets; if the
change also needs the server, verify that deployment before saying it is ready.
For a staged desktop/server cutover, clearly state that testing must wait.

Keep the current release card in Try in CoachNotes. Before archiving the previous
release card, read its comments and preserve any unresolved feedback as linked
cards. Do not carry old release guides forever as an implicit testing obligation.
There is no need for Liz to formally approve every change before routine work can
continue; her real use is feedback, not a second engineering QA department.

Suggested release card:

```text
Release X.Y.Z - short description

Available now / staged, not ready to use yet: [verified status and download link]

What changed: a few coach-facing bullets, linked to feature cards.

When it fits your work: up to three focused questions about the new behavior.
Skip questions already answered by Liz's feedback.

Known limitations or important installation/data safety notes, only if relevant.
```

Keep follow-up improvements separate and clearly labeled as not in that release.
New actionable feedback gets its own linked card, so it does not disappear when
the release summary is archived.

## Archiving Without Losing Work

1. Read the description, comments, and relevant attachments/checklists. Check
   actual shipment or superseding work rather than trusting a list name.
2. Preserve unfinished requirements on an existing or new specific card. Link
   both ways. Deferred ideas go in Later; a question we need answered goes in
   Feedback. Broad aspirational sketches can stay on the archived parent as
   historical context, but do not silently discard concrete requests.
3. Add an outcome: shipped version, resolved explanation, duplicate target, or
   links to split work. Archive, never delete, the old card.
4. Before a bulk cleanup, save a local snapshot outside tracked docs. Verify
   afterward that cards, original comments, and attachments are retained and
   there is no unfinished open work hidden inside archived lists.

When materially rewriting an old description, preserve it in a comment so Liz's
original wording remains accessible. Do not edit or remove her comments.

## Screenshots and Privacy

Capture only the app window or a deliberate crop. Inspect the image before
attaching it: the changed controls must be visible, with no desktop messages,
notifications, or unrelated private content. Prefer demo data; do not export
real client data to Trello without authorization. Restore any temporary demo
state changes afterward. Board exports and credentials must not be committed.

## Agent Entry Points

- Repo instructions: `AGENTS.md` links here for cross-thread continuity.
- Local API skill: `~/.codex/skills/coachnotes-trello-workflow/SKILL.md` handles
  credentials and points here for workflow rules.
- Historical cleanup: [trello-cleanup-2026-10-05.md](trello-cleanup-2026-10-05.md).

The repo guide is canonical. Old conversations, historical status documents,
and memory entries using Planned/In Review do not override it.
