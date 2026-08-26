# CoachNotes Ops Notes

## Desktop release/update process

Canonical guide:
- `/Users/pallusa/projects/CoachNotes/docs/release-desktop.md`

Quick steps:
1. Read the canonical guide and determine whether the release changes the proxy contract.
2. Bump the root, desktop, and lockfile versions together.
3. For desktop-only changes, push `main` and the matching tag normally.
4. For coordinated proxy/desktop changes, tag a staged `codex/` branch first; do not push the proxy commit to `main` until the user is ready for the server cutover.
5. GitHub Action `Desktop Release` builds DMG/ZIP and uploads release assets.
6. Users click `Check Updates` in app and open/download the latest release manually.

## Notes

- Current builds are unsigned/unnotarized.
- macOS may require first-run trust override.
- True auto-install updates are not configured.
