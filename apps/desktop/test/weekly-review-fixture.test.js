const test = require('node:test');
const assert = require('node:assert/strict');

const { buildWeeklyReviewScenarios } = require('../scripts/weekly-review-fixture');

test('weekly review fixture covers the retention rubric and expected-pause cases', () => {
  const scenarios = buildWeeklyReviewScenarios('2026-09-01');
  const concernValues = new Set(scenarios.flatMap((scenario) => scenario.expectedRetentionConcern));
  const attentionValues = new Set(scenarios.flatMap((scenario) => scenario.expectedAttentionLevel));
  assert.equal(scenarios.length, 12);
  assert.deepEqual([...concernValues].sort(), ['high', 'insufficient_evidence', 'low', 'some']);
  assert.equal(attentionValues.has('expected_pause'), true);
  assert.equal(attentionValues.has('insufficient_evidence'), true);
});

test('fixture includes anti-bias cases where coach work or health context is not client retention risk', () => {
  const scenarios = buildWeeklyReviewScenarios('2026-09-01');
  for (const key of ['coach-task-only', 'health-not-risk']) {
    const scenario = scenarios.find((entry) => entry.key === key);
    assert.ok(scenario);
    assert.deepEqual(scenario.expectedRetentionConcern, ['low']);
  }
});
