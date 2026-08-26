# Liz Feedback v1 — Feature Spec

> **Historical, pre-dashboard-pivot design record.** This document references the former `_client-profile.md`, file-watcher, and vector-search architecture. See [README.md](README.md) for current documentation.

**Source:** Liz's Loom recording, Feb 12 2026
**Priority order:** by user impact × implementation effort

---

## 1. Include Profile Data in Search & Q&A

**Priority:** 🔴 High — unlocks the core value prop (ask questions across all clients)

**Problem:** Profile fields (`_client-profile.md`) are deliberately excluded from the search index (line ~754 of `main.js` — `if (entry.name.toLowerCase() === CLIENT_PROFILE_FILE.toLowerCase()) continue`). Liz tagged a client with "thyroid condition" in the profile, then asked "which clients have thyroid conditions?" — got nothing.

**What to do:**
- Remove the profile exclusion in the file-discovery loop (`collectSupportedFiles`)
- Index `_client-profile.md` like any other note, but with special handling:
  - Generate a synthetic text representation of the profile for embedding. Something like:
    ```
    Client: Sarah Mitchell
    Tags: thyroid condition, postpartum, remote client
    Top Priorities: core stability, return to running
    Ongoing Medical: hypothyroidism (medicated), diastasis recti
    Acute Injuries: (none)
    Future Focus: marathon training
    ```
  - This becomes the chunk text that gets embedded and searched
- The profile should be re-indexed whenever it's saved (already have a watcher — just stop skipping the file)
- In Q&A results, profile matches should cite "Client Profile" not the raw filename `_client-profile.md`

**Files to change:**
- `apps/desktop/src/main.js` — `collectSupportedFiles()` (remove exclusion), add profile-to-text serializer for indexing
- Possibly `runSearch()` to label profile-sourced chunks differently in results

---

## 2. Save AI Answers to Client Notes

**Priority:** 🔴 High — turns Q&A from read-only to a workflow tool

**Problem:** When the AI generates an answer (e.g., "prepare for call with Sarah" or "summarize injury history"), Liz has to manually copy-paste it into a note. She wants a "Save to [Client]" button.

**What to do:**
- Add a "Save as Note" button on the Q&A answer panel
- When clicked:
  - If the question was scoped to a specific client → pre-select that client
  - If scope was "all clients" → show a client picker dropdown
  - Create a new note in that client's folder with:
    - Title: auto-generated from the question (e.g., "Q&A: Thyroid condition clients" or "Call prep: Sarah Mitchell")
    - Content: the AI answer text, with a metadata header noting it was AI-generated and the original question
    - Date: now
  - After saving, show a brief confirmation toast
- The new note gets indexed automatically (watcher already handles new files)

**Files to change:**
- `apps/desktop/renderer/app.js` — add save button to answer UI, client picker if needed
- `apps/desktop/renderer/styles.css` — button styling
- `apps/desktop/src/main.js` — new IPC handler `app:save-answer-as-note` (or reuse `app:create-note` with pre-filled content)

---

## 3. Tags Visible During Q&A (Client Context Sidebar)

**Priority:** 🟡 Medium — improves context awareness while using the app

**Problem:** When asking questions about a client, Liz wants to see their tags and key profile info on screen simultaneously — not switch to the profile tab.

