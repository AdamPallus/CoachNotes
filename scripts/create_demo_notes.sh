#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-$HOME/CoachNotesDemo}"

mkdir -p "$TARGET_DIR/Alice Smith" "$TARGET_DIR/Bob Jones"

cat > "$TARGET_DIR/Alice Smith/2026-01-10-session.md" <<'NOTE'
---
client: "Alice Smith"
tags: ["knee", "rehab", "strength"]
date: "2026-01-10"
---
# Session Review

Left knee discomfort during split squats after week 2. Reduced depth and used tempo bodyweight squats.
Added glute bridge isometric holds and banded lateral walks.
Homework: 3x/week mobility + pain check-in.
NOTE

cat > "$TARGET_DIR/Alice Smith/2026-01-17-session.md" <<'NOTE'
# Weekly Follow-up

Pain score dropped from 6/10 to 3/10 in daily stairs.
Introduced goblet squat to box, RDL patterning, and controlled step-downs.
#progress #knee
NOTE

cat > "$TARGET_DIR/Bob Jones/2026-01-11-checkin.txt" <<'NOTE'
Felt shoulder pinch with overhead press.
Switched to landmine press and incline dumbbell press.
Added thoracic extension drills and scapular control warm-up.
NOTE

cat > "$TARGET_DIR/Bob Jones/2026-01-18-plan.md" <<'NOTE'
---
clients: ["Bob Jones"]
tags: ["shoulder", "mobility"]
date: "2026-01-18"
---
# Plan Update

Shoulder symptoms improved with reduced pressing volume.
Continue landmine press and re-introduce overhead pattern with half-kneeling position.
NOTE

printf 'Demo notes created at: %s\n' "$TARGET_DIR"
printf 'Point CoachNotes root folder to this path and click Save & Reindex.\n'
