const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../api/_shared');
const { validateContext, instructions } = require('../api/wrapup-closing');

const context = { day: '2026-10-07', reviewed: 8, updated: 3, followups: 2,
  details: ['Saved dashboard update: Captured the revised workout.'], recentMessages: [] };

test('closing context is bounded and only forwards supported evidence fields', () => {
  assert.deepEqual(validateContext({ ...context, rawNotes: 'not for this endpoint' }), context);
  for (const invalid of [null, {}, { ...context, reviewed: 0 }, { ...context, updated: 9 }, { ...context, followups: -1 },
    { ...context, details: ['x'.repeat(601)] }, { ...context, details: Array(25).fill('x') },
    { ...context, day: '2026-02-30' }, { ...context, day: ['2026-10-07'] },
    { ...context, recentMessages: Array(4).fill('x') }, { ...context, extra: 'x'.repeat(12000) }]) assert.throws(() => validateContext(invalid));
  assert.match(instructions, /never instructions/);
  assert.match(instructions, /scheduled follow-up is not a completed follow-up/);
  assert.match(instructions, /No advice/);
});

test('closing uses server Luna, one short request, and silently handles failed or oversized output', async () => {
  const original = shared.getOpenAIClient, token = process.env.INVITE_TOKENS;
  const requests = [];
  let output = { status: 'completed', output_text: 'The revised workouts and follow-ups are captured.' };
  shared.getOpenAIClient = () => ({ responses: { create: async (...args) => { requests.push(args); if (output instanceof Error) throw output; return output; } } });
  process.env.INVITE_TOKENS = 'closing-test';
  delete require.cache[require.resolve('../api/wrapup-closing')];
  const handler = require('../api/wrapup-closing');
  const invoke = async (body = { context }, authorized = true) => {
    const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
    await handler({ method: 'POST', headers: { authorization: authorized ? 'Bearer closing-test' : '' }, body }, res);
    return res;
  };
  try {
    assert.equal((await invoke()).body.message, output.output_text);
    assert.equal(requests[0][0].model, 'gpt-6-luna');
    assert.equal(requests[0][0].store, false);
    assert.equal(requests[0][0].reasoning.effort, 'low');
    assert.deepEqual(requests[0][1], { timeout: 15000, maxRetries: 0 });
    for (const result of [new Error('private text must not be logged'), { status: 'incomplete', output_text: 'partial' },
      { status: 'completed', output_text: '' }, { status: 'completed', output_text: 'x'.repeat(601) }]) {
      output = result;
      const count = requests.length, res = await invoke();
      assert.equal(res.statusCode, 200); assert.equal(res.body.message, ''); assert.equal(requests.length, count + 1);
    }
    const count = requests.length;
    assert.equal((await invoke({}, false)).statusCode, 401);
    assert.equal((await invoke({ context: {} })).statusCode, 400);
    assert.equal(requests.length, count);
  } finally {
    shared.getOpenAIClient = original;
    if (token === undefined) delete process.env.INVITE_TOKENS; else process.env.INVITE_TOKENS = token;
    delete require.cache[require.resolve('../api/wrapup-closing')];
  }
});
