const THEME_STORAGE_KEY = 'coachnotes-theme';

const state = {
  settings: null,
  status: null,
  clients: [],
  clientTagFilters: [],
  tags: [],
  notes: [],
  results: [],
  selectedClientId: null,
  selectedNoteId: null,
  clientProfile: null,
  clientProfileClientId: null,
  currentNote: null,
  selectedHighlight: null,
  scope: 'all',
  activeQuery: '',
  queryMode: 'search',
  noteViewMode: 'rendered',
  busyCount: 0,
  busyMessage: 'Working...',
  lastAnswerCopyText: '',
  activeAnswer: null,
  answerHistory: [],
  answerHistoryIndex: -1,
  answerPanelOpen: false,
  qaContextOpen: true,
  clientsPanelOpen: true,
  pendingAnswerSave: null,
  profileClientTagsDraft: [],
  profileColorValue: '',
  profileSnapshot: '',
  profileDirty: false,
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
  newClientBtn: document.getElementById('newClientBtn'),
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
  clientTagFiltersWrap: document.getElementById('clientTagFiltersWrap'),
  clientTagFilters: document.getElementById('clientTagFilters'),
  clearClientTagFiltersBtn: document.getElementById('clearClientTagFiltersBtn'),
  clientsList: document.getElementById('clientsList'),
  queryModeGroup: document.getElementById('queryModeGroup'),
  modeSearch: document.getElementById('modeSearch'),
  modeAsk: document.getElementById('modeAsk'),
  modeSummarize: document.getElementById('modeSummarize'),
  queryInput: document.getElementById('queryInput'),
  scopeSelect: document.getElementById('scopeSelect'),
  goBtn: document.getElementById('goBtn'),
  depthPresetSelect: document.getElementById('depthPresetSelect'),
  topKInput: document.getElementById('topKInput'),
  relevanceModeSelect: document.getElementById('relevanceModeSelect'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsList: document.getElementById('resultsList'),
  qaContextCard: document.getElementById('qaContextCard'),
  qaContextHeader: document.getElementById('qaContextHeader'),
  qaContextToggleBtn: document.getElementById('qaContextToggleBtn'),
  qaContextBody: document.getElementById('qaContextBody'),
  qaContextClientName: document.getElementById('qaContextClientName'),
  qaContextTags: document.getElementById('qaContextTags'),
  qaContextTopPriorities: document.getElementById('qaContextTopPriorities'),
  qaContextMedical: document.getElementById('qaContextMedical'),
  qaContextAcute: document.getElementById('qaContextAcute'),
  profileClientName: document.getElementById('profileClientName'),
  profileUpdatedAt: document.getElementById('profileUpdatedAt'),
  profileDisabled: document.getElementById('profileDisabled'),
  profileFormWrap: document.getElementById('profileFormWrap'),
  profileTopInput: document.getElementById('profileTopInput'),
  profileTagPicker: document.getElementById('profileTagPicker'),
  profileOpenNewTagBtn: document.getElementById('profileOpenNewTagBtn'),
  profileNewTagRow: document.getElementById('profileNewTagRow'),
  profileNewTagInput: document.getElementById('profileNewTagInput'),
  profileConfirmNewTagBtn: document.getElementById('profileConfirmNewTagBtn'),
  profileCancelNewTagBtn: document.getElementById('profileCancelNewTagBtn'),
  profileClientTagsList: document.getElementById('profileClientTagsList'),
  profileColorPalette: document.getElementById('profileColorPalette'),
  clearProfileColorBtn: document.getElementById('clearProfileColorBtn'),
  profileMedicalInput: document.getElementById('profileMedicalInput'),
  profileAcuteInput: document.getElementById('profileAcuteInput'),
  profileCompletedInput: document.getElementById('profileCompletedInput'),
  profileFutureInput: document.getElementById('profileFutureInput'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  noteTitle: document.getElementById('noteTitle'),
  noteMeta: document.getElementById('noteMeta'),
  noteBody: document.getElementById('noteBody'),
  renderedViewBtn: document.getElementById('renderedViewBtn'),
  rawViewBtn: document.getElementById('rawViewBtn'),
  editNoteBtn: document.getElementById('editNoteBtn'),
  deleteNoteBtn: document.getElementById('deleteNoteBtn'),
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
  saveAnswerBtn: document.getElementById('saveAnswerBtn'),
  answerText: document.getElementById('answerText'),
  toast: document.getElementById('toast'),
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
  newClientDialog: document.getElementById('newClientDialog'),
  newClientForm: document.getElementById('newClientForm'),
  newClientNameInput: document.getElementById('newClientNameInput'),
  cancelNewClientBtn: document.getElementById('cancelNewClientBtn'),
  editNoteDialog: document.getElementById('editNoteDialog'),
  editNoteForm: document.getElementById('editNoteForm'),
  editNoteTitleInput: document.getElementById('editNoteTitleInput'),
  editNoteDateInput: document.getElementById('editNoteDateInput'),
  editNoteClientSelect: document.getElementById('editNoteClientSelect'),
  editNoteTagsInput: document.getElementById('editNoteTagsInput'),
  editNoteBodyInput: document.getElementById('editNoteBodyInput'),
  cancelEditNoteBtn: document.getElementById('cancelEditNoteBtn'),
  clientProfileDialog: document.getElementById('clientProfileDialog'),
  clientProfileForm: document.getElementById('clientProfileForm'),
  cancelProfileBtn: document.getElementById('cancelProfileBtn'),
  tagSuggestions: document.getElementById('tagSuggestions'),
  saveAnswerDialog: document.getElementById('saveAnswerDialog'),
  saveAnswerForm: document.getElementById('saveAnswerForm'),
  saveAnswerClientSelect: document.getElementById('saveAnswerClientSelect'),
  saveAnswerTitleInput: document.getElementById('saveAnswerTitleInput'),
  cancelSaveAnswerBtn: document.getElementById('cancelSaveAnswerBtn'),
  cancelNewNoteBtn: document.getElementById('cancelNewNoteBtn')
};

let toastTimer = null;

function escapeHtml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeTagList(values, maxItems = 40) {
  const source = Array.isArray(values)
    ? values
    : String(values || '').split(',');
  const seen = new Set();
  const rows = [];
  for (const item of source) {
    const trimmed = sanitizeName(item);
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(trimmed);
    if (rows.length >= maxItems) {
      break;
    }
  }

  return rows;
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }

  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const expanded = withHash
      .slice(1)
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
    return `#${expanded}`;
  }

  if (/^#[0-9a-f]{6}$/.test(withHash)) {
    return withHash;
  }

  return '';
}

