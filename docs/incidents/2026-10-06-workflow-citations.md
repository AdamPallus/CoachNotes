# Note-update citation failures: 2026-10-06

## Observed Incident

Liz reported repeated End of Day update failures after installing 0.2.22.
Reference `workflow_mux9ch1w_s9xdkt` matched a production `/workflow` 502 caused by
`WorkflowContractError`: an unrecognized source reference. Logs showed three
submissions with matching source/dashboard sizes, each exhausting two model
attempts. Model responses completed normally: no timeout, output truncation,
or JSON parse failure. This shared validator predates the desktop release.

The actual rejected response is not retained in our application logs, so the
exact citation form in Liz's incident is not known. Do not claim a synthetic
reproduction proves the root cause of her particular failure.

## Reproduced Defect and Repair

- The validator rejected `[intake_source_101, intake_source_302]` as one unknown
  identifier even when both individual IDs were valid. Equivalent separate
  brackets passed. A grouped legacy baseline citation could likewise fail to
  make its individual references available to the validator.
- Normalize grouped references, optional citation wrappers, and surrounding
  whitespace, then validate every exact ID. Mixed valid/unknown references still
  fail. Do not map numeric-only IDs, guess prefixes, drop bad references, or attach
  unrelated sources to claims.
- Align validator fallback IDs with IDs actually presented in the prompt.
- Update prompts enumerate permitted IDs and use a real current-source ID in
  examples instead of the literal `source_id` placeholder.
- Give the existing single retry specific validation feedback, including the
  rejected reference when available. No extra retries or time-budget changes.
- Add privacy-safe failure categories/counts to logs, never source text, rejected
  reference text, dashboard content, or model answers.

## Data Safety and Rollout

This is a server-only hotfix using the existing 0.2.21/0.2.22 request/response
contract. No desktop release, model change, or database migration is required.

The desktop saves its note draft before submitting. On this failure path it
removes the provisional source record and leaves the accepted dashboard
unchanged; the draft remains available. A successful retry must still process
the draft before the new note is considered incorporated into the dashboard.
We cannot verify an individual coach's on-disk draft remotely.

After deployment, ask Liz to retry her preserved draft once. If it still fails,
use the new reference and diagnostic category to investigate; do not tell her
to keep retrying indefinitely or claim her particular case is resolved without
confirmation.

## Verification

- Added regression coverage for grouped/wrapped known references, grouped legacy
  references, trimmed/fallback IDs, unknown IDs, numeric-only IDs, placeholders,
  targeted retry feedback, and privacy-safe diagnostics.
- Full unit suite passed: 34 proxy tests and 29 desktop tests.
- Synthetic real-API local-handler check passed on the first attempt using
  GPT-6 Luna with a 41,582-character generated dashboard. No real client data was
  read or submitted. Output: 1,609 tokens; 13.6 seconds.
- Repeatable synthetic paid smoke check:

```sh
node --env-file=apps/proxy/.env apps/proxy/scripts/smoke-workflow-citations.js --live
# After deployment, using an invite token accepted by production:
node --env-file=apps/proxy/.env apps/proxy/scripts/smoke-workflow-citations.js --live --url https://coach-notes-five.vercel.app
```

The script never reads a vault or logs full prompt/response bodies. Passing a
synthetic test is not confirmation that Liz's preserved draft now succeeds.
