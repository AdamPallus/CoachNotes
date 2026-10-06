const assert = require('node:assert/strict');
const workflow = require('../api/workflow');
const { validateWorkflowEvidence } = require('../api/_citations');

// Synthetic data only. This makes one paid workflow request (up to two model
// attempts), and never reads a coach's vault or prints prompt/response bodies.
async function main() {
  if (!process.argv.includes('--live')) throw new Error('Pass --live to permit the synthetic API check.');
  const urlIndex = process.argv.indexOf('--url');
  const url = urlIndex >= 0 ? process.argv[urlIndex + 1] : '';
  const token = String(process.env.INVITE_TOKENS || process.env.INVITE_TOKEN || '').split(',')[0].trim();
  if (!token) throw new Error('An invite token is required.');
  const oldIds = ['intake_source_101', 'intake_source_175', 'intake_source_286'];
  const currentBaseline = {
    clientProfile: { preferredName: 'Synthetic Citation Test', curriculum: 'Demo' },
    overview: 'Training has been consistent; next week is expected to follow the usual routine [intake_source_101, intake_source_286].',
    coachTasks: [{ title: 'Coach-entered reminder', details: 'Review the plan at the next meeting.', planningStatus: 'active', priority: 'none' }],
    suggestedTags: ['consistency'],
    timeline: [{ date: '2026-10-01', event: 'Client confirmed the usual routine.', evidenceIds: ['intake_source_286'] }]
  };
  for (const section of ['flags', 'radarItems', 'goalsValues', 'clientValues', 'coachingPlanApproach', 'programChanges', 'progressTracking', 'engagementNotes', 'nutritionThreads', 'mindsetThreads', 'exerciseThreads', 'resourcesShared', 'missingInfo', 'confidenceNotes']) {
    currentBaseline[section] = Array.from({ length: 7 }, (_, i) => ({
      title: `Synthetic historical ${section} item ${i + 1}`,
      details: `Historical demonstration context only. The client previously discussed consistency, scheduling, and manageable routines at meeting ${i + 1}. Preserve this historical context unless the new note specifically changes it. This is generated test data, not an actual client record.`,
      planningStatus: 'active', priority: 'none', evidenceIds: [oldIds[i % oldIds.length]]
    }));
  }
  const body = {
    model: 'gpt-5.6-luna', workflow: 'client_note_update', currentDate: '2026-10-06',
    client: { name: 'Synthetic Citation Test' }, currentBaseline,
    existingSourceIndex: oldIds.map((source_id) => ({ source_id, date: '2026-10-01', title: 'Synthetic historical note', source_type: 'notes' })),
    sources: [{ source_id: 'intake_source_302', date: '2026-10-06', title: 'Synthetic travel update', source_type: 'notes',
      annotation: 'Update the current overview and add the temporary travel context to Keep on My Radar. Leave unrelated history and coach-entered tasks unchanged.',
      text: 'The client now reports a trip from October 12 through October 18. They expect reduced gym access and agreed to two short bodyweight sessions that week. This changes the expectation of a usual training week. They still want to build consistency, and they are not abandoning the coaching plan. Resume the regular plan after returning. The coach should check how the modified plan worked at the next meeting, not infer disengagement from the travel pause.' }]
  };
  let status = 200, result;
  if (url) {
    const response = await fetch(new URL('/workflow', url), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
    status = response.status;
    result = await response.json();
  } else {
    await workflow({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, {
      setHeader() {}, status(code) { status = code; return this; }, json(value) { result = value; }
    });
  }
  assert.equal(status, 200, result?.error || 'Workflow did not succeed');
  assert.ok(result.structured.sectionUpdates.length > 0, 'Expected the new travel context to update the dashboard');
  assert.ok(JSON.stringify(result.structured).includes('intake_source_302'), 'New context must cite the new source');
  validateWorkflowEvidence(result.structured, body, 'client_note_update');
  console.log(JSON.stringify({ passed: true, target: url ? 'remote' : 'local handler', model: result.model, attempts: result.attempts, baselineChars: JSON.stringify(currentBaseline).length, changedSections: result.structured.sectionUpdates.map((s) => s.sectionKey) }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
