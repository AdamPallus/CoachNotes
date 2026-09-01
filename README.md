# CoachNotes

CoachNotes is a local-first macOS app for health coaches. The desktop app stores client source material locally, turns messy notes into an editable client dashboard, and uses a small hosted proxy for AI workflows.

Current focus:

- Onboard one client at a time from pasted text or imported files.
- Save raw client sources locally.
- Generate a structured client profile with source-linked dashboard sections.
- Edit dashboard sections directly, with per-section undo.
- Add new notes later and let AI update only the dashboard sections supported by the new evidence.
- Track coach to-dos, flags, client goals, client values, coaching plan/approach, progress, engagement, resources, and coaching-domain threads.
- Generate a locally saved weekly client review from compact structured dashboard context, without sending raw note bodies.

## Architecture

- `apps/desktop`: Electron macOS desktop app with local SQLite storage and a local vault.
- `apps/proxy`: Vercel API proxy for OpenAI requests.
- `docs`: deployment and release notes.

The desktop app owns the local data. The proxy receives only the context needed for the AI operation being run. Initial intake returns a complete baseline. Later note updates return a validated partial-update contract: unchanged dashboard sections are omitted, new array items can be appended, and the desktop applies the patch locally.

## Requirements

- macOS for the desktop app.
- Node.js 20+ and npm 10+ for development.
- An OpenAI API key for the proxy.
- An invite token configured both in the proxy environment and the desktop app settings.

## Local Development

Install dependencies:

```bash
npm install
npm test
```

Run the proxy:

```bash
cp apps/proxy/.env.example apps/proxy/.env
# Fill OPENAI_API_KEY and INVITE_TOKENS in apps/proxy/.env
cd apps/proxy
set -a; source .env; set +a
npm run dev
```

Run the desktop app in another terminal:

```bash
npm run dev:desktop
```

In CoachNotes settings, set:

- Proxy base URL: `http://localhost:3011` for local development, or the Vercel deployment URL for production.
- Invite token: one value from `INVITE_TOKENS`.

## Proxy API

Public:

- `GET /`
- `GET /health`

Authenticated with `Authorization: Bearer <INVITE_TOKEN>`:

- `POST /workflow`
- `POST /weekly-review`
- `POST /embed`
- `POST /answer`
- `POST /summarize`

The current desktop intake and note-update flows use `/workflow`. `client_intake_baseline` returns a complete dashboard. `client_note_update` returns `client_update_patch.v1`, containing only validated `sectionUpdates` rather than reproducing the complete dashboard.

Mission Control uses `/weekly-review` for the on-demand portfolio briefing. See [docs/weekly-client-review.md](docs/weekly-client-review.md) for its data boundary, judgment rubric, and evaluation workflow.

## Deployment

- Vercel proxy deployment: [docs/deploy-vercel.md](docs/deploy-vercel.md)
- Desktop release flow: [docs/release-desktop.md](docs/release-desktop.md)
- Documentation index: [docs/README.md](docs/README.md)
- Version 0.2.16 release notes: [docs/releases/v0.2.16.md](docs/releases/v0.2.16.md)

## Release Notes

Desktop builds are currently unsigned and distributed through GitHub Releases. macOS may require a first-run trust override.
