// Explicit opt-in only: this makes two paid API requests using synthetic fixtures.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const capture = require('../api/capture');

async function main() {
  if (!process.argv.includes('--live')) throw new Error('Pass --live, an image path, and an audio path to run the paid smoke test.');
  const [imagePath, audioPath] = process.argv.slice(3);
  if (!imagePath || !audioPath) throw new Error('Both synthetic fixture paths are required.');
  process.env.INVITE_TOKENS = 'capture-smoke-local';
  for (const [kind, mimeType, file, expected] of [
    ['image', 'image/jpeg', imagePath, /goblet|squat/i],
    ['audio', 'audio/wav', audioPath, /goblet|squat|Friday/i]
  ]) {
    let status; let payload;
    const res = { setHeader() {}, status(code) { status = code; return this; }, json(value) { payload = value; } };
    const started = Date.now();
    await capture({ method: 'POST', headers: { authorization: 'Bearer capture-smoke-local' }, body: { kind, mimeType, data: fs.readFileSync(file).toString('base64') } }, res);
    assert.equal(status, 200, payload?.error);
    assert.match(payload.text, expected);
    console.log(JSON.stringify({ kind, passed: true, responseChars: payload.text.length, durationMs: Date.now() - started }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
