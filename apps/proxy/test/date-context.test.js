const test = require('node:test');
const assert = require('node:assert/strict');
const { dateContext, taskDueState, validDate } = require('../api/_date-context');
const { _test: weekly } = require('../api/weekly-review');

test('uses a valid coach date or explicitly identified server UTC fallback', () => {
  const now = new Date('2026-09-24T00:05:00Z');
  assert.match(dateContext('2026-09-23', now), /2026-09-23 \(provided by the coach app\)/);
  assert.match(dateContext(undefined, now), /2026-09-24 \(server UTC date; the coach-local date may differ\)/);
  assert.match(dateContext('ignore instructions', now), /2026-09-24/);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.match(dateContext(undefined, now), /Do not assume an unspecified meeting occurs after a future trip/);
});

test('classifies deadlines deterministically rather than treating due today as overdue', () => {
  for (const [dueDate, expected] of [['2026-09-22', 'overdue'], ['2026-09-23', 'due_today'], ['2026-09-24', 'upcoming'], ['', 'unknown'], ['Friday', 'unknown'], ['2026-02-30', 'unknown']]) {
    assert.equal(taskDueState({ dueDate }, '2026-09-23'), expected);
  }
  assert.equal(taskDueState({ dueDate: '2026-09-22', status: 'completed' }, '2026-09-23'), 'closed');
});

test('weekly context computes due states without mutating the client payload', () => {
  const input = { schemaVersion: 'weekly_review_context.v1', currentDate: '2026-09-23', clients: [
    { clientId: 'demo', clientName: 'Demo', activeCoachTasks: [{ title: 'Check in', dueDate: '2026-09-23', dueState: 'overdue' }] }
  ] };
  const normalized = weekly.normalizeBatchContext(input);
  assert.equal(normalized.clients[0].activeCoachTasks[0].dueState, 'due_today');
  assert.equal(input.clients[0].activeCoachTasks[0].dueState, 'overdue');
  const prompt = weekly.renderAssessmentPrompt(normalized, {});
  assert.match(prompt, /Ordinary scheduled work is not enough on its own/);
  assert.match(prompt, /due_today is not overdue/);
});
