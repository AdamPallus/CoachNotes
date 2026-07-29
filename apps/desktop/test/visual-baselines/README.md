# CoachNotes visual regression baselines

`npm run visual:check` launches CoachNotes with an isolated fixture vault and a fixed date, then compares five working surfaces in light and dark mode at 1024, 1280, and 1440 pixels.

The covered surfaces are Mission Control, Client Snapshot, Add Note, Ask, and Onboarding. Runtime captures and failure diffs are written to `output/playwright/regression/`.

Run `npm run visual:update` only for an intentional visual change. Baseline updates belong in their own commit so the appearance change remains reviewable.
