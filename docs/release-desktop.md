# Desktop Release Flow (GitHub)

## What is configured

- GitHub Actions workflow: `.github/workflows/desktop-release.yml`
- Builds unsigned macOS artifacts on:
  - tag push: `v*` (creates GitHub Release + uploads assets)
  - manual workflow run (uploads workflow artifacts)
- In-app button: `Check Updates` checks latest GitHub Release and opens release page when a newer version exists.

## Release process

1. Bump the matching version in:
   - `package.json`
   - `apps/desktop/package.json`
   - the root and desktop package entries in `package-lock.json`
2. Run the release checks:

```bash
npm test
npm run lint
npm run visual:check
git diff --check
npm --workspace apps/desktop run dist:mac
```

3. For a desktop-only release, commit and push `main`.
4. Create and push a version tag matching that version:

```bash
git tag v0.2.0
git push origin v0.2.0
```

5. Wait for workflow `Desktop Release` to finish.
6. Check GitHub Releases for arm64/x64 DMG and ZIP assets.

## Coordinated proxy and desktop release

The production Vercel project deploys from `main`. A breaking proxy contract must therefore be staged without pushing `main`:

1. Create a `codex/vX.Y.Z-staged` branch from the current `main` and commit the complete server/desktop release there.
2. Push the staged branch and its matching `vX.Y.Z` tag. The tag builds the GitHub desktop release; the branch may create a Vercel preview, but production remains on `main`.
3. Verify the GitHub release assets. Ask the user to download the installer, close CoachNotes, and confirm readiness. Do not have them use the new desktop against the old proxy.
4. Fast-forward `main` to the staged commit and push. This intentionally starts the Vercel production deployment.
5. Verify the production deployment and `/health`, then have the user install/open the new desktop.
6. Run a real note-update smoke test and inspect privacy-safe workflow diagnostics.

Do not merge the staged branch into `main` before the user is ready. The old and new note-update contracts are intentionally not backward compatible.

## User update flow

- User opens app and clicks `Check Updates`.
- If a newer GitHub release exists, app prompts to open the release page.
- User downloads and installs new DMG manually.

## Notes

- Builds are unsigned/unnotarized (no Apple Developer account required).
- macOS may require first-run trust override (`Right-click -> Open`).
- Auto-download/auto-install updates are not configured.
