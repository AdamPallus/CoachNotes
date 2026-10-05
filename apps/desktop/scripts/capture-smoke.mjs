import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { CdpClient, waitForTarget } from './visual-regression.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'coachnotes-capture-test-'));
const artifacts = path.resolve(root, '../../output/playwright/capture');
await fs.mkdir(artifacts, { recursive: true });
const calls = [];
let failUpdate = true;
let failAudio = true;
let failAsk = true;
const server = http.createServer(async (req, res) => {
  let text = ''; for await (const chunk of req) text += chunk;
  const body = JSON.parse(text); calls.push({ endpoint: req.url, body });
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/answer' && failAsk) {
    failAsk = false; res.statusCode = 502;
    res.end(JSON.stringify({ error: 'The AI returned a source reference that could not be verified. Please try again.' })); return;
  }
  if ((req.url === '/workflow' && failUpdate) || (req.url === '/capture' && body.kind === 'audio' && failAudio)) {
    failUpdate = false; failAudio = false; res.statusCode = 502; res.end(JSON.stringify({ error: 'Simulated failure' })); return;
  }
  const result = req.url === '/workflow'
    ? { model: 'test', structured: { schemaVersion: 'client_update_patch.v1', sectionUpdates: [{ sectionKey: 'overview', operation: 'replace', value: 'Updated with the new coach note.' }], changes: [], updateSummary: 'New context captured.' } }
    : req.url === '/capture' ? { text: body.kind === 'audio' ? 'A dictated coaching note.' : 'Workout: Goblet squat, 3 sets of 8 repetitions, 12 kg.' }
    : { model: 'test', answer: `Try asking about the recent workout. [c:${body.sources[0].chunk_id}]`, citations: [body.sources[0].chunk_id] };
  res.end(JSON.stringify(result));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const electron = spawn(require('electron'), ['--remote-debugging-port=9324', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', root], {
  cwd: root, env: { ...process.env, COACHNOTES_VISUAL_USER_DATA: userData, COACHNOTES_VISUAL_FIXTURE: '1', COACHNOTES_VISUAL_DATE: '2026-07-30' }, stdio: ['ignore', 'pipe', 'pipe']
});
let stderr = ''; electron.stderr.on('data', chunk => { stderr += chunk; });
let client;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function screenshot(name) {
  const result = await client.call('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(artifacts, `${name}.png`), Buffer.from(result.data, 'base64'));
}
try {
  client = new CdpClient((await waitForTarget()).webSocketDebuggerUrl); await client.connect();
  await client.evaluate(`(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    window.check = (condition, message) => { if (!condition) throw new Error(message); };
    await window.coachNotes.saveSettings({ proxyBaseUrl: 'http://127.0.0.1:${server.address().port}' });
    await selectClient(state.clients[0].id);
    await openAddNoteDialog();
    els.noteTitleInput.value = 'Workout adjustment'; els.noteAnnotationInput.value = 'Keep the plan practical.';
    els.noteDateInput.value = '2026-06-01'; els.noteTextInput.value = 'I adjusted the workout today.';
    await noteCapture.save(); els.addNoteDialog.close();
    await openAddNoteDialog();
    check(els.noteTitleInput.value === 'Workout adjustment' && els.noteDateInput.value === '2026-06-01', 'Metadata draft restore');
    check(els.noteTextInput.value === 'I adjusted the workout today.', 'Text draft restore');
    const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 150;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0,0,500,150); ctx.fillStyle = 'black'; ctx.font = '24px sans-serif'; ctx.fillText('Goblet squat: 3 x 8, 12 kg',20,70);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const data = new DataTransfer(); data.items.add(new File([blob], 'workout.png', { type: 'image/png' }));
    els.noteTextInput.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);
  await pause(600);
  await client.evaluate(`check(document.querySelector('#noteCaptureList img'), 'Pasted image preview'); els.addNoteForm.scrollTop = els.addNoteForm.scrollHeight;`);
  await screenshot('note-image');
  await client.evaluate(`(async () => {
    await submitAddedNote({ preventDefault() {} });
    check(els.addNoteDialog.open && !els.noteErrorPanel.hidden, 'Failure must reopen preserved note');
    check(state.noteSources[0].attachmentIds.length === 1, 'Image remains attached after failure');
    check(await window.coachNotes.getNoteDraft({ clientId: state.selectedClientId }), 'Failure keeps durable draft');
    window.retrySubmission = { ...(await noteCapture.prepare()), sources: structuredClone(state.noteSources) };
    await submitAddedNote({ preventDefault() {} });
    check(state.selectedClientDetail.baseline.structured.overview === 'Updated with the new coach note.', 'Dashboard is updated');
    check(state.selectedClientDetail.sources.some(s => s.attachments.length === 1), 'Saved source retains image');
    check(!(await window.coachNotes.getNoteDraft({ clientId: state.selectedClientId })), 'Successful note clears draft');
    const count = state.selectedClientDetail.sources.length;
    const duplicate = await window.coachNotes.updateClientFromNote(window.retrySubmission);
    check(duplicate.detail.sources.length === count, 'Retry receipt prevents duplicate source');
    openAskDialog(); els.askPromptInput.value = 'Give me three questions';
    await submitAsk({ preventDefault() {} });
    const errorPanel = document.getElementById('askError');
    check(!errorPanel.hidden && errorPanel.textContent.includes('source reference'), 'Readable citation error');
    check(!errorPanel.textContent.includes('Error invoking remote method'), 'No raw IPC error');
    check(els.askPromptInput.value === 'Give me three questions' && state.askTurns.length === 0, 'Failed ASK preserves question and history');
  })()`);
  for (const theme of ['dark', 'light']) {
    await client.evaluate(`applyTheme('${theme}', false); document.getElementById('askError').scrollIntoView({ block: 'nearest' });`);
    await pause(350);
    await screenshot(`ask-error-${theme}`);
  }
  await client.evaluate(`(async () => {
    await submitAsk({ preventDefault() {} });
    check(state.askResult.followUpsRemaining === 5, 'Five followups available');
    document.getElementById('askFollowupInput').value = 'Make them shorter';
    await submitAsk({ preventDefault() {} }, true);
    check(state.askTurns.length === 2 && document.querySelectorAll('.ask-turn').length === 2, 'Followup history displayed');
    check(document.querySelector('.ask-citation'), 'Citations remain interactive');
    els.askForm.scrollTop = els.askForm.scrollHeight;
  })()`);
  await screenshot('ask-followup');
  await client.evaluate(`(async () => {
    for (let i=0;i<4;i++) { document.getElementById('askFollowupInput').value='Refine wording'; await submitAsk({ preventDefault() {} }, true); }
    check(state.askResult.followUpsRemaining === 0 && document.getElementById('askFollowupBtn').disabled, 'Followup limit UI');
    let rejected=false; try { await window.coachNotes.askClient({ clientId: state.selectedClientId, sessionId: state.askResult.sessionId, prompt:'one too many' }); } catch { rejected=true; }
    check(rejected, 'Followup limit enforced by main');
    els.askDialog.close(); state.detailPage='weekly'; renderClientDetail(state.selectedClientDetail);
    check(els.detailContent.textContent.includes('Clarify what support'), 'Client weekly review content');
    check(els.detailContent.textContent.includes('changed since'), 'Stale review indication');
  })()`);
  await screenshot('client-weekly');
  await client.evaluate(`(async () => {
    document.getElementById('openWrapupBtn').click(); await new Promise(resolve => setTimeout(resolve, 250));
    const first = document.querySelector('[data-wrapup-client]'); if (!first.checked) first.click(); document.querySelector('[data-wrapup-start]').click();
    await new Promise(resolve => setTimeout(resolve, 250));
    check(document.querySelector('[data-wrapup-add]'), 'Wrapup step');
  })()`);
  await screenshot('wrapup-step');
  await client.evaluate(`(async () => {
    document.querySelector('[data-wrapup-later]').click();
    check(!document.querySelector('.wrapup-complete'), 'Deferred clients are not completed');
    document.querySelector('[data-wrapup-resume]').click();
    document.querySelector('[data-wrapup-add]').click(); await new Promise(resolve => setTimeout(resolve, 300));
    els.noteTextInput.value='Follow-up after reviewing the day.';
    await submitAddedNote({ preventDefault() {} });
    check(document.querySelector('.wrapup-complete'), 'AI update completes wrapup client');
    check((await window.coachNotes.getWrapup({day:todayLocalDate()})).progress.done[state.selectedClientId]==='updated', 'Wrapup completion persisted');
  })()`);
  await screenshot('wrapup-complete');
  await client.evaluate(`(async () => {
    document.getElementById('wrapupDialog').close(); await openAddNoteDialog();
    document.getElementById('dictateNoteBtn').click();
  })()`);
  await pause(2200);
  await client.evaluate(`check(document.getElementById('dictateNoteBtn').getAttribute('aria-pressed') === 'true', 'Recording started'); check(els.updateNoteSubmitBtn.disabled, 'Cannot submit during recording');`);
  await screenshot('recording');
  // Simulate a failed transcription independently of the earlier workflow failure.
  failAudio = true;
  await client.evaluate(`(async () => { await noteCapture.stop(true); check(document.querySelector('[data-transcribe]'), 'Audio preserved after transcription failure'); check(!document.getElementById('recordingStatus').hidden === false, 'Recording stopped'); })()`);
  await client.evaluate(`document.querySelector('[data-transcribe]').click();`);
  await pause(600);
  await client.evaluate(`(async () => {
    check(els.noteTextInput.value.includes('A dictated coaching note.'), 'Retry appends transcript');
    check(!document.querySelector('[data-transcribe]'), 'No duplicate pending recording after success');
    await noteCapture.save();
  })()`);
  await client.call('Page.reload'); await pause(800);
  await client.evaluate(`(async () => { await selectClient(state.clients[0].id); await openAddNoteDialog(); if (!els.noteTextInput.value.includes('A dictated coaching note.')) throw new Error('Draft survives renderer restart'); })()`);
  const asks = calls.filter(c => c.endpoint === '/answer');
  assert.equal(asks.length, 7);
  assert.deepEqual(asks[1].body.sources, asks[6].body.sources);
  assert.equal(asks[6].body.history.length, 10);
  assert.equal(calls.filter(c => c.endpoint === '/workflow').length, 3);
  const imageRequest = calls.find(c => c.endpoint === '/capture' && c.body.kind === 'image');
  await fs.writeFile(path.join(artifacts, 'workout.jpg'), Buffer.from(imageRequest.body.data, 'base64'));
  console.log('Capture, durable drafts, retry receipts, ASK followups, weekly tab, and wrapup integration checks passed.');
} catch (error) {
  if (client) await screenshot('failure').catch(() => {});
  console.error(stderr.slice(-3000)); throw error;
} finally {
  client?.close(); electron.kill('SIGTERM');
  await Promise.race([new Promise(resolve => electron.once('exit', resolve)), pause(2000)]);
  if (electron.exitCode === null) electron.kill('SIGKILL');
  await new Promise(resolve => server.close(resolve));
  await fs.rm(userData, { recursive: true, force: true });
}
