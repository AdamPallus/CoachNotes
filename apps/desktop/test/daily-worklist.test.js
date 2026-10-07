const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCandidates, normalizePlan, normalizeRules, createPlan, daysBetween } = require('../src/daily-worklist');
const clients = [{ id: 1, name: 'Anna' }, { id: 2, name: 'Bea' }, { id: 3, name: 'Cara' }, { id: 4, name: 'Archived', archived: true }];
const task = (clientId, title, dueDate) => ({ clientId, title, dueDate, sectionKey: 'coachTasks', itemIndex: 0 });
const candidates = () => buildCandidates({ clients, home: { attention: {
  overdueTasks: [task(2, 'Check in', '2026-10-01')], dueTodayTasks: [task(1, 'Send plan', '2026-10-07')],
  highPriorityItems: [task(2, 'Check in', '2026-10-01')], radarItems: [{ clientId: 3, title: 'On vacation this week' }]
} }, lastNotes: { 1: '2026-10-06T12:00:00', 2: '2026-10-01T12:00:00', 3: '2026-09-30T12:00:00' }, day: '2026-10-07', rules: normalizeRules() });

test('suggestions rank explicit deadlines, deduplicate reasons, exclude archives, and keep vacation context', () => {
  const result = candidates();
  assert.deepEqual(result.map(c => c.id), [2, 1, 3]);
  assert.equal(result[0].reasons.length, 1);
  assert.equal(result[2].reasons[0].text, 'No note recorded for 7 days');
  assert.deepEqual(result[2].radar, ['On vacation this week']);
});
test('staleness uses recorded note time, not dashboard edits; absent notes are not claims about messaging', () => {
  const result = buildCandidates({ clients: [{ id: 1, name: 'Anna', updatedAt: '2026-10-07' }], home: {}, lastNotes: {}, day: '2026-10-07', rules: normalizeRules() });
  assert.equal(result[0].reasons[0].text, 'No note recorded');
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
});
test('rule switches and bounded threshold work without mutating existing selection', () => {
  assert.deepEqual(normalizeRules({ staleDays: 0, due: false }), { due: false, alerts: true, stale: true, staleDays: 7 });
  assert.equal(normalizeRules({ staleDays: 90 }).staleDays, 90);
  const result = buildCandidates({ clients, home: {}, lastNotes: {}, day: '2026-10-07', rules: normalizeRules({ stale: false }) });
  assert.ok(result.every(c => !c.reasons.length));
});
test('saved coach order, cursor, reasons and status survive normalization; archived and duplicate entries do not', () => {
  const value = { entries: [{ clientId: 3, status: 'later', deferredUntil: '2026-10-08', focus: 'Review her reply' }, { clientId: 1, message: true }, { clientId: 3 }, { clientId: 4 }], currentId: 1, started: true, revision: 4 };
  const plan = normalizePlan(value, candidates());
  assert.deepEqual(plan.entries.map(e => e.clientId), [3, 1]);
  assert.equal(plan.currentId, 1); assert.equal(plan.revision, 4);
  assert.equal(plan.entries[0].focus, 'Review her reply');
  assert.equal(plan.entries[1].message, true);
  assert.equal(normalizePlan({ ...plan, currentId: null }, candidates()).currentId, null);
});
test('new day carries unfinished work, not done/skipped work, and respects future deferrals', () => {
  const all = candidates().map(c => ({ ...c, reasons: [] }));
  const plan = createPlan(all, { started: true, entries: [{ clientId: 1, status: 'done' }, { clientId: 2, status: 'skipped' }, { clientId: 3, status: 'later', deferredUntil: '2026-10-09' }] }, '2026-10-08');
  assert.equal(plan.started, false);
  assert.equal(plan.entries.length, 1); assert.equal(plan.entries[0].status, 'later');
  assert.equal(createPlan(all, { ...plan, started: true }, '2026-10-09').entries[0].status, 'pending');
  assert.equal(createPlan(all, plan, '2026-10-09').entries[0].status, 'pending', 'Saved but not started day does not erase carried work');
});
test('tomorrow suggestions can reselect a skipped client for a still-open deadline without changing its task', () => {
  const next = createPlan(candidates(), { started: true, entries: [{ clientId: 2, status: 'skipped' }] }, '2026-10-08');
  assert.equal(next.entries.find(e => e.clientId === 2).status, 'pending');
});

test('a 60-client roster stays unique and preserves the coach order on repeated reads', () => {
  const roster = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `Client ${String(i + 1).padStart(2, '0')}` }));
  const result = buildCandidates({ clients: roster, home: {}, lastNotes: {}, day: '2026-10-07', rules: normalizeRules() });
  const plan = createPlan(result, null, '2026-10-07');
  plan.entries.reverse(); plan.currentId = 48;
  const reloaded = normalizePlan(plan, result);
  assert.equal(new Set(reloaded.entries.map(e => e.clientId)).size, 60);
  assert.deepEqual(reloaded.entries.map(e => e.clientId), plan.entries.map(e => e.clientId));
  assert.equal(reloaded.currentId, 48);
});
