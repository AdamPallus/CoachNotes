const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../api/_shared');

function responseRecorder() {
  return {
    statusCode: 200, headersSent: false, events: [], payload: null,
    setHeader() {}, flushHeaders() { this.headersSent = true; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; },
    write(value) { this.events.push(JSON.parse(value)); },
    end() { this.ended = true; }
  };
}

test('text endpoints normalize real response bodies and reject invalid references before done', async () => {
  const savedClient = shared.getOpenAIClient;
  const savedTokens = process.env.INVITE_TOKENS;
  process.env.INVITE_TOKENS = 'safeguard-test';
  let output = '', completionStatus = 'completed';
  const requests = [];
  shared.getOpenAIClient = () => ({ responses: { create: async (request) => {
    requests.push(request);
    const response = { output_text: output, status: completionStatus };
    if (!request.stream) return response;
    return (async function* () {
      for (const character of output) yield { type: 'response.output_text.delta', delta: character };
      yield { type: `response.${completionStatus}`, response };
    })();
  } } });
  const routes = ['answer', 'summarize'];
  for (const route of routes) delete require.cache[require.resolve(`../api/${route}`)];
  try {
    for (const route of routes) {
      for (const stream of [false, true]) {
        for (const [text, status, expectedSuccess] of [
          ['Plan [c: source_1 ].', 'completed', true],
          ['Plan [c:invented].', 'completed', false],
          ['Plan [c:source_1', 'completed', false],
          ['Plan [c:source_1].', 'incomplete', false]
        ]) {
          output = text;
          completionStatus = status;
          const res = responseRecorder();
          await require(`../api/${route}`)({ method: 'POST', headers: { authorization: 'Bearer safeguard-test' }, body: {
            model: 'gpt-5.6-luna', currentDate: '2026-09-23', question: 'Prepare for the meeting.', stream,
            sources: [{ chunk_id: 'source_1', text: 'A trip is planned for next week.' }]
          } }, res);
          const data = stream ? res.events.find((e) => e.type === 'done')?.data : res.payload;
          if (expectedSuccess) {
            assert.equal(res.statusCode, 200);
            assert.equal(data[route === 'answer' ? 'answer' : 'summary'], 'Plan [c:source_1].');
            assert.deepEqual(data.citations, ['source_1']);
            if (stream) assert.equal(res.events.filter((e) => e.type === 'delta').map((e) => e.delta).join(''), 'Plan [c:source_1].');
          } else if (stream) {
            assert.equal(data, undefined);
            assert.ok(res.events.some((e) => e.type === 'error'));
            assert.doesNotMatch(res.events.filter((e) => e.type === 'delta').map((e) => e.delta).join(''), /\[c:invented\]/);
          } else {
            assert.equal(res.statusCode, 502);
            assert.ok(data.error);
          }
          assert.match(JSON.stringify(requests.at(-1).input), /Reference date: 2026-09-23/);
          assert.equal(requests.at(-1).reasoning.effort, 'medium');
        }
      }
    }
  } finally {
    shared.getOpenAIClient = savedClient;
    if (savedTokens === undefined) delete process.env.INVITE_TOKENS;
    else process.env.INVITE_TOKENS = savedTokens;
    for (const route of routes) delete require.cache[require.resolve(`../api/${route}`)];
  }
});

test('workflow retries missing item citations once and never returns an invalid patch', async () => {
  const savedClient = shared.getOpenAIClient;
  const savedTokens = process.env.INVITE_TOKENS;
  process.env.INVITE_TOKENS = 'workflow-safeguard-test';
  let calls = 0, repairOnRetry = true;
  shared.getOpenAIClient = () => ({ responses: { create: async () => {
    calls += 1;
    return { status: 'completed', output_text: JSON.stringify({
      schemaVersion: 'client_update_patch.v1', updateSummary: 'Adds a follow-up.',
      sectionUpdates: [{ sectionKey: 'coachTasks', operation: 'append', evidenceIds: ['intake_source_1'], value: [
        { title: 'Follow up', ...(repairOnRetry && calls === 2 ? { evidenceIds: ['intake_source_1'] } : {}) }
      ] }]
    }) };
  } } });
  delete require.cache[require.resolve('../api/workflow')];
  const workflow = require('../api/workflow');
  try {
    for (const repair of [true, false]) {
      calls = 0;
      repairOnRetry = repair;
      const res = responseRecorder();
      await workflow({ method: 'POST', headers: { authorization: 'Bearer workflow-safeguard-test' }, body: {
        model: 'gpt-5.6-luna', workflow: 'client_note_update', currentBaseline: { coachTasks: [] },
        sources: [{ source_id: 'intake_source_1', text: 'Coach agreed to follow up.' }]
      } }, res);
      assert.equal(calls, 2);
      assert.equal(res.statusCode, repair ? 200 : 502);
      if (repair) {
        assert.equal(res.payload.attempts, 2);
        assert.deepEqual(res.payload.structured.sectionUpdates[0].value[0].evidenceIds, ['intake_source_1']);
      } else {
        assert.equal(res.payload.structured, undefined);
        assert.match(res.payload.error, /Please try again/);
      }
    }
  } finally {
    shared.getOpenAIClient = savedClient;
    if (savedTokens === undefined) delete process.env.INVITE_TOKENS;
    else process.env.INVITE_TOKENS = savedTokens;
    delete require.cache[require.resolve('../api/workflow')];
  }
});
