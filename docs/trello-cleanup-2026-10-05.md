# Trello Cleanup: 2026-10-05

User-approved cleanup of the [CoachNotes board](https://trello.com/b/DFSU7js7/coachnotes).
Ongoing rules are in [trello-workflow.md](trello-workflow.md), not this snapshot.
No software release or server deployment was performed.

## Verified Outcome

- Open cards: 57 before, 21 afterward. Created six cards for concrete unfinished
  ideas buried in older cards; archived 42 shipped, resolved, or superseded cards.
- Active lists, in order: Feedback (1), Next (0), Ready to Release (3),
  Try in CoachNotes (1), Later (16).
- Retained all 60 original cards, all 100 original comment bodies, and all ten
  original attachments. Three cards that were already archived stayed archived.
- Archived the three old release lists and Won't Fix/Duplicates after handling
  their cards. No open cards remain hidden in archived lists.
- Previous descriptions were preserved in comments before material rewrites.
  Original discussion and new child cards are linked both ways.
- The Bio tag-filter scrolling complaint in the 0.2.14 release thread was
  resolved by commit `4dc182b`, verified as included in `v0.2.15`. Added that
  resolution before archiving the thread.

The ignored `output/trello-cleanup/` directory contains before/after API snapshots,
a mutation journal, and the one-off cleanup/verification scripts. Full board
exports are deliberately not tracked in Git.

## Current Release Versus Unshipped Work

[Release 0.2.21](https://trello.com/c/0efn63ng) is the only card in Try in
CoachNotes. Its guide now has three focused feedback questions and explicitly
distinguishes these locally implemented, unshipped changes in Ready to Release:

- [Schedule tomorrow's follow-ups](https://trello.com/c/W1i5URDS).
- [Clearer End of Day Next action](https://trello.com/c/UNYpk2l2).
- [Dictation in ASK/long fields, including inline recording/retry controls](https://trello.com/c/zZQivT2o).

The empty Next list is intentional: cleanup did not promote deferred work into
new implementation commitments.

## Preserved Unfinished Ideas

Six new Later cards preserve remaining scope, not newly promised features:

- [Client commitments, separate from coach to-dos](https://trello.com/c/oDDXSkoj).
- [Coach-defined onboarding starter tasks](https://trello.com/c/OgcolMFS).
- [Practice template: custom fields and dashboard layout](https://trello.com/c/xXyupUQo).
- [Longer coach reference documents for AI guidance](https://trello.com/c/KQ5ElgRC).
- [Pinned coach reminders](https://trello.com/c/rlM0jq2Z).
- [Session Notes labels and richer filters](https://trello.com/c/jZ2rnsmA).

Other unfinished work remains on existing cards:

- [Structured client memory](https://trello.com/c/ZlxW6IVp), including decision
  history; the shipped concise Snapshot is not the entire memory project.
- [Profile fields](https://trello.com/c/UmkV4Qeu),
  [goal relationships](https://trello.com/c/8Fz4eyGs),
  [program modifications](https://trello.com/c/HregzpIY), and
  [progress metrics](https://trello.com/c/l1ekpL6k).
- [Timeline corrections and completion history](https://trello.com/c/oZ6sDkRk),
  distinct from already-shipped handling of dates within a source.
- [Resource organization/assignment](https://trello.com/c/yzUGYwaK), distinct from
  having a Resources page.
- [Client tag editing and coach-defined labels](https://trello.com/c/5O56KMVt),
  distinct from shipped guardrails and Bio filtering.
- [Evaluate ASK retrieval gaps](https://trello.com/c/suZUpqKD) and
  [cross-client ASK](https://trello.com/c/FLhJ0DSC), both deferred rather than
  automatically next. Existing partial updates, token diagnostics, and follow-up
  prompt work are no longer described as entirely missing.

[Missing-info cleanup in Mission Control](https://trello.com/c/ddNqG7lK) remains
in Feedback: clarify whether opening a client to resolve/convert an item is still
awkward, rather than rebuilding existing coach-task completion.

The old Dashboard, Additional Features, concision, design-questions, and 0.2.2
feedback umbrella cards are archived with links to the specific remaining work.
Speculative navigation sketches remain historical context, not approved scope.

## Durable Instructions

Updated `AGENTS.md`, `docs/release-desktop.md`, and the local
`coachnotes-trello-workflow` skill to point to the canonical workflow. Added an
authorized memory update note superseding the old list names. Historical release
documents remain historical; do not use their former list names to recreate the
old board layout.
