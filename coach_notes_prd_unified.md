# CoachNotes — Local Notes + Semantic Search + LLM Answers (macOS)

## 1) Summary

Build a **macOS desktop app** for a health coach to browse plain-text notes stored in a user-chosen local folder and perform **fast semantic search** over those notes. Notes are associated with **clients** (primary use) but the coach must also be able to search **across clients** (secondary use).  

Embeddings and LLM calls are generated via a small **Vercel-hosted proxy service** (auth via invite token). The app stores embeddings **locally** and runs retrieval locally (vector similarity; optional hybrid keyword).

---

## 2) Target User & Use Cases

### Persona
- **Health Coach** (non-technical) with many clients.
- Writes session notes, program plans, exercise modifications, issues (e.g., knee pain), progress updates.

### Primary Use Cases
1. **Per-client recall:** Search within a client for prior sessions, exercises, cues, restrictions, progress.
2. **Cross-client pattern recall:** Search across all clients for similar conditions/issues (“knee pain”, “shoulder impingement”, etc.).
3. **Browse notes:** Navigate notes in a comfortable UI organized by client/tags/folders and view plain text.
4. **Ask questions:** Ask a question and receive a grounded answer with citations back to note chunks.
5. **Summarize:** Summarize search results or recent sessions with citations.

---

## 3) Goals / Non-Goals

### Goals
- macOS app that:
  - Lets user select a **root notes folder**
  - Indexes notes (Markdown/plain text) into chunks
  - Calls embedding proxy to create embeddings
  - Stores embeddings locally and supports semantic search with filters (client / tags)
  - Provides a simple browsing UI for notes + search results
  - Provides **LLM Answers/Summaries** grounded in retrieved chunks
- Vercel proxy service that:
  - Validates an invite token
  - Calls OpenAI (or equivalent) for **embeddings** and **LLM answers/summaries**
  - Returns embeddings/answers
  - Does not persist note text

### Non-Goals (initial version)
- Multi-device sync
- Real-time collaboration
- Full-featured note editor (view-only is OK for v1)
- Mobile app
- Compliance claims (HIPAA, etc.)

---

## 4) Key Product Decisions

### 4.1 Notes remain as files on disk
- App reads from a user-selected folder; it does **not** replace a file-based note system.
- Coach can organize notes in Finder however she wants. App adds client association + tags without forcing a rigid structure.

### 4.2 Client association is flexible
Support three ways to determine which client(s) a note belongs to:
1) **Folder-based (default):** First-level subfolder under root = client name
   - Example: `/Notes/Clients/Alice Smith/...`
2) **Inline metadata (optional):** YAML front matter or tags in note text
   - Example YAML:
     - `client: "Alice Smith"`
     - `clients: ["Alice Smith", "Bob Jones"]`
     - `tags: ["knee", "rehab"]`
3) **App-assigned override:** User can assign client(s) to a note inside the app; stored locally in the app DB (does not modify the file).

Client association resolution order:
- If app override exists → use override
- Else if inline metadata exists → use inline
- Else use folder-based

### 4.3 Embeddings stored locally; retrieval runs locally
- The app calls the server only for embeddings/LLM.
- Search ranking is local using stored embeddings.
- Q&A is done by sending **question + top retrieved chunks** to the server.

---

## 5) Requirements — macOS App

### 5.1 File Ingestion & Indexing
- User selects a **root folder** containing notes.
- Supported file types (v1): `.md`, `.txt` (optionally `.markdown`).
- App must:
  - Scan supported files under root recursively
  - Maintain an **index state** per file (path, last modified time, size/hash)
  - Incrementally re-index only changed files
  - Watch for file changes (file system events) and schedule re-index
  - Show indexing progress and errors

#### Chunking
- Split note into chunks for embeddings.
- Chunk rules:
  - Prefer splitting on headings/paragraph boundaries
  - Target size: ~300–800 tokens (or roughly 1–3k chars)
  - Overlap ~10–15% for continuity
  - Store chunk text, offsets, and display snippet
- Include lightweight context in the chunk text sent to embeddings:
  - Note title (filename or first heading)
  - Client name(s) (if known)
  - Date (if parseable)
  - Then chunk body

#### Metadata Extraction
Extract (best-effort):
- Title: filename without extension (or first `# Heading` if present)
- Date: from filename patterns (`YYYY-MM-DD`) or YAML `date:`
- Tags: YAML `tags:` and/or inline hashtags (configurable)
- Client(s): via resolution order described above

### 5.2 Local Data Storage
- Use a local database (recommended: SQLite).
- Store:
  - Notes table
  - Chunks table (with embeddings)
  - Clients table
  - Tags table + join tables
  - Overrides table (note → clients/tags overrides)

