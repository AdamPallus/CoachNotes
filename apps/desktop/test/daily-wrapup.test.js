const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDayActivity, normalizeWrapup, localDate } = require('../src/daily-wrapup');

test('wrap-up uses ingestion time, not a backdated source date, and excludes unknown/archived clients', () => {
  const timestamp = new Date(2026, 9, 5, 12).toISOString();
  const clients = [{ id: 2, name: 'Zoe' }, { id: 1, name: 'Amy' }];
  const sources = [{ clientId: 1, title: 'Old note added today', sourceDate: '2020-01-01', createdAt: timestamp, rawText: 'History' },
    { clientId: 3, title: 'Archived client', createdAt: timestamp }];
  const result = buildDayActivity({ clients, sources, revisions: [], day: localDate(timestamp) });
  assert.deepEqual(result.map(c => c.name), ['Amy', 'Zoe']);
  assert.equal(result[0].activity[0].sourceDate, '2020-01-01');
  assert.equal(result[1].activity.length, 0);
});

test('manual edits count once per section; AI revisions do not double count a note', () => {
  const createdAt = new Date(2026, 9, 5, 12).toISOString();
  const revisions = ['Manual edit', 'Manual edit', 'AI update from 1 new source'].map(reason => ({ clientId: 1, section: 'overview', reason, createdAt }));
  const result = buildDayActivity({ clients: [{ id: 1, name: 'Amy' }], sources: [], revisions, day: localDate(createdAt) });
  assert.equal(result[0].activity.length, 1);
});

test('wrap-up completion cannot leak to unselected or archived clients', () => {
  const result = normalizeWrapup({ selected: [1, 1, 2, 3], done: { 1: 'updated', 2: 'later', 3: 'no-updates' }, started: true }, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(result.selected, [1, 2]);
  assert.deepEqual(result.done, { 1: 'updated' });
});
