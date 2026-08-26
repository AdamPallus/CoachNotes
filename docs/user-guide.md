# CoachNotes User Guide (First Run)

## What happens on first use

1. Open CoachNotes desktop app.
2. Click `Settings`.
3. Set:
   - `Root Notes Folder`
   - `Proxy Base URL` (your Vercel URL)
   - `Invite Token`
4. Click `Save & Reindex`.
5. The app scans notes and builds a local index. Status changes to `Up to date` when done.
6. Use `Help` anytime for in-app instructions and migration guidance.

## Creating notes inside CoachNotes

1. Click `New Note`.
2. Enter:
   - title
   - date
   - client (defaults to currently selected client if one is selected)
   - optional tags (comma-separated)
   - note body
3. Click `Create Note`.

CoachNotes writes a markdown file into your notes root folder:
- If client is selected: `<root>/<Client Name>/YYYY-MM-DD-title.md`
- If no client is selected: `<root>/YYYY-MM-DD-title.md`

## Markdown expectations

- Markdown is supported but not required.
- Users can type plain text and the app will still index/search it.
- Note view has `Rendered` and `Raw` modes.

## How CoachNotes determines which client a note belongs to

Current client resolution order in the app:

1. Inline metadata (`client` or `clients` in YAML front matter)
2. Folder-based fallback (first folder level under the selected root)

Examples:

- Folder based:
  - `/Notes/Alice Smith/2026-01-10-session.md` -> client = `Alice Smith`
- YAML based:
  - front matter `client: "Alice Smith"`
  - front matter `clients: ["Alice Smith", "Bob Jones"]`

## Supported note formats

- `.md`
- `.txt`
- `.markdown`
- `.pdf` (text-extractable PDFs)

## Metadata supported today

- `title` (optional in YAML)
- `date` (`YYYY-MM-DD` recommended)
- `tags` (YAML array)
- hashtags in body text, e.g. `#knee`, `#mobility`

## Notes about current MVP behavior

- Notes are read from disk; CoachNotes does not replace your file system.
- Search is local over stored embeddings and keyword signals.
- Q&A/Summary are grounded in retrieved chunks from your notes.
- Citation markers are shown as human-readable numbered references (`[1]`, `[2]`). Click a citation chip or source row to jump to the note/chunk.
- Note viewer supports `Rendered` (markdown view) and `Raw` (plain text with exact chunk highlight).
- Invite token is stored in macOS Keychain.
- Per-note override editing UI is not implemented yet.

## Updating a client from a new note

When a coach adds a note, CoachNotes sends the current dashboard and new source to the proxy for review. The AI returns only the dashboard sections that need to change; omitted sections remain untouched. New items such as current timeline milestones can be appended without regenerating historical entries.

While processing, the original note remains available for retry. If the server cannot finish the update, CoachNotes keeps the entered source in the add-note dialog rather than requiring it to be entered again. After a successful update, the affected sections are highlighted and each changed section retains its normal undo history.

## Quick way to test with demo notes

If you don’t have notes yet:

```bash
cd /Users/pallusa/projects/CoachNotes
./scripts/create_demo_notes.sh
```

This creates demo notes at `~/CoachNotesDemo`.

Then in CoachNotes Settings:
- Root Notes Folder: `/Users/<you>/CoachNotesDemo`
- Save & Reindex

Try searches:
- `knee pain`
- `shoulder press`

Try Ask:
- `What did we change for knee pain recently?`

## Troubleshooting

- If `401 Unauthorized`: invite token does not match server `INVITE_TOKENS`.
- If `/health` works but app calls fail: verify desktop `Proxy Base URL` matches deployed URL.
- If your folder contains unsupported files (`.docx`, `.xlsx`, etc.), CoachNotes ignores them and shows an \"ignored unsupported files\" count in the status line.
- If SQLite ABI/native error appears after Node/Electron updates:

```bash
cd /Users/pallusa/projects/CoachNotes
npm --workspace apps/desktop run rebuild-native
```
