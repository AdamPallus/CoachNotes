const { buildDayActivity, normalizeWrapup, isCalendarDay, buildWrapupTask, hasNoteDraft } = require('./daily-wrapup');
const { normalizeRules, buildCandidates, normalizePlan, createPlan } = require('./daily-worklist');
const { createWrapupClosing } = require('./wrapup-closing');

function createNoteWorkspace({ db, ipcMain, getClients, addCoachTask, getCoachTasks, getWorklistContext, today, callProxy, getCelebrationsEnabled }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_drafts (client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_wrapups (day TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS note_receipts (request_id TEXT PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wrapup_task_receipts (request_id TEXT PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_worklists (day TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_worklist_settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
  `);
  const closing = createWrapupClosing({ db, ipcMain, getClients, getCoachTasks, today, callProxy, getCelebrationsEnabled });
  const client = (id) => {
    if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(Number(id))) throw new Error('Client not found.');
    return Number(id);
  };
  const dayKey = (day) => {
    if (!isCalendarDay(day)) throw new Error('Choose a valid date.');
    return day;
  };
  const readWrapup = (day) => JSON.parse(db.prepare('SELECT data FROM daily_wrapups WHERE day = ?').get(dayKey(day))?.data || 'null');
  const readPlan = (day) => JSON.parse(db.prepare('SELECT data FROM daily_worklists WHERE day=?').get(dayKey(day))?.data || 'null');
  const worklist = () => {
    const day = today();
    const rules = normalizeRules(JSON.parse(db.prepare('SELECT data FROM daily_worklist_settings WHERE id=1').get()?.data || '{}'));
    const lastNotes = Object.fromEntries(db.prepare('SELECT client_id AS id, MAX(created_at) AS date FROM intake_sources GROUP BY client_id').all().map(row => [row.id, row.date]));
    const candidates = buildCandidates({ clients: getClients(), ...getWorklistContext(), lastNotes, day, rules });
    const saved = readPlan(day);
    const previous = JSON.parse(db.prepare('SELECT data FROM daily_worklists WHERE day < ? ORDER BY day DESC LIMIT 1').get(day)?.data || 'null');
    const drafts = new Set(db.prepare('SELECT client_id AS id,data FROM note_drafts').all().filter(row => hasNoteDraft(JSON.parse(row.data))).map(row => row.id));
    return { day, rules, candidates: candidates.map(c => ({ ...c, hasDraft: drafts.has(c.id) })), plan: saved ? normalizePlan(saved, candidates) : createPlan(candidates, previous, day) };
  };
  ipcMain.handle('app:get-worklist', worklist);
  ipcMain.handle('app:save-worklist', (_event, { day, plan, rules }) => {
    const data = worklist();
    if (day !== data.day) throw new Error('A new day has started. Reopen Today to continue.');
    if (plan.revision !== data.plan.revision) throw new Error('Your worklist changed. Reopen Today before continuing.');
    const normalized = normalizePlan(plan, data.candidates);
    for (const entry of normalized.entries) {
      if (entry.status === 'done' && data.plan.entries.find(e => e.clientId === entry.clientId)?.status !== 'done'
        && data.candidates.find(c => c.id === entry.clientId)?.hasDraft) throw new Error('This client has a saved note draft. Finish the note or choose Later.');
    }
    normalized.revision += 1;
    db.transaction(() => {
      if ((readPlan(day)?.revision || 0) !== plan.revision) throw new Error('Your worklist changed. Reopen Today before continuing.');
      db.prepare('INSERT INTO daily_worklists VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET data=excluded.data').run(day, JSON.stringify(normalized));
      if (rules) db.prepare('INSERT INTO daily_worklist_settings VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(normalizeRules(rules)));
    })();
    return worklist();
  });
  const saveWrapup = (day, value) => {
    const normalized = normalizeWrapup(value, getClients());
    const previous = readWrapup(day);
    db.transaction(() => {
      db.prepare('INSERT INTO daily_wrapups VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET data=excluded.data')
        .run(dayKey(day), JSON.stringify(normalized));
      const plan = readPlan(day);
      let changed = false;
      for (const entry of plan?.entries || []) {
        if (!normalized.done[entry.clientId] || normalized.followupDrafts[entry.clientId] || entry.status === 'done' || entry.deferredUntil > day) continue;
        if (previous?.done?.[entry.clientId] === normalized.done[entry.clientId] && !previous?.followupDrafts?.[entry.clientId]) continue;
        const draft = JSON.parse(db.prepare('SELECT data FROM note_drafts WHERE client_id=?').get(entry.clientId)?.data || 'null');
        if (hasNoteDraft(draft)) continue;
        entry.status = 'done'; entry.deferredUntil = ''; changed = true;
      }
      if (changed) {
        plan.revision += 1;
        if (!plan.entries.some(e => e.clientId === plan.currentId && e.status === 'pending')) plan.currentId = plan.entries.find(e => e.status === 'pending')?.clientId || null;
        db.prepare('UPDATE daily_worklists SET data=? WHERE day=?').run(JSON.stringify(plan), day);
      }
    })();
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
    let saved = readWrapup(day);
    const plan = readPlan(day);
    if (plan?.started) {
      saved ||= { selected: buildDayActivity({ clients, sources, revisions, day }).filter(c => c.activity.length).map(c => c.id), done: {}, started: false };
      const imported = new Set(saved.worklistImported || []);
      const planned = plan.entries.filter(e => e.status !== 'skipped' && !imported.has(e.clientId)).map(e => e.clientId);
      saved.selected = [...new Set(saved.started ? [...saved.selected, ...planned] : [...planned, ...saved.selected])];
      saved.worklistImported = [...imported, ...planned];
    }
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
      closing.record(day, clientId, 'Scheduled follow-up', `${task.title} (due ${task.dueDate})`);
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
          closing.record(wrapupDay, clientId, 'Saved dashboard update', result.updateSummary || `Updated sections: ${(result.changedSections || []).join(', ')}`);
          progress.done[clientId] = 'updated';
          saveWrapup(wrapupDay, progress);
        }
      }
    }
  };
}

module.exports = { createNoteWorkspace };
