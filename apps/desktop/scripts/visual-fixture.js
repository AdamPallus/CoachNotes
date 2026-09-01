const fs = require('fs');
const path = require('path');

const clientNames = [
  'Avery Morgan',
  'Bianca Flores',
  'Camille Reed',
  'Devon Patel',
  'Elena Brooks',
  'Fatima Shah',
  'Grace Kim',
  'Hannah Cole',
  'Iris Bennett',
  'Jordan Lee',
  'Kai Wilson',
  'Lucia Torres',
  'Maya Thompson',
  'Nora Ellis'
];

function buildStructuredClient(name, index, evidenceIds) {
  const firstName = name.split(' ')[0];
  const isQuiet = index >= 8;
  const hasMissingInfo = index % 3 === 0;
  const hasRadarItem = index % 2 === 0;
  const taskEvidence = evidenceIds.slice(0, 1);
  return {
    overview: `${firstName} is building a sustainable strength and nutrition routine around a demanding schedule. Keep the next coaching touch practical, specific, and easy to act on.`,
    clientProfile: {
      location: index % 2 ? 'Seattle, WA' : 'Portland, OR',
      curriculum: index % 2 ? 'Foundations' : 'GGS Coaching',
      curriculumStartDate: '2026-06-15',
      trainingProgram: index % 2 ? 'Full Body Strength' : 'Kettlebells and Bands',
      programStartDate: '2026-07-01',
      cohort: index % 2 ? 'Summer' : 'July',
      trainingFormat: index % 2 ? 'Coach Assigned' : 'On Demand',
      primaryTrainingGoal: index % 2 ? 'Strength Gain' : 'Longevity',
      contraindications: index % 4 === 0 ? ['Sleep Disorder'] : []
    },
    clientValues: [
      { title: 'Consistency over perfection', detail: 'Prefers a plan that survives busy weeks.', evidenceIds }
    ],
    coachingPlanApproach: [
      { title: 'Keep the weekly target narrow', detail: 'Choose one nutrition action and one training action.', evidenceIds }
    ],
    goalsValues: [
      { title: 'Train consistently three times weekly', detail: 'Build confidence without all-or-nothing expectations.', priority: 'medium', planningStatus: 'active', evidenceIds }
    ],
    coachTasks: [
      {
        title: index % 2 ? 'Send the weekly check-in' : 'Confirm the next training adjustment',
        detail: 'Reference the latest client message and keep the next step concrete.',
        dueDate: index % 4 === 0 ? '2026-07-29' : '2026-07-24',
        priority: index % 3 === 0 ? 'high' : 'medium',
        planningStatus: index % 5 === 0 ? 'blocked' : 'active',
        evidenceIds: taskEvidence
      }
    ],
    flags: index % 4 === 0
      ? [{ title: 'Recurring migraine history', detail: 'Account for recovery needs when discussing training load.', evidenceIds }]
      : [],
    missingInfo: hasMissingInfo
      ? [{
          title: 'Confirm current calcium and vitamin D plan',
          detail: 'Needed before the next dashboard update is treated as fully current.',
          evidenceIds
        }]
      : [],
    radarItems: hasRadarItem
      ? [{
          title: isQuiet ? 'Temporary family schedule disruption' : 'Upcoming work travel',
          detail: 'May reduce bandwidth for adherence and communication over the near term.',
          throughDate: '2026-08-15',
          evidenceIds
        }]
      : [],
    timeline: [
      { title: '2026-07-22', detail: 'Reviewed weekly progress and agreed on the next smallest step.', evidenceIds }
    ],
    programChanges: [
      { title: 'Reduced session complexity', detail: 'Shifted to repeatable full-body sessions for travel weeks.', evidenceIds }
    ],
    progressTracking: [
      { title: 'More consistent training', detail: 'Completed the planned minimum for three consecutive weeks.', evidenceIds }
    ],
    engagementNotes: [
      { title: 'Responds well to concise choices', detail: 'Short messages make follow-through easier during busy weeks.', evidenceIds }
    ],
    nutritionThreads: [
      { title: 'Reliable weekday breakfast', detail: 'Keep protein and fiber options simple and repeatable.', evidenceIds }
    ],
    mindsetThreads: [
      { title: 'Practice flexible consistency', detail: 'Use the minimum plan instead of treating disruption as failure.', evidenceIds }
    ],
    exerciseThreads: [
      { title: 'Full-body strength foundation', detail: 'Progress volume only when recovery and schedule allow.', evidenceIds }
    ],
    suggestedTags: [index % 2 ? 'strength' : 'longevity', isQuiet ? 'quiet-client' : 'active-client'],
    resourcesShared: [
      { title: 'Travel training guide', detail: 'Short sessions using bands and bodyweight.', evidenceIds }
    ]
  };
}

