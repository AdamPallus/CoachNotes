import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CdpClient, waitForTarget } from './visual-regression.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'coachnotes-worklist-test-'));
const artifacts = path.resolve(root, '../../output/playwright/worklist');
await fs.mkdir(artifacts, { recursive: true });
const electron = spawn(require('electron'), ['--remote-debugging-port=9324', root], {
  cwd: root, env: { ...process.env, COACHNOTES_VISUAL_USER_DATA: userData, COACHNOTES_VISUAL_FIXTURE: '1', COACHNOTES_VISUAL_DATE: '2026-07-30' }, stdio: ['ignore', 'pipe', 'pipe']
});
let stderr = ''; electron.stderr.on('data', chunk => { stderr += chunk; });
let client;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(code) { return client.evaluate(`(async () => { const check=(ok,msg)=>{if(!ok)throw new Error(msg)}; ${code} })()`); }
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click();`);
  await pause(250);
}
async function screenshots(name) {
  for (const width of [1024, 1440]) for (const theme of ['light', 'dark']) {
    await client.call('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: false });
    await evaluate(`applyTheme('${theme}',false);`); await pause(100);
    await evaluate(`
      for (const selector of ['#dailyWorklistStrip:not([hidden])', '#worklistDialog[open]']) {
        const el=document.querySelector(selector); if(!el) continue;
        const r=el.getBoundingClientRect(); check(r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, selector+' fits');
        check(el.scrollWidth <= el.clientWidth + 2, selector+' has no horizontal overflow');
        for(const button of el.querySelectorAll('button')){ const b=button.getBoundingClientRect(); if(!b.width)continue; check(button.scrollWidth <= button.clientWidth + 2,'Button text fits: '+button.textContent); }
      }
    `);
    const result = await client.call('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, `${name}-${theme}-${width}.png`), Buffer.from(result.data, 'base64'));
  }
}
try {
  client = new CdpClient((await waitForTarget()).webSocketDebuggerUrl); await client.connect();
  await pause(600);
  await evaluate(`
    window.initial = await window.coachNotes.getWorklist();
    check(initial.candidates.length === 14, 'Active roster');
    check(initial.plan.entries.length > 0, 'Initial suggestions');
    window.ids = state.clients.slice(0,3).map(c=>c.id);
    const plan={...initial.plan, entries:ids.map(clientId=>({clientId,status:'pending',reasons:['Review client']})), currentId:ids[0]};
    await window.coachNotes.saveWorklist({day:initial.day,plan});
    await dailyWorklist.open();
  `);
  await screenshots('setup');
  await evaluate(`document.querySelector('[data-worklist-down="'+ids[0]+'"]').click();`); await pause(250);
  await evaluate(`const d=await window.coachNotes.getWorklist();check(d.plan.entries[0].clientId===ids[1], 'Arrow reorder persists');`);
  await evaluate(`document.querySelector('[data-worklist-message="'+ids[2]+'"]').click();`); await pause(250);
  await evaluate(`check((await window.coachNotes.getWorklist()).plan.entries[2].message, 'Manual incoming message flag');`);
  await click('#startWorklistBtn');
  await evaluate(`
    check(!document.getElementById('dailyWorklistStrip').hidden, 'Persistent strip');
    check(document.querySelector('[data-worklist-status="done"]'), 'Current client actions');
    const before=await window.coachNotes.getWorklist(); window.first=before.plan.currentId;
    check(first === ids[1], 'First review begins with coach-reordered first client');
    window.originalTasks=JSON.stringify((await window.coachNotes.getClientDetail({clientId:first})).baseline.structured.coachTasks);
  `);
  await screenshots('client');
  await click('[data-worklist-next]');
  await evaluate(`const d=await window.coachNotes.getWorklist();check(d.plan.entries.every(e=>e.status==='pending'),'Next does not mark reviewed');window.cursor=d.plan.currentId;await openCoachHome();check(document.querySelector('[data-worklist-open]'),'Resume after navigating away');`);
  await click('[data-worklist-open]');
  await evaluate(`check(state.selectedClientId===cursor,'Returns to saved client');await openAskDialog();document.getElementById('askDialog').close();`);
  await client.call('Page.reload'); await pause(900);
  await evaluate(`const d=await window.coachNotes.getWorklist();window.ids=state.clients.slice(0,3).map(c=>c.id);window.cursor=d.plan.currentId;check(d.plan.started,'Started state persists across renderer restart');`);
  await click('[data-worklist-open]');
  await evaluate(`check(state.selectedClientId===cursor,'Cursor restored');window.originalTasks=JSON.stringify(state.selectedClientDetail.baseline.structured.coachTasks);window.doneClient=cursor;`);
  await click('[data-worklist-status="done"]');
  await evaluate(`
    const d=await window.coachNotes.getWorklist();check(d.plan.entries.find(e=>e.clientId===doneClient).status==='done','Reviewed persisted');
    check(JSON.stringify((await window.coachNotes.getClientDetail({clientId:doneClient})).baseline.structured.coachTasks)===originalTasks,'Does not complete real todos');
    window.draftClient=d.plan.currentId;
    await window.coachNotes.saveNoteDraft({clientId:draftClient,draft:{fields:{noteTextInput:'Unfinished note'}}});
    await dailyWorklist.refresh();
  `);
  await click('[data-worklist-status="done"]');
  await evaluate(`const d=await window.coachNotes.getWorklist();check(d.plan.entries.find(e=>e.clientId===draftClient).status==='pending','Cannot mark saved draft complete');check(await window.coachNotes.getNoteDraft({clientId:draftClient}),'Draft survives');`);
  await click('[data-worklist-status="later"]');
  await evaluate(`check((await window.coachNotes.getWorklist()).plan.entries.find(e=>e.clientId===draftClient).status==='later','Later preserves pending draft');`);
  await click('[data-worklist-status="skipped"]');
  await evaluate(`check(document.querySelector('[data-worklist-review-deferred]'), 'Deferred clients have a direct return action');check(document.querySelector('.worklist-deferred').textContent.includes(state.clients.find(c=>c.id===draftClient).name), 'Deferred client is named');hideToast();`);
  await screenshots('deferred-strip');
  await evaluate(`check((await window.coachNotes.getWorklist()).plan.currentId===null,'No pending current client');await dailyWorklist.open();`);
  await screenshots('deferred');
  await click('#closeWorklistBtn');
  await evaluate(`
    await dailyWrapup.open();
    check(document.querySelector('[data-wrapup-client="'+draftClient+'"]').checked,'End of Day includes unfinished client');
    document.querySelector('[data-wrapup-client="'+draftClient+'"]').click();
    await new Promise(resolve=>setTimeout(resolve,200));
    document.getElementById('wrapupDialog').close();
    await dailyWrapup.open();
    check(!document.querySelector('[data-wrapup-client="'+draftClient+'"]').checked,'End of Day deselection is respected');
    document.getElementById('wrapupDialog').close();
    await selectClient(ids[0],{detailPage:'weekly'});
  `);
  await click('[data-worklist-weekly]');
  await evaluate(`check((await window.coachNotes.getWorklist()).plan.entries.find(e=>e.clientId===ids[0]).focus.includes('Weekly Review'),'Weekly focus carried into plan');`);
  await evaluate(`
    const d=await window.coachNotes.getWorklist();
    let conflict=false; try{await window.coachNotes.saveWorklist({day:d.day,plan:{...d.plan,revision:d.plan.revision-1}});}catch{conflict=true;}
    check(conflict,'Stale saves rejected');
    let oldDay=false;try{await window.coachNotes.saveWorklist({day:'2026-07-29',plan:d.plan});}catch{oldDay=true;}
    check(oldDay,'Midnight stale submission rejected');
    await window.coachNotes.setClientArchived({clientId:ids[1],archived:true});
    const active=await window.coachNotes.getWorklist();check(!active.candidates.some(c=>c.id===ids[1])&&!active.plan.entries.some(e=>e.clientId===ids[1]),'Archive removes from candidates and plan');
    await window.coachNotes.setClientArchived({clientId:ids[1],archived:false});
    const before=await window.coachNotes.getWorklist();
    const reviewId=ids.find(id=>id!==draftClient);
    const entry=before.plan.entries.find(e=>e.clientId===reviewId);entry.status='pending';entry.deferredUntil='';
    await window.coachNotes.saveWorklist({day:before.day,plan:before.plan});
    const end=await window.coachNotes.getWrapup({day:before.day});
    end.progress.selected=[...new Set([...end.progress.selected,reviewId])];end.progress.done[reviewId]='no-updates';
    await window.coachNotes.saveWrapup({day:before.day,progress:end.progress});
    check((await window.coachNotes.getWorklist()).plan.entries.find(e=>e.clientId===reviewId).status==='done','End of Day reconciles completed reviews');
    await dailyWorklist.open();
    document.getElementById('worklistDays').value=14;
  `);
  await click('#saveWorklistRulesBtn');
  await evaluate(`check((await window.coachNotes.getWorklist()).rules.staleDays===14,'Rules saved');`);
  await click('#closeWorklistBtn');
  await evaluate(`
    const d=await window.coachNotes.getWorklist();
    window.testIds=d.candidates.slice(0,3).map(c=>c.id);
    await window.coachNotes.saveWrapup({day:d.day,progress:{selected:[],done:{},started:false,worklistImported:[]}});
    await window.coachNotes.saveWorklist({day:d.day,plan:{...d.plan,started:true,bannerDismissed:false,currentId:testIds[0],entries:[
      {clientId:testIds[0],status:'pending',focus:'Keep this focus'},
      {clientId:testIds[1],status:'later'},
      {clientId:testIds[2],status:'later',deferredUntil:'2026-07-31'}
    ]}});
    await dailyWorklist.refresh(); await selectClient(testIds[0]);
    window.beforeDismiss=JSON.stringify((await window.coachNotes.getWorklist()).plan.entries);
  `);
  await click('[data-worklist-dismiss]');
  await evaluate(`
    const d=await window.coachNotes.getWorklist();
    check(d.plan.bannerDismissed && d.plan.started,'Dismissal saved without ending the day');
    check(JSON.stringify(d.plan.entries)===beforeDismiss,'Dismiss does not change statuses or focus');
    check(document.getElementById('dailyWorklistStrip').hidden,'Banner hides');
    await openCoachHome(); await dailyWorklist.refresh();
    check(document.getElementById('dailyWorklistStrip').hidden,'Navigation and refresh do not unhide it');
    const end=await window.coachNotes.getWrapup({day:d.day});
    check(end.progress.selected.includes(d.plan.entries[1].clientId),'Hidden worklist still feeds End of Day');
  `);
  await client.call('Page.reload'); await pause(900);
  await evaluate(`
    const d=await window.coachNotes.getWorklist();window.testIds=d.plan.entries.map(e=>e.clientId);
    check(d.plan.bannerDismissed && document.getElementById('dailyWorklistStrip').hidden,'Dismissal survives reload');
    await openCoachHome(); await dailyWorklist.open();
  `);
  await click('#startWorklistBtn');
  await evaluate(`check(!document.getElementById('dailyWorklistStrip').hidden,'Explicit resume restores banner');`);
  await click('[data-worklist-review-deferred]');
  await evaluate(`
    const d=await window.coachNotes.getWorklist();
    check(d.plan.currentId===testIds[1] && state.selectedClientId===testIds[1],'Review deferred opens first deferred client');
    check(d.plan.entries[0].status==='pending' && d.plan.entries[0].focus==='Keep this focus','Existing pending work is untouched');
    check(d.plan.entries[1].status==='pending','Later today returns to review');
    check(d.plan.entries[2].status==='later' && d.plan.entries[2].deferredUntil==='2026-07-31','Tomorrow stays deferred');
    for(const id of testIds) await window.coachNotes.saveNoteDraft({clientId:id,draft:null});
  `);
  await click('[data-worklist-status="done"]');
  await click('[data-worklist-status="skipped"]');
  await evaluate(`
    check(document.getElementById('dailyWorklistStrip').hidden,'Banner auto-hides when only future work remains');
    const d=await window.coachNotes.getWorklist();
    d.plan.entries[2].status='done';
    await window.coachNotes.saveWorklist({day:d.day,plan:d.plan});
    await dailyWorklist.refresh();
    check(document.getElementById('dailyWorklistStrip').hidden,'Banner stays hidden when all clients are reviewed or skipped');
    d.plan.entries=[];
    const fresh=await window.coachNotes.getWorklist();
    await window.coachNotes.saveWorklist({day:fresh.day,plan:{...fresh.plan,entries:[]}});
    await dailyWorklist.refresh();
    check(document.getElementById('dailyWorklistStrip').hidden,'Empty selection has no banner');
  `);
  console.log('Worklist: suggestions, reorder, messages, navigation, restart, status isolation, draft safety, EOD, weekly focus, concurrency, date guard, archives and settings passed.');
} catch (err) { console.error(stderr); throw err; }
finally { client?.close(); electron.kill('SIGTERM'); await new Promise(resolve => electron.once('exit',resolve)); await fs.rm(userData,{recursive:true,force:true}); }
