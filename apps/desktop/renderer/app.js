const state = {
  settings: null,
  status: null,
  clients: [],
  notes: [],
  results: [],
  selectedClientId: null,
  selectedNoteId: null,
  selectedHighlight: null,
  scope: 'all',
  activeQuery: ''
};

const els = {
  statusLine: document.getElementById('statusLine'),
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
  revealBtn: document.getElementById('revealBtn'),
  answerText: document.getElementById('answerText'),
  sourcesList: document.getElementById('sourcesList'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  rootFolderInput: document.getElementById('rootFolderInput'),
  browseBtn: document.getElementById('browseBtn'),
  proxyUrlInput: document.getElementById('proxyUrlInput'),
  tokenInput: document.getElementById('tokenInput'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn')
};

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setBusy(on) {
  els.searchBtn.disabled = on;
  els.askBtn.disabled = on;
  els.summarizeBtn.disabled = on;
  els.reindexBtn.disabled = on;
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

function renderAnswer(text, sources = []) {
  els.answerText.textContent = text || '';
  els.sourcesList.innerHTML = '';

  if (!sources.length) {
    return;
  }

  for (const source of sources) {
    const item = document.createElement('button');
    item.className = 'source-item item-btn';
    item.innerHTML = `
      <div class="item-title">${escapeHtml(source.title || 'Untitled')}</div>
      <div class="item-meta">${escapeHtml((source.clientNames || []).join(', ') || 'Unknown client')} ${source.date ? '• ' + escapeHtml(source.date) : ''}</div>
      <div class="item-snippet">${escapeHtml(source.snippet || '')}</div>
    `;

    item.addEventListener('click', async () => {
      state.selectedHighlight = {
        start: source.startOffset,
        end: source.endOffset
      };
      await openNote(source.noteId);
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

function renderNote(note) {
  if (!note) {
    els.noteTitle.textContent = 'No note selected';
    els.noteMeta.textContent = '';
    els.noteBody.textContent = '';
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

  els.revealBtn.disabled = false;
}

async function loadClients() {
  state.clients = await window.coachNotes.getClients();
  renderClients();
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

  setBusy(true);
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

  setBusy(true);
  try {
    const result = await window.coachNotes.ask({
      question,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      topK: Number(els.topKInput.value) || 8
    });

    renderAnswer(result.answer, result.sources || []);
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

  setBusy(true);
  try {
    const result = await window.coachNotes.summarize({
      query,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      topK: Number(els.topKInput.value) || 8
    });

    renderAnswer(result.summary || '', []);
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

async function saveSettings(event) {
  event.preventDefault();

  setBusy(true);
  try {
    state.settings = await window.coachNotes.saveSettings({
      rootFolder: els.rootFolderInput.value.trim(),
      proxyBaseUrl: els.proxyUrlInput.value.trim(),
      inviteToken: els.tokenInput.value,
      runIndexAfterSave: true
    });

    state.selectedClientId = null;
    await loadClients();
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
  updateStatusLine();

  window.coachNotes.onStatus((next) => {
    state.status = next;
    updateStatusLine();
  });

  await loadClients();
  await loadNotes();
  renderNote(null);
  renderAnswer('Run Ask or Summarize to generate grounded output with citations.');

  els.settingsBtn.addEventListener('click', openSettings);
  els.reindexBtn.addEventListener('click', async () => {
    setBusy(true);
    try {
      await window.coachNotes.reindex();
      await loadClients();
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

  els.browseBtn.addEventListener('click', async () => {
    const picked = await window.coachNotes.selectRootFolder();
    if (picked) {
      els.rootFolderInput.value = picked;
      state.settings.rootFolder = picked;
      state.selectedClientId = null;
      await loadClients();
      await loadNotes();
    }
  });

  els.settingsForm.addEventListener('submit', saveSettings);
  els.cancelSettingsBtn.addEventListener('click', () => {
    els.settingsDialog.close();
  });
}

init().catch((error) => {
  renderAnswer(`Initialization failed: ${error.message}`);
});
