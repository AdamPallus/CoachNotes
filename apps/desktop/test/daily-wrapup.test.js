const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDayActivity, normalizeWrapup, localDate, buildWrapupTask, isCalendarDay, hasNoteDraft } = require('../src/daily-wrapup');

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

test('wrap-up preserves deferred clients and unfinished follow-ups without reviving completed work', () => {
  const draft = { title: 'Send workout', dueDate: '2026-10-06', requestId: 'request-1' };
  const result = normalizeWrapup({ selected: [1, 2, 3], done: { 1: 'updated', 3: 'updated' }, deferred: [1, 2, 2, 3, 4],
    followupDrafts: { 1: draft, 2: { title: '' }, 4: draft } }, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(result.deferred, [1, 2]);
  assert.deepEqual(result.followupDrafts, { 1: draft });
  assert.deepEqual(normalizeWrapup(result, [{ id: 1 }, { id: 2 }]).deferred, [1, 2]);
});

test('a wrap-up follow-up is an ordinary active coach task with an explicit due date', () => {
  assert.deepEqual(buildWrapupTask({ title: '  Send workout  ', dueDate: '2026-10-06' }), {
    title: 'Send workout', dueDate: '2026-10-06', details: '', priority: 'none', planningStatus: 'active', evidenceIds: []
  });
  for (const dueDate of ['', '2026-02-29', '2026-13-01', '2026-04-31', 'tomorrow']) {
    assert.equal(isCalendarDay(dueDate), false);
    assert.throws(() => buildWrapupTask({ title: 'Follow up', dueDate }), /due date/);
  }
  assert.equal(isCalendarDay('2028-02-29'), true);
  assert.throws(() => buildWrapupTask({ title: ' ', dueDate: '2026-10-06' }), /follow-up/);
  assert.throws(() => buildWrapupTask({ title: 'x'.repeat(181), dueDate: '2026-10-06' }), /follow-up/);
});

test('draft detection includes metadata and captures but not the default note date', () => {
  assert.equal(hasNoteDraft(null), false);
  assert.equal(hasNoteDraft({ fields: { noteDateInput: '2026-10-06', noteTextInput: ' ' } }), false);
  for (const key of ['noteTextInput', 'noteTitleInput', 'noteAnnotationInput']) assert.equal(hasNoteDraft({ fields: { [key]: 'Unfinished work' } }), true);
  for (const key of ['sources', 'imageIds', 'recordingIds']) assert.equal(hasNoteDraft({ [key]: ['saved'] }), true);
});