const PROFILE_COLOR_PRESETS = [
  { value: '#2aa994', label: 'Teal' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#db2777', label: 'Magenta' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#14b8a6', label: 'Aqua' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#64748b', label: 'Slate' }
];

const TAG_CATEGORY_KEYWORDS = {
  medical: [
    'injury', 'injured', 'pain', 'ache', 'rehab', 'recovery', 'medical', 'condition', 'thyroid',
    'diabetes', 'hypertension', 'postpartum', 'surgery', 'medication', 'acute', 'chronic'
  ],
  training: [
    'program', 'training', 'workout', 'strength', 'cardio', 'mobility', 'conditioning',
    'running', 'exercise', 'lift', 'form'
  ],
  goal: [
    'goal', 'milestone', 'target', 'progress', 'weight loss', 'fat loss', 'muscle', 'performance',
    'habit', 'consistency'
  ],
  personal: [
    'family', 'travel', 'sleep', 'stress', 'schedule', 'work', 'life', 'energy', 'motivation',
    'mindset', 'nutrition'
  ],
  admin: [
    'inactive', 'active', 'on hold', 'remote', 'weekly', 'biweekly', 'monthly', 'follow-up',
    'check-in', 'billing', 'subscription', 'admin'
  ]
};

function getTagCategory(tag) {
  const normalized = String(tag || '').trim().toLowerCase();
  if (!normalized) {
    return 'default';
  }

  const categories = ['medical', 'training', 'goal', 'personal', 'admin'];
  for (const category of categories) {
    const keywords = TAG_CATEGORY_KEYWORDS[category] || [];
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return 'default';
}

function createTagPill(tag, options = {}) {
  const {
    button = false,
    removable = false,
    active = false,
    datasetTag = true
  } = options;

  const element = document.createElement(button ? 'button' : 'span');
  const normalized = sanitizeName(tag);
  const category = getTagCategory(normalized);
  element.className = `tag-pill tag-category-${category}`;
  if (button) {
    element.type = 'button';
    element.classList.add('tag-chip');
  }
  if (active) {
    element.classList.add('active');
  }
  if (removable) {
    element.classList.add('profile-tag-chip');
  }
  if (datasetTag) {
    element.dataset.tag = normalized;
  }
  element.textContent = removable ? `${normalized} x` : normalized;
  return element;
}

function renderTagPillsHtml(tags, maxItems = 4) {
  const rows = normalizeTagList(tags || [], maxItems);
  return rows
    .map((tag) => {
      const category = getTagCategory(tag);
      return `<span class="tag-pill tag-category-${escapeHtml(category)}">${escapeHtml(tag)}</span>`;
    })
    .join('');
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

function getQueryModeConfig(mode) {
  if (mode === 'ask') {
    return {
      placeholder: 'Ask a question about your notes...',
      buttonText: 'Ask'
    };
  }

  if (mode === 'summarize') {
    return {
      placeholder: 'Summarize notes about...',
      buttonText: 'Summarize'
    };
  }

  return {
    placeholder: 'Search notes (e.g. knee pain progression)',
    buttonText: 'Search'
  };
}

function syncQueryModeControls() {
  els.modeSearch.checked = state.queryMode === 'search';
  els.modeAsk.checked = state.queryMode === 'ask';
  els.modeSummarize.checked = state.queryMode === 'summarize';
}

function setQueryMode(mode) {
  const normalized = mode === 'ask' || mode === 'summarize' ? mode : 'search';
  state.queryMode = normalized;
  const config = getQueryModeConfig(normalized);
  els.queryInput.placeholder = config.placeholder;
  els.goBtn.textContent = config.buttonText;
  syncQueryModeControls();
}

function normalizeTopK(value) {
  const numeric = Math.round(Number(value) || 8);
  return Math.max(3, Math.min(numeric, 12));
}

function topKFromPreset(preset) {
  if (preset === 'fast') {
    return 5;
  }

  if (preset === 'deep') {
    return 12;
  }

  if (preset === 'standard') {
    return 8;
  }

  return null;
}

function presetFromTopK(topK) {
  if (topK === 5) {
    return 'fast';
  }

  if (topK === 8) {
    return 'standard';
  }

  if (topK === 12) {
    return 'deep';
  }

  return 'custom';
}

function syncDepthPresetFromTopK() {
  const raw = Number(els.topKInput.value);
  if (!Number.isFinite(raw)) {
    els.depthPresetSelect.value = 'custom';
    return;
  }

  const topK = normalizeTopK(raw);
  els.depthPresetSelect.value = presetFromTopK(topK);
}

function applyDepthPreset(preset) {
  const topK = topKFromPreset(preset);
  if (topK === null) {
    syncDepthPresetFromTopK();
    return;
  }

  els.topKInput.value = String(topK);
  syncDepthPresetFromTopK();
}

function isLikelyAcknowledgementFollowup(text) {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '');
  if (!normalized) {
    return false;
  }

  const directMatches = new Set([
    'sure',
    'sure do that',
    'yes',
    'yeah',
    'yep',
    'ok',
    'okay',
    'go ahead',
    'do that',
    'please do that',
    'sounds good',
    'that works',
    'continue',
    'do it'
  ]);

  return directMatches.has(normalized);
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
  els.goBtn.disabled = busy;
  els.reindexBtn.disabled = busy;
  els.newNoteBtn.disabled = busy;
  els.newClientBtn.disabled = busy;
  els.moreMenuBtn.disabled = busy;
  els.checkUpdatesBtn.disabled = busy;
  els.helpBtn.disabled = busy;
  els.settingsBtn.disabled = busy;
  els.saveProfileBtn.disabled = busy || !state.selectedClientId;
  els.profileTopInput.disabled = busy || !state.selectedClientId;
  els.profileTagPicker.disabled = busy || !state.selectedClientId;
  els.profileOpenNewTagBtn.disabled = busy || !state.selectedClientId;
  els.profileNewTagInput.disabled = busy || !state.selectedClientId;
  els.profileConfirmNewTagBtn.disabled = busy || !state.selectedClientId;
  els.profileCancelNewTagBtn.disabled = busy || !state.selectedClientId;
  els.clearProfileColorBtn.disabled = busy || !state.selectedClientId;
  els.profileMedicalInput.disabled = busy || !state.selectedClientId;
  els.profileAcuteInput.disabled = busy || !state.selectedClientId;
  els.profileCompletedInput.disabled = busy || !state.selectedClientId;
  els.profileFutureInput.disabled = busy || !state.selectedClientId;
  els.copyAnswerBtn.disabled = busy || !state.lastAnswerCopyText;
  els.saveAnswerBtn.disabled = busy || !isSavableAnswerEntry(state.activeAnswer);
  if (busy) {
    els.editNoteBtn.disabled = true;
    els.deleteNoteBtn.disabled = true;
  } else if (state.currentNote) {
    els.editNoteBtn.disabled = false;
    els.deleteNoteBtn.disabled = false;
  }
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

  const paletteDisabled = busy || !state.selectedClientId;
  for (const button of els.profileColorPalette.querySelectorAll('button')) {
    button.disabled = paletteDisabled;
  }
}

function showToast(message, kind = 'info') {
  const text = String(message || '').trim();
  if (!text || !els.toast) {
    return;
  }

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  els.toast.textContent = text;
  els.toast.classList.remove('error');
  if (kind === 'error') {
    els.toast.classList.add('error');
  }
  els.toast.hidden = false;
  els.toast.classList.add('is-visible');

  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible');
    els.toast.hidden = true;
    toastTimer = null;
  }, 2600);
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

function setQaContextOpen(open) {
  const next = Boolean(open);
  state.qaContextOpen = next;
  els.qaContextCard.classList.toggle('is-collapsed', !next);
  els.qaContextToggleBtn.textContent = next ? 'Collapse' : 'Open';
  els.qaContextToggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  els.qaContextHeader.setAttribute('aria-expanded', next ? 'true' : 'false');
}

function renderContextList(listEl, values, emptyLabel) {
  listEl.innerHTML = '';
  const rows = normalizeTagList(values || [], 12);
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'qa-context-empty';
    li.textContent = emptyLabel;
    listEl.appendChild(li);
    return;
  }

  for (const value of rows) {
    const li = document.createElement('li');
    li.textContent = value;
    listEl.appendChild(li);
  }
}

