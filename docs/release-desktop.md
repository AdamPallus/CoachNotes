# Desktop Release Flow (GitHub)

## What is configured

- GitHub Actions workflow: `.github/workflows/desktop-release.yml`
- Builds unsigned macOS artifacts on:
  - tag push: `v*` (creates GitHub Release + uploads assets)
  - manual workflow run (uploads workflow artifacts)
- In-app button: `Check Updates` checks latest GitHub Release and opens release page when a newer version exists.

## Release process

1. Ensure desktop version is bumped in:
   - `apps/desktop/package.json` (`version`)
2. Commit and push.
3. Create and push a version tag matching that version:

```bash
git tag v0.2.0
git push origin v0.2.0
```

4. Wait for workflow `Desktop Release` to finish.
5. Check GitHub Releases page for generated DMG/ZIP assets.

## User update flow

- User opens app and clicks `Check Updates`.
- If a newer GitHub release exists, app prompts to open the release page.
- User downloads and installs new DMG manually.

## Notes

- Builds are unsigned/unnotarized (no Apple Developer account required).
- macOS may require first-run trust override (`Right-click -> Open`).
- Auto-download/auto-install updates are not configured.
