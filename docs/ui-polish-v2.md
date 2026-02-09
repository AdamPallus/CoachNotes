# CoachNotes UI Polish — V2 Consultant Spec

Prepared by: Sonja (design consultant)
Date: Feb 8, 2026
Context: Monday 10am demo. The app is functional and well-structured. These changes take it from "impressive prototype" to "professional product I'd pay for."

Priority: 🔴 = before Monday demo, 🟡 = nice-to-have, 🟢 = post-demo

---

## 🔴 1. Unified Search/Ask Bar

**Problem:** Two separate text inputs (search + ask) is confusing for non-technical users. "Which one do I type in?" shouldn't be a question.

**Solution:** Single input with a mode selector.

### Structure

```html
<div class="search-card card">
  <div class="search-bar">
    <div class="mode-selector" role="radiogroup" aria-label="Search mode">
      <input type="radio" name="searchMode" id="modeSearch" value="search" checked />
      <label for="modeSearch">Search</label>
      <input type="radio" name="searchMode" id="modeAsk" value="ask" />
      <label for="modeAsk">Ask</label>
      <input type="radio" name="searchMode" id="modeSummarize" value="summarize" />
      <label for="modeSummarize">Summarize</label>
    </div>
    <div class="input-row">
      <input id="unifiedInput" type="text" placeholder="Search notes..." />
      <select id="scopeSelect">
        <option value="all">All Clients</option>
        <option value="client">This Client</option>
      </select>
      <button id="goBtn" class="btn btn-primary">Search</button>
    </div>
  </div>
  <details class="advanced-panel">
    <summary>Advanced</summary>
    <!-- topK, relevance mode — unchanged -->
  </details>
</div>
```

### Behavior
- **Search mode:** placeholder = "Search notes (e.g. knee pain progression)", button text = "Search"
- **Ask mode:** placeholder = "Ask a question about your notes...", button text = "Ask"  
- **Summarize mode:** placeholder = "Summarize notes about...", button text = "Summarize"
- Enter key triggers the active mode's action
- Scope dropdown stays visible in all modes
- Go button text updates to match the active mode

### Mode Selector Styling
Use the same pill/segmented control pattern as the theme toggle (already in the app). Keep it compact — sits above or inline-left of the input. Visually this should feel like tabs, not radio buttons.

```css
.mode-selector {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-ghost);
  margin-bottom: 8px;
}

.mode-selector label {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
  transition: all 150ms ease;
}

.mode-selector input:checked + label {
  color: var(--text);
  background: var(--surface-btn);
  border: 1px solid var(--line);
}

.mode-selector input { position: absolute; opacity: 0; pointer-events: none; }
```

---

## 🔴 2. Input Field Polish

**Problem:** Inputs look like default browser controls. This is the #1 thing that makes apps feel "first draft."

**Changes:**

```css
input, select, textarea {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;              /* slightly more generous */
  background: var(--surface-input);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);  /* subtle depth */
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(15,123,108,0.12), inset 0 1px 2px rgba(0,0,0,0.04);
}

/* Dark mode adjustments */
html[data-theme="dark"] input,
html[data-theme="dark"] select,
html[data-theme="dark"] textarea {
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.15);
}

html[data-theme="dark"] input:focus,
html[data-theme="dark"] select:focus,
html[data-theme="dark"] textarea:focus {
  box-shadow: 0 0 0 3px rgba(46,196,168,0.15), inset 0 1px 2px rgba(0,0,0,0.15);
}
```

This gives inputs a subtle inset shadow (depth), and replaces the browser's blue focus ring with a brand-colored glow. Small change, big impact.

---

## 🔴 3. Typography Upgrade

**Problem:** Avenir Next is fine but reads slightly dated for a 2026 app. The hierarchy is too flat — headings, labels, body text, and metadata all feel the same visual weight.

**Changes:**

### Font Stack
```css
html, body {
  font-family: "Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont, 
               "Segoe UI", Roboto, sans-serif;
}
```

Inter is the modern standard for app UIs. It's free, looks great at small sizes, and has excellent number rendering (useful for note counts, dates). If Inter isn't installed, SF Pro (macOS native) kicks in seamlessly.

### Hierarchy Adjustments
```css
/* App title — lighter, not shouty */
.topbar h1 {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Section headers — small, muted, uppercase (already good, just tweak) */
.sidebar h2, .main-pane h2 {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--muted);
}

/* Note title in detail pane — the star of the show */
#noteTitle {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Note body — comfortable reading */
.note-body {
  font-size: 14px;
  line-height: 1.55;
}

/* Answer text — slightly more prominent than notes */
.answer-text {
  font-size: 14.5px;
  line-height: 1.5;
}
```

### Font Loading
Either bundle Inter as a local font in the Electron app, or use the system stack (SF Pro on Mac, Segoe UI on Windows). Both work well. Bundling Inter (~100KB woff2) gives guaranteed consistency.

---

## 🔴 4. Micro-Animations

**Problem:** Everything appears and disappears instantly. Professional apps have subtle motion that makes interactions feel responsive.

**Changes:**

