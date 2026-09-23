const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../api/_shared');

test('LLM routing upgrades existing desktop requests without changing embeddings', () => {
  const saved = process.env.LLM_MODEL_ALLOWLIST;
  try {
    process.env.LLM_MODEL_ALLOWLIST = 'gpt-5.4-mini,gpt-5.6-luna';
    const select = (requested) => shared.allowModel(requested, shared.DEFAULT_LLM_MODEL, 'LLM_MODEL_ALLOWLIST');
    assert.equal(shared.DEFAULT_LLM_MODEL, 'gpt-6-luna');
    assert.equal(select('gpt-5.6-luna'), 'gpt-6-luna');
    assert.equal(select('gpt-6-luna'), 'gpt-6-luna');
    assert.equal(select(), 'gpt-6-luna');
    assert.equal(select('not-allowed'), 'gpt-6-luna');
    assert.equal(select('gpt-5.4-mini'), 'gpt-5.4-mini');
    process.env.LLM_MODEL_ALLOWLIST = 'gpt-5-mini';
    assert.equal(select('gpt-5.6-luna'), 'gpt-6-luna');
    assert.equal(select('gpt-5.4-mini'), 'gpt-6-luna');
    assert.equal(shared.allowModel(undefined, shared.DEFAULT_EMBED_MODEL, 'EMBED_MODEL_ALLOWLIST'), 'text-embedding-3-small');
    assert.equal(shared.allowModel('gpt-5.6-luna', shared.DEFAULT_EMBED_MODEL, 'EMBED_MODEL_ALLOWLIST'), 'text-embedding-3-small');
  } finally {
    if (saved === undefined) delete process.env.LLM_MODEL_ALLOWLIST;
    else process.env.LLM_MODEL_ALLOWLIST = saved;
  }
});

test('all text endpoints use and report the routed model, including Ask streaming', async () => {
  const savedTokens = process.env.INVITE_TOKENS;
  const savedClient = shared.getOpenAIClient;
  process.env.INVITE_TOKENS = 'routing-unit-test';
  const requests = [];
  let output = '';
  shared.getOpenAIClient = () => ({ responses: { create: async (request) => {
    requests.push(request);
    const response = { status: 'completed', output_text: output };
    if (!request.stream) return response;
    return (async function* () {
      yield { type: 'response.output_text.delta', delta: output };
      yield { type: 'response.completed', response };
    })();
  } } });
  const paths = ['workflow', 'answer', 'summarize', 'weekly-review'];
  for (const name of paths) delete require.cache[require.resolve(`../api/${name}`)];
  try {
    const source = { source_id: 's1', chunk_id: 's1', text: 'Demo note.' };
    const review = {
      clientId: 'demo', clientName: 'Demo', attentionLevel: 'routine', retentionConcern: 'low',
      currentFocus: 'Maintain the plan.', weeklyAssessment: 'Steady progress.', suggestedCoachFocus: 'Review progress.', evidence: [], counterevidence: []
    };
    const cases = [
      ['workflow', { workflow: 'client_note_update', sources: [source] }, { schemaVersion: 'client_update_patch.v1', updateSummary: 'No change.', sectionUpdates: [] }],
      ['answer', { question: 'What changed?', sources: [source] }, 'Demo [c:s1].'],
      ['answer', { question: 'What changed?', sources: [source], stream: true }, 'Demo [c:s1].'],
      ['summarize', { sources: [source] }, 'Demo [c:s1].'],
      ['summarize', { sources: [source], stream: true }, 'Demo [c: s1 ].'],
      ['weekly-review', { context: { schemaVersion: 'weekly_review_context.v1', currentDate: '2026-09-23', clients: [{ clientId: 'demo', clientName: 'Demo' }] } }, { schemaVersion: 'weekly_client_review_batch.v1', clientReviews: [review] }]
    ];
    for (const [route, body, content] of cases) {
      output = typeof content === 'string' ? content : JSON.stringify(content);
      let payload;
      const events = [];
      const res = {
        statusCode: 200, setHeader() {}, flushHeaders() {}, end() {},
        status(code) { this.statusCode = code; return this; },
        json(value) { payload = value; }, write(value) { events.push(JSON.parse(value)); }
      };
      await require(`../api/${route}`)({ method: 'POST', headers: { authorization: 'Bearer routing-unit-test' }, body: { ...body, model: 'gpt-5.6-luna' } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(payload));
      assert.equal(requests.at(-1).model, 'gpt-6-luna', route);
      assert.equal(requests.at(-1).reasoning.effort, 'medium', route);
      assert.equal((payload || events.find((event) => event.type === 'done')?.data)?.model, 'gpt-6-luna', route);
    }
  } finally {
    shared.getOpenAIClient = savedClient;
    for (const name of paths) delete require.cache[require.resolve(`../api/${name}`)];
    if (savedTokens === undefined) delete process.env.INVITE_TOKENS;
    else process.env.INVITE_TOKENS = savedTokens;
  }
});
