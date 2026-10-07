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
let audioDelay = 0;
const server = http.createServer(async (req, res) => {
  let text = ''; for await (const chunk of req) text += chunk;
  const body = JSON.parse(text); calls.push({ endpoint: req.url, body });
  if (req.url === '/capture' && body.kind === 'audio' && audioDelay) await new Promise(resolve => setTimeout(resolve, audioDelay));
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
    : req.url === '/wrapup-closing' ? { message: 'You captured the workout changes and scheduled a follow-up for tomorrow.' }
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
async function screenshotDictation(name, fieldId) {
  for (const theme of ['light', 'dark']) {
    await client.call('Emulation.setDeviceMetricsOverride', { width: 1040, height: 700, deviceScaleFactor: 1, mobile: false });
    await client.evaluate(`applyTheme('${theme}', false); document.getElementById('${fieldId}').closest('.dictation-field').scrollIntoView({block:'center'});`);
    await pause(180);
    const clip = await client.evaluate(`(() => {
      const field = document.getElementById('${fieldId}');
      const shell = field.closest('.dictation-field');
      const frame = shell.getBoundingClientRect();
      const footer = shell.querySelector('.dictation-feedback').getBoundingClientRect();
      check(footer.top >= field.getBoundingClientRect().bottom - 1, 'Dictation controls do not cover editable text');
      check(footer.bottom <= frame.bottom && footer.left >= frame.left && footer.right <= frame.right, 'Dictation controls stay inside the input frame');
      check(frame.left >= 0 && frame.right <= innerWidth && frame.top >= 0 && frame.bottom <= innerHeight, 'Input frame fits the small window');
      return {x:frame.x,y:frame.y,width:frame.width,height:frame.height,scale:1};
    })()`);
    const result = await client.call('Page.captureScreenshot', { format: 'png', clip });
    await fs.writeFile(path.join(artifacts, `${name}-${theme}.png`), Buffer.from(result.data, 'base64'));
  }
  await client.call('Emulation.clearDeviceMetricsOverride');
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
    document.getElementById('askFollowupInput').value = 'Please refine.';
    fieldDictation.refresh();
    await new Promise(resolve => setTimeout(resolve, 150));
    document.querySelector('[data-dictation-for="askFollowupInput"]').click();
  })()`);
  await pause(1500);
  await client.evaluate(`(async () => {
    await dictationRecorder.stop(true);
    check(document.getElementById('askFollowupInput').value.includes('A dictated coaching note.'), 'Follow-up dictation fills the right field');
    check(els.askPromptInput.value === 'Give me three questions', 'Follow-up dictation leaves original question unchanged');
    check(state.askTurns.length === 1, 'Dictation does not submit a follow-up');
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
    const choices = [...document.querySelectorAll('[data-wrapup-client]')];
    for (const [i, choice] of choices.entries()) if (choice.checked !== (i < 2)) choice.click();
    document.querySelector('[data-wrapup-start]').click();
    await new Promise(resolve => setTimeout(resolve, 250));
    check(document.querySelector('[data-wrapup-add]'), 'Wrapup step');
  })()`);
  await screenshot('wrapup-step');
  await client.call('Emulation.setDeviceMetricsOverride', { width: 1040, height: 700, deviceScaleFactor: 1, mobile: false });
  await client.evaluate(`(() => {
    const activity = document.querySelector('.wrapup-activity'); window.originalActivity = activity.innerHTML;
    activity.innerHTML += '<p>Long client history and follow-up context.</p>'.repeat(40);
    const footer = document.querySelector('.wrapup-footer').getBoundingClientRect();
    const scroll = document.getElementById('wrapupContent');
    check(footer.bottom <= innerHeight && footer.top >= scroll.getBoundingClientRect().bottom, 'Navigation stays visible below long activity at minimum window size');
    check(scroll.scrollHeight > scroll.clientHeight, 'Long activity scrolls independently');
  })()`);
  await screenshot('wrapup-long-activity');
  await client.evaluate(`document.querySelector('.wrapup-activity').innerHTML = window.originalActivity;`);
  await client.call('Emulation.clearDeviceMetricsOverride');
  await client.evaluate(`(async () => {
    check(document.getElementById('wrapupTaskDate').value === '2026-07-31', 'Follow-up defaults to tomorrow');
    document.getElementById('wrapupTaskTitle').value='Send revised workout';
    document.getElementById('wrapupTaskTitle').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 200));
  })()`);
  await client.call('Page.reload'); await pause(800);
  await client.evaluate(`(async () => {
    window.check = (condition, message) => { if (!condition) throw new Error(message); };
    await dailyWrapup.open();
    check(document.getElementById('wrapupTaskTitle').value === 'Send revised workout', 'Follow-up draft survives renderer restart');
    document.querySelector('[data-wrapup-next]').click(); await new Promise(resolve => setTimeout(resolve, 150));
    check(!document.getElementById('wrapupError').hidden, 'Cannot skip an unsubmitted follow-up');
    const clientId = Number(document.querySelector('[data-wrapup-task]').dataset.wrapupTask);
    window.taskRetry = { ...(await window.coachNotes.getWrapup({ day: todayLocalDate() })).progress.followupDrafts[clientId], clientId, day: todayLocalDate() };
    let rejected = false;
    try { await window.coachNotes.addWrapupTask({ ...window.taskRetry, dueDate: '2026-02-30' }); } catch { rejected = true; }
    check(rejected, 'Invalid follow-up date rejected without saving');
    await window.coachNotes.setClientArchived({ clientId, archived: true });
    document.querySelector('[data-wrapup-task]').requestSubmit(); await new Promise(resolve => setTimeout(resolve, 200));
    check(document.getElementById('wrapupTaskTitle').value === 'Send revised workout' && !document.getElementById('wrapupError').hidden, 'Failed task save preserves editable draft');
    await window.coachNotes.setClientArchived({ clientId, archived: false });
    const latest = await window.coachNotes.getClientDetail({ clientId });
    await window.coachNotes.updateClientSection({ clientId, sectionKey: 'coachTasks', value: [...latest.baseline.structured.coachTasks, { title: 'Existing task retained', planningStatus: 'active' }] });
    document.querySelector('[data-wrapup-task]').requestSubmit();
    await new Promise(resolve => setTimeout(resolve, 300));
    check(document.querySelector('.wrapup-task-status').textContent.includes('Added: Send revised workout'), 'Follow-up saved confirmation');
    await window.coachNotes.addWrapupTask(window.taskRetry);
    const detail = await window.coachNotes.getClientDetail({ clientId });
    const tasks = detail.baseline.structured.coachTasks.filter(t => t.title === 'Send revised workout');
    check(tasks.length === 1 && tasks[0].dueDate === '2026-07-31', 'Follow-up retry is idempotent and date preserved');
    check(detail.baseline.structured.coachTasks.some(t => t.title === 'Existing task retained'), 'Append uses the latest dashboard without dropping other tasks');
    check((await window.coachNotes.getCoachHome()).attention.dueThisWeekTasks.some(t => t.title === 'Send revised workout'), 'Follow-up appears in Mission Control');
    check(!(await window.coachNotes.getWrapup({ day: todayLocalDate() })).progress.followupDrafts[clientId], 'Committed task clears draft');
    const undone = await window.coachNotes.undoClientSection({ clientId, sectionKey: 'coachTasks' });
    check(!undone.baseline.structured.coachTasks.some(t => t.title === 'Send revised workout'), 'Follow-up uses normal task undo');
    await window.coachNotes.addWrapupTask({ ...window.taskRetry, requestId: crypto.randomUUID() });
  })()`);
  assert.equal(calls.filter(c => c.endpoint === '/workflow').length, 2, 'Scheduling tasks does not call AI');
  await screenshot('wrapup-task-saved');
  await client.evaluate(`(async () => {
    document.querySelector('[data-wrapup-add]').click(); await new Promise(resolve => setTimeout(resolve, 300));
    check(els.cancelAddNoteBtn.textContent === 'Save Draft & Next', 'Explicit draft navigation label');
    check(els.updateNoteSubmitBtn.textContent === 'Update Dashboard & Next', 'Explicit update navigation label');
    els.noteTextInput.value='Follow-up after reviewing the day.';
    els.noteAnnotationInput.value='Keep this context';
    els.cancelAddNoteBtn.click(); await new Promise(resolve => setTimeout(resolve, 300));
    check(document.querySelector('.wrapup-step h3').textContent.includes('Bianca'), 'Save Draft & Next advances to second client');
    document.getElementById('closeWrapupBtn').click(); await new Promise(resolve => setTimeout(resolve, 150));
    await dailyWrapup.open();
    check(document.querySelector('.wrapup-step h3').textContent.includes('Bianca'), 'Deferred queue persists across close');
    document.querySelector('[data-wrapup-next]').click(); await new Promise(resolve => setTimeout(resolve, 200));
    check(!document.querySelector('.wrapup-complete'), 'Deferred drafts do not become complete');
    check(document.querySelector('.wrapup-pending').textContent.includes('dashboard not updated'), 'Pending draft is explicit');
    document.querySelector('[data-wrapup-resume]').click(); await new Promise(resolve => setTimeout(resolve, 150));
    document.querySelector('[data-wrapup-next]').click(); await new Promise(resolve => setTimeout(resolve, 150));
    check(document.getElementById('wrapupError').textContent.includes('saved note'), 'Cannot complete a client with a note draft');
    document.querySelector('[data-wrapup-add]').click(); await new Promise(resolve => setTimeout(resolve, 300));
    check(els.noteTextInput.value === 'Follow-up after reviewing the day.' && els.noteAnnotationInput.value === 'Keep this context', 'Deferred note and metadata restored');
    await submitAddedNote({ preventDefault() {} });
    check(document.querySelector('.wrapup-complete'), 'AI update completes wrapup client');
    check((await window.coachNotes.getWrapup({day:todayLocalDate()})).progress.done[state.selectedClientId]==='updated', 'Wrapup completion persisted');
  })()`);
  await screenshot('wrapup-complete');
  await pause(3100);
  await client.evaluate(`check(document.querySelector('.wrapup-closing-message').textContent.includes('workout changes'), 'Personal closing appears after completion');`);
  const closingCalls = calls.filter(c => c.endpoint === '/wrapup-closing');
  assert.equal(closingCalls.length, 1);
  assert.equal(closingCalls[0].body.context.reviewed, 2);
  assert.equal(closingCalls[0].body.context.updated, 1);
  assert.equal(closingCalls[0].body.context.followups, 1);
  assert.ok(closingCalls[0].body.context.details.some(s => s.includes('Send revised workout')));
  assert.ok(closingCalls[0].body.context.details.some(s => s.includes('New context captured.')));
  await screenshot('wrapup-personal-message');
  await client.evaluate(`(async () => {
    document.getElementById('wrapupDialog').close(); await openAddNoteDialog();
    document.querySelector('[data-dictation-for="noteTextInput"]').click();
  })()`);
  await pause(2200);
  await client.evaluate(`check(document.querySelector('[data-dictation-for="noteTextInput"]').getAttribute('aria-pressed') === 'true', 'Recording started'); check(els.updateNoteSubmitBtn.disabled, 'Cannot submit during recording');`);
  await screenshot('recording');
  await screenshotDictation('note-recording-inline', 'noteTextInput');
  // Simulate a failed transcription independently of the earlier workflow failure.
  failAudio = true;
  await client.evaluate(`(async () => { await noteCapture.stop(true); check(document.querySelector('[data-transcribe]'), 'Audio preserved after transcription failure'); check(!dictationRecorder.active, 'Recording stopped'); })()`);
  await client.evaluate(`check(els.noteTextInput.closest('.dictation-field').querySelector('[data-transcribe]'), 'Note retry stays inside its text box'); check(!document.querySelector('#noteCaptureList [data-transcribe]'), 'No separate recording card');`);
  await screenshotDictation('note-retry-inline', 'noteTextInput');
  await client.evaluate(`document.querySelector('[data-transcribe]').click();`);
  await pause(600);
  await client.evaluate(`(async () => {
    check(els.noteTextInput.value.includes('A dictated coaching note.'), 'Retry appends transcript');
    check(!document.querySelector('[data-transcribe]'), 'No duplicate pending recording after success');
    await noteCapture.save();
  })()`);
  await client.call('Page.reload'); await pause(800);
  await client.evaluate(`(async () => { await selectClient(state.clients[0].id); await openAddNoteDialog(); if (!els.noteTextInput.value.includes('A dictated coaching note.')) throw new Error('Draft survives renderer restart'); })()`);
  await client.evaluate(`window.check = (condition, message) => { if (!condition) throw new Error(message); }; window.noteBefore = els.noteTextInput.value; document.querySelector('[data-dictation-for="noteAnnotationInput"]').click();`);
  await pause(1500);
  failAudio = true;
  await client.evaluate(`(async () => {
    await dictationRecorder.stop(true);
    const retry = els.noteAnnotationInput.closest('.dictation-field').querySelector('[data-transcribe]');
    check(retry && !els.noteTextInput.closest('.dictation-field').querySelector('[data-transcribe]'), 'Annotation retry stays with annotation');
    retry.click(); await new Promise(resolve => setTimeout(resolve, 400));
    check(els.noteAnnotationInput.value.includes('A dictated coaching note.'), 'Annotation dictation fills annotation');
    check(els.noteTextInput.value === window.noteBefore, 'Annotation dictation leaves note text unchanged');
    els.addNoteDialog.close(); openAskDialog(); fieldDictation.refresh();
    await new Promise(resolve => setTimeout(resolve, 150));
    check(!document.querySelector('[data-dictation-for="baselineJsonInput"]'), 'Raw JSON has no microphone');
    els.askPromptInput.value = 'Keep my typed question.';
    document.querySelector('[data-dictation-for="askPromptInput"]').click();
  })()`);
  await pause(1500);
  await client.evaluate(`check(els.askSubmitBtn.disabled, 'ASK disabled during recording'); check(document.querySelector('[data-dictation-for="askFollowupInput"]').disabled, 'Only one microphone owner');`);
  await screenshot('ask-dictation');
  await screenshotDictation('ask-recording-inline', 'askPromptInput');
  await client.evaluate(`(async () => {
    els.askPromptInput.value += ' And this edit.';
    await dictationRecorder.stop(true);
    check(els.askPromptInput.value === 'Keep my typed question. And this edit. A dictated coaching note.', 'Typed edits preserved and transcript appended');
    check(!els.askSubmitBtn.disabled && !dictationRecorder.active, 'ASK ready after transcription');
    check(state.askTurns.length === 0, 'Dictation never sends question');
    document.querySelector('[data-dictation-for="askPromptInput"]').click();
  })()`);
  await pause(1500);
  failAudio = true;
  await client.evaluate(`(async () => {
    await dictationRecorder.stop(true);
    check(!els.askPromptInput.closest('label').querySelector('.dictation-recovery').hidden, 'Failed ASK recording offers retry');
  })()`);
  await screenshotDictation('ask-retry-inline', 'askPromptInput');
  await client.evaluate(`els.askDialog.close();`);
  await client.call('Page.reload'); await pause(800);
  await client.evaluate(`(async () => {
    window.check = (condition, message) => { if (!condition) throw new Error(message); };
    await selectClient(state.clients[0].id); openAskDialog(); fieldDictation.refresh();
    await new Promise(resolve => setTimeout(resolve, 150));
    check(!els.askPromptInput.closest('label').querySelector('.dictation-recovery').hidden, 'ASK audio survives renderer reload');
    els.askPromptInput.maxLength = 5;
    els.askPromptInput.closest('label').querySelector('.dictation-recovery button').click();
    await new Promise(resolve => setTimeout(resolve, 350));
    check(els.askPromptInput.value === '', 'Long transcript not silently truncated');
    check(els.askPromptInput.closest('label').textContent.includes('too long'), 'Length limit explained');
    els.askPromptInput.removeAttribute('maxlength');
    els.askPromptInput.closest('label').querySelector('.dictation-recovery button').click();
    await new Promise(resolve => setTimeout(resolve, 250));
    check(els.askPromptInput.value.includes('A dictated coaching note.'), 'Recovered ASK recording transcribes');
    document.querySelector('[data-dictation-for="askPromptInput"]').click();
  })()`);
  await pause(1500);
  audioDelay = 800;
  await client.evaluate(`void (window.stoppingDictation = dictationRecorder.stop(true));`);
  await pause(150);
  await client.evaluate(`(async () => {
    window.originalDictationClient = state.selectedClientId;
    els.askDialog.close(); await selectClient(state.clients[1].id); openAskDialog();
    await window.stoppingDictation; await new Promise(resolve => setTimeout(resolve, 100));
    check(els.askPromptInput.value === '', 'Late transcript never enters another client question');
    check(els.askPromptInput.closest('label').querySelector('.dictation-recovery').hidden, 'Other client cannot see pending audio');
    els.askDialog.close(); await selectClient(window.originalDictationClient); openAskDialog();
    await new Promise(resolve => setTimeout(resolve, 150));
    check(!els.askPromptInput.closest('label').querySelector('.dictation-recovery').hidden, 'Original client can recover late transcript');
    els.askPromptInput.closest('label').querySelector('.dictation-recovery button').click();
    await new Promise(resolve => setTimeout(resolve, 200));
    document.querySelector('[data-dictation-for="askPromptInput"]').click();
  })()`);
  audioDelay = 0;
  await pause(1500);
  await client.evaluate(`(async () => {
    els.askDialog.close(); await new Promise(resolve => setTimeout(resolve, 250));
    check(!dictationRecorder.active, 'Closing ASK releases microphone');
    openAskDialog(); await new Promise(resolve => setTimeout(resolve, 150));
    check(!els.askPromptInput.closest('label').querySelector('.dictation-recovery').hidden, 'Closing ASK keeps unfinished audio');
    els.askPromptInput.closest('label').querySelector('.dictation-recovery button:last-child').click();
    await new Promise(resolve => setTimeout(resolve, 150));
    check(els.askPromptInput.closest('label').querySelector('.dictation-recovery').hidden, 'Explicit discard removes pending recording');
    els.askDialog.close(); openAddTodoDialog(); fieldDictation.refresh();
    await new Promise(resolve => setTimeout(resolve, 150));
    document.querySelector('[data-dictation-for="todoDetailsInput"]').click();
  })()`);
  await pause(1500);
  await client.evaluate(`(async () => {
    await dictationRecorder.stop(true);
    check(document.getElementById('todoDetailsInput').value.includes('A dictated coaching note.'), 'To-do details support editable dictation');
    check(els.addTodoDialog.open, 'To-do dictation never saves automatically');
    els.addTodoDialog.close(); openSettings(); fieldDictation.refresh();
    for (const id of ['coachApproachInput', 'messageStyleInput', 'curriculumNotesInput']) check(document.querySelector('[data-dictation-for="' + id + '"]'), 'Coaching guidance microphone: ' + id);
  })()`);
  await screenshot('settings-dictation');
  await client.evaluate(`(async () => {
    els.settingsDialog.close(); openEditSection('overview'); fieldDictation.refresh();
    check(!document.querySelector('[data-dictation-for="editSectionInput"]').hidden, 'Narrative profile editor has microphone');
    els.editSectionDialog.close(); openEditSection('coachTasks'); fieldDictation.refresh();
    check(document.querySelector('[data-dictation-for="editSectionInput"]').hidden, 'Format-sensitive list editor has no microphone');
    els.editSectionDialog.close();
    state.detailPage = 'goals'; renderClientDetail(state.selectedClientDetail); setViewMode('detail');
    const menu = document.querySelector('.item-planning-menu'); menu.open = true; fieldDictation.refresh();
    await new Promise(resolve => setTimeout(resolve, 150));
    window.planningField = menu.querySelector('textarea'); window.planningBefore = window.planningField.value;
    check(menu.querySelector('.dictation-button'), 'Dynamic task editor has microphone');
    menu.querySelector('.dictation-button').click();
  })()`);
  await pause(1500);
  await client.evaluate(`(async () => {
    check(window.planningField.closest('.item-planning-controls').querySelector('.save-planning-item').disabled, 'Task save waits for transcription');
    await dictationRecorder.stop(true);
    check(window.planningField.value.includes('A dictated coaching note.'), 'Dynamic task detail dictation');
    check(!window.planningField.closest('.item-planning-controls').querySelector('.save-planning-item').disabled, 'Task save re-enabled');
    window.planningField.scrollIntoView({block:'center'});
  })()`);
  await screenshot('planning-dictation');
  await client.evaluate(`(() => {
    setViewMode('intake'); fieldDictation.refresh();
    check(document.querySelector('[data-dictation-for="sourceTextInput"]') && document.querySelector('[data-dictation-for="coachNoteInput"]'), 'Onboarding prose fields have microphones');
  })()`);
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
