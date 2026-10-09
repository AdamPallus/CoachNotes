# End of Day completion (0.2.24)

## Experience

Show "Your day is wrapped up" immediately after the last selected client is
reviewed, with a short confetti/checkmark flourish. After at least 2.6 seconds,
show an optional, activity-grounded 1-2 sentence closing from the server's Luna
model. There is no loading indicator, blocking state, retry button, advice,
score, streak, sound, or requirement to stay on the screen.

Settings > Celebrate completing End of Day is enabled by default. Disabling it
disables both the flourish and the additional AI request; the normal completion
heading remains. macOS Reduce Motion suppresses the animation but not the text.
Closing the dialog cancels the animation and prevents late UI updates.

## Evidence and persistence

- `wrapup_events` records successful dashboard-update summaries and saved
  follow-up titles/dates in the same SQLite transactions as those actions.
  Failed updates and unsaved drafts are not accomplishments.
- Only selected, active clients contribute. A currently saved note or follow-up
  draft prevents completion. Follow-ups must still exist as open coach tasks;
  undo/delete/change removes the stale event from the closing context. Exact
  duplicate events are collapsed.
- The model receives review/update counts and at most 24 event details, capped
  at 8,000 detail characters. No full dashboards, raw notes, source attachments,
  or client roster are sent. Update summaries can still contain client context.
  The context is limited to wrap-up activity, not all work done that day.
- Three prior successful closings help vary phrasing. The prompt forbids names,
  sensitive details, invented outcomes, advice, or treating a scheduled task as
  already done. Quiet reviews get modest acknowledgments.
- `wrapup_closings` saves one completion snapshot/message per local calendar
  day. First completion consumes the flourish, including when disabled.
  Reopening, adding more clients later, or restarting never regenerates it.
  Viewing a previously completed day does not trigger a request or celebration.
- A durable request claim and in-process promise coalescing prevent duplicate
  paid attempts. A process killed mid-request leaves a silent fallback, not an
  automatic retry. Late messages are saved but never inserted into another view.

## Server boundary

New authenticated, rate-limited `POST /wrapup-closing`. Input is validated and
capped at 12,000 characters. The server selects `DEFAULT_LLM_MODEL`, currently
gpt-6-luna, low reasoning, max 1,000 output tokens including reasoning,
`store: false`, 15-second SDK timeout, no retries. Desktop transport timeout is
20 seconds. Errors/empty/incomplete/oversized output yield no closing text.
No client content or model output is written to server logs.

This is an additive endpoint, not a change to note/ASK contracts. Deploy it
before publishing the desktop that calls it. Existing desktop apps continue to
work. If the endpoint is unavailable, completing End of Day still works normally.
Release 0.2.24 includes this feature. Deploy the additive server endpoint before
publishing the desktop; see [release notes](releases/v0.2.24.md).

## Verification

- `npm test`, `npm run lint`, `npm run visual:check`.
- `npm --workspace apps/desktop run test:closing`: real SQLite eligibility,
  duplicate claims, restart, failures, and settings; isolated Electron UI with
  a delayed mock endpoint, canvas pixel check, reduced motion, light/dark
  screenshots, late completion, reload, and opt-out checks.
- `npm --workspace apps/desktop run test:capture`: actual note update and task
  receipt integration; confirms bounded evidence comes from saved actions.
- Optional paid, synthetic-only smoke: `node --env-file=apps/proxy/.env
  apps/proxy/scripts/smoke-wrapup-closing.js`. Never use real client notes in
  test artifacts. Liz's real-day reaction remains user validation, not a test
  we can substitute with synthetic data.

## Release communication

Adam requested a first-use surprise for Liz. Keep public release notes and
Trello descriptions vague: **"A little extra polish for finishing End of Day."**
Do not preview the animation, personalized text, example output, or screenshots.
After she experiences it, ask whether finishing the review feels different at
the end of a real workday. Do not claim this improves coaching outcomes.
