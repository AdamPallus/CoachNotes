const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WEEKLY_REVIEW_SCHEMA_VERSION,
  normalizeWeeklyReview
} = require('../api/weekly-review-contract');

const expectedClients = [
  { clientId: '1', clientName: 'Avery Morgan' },
  { clientId: '2', clientName: 'Bianca Flores' }
];

function validReview() {
  return {
    schemaVersion: WEEKLY_REVIEW_SCHEMA_VERSION,
    openingSummary: ' Two clients have clear next steps this week. ',
    practicePatterns: [{ title: 'Busy weeks', summary: 'Keep actions small.', clientIds: ['1', 'bad'] }],
    clientReviews: expectedClients.map((client, index) => ({
      clientId: client.clientId,
      clientName: 'Model-provided name is ignored',
      attentionLevel: index ? 'watch' : 'routine',
      retentionConcern: index ? 'some' : 'low',
      currentFocus: 'Build a repeatable routine.',
      weeklyAssessment: 'Recent evidence supports a clear next step.',
      suggestedCoachFocus: 'Confirm the next smallest action.',
      evidence: ['Recent check-in was specific.'],
      counterevidence: ['A planned trip explains the pause.']
    }))
  };
}

test('normalizes a complete weekly review and keeps canonical client names', () => {
  const result = normalizeWeeklyReview(validReview(), expectedClients);
  assert.equal(result.clientReviews.length, 2);
  assert.equal(result.clientReviews[0].clientName, 'Avery Morgan');
  assert.equal(result.clientReviews[0].evidence.length, 1);
  assert.deepEqual(result.practicePatterns[0].clientIds, ['1']);
});

test('rejects omitted, duplicate, and unknown clients', () => {
  const omitted = validReview();
  omitted.clientReviews.pop();
  assert.throws(() => normalizeWeeklyReview(omitted, expectedClients), /covered 1 of 2/);

  const duplicate = validReview();
  duplicate.clientReviews[1].clientId = '1';
  assert.throws(() => normalizeWeeklyReview(duplicate, expectedClients), /duplicate client id/);

  const unknown = validReview();
  unknown.clientReviews[1].clientId = '99';
  assert.throws(() => normalizeWeeklyReview(unknown, expectedClients), /unknown client id/);
});

test('rejects invalid judgment labels and missing required prose', () => {
  const badConcern = validReview();
  badConcern.clientReviews[0].retentionConcern = '83 percent';
  assert.throws(() => normalizeWeeklyReview(badConcern, expectedClients), /Invalid retention concern/);

  const missingFocus = validReview();
  missingFocus.clientReviews[0].suggestedCoachFocus = '';
  assert.throws(() => normalizeWeeklyReview(missingFocus, expectedClients), /missing a required review field/);
});
