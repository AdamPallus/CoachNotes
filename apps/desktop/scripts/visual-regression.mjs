import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const desktopRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const baselineRoot = path.join(desktopRoot, 'test', 'visual-baselines');
const artifactRoot = path.join(repoRoot, 'output', 'playwright', 'regression');
const updateBaselines = process.argv.includes('--update');
const port = 9324;
const visualDate = '2026-07-29';
const widths = [1024, 1280, 1440];
const themes = ['light', 'dark'];
const maxDiffRatio = process.env.CI ? 0.055 : 0.0015;
const screens = [
  { name: 'mission-control', prepare: 'mission' },
  { name: 'weekly-review', prepare: 'weekly' },
  { name: 'client-snapshot', prepare: 'client' },
  { name: 'add-note', prepare: 'add-note' },
  { name: 'ask', prepare: 'ask' },
  { name: 'onboarding', prepare: 'onboarding' }
];

const viewportHeight = (width) => width === 1024 ? 760 : width === 1280 ? 820 : 900;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForTarget(timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find((entry) => entry.type === 'page' && entry.title === 'CoachNotes');
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Electron is still starting.
    }
    await pause(150);
  }
  throw new Error('CoachNotes visual fixture did not start.');
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  call(method, params = {}) {
    const id = ++this.nextId;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Page evaluation failed.');
    }
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function prepareScreen(client, screen, theme) {
  await client.evaluate(`(async () => {
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    applyTheme(${JSON.stringify(theme)}, false);
    document.documentElement.dataset.visualRegression = 'true';
    let style = document.getElementById('visualRegressionStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'visualRegressionStyle';
      style.textContent = '* { animation: none !important; transition: none !important; caret-color: transparent !important; }';
      document.head.append(style);
    }
    const prepare = ${JSON.stringify(screen.prepare)};
    if (prepare === 'mission') {
      state.coachHomeTab = 'attention';
      await openCoachHome({ recordHistory: false });
      renderCoachHome();
      document.activeElement?.blur();
    } else if (prepare === 'weekly') {
      state.coachHomeTab = 'weekly';
      await openCoachHome({ recordHistory: false });
      renderCoachHome();
      document.activeElement?.blur();
    } else if (prepare === 'client') {
      await selectClient(state.clients[0].id, { recordHistory: false, detailPage: 'snapshot' });
      document.activeElement?.blur();
    } else if (prepare === 'add-note') {
      await selectClient(state.clients[0].id, { recordHistory: false, detailPage: 'snapshot' });
      openAddNoteDialog();
      els.noteDateInput.value = ${JSON.stringify(visualDate)};
      els.noteTextInput.focus();
    } else if (prepare === 'ask') {
      await selectClient(state.clients[0].id, { recordHistory: false, detailPage: 'snapshot' });
      openAskDialog();
      els.askPromptInput.focus();
    } else if (prepare === 'onboarding') {
      startOnboarding();
      els.clientNameInput.focus();
    }
    els.statusLine.textContent = state.clients.length + ' accepted clients • visual fixture';
    document.querySelector('.main-surface')?.scrollTo(0, 0);
    document.querySelector('.client-list')?.scrollTo(0, 0);
    document.activeElement?.blur();
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return true;
  })()`);
  await pause(80);
}

async function capture(client, screen, theme, width) {
  const height = viewportHeight(width);
  await client.call('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: height
  });
  await prepareScreen(client, screen, theme);
  const layout = await client.evaluate(`(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    openDialog: document.querySelector('dialog[open]')?.id || ''
  }))()`);
  if (layout.horizontalOverflow) {
    throw new Error(`${screen.name} has horizontal overflow at ${width}px in ${theme} mode.`);
  }
  const result = await client.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  return Buffer.from(result.data, 'base64');
}

function compareImages(expectedBuffer, actualBuffer) {
  const expected = PNG.sync.read(expectedBuffer);
  const actual = PNG.sync.read(actualBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return { ratio: 1, diff: actual };
  }
  const diff = new PNG({ width: expected.width, height: expected.height });
  const changedPixels = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    expected.width,
    expected.height,
    { threshold: 0.1, includeAA: false }
  );
  return { ratio: changedPixels / (expected.width * expected.height), diff };
}

async function main() {
  await fs.mkdir(baselineRoot, { recursive: true });
  await fs.rm(artifactRoot, { recursive: true, force: true });
  await fs.mkdir(artifactRoot, { recursive: true });
  const visualUserData = await fs.mkdtemp(path.join(os.tmpdir(), 'coachnotes-visual-'));
  const electron = spawn(electronPath, [`--remote-debugging-port=${port}`, desktopRoot], {
    cwd: desktopRoot,
    env: {
      ...process.env,
      COACHNOTES_VISUAL_USER_DATA: visualUserData,
      COACHNOTES_VISUAL_FIXTURE: '1',
      COACHNOTES_VISUAL_DATE: visualDate
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  electron.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  let client;
  const failures = [];
  try {
    const target = await waitForTarget();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();

    for (const screen of screens) {
      for (const theme of themes) {
        for (const width of widths) {
          const filename = `${screen.name}-${theme}-${width}.png`;
          const baselinePath = path.join(baselineRoot, filename);
          const actualPath = path.join(artifactRoot, filename);
          const actual = await capture(client, screen, theme, width);
          await fs.writeFile(actualPath, actual);
          if (updateBaselines) {
            await fs.writeFile(baselinePath, actual);
            process.stdout.write(`updated ${filename}\n`);
            continue;
          }
          let expected;
          try {
            expected = await fs.readFile(baselinePath);
          } catch {
            failures.push(`${filename}: baseline missing`);
            continue;
          }
          const comparison = compareImages(expected, actual);
          process.stdout.write(`${filename}: ${(comparison.ratio * 100).toFixed(3)}% changed\n`);
          if (comparison.ratio > maxDiffRatio) {
            const diffPath = path.join(artifactRoot, filename.replace('.png', '.diff.png'));
            await fs.writeFile(diffPath, PNG.sync.write(comparison.diff));
            failures.push(`${filename}: ${(comparison.ratio * 100).toFixed(3)}% changed`);
          }
        }
      }
    }
  } finally {
    client?.close();
    electron.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => electron.once('exit', resolve)), pause(2500)]);
    if (electron.exitCode === null) electron.kill('SIGKILL');
    await fs.rm(visualUserData, { recursive: true, force: true });
  }

  if (failures.length) {
    throw new Error(`Visual regression failed:\n${failures.join('\n')}${stderr ? `\nElectron output:\n${stderr.slice(-1200)}` : ''}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
