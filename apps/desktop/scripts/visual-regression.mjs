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
  { name: 'weekly-review-grouped', prepare: 'weekly-grouped' },
  { name: 'weekly-review-progress', prepare: 'weekly-progress' },
  { name: 'client-snapshot', prepare: 'client' },
  { name: 'add-note', prepare: 'add-note' },
  { name: 'ask', prepare: 'ask' },
  { name: 'onboarding', prepare: 'onboarding' },
  { name: 'archived-client', prepare: 'archived-client' },
  { name: 'archived-weekly-review', prepare: 'archived-weekly' }
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
    clearTimeout(toastTimer);
    els.toast.hidden = true;
    els.toast.classList.remove('is-visible');
    applyTheme(${JSON.stringify(theme)}, false);
    document.documentElement.dataset.visualRegression = 'true';
    state.weeklyReviewLoading = false;
    state.weeklyReviewProgress = null;
    state.weeklyReviewGroupMode = 'alphabetical';
    let style = document.getElementById('visualRegressionStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'visualRegressionStyle';
      style.textContent = '* { animation: none !important; transition: none !important; caret-color: transparent !important; }';
      document.head.append(style);
    }
    const prepare = ${JSON.stringify(screen.prepare)};
    const showArchive = prepare.startsWith('archived-');
    await window.coachNotes.setClientArchived({ clientId: state.clients[0].id, archived: showArchive });
    await loadClients();
    state.clientStatusFilter = showArchive ? 'archived' : 'active';
    els.clientBioFilter.hidden = !showArchive;
    els.clientFilterToggle.setAttribute('aria-expanded', String(showArchive));
    renderClients();
    if (prepare === 'archived-client') {
      state.selectedClientId = null;
      await selectClient(state.clients[0].id, { recordHistory: false, detailPage: 'snapshot' });
      document.activeElement?.blur();
    } else if (prepare === 'archived-weekly') {
      state.coachHomeTab = 'weekly';
      await openCoachHome({ recordHistory: false });
      renderCoachHome();
      document.activeElement?.blur();
    }
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
    } else if (prepare === 'weekly-progress') {
      state.coachHomeTab = 'weekly';
      await openCoachHome({ recordHistory: false });
      state.weeklyReviewLoading = true;
      state.weeklyReviewProgress = {
        phase: 'assessing',
        message: '24 of 50 clients reviewed.',
        clientCount: 50,
        completedClientCount: 24,
        batchCount: 5,
        completedBatchCount: 2
      };
      renderCoachHome();
      document.activeElement?.blur();
    } else if (prepare === 'weekly-grouped') {
      state.coachHomeTab = 'weekly';
      await openCoachHome({ recordHistory: false });
      state.weeklyReviewGroupMode = 'cohort';
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
      state.askRequestPresets = [
        'What should I follow up on this week?',
        'What changed since our last session?'
      ];
      renderAskPresetControls();
      document.querySelector('#askRequestPresetList .preset-chip')?.click();
      els.askPromptInput.focus();
    } else if (prepare === 'onboarding') {
      startOnboarding();
      els.clientNameInput.focus();
    }
    els.statusLine.textContent = state.clients.filter(c => !c.archived).length + ' active clients • visual fixture';
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
    await testClientArchiving(client);

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

