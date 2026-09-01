const test = require('node:test');
const assert = require('node:assert/strict');

const { buildWeeklyReviewContext } = require('../src/weekly-review');

test('builds a compact weekly-review projection without raw source text', () => {
  const context = buildWeeklyReviewContext([{
    id: 7,
    name: 'Maya Thompson',
    updatedAt: '2026-08-30T14:00:00.000Z',
    daysSinceUpdate: 2,
    lastSourceDate: '2026-08-30',
    recentSourceCount: 2,
    hasRecentMessage: true,
    structured: {
      overview: 'Building consistency around a busy schedule.',
      coachTasks: [
        { title: 'Send check-in', status: 'open', dueDate: '2026-09-02' },
        { title: 'Old completed task', status: 'completed' }
      ],
      engagementNotes: [{ title: 'Responding consistently', details: 'Replies to specific prompts.' }],
      rawText: 'This must not be projected.'
    }
  }], { currentDate: '2026-09-01' });

  assert.equal(context.clientCount, 1);
  assert.equal(context.clients[0].clientId, '7');
  assert.equal(context.clients[0].activeCoachTasks.length, 1);
  assert.equal(context.clients[0].activeCoachTasks[0].title, 'Send check-in');
  assert.equal(JSON.stringify(context).includes('This must not be projected'), false);
});

test('caps verbose sections and text lengths', () => {
  const longText = 'x'.repeat(1200);
  const context = buildWeeklyReviewContext([{
    id: 1,
    name: 'Verbose Client',
    structured: {
      overview: longText,
      progressTracking: Array.from({ length: 20 }, (_, index) => ({
        title: `Progress ${index}`,
        details: longText
      }))
    }
  }], { currentDate: '2026-09-01' });

  assert.equal(context.clients[0].overview.length, 720);
  assert.equal(context.clients[0].progress.length, 8);
  assert.equal(context.clients[0].progress[0].detail.length, 360);
});
