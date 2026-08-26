const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLIENT_UPDATE_SCHEMA_VERSION,
  normalizeClientUpdatePatch
} = require('../api/workflow-update-contract');

test('normalizes a valid partial dashboard update', () => {
  const result = normalizeClientUpdatePatch({
    schemaVersion: CLIENT_UPDATE_SCHEMA_VERSION,
    updateSummary: ' Updated the snapshot and coach follow-up. ',
    sectionUpdates: [
      {
        sectionKey: 'overview',
        operation: 'replace',
        value: 'Client is building consistency.',
        summary: ' Refreshed the snapshot. ',
        reason: ' New check-in shows progress. ',
        evidenceIds: ['source_1', 'source_1']
      },
      {
        sectionKey: 'coachTasks',
        operation: 'append',
        value: [{ title: 'Check in Friday', evidenceIds: ['source_1'] }],
        summary: 'Added a follow-up.',
        evidenceIds: ['source_1']
      }
    ]
  });

  assert.equal(result.updateSummary, 'Updated the snapshot and coach follow-up.');
  assert.deepEqual(result.sectionUpdates[0].evidenceIds, ['source_1']);
  assert.equal(result.sectionUpdates[1].sectionKey, 'coachTasks');
});

test('allows a source to produce no dashboard changes', () => {
  const result = normalizeClientUpdatePatch({
    schemaVersion: CLIENT_UPDATE_SCHEMA_VERSION,
    updateSummary: 'No dashboard changes were needed.',
    sectionUpdates: []
  });

  assert.deepEqual(result.sectionUpdates, []);
});

test('rejects the former full-baseline response contract', () => {
  assert.throws(() => normalizeClientUpdatePatch({
    schemaVersion: 'client_update.v2',
    updateSummary: 'Updated.',
    updatedBaseline: { overview: 'Replacement' }
  }), /client_update_patch\.v1/);
});

test('rejects duplicate sections and invalid replacement types', () => {
  assert.throws(() => normalizeClientUpdatePatch({
    schemaVersion: CLIENT_UPDATE_SCHEMA_VERSION,
    updateSummary: 'Updated.',
    sectionUpdates: [
      { sectionKey: 'overview', operation: 'replace', value: 'One' },
      { sectionKey: 'overview', operation: 'replace', value: 'Two' }
    ]
  }), /Duplicate section update/);

  assert.throws(() => normalizeClientUpdatePatch({
    schemaVersion: CLIENT_UPDATE_SCHEMA_VERSION,
    updateSummary: 'Updated.',
    sectionUpdates: [{ sectionKey: 'coachTasks', operation: 'append', value: 'not an array' }]
  }), /with an array value/);
});
