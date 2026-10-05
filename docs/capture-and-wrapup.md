# Capture and daily wrap-up

Introduced in 0.2.21. See [release notes and coach testing checklist](releases/v0.2.21.md).

The follow-up scheduling, Next controls, and shared field microphones below are unreleased desktop-only improvements. Version 0.2.21 remains the public release; no proxy deployment or API changes are needed for these refinements.

## Coach workflows

- **End of Day**, in Mission Control: select the day, review the clients with activity in CoachNotes, and add other clients worked with elsewhere. Add Update runs the normal AI dashboard update. Next completes a reviewed client with no unfinished work; Later defers them. The note editor offers Update Dashboard & Next or Save Draft & Next. Saving a draft advances to another client but keeps the original client pending, with an explicit notice that the dashboard has not been updated. Selection, deferred clients, and completion survive closing or restarting the app.
- **Follow-up to schedule**, on each wrap-up step, creates an ordinary active Coach To-Do with no automatic priority. The due date defaults to tomorrow on the computer's local calendar (even when reviewing an older day) and is editable. Add Follow-up saves immediately, without an AI call; Mission Control uses its existing upcoming/due/overdue rules. Unsaved follow-up text survives closing/restarting, but is not a scheduled task until added. Next does not silently skip unfinished notes or follow-ups. The footer navigation stays visible while activity scrolls.
- **Images**, **Screenshot**, and image paste are available in Add Note. Screenshot hides CoachNotes and opens macOS region selection. The image is previewed before submission. It is saved alongside the raw source in the client's vault and can be opened from Session Notes. No additional annotation is required.
- **Dictation** uses a microphone icon inside longer prose fields: ASK requests and follow-ups, note text and annotations, onboarding source text and coach notes, to-do details, radar details, narrative profile/intake edits, and coaching/message/curriculum guidance. Short titles, tags, dates, raw JSON, and format-sensitive list/object editors do not have microphones. Recording displays an audio-level waveform and timer; clicking the stop icon transcribes. Five minutes automatically ends recording. Transcription only fills editable text, never submits a form. Existing typed edits are preserved. Transcripts exceeding a field's length limit stay available for retry instead of being truncated.
- **Dictation recovery** keeps failed or interrupted audio locally, associated with its client and field. Closing a form stops its microphone. Returning to the field offers Transcribe recording or Discard; a late response cannot insert text into a different client or closed form. Note/annotation recordings use the existing durable note draft and its Transcribe controls. Other fields keep pending audio across restarts, but successfully inserted text follows that form's normal save behavior (ASK is not an autosaved draft).
- **Weekly Review** is also a client-profile tab. It displays that client's portion of the latest saved report, its generation date, and a notice if the profile has changed since generation. Full Weekly Review returns to the report without regenerating it.
- **ASK** supports five follow-ups after an initial answer. Previous questions, answers, and citations remain visible. Copy and Save as Note act on the latest answer. New ASK retrieves fresh context. Opening a source and returning to ASK retains the conversation during the current app session.

## Data and AI boundaries

Daily activity uses source ingestion time and manual-edit timestamps in the computer's local timezone, not the source's historical date. The wrap-up does not infer Everfit activity, create client messages, mark coach tasks complete, or call AI until a note is submitted. Undo history is bounded, so a profile-update timestamp supplies a fallback when detailed edits are no longer present.

Images are normalized to JPEG, at most 2400 pixels on the longest edge and 2 MiB, with up to six images per note. `/capture` asks the server-selected Luna model to extract visible source information, marking unclear text and not guessing prior workouts or what changed. This text is combined with the coach's note for the existing dashboard update. ASK can retrieve the extracted text as part of the source; it does not re-send images on every question. This is useful extraction, not a guarantee that every screenshot detail is legible or preserved.

Audio is recorded as compressed WebM/Opus on Electron, with MP4 fallback, at a requested 24 kbps. The desktop bounds it to five minutes and 2 MiB. Renderer and main-process timers are independent; after the main deadline, an unresponsive renderer is reloaded after a ten-second final-chunk grace period to release the microphone. Audio is checkpointed locally as chunks arrive. Sleep/close stops recording. Permission is requested only after clicking Dictate. The transcription request uses `gpt-transcribe`, not a Realtime session, and has a 120-second API timeout with no automatic SDK retries.