#### Vector Storage & Search
- Store embeddings locally (float arrays) and support efficient top-K similarity.
- Acceptable approaches:
  - SQLite + vector extension
  - Local HNSW index persisted alongside DB
  - DuckDB + vector extension
- Requirement: return top 20–50 results under ~200ms on typical dataset sizes (few thousand notes) after warmup.

### 5.3 Search

#### Search Modes
1) **Client-scoped semantic search (default):** Choose a client, search within that client.
2) **Cross-client semantic search:** Global scope across all clients.
3) **Hybrid (recommended):** Combine keyword (BM25-ish) + semantic ranking.

#### Query Embedding
- On search, embed the query via the proxy service and compute similarity locally.

#### Filtering & Facets
- Filters:
  - Client (single / multi-select)
  - Tag(s)
  - Date range (optional v1)
- Facets counts are nice-to-have.

#### Result Rendering
Each result must show:
- Client name(s)
- Note title
- Date (if known)
- Snippet from best matching chunk
Actions:
- Open note in app
- Jump to chunk highlight
- Reveal in Finder
- Copy snippet / copy file path

### 5.4 Browsing UI (macOS)

#### Suggested Layout
- Left sidebar:
  - Clients list (with search)
  - Tags list (optional)
  - “All Clients” entry
- Top bar:
  - Search input
  - Scope toggle: “This Client” / “All Clients”
  - Filter button (tags, date)
- Main pane:
  - Notes list or search results
- Right/detail pane:
  - Plain text viewer
  - Jump-to-chunk highlight from search results

#### Client Management
- Rename display name (without changing folder names)
- Merge clients (optional)
- Show per-client note count and last updated

#### Note Overrides
- UI to set overrides (stored locally, does not modify file):
  - Assign client(s)
  - Add/remove tags

### 5.5 Settings
- Root notes folder path
- Proxy server base URL
- Invite token (stored in macOS Keychain)
- Indexing status + rebuild index button
- Advanced: chunk size preset (optional)

---

## 6) Requirements — LLM Answers & Summaries

### 6.1 Answer Modes
- **Q&A Mode (default):** One question → answer + citations.
- **Summarize Results Mode:** Summarize top-N retrieved chunks with citations.
- **Client Summary Mode (nice-to-have):** “Summarize last X sessions” by client/date filter.

### 6.2 Grounding & Citations (must-have)
- The model must:
  - Use **only** the provided chunks as source of truth
  - Provide citations for every major claim
  - If info is missing, say so and cite relevant chunks (or state not found)

Citation format:
- Inline markers referencing chunk IDs, e.g. `... [c:chunk_17]`
- App must map `chunk_id → note path + offsets` so citations are clickable.

### 6.3 Anti-hallucination Requirements (must-have)
- System instruction:
  - “If not present in sources, respond: ‘Not found in the provided notes.’”
  - “Never invent numbers, dates, exercises, or client specifics.”
  - “Avoid diagnosis; summarize what notes say.”

### 6.4 UX Requirements (macOS)

#### Ask Panel
- An **Ask** UI integrated into search:
  - Question input
  - Scope toggle: This Client / All Clients
  - Optional slider: number of sources (5–12)
  - “Answer” button

#### Answer View
- Rendered answer text
- Clickable citations list (note title + client + date)
- Actions: copy answer, copy with citations
- Transparent “Sources used” section with expandable chunk text

### 6.5 Local Storage Additions
Recommended tables:
- `llm_answers`:
  - `id`, `created_at`, `question_text`, `scope`, `retrieval_params` (json), `model`, `answer_text`, `citations` (json), optional `source_snapshot`
- Optional: `chunk_summaries`:
  - `chunk_id`, `model`, `summary_text`, `updated_at` (invalidate if chunk hash changes)

### 6.6 Retrieval + Answer Flow
1) User enters question.
2) App retrieves locally:
   - embed query via `/embed`
   - top-K by similarity (plus optional keyword blend)
   - apply filters
3) App sends question + selected source chunks to `/answer`.
4) Server returns answer + citations.
5) App renders answer; citations jump to exact file/chunk.

### 6.7 Performance Targets
- Typical Q&A: <2.5s (depends on model + network).
- App remains responsive during indexing.
- Optional streaming output: nice-to-have.

### 6.8 Error Handling
- If `/answer` fails:
  - show error and keep sources list visible
  - fallback: show top results only
- If request too large:
  - auto-reduce sources and retry once

---

## 7) Requirements — Vercel Proxy Service

## 7.1 Purpose
A thin service that:
- Validates an invite token
- Forwards text to OpenAI for **embeddings** and **LLM answers/summaries**
- Returns embeddings/answers
- Does not persist note text

### 7.2 Authentication (Invite Token)
- Client sends: `Authorization: Bearer <INVITE_TOKEN>`
- Server checks token against allowlist (env var or KV store)
- Token rotation: allow multiple valid tokens simultaneously