**What to do:**
- When Q&A is scoped to a client, show a compact "client context" strip above or beside the answer area:
  - Client name
  - Profile tags (as colored pills — see #4)
  - Top priorities (as a compact list)
  - Ongoing medical considerations
  - Acute injuries (if any)
- This should be a read-only summary pulled from the profile data (already available via `app:get-client-profile`)
- Should be collapsible so it doesn't eat too much space

**Files to change:**
- `apps/desktop/renderer/app.js` — fetch and render client context when Q&A scope is a specific client
- `apps/desktop/renderer/styles.css` — compact profile summary styling

---

## 4. Custom Tag Colors

**Priority:** 🟡 Medium — visual polish that aids scannability

**Problem:** All tags look the same. Liz wants color-coding by category (medical = one color, personal context = another, etc.).

**What to do:**
- **Option A (simpler, recommended first):** Predefined color categories. Tags that match known medical keywords (injury, condition, thyroid, postpartum, etc.) get one color; personal context tags get another; custom tags get a default. This requires no UI changes for color assignment — it "just works."
- **Option B (full control):** Let users assign colors to individual tags or tag categories. Would need a tag management UI. Save to a config file or app settings.
- Start with Option A. The profile already has a `client_color` field — extend this concept to tag-level coloring.

**Tag color rendering:**
- Wherever tags appear (profile view, client context sidebar, client list), render them as colored pills
- Use a small palette (5-6 distinct colors) mapped to categories:
  - 🔴 Red/coral — medical conditions, injuries
  - 🔵 Blue — training/program related
  - 🟢 Green — goals, milestones
  - 🟡 Yellow — personal context (life events, preferences)
  - 🟣 Purple — administrative (remote, frequency, etc.)
  - ⚪ Gray — uncategorized/default

**Files to change:**
- `apps/desktop/renderer/app.js` — tag rendering with color logic
- `apps/desktop/renderer/styles.css` — colored pill styles
- `apps/desktop/src/main.js` — optional: keyword-to-category mapping config

---

## 5. Interactive Focus Areas (Check/Complete/Drag)

**Priority:** 🟢 Lower — nice UX improvement but the data model already supports it

**Problem:** Focus areas (top priorities, future focus, acute injuries, ongoing medical) are static lists. Liz wants to:
- Check off a priority → it moves to "completed focus"
- Drag from "future focus" → "top priorities"
- Resolved injuries get grayed out with visible history

**What to do:**
- The profile data model already has all the right fields: `topPriorities`, `futureFocus`, `completedFocus`, `acuteInjuries`, `ongoingMedicalConsiderations`
- Add interactive controls to the profile editor:
  - Each item gets a checkbox. Checking it moves the item to `completedFocus` (with a timestamp prefix like "✓ 2026-02-12: core stability")
  - Drag handles on items for reordering within a list
  - Drag between lists (future → top priorities, acute → ongoing, etc.)
  - `completedFocus` items render grayed out with strikethrough
- On any change, save the profile immediately (auto-save, not a save button)
- Consider a simple move-to dropdown as an alternative to drag-and-drop if DnD is too complex for the first pass: "⋮ → Move to Top Priorities / Move to Completed"

**Files to change:**
- `apps/desktop/renderer/app.js` — interactive profile editor (checkboxes, move actions or drag-and-drop)
- `apps/desktop/renderer/styles.css` — completed item styling, drag handles
- `apps/desktop/src/main.js` — `app:save-client-profile` already handles the data; just need to send updated lists

---

## 6. Smart Profile Suggestions (Phase 2)

**Priority:** 🟡 Medium — high perceived magic, but depends on #1 being done first

**Problem:** Keeping client profiles up to date is manual busywork. Liz writes notes after every session — the AI should be able to notice when a note contains profile-relevant info and suggest updates.

**Approach: Lightweight suggestion on note save (cheap, works with mini)**

When a note is saved (new or edited), fire a quick extraction call:
- **Input:** The new/changed note text + current profile YAML (small prompt, ~800 tokens)
- **Prompt:** "Given this session note and the client's current profile, suggest any updates: new tags, new medical conditions, injuries resolved, focus area changes. Return only concrete suggestions or 'none'."
- **Output:** Structured suggestions (add tag X, mark injury Y as resolved, add Z to future focus)
- **UX:** Show a non-blocking suggestion banner below the note editor or in a toast:
  ```
  💡 Suggested profile updates for Sarah:
  + Add tag: "thyroid condition"
  + Add to ongoing medical: "hypothyroidism (medicated)"
  [Apply All]  [Dismiss]  [Review]
  ```
- Tapping "Apply All" writes to the profile. "Review" opens the profile with suggestions highlighted. "Dismiss" logs the skip (useful for tuning later).
- **Cost:** ~600 tokens in, ~100 out per note save. At gpt-5-mini pricing, negligible — maybe $0.001 per note.

**What NOT to do (yet):**
- Don't auto-write to the profile without confirmation — trust needs to be earned
- Don't do full-context reviews across all notes — save that for a future "profile audit" feature with a bigger model
- Don't run on every keystroke — only on note save

**Files to change:**
- `apps/desktop/src/main.js` — new function `suggestProfileUpdates(noteText, clientId)`, hook into note save flow
- `apps/proxy/api/` — new endpoint or reuse `/answer` with a profile-extraction system prompt
- `apps/desktop/renderer/app.js` — suggestion banner UI, apply/dismiss handlers
- `apps/desktop/renderer/styles.css` — banner styling

**Future evolution:**
- **Medium version:** Include last 3-5 notes for richer context (catches "this injury seems resolved" patterns). Still cheap.
- **Heavy version:** Periodic full audit of all client notes → regenerate entire profile. Needs bigger model, longer context. Could be a manual "Audit Profile" button rather than automatic. Good candidate for a future premium tier.

---

## Implementation Notes

**Architecture context:**
- Desktop Electron app: `apps/desktop/src/main.js` (main process), `apps/desktop/renderer/app.js` (renderer)
- Proxy server: `apps/proxy/api/` — handles OpenAI calls (embed, answer, summarize)
- Local SQLite DB with `notes`, `chunks` (embeddings), `clients`, `llm_answers` tables
- Profile stored as YAML frontmatter in `_client-profile.md` per client folder
- File watcher auto-reindexes on changes
- Search: local vector similarity (text-embedding-3-small) + keyword fallback

**Suggested implementation order:**
1. **Profile in search** (#1) — biggest bang, smallest effort, unblocks her core use case
2. **Save answer as note** (#2) — completes the Q&A workflow loop
3. **Tag colors** (#4) — quick visual win
4. **Client context in Q&A** (#3) — builds on #4's tag rendering
5. **Interactive focus areas** (#5) — most UI work, least urgent
6. **Smart profile suggestions** (#6) — Phase 2, depends on #1. High wow-factor once the basics are solid

**Model/cost note:** All of these are frontend or local-indexing changes. None require upgrading the LLM model or increasing API costs. The profile indexing adds a small number of extra chunks per client (one per profile) which is negligible for embedding costs.
