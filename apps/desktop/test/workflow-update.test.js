const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyPartialUpdate,
  extractPartialUpdateResponse
} = require('../src/workflow-update');

test('applies only listed dashboard sections', () => {
  const current = {
    schemaVersion: 'client_baseline.v2',
    overview: 'Old overview',
    flags: [{ title: 'Keep this flag' }],
    coachTasks: [{ title: 'Old task' }],
    clientProfile: { age: '42', location: 'Portland', cohort: 'January' }
  };
  const parsed = extractPartialUpdateResponse({
    structured: {
      schemaVersion: 'client_update_patch.v1',
      updateSummary: 'Updated the overview, tasks, and location.',
      sectionUpdates: [
        { sectionKey: 'overview', operation: 'replace', value: 'New overview', summary: 'Snapshot refreshed.' },
        { sectionKey: 'coachTasks', operation: 'replace', value: [{ title: 'New task' }] },
        { sectionKey: 'clientProfile', operation: 'merge', value: { location: 'Seattle' } }
      ]
    }
  });

  const next = applyPartialUpdate(current, parsed.sectionUpdates);
  assert.equal(next.overview, 'New overview');
  assert.deepEqual(next.coachTasks, [{ title: 'New task' }]);
  assert.deepEqual(next.flags, [{ title: 'Keep this flag' }]);
  assert.deepEqual(next.clientProfile, { age: '42', location: 'Seattle', cohort: 'January' });
  assert.equal(next.schemaVersion, 'client_baseline.v2');
});

test('accepts an empty update without changing the baseline', () => {
  const current = { overview: 'No change', flags: [] };
  const parsed = extractPartialUpdateResponse({
    structured: {
      schemaVersion: 'client_update_patch.v1',
      updateSummary: 'No dashboard changes were needed.',
      sectionUpdates: []
    }
  });

  assert.deepEqual(applyPartialUpdate(current, parsed.sectionUpdates), current);
});

test('appends new timeline items without returning or replacing history', () => {
  const current = {
    timeline: [{ date: '2026-08-01', label: 'Existing milestone' }],
    flags: [{ title: 'Unchanged flag' }]
  };
  const parsed = extractPartialUpdateResponse({
    structured: {
      schemaVersion: 'client_update_patch.v1',
      updateSummary: 'Added a new milestone.',
      sectionUpdates: [{
        sectionKey: 'timeline',
        operation: 'append',
        value: [{ date: '2026-08-26', label: 'New milestone' }]
      }]
    }
  });

  const next = applyPartialUpdate(current, parsed.sectionUpdates);
  assert.equal(next.timeline.length, 2);
  assert.equal(next.timeline[0].label, 'Existing milestone');
  assert.deepEqual(next.flags, current.flags);
});

test('places an appended backdated timeline item into chronological order', () => {
  const current = {
    timeline: [
      { date: '2026-04-10', label: 'Current milestone' },
      { date: 'unknown', label: 'Undated context' }
    ]
  };
  const parsed = extractPartialUpdateResponse({
    structured: {
      schemaVersion: 'client_update_patch.v1',
      updateSummary: 'Added historical context.',
      sectionUpdates: [{
        sectionKey: 'timeline',
        operation: 'append',
        value: [{ date: '2025-11-03', label: 'Historical milestone' }]
      }]
    }
  });

  const next = applyPartialUpdate(current, parsed.sectionUpdates);
  assert.deepEqual(next.timeline.map((item) => item.label), [
    'Historical milestone',
    'Current milestone',
    'Undated context'
  ]);
});

test('rejects unknown, duplicate, and wrongly typed section updates', () => {
  const response = (sectionUpdates) => ({
    structured: {
      schemaVersion: 'client_update_patch.v1',
      updateSummary: 'Updated.',
      sectionUpdates
    }
  });

  assert.throws(
    () => extractPartialUpdateResponse(response([{ sectionKey: 'privateNotes', operation: 'append', value: [] }])),
    /unsupported section/
  );
  assert.throws(
    () => extractPartialUpdateResponse(response([
      { sectionKey: 'overview', operation: 'replace', value: 'One' },
      { sectionKey: 'overview', operation: 'replace', value: 'Two' }
    ])),
    /duplicate section/
  );
  assert.throws(
    () => extractPartialUpdateResponse(response([{ sectionKey: 'timeline', operation: 'append', value: 'not an array' }])),
    /with a list/
  );
});
