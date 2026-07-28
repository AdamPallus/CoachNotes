# CoachNotes

CoachNotes is a local-first macOS app for health coaches. The desktop app stores client source material locally, turns messy notes into an editable client dashboard, and uses a small hosted proxy for AI workflows.

Current focus:

- Onboard one client at a time from pasted text or imported files.
- Save raw client sources locally.
- Generate a structured client profile with source-linked dashboard sections.
- Edit dashboard sections directly, with per-section undo.
- Add new notes later and let AI update the existing dashboard.
- Track coach to-dos, flags, goals/values, coaching plan/approach, progress, engagement, resources, and coaching-domain threads.

## Architecture

- `apps/desktop`: Electron macOS desktop app with local SQLite storage and a local vault.
- `apps/proxy`: Vercel API proxy for OpenAI requests.
- `docs`: deployment and release notes.

The desktop app owns the local data. The proxy receives only the context needed for the AI operation being run.

## Requirements

- macOS for the desktop app.
- Node.js 20+ and npm 10+ for development.
- An OpenAI API key for the proxy.
- An invite token configured both in the proxy environment and the desktop app settings.

## Local Development

Install dependencies:

```bash
npm install
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
- `POST /embed`
- `POST /answer`
- `POST /summarize`

The current desktop intake and note-update flows use `/workflow`.

## Deployment

- Vercel proxy deployment: [docs/deploy-vercel.md](docs/deploy-vercel.md)
- Desktop release flow: [docs/release-desktop.md](docs/release-desktop.md)

## Release Notes

Desktop builds are currently unsigned and distributed through GitHub Releases. macOS may require a first-run trust override.
