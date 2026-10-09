# Next release (not shipped)

End of Day finishing touches are assigned to [0.2.24](v0.2.24.md).

## Today banner and deferred clients

Assigned to [0.2.25](v0.2.25.md); not included in 0.2.24.
Desktop-only; no server, model, prompt, or proxy-contract changes.
Tracking: https://trello.com/c/Ac4Azf2a

- Later Today confirms the action and shows a named deferred summary with a
  Review deferred button. Tomorrow clients stay deferred until their date.
- The Today banner hides automatically when today's work is finished, or can
  be dismissed early without losing progress. Resume it from Today in Mission
  Control. Hiding the banner does not change End of Day inclusion.
- Unit and isolated Electron tests cover persistence, explicit resume,
  deferred/future separation, completion, and existing draft/EOD safeguards.

## Separate prototype

Marketing-copy cleanup is a separate build-ready item:
https://trello.com/c/sb70AMs6. Extract and verify the narrow copy changes without
bundling the tab or editor redesign. Preserve useful state and the celebration.

The remaining profile-navigation experiment, broader copy changes, and
structured-editor redesign stay on `codex/ux-reliability-prototype`.
The verified reliability subset is included in 0.2.24.
