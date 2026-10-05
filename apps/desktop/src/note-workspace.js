const { buildDayActivity, normalizeWrapup, isCalendarDay, buildWrapupTask, hasNoteDraft } = require('./daily-wrapup');

function createNoteWorkspace({ db, ipcMain, getClients, addCoachTask }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_drafts (client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_wrapups (day TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS note_receipts (request_id TEXT PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wrapup_task_receipts (request_id TEXT PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, data TEXT NOT NULL);
  `);
  const client = (id) => {
    if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(Number(id))) throw new Error('Client not found.');
    return Number(id);
  };
  const dayKey = (day) => {
    if (!isCalendarDay(day)) throw new Error('Choose a valid date.');
    return day;
  };
  const readWrapup = (day) => JSON.parse(db.prepare('SELECT data FROM daily_wrapups WHERE day = ?').get(dayKey(day))?.data || 'null');
  const saveWrapup = (day, value) => {
    const normalized = normalizeWrapup(value, getClients());
    db.prepare('INSERT INTO daily_wrapups VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET data=excluded.data')
      .run(dayKey(day), JSON.stringify(normalized));
    return normalized;
  };
  ipcMain.handle('app:get-note-draft', (_event, { clientId }) => JSON.parse(db.prepare('SELECT data FROM note_drafts WHERE client_id=?').get(client(clientId))?.data || 'null'));
  ipcMain.handle('app:save-note-draft', (_event, { clientId, draft }) => {
    const id = client(clientId);
    if (draft === null) { db.prepare('DELETE FROM note_drafts WHERE client_id=?').run(id); return; }
    const data = JSON.stringify(draft);
    if (data.length > 1500000) throw new Error('Draft is too large. Import fewer files at a time.');
    // A late renderer autosave must not resurrect a successfully submitted draft.
    if (draft.requestId && db.prepare('SELECT 1 FROM note_receipts WHERE request_id=? AND client_id=?').get(draft.requestId, id)) return;
    db.prepare('INSERT INTO note_drafts VALUES (?, ?) ON CONFLICT(client_id) DO UPDATE SET data=excluded.data').run(id, data);
  });
  ipcMain.handle('app:get-wrapup', (_event, { day }) => {
    dayKey(day);
    const clients = getClients();
    const sources = db.prepare('SELECT client_id AS clientId,title,source_date AS sourceDate,created_at AS createdAt,substr(raw_text,1,1000) AS rawText FROM intake_sources WHERE created_at >= ? AND created_at < ?')
      .all(new Date(`${day}T00:00:00`).toISOString(), new Date(new Date(`${day}T00:00:00`).getTime() + 26 * 3600000).toISOString());
    const revisions = db.prepare(`SELECT b.client_id AS clientId,u.section_key AS section,u.reason,u.created_at AS createdAt FROM client_section_undo u JOIN client_baselines b ON b.id=u.baseline_id WHERE u.created_at >= ?`)
      .all(new Date(`${day}T00:00:00`).toISOString());
    const saved = readWrapup(day);
    const draftClients = new Set(db.prepare('SELECT client_id AS clientId,data FROM note_drafts').all()
      .filter((row) => hasNoteDraft(JSON.parse(row.data))).map((row) => row.clientId));
    return { day, clients: buildDayActivity({ clients, sources, revisions, day }).map((item) => ({ ...item, hasDraft: draftClients.has(item.id) })), progress: saved ? normalizeWrapup(saved, clients) : null };
  });
  ipcMain.handle('app:save-wrapup', (_event, { day, progress }) => saveWrapup(day, progress));
  ipcMain.handle('app:add-wrapup-task', (_event, payload) => {
    const { day, requestId } = payload;
    dayKey(day);
    const clientId = client(payload.clientId);
    if (typeof requestId !== 'string' || !/^[\w-]{1,80}$/.test(requestId)) throw new Error('Invalid follow-up request.');
    if (!getClients().some((item) => item.id === clientId)) throw new Error('This client is no longer active.');
    const receipt = db.prepare('SELECT client_id AS clientId,data FROM wrapup_task_receipts WHERE request_id=?').get(requestId);
    if (receipt) {
      if (receipt.clientId !== clientId) throw new Error('Follow-up belongs to another client.');
      return JSON.parse(receipt.data);
    }
    const task = buildWrapupTask(payload);
    return db.transaction(() => {
      const progress = readWrapup(day);
      if (!progress?.selected?.includes(clientId)) throw new Error('Select this client in the wrap-up first.');
      addCoachTask(clientId, task);
      if (progress.followupDrafts?.[clientId]?.requestId === requestId) delete progress.followupDrafts[clientId];
      saveWrapup(day, progress);
      db.prepare('INSERT INTO wrapup_task_receipts VALUES (?, ?, ?)').run(requestId, clientId, JSON.stringify(task));
      return task;
    })();
  });
  return {
    receipt(requestId, clientId) {
      if (!requestId) return null;
      return JSON.parse(db.prepare('SELECT data FROM note_receipts WHERE request_id=? AND client_id=?').get(requestId, clientId)?.data || 'null');
    },
    complete({ requestId, clientId, wrapupDay, result }) {
      if (requestId) db.prepare('INSERT INTO note_receipts VALUES (?, ?, ?)').run(requestId, clientId, JSON.stringify(result));
      db.prepare('DELETE FROM note_drafts WHERE client_id=?').run(clientId);
      if (wrapupDay) {
        const progress = readWrapup(wrapupDay);
        if (progress?.selected?.includes(clientId)) {
          progress.done[clientId] = 'updated';
          saveWrapup(wrapupDay, progress);
        }
      }
    }
  };
}

module.exports = { createNoteWorkspace };
