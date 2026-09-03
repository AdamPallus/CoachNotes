const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../api/workflow');

test('update prompt distinguishes historical backfill from current evidence', () => {
  const prompt = _test.renderClientUpdatePrompt({
    currentDate: '2026-09-02',
    client: { name: 'Maya' },
    currentBaseline: {
      overview: 'Currently following the revised plan. [intake_source_2]',
      timeline: [{ date: '2026-08-20', label: 'Plan revised', evidenceIds: ['intake_source_2'] }]
    },
    existingSourceIndex: [{
      source_id: 'intake_source_2',
      title: 'August check-in',
      source_type: 'check-in',
      date: '2026-08-20'
    }],
    sources: [{
      source_id: 'intake_source_3',
      title: 'Historical notes',
      source_type: 'notes',
      date: '2025-04-01',
      text: 'Client was considering a different plan.'
    }]
  });

  assert.match(prompt, /Existing baseline source date index/);
  assert.match(prompt, /intake_source_2/);
  assert.match(prompt, /newly imported source is not necessarily newer/i);
  assert.match(prompt, /must not regress a newer snapshot/i);
  assert.match(prompt, /oldest to newest/i);
});

test('intake prompt treats mixed historical sources as chronology, not import order', () => {
  const prompt = _test.renderClientIntakePrompt({
    currentDate: '2026-09-02',
    client: { name: 'Maya' },
    sources: [{
      source_id: 'intake_source_1',
      title: 'Historical notes',
      source_type: 'notes',
      date: '2025-04-01',
      text: 'Historical client information.'
    }]
  });

  assert.match(prompt, /Source order reflects import order, not client chronology/);
  assert.match(prompt, /Current-state sections must reflect the latest supported client state/);
});