function renderClientContextStrip() {
  const scope = els.scopeSelect.value;
  const shouldShow = scope === 'client' && Boolean(state.selectedClientId);
  els.qaContextCard.hidden = !shouldShow;
  if (!shouldShow) {
    return;
  }

  const client = state.clients.find((row) => row.id === state.selectedClientId) || null;
  const profile = state.clientProfileClientId === state.selectedClientId ? state.clientProfile : null;
  const profileTags = profile?.clientTags || client?.profileTags || [];
  const color = normalizeHexColor(profile?.clientColor || client?.color || '');
  const colorDot = color ? `<span class="client-color-dot" style="background:${escapeHtml(color)};border-color:${escapeHtml(color)};"></span>` : '';
  els.qaContextClientName.innerHTML = `${colorDot}${escapeHtml(client?.name || 'Selected client')}`;

  els.qaContextTags.innerHTML = '';
  if (profileTags.length) {
    for (const tag of profileTags) {
      els.qaContextTags.appendChild(createTagPill(tag, { datasetTag: false }));
    }
  } else {
    const empty = document.createElement('span');
    empty.className = 'qa-context-empty';
    empty.textContent = 'No tags yet.';
    els.qaContextTags.appendChild(empty);
  }

  renderContextList(els.qaContextTopPriorities, profile?.topPriorities || [], 'No priorities set.');
  renderContextList(els.qaContextMedical, profile?.ongoingMedicalConsiderations || [], 'No ongoing medical notes.');
  renderContextList(els.qaContextAcute, profile?.acuteInjuries || [], 'No acute injuries listed.');
  setQaContextOpen(state.qaContextOpen);
}

function updateAnswerHistoryControls() {
  const hasHistory = state.answerHistory.length > 0 && state.answerHistoryIndex >= 0;
  els.answerBackBtn.disabled = !hasHistory || state.answerHistoryIndex <= 0;
  els.answerForwardBtn.disabled = !hasHistory || state.answerHistoryIndex >= state.answerHistory.length - 1;
}

function isSavableAnswerEntry(entry) {
  if (!entry) {
    return false;
  }

  if (entry.meta?.error) {
    return false;
  }

  const mode = String(entry.meta?.mode || '');
  if (mode !== 'ask' && mode !== 'summarize') {
    return false;
  }

  return Boolean(String(entry.text || '').trim());
}

function updateAnswerActionButtons() {
  const busy = state.busyCount > 0;
  els.copyAnswerBtn.disabled = busy || !state.lastAnswerCopyText;
  els.saveAnswerBtn.disabled = busy || !isSavableAnswerEntry(state.activeAnswer);
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
    meta: entry.meta || null,
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

  const selectedTagFilters = new Set((state.clientTagFilters || []).map((tag) => String(tag).toLowerCase()));
  const filteredClients = state.clients.filter((client) => {
    if (!selectedTagFilters.size) {
      return true;
    }

    const clientTags = (client.profileTags || []).map((tag) => String(tag).toLowerCase());
    return clientTags.some((tag) => selectedTagFilters.has(tag));
  });

  if (!filteredClients.length) {
    const li = document.createElement('li');
    li.className = 'clients-empty';
    li.textContent = selectedTagFilters.size
      ? 'No clients match selected tags.'
      : 'No clients yet.';
    els.clientsList.appendChild(li);
    return;
  }

  for (const client of filteredClients) {
    const li = document.createElement('li');
    li.className = 'client-row';

    const button = document.createElement('button');
    button.className = 'item-btn client-main-btn';
    if (state.selectedClientId === client.id) {
      button.classList.add('active');
    }

    const color = normalizeHexColor(client.color);
    const tagPills = renderTagPillsHtml(client.profileTags || [], 3);
    button.innerHTML = `
      <div class="client-title-row">
        <span class="client-color-dot" style="${color ? `background:${escapeHtml(color)};border-color:${escapeHtml(color)};` : ''}"></span>
        <span class="item-title">${escapeHtml(client.name)}</span>
      </div>
      <div class="item-meta">${client.noteCount} notes</div>
      ${tagPills ? `<div class="client-tag-row">${tagPills}</div>` : ''}
    `;

    button.addEventListener('click', async () => {
      await selectClient(client.id);
    });

    const profileButton = document.createElement('button');
    profileButton.className = 'btn btn-tiny client-profile-btn';
    profileButton.type = 'button';
    profileButton.textContent = 'Profile';
    profileButton.title = `Open profile for ${client.name}`;
    if (state.selectedClientId === client.id) {
      profileButton.classList.add('active');
    }
    profileButton.addEventListener('click', async () => {
      await selectClient(client.id, { openProfile: true });
    });

    li.appendChild(button);
    li.appendChild(profileButton);
    els.clientsList.appendChild(li);
  }
}

