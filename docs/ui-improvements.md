# CoachNotes UI Improvements

Suggestions for polish before the Monday demo and beyond.
Priority: 🔴 = do before Monday, 🟡 = nice to have, 🟢 = later

---

## 🔴 Dark Mode

Add a system-aware dark mode with manual toggle. Health coaches work long hours and many users (including Adam) prefer dark mode.

### Implementation
- Add a `[data-theme="dark"]` attribute on `<html>` with dark CSS custom properties
- Auto-detect `prefers-color-scheme: dark` on launch
- Add a toggle button (🌙/☀️) in the topbar actions
- Persist preference in settings (localStorage or Electron store)

### Dark palette suggestion (keep the warm feel)
```css
[data-theme="dark"] {
  --bg: #1a1e22;
  --bg-deep: #14171a;
  --card: rgba(30, 35, 40, 0.92);
  --card-strong: #242a30;
  --text: #e0ddd6;
  --muted: #8a9198;
  --line: rgba(255, 255, 255, 0.1);
  --brand: #2ec4a8;
  --brand-strong: #26a890;
  --alert: #e86750;
}
```

---

## 🔴 Welcome / Empty State

Currently "No note selected" and the default answer text feel like error states. Replace with a friendly onboarding message.

### When no note is selected (detail pane)
Show a centered message:
> **Welcome to CoachNotes** 👋
> Select a client on the left, or search across all notes above.
> Use **Ask** to get AI-powered answers grounded in your actual notes.

### When answer card has no content
> Ask a question about your notes and get a grounded answer with source citations.

Style these with muted text, centered, maybe with a subtle icon.

---

## 🔴 Simplify the Search/Ask Bar

The two input rows with "Sources" spinner and scope dropdown feel cluttered for a non-technical user.

### Option A: Unified search bar
- Single input field with a mode toggle: `Search | Ask | Summarize`
- The mode determines what happens on Enter
- Hide topK (sources count) behind an "Advanced ▾" expandable section
- Default topK to 8, most users won't change it

### Option B: Keep two rows but clean up
- Remove the `Sources` label + number input from the main view
- Move topK to Settings as "Search depth" with a slider
- Make the Ask row visually subordinate (smaller, lighter) so the search bar is clearly primary

---

## 🔴 Topbar Button Cleanup

Too many buttons at equal visual weight. The topbar currently has: New Note, Help, Check Updates, Settings, Rebuild Index.

### Suggested layout
- **Left:** App title + status line
- **Center or right-primary:** New Note button (the main action)
- **Right secondary:** A `⋯` overflow menu containing: Settings, Help, Check Updates, Rebuild Index

Or use a native macOS menu bar for Settings/Help/Updates (Electron supports this well) and keep only New Note + Rebuild Index in the topbar.

---

## 🔴 Demo Dataset

Create 15-20 realistic sample notes across 3-4 fake clients. Put them in a `docs/demo-notes/` folder that can be pointed to as the root folder during the demo.

### Suggested clients (subdirectories)
- `Sarah Mitchell/` — knee rehab, physical therapy progression
- `Jason Rivera/` — nutrition coaching, weight management
- `Emily Chen/` — marathon training, endurance building
- `Marcus Johnson/` — stress management, sleep improvement

### Sample notes format
```markdown
---
date: 2025-12-15
tags: knee, rehab, progress
---
# Session Check-in — Week 6

Sarah reports improved mobility in her left knee. Can now climb stairs
without significant pain. Still experiencing stiffness in the mornings
(~20 min to loosen up).

**Action items:**
- Continue quad strengthening exercises 3x/week
- Add gentle cycling 2x/week for 20 min
- Follow up on anti-inflammatory diet changes from last session

**Mood:** Optimistic, motivated by progress
```

### Good demo questions to prepare
- "How has Sarah's knee been improving over time?"
- "What nutrition advice have I given Jason?"
- "Which clients have mentioned sleep issues?"
- "Summarize Emily's marathon training progress"

---

## 🔴 Answer Card Visual Upgrade

The Q&A with citations is the killer feature — make it feel special.

- Add a subtle left border accent on the answer card (use `--brand` color)
- Slightly larger font for the answer text (14px instead of 13px)
- Make citation chips more visually distinct: pill-shaped, slightly larger, with a hover animation
- Add a "Copy answer" button in the corner

---

## 🟡 Keyboard Shortcuts

- `Cmd+K` → Focus search input
- `Cmd+Enter` → Run Ask on current input
- `Cmd+N` → New Note
- `Escape` → Close any open dialog
- `Cmd+Shift+F` → Focus ask input

Register these via Electron's `globalShortcut` or in-renderer key handlers.

---

## 🟡 Client Sidebar Polish

- Show a colored dot or avatar placeholder next to each client name
- Add note count as a subtle badge
- Show last note date ("Last note: 3 days ago")
- Sort by most recently active client

---

## 🟢 Timeline View

Per-client visual timeline showing note dates on a horizontal axis. Clicking a date opens that note. Helps coaches see gaps in sessions.

---

## 🟢 Export Client Summary

Generate a PDF or markdown summary for a client — useful for handoffs, insurance documentation, or progress reports.

---

## 🟢 Tagging Improvements

- Show tag counts in autocomplete
- Tag filter chips below the search bar
- Color-coded tags
