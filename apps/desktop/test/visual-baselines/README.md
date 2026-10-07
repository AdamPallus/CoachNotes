# CoachNotes visual regression baselines

`npm run visual:check` launches CoachNotes with an isolated fixture vault and a fixed date, then compares fifteen working surfaces in light and dark mode at 1024, 1280, and 1440 pixels.

The covered surfaces include Mission Control, Weekly Review (including grouped, progress, and per-client views), Client Snapshot, Add Note, Ask, Onboarding, archived clients/reviews, End of Day, and daily worklist setup/client review. The Mission Control header also has a geometry check against overlapping text and actions. Runtime captures and failure diffs are written to `output/playwright/regression/`.

Run `npm run visual:update` only for an intentional visual change. Baseline updates belong in their own commit so the appearance change remains reviewable.