function renderClientTagFilters() {
  const allTags = [...new Set(
    state.clients
      .flatMap((client) => client.profileTags || [])
      .map((tag) => sanitizeName(tag))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const validFilterSet = new Set(allTags.map((tag) => tag.toLowerCase()));
  state.clientTagFilters = (state.clientTagFilters || []).filter((tag) => validFilterSet.has(String(tag).toLowerCase()));

  if (!allTags.length) {
    els.clientTagFiltersWrap.hidden = true;
    els.clientTagFilters.innerHTML = '';
    return;
  }

  els.clientTagFiltersWrap.hidden = false;
  const active = new Set((state.clientTagFilters || []).map((tag) => String(tag).toLowerCase()));
  els.clientTagFilters.innerHTML = '';

  for (const tag of allTags) {
    const button = createTagPill(tag, {
      button: true,
      active: active.has(tag.toLowerCase())
    });
    button.addEventListener('click', () => {
      const key = tag.toLowerCase();
      if (active.has(key)) {
        state.clientTagFilters = (state.clientTagFilters || []).filter((entry) => String(entry).toLowerCase() !== key);
      } else {
        state.clientTagFilters = [...(state.clientTagFilters || []), tag];
      }
      renderClientTagFilters();
      renderClients();
    });
    els.clientTagFilters.appendChild(button);
  }
}

function getKnownClientProfileTags() {
  return [...new Set(
    state.clients
      .flatMap((client) => client.profileTags || [])
      .map((tag) => sanitizeName(tag))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function renderProfileTagPickerOptions() {
  const selected = new Set((state.profileClientTagsDraft || []).map((tag) => String(tag).toLowerCase()));
  const known = getKnownClientProfileTags();
  const nextOptions = ['<option value="" selected>Select tag...</option>', '<option value="__new__">Add tag...</option>'];
  for (const tag of known) {
    if (!selected.has(tag.toLowerCase())) {
      nextOptions.push(`<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`);
    }
  }
  els.profileTagPicker.innerHTML = nextOptions.join('');
  els.profileTagPicker.value = '';
}

function renderProfileClientTagsList() {
  const tags = state.profileClientTagsDraft || [];
  els.profileClientTagsList.innerHTML = '';
  if (!tags.length) {
    els.profileClientTagsList.innerHTML = '<span class="profile-tags-empty">No tags selected.</span>';
    return;
  }

  for (const tag of tags) {
    const chip = createTagPill(tag, { button: true, removable: true });
    chip.title = `Remove tag: ${tag}`;
    els.profileClientTagsList.appendChild(chip);
  }
}

function renderProfileColorPalette() {
  els.profileColorPalette.innerHTML = '';
  const selectedColor = normalizeHexColor(state.profileColorValue);
  for (const preset of PROFILE_COLOR_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-color-swatch';
    button.dataset.color = preset.value;
    button.title = preset.label;
    button.style.background = preset.value;
    button.setAttribute('aria-label', `${preset.label} color`);
    if (selectedColor && selectedColor === preset.value) {
      button.classList.add('active');
    }
    els.profileColorPalette.appendChild(button);
  }
}

function hideProfileNewTagRow() {
  els.profileNewTagRow.hidden = true;
  els.profileNewTagInput.value = '';
}

function showProfileNewTagRow() {
  els.profileNewTagRow.hidden = false;
  els.profileNewTagInput.focus();
  els.profileNewTagInput.select();
}

function submitProfileNewTagFromInput() {
  const created = String(els.profileNewTagInput.value || '').trim();
  const added = addProfileTag(created);
  if (added) {
    hideProfileNewTagRow();
  }
}

function setProfileClientTagsDraft(values) {
  state.profileClientTagsDraft = normalizeTagList(values, 40);
  hideProfileNewTagRow();
  renderProfileTagPickerOptions();
  renderProfileClientTagsList();
}

function addProfileTag(rawValue) {
  const normalized = sanitizeName(rawValue);
  if (!normalized) {
    return false;
  }

  const exists = (state.profileClientTagsDraft || []).some(
    (tag) => String(tag).toLowerCase() === normalized.toLowerCase()
  );
  if (exists) {
    return false;
  }

  state.profileClientTagsDraft = [...(state.profileClientTagsDraft || []), normalized];
  renderProfileTagPickerOptions();
  renderProfileClientTagsList();
  refreshProfileDirtyState();
  return true;
}

function removeProfileTag(rawValue) {
  const key = String(rawValue || '').toLowerCase();
  state.profileClientTagsDraft = (state.profileClientTagsDraft || []).filter(
    (tag) => String(tag).toLowerCase() !== key
  );
  renderProfileTagPickerOptions();
  renderProfileClientTagsList();
  refreshProfileDirtyState();
}

async function selectClient(clientId, options = {}) {
  const openProfile = Boolean(options?.openProfile);
  state.selectedClientId = clientId;

  if (state.scope === 'client') {
    if (state.activeQuery) {
      await runSearch(state.activeQuery);
    } else {
      await loadNotes();
    }
  } else {
    await loadNotes();
  }

  await loadClientProfile();
  renderClients();

  if (openProfile) {
    await openClientProfileDialog({ reload: false });
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
  const pattern = /\[(?:c:)?([^\]]+)\]/gi;
  let match = pattern.exec(answerText || '');
  while (match) {
    const id = String(match[1] || '').trim();
    if (!id) {
      match = pattern.exec(answerText || '');
      continue;
    }

    const isChunkStyle = /^(?:note_)?\d+(?:_chunk_\d+)?$/i.test(id);
    const hasExplicitPrefix = String(match[0] || '').toLowerCase().startsWith('[c:');
    if ((isChunkStyle || hasExplicitPrefix) && !seen.has(id)) {
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

  const html = escapeHtml(answerText || '').replace(/\[(c:)?([^\]]+)\]/gi, (full, prefix, rawId) => {
    const id = resolveCitationId(rawId);
    const number = id ? numberById.get(id) : null;
    if (!number) {
      const raw = String(rawId || '').trim();
      const looksCitationLike = /^(?:note_)?\d+(?:_chunk_\d+)?$/i.test(raw) || Boolean(prefix);
      if (!looksCitationLike) {
        return full;
      }
      return `<span class="citation-missing">[${escapeHtml(raw)}]</span>`;
    }

    return `<button class="citation-chip" data-citation-id="${escapeHtml(id)}">[${number}]</button>`;
  });

  const copyText = String(answerText || '').replace(/\[(c:)?([^\]]+)\]/gi, (full, _prefix, rawId) => {
    const id = resolveCitationId(rawId);
    const number = id ? numberById.get(id) : null;
    if (!number) {
      return full;
    }
    return `[${number}]`;
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
}

function renderAnswer(text, sources = [], citations = [], options = {}) {
  const context = String(options?.context || '').trim();
  const autoOpen = Boolean(options?.autoOpen);
  const meta = options?.meta ? { ...options.meta } : null;
  if (options?.addToHistory) {
    pushAnswerHistory({
      text: String(text || ''),
      sources: [...(sources || [])],
      citations: [...(citations || [])],
      context,
      meta
    });
  }

  els.answerContext.textContent = context;
  els.answerContext.hidden = !context;
  state.activeAnswer = null;

  if (!String(text || '').trim() && !(sources || []).length) {
    state.lastAnswerCopyText = '';
    els.answerText.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-visual" aria-hidden="true"></div>
          <h3>Ask a Question</h3>
          <p>Ask about your notes to get a grounded answer with citations you can open directly.</p>
        </div>
      </div>
    `;
    updateAnswerActionButtons();
    updateAnswerHistoryControls();
    return;
  }

  if (autoOpen) {
    setAnswerPanelOpen(true);
  }

  const view = buildAnswerView(text, sources, citations);
  state.lastAnswerCopyText = view.copyText || '';
  state.activeAnswer = {
    text: String(text || ''),
    sources: [...(sources || [])],
    citations: [...(citations || [])],
    context,
    meta
  };
  updateAnswerActionButtons();
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
    els.editNoteBtn.disabled = true;
    els.deleteNoteBtn.disabled = true;
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
      const mark = els.noteBody.querySelector('mark');
      if (mark) {
        requestAnimationFrame(() => {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        });
      }
    } else {
      els.noteBody.textContent = text;
    }
  }

  els.revealBtn.disabled = false;
  if (state.busyCount === 0) {
    els.editNoteBtn.disabled = false;
    els.deleteNoteBtn.disabled = false;
  }
}

async function loadClients() {
  state.clients = await window.coachNotes.getClients();
  if (state.selectedClientId && !state.clients.some((client) => client.id === state.selectedClientId)) {
    state.selectedClientId = null;
  }
  renderClientTagFilters();
  renderProfileTagPickerOptions();
  renderClients();
  renderClientContextStrip();
}

function parseTagInput(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function parseMultilineList(value, maxItems = 120) {
  const seen = new Set();
  const rows = [];
  for (const line of String(value || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(trimmed);
    if (rows.length >= maxItems) {
      break;
    }
  }

  return rows;
}

function formatIsoDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString();
}

function getProfileDraftFromInputs() {
  return {
    topPriorities: parseMultilineList(els.profileTopInput.value, 12),
    clientTags: [...(state.profileClientTagsDraft || [])],
    clientColor: state.profileColorValue || '',
    ongoingMedicalConsiderations: parseMultilineList(els.profileMedicalInput.value),
    acuteInjuries: parseMultilineList(els.profileAcuteInput.value),
    completedFocus: parseMultilineList(els.profileCompletedInput.value),
    futureFocus: parseMultilineList(els.profileFutureInput.value)
  };
}

function serializeProfileDraft(draft) {
  return JSON.stringify({
    topPriorities: draft.topPriorities || [],
    clientTags: draft.clientTags || [],
    clientColor: draft.clientColor || '',
    ongoingMedicalConsiderations: draft.ongoingMedicalConsiderations || [],
    acuteInjuries: draft.acuteInjuries || [],
    completedFocus: draft.completedFocus || [],
    futureFocus: draft.futureFocus || []
  });
}

function captureProfileSnapshot() {
  state.profileSnapshot = serializeProfileDraft(getProfileDraftFromInputs());
  state.profileDirty = false;
}

function refreshProfileDirtyState() {
  state.profileDirty = serializeProfileDraft(getProfileDraftFromInputs()) !== state.profileSnapshot;
}

function renderClientProfile(profile) {
  state.clientProfile = profile || null;
  state.clientProfileClientId = state.selectedClientId || null;
  if (!state.selectedClientId) {
    els.profileClientName.textContent = 'Select a client to edit profile details.';
    els.profileUpdatedAt.textContent = '';
    els.profileDisabled.hidden = false;
    els.profileFormWrap.hidden = true;
    els.profileTopInput.value = '';
    setProfileClientTagsDraft([]);
    state.profileColorValue = '';
    els.profileMedicalInput.value = '';
    els.profileAcuteInput.value = '';
    els.profileCompletedInput.value = '';
    els.profileFutureInput.value = '';
    captureProfileSnapshot();
    renderProfileColorPalette();
    renderClientContextStrip();
    updateBusyUi();
    return;
  }

  const clientName = profile?.clientName || 'Selected client';
  els.profileClientName.textContent = clientName;
  els.profileUpdatedAt.textContent = profile?.updatedAt
    ? `Last updated: ${formatIsoDate(profile.updatedAt)}`
    : 'No saved profile yet.';
  els.profileDisabled.hidden = true;
  els.profileFormWrap.hidden = false;
  els.profileTopInput.value = (profile?.topPriorities || []).join('\n');
  setProfileClientTagsDraft(profile?.clientTags || []);
  state.profileColorValue = normalizeHexColor(profile?.clientColor || '');
  els.profileMedicalInput.value = (profile?.ongoingMedicalConsiderations || []).join('\n');
  els.profileAcuteInput.value = (profile?.acuteInjuries || []).join('\n');
  els.profileCompletedInput.value = (profile?.completedFocus || []).join('\n');
  els.profileFutureInput.value = (profile?.futureFocus || []).join('\n');
  captureProfileSnapshot();
  renderProfileColorPalette();
  renderClientContextStrip();
  updateBusyUi();
}

async function loadClientProfile() {
  if (!state.selectedClientId) {
    renderClientProfile(null);
    return;
  }

  try {
    const profile = await window.coachNotes.getClientProfile({ clientId: state.selectedClientId });
    renderClientProfile(profile);
  } catch (error) {
    renderClientProfile({
      clientName: state.clients.find((client) => client.id === state.selectedClientId)?.name || 'Selected client',
      topPriorities: [],
      clientTags: [],
      clientColor: '',
      ongoingMedicalConsiderations: [],
      acuteInjuries: [],
      completedFocus: [],
      futureFocus: [],
      updatedAt: null
    });
    renderAnswer(`Load client profile failed: ${error.message}`);
  }
}

async function saveClientProfile(options = {}) {
  if (!state.selectedClientId) {
    renderAnswer('Select a client before saving profile.');
    return false;
  }

  const topPrioritiesRaw = parseMultilineList(els.profileTopInput.value, 12);
  if (topPrioritiesRaw.length > 3) {
    renderAnswer('Top Priorities is limited to 3 items.');
    return false;
  }

  const payload = {
    clientId: state.selectedClientId,
    topPriorities: topPrioritiesRaw,
    clientTags: [...(state.profileClientTagsDraft || [])],
    clientColor: state.profileColorValue || '',
    ongoingMedicalConsiderations: parseMultilineList(els.profileMedicalInput.value),
    acuteInjuries: parseMultilineList(els.profileAcuteInput.value),
    completedFocus: parseMultilineList(els.profileCompletedInput.value),
    futureFocus: parseMultilineList(els.profileFutureInput.value)
  };

  setBusy(true, 'Saving client profile...');
  try {
    const saved = await window.coachNotes.saveClientProfile(payload);
    renderClientProfile(saved);
    await loadClients();
    renderAnswer(`Saved profile for ${saved.clientName}.`);
    if (options?.closeDialog && els.clientProfileDialog.open) {
      els.clientProfileDialog.close();
    }
    return true;
  } catch (error) {
    renderAnswer(`Save client profile failed: ${error.message}`);
    return false;
  } finally {
    setBusy(false);
  }
}

async function requestCloseClientProfileDialog() {
  if (!els.clientProfileDialog.open) {
    return;
  }

  refreshProfileDirtyState();
  if (!state.profileDirty) {
    els.clientProfileDialog.close();
    return;
  }

  const shouldSave = window.confirm(
    'You have unsaved profile changes.\n\nClick OK to save before closing.'
  );
  if (shouldSave) {
    const saved = await saveClientProfile({ closeDialog: true });
    if (!saved) {
      return;
    }
    return;
  }

  const shouldDiscard = window.confirm('Discard unsaved profile changes and close?');
  if (!shouldDiscard) {
    return;
  }

  await loadClientProfile();
  els.clientProfileDialog.close();
}

async function openClientProfileDialog(options = {}) {
  if (options?.reload !== false) {
    await loadClientProfile();
  }
  els.clientProfileDialog.showModal();
}

function renderTagSuggestions() {
  els.tagSuggestions.innerHTML = '';
  for (const tag of state.tags) {
    const option = document.createElement('option');
    option.value = tag.name;
    els.tagSuggestions.appendChild(option);
  }
}

function populateClientSelect(selectEl, emptyLabel = 'No client folder (root)') {
  selectEl.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyLabel;
  selectEl.appendChild(emptyOption);

  for (const client of state.clients) {
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    selectEl.appendChild(option);
  }
}

function renderNewNoteClientOptions() {
  populateClientSelect(els.newNoteClientSelect);
}

function stripFrontmatter(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  if (!raw.startsWith('---\n')) {
    return raw;
  }

  const end = raw.indexOf('\n---\n', 4);
  if (end < 0) {
    return raw;
  }

  return raw.slice(end + 5).trimStart();
}

function stripAutoTitleHeading(text, title) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  if (!lines.length) {
    return '';
  }

  const first = lines[0].match(/^#\s+(.+)$/);
  const normalizedTitle = sanitizeName(title || '').toLowerCase();
  if (!first || !normalizedTitle || sanitizeName(first[1]).toLowerCase() !== normalizedTitle) {
    return text;
  }

  let start = 1;
  while (start < lines.length && !lines[start].trim()) {
    start += 1;
  }

  return lines.slice(start).join('\n');
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

async function runSearch(inputQuery = null) {
  const query = String(inputQuery ?? els.queryInput.value).trim();
  if (inputQuery !== null) {
    els.queryInput.value = query;
  }
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
    return { ok: true, count: state.results.length };
  } catch (error) {
    renderAnswer(`Search failed: ${error.message}`);
    return { ok: false, count: 0, error: error.message };
  } finally {
    setBusy(false);
  }
}

async function runAsk() {
  const question = String(els.queryInput.value || '').trim();
  if (!question) {
    renderAnswer('Please enter a question first.');
    return;
  }

  if (isLikelyAcknowledgementFollowup(question)) {
    renderAnswer(
      'Ask works one question at a time and does not keep chat context yet. Please restate the full request explicitly.',
      [],
      [],
      {
        context: `Question: ${question}`
      }
    );
    return;
  }

  setBusy(true, 'Thinking...');
  try {
    const topK = normalizeTopK(els.topKInput.value);
    els.topKInput.value = String(topK);
    syncDepthPresetFromTopK();
    const result = await window.coachNotes.ask({
      question,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      topK,
      relevanceMode: els.relevanceModeSelect.value
    });
    const fallbackSuffix = result.fallbackUsed ? ' (fallback mode)' : '';

    renderAnswer(result.answer, result.sources || [], result.citations || [], {
      context: `Question: ${question}${fallbackSuffix}`,
      meta: {
        mode: 'ask',
        prompt: question,
        scope: els.scopeSelect.value,
        clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
        error: false
      },
      addToHistory: true,
      autoOpen: true
    });
  } catch (error) {
    renderAnswer(`Answer failed: ${error.message}`, [], [], {
      context: `Question: ${question}`,
      meta: {
        mode: 'ask',
        prompt: question,
        scope: els.scopeSelect.value,
        clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
        error: true
      },
      addToHistory: true,
      autoOpen: true
    });
  } finally {
    setBusy(false);
  }
}

async function runSummarize() {
  const query = String(els.queryInput.value || '').trim();
  if (!query) {
    renderAnswer('Enter search text or question first.');
    return;
  }

  const searchResult = await runSearch(query);
  if (!searchResult?.ok) {
    return;
  }

  setBusy(true, 'Summarizing sources...');
  try {
    const topK = normalizeTopK(els.topKInput.value);
    const matchCount = Number(searchResult.count) || 0;
    els.topKInput.value = String(topK);
    syncDepthPresetFromTopK();
    const retrieved = (state.results || []).slice(0, topK).map((item) => ({
      chunkId: item.chunkId,
      noteId: item.noteId,
      title: item.title,
      date: item.date,
      clientNames: item.clientNames || [],
      snippet: item.snippet || '',
      startOffset: item.startOffset,
      endOffset: item.endOffset,
      chunkText: item.chunkText
    }));
    const result = await window.coachNotes.summarize({
      query,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      topK,
      relevanceMode: els.relevanceModeSelect.value,
      retrieved
    });
    const fallbackSuffix = result.fallbackUsed ? ' (fallback mode)' : '';

    const context = matchCount > 0
      ? `Summary of top ${Math.min(topK, matchCount)} of ${matchCount} matches for "${query}"${fallbackSuffix}`
      : `Summary for "${query}"${fallbackSuffix}`;

    renderAnswer(result.summary || '', result.sources || [], result.citations || [], {
      context,
      meta: {
        mode: 'summarize',
        prompt: query,
        scope: els.scopeSelect.value,
        clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
        error: false
      },
      addToHistory: true,
      autoOpen: true
    });
  } catch (error) {
    const topK = normalizeTopK(els.topKInput.value);
    const matchCount = Number(searchResult.count) || 0;
    const context = matchCount > 0
      ? `Summary of top ${Math.min(topK, matchCount)} of ${matchCount} matches for "${query}"`
      : `Summary for "${query}"`;
    renderAnswer(`Summarize failed: ${error.message}`, [], [], {
      context,
      meta: {
        mode: 'summarize',
        prompt: query,
        scope: els.scopeSelect.value,
        clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
        error: true
      },
      addToHistory: true,
      autoOpen: true
    });
  } finally {
    setBusy(false);
  }
}

async function runActiveMode() {
  if (state.queryMode === 'ask') {
    await runAsk();
    return;
  }

  if (state.queryMode === 'summarize') {
    await runSummarize();
    return;
  }

  await runSearch();
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

function openNewClientDialog() {
  els.newClientNameInput.value = '';
  els.newClientDialog.showModal();
  els.newClientNameInput.focus();
}

async function createNewClient(event) {
  event.preventDefault();
  const name = String(els.newClientNameInput.value || '').trim();
  if (!name) {
    renderAnswer('Client name is required.');
    return;
  }

  setBusy(true, 'Creating client...');
  try {
    const created = await window.coachNotes.createClient({ name });
    await loadClients();
    if (created.id) {
      state.selectedClientId = created.id;
    }
    await loadClientProfile();
    renderClients();
    renderNewNoteClientOptions();
    els.newClientDialog.close();
    renderAnswer(`Created client: ${created.name}`);
  } catch (error) {
    renderAnswer(`Create client failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

function openEditNoteDialog() {
  if (!state.currentNote || !state.selectedNoteId) {
    renderAnswer('Select a note before editing.');
    return;
  }

  populateClientSelect(els.editNoteClientSelect, 'No client folder (root)');
  const now = new Date().toISOString().slice(0, 10);
  els.editNoteTitleInput.value = state.currentNote.title || '';
  els.editNoteDateInput.value = state.currentNote.date || now;
  els.editNoteClientSelect.value = state.currentNote.clients?.[0] || '';
  els.editNoteTagsInput.value = (state.currentNote.tags || []).join(', ');
  const bodyNoFrontmatter = stripFrontmatter(state.currentNote.text || '');
  els.editNoteBodyInput.value = stripAutoTitleHeading(bodyNoFrontmatter, state.currentNote.title || '');
  els.editNoteDialog.showModal();
  els.editNoteTitleInput.focus();
}

async function saveEditedNote(event) {
  event.preventDefault();
  if (!state.selectedNoteId) {
    renderAnswer('Select a note before editing.');
    return;
  }

  const title = String(els.editNoteTitleInput.value || '').trim();
  if (!title) {
    renderAnswer('Title is required to save note changes.');
    return;
  }

  const payload = {
    noteId: state.selectedNoteId,
    title,
    date: els.editNoteDateInput.value,
    clientName: els.editNoteClientSelect.value,
    tags: parseTagInput(els.editNoteTagsInput.value),
    body: els.editNoteBodyInput.value
  };

  setBusy(true, 'Saving note changes...');
  try {
    const updated = await window.coachNotes.updateNote(payload);
    await loadClients();
    await loadClientProfile();
    renderClients();
    await loadTags();
    await loadNotes();
    els.editNoteDialog.close();
    if (updated.noteId) {
      state.selectedHighlight = null;
      await openNote(updated.noteId);
    }
    renderAnswer(`Updated note: ${updated.title}`);
  } catch (error) {
    renderAnswer(`Update note failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function deleteCurrentNote() {
  if (!state.selectedNoteId || !state.currentNote) {
    renderAnswer('Select a note before deleting.');
    return;
  }

  const title = state.currentNote.title || 'this note';
  const shouldDelete = window.confirm(
    `Move "${title}" to "Deleted Notes"?\n\nThis removes it from indexed notes but keeps the file on disk.`
  );
  if (!shouldDelete) {
    return;
  }

  setBusy(true, 'Moving note to Deleted Notes...');
  try {
    const result = await window.coachNotes.deleteNote({ noteId: state.selectedNoteId });
    state.selectedNoteId = null;
    state.currentNote = null;
    state.selectedHighlight = null;
    await loadClients();
    await loadClientProfile();
    renderClients();
    await loadTags();
    if (state.activeQuery) {
      await runSearch(state.activeQuery);
    } else {
      await loadNotes();
    }
    renderNote(null);
    renderAnswer(`Moved note to Deleted Notes: ${result.title}`);
  } catch (error) {
    renderAnswer(`Delete note failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
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

function getClientNameById(clientId) {
  const id = Number(clientId);
  if (!Number.isFinite(id)) {
    return '';
  }

  return state.clients.find((client) => client.id === id)?.name || '';
}

function truncateTitle(value, maxLength = 88) {
  const raw = sanitizeName(value);
  if (!raw) {
    return '';
  }

  if (raw.length <= maxLength) {
    return raw;
  }

  return `${raw.slice(0, maxLength - 3).trim()}...`;
}

function buildAiAnswerNoteTitle(entry) {
  const mode = String(entry?.meta?.mode || '');
  const prompt = sanitizeName(entry?.meta?.prompt || '');
  const prefix = mode === 'summarize' ? 'Summary' : 'Q&A';
  if (!prompt) {
    return `${prefix}: AI Notes`;
  }

  return truncateTitle(`${prefix}: ${prompt}`);
}

function buildAiAnswerNoteBody(entry) {
  const mode = String(entry?.meta?.mode || '');
  const prompt = sanitizeName(entry?.meta?.prompt || '');
  const view = buildAnswerView(entry?.text || '', entry?.sources || [], entry?.citations || []);
  const citedSources = (view.orderedSources || []).filter((source) => Number.isInteger(source.citationNumber));
  const sourceLines = citedSources.map((source) => {
    const client = (source.clientNames || []).join(', ') || 'Unassigned client';
    const title = sanitizeName(source.title || 'Untitled note');
    const date = sanitizeName(source.date || 'Unknown date');
    const snippet = String(source.snippet || source.chunkText || '').replace(/\s+/g, ' ').trim();
    if (snippet) {
      return `- [${source.citationNumber}] ${client} | ${title} | ${date} | ${snippet}`;
    }

    return `- [${source.citationNumber}] ${client} | ${title} | ${date}`;
  });
  const generatedAt = new Date().toISOString();
  const lines = [
    '## AI Metadata',
    `- Generated: ${generatedAt}`,
    `- Type: ${mode === 'summarize' ? 'Summary' : 'Q&A answer'}`,
    prompt ? `- Prompt: ${prompt}` : '',
    `- Sources considered: ${Array.isArray(entry?.sources) ? entry.sources.length : 0}`,
    `- Sources cited: ${citedSources.length}`,
    '',
    '## Content',
    String(view.copyText || entry?.text || '').trim()
  ].filter(Boolean);

  if (sourceLines.length) {
    lines.push('', '## Sources', ...sourceLines);
  }

  return lines.join('\n');
}

function populateSaveAnswerClientSelect(selectedClientName = '') {
  const selected = sanitizeName(selectedClientName);
  els.saveAnswerClientSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select client...';
  els.saveAnswerClientSelect.appendChild(placeholder);

  for (const client of state.clients) {
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    els.saveAnswerClientSelect.appendChild(option);
  }

  if (selected && state.clients.some((client) => client.name === selected)) {
    els.saveAnswerClientSelect.value = selected;
  } else {
    els.saveAnswerClientSelect.value = '';
  }
}

function openSaveAnswerDialog(defaults = {}) {
  populateSaveAnswerClientSelect(defaults.clientName || getClientNameById(state.selectedClientId));
  els.saveAnswerTitleInput.value = defaults.title || '';
  els.saveAnswerDialog.showModal();
  if (!els.saveAnswerClientSelect.value) {
    els.saveAnswerClientSelect.focus();
  } else {
    els.saveAnswerTitleInput.focus();
    els.saveAnswerTitleInput.select();
  }
}

async function persistAnswerAsNote(entry, clientName, title) {
  const payload = {
    title: truncateTitle(title || buildAiAnswerNoteTitle(entry)),
    date: new Date().toISOString().slice(0, 10),
    clientName: sanitizeName(clientName),
    tags: [
      'ai-generated',
      entry?.meta?.mode === 'summarize' ? 'summary' : 'qa'
    ],
    body: buildAiAnswerNoteBody(entry)
  };

  if (!payload.clientName) {
    throw new Error('Client selection is required.');
  }

  const created = await window.coachNotes.createNote(payload);
  await loadClients();
  await loadTags();
  if (!state.activeQuery) {
    await loadNotes();
  }
  showToast(`Saved note: ${created.title}`);
  return created;
}

async function handleSaveAnswerAsNote() {
  const entry = state.activeAnswer;
  if (!isSavableAnswerEntry(entry)) {
    showToast('Run Ask or Summarize first, then save the result as a note.', 'error');
    return;
  }

  if (!state.clients.length) {
    showToast('Create a client before saving AI answers as notes.', 'error');
    return;
  }

  const defaultTitle = buildAiAnswerNoteTitle(entry);
  const scopedClientName = entry.meta?.scope === 'client'
    ? getClientNameById(entry.meta?.clientId)
    : '';

  state.pendingAnswerSave = {
    entry,
    title: defaultTitle
  };

  if (scopedClientName) {
    setBusy(true, 'Saving AI note...');
    try {
      await persistAnswerAsNote(entry, scopedClientName, defaultTitle);
    } catch (error) {
      showToast(`Save failed: ${error.message}`, 'error');
    } finally {
      state.pendingAnswerSave = null;
      setBusy(false);
    }
    return;
  }

  openSaveAnswerDialog({
    clientName: getClientNameById(state.selectedClientId),
    title: defaultTitle
  });
}

async function submitSaveAnswerAsNote(event) {
  event.preventDefault();
  const draft = state.pendingAnswerSave;
  if (!draft?.entry) {
    els.saveAnswerDialog.close();
    return;
  }

  const clientName = sanitizeName(els.saveAnswerClientSelect.value);
  if (!clientName) {
    showToast('Choose a client before saving.', 'error');
    return;
  }

  const title = sanitizeName(els.saveAnswerTitleInput.value) || draft.title;
  setBusy(true, 'Saving AI note...');
  try {
    await persistAnswerAsNote(draft.entry, clientName, title);
    els.saveAnswerDialog.close();
    state.pendingAnswerSave = null;
  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error');
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
    await loadClientProfile();
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
  await loadClientProfile();
  setNoteViewMode('rendered');
  renderNote(null);
  renderAnswer('Run Ask or Summarize to generate grounded output with citations.');
  setQueryMode('search');
  syncDepthPresetFromTopK();
  setAnswerPanelOpen(false);
  setQaContextOpen(true);
  setClientsPanelOpen(true);
  renderClientContextStrip();

  els.newNoteBtn.addEventListener('click', openNewNoteDialog);
  els.newClientBtn.addEventListener('click', openNewClientDialog);
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
      await loadClientProfile();
    } finally {
      setBusy(false);
    }
  });

  els.allClientsBtn.addEventListener('click', async () => {
    state.selectedClientId = null;
    renderClients();
    if (els.scopeSelect.value === 'client') {
      if (state.activeQuery) {
        await runSearch(state.activeQuery);
      } else {
        await loadNotes();
      }
    } else {
      await loadNotes();
    }
    await loadClientProfile();
  });

  els.scopeSelect.addEventListener('change', async () => {
    state.scope = els.scopeSelect.value;
    renderClientContextStrip();
    if (state.activeQuery) {
      await runSearch(state.activeQuery);
    }
  });

  els.queryModeGroup.addEventListener('change', (event) => {
    const target = event.target;
    if (!target || target.name !== 'queryMode') {
      return;
    }

    setQueryMode(target.value);
  });
  els.depthPresetSelect.addEventListener('change', () => {
    applyDepthPreset(els.depthPresetSelect.value);
  });
  els.topKInput.addEventListener('input', () => {
    syncDepthPresetFromTopK();
  });
  els.topKInput.addEventListener('change', () => {
    const normalized = normalizeTopK(els.topKInput.value);
    els.topKInput.value = String(normalized);
    syncDepthPresetFromTopK();
  });
  els.goBtn.addEventListener('click', runActiveMode);
  els.queryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      runActiveMode();
    }
  });
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
  els.qaContextToggleBtn.addEventListener('click', () => {
    setQaContextOpen(!state.qaContextOpen);
  });
  els.qaContextHeader.addEventListener('click', (event) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    setQaContextOpen(!state.qaContextOpen);
  });
  els.qaContextHeader.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setQaContextOpen(!state.qaContextOpen);
    }
  });
  els.copyAnswerBtn.addEventListener('click', copyAnswerToClipboard);
  els.saveAnswerBtn.addEventListener('click', async () => {
    await handleSaveAnswerAsNote();
  });
  els.saveProfileBtn.addEventListener('click', async () => {
    await saveClientProfile({ closeDialog: true });
  });
  const profileInputs = [
    els.profileTopInput,
    els.profileMedicalInput,
    els.profileAcuteInput,
    els.profileCompletedInput,
    els.profileFutureInput
  ];
  for (const input of profileInputs) {
    input.addEventListener('input', () => {
      refreshProfileDirtyState();
    });
  }
  els.profileColorPalette.addEventListener('click', (event) => {
    const swatch = event.target.closest('.profile-color-swatch');
    if (!swatch) {
      return;
    }

    const color = normalizeHexColor(swatch.dataset.color || '');
    if (!color) {
      return;
    }

    state.profileColorValue = color;
    renderProfileColorPalette();
    refreshProfileDirtyState();
  });
  els.clearProfileColorBtn.addEventListener('click', () => {
    state.profileColorValue = '';
    renderProfileColorPalette();
    refreshProfileDirtyState();
  });
  els.profileTagPicker.addEventListener('change', () => {
    const picked = String(els.profileTagPicker.value || '').trim();
    if (!picked) {
      return;
    }

    if (picked === '__new__') {
      showProfileNewTagRow();
      els.profileTagPicker.value = '';
      return;
    }

    addProfileTag(picked);
    els.profileTagPicker.value = '';
  });
  els.profileOpenNewTagBtn.addEventListener('click', () => {
    showProfileNewTagRow();
  });
  els.profileConfirmNewTagBtn.addEventListener('click', () => {
    submitProfileNewTagFromInput();
  });
  els.profileCancelNewTagBtn.addEventListener('click', () => {
    hideProfileNewTagRow();
  });
  els.profileNewTagInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitProfileNewTagFromInput();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      hideProfileNewTagRow();
    }
  });
  els.profileClientTagsList.addEventListener('click', (event) => {
    const button = event.target.closest('.profile-tag-chip');
    if (!button) {
      return;
    }

    removeProfileTag(button.dataset.tag || '');
  });
  els.clearClientTagFiltersBtn.addEventListener('click', () => {
    state.clientTagFilters = [];
    renderClientTagFilters();
    renderClients();
  });

  els.revealBtn.addEventListener('click', async () => {
    if (state.selectedNoteId) {
      await window.coachNotes.revealInFinder(state.selectedNoteId);
    }
  });
  els.editNoteBtn.addEventListener('click', openEditNoteDialog);
  els.deleteNoteBtn.addEventListener('click', deleteCurrentNote);

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
  els.saveAnswerForm.addEventListener('submit', submitSaveAnswerAsNote);
  els.cancelSaveAnswerBtn.addEventListener('click', () => {
    state.pendingAnswerSave = null;
    els.saveAnswerDialog.close();
  });
  els.cancelNewNoteBtn.addEventListener('click', () => {
    els.newNoteDialog.close();
  });
  els.newClientForm.addEventListener('submit', createNewClient);
  els.cancelNewClientBtn.addEventListener('click', () => {
    els.newClientDialog.close();
  });
  els.editNoteForm.addEventListener('submit', saveEditedNote);
  els.cancelEditNoteBtn.addEventListener('click', () => {
    els.editNoteDialog.close();
  });
  els.cancelProfileBtn.addEventListener('click', async () => {
    await requestCloseClientProfileDialog();
  });
  els.clientProfileDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestCloseClientProfileDialog();
  });
  els.clientProfileDialog.addEventListener('click', (event) => {
    if (event.target === els.clientProfileDialog) {
      requestCloseClientProfileDialog();
    }
  });
  els.saveAnswerDialog.addEventListener('cancel', () => {
    state.pendingAnswerSave = null;
  });
  els.saveAnswerDialog.addEventListener('close', () => {
    state.pendingAnswerSave = null;
  });
}

init().catch((error) => {
  renderAnswer(`Initialization failed: ${error.message}`);
});
