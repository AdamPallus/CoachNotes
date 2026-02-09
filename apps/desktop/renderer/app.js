const THEME_STORAGE_KEY = 'coachnotes-theme';

const state = {
  settings: null,
  status: null,
  clients: [],
  tags: [],
  notes: [],
  results: [],
  selectedClientId: null,
  selectedNoteId: null,
  currentNote: null,
  selectedHighlight: null,
  scope: 'all',
  activeQuery: '',
  noteViewMode: 'rendered',
  busyCount: 0,
  busyMessage: 'Working...',
  lastAnswerCopyText: '',
  answerHistory: [],
  answerHistoryIndex: -1,
  answerPanelOpen: false,
  clientsPanelOpen: true,
  themeMode: 'light',
  theme: 'light'
};

const els = {
  appShell: document.getElementById('appShell'),
  themeModeGroup: document.getElementById('themeModeGroup'),
  themeModeLight: document.getElementById('themeModeLight'),
  themeModeDark: document.getElementById('themeModeDark'),
  statusLine: document.getElementById('statusLine'),
  newNoteBtn: document.getElementById('newNoteBtn'),
  moreMenuBtn: document.getElementById('moreMenuBtn'),
  moreMenu: document.getElementById('moreMenu'),
  helpBtn: document.getElementById('helpBtn'),
  checkUpdatesBtn: document.getElementById('checkUpdatesBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  reindexBtn: document.getElementById('reindexBtn'),
  clientsSidebar: document.getElementById('clientsSidebar'),
  clientsHeader: document.getElementById('clientsHeader'),
  clientsHeaderLabel: document.getElementById('clientsHeaderLabel'),
  clientsToggleBtn: document.getElementById('clientsToggleBtn'),
  clientsPanelBody: document.getElementById('clientsPanelBody'),
  allClientsBtn: document.getElementById('allClientsBtn'),
  clientsList: document.getElementById('clientsList'),
  searchInput: document.getElementById('searchInput'),
  scopeSelect: document.getElementById('scopeSelect'),
  searchBtn: document.getElementById('searchBtn'),
  askInput: document.getElementById('askInput'),
  topKInput: document.getElementById('topKInput'),
  relevanceModeSelect: document.getElementById('relevanceModeSelect'),
  askBtn: document.getElementById('askBtn'),
  summarizeBtn: document.getElementById('summarizeBtn'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsList: document.getElementById('resultsList'),
  noteTitle: document.getElementById('noteTitle'),
  noteMeta: document.getElementById('noteMeta'),
  noteBody: document.getElementById('noteBody'),
  renderedViewBtn: document.getElementById('renderedViewBtn'),
  rawViewBtn: document.getElementById('rawViewBtn'),
  revealBtn: document.getElementById('revealBtn'),
  answerHeader: document.getElementById('answerHeader'),
  answerCard: document.getElementById('answerCard'),
  answerToggleBtn: document.getElementById('answerToggleBtn'),
  answerActionGroup: document.getElementById('answerActionGroup'),
  answerPanelBody: document.getElementById('answerPanelBody'),
  answerBackBtn: document.getElementById('answerBackBtn'),
  answerForwardBtn: document.getElementById('answerForwardBtn'),
  answerContext: document.getElementById('answerContext'),
  copyAnswerBtn: document.getElementById('copyAnswerBtn'),
  answerText: document.getElementById('answerText'),
  busyOverlay: document.getElementById('busyOverlay'),
  busyMessage: document.getElementById('busyMessage'),
  busyProgressWrap: document.getElementById('busyProgressWrap'),
  busyProgressBar: document.getElementById('busyProgressBar'),
  busyProgressText: document.getElementById('busyProgressText'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  rootFolderInput: document.getElementById('rootFolderInput'),
  browseBtn: document.getElementById('browseBtn'),
  proxyUrlInput: document.getElementById('proxyUrlInput'),
  tokenInput: document.getElementById('tokenInput'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  helpDialog: document.getElementById('helpDialog'),
  closeHelpBtn: document.getElementById('closeHelpBtn'),
  newNoteDialog: document.getElementById('newNoteDialog'),
  newNoteForm: document.getElementById('newNoteForm'),
  newNoteTitleInput: document.getElementById('newNoteTitleInput'),
  newNoteDateInput: document.getElementById('newNoteDateInput'),
  newNoteClientSelect: document.getElementById('newNoteClientSelect'),
  newNoteTagsInput: document.getElementById('newNoteTagsInput'),
  newNoteBodyInput: document.getElementById('newNoteBodyInput'),
  tagSuggestions: document.getElementById('tagSuggestions'),
  cancelNewNoteBtn: document.getElementById('cancelNewNoteBtn')
};

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function syncThemeModeControls() {
  els.themeModeLight.checked = state.themeMode === 'light';
  els.themeModeDark.checked = state.themeMode === 'dark';
}

function applyTheme(mode, persist = true) {
  const normalizedMode = mode === 'dark' ? 'dark' : 'light';
  const resolvedTheme = normalizedMode;

  state.themeMode = normalizedMode;
  state.theme = resolvedTheme;
  document.documentElement.setAttribute('data-theme', resolvedTheme);

  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, normalizedMode);
  }

  syncThemeModeControls();
}

function initTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const initialMode = stored === 'dark' || stored === 'light' ? stored : getSystemTheme();
  applyTheme(initialMode, false);
}

function getIndexProgress() {
  const total = Math.max(0, Number(state.status?.totalFiles) || 0);
  const processed = Math.max(0, Number(state.status?.filesProcessed) || 0);
  const fallback = Math.max(0, Math.min(1, Number(state.status?.progress) || 0));
  const ratio = total > 0 ? Math.max(0, Math.min(1, processed / total)) : fallback;

  return {
    active: Boolean(state.status?.indexing),
    processed,
    total,
    ratio
  };
}

function getBusyMessage() {
  const progress = getIndexProgress();
  if (!progress.active) {
    return state.busyMessage || 'Working...';
  }

  if (progress.total > 0) {
    return `Reindexing notes... ${progress.processed}/${progress.total}`;
  }

  return 'Reindexing notes...';
}

function updateBusyUi() {
  const busy = state.busyCount > 0;
  const progress = getIndexProgress();
  els.searchBtn.disabled = busy;
  els.askBtn.disabled = busy;
  els.summarizeBtn.disabled = busy;
  els.reindexBtn.disabled = busy;
  els.newNoteBtn.disabled = busy;
  els.moreMenuBtn.disabled = busy;
  els.checkUpdatesBtn.disabled = busy;
  els.helpBtn.disabled = busy;
  els.settingsBtn.disabled = busy;
  els.busyMessage.textContent = getBusyMessage();
  const showProgress = busy && progress.active;
  els.busyProgressWrap.hidden = !showProgress;
  if (showProgress) {
    els.busyProgressBar.style.width = `${Math.round(progress.ratio * 100)}%`;
    els.busyProgressText.textContent = progress.total > 0
      ? `${progress.processed}/${progress.total} notes`
      : `${Math.round(progress.ratio * 100)}%`;
  }
  els.busyOverlay.hidden = !busy;
  if (busy) {
    setMenuOpen(false);
  }
}

function setBusy(on, message = '') {
  if (on) {
    state.busyCount += 1;
    if (message) {
      state.busyMessage = message;
    }
  } else {
    state.busyCount = Math.max(0, state.busyCount - 1);
    if (state.busyCount === 0) {
      state.busyMessage = 'Working...';
    }
  }

  updateBusyUi();
}

function setMenuOpen(open) {
  const next = Boolean(open) && !els.moreMenuBtn.disabled;
  els.moreMenu.hidden = !next;
  els.moreMenuBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
}

function isInteractiveTarget(target) {
  return Boolean(target && target.closest('button, input, select, textarea, a, summary, details'));
}

function setAnswerPanelOpen(open) {
  const next = Boolean(open);
  state.answerPanelOpen = next;
  els.answerActionGroup.hidden = !next;
  els.answerCard.classList.toggle('is-collapsed', !next);
  els.answerToggleBtn.textContent = next ? 'Collapse' : 'Open';
  els.answerToggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  els.answerHeader.setAttribute('aria-expanded', next ? 'true' : 'false');
}

function setClientsPanelOpen(open) {
  const next = Boolean(open);
  state.clientsPanelOpen = next;
  els.clientsPanelBody.hidden = !next;
  els.allClientsBtn.hidden = !next;
  els.appShell.classList.toggle('clients-collapsed', !next);
  els.clientsHeaderLabel.textContent = next ? 'clients' : '👥';
  els.clientsHeaderLabel.title = next ? '' : 'Clients';
  els.clientsToggleBtn.textContent = next ? '◀' : '▶';
  els.clientsToggleBtn.title = next ? 'Hide clients' : 'Show clients';
  els.clientsToggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  els.clientsHeader.setAttribute('aria-expanded', next ? 'true' : 'false');
}

function updateAnswerHistoryControls() {
  const hasHistory = state.answerHistory.length > 0 && state.answerHistoryIndex >= 0;
  els.answerBackBtn.disabled = !hasHistory || state.answerHistoryIndex <= 0;
  els.answerForwardBtn.disabled = !hasHistory || state.answerHistoryIndex >= state.answerHistory.length - 1;
}

function pushAnswerHistory(entry) {
  let nextHistory = state.answerHistory;
  if (state.answerHistoryIndex >= 0 && state.answerHistoryIndex < nextHistory.length - 1) {
    nextHistory = nextHistory.slice(0, state.answerHistoryIndex + 1);
  }

  nextHistory = [...nextHistory, entry];
  const maxEntries = 40;
  if (nextHistory.length > maxEntries) {
    nextHistory = nextHistory.slice(nextHistory.length - maxEntries);
  }

  state.answerHistory = nextHistory;
  state.answerHistoryIndex = state.answerHistory.length - 1;
  updateAnswerHistoryControls();
}

function showHistoryEntry(index) {
  if (index < 0 || index >= state.answerHistory.length) {
    return;
  }

  state.answerHistoryIndex = index;
  const entry = state.answerHistory[index];
  renderAnswer(entry.text, entry.sources || [], entry.citations || [], {
    context: entry.context || '',
    autoOpen: true
  });
}

function updateStatusLine() {
  const parts = [];
  if (state.status?.message) {
    parts.push(state.status.message);
  }

  if (state.status?.indexing) {
    const current = state.status.filesProcessed || 0;
    const total = state.status.totalFiles || 0;
    parts.push(`Progress ${current}/${total}`);
  }

  if (state.status?.lastError) {
    parts.push(`Error: ${state.status.lastError}`);
  }

  if (Number(state.status?.unsupportedCount) > 0) {
    const summary = state.status.unsupportedSummary ? ` (${state.status.unsupportedSummary})` : '';
    parts.push(`Ignored ${state.status.unsupportedCount} unsupported files${summary}`);
  }

  els.statusLine.textContent = parts.length ? parts.join(' • ') : 'Ready.';
}

function renderClients() {
  els.clientsList.innerHTML = '';

  for (const client of state.clients) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'item-btn';
    if (state.selectedClientId === client.id) {
      button.classList.add('active');
    }

    button.innerHTML = `
      <div class="item-title">${escapeHtml(client.name)}</div>
      <div class="item-meta">${client.noteCount} notes</div>
    `;

    button.addEventListener('click', async () => {
      state.selectedClientId = client.id;
      if (state.scope === 'client') {
        await runSearch();
      } else {
        await loadNotes();
      }
      renderClients();
    });

    li.appendChild(button);
    els.clientsList.appendChild(li);
  }
}

