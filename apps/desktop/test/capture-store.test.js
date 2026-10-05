const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createCaptureStore, RECORDING_LIMIT_MS, MAX_BYTES } = require('../src/capture-store');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-store-test-'));
  const handlers = new Map();
  const notifications = [];
  const app = new EventEmitter(); app.getPath = () => root;
  const powerMonitor = new EventEmitter();
  let reloads = 0; let calls = 0;
  const window = { isDestroyed: () => false, webContents: { send: (...args) => notifications.push(args), reload: () => reloads++ } };
  const store = createCaptureStore({ app, powerMonitor, nativeImage: {}, dialog: {}, getWindow: () => window,
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    callProxy: async () => { calls++; return { text: 'Recorded note.' }; } });
  const invoke = (name, value) => handlers.get(`app:${name}`)({}, value);
  t.after(() => { app.emit('before-quit'); fs.rmSync(root, { recursive: true, force: true }); });
  return { invoke, store, notifications, powerMonitor, reloads: () => reloads, calls: () => calls };
}

test('recording has a five-minute main-process deadline and a final-chunk grace period', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(t);
  const recording = f.invoke('begin-recording', { mimeType: 'audio/webm' });
  f.invoke('append-recording', { id: recording.id, bytes: [1, 2, 3] });
  await assert.rejects(f.store.processCapture(recording.id), /Stop recording/);
  t.mock.timers.tick(RECORDING_LIMIT_MS);
  assert.equal(f.notifications[0][0], 'app:recording-stop');
  f.invoke('append-recording', { id: recording.id, bytes: [4] });
  f.invoke('end-recording', { id: recording.id });
  t.mock.timers.tick(11000);
  assert.equal(f.reloads(), 0);
  assert.throws(() => f.invoke('append-recording', { id: recording.id, bytes: [5] }), /closed/);
  assert.equal((await f.store.processCapture(recording.id)).text, 'Recorded note.');
  await f.store.processCapture(recording.id);
  assert.equal(f.calls(), 1, 'Cached extraction must not incur another API call');
});

test('an unresponsive recorder is forcibly reloaded after the deadline', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(t);
  f.invoke('begin-recording', { mimeType: 'audio/webm' });
  t.mock.timers.tick(RECORDING_LIMIT_MS); t.mock.timers.tick(10000);
  assert.equal(f.reloads(), 1);
});

test('audio limits and identifiers are enforced before processing', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(t);
  assert.equal(RECORDING_LIMIT_MS, 300000);
  const recording = f.invoke('begin-recording', { mimeType: 'audio/webm' });
  assert.throws(() => f.invoke('begin-recording', { mimeType: 'audio/webm' }), /already/);
  assert.throws(() => f.invoke('get-capture', { id: '../anything' }), /Invalid/);
  assert.throws(() => f.invoke('append-recording', { id: recording.id, bytes: Buffer.alloc(MAX_BYTES + 1) }), /limit/);
  f.invoke('end-recording', { id: recording.id });
});