function seedVisualFixture(db, userDataPath) {
  const vaultPath = path.join(userDataPath, 'visual-vault');
  fs.mkdirSync(vaultPath, { recursive: true });

  const reset = db.transaction(() => {
    db.exec(`
      DELETE FROM client_section_undo;
      DELETE FROM weekly_reviews;
      DELETE FROM client_baselines;
      DELETE FROM intake_sources;
      DELETE FROM clients;
      DELETE FROM settings;
    `);

    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('vaultFolder', vaultPath);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('proxyBaseUrl', 'https://visual-fixture.invalid');

    const insertClient = db.prepare(
      'INSERT INTO clients (name, display_name, archived, archived_at) VALUES (?, ?, 0, NULL)'
    );
    const insertSource = db.prepare(`
      INSERT INTO intake_sources
        (client_id, title, source_type, source_date, annotation, original_path, vault_path, raw_text, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertBaseline = db.prepare(`
      INSERT INTO client_baselines
        (client_id, status, structured_json, source_ids_json, model, raw_output, created_at, accepted_at, updated_at)
      VALUES (?, 'accepted', ?, ?, 'visual-fixture', '', ?, ?, ?)
    `);

    const weeklyClientReviews = [];
    clientNames.forEach((name, index) => {
      const clientId = Number(insertClient.run(name.toLowerCase(), name).lastInsertRowid);
      const sourceIds = [0, 1].map((sourceIndex) => Number(insertSource.run(
        clientId,
        sourceIndex ? 'Weekly client message' : 'Coaching session notes',
        sourceIndex ? 'message' : 'notes',
        sourceIndex ? '2026-07-26' : '2026-07-22',
        sourceIndex ? 'Note communication capacity and any near-term changes.' : '',
        '',
        '',
        sourceIndex
          ? `${name} shared a concise update about schedule, training, recovery, and the next support needed.`
          : `Session notes for ${name}: reviewed progress, clarified the immediate priority, and agreed on a manageable next step.`,
        sourceIndex ? '2026-07-26T14:00:00.000Z' : '2026-07-22T14:00:00.000Z',
        '{}'
      ).lastInsertRowid));
      const evidenceIds = sourceIds.map((sourceId) => `intake_source_${sourceId}`);
      const structured = buildStructuredClient(name, index, evidenceIds);
      const updatedAt = index >= 8 ? '2026-06-01T14:00:00.000Z' : `2026-07-${String(28 - index).padStart(2, '0')}T14:00:00.000Z`;
      insertBaseline.run(
        clientId,
        JSON.stringify(structured),
        JSON.stringify(sourceIds),
        '2026-07-22T14:00:00.000Z',
        '2026-07-22T14:00:00.000Z',
        updatedAt
      );
      const attentionLevel = index === 0
        ? 'needs_attention'
        : index === 1
          ? 'watch'
          : index === 2
            ? 'expected_pause'
            : index === 3
              ? 'insufficient_evidence'
              : 'routine';
      const retentionConcern = index === 0
        ? 'high'
        : index === 1
          ? 'some'
          : index === 3
            ? 'insufficient_evidence'
            : 'low';
      weeklyClientReviews.push({
        clientId: String(clientId),
        clientName: name,
        attentionLevel,
        retentionConcern,
        currentFocus: `${name.split(' ')[0]} is working on a repeatable training and nutrition rhythm.`,
        weeklyAssessment: index === 0
          ? 'Recent communication and follow-through changes warrant a direct, personal check-in this week.'
          : 'The current dashboard supports a clear, proportionate next step without adding unnecessary work.',
        suggestedCoachFocus: index < 2
          ? 'Clarify what support would feel most useful right now.'
          : 'Keep the next action small and confirm that the plan still fits.',
        evidence: ['The latest dashboard captures a specific engagement or follow-through signal.'],
        counterevidence: index === 0 ? [] : ['The client remains connected to an agreed next step.']
      });
    });

    db.prepare(`
      INSERT INTO weekly_reviews
        (week_of, generated_at, model, report_json, context_stats_json, usage_json)
      VALUES (?, ?, 'visual-fixture', ?, ?, '{}')
    `).run(
      '2026-07-27',
      '2026-07-29T15:00:00.000Z',
      JSON.stringify({
        schemaVersion: 'weekly_client_review.v1',
        openingSummary: 'Happy Monday. Most clients have a clear next step, while a small group deserves a more deliberate look before the week gathers pace.',
        practicePatterns: [
          {
            title: 'Keep the next action narrow',
            summary: 'Several clients are managing busy schedules well when the plan stays concrete and easy to repeat.',
            clientIds: weeklyClientReviews.slice(4, 9).map((review) => review.clientId)
          },
          {
            title: 'Communication context matters',
            summary: 'Planned pauses should stay visible without being mistaken for disengagement.',
            clientIds: [weeklyClientReviews[2].clientId]
          }
        ],
        clientReviews: weeklyClientReviews
      }),
      JSON.stringify({ clientCount: weeklyClientReviews.length, currentDate: '2026-07-29' })
    );
  });

  reset();
}

module.exports = { seedVisualFixture };
