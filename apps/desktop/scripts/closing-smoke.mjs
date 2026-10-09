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
const artifacts = path.resolve(root, '../../output/playwright/closing');
await fs.mkdir(artifacts, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let mode, calls = [];
const message = 'You captured the workout changes and scheduled a follow-up for tomorrow.';
const server = http.createServer(async (req, res) => {
  let text = ''; for await (const chunk of req) text += chunk;
  calls.push({ url: req.url, body: JSON.parse(text) });
  await pause(3500);
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = mode === 'failure' ? 502 : 200;
  res.end(JSON.stringify(mode === 'failure' ? { error: 'Offline test' } : { message }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (mode of ['normal', 'disabled', 'reduced', 'failure']) {
    calls = [];
    const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'coachnotes-closing-test-'));
    const electron = spawn(require('electron'), ['--remote-debugging-port=9324', root], {
      cwd: root, env: { ...process.env, COACHNOTES_VISUAL_USER_DATA: userData, COACHNOTES_VISUAL_FIXTURE: '1', COACHNOTES_VISUAL_DATE: '2026-07-30' }, stdio: ['ignore', 'ignore', 'pipe']
    });
    let client, stderr = '';
    electron.stderr.on('data', chunk => { stderr += chunk; });
    const evaluate = code => client.evaluate(`(async () => { const check=(ok,msg)=>{if(!ok)throw new Error(msg)}; ${code} })()`);
    const screenshot = async name => {
      const result = await client.call('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(artifacts, `${name}.png`), Buffer.from(result.data, 'base64'));
    };
    try {
      client = new CdpClient((await waitForTarget()).webSocketDebuggerUrl); await client.connect(); await pause(500);
      await client.call('Page.bringToFront');
      await client.call('Emulation.setDeviceMetricsOverride', { width: 1024, height: 760, deviceScaleFactor: 1, mobile: false });
      await client.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: mode === 'reduced' ? 'reduce' : 'no-preference' }] });
      await evaluate(`
        state.settings = await window.coachNotes.saveSettings({proxyBaseUrl:'http://127.0.0.1:${server.address().port}',wrapupCelebrations:${mode !== 'disabled'}});
        applyTheme('light',false);
        window.ids=state.clients.slice(0,2).map(c=>c.id);
        await window.coachNotes.saveWrapup({day:todayLocalDate(),progress:{selected:ids,done:{},started:true}});
        await window.coachNotes.addWrapupTask({day:todayLocalDate(),clientId:ids[0],requestId:crypto.randomUUID(),title:'Send revised workout',dueDate:'2026-07-31'});
        await dailyWrapup.open();
        document.querySelector('[data-wrapup-next]').click();
      `);
      await pause(200);
      await evaluate(`document.querySelector('[data-wrapup-next]').click();`); await pause(150);
      await evaluate(`
        check(document.querySelector('.wrapup-complete h3').textContent === 'Your day is wrapped up.', 'Immediate completion');
        check(!document.getElementById('closeWrapupBtn').disabled,'Closing is never blocked by AI');
        check(!document.querySelector('.wrapup-closing-message').textContent,'No premature message');
        check(document.getElementById('wrapupError').hidden,'No error in successful completion');
      `);
      if (mode === 'normal') {
        await evaluate(`
          const deadline = performance.now() + 1500;
          let painted = false;
          while (performance.now() < deadline) {
            const canvas = document.querySelector('.wrapup-confetti');
            if (canvas?.width && canvas?.height && canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((v,i)=>i%4===3&&v>0)) {
              painted = true; break;
            }
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          check(painted, 'Confetti is actually rendered');
        `);
        await screenshot('celebration-light');
      } else if (mode === 'disabled' || mode === 'reduced') await evaluate(`check(!document.querySelector('.wrapup-confetti'),'No animation when disabled or reduced motion');`);
      if (mode === 'failure') {
        await evaluate(`document.getElementById('wrapupDialog').close(); await dailyWrapup.open();`);
        await evaluate(`check(!document.querySelector('.wrapup-confetti'),'Reopen while running does not replay');`);
      }
      await pause(4000);
      assert.equal(calls.length, mode === 'disabled' ? 0 : 1);
      await evaluate(`check(document.querySelector('.wrapup-closing-message').textContent === ${JSON.stringify(['normal', 'reduced'].includes(mode) ? message : '')},'Expected optional message');
        check(document.getElementById('wrapupError').hidden,'Optional request failure is invisible');
        check(!document.querySelector('.wrapup-confetti'),'Animation cleans itself up');`);
      if (mode === 'normal') {
        for (const width of [1024, 1440]) for (const theme of ['light', 'dark']) {
          await client.call('Emulation.setDeviceMetricsOverride', { width, height: width === 1024 ? 760 : 900, deviceScaleFactor: 1, mobile: false });
          await evaluate(`applyTheme('${theme}',false);`); await pause(150);
          await evaluate(`
            const dialog=document.getElementById('wrapupDialog'), r=dialog.getBoundingClientRect();
            check(r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,'Dialog fits');
            const paragraph=dialog.querySelector('.wrapup-closing-message');
            check(paragraph.scrollWidth<=paragraph.clientWidth,'Message does not overflow');
            check(dialog.querySelector('.wrapup-footer').getBoundingClientRect().top>=paragraph.getBoundingClientRect().bottom,'Message does not overlap footer');
          `);
          await screenshot(`complete-${theme}-${width}`);
        }
      }
      await client.call('Page.reload'); await pause(900);
      await evaluate(`await dailyWrapup.open();`); await pause(150);
      await evaluate(`check(!document.querySelector('.wrapup-confetti'),'No replay after reload');
        check(document.querySelector('.wrapup-closing-message').textContent===${JSON.stringify(['normal', 'reduced'].includes(mode) ? message : '')},'Persisted message or silent fallback');
        document.getElementById('wrapupDialog').close(); openSettings();
        check(document.getElementById('wrapupCelebrationsInput').checked===${mode !== 'disabled'},'Setting persists');
      `);
      assert.equal(calls.length, mode === 'disabled' ? 0 : 1, 'Reopen never repeats API request');
      console.log(`${mode}: completion, motion, network, layout and reload checks passed`);
    } catch (error) {
      if (client) await screenshot(`failure-${mode}`).catch(() => {});
      console.error(stderr.slice(-1500)); throw error;
    } finally {
      client?.close(); electron.kill('SIGTERM');
      await Promise.race([new Promise(resolve => electron.once('exit', resolve)), pause(2000)]);
      if (electron.exitCode === null) electron.kill('SIGKILL');
      await fs.rm(userData, { recursive: true, force: true });
    }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
