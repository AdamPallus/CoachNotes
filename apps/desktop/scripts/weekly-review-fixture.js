const FIXTURE_PREFIX = 'Weekly Review Demo - ';

function dateOffset(referenceDate, offsetDays) {
  const date = new Date(`${referenceDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function item(title, detail, extra = {}) {
  return { title, detail, ...extra };
}

function baseStructured(name, overview) {
  return {
    overview,
    clientProfile: {
      curriculum: 'Foundations',
      trainingProgram: 'Sustainable Strength',
      primaryTrainingGoal: 'Build a repeatable health routine'
    },
    coachTasks: [],
    flags: [],
    radarItems: [],
    goalsValues: [item('Build a sustainable weekly routine', 'Use a plan that can survive ordinary work and family demands.', { planningStatus: 'active' })],
    clientValues: [item('Consistency over perfection', `${name} prefers practical steps that can be repeated.`)],
    coachingPlanApproach: [item('Choose one smallest next action', 'Keep the weekly plan narrow and specific.', { timing: 'now' })],
    programChanges: [],
    progressTracking: [],
    engagementNotes: [],
    nutritionThreads: [],
    mindsetThreads: [],
    exerciseThreads: [],
    resourcesShared: [],
    suggestedTags: ['weekly-review-demo'],
    timeline: [],
    missingInfo: [],
    confidenceNotes: []
  };
}

function buildWeeklyReviewScenarios(referenceDate = new Date().toISOString().slice(0, 10)) {
  const scenarios = [];

  const engaged = baseStructured('Avery', 'Avery is steadily building a three-day training rhythm and has been communicating clearly about adjustments.');
  engaged.coachTasks.push(item('Confirm next week training target', 'Use the latest successful week as the baseline.', { dueDate: dateOffset(referenceDate, 2), priority: 'medium', planningStatus: 'active' }));
  engaged.progressTracking.push(item('Three consistent weeks', 'Completed the planned minimum and reported that the routine feels manageable.', { status: 'improving' }));
  engaged.engagementNotes.push(item('Specific and responsive', 'Usually replies within one or two days and answers troubleshooting questions directly.'));
  scenarios.push({
    key: 'engaged-steady',
    name: 'Avery',
    daysSinceUpdate: 1,
    sourceType: 'message',
    structured: engaged,
    expectedAttentionLevel: ['routine'],
    expectedRetentionConcern: ['low']
  });

  const travel = baseStructured('Bianca', 'Bianca is maintaining a minimum routine while preparing for a planned international trip.');
  travel.radarItems.push(item('International travel', 'Communication and normal training will pause during the trip.', { throughDate: dateOffset(referenceDate, 9), status: 'active' }));
  travel.progressTracking.push(item('Travel plan agreed', 'Selected two optional short sessions and explicitly agreed that rest is acceptable.'));
  travel.engagementNotes.push(item('Planned pause communicated', 'Bianca confirmed the travel dates and when normal check-ins will resume.'));
  scenarios.push({
    key: 'planned-travel',
    name: 'Bianca',
    daysSinceUpdate: 8,
    sourceType: 'message',
    structured: travel,
    expectedAttentionLevel: ['expected_pause'],
    expectedRetentionConcern: ['low']
  });

  const bereavement = baseStructured('Camille', 'Camille has intentionally paused coaching tasks during a family bereavement.');
  bereavement.radarItems.push(item('Family bereavement', 'No follow-up is expected until Camille reaches out after the family service.', { throughDate: dateOffset(referenceDate, 6), status: 'active' }));
  bereavement.engagementNotes.push(item('Pause was explicit', 'Camille asked for space and said she intends to resume afterward.'));
  scenarios.push({
    key: 'bereavement-pause',
    name: 'Camille',
    daysSinceUpdate: 9,
    sourceType: 'message',
    structured: bereavement,
    expectedAttentionLevel: ['expected_pause'],
    expectedRetentionConcern: ['low']
  });

  const silent = baseStructured('Devon', 'Devon has stopped responding after a previously consistent check-in pattern and several unfinished commitments.');
  silent.coachTasks.push(item('Make one low-pressure personal check-in', 'Acknowledge the silence without adding more assignments.', { dueDate: dateOffset(referenceDate, 0), priority: 'high', planningStatus: 'active' }));
  silent.progressTracking.push(item('Follow-through dropped', 'The last three agreed actions were not completed or discussed.', { status: 'inconsistent' }));
  silent.engagementNotes.push(item('Sustained unexplained silence', 'Previously replied within two days; there has been no response to three check-ins or two troubleshooting prompts.'));
  scenarios.push({
    key: 'sustained-silence',
    name: 'Devon',
    daysSinceUpdate: 18,
    sourceType: 'check-in',
    structured: silent,
    expectedAttentionLevel: ['needs_attention'],
    expectedRetentionConcern: ['high']
  });

  const cancel = baseStructured('Elena', 'Elena directly questioned whether coaching is worth continuing and asked about ending the program.');
  cancel.coachTasks.push(item('Discuss program fit and options', 'Listen for what has not felt useful before discussing next steps.', { dueDate: dateOffset(referenceDate, 1), priority: 'high', planningStatus: 'active' }));
  cancel.engagementNotes.push(item('Direct cancellation concern', 'Elena wrote that the program may not be worth the cost and asked how cancellation works.'));
  cancel.progressTracking.push(item('Recent plan not followed', 'Two weekly plans were not attempted and no alternative was chosen.', { status: 'difficult' }));
  scenarios.push({
    key: 'direct-cancel',
    name: 'Elena',
    daysSinceUpdate: 1,
    sourceType: 'message',
    structured: cancel,
    expectedAttentionLevel: ['needs_attention'],
    expectedRetentionConcern: ['high']
  });

  const discouraged = baseStructured('Fatima', 'Fatima is discouraged by slow progress but remains communicative and is still trying agreed adjustments.');
  discouraged.coachTasks.push(item('Reflect the progress that is easy to miss', 'Keep the conversation specific and ask what support would feel useful.', { dueDate: dateOffset(referenceDate, 3), priority: 'medium', planningStatus: 'active' }));
  discouraged.mindsetThreads.push(item('Frustrated by pace', 'Said the effort does not feel visible yet and sounded discouraged.', { status: 'watch' }));
  discouraged.engagementNotes.push(item('Still responsive', 'Answered the latest check-in thoughtfully and chose a smaller next step.'));
  discouraged.progressTracking.push(item('Continuing minimum plan', 'Completed two of three planned sessions this week.', { status: 'improving' }));
  scenarios.push({
    key: 'discouraged-responsive',
    name: 'Fatima',
    daysSinceUpdate: 2,
    sourceType: 'check-in',
    structured: discouraged,
    expectedAttentionLevel: ['watch'],
    expectedRetentionConcern: ['some']
  });

  const mismatch = baseStructured('Grace', 'Grace wants rapid results while repeatedly rejecting the schedule and nutrition constraints required by the current plan.');
  mismatch.coachTasks.push(item('Clarify the goal and real constraints', 'Explore what tradeoffs Grace is actually willing to make.', { dueDate: dateOffset(referenceDate, 4), priority: 'medium', planningStatus: 'active' }));
  mismatch.coachingPlanApproach = [item('Find an acceptable minimum', 'Several smaller options were offered but none has been accepted yet.', { timing: 'now' })];
  mismatch.engagementNotes.push(item('Conversation continues', 'Grace responds, but redirects troubleshooting back to the original outcome without accepting a workable adjustment.'));
  mismatch.progressTracking.push(item('Plan-action mismatch', 'Current goals and available time remain materially misaligned.', { status: 'difficult' }));
  scenarios.push({
    key: 'constraint-mismatch',
    name: 'Grace',
    daysSinceUpdate: 3,
    sourceType: 'message',
    structured: mismatch,
    expectedAttentionLevel: ['watch'],
    expectedRetentionConcern: ['some']
  });

  const coachOverdue = baseStructured('Hannah', 'Hannah is engaged, following the plan, and waiting for the coach to send the promised resource.');
  coachOverdue.coachTasks.push(item('Send travel meal guide', 'Coach promised this resource in the last meeting.', { dueDate: dateOffset(referenceDate, -2), priority: 'high', planningStatus: 'active' }));
  coachOverdue.progressTracking.push(item('Plan is on track', 'Completed the agreed workouts and meal-prep action.', { status: 'improving' }));
  coachOverdue.engagementNotes.push(item('Warm and responsive', 'Sent a complete check-in and asked a specific follow-up question.'));
  scenarios.push({
    key: 'coach-task-only',
    name: 'Hannah',
    daysSinceUpdate: 1,
    sourceType: 'check-in',
    structured: coachOverdue,
    expectedAttentionLevel: ['needs_attention'],
    expectedRetentionConcern: ['low']
  });

  const health = baseStructured('Iris', 'Iris is adapting training around an ongoing health constraint while remaining engaged with coaching.');
  health.flags.push(item('Chronic migraine history', 'Training load and recovery discussions should account for symptoms.', { urgency: 'medium', status: 'active' }));
  health.programChanges.push(item('Reduced high-intensity volume', 'Adjustment was agreed to support recovery.', { status: 'active' }));
  health.engagementNotes.push(item('Consistently communicative', 'Iris reports symptoms promptly and collaborates on alternatives.'));
  health.progressTracking.push(item('Modified plan followed', 'Completed the adjusted sessions without reported problems.', { status: 'improving' }));
  scenarios.push({
    key: 'health-not-risk',
    name: 'Iris',
    daysSinceUpdate: 2,
    sourceType: 'message',
    structured: health,
    expectedAttentionLevel: ['routine'],
    expectedRetentionConcern: ['low']
  });

  const sparse = baseStructured('Jordan', 'Jordan completed intake, but there is not enough recent coaching context to understand current engagement or progress.');
  sparse.engagementNotes = [];
  sparse.progressTracking = [];
  sparse.timeline = [];
  sparse.missingInfo.push(item('Current check-in and participation status', 'No recent response, plan update, or expected-pause context is recorded.'));
  sparse.confidenceNotes.push(item('Sparse record', 'The available dashboard does not support a current engagement judgment.'));
  scenarios.push({
    key: 'sparse-stale',
    name: 'Jordan',
    daysSinceUpdate: 23,
    sourceType: 'notes',
    structured: sparse,
    expectedAttentionLevel: ['insufficient_evidence'],
    expectedRetentionConcern: ['insufficient_evidence']
  });

  const graduate = baseStructured('Kai', 'Kai has met the current program goals and is preparing to graduate to self-directed maintenance.');
  graduate.goalsValues[0].planningStatus = 'completed';
  graduate.progressTracking.push(item('Program goals met', 'Maintained the target routine independently for six weeks.', { status: 'mastered' }));
  graduate.engagementNotes.push(item('Positive transition', 'Kai expressed confidence and appreciation and confirmed the maintenance plan.'));
  graduate.coachingPlanApproach = [item('Graduate to maintenance', 'Use one final review to confirm self-directed supports.', { timing: 'future' })];
  scenarios.push({
    key: 'successful-graduation',
    name: 'Kai',
    daysSinceUpdate: 3,
    sourceType: 'notes',
    structured: graduate,
    expectedAttentionLevel: ['routine'],
    expectedRetentionConcern: ['low']
  });

  const inconsistent = baseStructured('Lucia', 'Lucia remains in contact but has struggled to follow through on the last several weekly actions.');
  inconsistent.coachTasks.push(item('Ask which action still feels realistic', 'Avoid adding another plan before understanding the barrier.', { dueDate: dateOffset(referenceDate, 2), priority: 'medium', planningStatus: 'active' }));
  inconsistent.progressTracking.push(item('Repeated partial follow-through', 'Four weeks of plans were started but not completed.', { status: 'inconsistent' }));
  inconsistent.engagementNotes.push(item('Recent reply with mixed confidence', 'Lucia replied this week, apologized for falling behind, and said she is not sure the program is working for her.'));
  scenarios.push({
    key: 'inconsistent-but-present',
    name: 'Lucia',
    daysSinceUpdate: 1,
    sourceType: 'message',
    structured: inconsistent,
    expectedAttentionLevel: ['watch', 'needs_attention'],
    expectedRetentionConcern: ['some']
  });

  return scenarios;
}

function seedWeeklyReviewFixture(db, referenceDate = new Date().toISOString().slice(0, 10)) {
  const scenarios = buildWeeklyReviewScenarios(referenceDate);
  db.pragma('foreign_keys = ON');
  const seed = db.transaction(() => {
    db.prepare('DELETE FROM clients WHERE display_name LIKE ?').run(`${FIXTURE_PREFIX}%`);
    const insertClient = db.prepare(
      'INSERT INTO clients (name, display_name, archived, archived_at) VALUES (?, ?, 0, NULL)'
    );
    const insertSource = db.prepare(`
      INSERT INTO intake_sources
        (client_id, title, source_type, source_date, annotation, original_path, vault_path, raw_text, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, '', '', ?, ?, '{}')
    `);
    const insertBaseline = db.prepare(`
      INSERT INTO client_baselines
        (client_id, status, structured_json, source_ids_json, model, raw_output, created_at, accepted_at, updated_at)
      VALUES (?, 'accepted', ?, ?, 'weekly-review-fixture', '', ?, ?, ?)
    `);

    for (const scenario of scenarios) {
      const displayName = `${FIXTURE_PREFIX}${scenario.name}`;
      const clientId = Number(insertClient.run(displayName.toLowerCase(), displayName).lastInsertRowid);
      const sourceDate = dateOffset(referenceDate, -scenario.daysSinceUpdate);
      const createdAt = `${sourceDate}T16:00:00.000Z`;
      const sourceId = Number(insertSource.run(
        clientId,
        `Weekly review scenario: ${scenario.key}`,
        scenario.sourceType,
        sourceDate,
        'Curated local fixture for weekly review evaluation.',
        `Local test scenario for ${scenario.name}. The accepted dashboard contains the evaluation evidence.`,
        createdAt
      ).lastInsertRowid);
      insertBaseline.run(
        clientId,
        JSON.stringify(scenario.structured),
        JSON.stringify([sourceId]),
        createdAt,
        createdAt,
        createdAt
      );
    }
  });
  seed();
  return scenarios;
}

module.exports = {
  FIXTURE_PREFIX,
  buildWeeklyReviewScenarios,
  seedWeeklyReviewFixture
};
