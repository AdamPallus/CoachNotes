// Optional paid smoke test: synthetic evidence only; run with a local API env file.
const assert = require('node:assert/strict');
const handler = require('../api/wrapup-closing');
process.env.INVITE_TOKENS = 'local-closing-smoke';
const recentMessages = [];
const cases = [
  { day: '2026-10-07', reviewed: 9, updated: 4, followups: 2, details: [
    'Saved dashboard update: Captured a shorter workout plan agreed during a client conversation.',
    'Saved dashboard update: Recorded upcoming travel and the agreed temporary training schedule.',
    'Scheduled follow-up: Send revised workout (due 2026-10-08)',
    'Scheduled follow-up: Ask how the shorter session went (due 2026-10-12)'
  ] },
  { day: '2026-10-08', reviewed: 3, updated: 0, followups: 0, details: [] },
  { day: '2026-10-09', reviewed: 6, updated: 2, followups: 1, details: [
    'Saved dashboard update: Preserved historical goals from a backdated note; left current plan unchanged.',
    'Scheduled follow-up: Ask about equipment availability (due 2026-10-12)'
  ] }
];
(async () => {
  for (const context of cases) {
    const start = Date.now();
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer local-closing-smoke' }, body: { context: { ...context, recentMessages: [...recentMessages] } } }, res);
    assert.equal(res.code, 200); assert.ok(res.body.message, 'Real model returned a nonempty bounded closing');
    console.log(JSON.stringify({ day: context.day, durationMs: Date.now() - start, message: res.body.message }));
    recentMessages.unshift(res.body.message);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