async function testClientArchiving(client) {
  await client.evaluate(`(async () => {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const api = window.coachNotes;
    const initial = await api.getState();
    const first = initial.clients[0];
    const before = await api.getClientDetail({ clientId: first.id });
    const originalConfirm = window.confirm;
    await selectClient(first.id, { recordHistory: false });
    try {
      window.confirm = () => false;
      await toggleSelectedClientArchive();
      check((await api.getClients()).length === initial.clients.length, 'Cancel must not archive');
      window.confirm = () => true;
      await toggleSelectedClientArchive();
      check(els.archiveClientBtn.textContent === 'Restore Client', 'Archive UI must offer restore');
      check(!els.clientBioFilter.hidden, 'Archive action must reveal status filter');
      check(getFilteredClients().length === 1, 'Archived filter must show archived client only');
      check(!els.clientList.querySelector('.client-notification-badge'), 'Archived clients must not have due badges');
      check((await api.getClients()).length === initial.clients.length - 1, 'Default client query must exclude archived');
      const archivedState = await api.getState();
      check(archivedState.clients.find(c => c.id === first.id).archived, 'Archive status must persist in bootstrap');
      check(archivedState.coachHome.stats.clientCount === initial.coachHome.stats.clientCount - 1, 'Mission Control must exclude archived');
      check(!JSON.stringify(archivedState.coachHome).includes(first.name), 'Mission Control must omit archived tasks, alerts and segments');
      check(!archivedState.weeklyReview.report.clientReviews.some(r => Number(r.clientId) === first.id), 'Saved weekly review must exclude archived');
      check(!archivedState.weeklyReview.report.openingSummary && !archivedState.weeklyReview.report.practicePatterns.length, 'Saved portfolio prose must not include archived clients');
      els.clientStatusButtons.find(b => b.dataset.clientStatus === 'active').click();
      els.clientSearchInput.value = first.name;
      els.clientSearchInput.dispatchEvent(new Event('input'));
      check(getFilteredClients().length === 0, 'Active search must not find archived client');
      els.clientStatusButtons.find(b => b.dataset.clientStatus === 'archived').click();
      check(getFilteredClients()[0]?.id === first.id, 'Archived search must find archived client');
      const archived = await api.getClientDetail({ clientId: first.id });
      check(JSON.stringify(archived.baseline) === JSON.stringify(before.baseline), 'Archiving must preserve dashboard and timestamps');
      check(JSON.stringify(archived.sources) === JSON.stringify(before.sources), 'Archiving must preserve raw notes');
      check(JSON.stringify(archived.undoCounts) === JSON.stringify(before.undoCounts), 'Archiving must preserve undo history');
      await api.setClientArchived({ clientId: first.id, archived: true });
      check((await api.getClientDetail({ clientId: first.id })).client.archivedAt === archived.client.archivedAt, 'Archive must be idempotent');
      await toggleSelectedClientArchive();
      const restored = await api.getClientDetail({ clientId: first.id });
      check(!restored.client.archived && restored.client.archivedAt === null, 'Restore must clear archive state');
      check(JSON.stringify(restored.baseline) === JSON.stringify(before.baseline), 'Restore must not alter last updated or dashboard');
      check((await api.getCoachHome()).stats.clientCount === initial.coachHome.stats.clientCount, 'Restore must reinclude Mission Control');
      check(JSON.stringify((await api.getWeeklyReview()).review) === JSON.stringify(initial.weeklyReview), 'Restore must preserve original weekly review');
      for (const badPayload of [{ clientId: first.id, archived: 'false' }, { clientId: -1, archived: true }, { clientId: 999999, archived: true }]) {
        let rejected = false;
        try { await api.setClientArchived(badPayload); } catch { rejected = true; }
        check(rejected, 'Invalid archive requests must be rejected');
      }
      for (const c of initial.clients) await api.setClientArchived({ clientId: c.id, archived: true });
      await loadClients();
      check((await api.getClients()).length === 0, 'All-archived active list must be empty');
      check((await api.getCoachHome()).stats.clientCount === 0, 'All-archived Mission Control must be empty');
      check((await api.getWeeklyReview()).review.report.clientReviews.length === 0, 'All-archived review must be empty');
      check(els.generateWeeklyReviewBtn.disabled, 'Review generation must be disabled without active clients');
    } finally {
      window.confirm = originalConfirm;
      for (const c of initial.clients) await api.setClientArchived({ clientId: c.id, archived: false });
      state.clientStatusFilter = 'active';
      state.clientSearchQuery = '';
      els.clientSearchInput.value = '';
      els.clientBioFilter.hidden = true;
      els.clientFilterToggle.setAttribute('aria-expanded', 'false');
      await loadClients();
    }
  })()`);
  process.stdout.write('Client archive integration checks passed.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