### 7.3 Rate Limiting / Abuse Prevention
- Per-token rate limit (e.g., 60 req/min)
- Max batch size and max total input size
- Log only metadata by default (timestamp, hashed token id, input length, status)
- Do not log raw text

### 7.4 API Contract

#### `GET /health`
Returns 200 with `{ "ok": true }`.

#### `POST /embed`
Request:
```json
{
  "model": "text-embedding-3-small",
  "inputs": [
    { "id": "chunk_001", "text": "..." },
    { "id": "chunk_002", "text": "..." }
  ]
}
```
Response:
```json
{
  "model": "text-embedding-3-small",
  "data": [
    { "id": "chunk_001", "embedding": [0.01, -0.02, ...] },
    { "id": "chunk_002", "embedding": [ ... ] }
  ]
}
```
Rules:
- Batch inputs allowed (recommended).
- Enforce max items per request (e.g., 32) and max total text size.

#### `POST /answer`
Request:
```json
{
  "model": "gpt-5-mini",
  "question": "What program did I use for knee pain?",
  "instructions": "Optional user preferences",
  "sources": [
    {
      "chunk_id": "chunk_17",
      "note_id": "note_002",
      "client_ids": ["alice"],
      "title": "2026-01-10 Session",
      "date": "2026-01-10",
      "text": "..."
    }
  ],
  "response_format": "coachnotes.v1"
}
```
Response:
```json
{
  "model": "gpt-5-mini",
  "answer": "... [c:chunk_17] ...",
  "citations": ["chunk_17", "chunk_03"],
  "structured": {
    "bullets": ["...", "..."],
    "warnings": ["Not found in sources: X"]
  }
}
```
Rules:
- Default: require `sources`.
- Enforce max sources (e.g., 12) and max total text size.

#### `POST /summarize`
Request:
```json
{
  "model": "gpt-5-mini",
  "mode": "search_results_summary",
  "sources": [ { "chunk_id": "...", "text": "..." } ]
}
```
Response:
```json
{
  "model": "gpt-5-mini",
  "summary": "... [c:chunk_12] ...",
  "citations": ["chunk_12", "chunk_19"]
}
```

### 7.5 Model Configuration
- Default embeddings model: `text-embedding-3-small`
- Default LLM model: **GPT-5 mini**
- Allow overriding via request field (optional) but keep server-side allowlist.

### 7.6 Prompting Contract (Server-Side)
- Server uses a fixed system prompt enforcing:
  - Use only provided sources
  - Cite every major claim with `[c:chunk_id]`
  - If missing, say not found
  - No diagnosis language; summarize notes

---

## 8) Privacy & Security Considerations
- Notes may contain sensitive information.
- App:
  - Stores invite token in Keychain
  - Stores embeddings/metadata locally
  - Clear disclosure: note chunks are sent to proxy + OpenAI for embeddings/answers
- Server:
  - Avoid persisting note text
  - Avoid verbose logging
  - HTTPS only

---

## 9) Performance Targets
- Indexing: progress UI; resumable; background processing.
- Search: top 20–50 results under ~200ms locally.
- Q&A: typical <2.5s.

---

## 10) Error Handling & Resilience
- Proxy unreachable:
  - browsing still works
  - search can fall back to keyword-only if implemented
- Partial failures:
  - per-file errors recorded
  - retry with backoff
- File moves/renames:
  - preserve overrides when feasible

---

## 11) Success Criteria (Acceptance Tests)
1. User selects folder; indexing completes; status shows “Up to date.”
2. Client search: “knee pain” returns relevant results within that client.
3. Global search: “knee pain” returns results across clients with client labels.
4. Browse by client; open note; view plain text.
5. Edit note; app re-indexes only that note; search reflects update.
6. Invite token auth works; invalid token returns 401.
7. Ask: “What did we do last time?” returns answer with citations that open the right chunks.
8. Ask absent info: returns “Not found in the provided notes.” (no hallucination).

---

## 12) Proposed Milestones

### MVP-1: Local Browsing + Index Skeleton
- Folder picker, file scan, note list, note viewer
- Local DB schema, change detection, indexing progress

### MVP-2: Proxy Service (Vercel)
- `/health`, `/embed`
- Invite token auth + basic rate limit

### MVP-3: Semantic Search
- Chunking + embedding generation
- Local vector index + search UI + results display

### MVP-4: Client/Tag System
- Folder-based clients + UI filters
- Overrides UI for client assignment + tags
- Cross-client search toggle

### MVP-5: LLM Answers & Summaries
- `/answer`, `/summarize`
- Ask panel + citation navigation
- Local history of Q&A (optional)

### Polish
- Hybrid search
- Better snippets/highlighting
- Rebuild index, error diagnostics
- Streaming answers (optional)

