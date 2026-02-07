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
  busyMessage: 'Working...'
};

const els = {
  statusLine: document.getElementById('statusLine'),
  newNoteBtn: document.getElementById('newNoteBtn'),
  checkUpdatesBtn: document.getElementById('checkUpdatesBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  reindexBtn: document.getElementById('reindexBtn'),
  allClientsBtn: document.getElementById('allClientsBtn'),
  clientsList: document.getElementById('clientsList'),
  searchInput: document.getElementById('searchInput'),
  scopeSelect: document.getElementById('scopeSelect'),
  searchBtn: document.getElementById('searchBtn'),
  askInput: document.getElementById('askInput'),
  topKInput: document.getElementById('topKInput'),
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
  answerText: document.getElementById('answerText'),
  sourcesList: document.getElementById('sourcesList'),
  busyOverlay: document.getElementById('busyOverlay'),
  busyMessage: document.getElementById('busyMessage'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  rootFolderInput: document.getElementById('rootFolderInput'),
  browseBtn: document.getElementById('browseBtn'),
  proxyUrlInput: document.getElementById('proxyUrlInput'),
  tokenInput: document.getElementById('tokenInput'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
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

function updateBusyUi() {
  const busy = state.busyCount > 0;
  els.searchBtn.disabled = busy;
  els.askBtn.disabled = busy;
  els.summarizeBtn.disabled = busy;
  els.reindexBtn.disabled = busy;
  els.newNoteBtn.disabled = busy;
  els.checkUpdatesBtn.disabled = busy;
  els.settingsBtn.disabled = busy;
  els.busyMessage.textContent = state.busyMessage || 'Working...';
  els.busyOverlay.hidden = !busy;
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
  const sourceByChunk = new Map((sources || []).map((source) => [String(source.chunkId), source]));
  const referencedIds = parseCitationIds(answerText, citations).filter((id) => sourceByChunk.has(id));
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
    const id = String(rawId || '').trim();
    const number = numberById.get(id);
    if (!number) {
      return `<span class="citation-missing">[c:${escapeHtml(id)}]</span>`;
    }

    return `<button class="citation-chip" data-citation-id="${escapeHtml(id)}">[${number}]</button>`;
  });

  return {
    html,
    orderedSources
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
}

function renderAnswer(text, sources = [], citations = []) {
  const view = buildAnswerView(text, sources, citations);
  els.answerText.innerHTML = view.html;
  els.sourcesList.innerHTML = '';

  for (const chip of els.answerText.querySelectorAll('.citation-chip')) {
    chip.addEventListener('click', async () => {
      const id = chip.getAttribute('data-citation-id');
      const source = view.orderedSources.find((entry) => String(entry.citationId) === String(id));
      if (source) {
        await openSource(source);
      }
    });
  }

  if (!view.orderedSources.length) {
    return;
  }

  for (const source of view.orderedSources) {
    const item = document.createElement('button');
    item.className = 'source-item item-btn';
    const label = source.citationNumber ? `[${source.citationNumber}] ` : '';
    item.innerHTML = `
      <div class="item-title">${label}${escapeHtml(source.title || 'Untitled')}</div>
      <div class="item-meta">${escapeHtml((source.clientNames || []).join(', ') || 'Unknown client')} ${source.date ? '• ' + escapeHtml(source.date) : ''}</div>
      <div class="item-snippet">${escapeHtml(source.snippet || '')}</div>
    `;

    item.addEventListener('click', async () => {
      await openSource(source);
    });

    els.sourcesList.appendChild(item);
  }
}

function renderResults() {
  els.resultsList.innerHTML = '';
  const showingResults = Boolean(state.activeQuery.trim());
  els.resultsTitle.textContent = showingResults ? `Search Results (${state.results.length})` : `Notes (${state.notes.length})`;

  const list = showingResults ? state.results : state.notes;

  for (const row of list) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'item-btn';
    if (state.selectedNoteId === row.noteId || state.selectedNoteId === row.id) {
      button.classList.add('active');
    }

    const clientText = (row.clientNames || row.clients || []).join(', ') || 'Unassigned client';
    const noteId = row.noteId || row.id;

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
    els.noteTitle.textContent = 'No note selected';
    els.noteMeta.textContent = '';
    els.noteBody.innerHTML = '';
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
  renderResults();
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
      limit: 30
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
      topK: Number(els.topKInput.value) || 8
    });

    renderAnswer(result.answer, result.sources || [], result.citations || []);
  } catch (error) {
    renderAnswer(`Answer failed: ${error.message}`);
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
      topK: Number(els.topKInput.value) || 8
    });

    renderAnswer(result.summary || '', result.sources || [], result.citations || []);
  } catch (error) {
    renderAnswer(`Summarize failed: ${error.message}`);
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
  try {
    const result = await window.coachNotes.checkForUpdates();
    if (result.updateAvailable) {
      const summary = `Update available: v${result.latestVersion} (current v${result.currentVersion}).`;
      renderAnswer(summary);
      const shouldOpen = window.confirm(`${summary}\n\nOpen the release page now?`);
      if (shouldOpen) {
        await window.coachNotes.openExternal(result.releaseUrl || result.releasesUrl);
      }
    } else {
      const latest = result.latestVersion ? ` Latest release: v${result.latestVersion}.` : '';
      renderAnswer(`${result.message}${latest}`);
    }
  } catch (error) {
    renderAnswer(`Update check failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function saveSettings(event) {
  event.preventDefault();

  setBusy(true, 'Saving settings and indexing...');
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
    els.settingsDialog.close();
  } catch (error) {
    renderAnswer(`Saving settings failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function init() {
  state.settings = await window.coachNotes.getSettings();
  state.status = state.settings.status || {};
  updateBusyUi();
  updateStatusLine();

  window.coachNotes.onStatus((next) => {
    state.status = next;
    updateStatusLine();
  });

  await loadClients();
  await loadTags();
  await loadNotes();
  setNoteViewMode('rendered');
  renderNote(null);
  renderAnswer('Run Ask or Summarize to generate grounded output with citations.');

  els.newNoteBtn.addEventListener('click', openNewNoteDialog);
  els.checkUpdatesBtn.addEventListener('click', handleCheckForUpdates);
  els.settingsBtn.addEventListener('click', openSettings);
  els.reindexBtn.addEventListener('click', async () => {
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

  els.revealBtn.addEventListener('click', async () => {
    if (state.selectedNoteId) {
      await window.coachNotes.revealInFinder(state.selectedNoteId);
    }
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
      state.settings.rootFolder = picked;
      state.selectedClientId = null;
      await loadClients();
      await loadTags();
      await loadNotes();
    }
  });

  els.settingsForm.addEventListener('submit', saveSettings);
  els.cancelSettingsBtn.addEventListener('click', () => {
    els.settingsDialog.close();
  });
  els.newNoteForm.addEventListener('submit', createNewNote);
  els.cancelNewNoteBtn.addEventListener('click', () => {
    els.newNoteDialog.close();
  });
}

init().catch((error) => {
  renderAnswer(`Initialization failed: ${error.message}`);
});