```css
/* Card hover lift */
.item-btn {
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.item-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(15, 123, 108, 0.44);
  box-shadow: 0 4px 12px rgba(18, 41, 38, 0.1);
}

/* Answer panel expand/collapse — smooth height */
.answer-panel-body {
  overflow: hidden;
  transition: max-height 250ms ease, opacity 200ms ease;
}

.answer-card.is-collapsed .answer-panel-body {
  max-height: 0;
  opacity: 0;
}

.answer-card:not(.is-collapsed) .answer-panel-body {
  max-height: 600px;  /* generous max for transition */
  opacity: 1;
}

/* Search results fade in */
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.results .item-btn {
  animation: fadeSlideIn 200ms ease both;
}

/* Stagger: each result fades in slightly after the previous */
.results li:nth-child(1) .item-btn { animation-delay: 0ms; }
.results li:nth-child(2) .item-btn { animation-delay: 40ms; }
.results li:nth-child(3) .item-btn { animation-delay: 80ms; }
.results li:nth-child(4) .item-btn { animation-delay: 120ms; }
.results li:nth-child(5) .item-btn { animation-delay: 160ms; }
/* etc — or set via JS: el.style.animationDelay = `${i * 40}ms` */
```

**JS note for answer panel:** Instead of toggling `hidden` on `answerPanelBody`, use the CSS max-height transition above. Remove `hidden` attribute entirely and control visibility via the `.is-collapsed` class on the parent card. This gives you smooth expand/collapse instead of a jarring show/hide.

---

## 🔴 5. Client Sidebar Enhancement

**Problem:** The sidebar is a plain text list. It works but doesn't communicate information at a glance.

**Changes:**

### Add client metadata
Each client item should show:
- A **colored dot or initial avatar** (first letter of client name in a small circle)
- **Note count** as a subtle badge
- **Last activity** ("3 notes · last 2 days ago")

### HTML structure per client
```html
<li>
  <button class="item-btn client-item">
    <div class="client-avatar" style="--avatar-hue: 160">S</div>
    <div class="client-info">
      <span class="item-title">Sarah Mitchell</span>
      <span class="item-meta">8 notes · last 2 days ago</span>
    </div>
  </button>
</li>
```

### Styling
```css
.client-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: hsl(var(--avatar-hue), 55%, 48%);
  flex-shrink: 0;
}

.client-info {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.client-info .item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Avatar color assignment
Generate a stable hue from the client name (simple hash):

```js
function clientHue(name) {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}
```

This gives each client a consistent, unique color without needing a palette.

---

## 🟡 6. Skeleton Loading States

**Problem:** When fetching search results or generating an answer, the UI goes blank or shows the spinner overlay. Modern apps show skeleton shimmer placeholders.

**When to use:**
- **Search results loading** → show 3-4 skeleton list items
- **Answer generating** → show skeleton lines in the answer card
- Keep the busy overlay only for full-app operations (indexing, reindexing)

### Skeleton CSS
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-soft) 25%,
    var(--surface-ghost) 50%,
    var(--surface-soft) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 6px;
}

.skeleton-line {
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-line:last-child {
  width: 60%;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Usage
When a search starts, immediately render skeleton items:
```js
function showSkeletonResults(count = 4) {
  resultsList.innerHTML = Array.from({ length: count }, () =>
    `<li><div class="item-btn skeleton-card">
       <div class="skeleton skeleton-line"></div>
       <div class="skeleton skeleton-line" style="width:75%"></div>
     </div></li>`
  ).join('');
}
```

Replace with real results when they arrive.

---

## 🟡 7. Keyboard Shortcuts

For power users and demo wow-factor:

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Focus the unified search input |
| `Cmd+Enter` | Run the active mode (search/ask/summarize) |
| `Cmd+N` | Open New Note dialog |
| `Escape` | Close any open dialog |
| `↑/↓` in results | Navigate through search results |

Register via Electron's `globalShortcut` or in-app keydown handlers. These don't need to be visible in the UI — they're just polish that makes the app feel responsive during a demo.

---

## 🟡 8. Welcome/Empty State Illustration

**Problem:** The welcome screen is text-only. A simple visual makes it feel intentional rather than placeholder.

**Solution:** Add a minimal SVG illustration — a stylized notebook with a magnifying glass, or abstract lines suggesting notes being searched. Keep it monochromatic using `var(--muted)` and `var(--brand)` so it works in both themes.

If generating custom SVG is too much for the timeline, even a single large emoji (📋) or icon at 48px with muted color above the welcome text would be an improvement.

---

## 🟢 9. Status Line Refinement

The status line currently shows "X notes indexed across Y clients." This is good. Enhance it:

- During idle: `42 notes · 4 clients · Last indexed 2 min ago`
- During search: `Searching...` (with subtle pulse animation on text)
- After search: `8 results · 0.3s` (then fade back to idle after 3s)

This makes the app feel alive and responsive without being noisy.

---

## 🟢 10. Responsive Detail Pane

When no note is selected, the detail pane currently says "No note selected." Replace with the welcome/onboarding content (already partially implemented). Make sure it's visually distinct from an actual note — centered text, muted colors, maybe a dashed border instead of solid.

When a note IS selected, add a subtle fade-in transition so switching between notes doesn't feel jarring.

---

## Implementation Notes

- All CSS changes are additive — nothing here requires restructuring existing styles
- The unified search bar is the biggest structural change; everything else is CSS/cosmetic
- Test all changes in both light and dark mode
- The staggered animation delays for search results should be set in JS when rendering, not hardcoded in CSS (the hardcoded CSS above is just for illustration)
- For the answer panel expand/collapse: remove the `hidden` attribute toggle and use CSS max-height transition instead. The `is-collapsed` class already exists and is the right control mechanism.

---

## Demo Checklist

Before Monday 10am:
- [ ] Unified search/ask bar (items 1)
- [ ] Input field polish (item 2)
- [ ] Typography upgrade (item 3)
- [ ] Micro-animations (item 4)
- [ ] Client sidebar avatars + metadata (item 5)
- [ ] Test in both light and dark mode
- [ ] Test with the demo dataset (already in docs/demo-notes/)
