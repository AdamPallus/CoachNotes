import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CdpClient, waitForTarget } from './visual-regression.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'coachnotes-ux-test-'));
const artifacts = path.resolve(root, '../../output/playwright/ux-reliability');
await fs.mkdir(artifacts, { recursive: true });
const child = spawn(require('electron'), ['--remote-debugging-port=9324', root], {
  cwd: root, env: { ...process.env, COACHNOTES_VISUAL_USER_DATA: userData, COACHNOTES_VISUAL_FIXTURE: '1',
    COACHNOTES_VISUAL_DATE: '2026-07-29' }, stdio: ['ignore', 'pipe', 'pipe']
});
let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
let cdp;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function screenshot(name) {
  const result = await cdp.call('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(artifacts, `${name}.png`), Buffer.from(result.data, 'base64'));
}
try {
  cdp = new CdpClient((await waitForTarget()).webSocketDebuggerUrl); await cdp.connect();
  await cdp.evaluate(`(async () => {
    while (!state.coachHome || state.busyCount) await new Promise(resolve => setTimeout(resolve, 100));
    window.check = (condition, message) => { if (!condition) throw new Error(message); };
    const api = window.coachNotes;
    await selectClient(state.clients[0].id);
    window.testClientId = state.selectedClientId;
    const original = await api.getClientDetail({ clientId: testClientId });
    check(document.querySelectorAll('.detail-page-tab').length === 10, 'Existing navigation is unchanged');
    check(document.querySelector('.edit-section[data-section-key="flags"]'), 'Existing editing controls remain available');
    openEditSection('overview');
    await saveEditedSection({ preventDefault() {} });
    const unchanged = await api.getClientDetail({ clientId: testClientId });
    check(JSON.stringify(unchanged.baseline) === JSON.stringify(original.baseline), 'No-op save preserves baseline and timestamp');
    check(JSON.stringify(unchanged.undoCounts) === JSON.stringify(original.undoCounts), 'No-op save preserves undo history');
    openEditSection('flags');
    await saveEditedSection({ preventDefault() {} });
    check(JSON.stringify((await api.getClientDetail({ clientId: testClientId })).baseline) === JSON.stringify(original.baseline), 'No-op structured list save preserves metadata');
    let rejected = false;
    try { await api.updateClientSection({ clientId: testClientId, sectionKey: 'flags', value: ['Flattened'], textEditor: true }); } catch { rejected = true; }
    check(rejected, 'Write boundary rejects flattening');
    const oldOverview = state.selectedClientDetail.baseline.structured.overview;
    openEditSection('overview'); els.editSectionInput.value += ' Coach edit';
    await api.updateClientSection({ clientId: testClientId, sectionKey: 'overview', value: 'Concurrent update' });
    await saveEditedSection({ preventDefault() {} });
    check(els.editSectionDialog.open && els.editSectionInput.value.endsWith(' Coach edit'), 'Conflicting edit remains in the editor');
    check((await api.getClientDetail({ clientId: testClientId })).baseline.structured.overview === 'Concurrent update', 'Stale save cannot overwrite newer data');
    els.editSectionDialog.close(); hideToast();
    await api.updateClientSection({ clientId: testClientId, sectionKey: 'overview', value: oldOverview });
    const tasks = [{ title: 'Same title', dueDate: '2026-07-28', details: 'First task', planningStatus: 'active', priority: 'high', evidenceIds: ['intake_source_1'] },
      { title: 'Same title', dueDate: '2026-07-28', details: 'Second task', planningStatus: 'active' }];
    await api.updateClientSection({ clientId: testClientId, sectionKey: 'coachTasks', value: tasks });
    await openCoachHome({ refresh: true });
    state.expandedHomeLanes.add('overdue'); renderCoachHome();
    const stale = document.querySelector('[data-home-action="complete"][data-home-client-id="'+testClientId+'"]').cloneNode(true);
    await api.updateClientSection({ clientId: testClientId, sectionKey: 'coachTasks', value: [tasks[1], tasks[0]] });
    await completeHomePlanningItem(stale);
    const after = (await api.getClientDetail({ clientId: testClientId })).baseline.structured.coachTasks;
    check(after.every(task => task.planningStatus === 'active'), 'Stale row cannot complete a same-title task');
    check(els.toast.textContent.includes('Nothing was marked complete'), 'Stale completion has actionable feedback');
    hideToast(); await loadClients(); renderCoachHome();
    await completeHomePlanningItem(document.querySelector('[data-home-action="complete"][data-home-client-id="'+testClientId+'"]'));
    const completed = (await api.getClientDetail({ clientId: testClientId })).baseline.structured.coachTasks;
    check(completed.filter(task => task.planningStatus === 'completed').length === 1, 'Fresh completion only changes one task');
    await api.updateClientSection({ clientId: testClientId, sectionKey: 'coachTasks', value: original.baseline.structured.coachTasks });
    hideToast(); await selectClient(testClientId); openAskDialog();
    const beforeSources = (await api.getClientDetail({ clientId: testClientId })).sources.length;
    renderAskResult({ answer: 'Synthetic answer for local save testing.', question: 'Test?', outputType: 'general', outputLabel: 'Answer', selectedSources: [], followUpsRemaining: 5 });
    await Promise.all([saveAskResultAsNote(), saveAskResultAsNote()]);
    await saveAskResultAsNote();
    check((await api.getClientDetail({ clientId: testClientId })).sources.length === beforeSources + 1, 'Repeated Ask saves produce only one source');
    check(els.saveAskResultBtn.disabled && els.saveAskResultBtn.textContent === 'Saved as Note', 'Saved state remains visible');
    showToast("Test failure: Error invoking remote method 'app:test': Error: Retry this action.", 'error');
    check(els.toast.matches(':popover-open') && els.toast.closest('dialog') === els.askDialog, 'Feedback belongs to active modal top layer');
    check(!els.toast.textContent.includes('remote method') && els.toast.getAttribute('role') === 'alert', 'Readable announced error');
  })()`);
  await screenshot('ask-visible-error');
  await cdp.evaluate(`hideToast(); setBusy(true, 'Saving...'); check(els.busyOverlay.matches(':modal'), 'Busy state blocks the underlying modal');`);
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp.evaluate(`check(els.busyOverlay.open, 'Escape cannot reveal editable controls during a save'); setBusy(false); els.askDialog.close();`);
  for (const theme of ['light', 'dark']) {
    for (const width of [1024, 1440]) {
      await cdp.call('Emulation.setDeviceMetricsOverride', { width, height: width === 1024 ? 760 : 900, deviceScaleFactor: 1, mobile: false });
      await cdp.evaluate(`(async () => { applyTheme('${theme}', false); hideToast(); await openCoachHome({refresh:true}); })()`);
      await pause(150); await screenshot(`mission-${theme}-${width}`);
      for (const page of ['snapshot', 'goals', 'progress', 'bio', 'notes', 'weekly']) {
        await cdp.evaluate(`(async () => { await selectClient(testClientId, {detailPage:'${page}'}); els.mainSurface.scrollTop = 0; })()`);
        await pause(180);
        await cdp.evaluate(`check(els.mainSurface.scrollWidth <= els.mainSurface.clientWidth + 1, 'No horizontal page overflow'); check(document.querySelector('.detail-page-tab.active').dataset.detailPage === '${page}', 'Correct tab');`);
        await screenshot(`${page}-${theme}-${width}`);
      }
    }
  }
  await cdp.evaluate(`(async () => {
    const worklist = await window.coachNotes.getWorklist();
    await window.coachNotes.saveWorklist({day:worklist.day, plan:{...worklist.plan, started:true, currentId:testClientId, entries:[{clientId:testClientId,status:'pending',focus:'Review this client'}]}});
    await dailyWorklist.refresh();
    await selectClient(testClientId, {detailPage:'snapshot'});
    els.mainSurface.scrollTop = 500;
  })()`);
  await pause(300);
  await cdp.evaluate(`check(document.querySelector('.detail-page-tabs').getBoundingClientRect().top >= document.getElementById('dailyWorklistStrip').getBoundingClientRect().bottom - 1, 'Sticky strip cannot overlap tabs');`);
  await screenshot('sticky-stack');
  await cdp.evaluate(`openSettings();`); await pause(150); await screenshot('settings');
  await cdp.evaluate(`(async () => { const about = await window.coachNotes.getAbout(); check(document.getElementById('appVersion').textContent.includes(about.version), 'Real app version is visible'); els.settingsDialog.close(); })()`);
  process.stdout.write(`UX integration checks passed. Screenshots: ${artifacts}\n`);
} catch (error) {
  if (cdp) await screenshot('failure').catch(() => {});
  throw new Error(`${error.stack}\n${stderr}`);
} finally {
  cdp?.close();
  const exited = new Promise(resolve => child.once('exit', resolve));
  if (child.exitCode === null) { child.kill('SIGTERM'); await exited; }
  await fs.rm(userData, { recursive: true, force: true });
}