function sanitizeHref(href) {
  const raw = String(href || '').trim();
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) {
    return raw;
  }

  return '#';
}

function renderInlineMarkdown(text) {
  const escaped = escapeHtml(text);
  const codeSpans = [];
  let out = escaped.replace(/`([^`]+)`/g, (_full, code) => {
    const token = `@@CODE_${codeSpans.length}@@`;
    codeSpans.push(`<code>${code}</code>`);
    return token;
  });

  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label, href) => {
    const safeHref = sanitizeHref(href);
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');

  for (let i = 0; i < codeSpans.length; i += 1) {
    out = out.replace(`@@CODE_${i}@@`, codeSpans[i]);
  }

  return out;
}

function renderMarkdown(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;

  function closeLists() {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      closeLists();
      if (!inCode) {
        inCode = true;
        html.push('<pre><code>');
      } else {
        inCode = false;
        html.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (!line.trim()) {
      closeLists();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s+(.+)$/);
    if (quote) {
      closeLists();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeLists();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeLists();
  if (inCode) {
    html.push('</code></pre>');
  }

  return html.join('');
}

function parseCitationIds(answerText, citations) {
  const ids = [];
  const seen = new Set();
  const pattern = /\[c:([^\]]+)\]/g;
  let match = pattern.exec(answerText || '');
  while (match) {
    const id = String(match[1] || '').trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    match = pattern.exec(answerText || '');
  }

  for (const citation of citations || []) {
    const id = String(citation || '').trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

function buildAnswerView(answerText, sources, citations) {
  const sourceByChunk = new Map();
  const aliasToChunkId = new Map();

  function registerAlias(alias, canonicalId) {
    const key = String(alias || '').trim().toLowerCase();
    if (!key || aliasToChunkId.has(key)) {
      return;
    }

    aliasToChunkId.set(key, canonicalId);
  }

  for (const source of sources || []) {
    const canonicalId = String(source.chunkId || '').trim();
    if (!canonicalId) {
      continue;
    }

    sourceByChunk.set(canonicalId, source);
    registerAlias(canonicalId, canonicalId);

    const noteId = Number(source.noteId);
    if (Number.isFinite(noteId)) {
      const noteKey = String(noteId);
      registerAlias(noteKey, canonicalId);
      registerAlias(`note_${noteKey}`, canonicalId);
      registerAlias(`${noteKey}_chunk_0`, canonicalId);
    }

    const fromChunkPattern = canonicalId.match(/^(\d+)_chunk_\d+$/);
    if (fromChunkPattern) {
      registerAlias(fromChunkPattern[1], canonicalId);
      registerAlias(`note_${fromChunkPattern[1]}`, canonicalId);
    }
  }

  function resolveCitationId(rawId) {
    const direct = String(rawId || '').trim();
    if (!direct) {
      return null;
    }

    if (sourceByChunk.has(direct)) {
      return direct;
    }

    return aliasToChunkId.get(direct.toLowerCase()) || null;
  }

  const referencedIds = [];
  const seenReferenced = new Set();
  for (const rawId of parseCitationIds(answerText, citations)) {
    const resolved = resolveCitationId(rawId);
    if (!resolved || seenReferenced.has(resolved)) {
      continue;
    }

    seenReferenced.add(resolved);
    referencedIds.push(resolved);
  }

  const orderedSources = referencedIds.map((id, idx) => ({
    ...sourceByChunk.get(id),
    citationId: id,
    citationNumber: idx + 1
  }));

  for (const source of sources || []) {
    if (!referencedIds.includes(String(source.chunkId))) {
      orderedSources.push({
        ...source,
        citationId: source.chunkId,
        citationNumber: null
      });
    }
  }

  const numberById = new Map(
    orderedSources
      .filter((source) => Number.isInteger(source.citationNumber))
      .map((source) => [String(source.citationId), source.citationNumber])
  );

  const html = escapeHtml(answerText || '').replace(/\[c:([^\]]+)\]/g, (_full, rawId) => {
    const id = resolveCitationId(rawId);
    const number = id ? numberById.get(id) : null;
    if (!number) {
      return `<span class="citation-missing">[c:${escapeHtml(String(rawId || '').trim())}]</span>`;
    }

    return `<button class="citation-chip" data-citation-id="${escapeHtml(id)}">[${number}]</button>`;
  });

  const copyText = String(answerText || '').replace(/\[c:([^\]]+)\]/g, (_full, rawId) => {
    const id = resolveCitationId(rawId);
    const number = id ? numberById.get(id) : null;
    return number ? `[${number}]` : `[c:${String(rawId || '').trim()}]`;
  });

  return {
    html,
    orderedSources,
    copyText
  };
}

async function openSource(source) {
  state.selectedHighlight = {
    start: source.startOffset,
    end: source.endOffset
  };

  if (state.noteViewMode === 'rendered') {
    setNoteViewMode('raw');
  }

  await openNote(source.noteId);
  els.noteTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAnswer(text, sources = [], citations = [], options = {}) {
  const context = String(options?.context || '').trim();
  const autoOpen = Boolean(options?.autoOpen);
  if (options?.addToHistory) {
    pushAnswerHistory({
      text: String(text || ''),
      sources: [...(sources || [])],
      citations: [...(citations || [])],
      context
    });
  }

  els.answerContext.textContent = context;
  els.answerContext.hidden = !context;

  if (!String(text || '').trim() && !(sources || []).length) {
    state.lastAnswerCopyText = '';
    els.copyAnswerBtn.disabled = true;
    els.answerText.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-visual" aria-hidden="true"></div>
          <h3>Ask a Question</h3>
          <p>Ask about your notes to get a grounded answer with citations you can open directly.</p>
        </div>
      </div>
    `;
    updateAnswerHistoryControls();
    return;
  }

  if (autoOpen) {
    setAnswerPanelOpen(true);
  }

  const view = buildAnswerView(text, sources, citations);
  state.lastAnswerCopyText = view.copyText || '';
  els.copyAnswerBtn.disabled = !state.lastAnswerCopyText;
  els.answerText.innerHTML = view.html;

  for (const chip of els.answerText.querySelectorAll('.citation-chip')) {
    chip.addEventListener('click', async () => {
      const id = chip.getAttribute('data-citation-id');
      const source = view.orderedSources.find((entry) => String(entry.citationId) === String(id));
      if (source) {
        await openSource(source);
      }
    });
  }

  updateAnswerHistoryControls();
}

