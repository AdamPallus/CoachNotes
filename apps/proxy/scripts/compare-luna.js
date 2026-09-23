// Paid, opt-in evaluation. Synthetic fixtures only; never reads or writes a client vault.
const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createHash } = require('node:crypto');
const OpenAI = require('openai');
const { buildWeeklyReviewScenarios } = require('../../desktop/scripts/weekly-review-fixture');
const { buildWeeklyReviewContext } = require('../../desktop/src/weekly-review');

if (!process.argv.includes('--run')) {
  console.log('Paid demo-only comparison: node apps/proxy/scripts/compare-luna.js --run [--case name]');
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) process.loadEnvFile(path.resolve(__dirname, '../.env'));
const token = 'local-synthetic-evaluation';
process.env.INVITE_TOKENS = token;
process.env.LLM_MODEL_ALLOWLIST = 'gpt-5.6-luna,gpt-6-luna';
const models = ['gpt-5.6-luna', 'gpt-6-luna'];
const session = new AsyncLocalStorage();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const create = client.responses.create.bind(client.responses);

// Record every response, including formatting retries and streaming completions.
// Override only the model so this harness can compare physical models after routing changes.
client.responses.create = async (request, options) => {
  const run = session.getStore();
  const actual = { ...request, model: run.model, store: false };
  const { model, ...comparable } = actual;
  const attempt = {
    request: actual,
    promptHash: createHash('sha256').update(JSON.stringify(comparable)).digest('hex')
  };
  run.attempts.push(attempt);
  const start = Date.now();
  const record = (response) => Object.assign(attempt, {
    durationMs: Date.now() - start,
    actualModel: response.model,
    status: response.status,
    incompleteDetails: response.incomplete_details,
    usage: response.usage,
    output: response.output_text || response.output
  });
  const result = await create(actual, options);
  if (!request.stream) {
    record(result);
    return result;
  }
  return (async function* () {
    for await (const event of result) {
      if (['response.completed', 'response.incomplete', 'response.failed'].includes(event.type)) record(event.response);
      yield event;
    }
  })();
};
const shared = require('../api/_shared');
shared.getOpenAIClient = () => client;
const selectModel = shared.allowModel;
shared.allowModel = (requested, fallback, key) => key === 'LLM_MODEL_ALLOWLIST' && models.includes(requested)
  ? requested
  : selectModel(requested, fallback, key);
