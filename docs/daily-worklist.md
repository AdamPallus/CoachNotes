# Daily Worklist

Implemented on `codex/daily-worklist`; not released. Desktop-only, no proxy
contract, model, or prompt changes. Trello: https://trello.com/c/FOWCsI71

## Coach workflow

Start of Day opens Today in Mission Control. Clients with suggestions are
initially selected; other active clients are searchable. A coach can select a
client simply to review them, without first inventing an action plan. Checking
New message also selects that client; it records the coach's selection, not a
message source or proof of a sent reply.

The suggested order uses the following local signals, not an AI judgment:

1. Overdue coach to-dos (oldest deadlines first).
2. Coach to-dos due today.
3. Open, coach-marked high-priority items.
4. Active flags.
5. Coach-selected new messages.
6. No recorded note for the configured interval (seven local calendar days by
   default), or no recorded note at all.

Client names break ties. A client appears once with all applicable reasons.
Keep on My Radar context is shown, including travel, without silently suppressing
the client. Staleness uses note ingestion timestamps, not the source's historical
date or the dashboard's last edit. It is not evidence of absent communication.
There is no Everfit integration or reliable outbound-message clock.

Drag selected clients or use their up/down buttons to reorder. Suggest Order
reorders the selection explicitly; it never re-adds a client the coach removed.
No automatic re-sorting occurs after the coach changes the order. Settings
control deadline, alert, and stale-note suggestions and a 1-90-day threshold.
Changing rules does not silently rewrite today's chosen selection.

Begin Review opens the first pending client in the chosen order. After starting,
Resume Review returns to the saved pending client. The persistent strip shows
the client and focus/reasons while normal navigation, ASK, sources, and profile
tabs remain available. Resume Client returns after a detour. Next only navigates.
Done for Today means reviewed, not that coach to-dos were completed. Later Today
defers review; Tomorrow carries it to the next day; Skip excludes it from today's
remaining work. Return to Today makes a deferred/reviewed/skipped entry pending
again. Existing deadlines can suggest a skipped client again on a later day.

Weekly Review's Add to Today copies that client's suggested focus and report
week into the worklist. It does not create or complete a coach to-do or regenerate
the review. Archived clients cannot be added.

End of Day starts with the chosen clients (except skips), plus recorded activity.
Its existing note-update/draft workflow is unchanged. Previously imported clients
can be deselected without being re-added on every open. Completed End of Day
reviews reconcile Today, but unfinished drafts/follow-ups and explicitly future
deferrals remain pending. Morning completion never claims that a note was saved.

## Storage and safeguards

`daily_worklists` stores one local-calendar-day plan: ordered entries, selection
reasons, optional weekly focus, message checkbox, status, explicit deferral date,
cursor, start state, and revision. `daily_worklist_settings` stores local rules.
There are no new API calls or telemetry. Existing records are untouched.

Every selection/order/status write persists immediately through IPC and SQLite.
Revision checks reject stale writes. Midnight submissions are rejected and the
renderer reloads today's state. Previous pending/deferred work is offered the
next day; done/skipped work is not carried, though fresh rules can independently
suggest it. Closing the app does not mark work done. Archived/deleted clients
are filtered before returning or saving a plan.

An unfinished note draft prevents a new Done for Today transition. A failed
write restores committed state rather than displaying an unsaved completion.
Real tasks, source files, and note drafts remain owned by their existing flows.
End of Day progress and its daily-worklist reconciliation share a transaction.

## Verification

```sh
npm test
npm run lint
node apps/desktop/scripts/worklist-smoke.mjs
node apps/desktop/scripts/capture-smoke.mjs
npm run visual:check
```

The worklist smoke test uses an isolated Electron fixture and no paid API. It
covers suggested selection, coach reordering, incoming-message selection,
navigation/resume, renderer restart, task-status isolation, saved-draft guards,
End of Day selection/reconciliation, Weekly Review focus, stale revisions,
midnight rejection, archives, and settings. App-only screenshots cover light and
dark themes at 1024 and 1440 pixels. Unit tests cover rule boundaries, date math,
deduplication, coach order, and cross-day carry-forward.

Human review before release: check that suggested ordering matches how Liz wants
to begin, that Next/Done/Later feel distinct, and that returning from a detour is
obvious. No deployment or desktop tag is implied by implementation completion.
