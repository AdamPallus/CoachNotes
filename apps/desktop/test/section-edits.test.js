const test = require('node:test');
const assert = require('node:assert/strict');
const { sectionRevision, assertSectionEdit, completePlanningItem } = require('../src/section-edits');

const tasks = [
  { title: 'Follow up', dueDate: '2026-10-09', details: 'Workout', priority: 'high', evidenceIds: ['a'], planningStatus: 'active' },
  { title: 'Follow up', dueDate: '2026-10-09', details: 'Nutrition', evidenceIds: ['b'], planningStatus: 'active' }
];

test('completion preserves metadata and only changes the requested task', () => {
  const result = completePlanningItem(tasks, { itemIndex: 0, expectedRevision: sectionRevision(tasks) });
  assert.deepEqual(result, [{ ...tasks[0], planningStatus: 'completed' }, tasks[1]]);
  assert.equal(tasks[0].planningStatus, 'active');
});

test('stale completion rejects reordering, edits, removals and repeated clicks, including same-title tasks', () => {
  const payload = { itemIndex: 0, expectedRevision: sectionRevision(tasks) };
  for (const changed of [[tasks[1], tasks[0]], [tasks[1]], [{ ...tasks[0], details: 'Changed' }, tasks[1]], completePlanningItem(tasks, payload)]) {
    assert.throws(() => completePlanningItem(changed, payload), /Nothing was marked complete/);
  }
  assert.throws(() => completePlanningItem(tasks, { itemIndex: 0 }), /Nothing was marked complete/);
});

test('text editor cannot flatten mixed or structured lists', () => {
  for (const value of [tasks, ['legacy', tasks[0]], [{ date: '2026-01-01', label: 'Timeline', evidenceIds: ['a'] }]]) {
    assert.throws(() => assertSectionEdit(value, { textEditor: true }), /structured items/);
  }
  assert.doesNotThrow(() => assertSectionEdit(['A', 'B'], { textEditor: true, expectedValue: ['A', 'B'] }));
});

test('stale section save is rejected without rejecting an unchanged original', () => {
  assert.throws(() => assertSectionEdit('new', { expectedValue: 'old' }), /not been saved/);
  assert.doesNotThrow(() => assertSectionEdit(tasks, { expectedValue: structuredClone(tasks) }));
});
