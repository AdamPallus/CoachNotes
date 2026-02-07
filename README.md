# CoachNotes

CoachNotes is a local macOS notes app for health coaches with:
- File-based note browsing (`.md`, `.txt`, `.markdown`)
- Local SQLite indexing + chunking
- Local semantic retrieval over stored embeddings
- Grounded Q&A and summaries with source citations
- Thin Vercel proxy for OpenAI embeddings + answers

## Project Layout

- `apps/desktop`: Electron desktop app (local DB, indexing, search, UI)
- `apps/proxy`: Vercel-ready API (`/health`, `/embed`, `/answer`, `/summarize`)

## Requirements

- Node.js 20+
- npm 10+
- macOS (desktop app uses Keychain via `security` CLI)
- OpenAI API key for proxy server

## Local Setup

```bash
npm install
```

### 1) Run proxy locally

```bash
cp apps/proxy/.env.example apps/proxy/.env
# fill OPENAI_API_KEY and INVITE_TOKENS
cd apps/proxy
set -a; source .env; set +a
npm run dev
```

Proxy runs at `http://localhost:3001`.

### 2) Run desktop app

In a new terminal:

```bash
npm run dev:desktop
```

In app settings:
- Set `Root Notes Folder`
- Set `Proxy Base URL` (`http://localhost:3001` local or Vercel URL)
- Set `Invite Token` to one value from `INVITE_TOKENS`

Then click `Save & Reindex`.

## Proxy API Contract

- `GET /health` => `{ "ok": true }`
- `POST /embed` with `{ model, inputs: [{ id, text }] }`
- `POST /answer` with `{ model, question, instructions?, sources[] }`
- `POST /summarize` with `{ model, mode, sources[] }`

All protected by `Authorization: Bearer <INVITE_TOKEN>`.

## Deploy Proxy to Vercel

See `docs/deploy-vercel.md`.
