# CoachNotes Ops Notes

## Desktop release/update process

Canonical guide:
- `/Users/pallusa/projects/CoachNotes/docs/release-desktop.md`

Quick steps:
1. Bump desktop version in `/Users/pallusa/projects/CoachNotes/apps/desktop/package.json`.
2. Commit and push `main`.
3. Create and push matching tag (example `v0.1.1`).
4. GitHub Action `Desktop Release` builds DMG/ZIP and uploads release assets.
5. Users click `Check Updates` in app and open/download latest release manually.

## Notes

- Current builds are unsigned/unnotarized.
- macOS may require first-run trust override.
- True auto-install updates are not configured.