const handlers = {
  workflow: require('../api/workflow'),
  answer: require('../api/answer'),
  summarize: require('../api/summarize'),
  weekly: require('../api/weekly-review')
};
const date = '2026-09-23';
function dateOffset(value, days) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
const scenarios = buildWeeklyReviewScenarios(date);
const context = buildWeeklyReviewContext(scenarios.map((s) => ({
  id: s.key, name: s.name, structured: s.structured,
  updatedAt: dateOffset(date, -s.daysSinceUpdate), daysSinceUpdate: s.daysSinceUpdate,
  lastSourceDate: dateOffset(date, -s.daysSinceUpdate),
  recentSourceCount: s.daysSinceUpdate < 7 ? 1 : 0,
  hasRecentMessage: s.daysSinceUpdate < 7 && s.sourceType === 'message'
})), { currentDate: date });
const baseline = {
  ...structuredClone(scenarios[0].structured),
  schemaVersion: 'client_baseline.v2',
  overview: 'Maya currently follows two short strength sessions weekly, with knee pain resolved. She is communicating consistently and prioritizing a manageable routine. [intake_source_1]',
  coachTasks: [{ title: 'Send agreed meal guide', details: 'Coach promised the guide.', status: 'open', dueOrReviewBy: '2026-09-25', evidenceIds: ['intake_source_1'] }],
  exerciseThreads: [{ title: 'Two short sessions', details: 'Current plan agreed September 20.', status: 'active', evidenceIds: ['intake_source_1'] }],
  flags: [{ title: 'Previous knee pain', details: 'Resolved as of September 20.', status: 'resolved', evidenceIds: ['intake_source_1'] }],
  timeline: [{ date: '2026-09-20', label: 'Agreed two-session plan; knee pain resolved', evidenceIds: ['intake_source_1'] }]
};
const latest = {
  source_id: 'intake_source_1', title: 'September 20 check-in', date: '2026-09-20', source_type: 'check-in',
  text: 'Maya: My knee pain has resolved. I am now doing two short strength sessions weekly, not the five-day plan from June. This feels manageable and I am replying consistently. Coach: I will send the agreed meal guide by September 25.'
};
const historical = {
  source_id: 'intake_source_2', title: 'Imported June check-in', date: '2026-06-02', source_type: 'check-in',
  text: 'June 2: Maya is following a five-day strength plan and reports knee pain. She missed three check-ins and wonders whether she should quit coaching. Coach planned to follow up June 5. These notes document June, not the current situation.'
};
const current = {
  source_id: 'intake_source_3', title: 'September 23 message', date, source_type: 'message',
  text: 'The two short sessions are going well and my knee still feels fine. I will be away September 26 through October 4. We agreed to pause check-ins while I am away and resume October 5. Please keep my training plan at two sessions. Coach: I will send your hotel workout options by September 25. The meal guide is still on my list too.'
};
const sources = [latest, historical, current].map((s) => ({ ...s, chunk_id: s.source_id, client_ids: ['maya'] }));
const update = (source) => ({
  workflow: 'client_note_update', currentDate: date, client: { name: 'Maya' },
  currentBaseline: baseline, existingSourceIndex: [latest], sources: [source]
});
const largeBaseline = structuredClone(baseline);
const coachItem = {
  title: 'Ask about coaching format preference', details: 'Discuss by phone, not by message.',
  priority: 'high', planningStatus: 'active', dueDate: '2026-09-24'
};
largeBaseline.timeline = [
  ...Array.from({ length: 36 }, (_, i) => ({
    date: dateOffset('2026-06-05', i * 3),
    label: `Historical coaching review ${i + 1}`,
    details: 'Coach and client reviewed how the weekly routine fitted work and family commitments. They discussed the difference between an ideal training schedule and a sustainable minimum, agreed to keep communication manageable, and recorded the result for later comparison. This dated review is historical context, not a new current assignment.',
    evidenceIds: ['intake_source_0']
  })),
  ...baseline.timeline
];
const cases = [
  { name: 'intake-mixed-dates', route: 'workflow', body: { workflow: 'client_intake_baseline', currentDate: date, client: { name: 'Maya' }, sources: [latest, historical, current] } },
  { name: 'current-note', route: 'workflow', body: update(current) },
  { name: 'coach-edits', route: 'workflow', body: {
    ...update(current), currentBaseline: { ...baseline, coachTasks: [...baseline.coachTasks, coachItem] }
  } },
  { name: 'backdated-note', route: 'workflow', body: update(historical) },
  { name: 'large-backfill', route: 'workflow', body: {
    ...update(historical), currentBaseline: largeBaseline,
    existingSourceIndex: [{ source_id: 'intake_source_0', title: 'Historical coaching archive', date: '2026-09-18', source_type: 'notes' }, latest]
  } },
  { name: 'duplicate-note', route: 'workflow', body: update({ ...latest, source_id: 'intake_source_4' }) },
  { name: 'ask-questions-stream', route: 'answer', body: { stream: true, sources, question: 'Give me 1-3 questions to ask Maya based on the recent update.' } },
  { name: 'ask-session-prep', route: 'answer', body: { sources, question: 'Help me prepare for my next meeting with Maya.', instructions: 'Return concise session prep notes with headings: Focus, Recent Context, Watch-outs, Suggested Talking Points. Prefer bullets that help the coach prepare quickly.' } },
  { name: 'ask-missing-evidence', route: 'answer', body: { sources, question: 'What is Maya\'s blood pressure and exact current medication dose?' } },
  { name: 'summary', route: 'summarize', body: { sources, mode: 'search_results_summary' } },
  { name: 'weekly-12', route: 'weekly', body: { operation: 'assess_batch', context } },
  { name: 'weekly-synthesis', route: 'weekly', body: { operation: 'synthesize', synthesisContext: {
    currentDate: date, clients: context.clients,
    clientReviews: scenarios.map((s) => ({
      clientId: s.key, clientName: s.name,
      attentionLevel: s.expectedAttentionLevel[0], retentionConcern: s.expectedRetentionConcern[0],
      currentFocus: s.structured.overview,
      weeklyAssessment: JSON.stringify(s.structured.engagementNotes).slice(0, 350),
      suggestedCoachFocus: s.structured.coachTasks[0]?.detail || 'Respect the agreed plan and check in when appropriate.',
      evidence: [s.structured.overview], counterevidence: []
    }))
  } } }
];
const outputDir = path.resolve('output/model-comparison', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(outputDir, { recursive: true });
console.log(`Results: ${outputDir}`);
async function runCase(testCase, model) {
  const run = { case: testCase.name, model, attempts: [], body: testCase.body };
  const started = Date.now();
  return session.run(run, async () => {
    const chunks = [];
    const res = {
      statusCode: 200, headersSent: false, writableEnded: false,
      setHeader() {}, flushHeaders() { this.headersSent = true; },
      status(code) { this.statusCode = code; return this; },
      json(value) { run.result = value; },
      write(value) { chunks.push(value); },
      end() { this.writableEnded = true; }
    };
    try {
      await handlers[testCase.route]({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: { currentDate: date, ...testCase.body, model } }, res);
      if (chunks.length) {
        run.streamEvents = chunks.join('').trim().split('\n').map(JSON.parse);
        run.result = run.streamEvents.find((e) => e.type === 'done')?.data;
      }
      run.httpStatus = res.statusCode;
    } catch (error) { run.error = error.message; }
    run.durationMs = Date.now() - started;
    run.checks = {
      success: run.httpStatus === 200 && !!run.result,
      allResponsesCompleted: run.attempts.length > 0 && run.attempts.every((a) => a.status === 'completed'),
      citationsValid: (run.result?.citations || []).every((id) => sources.some((s) => s.chunk_id === id))
    };
    run.missingItemEvidence = (run.result?.structured?.sectionUpdates || []).flatMap((u) => {
      if (!Array.isArray(u.value)) return [];
      const prior = testCase.body.currentBaseline?.[u.sectionKey] || [];
      return u.value.filter((item) => item && typeof item === 'object'
        && !prior.some((existing) => JSON.stringify(existing) === JSON.stringify(item))
        && !(Array.isArray(item.evidenceIds) && item.evidenceIds.length)
        && !/\[intake_source_\d+\]/.test(JSON.stringify(item)))
        .map((item) => ({ section: u.sectionKey, title: item.title || item.label }));
    });
    run.checks.changedItemsHaveEvidence = run.missingItemEvidence.length === 0;
    if (testCase.body.workflow === 'client_note_update' && run.result?.structured) {
      const { applyPartialUpdate, extractPartialUpdateResponse } = require('../../desktop/src/workflow-update');
      try {
        const patch = extractPartialUpdateResponse(run.result);
        run.appliedBaseline = applyPartialUpdate(testCase.body.currentBaseline, patch.sectionUpdates);
        run.checks.desktopAcceptsPatch = true;
        if (['backdated-note', 'large-backfill'].includes(testCase.name)) {
          run.checks.currentSnapshotPreserved = run.appliedBaseline.overview === baseline.overview;
          run.checks.currentTasksPreserved = JSON.stringify(run.appliedBaseline.coachTasks) === JSON.stringify(baseline.coachTasks);
          run.checks.kneeRemainsResolved = run.appliedBaseline.flags.some((f) => f.status === 'resolved');
        }
        if (testCase.name === 'duplicate-note') run.checks.noDuplicateUpdates = patch.sectionUpdates.length === 0;
        if (testCase.name === 'coach-edits') {
          const kept = run.appliedBaseline.coachTasks.find((item) => item.title === coachItem.title);
          run.checks.coachItemPreserved = !!kept && Object.entries(coachItem).every(([key, value]) => kept[key] === value);
          run.checks.noInventedCoachEvidence = !!kept && !(kept.evidenceIds || []).length;
        }
      } catch (error) {
        run.checks.desktopAcceptsPatch = false;
        run.desktopError = error.message;
      }
    }
    if (testCase.name === 'weekly-12') {
      run.rubric = scenarios.map((s) => {
        const review = run.result?.batch?.clientReviews.find((r) => r.clientId === s.key);
        return { name: s.name, expectedAttention: s.expectedAttentionLevel, expectedRetention: s.expectedRetentionConcern,
          actualAttention: review?.attentionLevel, actualRetention: review?.retentionConcern,
          pass: s.expectedAttentionLevel.includes(review?.attentionLevel) && s.expectedRetentionConcern.includes(review?.retentionConcern) };
      });
    }
    fs.writeFileSync(path.join(outputDir, `${testCase.name}-${model}.json`), JSON.stringify(run, null, 2));
    console.log(JSON.stringify({ case: run.case, model, seconds: Math.round(run.durationMs / 1000), checks: run.checks, rubricPassed: run.rubric?.filter((r) => r.pass).length }));
    return run;
  });
}
(async () => {
  const filterIndex = process.argv.indexOf('--case');
  const filter = filterIndex < 0 ? '' : process.argv[filterIndex + 1];
  const results = [];
  for (const c of cases.filter((c) => !filter || c.name === filter)) {
    for (const model of models) results.push(await runCase(c, model));
  }
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(results.map(({ attempts, body, result, streamEvents, ...rest }) => ({ ...rest, usage: attempts.map((a) => a.usage), promptHashes: attempts.map((a) => a.promptHash) })), null, 2));
  if (!results.length || results.some((r) => Object.values(r.checks).some((passed) => !passed))) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