function renderResults() {
  els.resultsList.innerHTML = '';
  const showingResults = Boolean(state.activeQuery.trim());
  els.resultsTitle.textContent = showingResults ? `Search Results (${state.results.length})` : `Notes (${state.notes.length})`;

  const list = showingResults ? state.results : state.notes;

  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'item-btn';
    button.style.animationDelay = `${Math.min(index * 35, 280)}ms`;

    const clientText = (row.clientNames || row.clients || []).join(', ') || 'Unassigned client';
    const noteId = row.noteId || row.id;
    button.dataset.noteId = String(noteId);

    button.innerHTML = `
      <div class="item-title">${escapeHtml(row.title || 'Untitled')}</div>
      <div class="item-meta">${escapeHtml(clientText)}${row.date ? ' • ' + escapeHtml(row.date) : ''}</div>
      ${row.snippet ? `<div class="item-snippet">${escapeHtml(row.snippet)}</div>` : ''}
    `;

    button.addEventListener('click', async () => {
      state.selectedHighlight = row.startOffset !== undefined ? {
        start: row.startOffset,
        end: row.endOffset
      } : null;
      await openNote(noteId);
    });

    li.appendChild(button);
    els.resultsList.appendChild(li);
  }

  updateActiveResultSelection();
}

function updateActiveResultSelection() {
  const selected = state.selectedNoteId == null ? null : String(state.selectedNoteId);
  for (const button of els.resultsList.querySelectorAll('.item-btn')) {
    const isActive = selected !== null && button.dataset.noteId === selected;
    button.classList.toggle('active', isActive);
  }
}

