# Deploy CoachNotes Proxy to Vercel

## 1) Push repo to GitHub

From project root:

```bash
git init
git add .
git commit -m "Initial CoachNotes app and proxy"
# create remote repo, then
git remote add origin <your-repo-url>
git push -u origin main
```

## 2) Create Vercel project

1. Open Vercel dashboard.
2. Click **Add New > Project**.
3. Import your GitHub repo.
4. Set **Root Directory** to `apps/proxy`.
5. Framework preset can stay **Other**.

## 3) Configure environment variables (Project Settings > Environment Variables)

- `OPENAI_API_KEY`: your OpenAI API key
- `INVITE_TOKENS`: one or more comma-separated tokens (example: `tokenA,tokenB`)
- `RATE_LIMIT_PER_MIN`: `60`
- `EMBED_MODEL_ALLOWLIST`: `text-embedding-3-small`
- `LLM_MODEL_ALLOWLIST`: `gpt-5.4-mini,gpt-5.6-luna`

## 4) Deploy

Click **Deploy**.

Once deployed, your base URL will look like:

`https://<project-name>.vercel.app`

## 5) Verify endpoints

```bash
curl https://<project-name>.vercel.app/health
```

Expected:

```json
{"ok":true}
```

If you get `NOT_FOUND`, check these two things:
1. Vercel project **Root Directory** is exactly `apps/proxy`.
2. Redeploy after pulling latest `apps/proxy/vercel.json` (it maps `/health` to `/api/health`).

Auth-protected routes:

```bash
curl -X POST https://<project-name>.vercel.app/workflow \
  -H "Authorization: Bearer <one-token-from-INVITE_TOKENS>" \
  -H "Content-Type: application/json" \
  -d '{"workflow":"client_intake_baseline","client":{"name":"Test Client"},"sources":[{"source_id":"test_1","title":"Test note","source_type":"notes","text":"Client wants a simple plan."}]}'
```

## 6) Point desktop app to Vercel

In CoachNotes desktop Settings:
- `Proxy Base URL` => `https://<project-name>.vercel.app`
- `Invite Token` => token from `INVITE_TOKENS`
- Save, then run intake or add a note.
