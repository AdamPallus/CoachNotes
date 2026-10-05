const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const MAX_BYTES = 2 * 1024 * 1024;
const RECORDING_LIMIT_MS = 5 * 60 * 1000;

function createCaptureStore({ app, nativeImage, dialog, getWindow, callProxy, ipcMain, powerMonitor }) {
  const root = path.join(app.getPath('userData'), 'capture-drafts');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const active = new Map();
  const watchdogs = new Map();
  const file = (id, ext) => {
    if (!/^[a-f0-9-]{36}$/.test(String(id))) throw new Error('Invalid attachment.');
    return path.join(root, `${id}.${ext}`);
  };
  const read = (id) => JSON.parse(fs.readFileSync(file(id, 'json'), 'utf8'));
  const write = (record) => {
    const destination = file(record.id, 'json');
    fs.writeFileSync(`${destination}.tmp`, JSON.stringify(record), { mode: 0o600 });
    fs.renameSync(`${destination}.tmp`, destination);
  };
  const describe = (record) => ({ id: record.id, kind: record.kind, name: record.name,
    targetKey: record.targetKey || '', targetField: record.targetField || '',
    text: record.text || '', mimeType: record.mimeType,
    preview: record.kind === 'image' ? nativeImage.createFromPath(file(record.id, 'bin')).resize({ width: 260 }).toDataURL() : '' });
  function imageFromBuffer(bytes, name) {
    if (bytes.length > 20 * 1024 * 1024) throw new Error('Image is too large.');
    let image = nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) throw new Error('This image could not be opened.');
    const size = image.getSize();
    if (Math.max(size.width, size.height) > 2400) {
      image = image.resize(size.width >= size.height ? { width: 2400 } : { height: 2400 });
    }
    const data = image.toJPEG(88);
    if (data.length > MAX_BYTES) throw new Error('Please select a smaller image region.');
    const record = { id: crypto.randomUUID(), name: String(name || 'Screenshot').slice(0, 120), kind: 'image', mimeType: 'image/jpeg' };
    fs.writeFileSync(file(record.id, 'bin'), data, { mode: 0o600 });
    write(record);
    return describe(record);
  }
  async function processCapture(id) {
    const record = read(id);
    if (active.has(id)) throw new Error('Stop recording first.');
    if (!record.text) {
      const bytes = fs.readFileSync(file(id, 'bin'));
      if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Recording is empty or too large.');
      const result = await callProxy('/capture', { kind: record.kind, mimeType: record.mimeType, data: bytes.toString('base64') });
      record.text = result.text;
      write(record);
    }
    return describe(record);
  }
  function stopRecording(id, notify = false) {
    const recording = active.get(id);
    if (!recording) return;
    clearTimeout(recording.timer);
    active.delete(id);
    const record = read(id);
    record.closedAt = Date.now();
    write(record);
    if (notify) {
      const window = getWindow();
      if (!window || window.isDestroyed()) return;
      window.webContents.send('app:recording-stop', { id });
      // If the renderer is unresponsive, reload it to release the microphone.
      watchdogs.set(id, setTimeout(() => {
        watchdogs.delete(id);
        if (window && !window.isDestroyed()) window.webContents.reload();
      }, 10000));
    }
  }
  ipcMain.handle('app:select-note-images', async () => {
    const result = await dialog.showOpenDialog(getWindow(), { properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (result.canceled) return [];
    if (result.filePaths.length > 6) throw new Error('Attach up to six images at a time.');
    return result.filePaths.map((p) => imageFromBuffer(fs.readFileSync(p), path.basename(p)));
  });
  ipcMain.handle('app:paste-note-image', (_event, payload) => imageFromBuffer(Buffer.from(payload.bytes), payload.name));
  ipcMain.handle('app:capture-note-image', async () => {
    if (process.platform !== 'darwin') throw new Error('Screen capture is currently available on macOS. Paste or upload an image instead.');
    const capturePath = path.join(root, `${crypto.randomUUID()}.png`);
    const window = getWindow();
    window.hide();
    try {
      await run('/usr/sbin/screencapture', ['-i', '-s', '-x', capturePath], { timeout: 120000 });
      if (!fs.existsSync(capturePath)) return null;
      return imageFromBuffer(fs.readFileSync(capturePath), 'Screenshot');
    } catch (error) {
      if (!fs.existsSync(capturePath) && error.code === 1) return null;
      throw new Error('Could not capture the screen. Check macOS Screen Recording permission or paste a screenshot.');
    } finally {
      fs.rmSync(capturePath, { force: true });
      if (!window.isDestroyed()) { window.show(); window.focus(); }
    }
  });
  ipcMain.handle('app:begin-recording', (_event, { mimeType, targetKey = '', targetField = '' }) => {
    if (active.size) throw new Error('A recording is already running.');
    if (!['audio/webm', 'audio/mp4'].includes(mimeType)) throw new Error('Unsupported audio format.');
    if (typeof targetKey !== 'string' || targetKey.length > 300 || !['', 'noteTextInput', 'noteAnnotationInput'].includes(targetField)) throw new Error('Invalid dictation target.');
    const record = { id: crypto.randomUUID(), kind: 'audio', name: targetField === 'noteAnnotationInput' ? 'Dictated annotation' : 'Dictation', mimeType, targetKey, targetField };
    fs.writeFileSync(file(record.id, 'bin'), Buffer.alloc(0), { mode: 0o600 });
    write(record);
    active.set(record.id, { bytes: 0, timer: setTimeout(() => stopRecording(record.id, true), RECORDING_LIMIT_MS) });
    return describe(record);
  });
  ipcMain.handle('app:append-recording', (_event, { id, bytes }) => {
    const record = read(id);
    if (record.kind !== 'audio' || record.text) throw new Error('Recording is closed.');
    if (!active.has(id) && (!record.closedAt || Date.now() - record.closedAt > 10000)) throw new Error('Recording is closed.');
    const chunk = Buffer.from(bytes);
    // Permit the final MediaRecorder chunk after the independent timeout fired.
    if (chunk.length > 256000 || fs.statSync(file(id, 'bin')).size + chunk.length > MAX_BYTES) {
      stopRecording(id, true);
      throw new Error('Recording limit reached. The recorded audio is preserved.');
    }
    fs.appendFileSync(file(id, 'bin'), chunk);
  });
  ipcMain.handle('app:end-recording', (_event, { id }) => {
    clearTimeout(watchdogs.get(id)); watchdogs.delete(id); stopRecording(id);
  });
  ipcMain.handle('app:process-capture', (_event, { id }) => processCapture(id));
  ipcMain.handle('app:get-capture', (_event, { id }) => describe(read(id)));
  ipcMain.handle('app:list-dictations', (_event, { targetKey }) => {
    if (typeof targetKey !== 'string' || !targetKey || targetKey.length > 300) throw new Error('Invalid dictation target.');
    return fs.readdirSync(root).filter((name) => /^[a-f0-9-]{36}\.json$/.test(name)).flatMap((name) => {
      try { const record = read(name.slice(0, -5)); return record.kind === 'audio' && record.targetKey === targetKey ? [describe(record)] : []; }
      catch { return []; }
    });
  });
  function discard(ids) {
    for (const id of ids || []) {
      if (active.has(id)) throw new Error('Stop recording first.');
      fs.rmSync(file(id, 'bin'), { force: true });
      fs.rmSync(file(id, 'json'), { force: true });
    }
  }
  ipcMain.handle('app:discard-captures', (_event, { ids }) => discard(ids));
  powerMonitor.on('suspend', () => { for (const id of active.keys()) stopRecording(id, true); });
  app.on('before-quit', () => { for (const id of active.keys()) stopRecording(id, true); });
  return {
    processCapture,
    discard,
    async persist(ids, directory) {
      const attachments = [];
      for (const id of ids || []) {
        const record = read(id);
        if (record.kind !== 'image') continue;
        const target = path.join(directory, `${id}.jpg`);
        fs.copyFileSync(file(id, 'bin'), target);
        attachments.push({ name: record.name, path: target });
      }
      return attachments;
    }
  };
}

module.exports = { createCaptureStore, RECORDING_LIMIT_MS, MAX_BYTES };
