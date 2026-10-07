// Run with Electron's Node runtime so SQLite uses the installed native ABI.
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createWrapupClosing } = require('../src/wrapup-closing');

(async () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE clients(id INTEGER PRIMARY KEY); INSERT INTO clients VALUES (1),(2),(3);
    CREATE TABLE daily_wrapups(day TEXT PRIMARY KEY,data TEXT);
    CREATE TABLE note_drafts(client_id INTEGER PRIMARY KEY,data TEXT);`);
  let day = '2026-10-07', enabled = true, fail = false, release;
  const handlers = new Map(), requests = [];
  const setup = () => createWrapupClosing({ db, ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, today: () => day,
    getClients: () => [{ id: 1 }, { id: 2 }], getCelebrationsEnabled: () => enabled,
    getCoachTasks: () => [{ title: 'Check in tomorrow', dueDate: '2026-10-08' }],
    callProxy: async (endpoint, payload) => { requests.push({ endpoint, payload }); if (fail) throw new Error('offline'); await new Promise(resolve => { release = resolve; }); return { message: 'Your changes are captured.' }; } });
  const store = setup();
  const save = progress => db.prepare('INSERT OR REPLACE INTO daily_wrapups VALUES (?,?)').run(day, JSON.stringify(progress));
  const claim = celebrate => handlers.get('app:complete-wrapup')(null, { day, celebrate });
  const generate = () => handlers.get('app:generate-wrapup-closing')(null, { day });
  const done = { selected: [1, 2], done: { 1: 'updated', 2: 'no-updates' }, started: true };
  save({ ...done, done: { 1: 'updated' } }); assert.equal(claim(true).fresh, false);
  save({ ...done, followupDrafts: { 2: { title: 'Unsent', requestId: 'x' } } }); assert.equal(claim(true).fresh, false);
  save(done);
  db.prepare('INSERT INTO note_drafts VALUES (?,?)').run(2, JSON.stringify({ fields: { noteTextInput: 'Unsent' } }));
  assert.equal(claim(true).fresh, false); db.exec('DELETE FROM note_drafts');
  assert.equal(claim(false).fresh, false); assert.equal(db.prepare('SELECT count(*) AS n FROM wrapup_closings').get().n, 0);
  store.record(day, 1, 'Saved dashboard update', 'Workout revised');
  store.record(day, 2, 'Scheduled follow-up', 'Check in tomorrow (due 2026-10-08)');
  store.record(day, 2, 'Scheduled follow-up', 'Check in tomorrow (due 2026-10-08)');
  store.record(day, 2, 'Scheduled follow-up', 'Undone task (due 2026-10-08)');
  store.record(day, 3, 'Scheduled follow-up', 'Archived client must not leak');
  assert.equal(claim(true).fresh, true); assert.equal(claim(true).fresh, false);
  const first = generate(), concurrent = generate(); assert.equal(first, concurrent); assert.equal(requests.length, 1);
  assert.equal(requests[0].payload.context.followups, 1); assert.doesNotMatch(JSON.stringify(requests), /Archived/);
  release(); assert.equal((await first).message, 'Your changes are captured.');
  setup(); assert.equal(claim(true).message, 'Your changes are captured.'); await generate(); assert.equal(requests.length, 1);
  day = '2026-10-08'; save(done); enabled = false;
  assert.equal(claim(true).fresh, false); enabled = true; await generate(); assert.equal(requests.length, 1);
  day = '2026-10-09'; save(done); fail = true; assert.equal(claim(true).fresh, true);
  assert.equal((await generate()).message, ''); await generate(); assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].payload.context.recentMessages, ['Your changes are captured.']);
  day = '2026-10-10'; save(done); claim(true);
  db.prepare("UPDATE wrapup_closings SET status='running' WHERE day=?").run(day);
  setup(); await generate(); assert.equal(requests.length, 2, 'Interrupted calls never repeat on restart');
  day = '2026-10-11'; save(done); claim(true); enabled = false; await generate(); assert.equal(requests.length, 2);
  db.close(); console.log('Closing persistence, eligibility, settings, concurrency, failure, and restart checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