function setNoteViewMode(mode) {
  state.noteViewMode = mode === 'raw' ? 'raw' : 'rendered';
  els.rawViewBtn.classList.toggle('active', state.noteViewMode === 'raw');
  els.renderedViewBtn.classList.toggle('active', state.noteViewMode === 'rendered');
  renderNote(state.currentNote);
}

function renderNote(note) {
  state.currentNote = note;

  if (!note) {
    els.noteTitle.textContent = 'Ready';
    els.noteMeta.textContent = 'Select a note or run a search to begin.';
    els.noteBody.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-visual" aria-hidden="true"></div>
          <h3>Welcome to CoachNotes</h3>
          <p>Select a client on the left, or search across all notes above. Use Ask to get grounded answers with clickable citations.</p>
        </div>
      </div>
    `;
    els.revealBtn.disabled = true;
    return;
  }

  els.noteTitle.textContent = note.title || 'Untitled';
  els.noteMeta.textContent = [
    note.date || 'Unknown date',
    (note.clients || []).join(', ') || 'Unassigned client',
    note.path
  ].join(' • ');

  const highlight = state.selectedHighlight;
  const text = String(note.text || '');
  if (state.noteViewMode === 'rendered') {
    els.noteBody.classList.remove('note-body-raw');
    els.noteBody.classList.add('note-body-rendered');
    els.noteBody.innerHTML = renderMarkdown(text);
  } else {
    els.noteBody.classList.add('note-body-raw');
    els.noteBody.classList.remove('note-body-rendered');
    if (highlight && Number.isInteger(highlight.start) && Number.isInteger(highlight.end) && highlight.end > highlight.start) {
      const start = Math.max(0, Math.min(highlight.start, text.length));
      const end = Math.max(start, Math.min(highlight.end, text.length));
      const before = escapeHtml(text.slice(0, start));
      const target = escapeHtml(text.slice(start, end));
      const after = escapeHtml(text.slice(end));
      els.noteBody.innerHTML = `${before}<mark>${target}</mark>${after}`;
    } else {
      els.noteBody.textContent = text;
    }
  }

  els.revealBtn.disabled = false;
}

async function loadClients() {
  state.clients = await window.coachNotes.getClients();
  renderClients();
}

function parseTagInput(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function renderTagSuggestions() {
  els.tagSuggestions.innerHTML = '';
  for (const tag of state.tags) {
    const option = document.createElement('option');
    option.value = tag.name;
    els.tagSuggestions.appendChild(option);
  }
}

function renderNewNoteClientOptions() {
  els.newNoteClientSelect.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'No client folder (root)';
  els.newNoteClientSelect.appendChild(emptyOption);

  for (const client of state.clients) {
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    els.newNoteClientSelect.appendChild(option);
  }
}

async function loadTags() {
  state.tags = await window.coachNotes.getTags();
  renderTagSuggestions();
}

async function loadNotes() {
  const filters = {};
  if (state.selectedClientId) {
    filters.clientId = state.selectedClientId;
  }

  state.notes = await window.coachNotes.getNotes(filters);
  state.activeQuery = '';
  state.results = [];
  renderResults();
}

async function openNote(noteId) {
  const note = await window.coachNotes.getNote(noteId);
  state.selectedNoteId = noteId;
  updateActiveResultSelection();
  renderNote(note);
}

async function runSearch() {
  const query = els.searchInput.value.trim();
  state.scope = els.scopeSelect.value;

  if (!query) {
    await loadNotes();
    return;
  }

  setBusy(true, 'Searching notes...');
  try {
    state.results = await window.coachNotes.search({
      query,
      scope: state.scope,
      clientId: state.scope === 'client' ? state.selectedClientId : null,
      limit: 30,
      relevanceMode: els.relevanceModeSelect.value
    });
    state.activeQuery = query;
    renderResults();
    if (state.results[0]) {
      state.selectedHighlight = {
        start: state.results[0].startOffset,
        end: state.results[0].endOffset
      };
      await openNote(state.results[0].noteId);
    }
  } catch (error) {
    renderAnswer(`Search failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function runAsk() {
  const question = els.askInput.value.trim();
  if (!question) {
    renderAnswer('Please enter a question first.');
    return;
  }

  setBusy(true, 'Thinking...');
  try {
    const result = await window.coachNotes.ask({
      question,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      topK: Number(els.topKInput.value) || 8,
      relevanceMode: els.relevanceModeSelect.value
    });

    renderAnswer(result.answer, result.sources || [], result.citations || [], {
      context: `Question: ${question}`,
      addToHistory: true,
      autoOpen: true
    });
  } catch (error) {
    renderAnswer(`Answer failed: ${error.message}`, [], [], {
      context: `Question: ${question}`,
      addToHistory: true,
      autoOpen: true
    });
  } finally {
    setBusy(false);
  }
}

async function runSummarize() {
  const query = els.searchInput.value.trim() || els.askInput.value.trim();
  if (!query) {
    renderAnswer('Enter search text or question first.');
    return;
  }

  setBusy(true, 'Summarizing sources...');
  try {
    const result = await window.coachNotes.summarize({
      query,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      topK: Number(els.topKInput.value) || 8,
      relevanceMode: els.relevanceModeSelect.value
    });

    renderAnswer(result.summary || '', result.sources || [], result.citations || [], {
      context: `Summary Query: ${query}`,
      addToHistory: true,
      autoOpen: true
    });
  } catch (error) {
    renderAnswer(`Summarize failed: ${error.message}`, [], [], {
      context: `Summary Query: ${query}`,
      addToHistory: true,
      autoOpen: true
    });
  } finally {
    setBusy(false);
  }
}

function openSettings() {
  els.rootFolderInput.value = state.settings?.rootFolder || '';
  els.proxyUrlInput.value = state.settings?.proxyBaseUrl || '';
  els.tokenInput.value = state.settings?.inviteToken || '';
  els.settingsDialog.showModal();
}

function openHelpDialog() {
  els.helpDialog.showModal();
}

function openNewNoteDialog() {
  const now = new Date().toISOString().slice(0, 10);
  renderNewNoteClientOptions();
  els.newNoteTitleInput.value = '';
  els.newNoteDateInput.value = now;
  els.newNoteBodyInput.value = '';
  els.newNoteTagsInput.value = '';

  const selectedClient = state.clients.find((client) => client.id === state.selectedClientId);
  els.newNoteClientSelect.value = selectedClient?.name || '';

  els.newNoteDialog.showModal();
  els.newNoteTitleInput.focus();
}

async function createNewNote(event) {
  event.preventDefault();
  const title = els.newNoteTitleInput.value.trim();
  if (!title) {
    renderAnswer('Title is required to create a note.');
    return;
  }

  const payload = {
    title,
    date: els.newNoteDateInput.value,
    clientName: els.newNoteClientSelect.value,
    tags: parseTagInput(els.newNoteTagsInput.value),
    body: els.newNoteBodyInput.value
  };

  setBusy(true, 'Creating new note...');
  try {
    const created = await window.coachNotes.createNote(payload);
    await loadClients();
    await loadTags();
    await loadNotes();
    els.newNoteDialog.close();
    if (created.noteId) {
      state.selectedHighlight = null;
      await openNote(created.noteId);
    }
    renderAnswer(`Created note: ${created.title}`);
  } catch (error) {
    renderAnswer(`Create note failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function handleCheckForUpdates() {
  setBusy(true, 'Checking for updates...');
  let result = null;
  let failedMessage = '';
  try {
    result = await window.coachNotes.checkForUpdates();
  } catch (error) {
    failedMessage = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
  }

  if (failedMessage) {
    window.alert(`Update check failed.\n\n${failedMessage}`);
    renderAnswer(`Update check failed: ${failedMessage}`);
    return;
  }

  if (!result) {
    return;
  }

  if (result.updateAvailable) {
    const summary = `Update available: v${result.latestVersion} (current v${result.currentVersion}).`;
    renderAnswer(summary);
    const shouldOpen = window.confirm(`${summary}\n\nOpen the release page now?`);
    if (shouldOpen) {
      await window.coachNotes.openExternal(result.releaseUrl || result.releasesUrl);
    }
    return;
  }

  const summary = result.currentVersion
    ? `You're up to date.\n\nCurrent version: v${result.currentVersion}`
    : "You're up to date.";
  window.alert(summary);
}

async function copyAnswerToClipboard() {
  const text = String(state.lastAnswerCopyText || '').trim();
  if (!text) {
    renderAnswer('No answer available to copy.');
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    els.copyAnswerBtn.textContent = 'Copied';
    setTimeout(() => {
      els.copyAnswerBtn.textContent = 'Copy answer';
    }, 1200);
  } catch (error) {
    renderAnswer(`Copy failed: ${error.message}`);
  }
}

async function saveSettings(event) {
  event.preventDefault();

  if (els.settingsDialog.open) {
    els.settingsDialog.close();
  }
  setBusy(true, 'Reindexing notes...');
  try {
    state.settings = await window.coachNotes.saveSettings({
      rootFolder: els.rootFolderInput.value.trim(),
      proxyBaseUrl: els.proxyUrlInput.value.trim(),
      inviteToken: els.tokenInput.value,
      runIndexAfterSave: true
    });

    state.selectedClientId = null;
    await loadClients();
    await loadTags();
    await loadNotes();
  } catch (error) {
    renderAnswer(`Saving settings failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function init() {
  initTheme();
  state.settings = await window.coachNotes.getSettings();
  state.status = state.settings.status || {};
  updateBusyUi();
  updateStatusLine();

  window.coachNotes.onStatus((next) => {
    state.status = next;
    updateStatusLine();
    updateBusyUi();
  });

  await loadClients();
  await loadTags();
  await loadNotes();
  setNoteViewMode('rendered');
  renderNote(null);
  renderAnswer('Run Ask or Summarize to generate grounded output with citations.');
  setAnswerPanelOpen(false);
  setClientsPanelOpen(true);

  els.newNoteBtn.addEventListener('click', openNewNoteDialog);
  els.themeModeGroup.addEventListener('change', (event) => {
    const target = event.target;
    if (!target || target.name !== 'themeMode') {
      return;
    }

    applyTheme(target.value, true);
  });
  setMenuOpen(false);
  els.moreMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenuOpen(els.moreMenu.hidden);
  });
  document.addEventListener('click', (event) => {
    if (els.moreMenu.hidden) {
      return;
    }

    if (!els.moreMenu.contains(event.target) && event.target !== els.moreMenuBtn) {
      setMenuOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuOpen(false);
    }
  });

  els.helpBtn.addEventListener('click', () => {
    setMenuOpen(false);
    openHelpDialog();
  });
  els.checkUpdatesBtn.addEventListener('click', async () => {
    setMenuOpen(false);
    await handleCheckForUpdates();
  });
  els.settingsBtn.addEventListener('click', () => {
    setMenuOpen(false);
    openSettings();
  });
  els.reindexBtn.addEventListener('click', async () => {
    setMenuOpen(false);
    if (els.settingsDialog.open) {
      els.settingsDialog.close();
    }
    setBusy(true, 'Rebuilding index...');
    try {
      await window.coachNotes.reindex();
      await loadClients();
      await loadTags();
      await loadNotes();
    } finally {
      setBusy(false);
    }
  });

  els.allClientsBtn.addEventListener('click', async () => {
    state.selectedClientId = null;
    renderClients();
    if (els.scopeSelect.value === 'client') {
      await runSearch();
    } else {
      await loadNotes();
    }
  });

  els.scopeSelect.addEventListener('change', async () => {
    state.scope = els.scopeSelect.value;
    if (state.activeQuery) {
      await runSearch();
    }
  });

  els.searchBtn.addEventListener('click', runSearch);
  els.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      runSearch();
    }
  });

  els.askBtn.addEventListener('click', runAsk);
  els.askInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      runAsk();
    }
  });

  els.summarizeBtn.addEventListener('click', runSummarize);
  els.answerToggleBtn.addEventListener('click', () => {
    setAnswerPanelOpen(!state.answerPanelOpen);
  });
  els.answerHeader.addEventListener('click', (event) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    setAnswerPanelOpen(!state.answerPanelOpen);
  });
  els.answerHeader.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setAnswerPanelOpen(!state.answerPanelOpen);
    }
  });
  els.answerBackBtn.addEventListener('click', () => {
    showHistoryEntry(state.answerHistoryIndex - 1);
  });
  els.answerForwardBtn.addEventListener('click', () => {
    showHistoryEntry(state.answerHistoryIndex + 1);
  });
  els.copyAnswerBtn.addEventListener('click', copyAnswerToClipboard);

  els.revealBtn.addEventListener('click', async () => {
    if (state.selectedNoteId) {
      await window.coachNotes.revealInFinder(state.selectedNoteId);
    }
  });

  els.clientsHeader.addEventListener('click', (event) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    setClientsPanelOpen(!state.clientsPanelOpen);
  });
  els.clientsHeader.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setClientsPanelOpen(!state.clientsPanelOpen);
    }
  });
  els.clientsToggleBtn.addEventListener('click', () => {
    setClientsPanelOpen(!state.clientsPanelOpen);
  });
  els.clientsSidebar.addEventListener('click', (event) => {
    if (state.clientsPanelOpen || isInteractiveTarget(event.target)) {
      return;
    }

    setClientsPanelOpen(true);
  });

  els.renderedViewBtn.addEventListener('click', () => {
    setNoteViewMode('rendered');
  });

  els.rawViewBtn.addEventListener('click', () => {
    setNoteViewMode('raw');
  });

  els.browseBtn.addEventListener('click', async () => {
    const picked = await window.coachNotes.selectRootFolder();
    if (picked) {
      els.rootFolderInput.value = picked;
      state.settings = {
        ...(state.settings || {}),
        rootFolder: picked
      };
      renderAnswer('Root folder selected. Click Save & Reindex to apply.');
    }
  });

  els.settingsForm.addEventListener('submit', saveSettings);
  els.cancelSettingsBtn.addEventListener('click', () => {
    els.settingsDialog.close();
  });
  els.closeHelpBtn.addEventListener('click', () => {
    els.helpDialog.close();
  });
  els.newNoteForm.addEventListener('submit', createNewNote);
  els.cancelNewNoteBtn.addEventListener('click', () => {
    els.newNoteDialog.close();
  });
}

init().catch((error) => {
  renderAnswer(`Initialization failed: ${error.message}`);
});
