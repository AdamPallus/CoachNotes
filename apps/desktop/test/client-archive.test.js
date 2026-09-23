const test = require('node:test');
const assert = require('node:assert/strict');
const { projectActiveWeeklyReview } = require('../src/client-archive');

const saved = {
  id: 7,
  generatedAt: '2026-09-23T12:00:00Z',
  report: {
    openingSummary: 'Avery and Bianca need attention.',
    practicePatterns: [{ title: 'Follow up', clientIds: ['1', '2'] }],
    clientReviews: [{ clientId: '1', clientName: 'Avery' }, { clientId: '2', clientName: 'Bianca' }]
  },
  usage: { totalTokens: 123 }
};

test('active-only saved reviews are unchanged', () => {
  assert.equal(projectActiveWeeklyReview(saved, [1, 2, 3]), saved);
  assert.equal(projectActiveWeeklyReview(null, []), null);
});

test('archive excludes client assessments and potentially stale portfolio prose without mutating the original', () => {
  const before = JSON.stringify(saved);
  const projected = projectActiveWeeklyReview(saved, [2]);
  assert.deepEqual(projected.report.clientReviews, [saved.report.clientReviews[1]]);
  assert.equal(projected.excludedClientCount, 1);
  assert.equal(projected.report.openingSummary, '');
  assert.deepEqual(projected.report.practicePatterns, []);
  assert.equal(projected.generatedAt, saved.generatedAt);
  assert.deepEqual(projected.usage, saved.usage);
  assert.equal(JSON.stringify(saved), before);
});

test('restore exposes the original saved assessment and summary again', () => {
  projectActiveWeeklyReview(saved, [2]);
  assert.deepEqual(projectActiveWeeklyReview(saved, [1, 2]), saved);
});

test('all clients archived leaves no assessments or stale summary', () => {
  const projected = projectActiveWeeklyReview(saved, []);
  assert.deepEqual(projected.report.clientReviews, []);
  assert.equal(projected.excludedClientCount, 2);
  assert.equal(projected.report.openingSummary, '');
});
