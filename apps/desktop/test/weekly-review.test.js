const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWeeklyReviewBatches,
  buildWeeklyReviewContext,
  mergeWeeklyReviewResults
} = require('../src/weekly-review');

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

test('projects the eight most recent timeline entries in chronological order', () => {
  const timeline = [
    { date: '2026-01-10', label: 'Ten' },
    { date: '2026-01-03', label: 'Three' },
    { date: '2026-01-09', label: 'Nine' },
    { date: '2026-01-01', label: 'One' },
    { date: '2026-01-06', label: 'Six' },
    { date: '2026-01-08', label: 'Eight' },
    { date: '2026-01-02', label: 'Two' },
    { date: '2026-01-05', label: 'Five' },
    { date: '2026-01-07', label: 'Seven' },
    { date: '2026-01-04', label: 'Four' }
  ];
  const context = buildWeeklyReviewContext([{
    id: 1,
    name: 'Timeline Client',
    structured: { timeline }
  }], { currentDate: '2026-09-01' });

  assert.deepEqual(
    context.clients[0].recentTimeline.map((item) => item.title),
    ['Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  );
});

test('splits weekly reviews by client count and approximate context size', () => {
  const context = buildWeeklyReviewContext(Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    name: `Client ${String(index + 1).padStart(2, '0')}`,
    structured: { overview: 'x'.repeat(700) }
  })), { currentDate: '2026-09-01' });

  const countBatches = buildWeeklyReviewBatches(context, { maxClients: 10, targetChars: 100000 });
  assert.deepEqual(countBatches.map((batch) => batch.context.clientCount), [10, 10, 5]);
  assert.equal(countBatches.flatMap((batch) => batch.clientIds).length, 25);

  const sizeBatches = buildWeeklyReviewBatches(context, { maxClients: 25, targetChars: 10000 });
  assert.ok(sizeBatches.length > 1);
  assert.deepEqual(sizeBatches.flatMap((batch) => batch.clientIds), context.clients.map((client) => client.clientId));
});

test('merges complete batch results and keeps synthesis from relabeling clients', () => {
  const context = buildWeeklyReviewContext([
    { id: 1, name: 'Avery', structured: { clientProfile: { cohort: 'Fall', curriculum: 'Foundations' } } },
    { id: 2, name: 'Bianca', structured: { clientProfile: { cohort: 'Winter', curriculum: 'Strength' } } }
  ], { currentDate: '2026-09-01' });
  const report = mergeWeeklyReviewResults(context, [{ clientReviews: [{
    clientId: '2', clientName: 'Bianca', attentionLevel: 'routine'
  }] }, { clientReviews: [{
    clientId: '1', clientName: 'Avery', attentionLevel: 'needs_attention'
  }] }], {
    openingSummary: 'Two clients have clear next steps.',
    practicePatterns: [{ title: 'Steady plans', summary: 'Keep next steps specific.', clientIds: ['1'] }],
    clientReviews: [{ clientId: '1', attentionLevel: 'routine' }]
  });

  assert.deepEqual(report.clientReviews.map((review) => review.clientId), ['1', '2']);
  assert.equal(report.clientReviews[0].attentionLevel, 'needs_attention');
  assert.equal(report.clientReviews[0].cohort, 'Fall');
  assert.equal(report.clientReviews[0].curriculum, 'Foundations');
  assert.equal(report.openingSummary, 'Two clients have clear next steps.');
});

test('orders the final document alphabetically instead of by model judgment', () => {
  const context = buildWeeklyReviewContext([
    { id: 1, name: 'Avery', structured: {} },
    { id: 2, name: 'Bianca', structured: {} }
  ], { currentDate: '2026-09-01' });
  const report = mergeWeeklyReviewResults(context, [{ clientReviews: [
    { clientId: '2', clientName: 'Bianca', attentionLevel: 'needs_attention' },
    { clientId: '1', clientName: 'Avery', attentionLevel: 'routine' }
  ] }], {});
  assert.deepEqual(report.clientReviews.map((review) => review.clientName), ['Avery', 'Bianca']);
});

test('rejects incomplete merged coverage', () => {
  const context = buildWeeklyReviewContext([
    { id: 1, name: 'Avery', structured: {} },
    { id: 2, name: 'Bianca', structured: {} }
  ], { currentDate: '2026-09-01' });
  assert.throws(
    () => mergeWeeklyReviewResults(context, [{ clientReviews: [{ clientId: '1' }] }], {}),
    /covered 1 of 2/
  );
});
