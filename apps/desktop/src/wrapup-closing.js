const { normalizeWrapup, hasNoteDraft, isCalendarDay } = require('./daily-wrapup');

function createWrapupClosing({ db, ipcMain, getClients, getCoachTasks, today, callProxy, getCelebrationsEnabled }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wrapup_events (day TEXT NOT NULL, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, kind TEXT NOT NULL, detail TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wrapup_closings (day TEXT PRIMARY KEY, status TEXT NOT NULL, context TEXT NOT NULL, message TEXT NOT NULL DEFAULT '');
  `);
  const running = new Map();
  const read = day => db.prepare('SELECT * FROM wrapup_closings WHERE day=?').get(day);
  const eligible = day => {
    if (!isCalendarDay(day)) return null;
    const row = db.prepare('SELECT data FROM daily_wrapups WHERE day=?').get(day);
    const progress = normalizeWrapup(row ? JSON.parse(row.data) : null, getClients());
    if (!progress.started || !progress.selected.length || progress.selected.some(id => !progress.done[id] || progress.followupDrafts[id])) return null;
    for (const id of progress.selected) {
      const draft = db.prepare('SELECT data FROM note_drafts WHERE client_id=?').get(id);
      if (draft && hasNoteDraft(JSON.parse(draft.data))) return null;
    }
    return progress;
  };
  ipcMain.handle('app:complete-wrapup', (_event, { day, celebrate = false }) => {
    const progress = eligible(day);
    if (!progress) return { fresh: false, message: '' };
    const existing = read(day);
    if (existing) return { fresh: false, message: existing.message, pending: ['pending', 'running'].includes(existing.status) };
    if (!celebrate || day !== today()) return { fresh: false, message: '' };
    const seen = new Set();
    const events = db.prepare('SELECT client_id AS id,kind,detail FROM wrapup_events WHERE day=? ORDER BY rowid').all(day)
      .filter(event => {
        if (!progress.selected.includes(event.id)) return false;
        const key = JSON.stringify(event);
        if (seen.has(key)) return false;
        seen.add(key);
        // An undone/deleted/changed task is not evidence of a currently scheduled follow-up.
        return event.kind !== 'Scheduled follow-up' || getCoachTasks(event.id)
          .some(task => `${task.title} (due ${task.dueDate})` === event.detail);
      });
    let budget = 8000;
    const details = [];
    for (const event of events.slice(-24)) {
      const detail = `${event.kind}: ${event.detail}`.slice(0, Math.min(600, budget));
      if (!detail) break;
      details.push(detail); budget -= detail.length;
    }
    const context = { day, reviewed: progress.selected.length, updated: Object.values(progress.done).filter(v => v === 'updated').length,
      followups: events.filter(event => event.kind === 'Scheduled follow-up').length, details,
      recentMessages: db.prepare("SELECT message FROM wrapup_closings WHERE day < ? AND message != '' ORDER BY day DESC LIMIT 3").all(day).map(row => row.message) };
    const enabled = getCelebrationsEnabled();
    db.prepare('INSERT INTO wrapup_closings(day,status,context) VALUES (?,?,?)').run(day, enabled ? 'pending' : 'disabled', JSON.stringify(context));
    return { fresh: enabled, message: '' };
  });
  ipcMain.handle('app:generate-wrapup-closing', (_event, { day }) => {
    if (!isCalendarDay(day)) return { message: '' };
    if (running.has(day)) return running.get(day);
    const row = read(day);
    if (!row || row.status !== 'pending') return { message: row?.message || '' };
    if (!getCelebrationsEnabled() || !eligible(day)) {
      db.prepare("UPDATE wrapup_closings SET status='skipped' WHERE day=?").run(day);
      return { message: '' };
    }
    // Claim durably before networking; a restart must not repeat a paid attempt.
    db.prepare("UPDATE wrapup_closings SET status='running' WHERE day=?").run(day);
    const request = (async () => {
      let message = '';
      try {
        const response = await callProxy('/wrapup-closing', { context: JSON.parse(row.context) });
        if (typeof response?.message === 'string' && response.message.length <= 600) message = response.message.trim();
      } catch { /* Completion is already saved. A failed flourish needs no user action. */ }
      db.prepare('UPDATE wrapup_closings SET status=?,message=? WHERE day=?').run(message ? 'complete' : 'failed', message, day);
      return { message };
    })().finally(() => running.delete(day));
    running.set(day, request);
    return request;
  });
  return {
    record(day, clientId, kind, detail) {
      if (isCalendarDay(day)) db.prepare('INSERT INTO wrapup_events VALUES (?,?,?,?)').run(day, clientId, kind, String(detail || '').slice(0, 600));
    }
  };
}

module.exports = { createWrapupClosing };