For notes and annotations, raw audio is removed after its transcript is durably saved into the note draft. Other field recordings are removed after their text is inserted; saving/submitting those forms remains a separate action. Images are copied into the vault before their temporary capture files are removed on successful dashboard update. Pending captures live under the app's `capture-drafts` directory, not a remote media store. Explicit removal/discard clears their temporary files; unreferenced files left by an interrupted operation are not automatically purged in this version.

Drafts, daily sessions, and successful note-request receipts are stored in SQLite (`note_drafts`, `daily_wrapups`, `note_receipts`). A request ID prevents a completed note from being submitted twice after a renderer refresh failure. Dashboard changes, receipt, draft removal, and wrap-up completion commit in one transaction. A late autosave cannot resurrect a completed draft. Audio checkpointing and draft autosave substantially reduce loss but cannot guarantee the final unsaved milliseconds survive a hard process/device crash.

Follow-up creation appends to the latest saved Coach To-Dos, retaining undo behavior. The task, request receipt (`wrapup_task_receipts`), and clearing of its wrap-up draft share a SQLite transaction. Retrying the same request does not append another task. A failed save leaves the text/date available; a post-save refresh failure is reported as a refresh problem, not an invitation to add a duplicate.

ASK history is in desktop memory, bounded to six answers, 48,000 history characters, and 20 sessions. Instructions, reference date, and selected sources are fixed before the first question and kept unchanged through follow-ups. Follow-ups do not retrieve new source material; start a new ASK for a different context. This preserves exact prompt prefixes for automatic caching, but cache hits and savings are not guaranteed. Logs contain model, turn count, duration/size or token counts, not client names, transcripts, screenshots, prompts, or answers.

## Deployment and validation

This needs both desktop and proxy updates: the new `/capture` route and `/answer` history support. Existing one-shot ASK clients remain valid. Deploy the proxy before using the new desktop features; coordinate the release normally and do not push `main` merely to try the UI. No new secret or model allowlist setting is needed. The server API key must have permission to use transcription and Luna image input. macOS builds include `NSMicrophoneUsageDescription`.

Checks:

```sh
npm test
npm run lint
node apps/desktop/scripts/capture-smoke.mjs
npm run visual:check
```

The integration smoke test uses an isolated fixture vault, fake microphone, and local mock proxy. It tests image paste/persistence, failed updates and transcription, durable drafts across renderer restart, field-specific dictation, pending ASK audio recovery, cross-client late-response isolation, length limits, microphone release on close, idempotency, six-turn ASK limits, saved weekly context, and wrap-up completion. It never calls the paid API or changes the real vault/keychain.

An explicit paid smoke test is available for **synthetic** image/audio fixtures only:

```sh
node --env-file=apps/proxy/.env apps/proxy/scripts/smoke-capture.js --live /absolute/workout.jpg /absolute/note.wav
```

Local real-API checks passed with a demo workout image and a 6.6-second synthetic spoken note. Before shipping, manually verify native region selection/cancel and macOS microphone permission on the packaged app, and have a coach confirm screenshot readability and dictation quality in normal use. Automated fake-microphone tests do not establish those OS/human checks.

The current local review instance uses 22 generated demo clients in `output/capture-preview/user-data` and a separate vault at `output/capture-preview/vault`, with the proxy at `http://localhost:3011`. These ignored local files are not shipped. The regular CoachNotes vault is unchanged. To reopen this preview after stopping it, run the updated local proxy with the existing API credentials and matching invite token, then launch the desktop with `COACHNOTES_VISUAL_USER_DATA="$PWD/output/capture-preview/user-data" npm run dev:desktop` from the repository root. Do not set `COACHNOTES_VISUAL_FIXTURE=1` for a persistent review instance: that flag resets the automated-test fixture on startup.
