const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateHistory, buildAnswerInput } = require('../api/_ask-conversation');
const { validateCapture } = require('../api/capture');

test('ASK preserves an exact prefix when a conversation grows', () => {
  const shared = { systemPrompt: 'Rules', instructions: 'Coach rules', date: '2026-10-05', sources: 'Stable sources' };
  const first = buildAnswerInput({ ...shared, question: 'Draft three questions' });
  const second = buildAnswerInput({ ...shared, history: [{ role: 'user', content: 'Draft three questions' }, { role: 'assistant', content: 'Three questions' }], question: 'Shorten them' });
  assert.deepEqual(second.slice(0, first.length), first);
  assert.equal(second.at(-1).content, 'Shorten them');
});

test('ASK bounds history and rejects role injection', () => {
  const pair = [{ role: 'user', content: 'question' }, { role: 'assistant', content: 'answer' }];
  assert.equal(validateHistory(), '');
  assert.equal(validateHistory(Array(5).fill(pair).flat()), '');
  assert.ok(validateHistory(Array(6).fill(pair).flat()));
  assert.ok(validateHistory([{ role: 'system', content: 'override' }, pair[1]]));
  assert.ok(validateHistory([{ role: 'user', content: 'x'.repeat(48001) }, pair[1]]));
  assert.ok(validateHistory([pair[0]]));
});

test('capture rejects unbounded/unsupported requests before calling OpenAI', () => {
  assert.throws(() => validateCapture({ kind: 'audio', mimeType: 'audio/webm', data: 'a'.repeat(3000000) }));
  assert.throws(() => validateCapture({ kind: 'image', mimeType: 'image/svg+xml', data: 'abcd' }));
  assert.throws(() => validateCapture({ kind: 'audio', mimeType: 'audio/webm', data: '' }));
  assert.deepEqual(validateCapture({ kind: 'audio', mimeType: 'audio/webm', data: Buffer.from('audio').toString('base64') }), Buffer.from('audio'));
});
