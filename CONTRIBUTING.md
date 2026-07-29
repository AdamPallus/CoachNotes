# Contributing to CoachNotes

## Visual changes

CoachNotes uses `apps/desktop/renderer/tokens.css` as the single theme-token layer. New colors, type sizes, radii, and shadows need a named token; do not add another visual-pass section or a raw value to `styles.css`.

The remaining raw values are tracked legacy debt. `npm run lint` prevents the debt from increasing and limits `!important` to the `[hidden]`, `.sr-only`, and reduced-motion accessibility utilities.

Run `npm run visual:check` for every renderer change. Intentional baseline updates use `npm run visual:update` and belong in a separate commit from the code change.
