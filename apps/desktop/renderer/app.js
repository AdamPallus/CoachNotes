const THEME_STORAGE_KEY = 'coachnotes-theme';
const TEXT_SIZE_STORAGE_KEY = 'coachnotes-text-size';

const state = {
  settings: null,
  status: null,
  allClients: [],
  clients: [],
  showArchivedClients: false,
  clientTagFilters: [],
  tagCategories: [],
  tagEditorDraftCategories: [],
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
  busyStack: [],
  busyMessage: 'Working...',
  lastAnswerCopyText: '',
  activeAnswer: null,
  answerHistory: [],
  answerHistoryIndex: -1,
  answerPanelOpen: false,
  streamingRequestId: null,
  streamingMode: '',
  streamingText: '',
  qaContextOpen: true,
  clientsPanelOpen: true,
  pendingAnswerSave: null,
  profileClientTagsDraft: [],
  profileSidebarTagsDraft: [],
  profileColorValue: '',
  profileColorPopoverOpen: false,
  profileTagEditorOpen: false,
  profileSnapshot: '',
  profileDirty: false,
  themeMode: 'light',
  theme: 'light',
  textSizeMode: 'medium'
};

const els = {
  appShell: document.getElementById('appShell'),
  themeModeGroup: document.getElementById('themeModeGroup'),
  themeModeLight: document.getElementById('themeModeLight'),
  themeModeDark: document.getElementById('themeModeDark'),
  textSizeGroup: document.getElementById('textSizeGroup'),
  textSizeSmall: document.getElementById('textSizeSmall'),
  textSizeMedium: document.getElementById('textSizeMedium'),
  textSizeLarge: document.getElementById('textSizeLarge'),
  statusLine: document.getElementById('statusLine'),
  newNoteBtn: document.getElementById('newNoteBtn'),
  newClientBtn: document.getElementById('newClientBtn'),
  moreMenuBtn: document.getElementById('moreMenuBtn'),
  moreMenu: document.getElementById('moreMenu'),
  helpBtn: document.getElementById('helpBtn'),
  checkUpdatesBtn: document.getElementById('checkUpdatesBtn'),
  editTagsBtn: document.getElementById('editTagsBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  reindexBtn: document.getElementById('reindexBtn'),
  clientsSidebar: document.getElementById('clientsSidebar'),
  clientsHeader: document.getElementById('clientsHeader'),
  clientsHeaderLabel: document.getElementById('clientsHeaderLabel'),
  clientsToggleBtn: document.getElementById('clientsToggleBtn'),
  clientsPanelBody: document.getElementById('clientsPanelBody'),
  allClientsBtn: document.getElementById('allClientsBtn'),
  archivedClientsBtn: document.getElementById('archivedClientsBtn'),
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
  summaryModeSelect: document.getElementById('summaryModeSelect'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsList: document.getElementById('resultsList'),
  qaContextCard: document.getElementById('qaContextCard'),
  qaContextHeader: document.getElementById('qaContextHeader'),
  qaContextToggleBtn: document.getElementById('qaContextToggleBtn'),
  qaContextBody: document.getElementById('qaContextBody'),
  qaContextClientName: document.getElementById('qaContextClientName'),
  qaContextTags: document.getElementById('qaContextTags'),
  qaContextCoachNotes: document.getElementById('qaContextCoachNotes'),
  qaContextTopPriorities: document.getElementById('qaContextTopPriorities'),
  qaContextExercise: document.getElementById('qaContextExercise'),
  qaContextMedical: document.getElementById('qaContextMedical'),
  qaContextAcute: document.getElementById('qaContextAcute'),
  profileDialogTitle: document.getElementById('profileDialogTitle'),
  profileClientName: document.getElementById('profileClientName'),
  profileUpdatedAt: document.getElementById('profileUpdatedAt'),
  profileDisabled: document.getElementById('profileDisabled'),
  profileFormWrap: document.getElementById('profileFormWrap'),
  profileTopInput: document.getElementById('profileTopInput'),
  profileCoachNotesInput: document.getElementById('profileCoachNotesInput'),
  profileTagPicker: document.getElementById('profileTagPicker'),
  profileOpenNewTagBtn: document.getElementById('profileOpenNewTagBtn'),
  profileNewTagRow: document.getElementById('profileNewTagRow'),
  profileNewTagInput: document.getElementById('profileNewTagInput'),
  profileNewTagCategorySelect: document.getElementById('profileNewTagCategorySelect'),
  profileNewCategoryRow: document.getElementById('profileNewCategoryRow'),
  profileNewCategoryNameInput: document.getElementById('profileNewCategoryNameInput'),
  profileNewCategoryColorInput: document.getElementById('profileNewCategoryColorInput'),
  profileConfirmNewTagBtn: document.getElementById('profileConfirmNewTagBtn'),
  profileCancelNewTagBtn: document.getElementById('profileCancelNewTagBtn'),
  profileClientTagsList: document.getElementById('profileClientTagsList'),
  profileSidebarTagsList: document.getElementById('profileSidebarTagsList'),
  profileTagEditor: document.getElementById('profileTagEditor'),
  profileTagsToggleBtn: document.getElementById('profileTagsToggleBtn'),
  profileColorToggleBtn: document.getElementById('profileColorToggleBtn'),
  profileColorPopover: document.getElementById('profileColorPopover'),
  profileColorPalette: document.getElementById('profileColorPalette'),
  clearProfileColorBtn: document.getElementById('clearProfileColorBtn'),
  profileMedicalInput: document.getElementById('profileMedicalInput'),
  profileAcuteInput: document.getElementById('profileAcuteInput'),
  profileExerciseInput: document.getElementById('profileExerciseInput'),
  profileCompletedInput: document.getElementById('profileCompletedInput'),
  profileFutureInput: document.getElementById('profileFutureInput'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  archiveClientBtn: document.getElementById('archiveClientBtn'),
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
  editTagsDialog: document.getElementById('editTagsDialog'),
  editTagsForm: document.getElementById('editTagsForm'),
  tagCategoriesEditorList: document.getElementById('tagCategoriesEditorList'),
  newTagCategoryNameInput: document.getElementById('newTagCategoryNameInput'),
  newTagCategoryColorInput: document.getElementById('newTagCategoryColorInput'),
  addTagCategoryBtn: document.getElementById('addTagCategoryBtn'),
  tagAssignmentsList: document.getElementById('tagAssignmentsList'),
  cancelEditTagsBtn: document.getElementById('cancelEditTagsBtn'),
  saveTagCategoriesBtn: document.getElementById('saveTagCategoriesBtn'),
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

function normalizeSidebarTags(values, allowedTags = [], maxItems = 8) {
  const allowed = new Set((allowedTags || []).map((tag) => String(tag || '').toLowerCase()));
  const selected = normalizeTagList(values || [], maxItems);
  if (!allowed.size) {
    return [];
  }

  return selected.filter((tag) => allowed.has(String(tag).toLowerCase()));
}

function getVisibleClients() {
  return state.showArchivedClients
    ? (state.allClients || []).filter((client) => Boolean(client.archived))
    : (state.allClients || []).filter((client) => !client.archived);
}

function getSelectedClient() {
  return (state.allClients || []).find((client) => client.id === state.selectedClientId) || null;
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

const DEFAULT_TAG_COLOR = '#64748b';

function normalizeTagCategoryId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTagCategoriesConfig(input) {
  const source = Array.isArray(input?.categories) ? input.categories : [];
  const categories = [];
  const usedIds = new Set();
  const usedTags = new Set();

  for (let index = 0; index < source.length; index += 1) {
    const row = source[index] || {};
    const name = sanitizeName(row.name || '');
    if (!name) {
      continue;
    }

    const baseId = normalizeTagCategoryId(row.id || name) || `category-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const color = normalizeHexColor(row.color) || DEFAULT_TAG_COLOR;
    const tags = [];
    for (const tag of normalizeTagList(row.tags || row.tagNames || [], 400)) {
      const key = tag.toLowerCase();
      if (usedTags.has(key)) {
        continue;
      }

      usedTags.add(key);
      tags.push(tag);
    }

    categories.push({
      id,
      name,
      color,
      tags
    });
  }

  return { categories };
}

function getTagCategoryLookup() {
  const lookup = new Map();
  for (const category of state.tagCategories || []) {
    for (const tag of category.tags || []) {
      const key = String(tag || '').trim().toLowerCase();
      if (!key || lookup.has(key)) {
        continue;
      }

      lookup.set(key, category);
    }
  }
  return lookup;
}

function findTagCategory(tag) {
  const normalized = String(tag || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return getTagCategoryLookup().get(normalized) || null;
}

function hexToRgb(hexColor) {
  const hex = normalizeHexColor(hexColor).replace('#', '');
  if (!hex || hex.length !== 6) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function rgbaFromHex(hexColor, alpha) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return '';
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isLightColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return false;
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62;
}

function blendColors(hexColorA, hexColorB, ratio) {
  const a = hexToRgb(hexColorA);
  const b = hexToRgb(hexColorB);
  if (!a || !b) {
    return normalizeHexColor(hexColorA) || '#334155';
  }

  const weight = Math.max(0, Math.min(1, Number(ratio) || 0));
  const r = Math.round(a.r * (1 - weight) + b.r * weight);
  const g = Math.round(a.g * (1 - weight) + b.g * weight);
  const bValue = Math.round(a.b * (1 - weight) + b.b * weight);
  const hex = [r, g, bValue]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

  return `#${hex}`;
}

function applyTagColorStyle(element, hexColor) {
  const color = normalizeHexColor(hexColor);
  if (!color) {
    return;
  }

  const isDark = state.theme === 'dark';
  const borderAlpha = isDark ? 0.65 : 0.56;
  const backgroundAlpha = isDark ? 0.26 : 0.14;
  const textColor = isDark
    ? blendColors(color, '#ffffff', 0.34)
    : blendColors(color, '#0f172a', 0.44);

  element.style.borderColor = rgbaFromHex(color, borderAlpha);
  element.style.background = rgbaFromHex(color, backgroundAlpha);
  element.style.color = textColor;
}

function getTagCategoryColor(tag) {
  return findTagCategory(tag)?.color || DEFAULT_TAG_COLOR;
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
  element.className = 'tag-pill';
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
  const category = findTagCategory(normalized);
  if (category) {
    element.title = `Category: ${category.name}`;
  }
  applyTagColorStyle(element, getTagCategoryColor(normalized));
  element.textContent = removable ? `${normalized} x` : normalized;
  return element;
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
  renderClients();
  renderClientTagFilters();
  renderProfileClientTagsList();
  renderClientContextStrip();
  if (els.editTagsDialog.open) {
    renderEditTagsDialog();
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const initialMode = stored === 'dark' || stored === 'light' ? stored : getSystemTheme();
  applyTheme(initialMode, false);
}

function normalizeTextSizeMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'small' || normalized === 'large') {
    return normalized;
  }
  return 'medium';
}

function zoomFactorForMode(mode) {
  const normalized = normalizeTextSizeMode(mode);
  if (normalized === 'small') {
    return 1.0;
  }
  if (normalized === 'large') {
    return 1.14;
  }
  return 1.06;
}

function syncTextSizeControls() {
  const mode = normalizeTextSizeMode(state.textSizeMode);
  els.textSizeSmall.checked = mode === 'small';
  els.textSizeMedium.checked = mode === 'medium';
  els.textSizeLarge.checked = mode === 'large';
}

async function applyTextSizeMode(mode, persist = true) {
  const normalized = normalizeTextSizeMode(mode);
  state.textSizeMode = normalized;
  syncTextSizeControls();
  if (persist) {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, normalized);
  }

  try {
    await window.coachNotes.setZoom({
      factor: zoomFactorForMode(normalized)
    });
  } catch {
    // Ignore zoom updates when renderer is not ready.
  }
}

async function initTextSizeMode() {
  const stored = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
  const initialMode = normalizeTextSizeMode(stored || 'medium');
  await applyTextSizeMode(initialMode, false);
}

function getQueryModeConfig(mode) {
  if (mode === 'ask') {
    return {
      placeholder: 'Ask a question about your notes...',
      buttonText: 'Ask'
    };
  }

  if (mode === 'summarize') {
    const summaryMode = normalizeSummaryMode(els.summaryModeSelect?.value);
    if (summaryMode === 'coaching_conversation') {
      return {
        placeholder: 'Optional focus for selected transcript (e.g. action items)',
        buttonText: 'Summarize Selected Transcript'
      };
    }

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

function normalizeSummaryMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'coaching_conversation') {
    return 'coaching_conversation';
  }

  return 'search_results';
}

function normalizeNoteKind(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'transcript') {
    return 'transcript';
  }

  return 'all';
}

function syncSummaryModeControlState() {
  if (!els.summaryModeSelect) {
    return;
  }

  els.summaryModeSelect.disabled = state.queryMode !== 'summarize';
}

function setQueryMode(mode) {
  const normalized = mode === 'ask' || mode === 'summarize' ? mode : 'search';
  state.queryMode = normalized;
  const config = getQueryModeConfig(normalized);
  els.queryInput.placeholder = config.placeholder;
  els.goBtn.textContent = config.buttonText;
  syncQueryModeControls();
  syncSummaryModeControlState();
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
  const blockingBusy = state.busyStack.some((entry) => entry?.blocking);
  const progress = getIndexProgress();
  els.goBtn.disabled = busy;
  els.reindexBtn.disabled = busy;
  els.newNoteBtn.disabled = busy;
  els.newClientBtn.disabled = busy;
  els.moreMenuBtn.disabled = busy;
  els.checkUpdatesBtn.disabled = busy;
  els.editTagsBtn.disabled = busy;
  els.helpBtn.disabled = busy;
  els.settingsBtn.disabled = busy;
  els.archivedClientsBtn.disabled = busy;
  els.saveProfileBtn.disabled = busy || !state.selectedClientId;
  els.archiveClientBtn.disabled = busy || !state.selectedClientId;
  els.profileTopInput.disabled = busy || !state.selectedClientId;
  els.profileCoachNotesInput.disabled = busy || !state.selectedClientId;
  els.profileTagPicker.disabled = busy || !state.selectedClientId;
  els.profileOpenNewTagBtn.disabled = busy || !state.selectedClientId;
  els.profileTagsToggleBtn.disabled = busy || !state.selectedClientId;
  els.profileColorToggleBtn.disabled = busy || !state.selectedClientId;
  els.profileNewTagInput.disabled = busy || !state.selectedClientId;
  els.profileNewTagCategorySelect.disabled = busy || !state.selectedClientId;
  els.profileNewCategoryNameInput.disabled = busy || !state.selectedClientId;
  els.profileNewCategoryColorInput.disabled = busy || !state.selectedClientId;
  els.profileConfirmNewTagBtn.disabled = busy || !state.selectedClientId;
  els.profileCancelNewTagBtn.disabled = busy || !state.selectedClientId;
  els.clearProfileColorBtn.disabled = busy || !state.selectedClientId;
  els.profileMedicalInput.disabled = busy || !state.selectedClientId;
  els.profileAcuteInput.disabled = busy || !state.selectedClientId;
  els.profileExerciseInput.disabled = busy || !state.selectedClientId;
  els.profileCompletedInput.disabled = busy || !state.selectedClientId;
  els.profileFutureInput.disabled = busy || !state.selectedClientId;
  els.copyAnswerBtn.disabled = busy || !state.lastAnswerCopyText;
  els.saveAnswerBtn.disabled = busy || !isSavableAnswerEntry(state.activeAnswer);
  els.addTagCategoryBtn.disabled = busy;
  els.saveTagCategoriesBtn.disabled = busy;
  els.cancelEditTagsBtn.disabled = busy;
  els.newTagCategoryNameInput.disabled = busy;
  els.newTagCategoryColorInput.disabled = busy;
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
  els.busyOverlay.hidden = !(busy && blockingBusy);
  if (busy && blockingBusy) {
    setMenuOpen(false);
  }

  if (state.streamingRequestId) {
    const streamingMeta = els.answerText.querySelector('.streaming-answer-meta');
    if (streamingMeta) {
      streamingMeta.textContent = getBusyMessage();
    }
  }

  const paletteDisabled = busy || !state.selectedClientId;
  for (const button of els.profileColorPalette.querySelectorAll('button')) {
    button.disabled = paletteDisabled;
  }
  for (const input of els.tagCategoriesEditorList.querySelectorAll('input, button')) {
    input.disabled = busy;
  }
  for (const control of els.tagAssignmentsList.querySelectorAll('select, button')) {
    control.disabled = busy;
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

function setBusy(on, message = '', options = {}) {
  if (on) {
    state.busyStack.push({
      blocking: options.blocking !== false
    });
    state.busyCount = state.busyStack.length;
    if (message) {
      state.busyMessage = message;
    }
  } else {
    if (state.busyStack.length > 0) {
      state.busyStack.pop();
    }
    state.busyCount = state.busyStack.length;
    if (state.busyCount === 0) {
      state.busyMessage = 'Working...';
    }
  }

  updateBusyUi();
}

function setBusyMessage(message) {
  if (state.busyCount <= 0) {
    return;
  }

  const next = String(message || '').trim();
  if (!next) {
    return;
  }

  state.busyMessage = next;
  updateBusyUi();
}

function startBusyStages(initialMessage, stages = [], options = {}) {
  setBusy(true, initialMessage, options);
  const timerIds = [];

  for (const stage of stages) {
    const message = String(stage?.message || '').trim();
    if (!message) {
      continue;
    }

    const delayMs = Math.max(0, Number(stage?.delayMs) || 0);
    const timerId = setTimeout(() => {
      if (state.busyCount > 0) {
        setBusyMessage(message);
      }
    }, delayMs);
    timerIds.push(timerId);
  }

  return () => {
    for (const timerId of timerIds) {
      clearTimeout(timerId);
    }
    setBusy(false);
  };
}

function generateRequestId(prefix) {
  const base = String(prefix || 'req').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'req';
  const random = Math.random().toString(36).slice(2, 10);
  return `${base}_${Date.now()}_${random}`;
}

function resetStreamingState() {
  state.streamingRequestId = null;
  state.streamingMode = '';
  state.streamingText = '';
}

function beginStreamingAnswer(requestId, mode, context) {
  state.streamingRequestId = String(requestId || '');
  state.streamingMode = String(mode || '');
  state.streamingText = '';
  setAnswerPanelOpen(true);

  const contextText = String(context || '').trim();
  els.answerContext.textContent = contextText;
  els.answerContext.hidden = !contextText;
  state.lastAnswerCopyText = '';
  state.activeAnswer = null;
  updateAnswerActionButtons();

  els.answerText.innerHTML = `
    <div class="streaming-answer">
      <div class="streaming-answer-meta">Streaming response...</div>
      <div class="streaming-answer-text"></div>
    </div>
  `;
}

function appendStreamingAnswer(requestId, delta) {
  if (!state.streamingRequestId || String(requestId || '') !== state.streamingRequestId) {
    return;
  }

  const text = String(delta || '');
  if (!text) {
    return;
  }

  state.streamingText += text;
  const streamBody = els.answerText.querySelector('.streaming-answer-text');
  if (streamBody) {
    streamBody.textContent = state.streamingText;
    streamBody.scrollTop = streamBody.scrollHeight;
  }
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

function setProfileColorPopoverOpen(open) {
  const next = Boolean(open) && Boolean(state.selectedClientId);
  state.profileColorPopoverOpen = next;
  els.profileColorPopover.hidden = !next;
  els.profileColorToggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
}

function setProfileTagEditorOpen(open) {
  const next = Boolean(open) && Boolean(state.selectedClientId);
  state.profileTagEditorOpen = next;
  els.profileTagEditor.hidden = !next;
  els.profileTagsToggleBtn.textContent = next ? 'Done' : 'Manage';
  els.profileTagsToggleBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  if (!next) {
    hideProfileNewTagRow();
  }
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

  const client = getSelectedClient();
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

  const coachNotes = String(profile?.coachNotes || '').trim();
  if (coachNotes) {
    els.qaContextCoachNotes.textContent = coachNotes;
  } else {
    els.qaContextCoachNotes.textContent = 'No coach notes yet.';
    els.qaContextCoachNotes.classList.add('qa-context-empty');
  }
  if (coachNotes) {
    els.qaContextCoachNotes.classList.remove('qa-context-empty');
  }

  renderContextList(els.qaContextTopPriorities, profile?.topPriorities || [], 'No priorities set.');
  renderContextList(els.qaContextExercise, profile?.exerciseAtAGlance || [], 'No exercise notes.');
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

function renderArchivedClientsToggle() {
  const archivedCount = (state.allClients || []).filter((client) => Boolean(client.archived)).length;
  const showingArchived = Boolean(state.showArchivedClients);
  els.archivedClientsBtn.hidden = archivedCount === 0 && !showingArchived;
  els.archivedClientsBtn.textContent = showingArchived ? 'Active' : `Archived${archivedCount ? ` (${archivedCount})` : ''}`;
  els.archivedClientsBtn.setAttribute('aria-pressed', showingArchived ? 'true' : 'false');
  els.archivedClientsBtn.title = showingArchived ? 'Show active clients' : 'Show archived clients';
}

function renderClients() {
  els.clientsList.innerHTML = '';
  renderArchivedClientsToggle();

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
    const emptyMessage = state.showArchivedClients
      ? 'No archived clients.'
      : (selectedTagFilters.size ? 'No clients match selected tags.' : 'No clients yet.');
    li.innerHTML = `
      <div class="empty-visual" style="width: auto; height: auto; border: none; background: transparent; margin-bottom: 8px;">
        <img src="../assets/empty-state-client.svg" alt="" style="max-width: 120px; opacity: 0.7;" />
      </div>
      <p style="margin:0;">${emptyMessage}</p>
    `;
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
    button.innerHTML = `
      <div class="client-title-row">
        <span class="client-color-dot" style="${color ? `background:${escapeHtml(color)};border-color:${escapeHtml(color)};` : ''}"></span>
        <span class="item-title">${escapeHtml(client.name)}</span>
      </div>
      <div class="item-meta">${client.noteCount} notes${client.archived ? ' • archived' : ''}</div>
    `;
    const preferredTags = normalizeSidebarTags(client.sidebarTags || [], client.profileTags || [], 8);
    const clientTags = preferredTags.length
      ? preferredTags
      : normalizeTagList(client.profileTags || [], 3);
    if (clientTags.length && !state.showArchivedClients) {
      const tagRow = document.createElement('div');
      tagRow.className = 'client-tag-row';
      for (const tag of clientTags) {
        tagRow.appendChild(createTagPill(tag, { datasetTag: false }));
      }
      button.appendChild(tagRow);
    }

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
  if (state.showArchivedClients) {
    state.clientTagFilters = [];
    els.clientTagFiltersWrap.hidden = true;
    els.clientTagFilters.innerHTML = '';
    return;
  }

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
    state.allClients
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

function renderProfileSidebarTagsList() {
  const availableTags = state.profileClientTagsDraft || [];
  const selectedTags = new Set((state.profileSidebarTagsDraft || []).map((tag) => String(tag).toLowerCase()));
  els.profileSidebarTagsList.innerHTML = '';
  if (!availableTags.length) {
    const empty = document.createElement('span');
    empty.className = 'profile-sidebar-empty';
    empty.textContent = 'Add client tags first.';
    els.profileSidebarTagsList.appendChild(empty);
    return;
  }

  for (const tag of availableTags) {
    const key = String(tag).toLowerCase();
    const selected = selectedTags.has(key);
    const chip = createTagPill(tag, { button: true, datasetTag: false });
    chip.classList.add('tag-chip');
    if (selected) {
      chip.classList.add('is-selected');
    }
    chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
    chip.title = selected ? `Hide ${tag} from client list` : `Show ${tag} in client list`;
    chip.addEventListener('click', () => {
      if (selected) {
        state.profileSidebarTagsDraft = (state.profileSidebarTagsDraft || []).filter(
          (entry) => String(entry).toLowerCase() !== key
        );
      } else {
        if ((state.profileSidebarTagsDraft || []).length >= 8) {
          showToast('Client list tags are limited to 8.', 'error');
          return;
        }
        state.profileSidebarTagsDraft = [...(state.profileSidebarTagsDraft || []), tag];
      }
      renderProfileSidebarTagsList();
      refreshProfileDirtyState();
    });
    els.profileSidebarTagsList.appendChild(chip);
  }
}

function renderProfileColorPalette() {
  els.profileColorPalette.innerHTML = '';
  const selectedColor = normalizeHexColor(state.profileColorValue);
  const previewColor = selectedColor || DEFAULT_TAG_COLOR;
  els.profileColorToggleBtn.style.background = previewColor;
  els.profileColorToggleBtn.style.borderColor = previewColor;
  els.profileColorToggleBtn.title = selectedColor ? `Client color: ${selectedColor}` : 'Client color: default';
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

function renderProfileNewTagCategoryOptions(selectedValue = '') {
  const selected = String(selectedValue || '').trim();
  const categories = [...(state.tagCategories || [])].sort((a, b) => a.name.localeCompare(b.name));
  const options = ['<option value="">Choose category...</option>'];
  for (const category of categories) {
    options.push(`<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`);
  }
  options.push('<option value="__new__">Create category...</option>');
  els.profileNewTagCategorySelect.innerHTML = options.join('');
  els.profileNewTagCategorySelect.value = selected && (categories.some((row) => row.id === selected) || selected === '__new__')
    ? selected
    : '';
}

function hideProfileNewCategoryRow() {
  els.profileNewCategoryRow.hidden = true;
  els.profileNewCategoryNameInput.value = '';
  els.profileNewCategoryColorInput.value = DEFAULT_TAG_COLOR;
}

function showProfileNewCategoryRow() {
  els.profileNewCategoryRow.hidden = false;
  els.profileNewCategoryNameInput.focus();
  els.profileNewCategoryNameInput.select();
}

function hideProfileNewTagRow() {
  els.profileNewTagRow.hidden = true;
  els.profileNewTagInput.value = '';
  els.profileNewTagCategorySelect.value = '';
  hideProfileNewCategoryRow();
}

function showProfileNewTagRow() {
  setProfileTagEditorOpen(true);
  els.profileNewTagRow.hidden = false;
  renderProfileNewTagCategoryOptions();
  if (!(state.tagCategories || []).length) {
    els.profileNewTagCategorySelect.value = '__new__';
    showProfileNewCategoryRow();
  } else {
    hideProfileNewCategoryRow();
  }
  els.profileNewTagInput.focus();
  els.profileNewTagInput.select();
}

function getUniqueTagCategoryId(baseId, categories) {
  const taken = new Set((categories || []).map((row) => row.id));
  let candidate = normalizeTagCategoryId(baseId) || 'category';
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${normalizeTagCategoryId(baseId) || 'category'}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function assignTagToCategory(tagName, categoryId, categories) {
  const normalizedTag = sanitizeName(tagName);
  if (!normalizedTag) {
    return categories || [];
  }

  const tagKey = normalizedTag.toLowerCase();
  const rows = (categories || []).map((row) => ({
    ...row,
    tags: normalizeTagList(row.tags || [], 400).filter((tag) => String(tag).toLowerCase() !== tagKey)
  }));

  const target = rows.find((row) => row.id === categoryId);
  if (!target) {
    return rows;
  }

  target.tags = [...target.tags, normalizedTag];
  return rows;
}

async function persistTagCategories(categories) {
  const payload = normalizeTagCategoriesConfig({ categories });
  const saved = await window.coachNotes.saveTagCategories(payload);
  state.tagCategories = normalizeTagCategoriesConfig(saved).categories;
  renderProfileNewTagCategoryOptions(els.profileNewTagCategorySelect.value);
  renderClientTagFilters();
  renderClients();
  renderClientContextStrip();
}

async function loadTagCategories() {
  const loaded = await window.coachNotes.getTagCategories();
  state.tagCategories = normalizeTagCategoriesConfig(loaded).categories;
  renderProfileNewTagCategoryOptions();
}

function cloneCategories(categories) {
  return normalizeTagCategoriesConfig({ categories }).categories;
}

function getProfileTagUsageMap() {
  const map = new Map();
  for (const client of state.allClients || []) {
    for (const tag of client.profileTags || []) {
      const normalized = sanitizeName(tag);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      const row = map.get(key) || { name: normalized, count: 0 };
      row.count += 1;
      map.set(key, row);
    }
  }
  return map;
}

function getCategoryForTagFrom(categories, tag) {
  const key = String(tag || '').trim().toLowerCase();
  if (!key) {
    return null;
  }

  for (const category of categories || []) {
    if ((category.tags || []).some((entry) => String(entry || '').toLowerCase() === key)) {
      return category;
    }
  }

  return null;
}

function getAllKnownProfileTagsForEditor(categories) {
  const usage = getProfileTagUsageMap();
  const seen = new Set();
  const tags = [];
  for (const row of usage.values()) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(row.name);
  }

  for (const category of categories || []) {
    for (const tag of category.tags || []) {
      const normalized = sanitizeName(tag);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) {
        continue;
      }
      seen.add(key);
      tags.push(normalized);
    }
  }

  return tags.sort((a, b) => a.localeCompare(b));
}

function renderTagEditorCategories() {
  const list = cloneCategories(state.tagEditorDraftCategories || []);
  state.tagEditorDraftCategories = list;
  els.tagCategoriesEditorList.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'advanced-note';
    empty.textContent = 'No categories yet. Create one below.';
    els.tagCategoriesEditorList.appendChild(empty);
    return;
  }

  for (const category of list) {
    const row = document.createElement('div');
    row.className = 'tag-category-editor-row';
    row.dataset.categoryId = category.id;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'tag-category-name-input';
    nameInput.value = category.name;
    nameInput.placeholder = 'Category name';
    nameInput.dataset.categoryId = category.id;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'tag-category-color-input';
    colorInput.value = normalizeHexColor(category.color) || DEFAULT_TAG_COLOR;
    colorInput.dataset.categoryId = category.id;

    const meta = document.createElement('span');
    meta.className = 'tag-category-meta';
    meta.textContent = `${(category.tags || []).length} tags`;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-tiny btn-danger tag-category-delete-btn';
    deleteBtn.dataset.categoryId = category.id;
    deleteBtn.textContent = 'Delete';

    row.append(nameInput, colorInput, meta, deleteBtn);
    els.tagCategoriesEditorList.appendChild(row);
  }
}

function renderTagEditorAssignments() {
  const categories = state.tagEditorDraftCategories || [];
  const allTags = getAllKnownProfileTagsForEditor(categories);
  const usage = getProfileTagUsageMap();
  els.tagAssignmentsList.innerHTML = '';

  if (!allTags.length) {
    const empty = document.createElement('p');
    empty.className = 'advanced-note';
    empty.textContent = 'No profile tags found yet.';
    els.tagAssignmentsList.appendChild(empty);
    return;
  }

  const categoryOptions = categories
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`)
    .join('');

  for (const tag of allTags) {
    const category = getCategoryForTagFrom(categories, tag);
    const usageCount = usage.get(String(tag).toLowerCase())?.count || 0;
    const row = document.createElement('div');
    row.className = 'tag-assignment-row';

    const preview = document.createElement('span');
    preview.className = 'tag-pill';
    preview.textContent = tag;
    applyTagColorStyle(preview, category?.color || DEFAULT_TAG_COLOR);

    const select = document.createElement('select');
    select.className = 'tag-assignment-select';
    select.dataset.tag = tag;
    select.innerHTML = `
      <option value="">Uncategorized</option>
      ${categoryOptions}
    `;
    select.value = category?.id || '';

    const usageMeta = document.createElement('span');
    usageMeta.className = 'tag-assignment-meta';
    usageMeta.textContent = usageCount > 0 ? `Used in ${usageCount} profiles` : 'Not used in profiles';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-tiny btn-danger tag-delete-btn';
    deleteBtn.dataset.tag = tag;
    deleteBtn.textContent = 'Delete Tag';

    row.append(preview, select, usageMeta, deleteBtn);
    els.tagAssignmentsList.appendChild(row);
  }
}

function renderEditTagsDialog() {
  renderTagEditorCategories();
  renderTagEditorAssignments();
}

function openEditTagsDialog() {
  state.tagEditorDraftCategories = cloneCategories(state.tagCategories || []);
  renderEditTagsDialog();
  els.editTagsDialog.showModal();
}

function updateDraftCategoryName(categoryId, nextName) {
  const categories = cloneCategories(state.tagEditorDraftCategories || []);
  const row = categories.find((entry) => entry.id === categoryId);
  if (!row) {
    return;
  }

  const normalized = sanitizeName(nextName || '');
  if (!normalized) {
    return;
  }

  row.name = normalized;
  state.tagEditorDraftCategories = categories;
}

function updateDraftCategoryColor(categoryId, nextColor) {
  const categories = cloneCategories(state.tagEditorDraftCategories || []);
  const row = categories.find((entry) => entry.id === categoryId);
  if (!row) {
    return;
  }

  row.color = normalizeHexColor(nextColor) || DEFAULT_TAG_COLOR;
  state.tagEditorDraftCategories = categories;
}

function deleteDraftCategory(categoryId) {
  const categories = cloneCategories(state.tagEditorDraftCategories || []);
  const target = categories.find((entry) => entry.id === categoryId);
  if (!target) {
    return;
  }

  if ((target.tags || []).length > 0) {
    const confirmDelete = window.confirm(
      `Delete category "${target.name}"?\n\n${target.tags.length} tags will become uncategorized.`
    );
    if (!confirmDelete) {
      return;
    }
  }

  state.tagEditorDraftCategories = categories.filter((entry) => entry.id !== categoryId);
  renderEditTagsDialog();
}

function addDraftCategoryFromInputs() {
  const name = sanitizeName(els.newTagCategoryNameInput.value || '');
  if (!name) {
    showToast('Category name is required.', 'error');
    return;
  }

  const categories = cloneCategories(state.tagEditorDraftCategories || []);
  const duplicate = categories.find((row) => String(row.name).toLowerCase() === name.toLowerCase());
  if (duplicate) {
    showToast('Category name already exists.', 'error');
    return;
  }

  const color = normalizeHexColor(els.newTagCategoryColorInput.value) || DEFAULT_TAG_COLOR;
  const id = getUniqueTagCategoryId(name, categories);
  categories.push({
    id,
    name,
    color,
    tags: []
  });

  state.tagEditorDraftCategories = categories;
  els.newTagCategoryNameInput.value = '';
  els.newTagCategoryColorInput.value = DEFAULT_TAG_COLOR;
  renderEditTagsDialog();
}

function setDraftTagCategory(tag, categoryId) {
  const normalizedTag = sanitizeName(tag);
  const categories = cloneCategories(state.tagEditorDraftCategories || []);
  for (const category of categories) {
    category.tags = (category.tags || []).filter((entry) => String(entry).toLowerCase() !== normalizedTag.toLowerCase());
  }

  if (categoryId) {
    const target = categories.find((row) => row.id === categoryId);
    if (target) {
      target.tags = [...normalizeTagList(target.tags || [], 400), normalizedTag];
    }
  }

  state.tagEditorDraftCategories = categories;
  renderEditTagsDialog();
}

async function deleteTagEverywhere(tag) {
  const normalizedTag = sanitizeName(tag);
  const usageCount = getProfileTagUsageMap().get(normalizedTag.toLowerCase())?.count || 0;
  const confirmText = usageCount > 0
    ? `Delete tag "${normalizedTag}"?\n\nIt is currently used in ${usageCount} client profiles and will be removed from those profiles.`
    : `Delete tag "${normalizedTag}"?`;
  if (!window.confirm(confirmText)) {
    return;
  }

  setBusy(true, 'Deleting tag...');
  try {
    await window.coachNotes.removeProfileTag({ tagName: normalizedTag });
    const categories = cloneCategories(state.tagEditorDraftCategories || []);
    for (const category of categories) {
      category.tags = (category.tags || []).filter((entry) => String(entry).toLowerCase() !== normalizedTag.toLowerCase());
    }
    state.tagEditorDraftCategories = categories;
    await persistTagCategories(categories);
    await loadClients();
    await loadClientProfile();
    renderEditTagsDialog();
    showToast(`Deleted tag: ${normalizedTag}`);
  } catch (error) {
    showToast(`Delete failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function saveEditTagsDialog(event) {
  event.preventDefault();
  const categories = cloneCategories(state.tagEditorDraftCategories || []);
  setBusy(true, 'Saving tag categories...');
  try {
    await persistTagCategories(categories);
    els.editTagsDialog.close();
    showToast('Saved tag categories.');
  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function submitProfileNewTagFromInput() {
  const created = String(els.profileNewTagInput.value || '').trim();
  const normalizedTag = sanitizeName(created);
  if (!normalizedTag) {
    showToast('Enter a tag name first.', 'error');
    return;
  }

  const selectedCategory = String(els.profileNewTagCategorySelect.value || '').trim();
  if (!selectedCategory) {
    showToast('Choose a category or create a new category for this tag.', 'error');
    return;
  }

  let workingCategories = (state.tagCategories || []).map((row) => ({
    ...row,
    tags: normalizeTagList(row.tags || [], 400)
  }));
  let categoryId = selectedCategory;

  if (selectedCategory === '__new__') {
    const categoryName = sanitizeName(els.profileNewCategoryNameInput.value || '');
    if (!categoryName) {
      showToast('Enter a category name.', 'error');
      return;
    }

    const chosenColor = normalizeHexColor(els.profileNewCategoryColorInput.value) || DEFAULT_TAG_COLOR;
    const existingByName = workingCategories.find(
      (row) => String(row.name).toLowerCase() === categoryName.toLowerCase()
    );
    if (existingByName) {
      categoryId = existingByName.id;
      existingByName.color = chosenColor;
    } else {
      categoryId = getUniqueTagCategoryId(categoryName, workingCategories);
      workingCategories = [
        ...workingCategories,
        {
          id: categoryId,
          name: categoryName,
          color: chosenColor,
          tags: []
        }
      ];
    }
  }

  workingCategories = assignTagToCategory(normalizedTag, categoryId, workingCategories);
  try {
    await persistTagCategories(workingCategories);
  } catch (error) {
    showToast(`Saving tag categories failed: ${error.message}`, 'error');
    return;
  }

  addProfileTag(created);
  hideProfileNewTagRow();
}

function setProfileClientTagsDraft(values) {
  state.profileClientTagsDraft = normalizeTagList(values, 40);
  state.profileSidebarTagsDraft = normalizeSidebarTags(state.profileSidebarTagsDraft || [], state.profileClientTagsDraft, 8);
  hideProfileNewTagRow();
  renderProfileTagPickerOptions();
  renderProfileClientTagsList();
  renderProfileSidebarTagsList();
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
  state.profileSidebarTagsDraft = normalizeSidebarTags(state.profileSidebarTagsDraft || [], state.profileClientTagsDraft, 8);
  renderProfileTagPickerOptions();
  renderProfileClientTagsList();
  renderProfileSidebarTagsList();
  refreshProfileDirtyState();
  return true;
}

function removeProfileTag(rawValue) {
  const key = String(rawValue || '').toLowerCase();
  state.profileClientTagsDraft = (state.profileClientTagsDraft || []).filter(
    (tag) => String(tag).toLowerCase() !== key
  );
  state.profileSidebarTagsDraft = normalizeSidebarTags(state.profileSidebarTagsDraft || [], state.profileClientTagsDraft, 8);
  renderProfileTagPickerOptions();
  renderProfileClientTagsList();
  renderProfileSidebarTagsList();
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
  function extractBracketCitationIds(value, hasExplicitPrefix = false) {
    const raw = String(value || '').trim();
    if (!raw) {
      return [];
    }

    const ids = [];
    const seenLocal = new Set();
    const pattern = /(?:^|[\s,;|/])(?:c:)?((?:note_)?\d+(?:_chunk_\d+)?)(?=$|[\s,;|/])/gi;
    let match = pattern.exec(raw);
    while (match) {
      const id = String(match[1] || '').trim();
      const key = id.toLowerCase();
      if (id && !seenLocal.has(key)) {
        seenLocal.add(key);
        ids.push(id);
      }
      match = pattern.exec(raw);
    }

    if (ids.length) {
      return ids;
    }

    const normalized = raw.replace(/^c:/i, '').trim();
    if (/^(?:note_)?\d+(?:_chunk_\d+)?$/i.test(normalized) || hasExplicitPrefix) {
      return normalized ? [normalized] : [];
    }

    return [];
  }

  const ids = [];
  const seen = new Set();
  const pattern = /\[(?:c:)?([^\]]+)\]/gi;
  let match = pattern.exec(answerText || '');
  while (match) {
    const hasExplicitPrefix = String(match[0] || '').toLowerCase().startsWith('[c:');
    const extracted = extractBracketCitationIds(match[1], hasExplicitPrefix);
    if (!extracted.length) {
      match = pattern.exec(answerText || '');
      continue;
    }

    for (const id of extracted) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
    match = pattern.exec(answerText || '');
  }

  for (const citation of citations || []) {
    const extracted = extractBracketCitationIds(citation, true);
    for (const id of extracted) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
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

  function extractBracketCitationIds(value, hasExplicitPrefix = false) {
    const raw = String(value || '').trim();
    if (!raw) {
      return [];
    }

    const ids = [];
    const seenLocal = new Set();
    const pattern = /(?:^|[\s,;|/])(?:c:)?((?:note_)?\d+(?:_chunk_\d+)?)(?=$|[\s,;|/])/gi;
    let match = pattern.exec(raw);
    while (match) {
      const id = String(match[1] || '').trim();
      const key = id.toLowerCase();
      if (id && !seenLocal.has(key)) {
        seenLocal.add(key);
        ids.push(id);
      }
      match = pattern.exec(raw);
    }

    if (ids.length) {
      return ids;
    }

    const normalized = raw.replace(/^c:/i, '').trim();
    if (/^(?:note_)?\d+(?:_chunk_\d+)?$/i.test(normalized) || hasExplicitPrefix) {
      return normalized ? [normalized] : [];
    }

    return [];
  }

  const html = escapeHtml(answerText || '').replace(/\[(c:)?([^\]]+)\]/gi, (full, prefix, rawId) => {
    const extracted = extractBracketCitationIds(rawId, Boolean(prefix));
    if (!extracted.length) {
      return full;
    }

    const rendered = [];
    for (const raw of extracted) {
      const id = resolveCitationId(raw);
      const number = id ? numberById.get(id) : null;
      if (!number) {
        rendered.push(`<span class="citation-missing">[${escapeHtml(raw)}]</span>`);
        continue;
      }
      rendered.push(`<button class="citation-chip" data-citation-id="${escapeHtml(id)}">[${number}]</button>`);
    }

    return rendered.join(' ');
  });

  const copyText = String(answerText || '').replace(/\[(c:)?([^\]]+)\]/gi, (full, prefix, rawId) => {
    const extracted = extractBracketCitationIds(rawId, Boolean(prefix));
    if (!extracted.length) {
      return full;
    }

    const rendered = [];
    for (const raw of extracted) {
      const id = resolveCitationId(raw);
      const number = id ? numberById.get(id) : null;
      if (!number) {
        rendered.push(`[${raw}]`);
        continue;
      }
      rendered.push(`[${number}]`);
    }

    return rendered.join(' ');
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
  resetStreamingState();
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
          <img class="empty-visual-img" src="../assets/empty-state-search.svg" alt="" aria-hidden="true" />
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
          <img class="empty-visual-img" src="../assets/empty-state-notes.svg" alt="" aria-hidden="true" />
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
  state.allClients = await window.coachNotes.getClients();
  state.clients = getVisibleClients();

  const selectedExists = state.selectedClientId
    ? state.allClients.some((client) => client.id === state.selectedClientId)
    : false;
  const selectedVisible = state.selectedClientId
    ? state.clients.some((client) => client.id === state.selectedClientId)
    : false;
  if (state.selectedClientId && (!selectedExists || !selectedVisible)) {
    state.selectedClientId = null;
    if (els.scopeSelect.value === 'client') {
      els.scopeSelect.value = 'all';
      state.scope = 'all';
    }
  }

  renderArchivedClientsToggle();
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
    sidebarTags: [...(state.profileSidebarTagsDraft || [])],
    clientColor: state.profileColorValue || '',
    coachNotes: String(els.profileCoachNotesInput.value || '').trim(),
    exerciseAtAGlance: parseMultilineList(els.profileExerciseInput.value),
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
    sidebarTags: draft.sidebarTags || [],
    clientColor: draft.clientColor || '',
    coachNotes: draft.coachNotes || '',
    exerciseAtAGlance: draft.exerciseAtAGlance || [],
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
    els.profileDialogTitle.textContent = 'Client Profile';
    els.profileClientName.textContent = 'Select a client to edit profile details.';
    els.profileUpdatedAt.textContent = '';
    els.profileDisabled.hidden = false;
    els.profileFormWrap.hidden = true;
    setProfileColorPopoverOpen(false);
    setProfileTagEditorOpen(false);
    els.archiveClientBtn.textContent = 'Archive Client';
    els.archiveClientBtn.disabled = true;
    els.profileTopInput.value = '';
    setProfileClientTagsDraft([]);
    state.profileSidebarTagsDraft = [];
    state.profileColorValue = '';
    els.profileCoachNotesInput.value = '';
    els.profileExerciseInput.value = '';
    els.profileMedicalInput.value = '';
    els.profileAcuteInput.value = '';
    els.profileCompletedInput.value = '';
    els.profileFutureInput.value = '';
    captureProfileSnapshot();
    renderProfileColorPalette();
    renderProfileSidebarTagsList();
    renderClientContextStrip();
    updateBusyUi();
    return;
  }

  const clientName = profile?.clientName || 'Selected client';
  const selectedClient = getSelectedClient();
  els.profileDialogTitle.textContent = `${clientName} - Profile`;
  els.profileClientName.textContent = clientName;
  els.profileUpdatedAt.textContent = profile?.updatedAt
    ? `Last updated: ${formatIsoDate(profile.updatedAt)}`
    : 'No saved profile yet.';
  els.profileDisabled.hidden = true;
  els.profileFormWrap.hidden = false;
  els.archiveClientBtn.textContent = selectedClient?.archived ? 'Restore Client' : 'Archive Client';
  els.archiveClientBtn.disabled = false;
  setProfileColorPopoverOpen(false);
  setProfileTagEditorOpen(true);
  els.profileTopInput.value = (profile?.topPriorities || []).join('\n');
  setProfileClientTagsDraft(profile?.clientTags || []);
  state.profileSidebarTagsDraft = normalizeSidebarTags(profile?.sidebarTags || [], profile?.clientTags || [], 8);
  state.profileColorValue = normalizeHexColor(profile?.clientColor || '');
  els.profileCoachNotesInput.value = profile?.coachNotes || '';
  els.profileExerciseInput.value = (profile?.exerciseAtAGlance || []).join('\n');
  els.profileMedicalInput.value = (profile?.ongoingMedicalConsiderations || []).join('\n');
  els.profileAcuteInput.value = (profile?.acuteInjuries || []).join('\n');
  els.profileCompletedInput.value = (profile?.completedFocus || []).join('\n');
  els.profileFutureInput.value = (profile?.futureFocus || []).join('\n');
  captureProfileSnapshot();
  renderProfileColorPalette();
  renderProfileSidebarTagsList();
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
      clientName: getSelectedClient()?.name || 'Selected client',
      topPriorities: [],
      clientTags: [],
      sidebarTags: [],
      clientColor: '',
      coachNotes: '',
      exerciseAtAGlance: [],
      ongoingMedicalConsiderations: [],
      acuteInjuries: [],
      completedFocus: [],
      futureFocus: [],
      updatedAt: null
    });
    showToast(`Load client profile failed: ${error.message}`, 'error');
  }
}

async function saveClientProfile(options = {}) {
  if (!state.selectedClientId) {
    showToast('Select a client before saving profile.', 'error');
    return false;
  }

  const topPrioritiesRaw = parseMultilineList(els.profileTopInput.value, 12);
  if (topPrioritiesRaw.length > 3) {
    showToast('Top Priorities is limited to 3 items.', 'error');
    return false;
  }

  const payload = {
    clientId: state.selectedClientId,
    topPriorities: topPrioritiesRaw,
    clientTags: [...(state.profileClientTagsDraft || [])],
    sidebarTags: [...(state.profileSidebarTagsDraft || [])],
    clientColor: state.profileColorValue || '',
    coachNotes: String(els.profileCoachNotesInput.value || '').trim(),
    exerciseAtAGlance: parseMultilineList(els.profileExerciseInput.value),
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
    showToast(`Saved profile for ${saved.clientName}.`);
    if (options?.closeDialog && els.clientProfileDialog.open) {
      els.clientProfileDialog.close();
    }
    return true;
  } catch (error) {
    showToast(`Save client profile failed: ${error.message}`, 'error');
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

  const activeClients = (state.allClients || []).filter((client) => !client.archived);
  for (const client of activeClients) {
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
  if (state.showArchivedClients && !state.selectedClientId) {
    state.notes = [];
    state.activeQuery = '';
    state.results = [];
    state.selectedNoteId = null;
    state.currentNote = null;
    state.selectedHighlight = null;
    renderResults();
    renderNote(null);
    return;
  }

  const filters = {};
  if (state.selectedClientId) {
    filters.clientId = state.selectedClientId;
    const selectedClient = getSelectedClient();
    if (selectedClient?.archived) {
      filters.includeArchivedClient = true;
    }
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

async function runSearch(inputQuery = null, options = {}) {
  const query = String(inputQuery ?? els.queryInput.value).trim();
  if (inputQuery !== null) {
    els.queryInput.value = query;
  }
  state.scope = els.scopeSelect.value;

  if (!query) {
    await loadNotes();
    return;
  }

  if (state.scope === 'client' && !state.selectedClientId) {
    showToast('Select a client or switch scope to All Clients.', 'error');
    return { ok: false, count: 0, error: 'No selected client.' };
  }

  const busyMessage = String(options?.busyMessage || '').trim() || 'Searching notes...';
  const noteKind = normalizeNoteKind(options?.noteKind);
  setBusy(true, busyMessage, {
    blocking: options?.blocking !== false
  });
  try {
    state.results = await window.coachNotes.search({
      query,
      scope: state.scope,
      clientId: state.scope === 'client' ? state.selectedClientId : null,
      includeArchivedClient: state.scope === 'client' ? Boolean(getSelectedClient()?.archived) : false,
      limit: 30,
      relevanceMode: els.relevanceModeSelect.value,
      noteKind
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
    showToast(`Search failed: ${error.message}`, 'error');
    return { ok: false, count: 0, error: error.message };
  } finally {
    setBusy(false);
  }
}

async function setArchivedClientView(showArchived) {
  state.showArchivedClients = Boolean(showArchived);
  state.clientTagFilters = [];
  await loadClients();
  await loadClientProfile();
  if (state.activeQuery) {
    await runSearch(state.activeQuery);
  } else {
    await loadNotes();
  }
}

async function toggleClientArchived(client) {
  const targetClient = client || getSelectedClient();
  if (!targetClient) {
    showToast('Select a client first.', 'error');
    return;
  }

  if (els.clientProfileDialog.open && targetClient.id === state.selectedClientId) {
    refreshProfileDirtyState();
    if (state.profileDirty) {
      const proceedWithDirty = window.confirm(
        'You have unsaved profile changes.\n\nContinue and discard those changes?'
      );
      if (!proceedWithDirty) {
        return;
      }
    }
  }

  const nextArchived = !Boolean(targetClient.archived);
  const confirmText = nextArchived
    ? `Archive ${targetClient.name}?\n\nArchived clients are hidden from All Clients search.`
    : `Restore ${targetClient.name} to active clients?`;
  if (!window.confirm(confirmText)) {
    return;
  }

  setBusy(true, nextArchived ? 'Archiving client...' : 'Restoring client...');
  try {
    const result = await window.coachNotes.setClientArchived({
      clientId: targetClient.id,
      archived: nextArchived
    });
    await loadClients();
    await loadClientProfile();
    if (state.activeQuery) {
      await runSearch(state.activeQuery);
    } else {
      await loadNotes();
    }
    if (!nextArchived && els.clientProfileDialog.open) {
      els.clientProfileDialog.close();
    } else if (nextArchived && !state.showArchivedClients && !state.selectedClientId && els.clientProfileDialog.open) {
      els.clientProfileDialog.close();
    }
    showToast(result.archived ? `Archived client: ${result.clientName}` : `Restored client: ${result.clientName}`);
  } catch (error) {
    showToast(`Client archive update failed: ${error.message}`, 'error');
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

  const requestId = generateRequestId('ask');
  const finishBusy = startBusyStages(
    'Finding relevant notes...',
    [
      { delayMs: 600, message: 'Reviewing relevant excerpts...' },
      { delayMs: 1800, message: 'Drafting answer...' },
      { delayMs: 3600, message: 'Finalizing answer...' }
    ],
    { blocking: false }
  );
  try {
    const topK = normalizeTopK(els.topKInput.value);
    els.topKInput.value = String(topK);
    syncDepthPresetFromTopK();
    beginStreamingAnswer(requestId, 'ask', `Question: ${question}`);
    const result = await window.coachNotes.ask({
      requestId,
      stream: true,
      question,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      includeArchivedClient: els.scopeSelect.value === 'client' ? Boolean(getSelectedClient()?.archived) : false,
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
    finishBusy();
  }
}

async function runSummarize() {
  const summaryMode = normalizeSummaryMode(els.summaryModeSelect?.value);
  const isConversationSummary = summaryMode === 'coaching_conversation';
  const noteKind = isConversationSummary ? 'transcript' : 'all';
  const summaryLabel = summaryMode === 'coaching_conversation'
    ? 'Coaching conversation summary'
    : 'Summary';
  const queryInput = String(els.queryInput.value || '').trim();
  if (!isConversationSummary && !queryInput) {
    renderAnswer('Enter search text or question first.');
    return;
  }

  let selectedNote = null;
  let searchResult = null;
  let query = queryInput;
  let retrieved = [];
  let contextOnSuccess = '';
  let contextOnError = '';
  let topK = normalizeTopK(els.topKInput.value);
  els.topKInput.value = String(topK);
  syncDepthPresetFromTopK();

  if (isConversationSummary) {
    if (!state.selectedNoteId) {
      renderAnswer('Select one transcript note first, then run Coaching conversation summary.');
      return;
    }

    selectedNote = state.currentNote;
    if (!selectedNote || Number(selectedNote.id) !== Number(state.selectedNoteId)) {
      selectedNote = await window.coachNotes.getNote(state.selectedNoteId);
      if (selectedNote) {
        renderNote(selectedNote);
      }
    }

    if (!selectedNote) {
      renderAnswer('Could not load the selected note.');
      return;
    }

    const chunks = Array.isArray(selectedNote.chunks) ? selectedNote.chunks : [];
    if (!chunks.length) {
      renderAnswer('Selected note has no indexed chunks. Reindex and try again.');
      return;
    }

    retrieved = chunks.slice(0, topK).map((chunk) => ({
      chunkId: chunk.id,
      noteId: selectedNote.id,
      notePath: selectedNote.path || '',
      noteTags: selectedNote.tags || [],
      title: selectedNote.title || 'Untitled',
      date: selectedNote.date || '',
      clientNames: selectedNote.clients || [],
      snippet: '',
      startOffset: chunk.start_offset,
      endOffset: chunk.end_offset,
      chunkText: chunk.content
    }));

    query = queryInput || `Selected note: ${selectedNote.title || 'Transcript'}`;
    contextOnSuccess = `${summaryLabel} of "${selectedNote.title || 'Selected note'}" (${retrieved.length} chunks)`;
    contextOnError = `${summaryLabel} of "${selectedNote.title || 'Selected note'}"`;
  } else {
    searchResult = await runSearch(queryInput, {
      busyMessage: 'Finding relevant notes...',
      blocking: false,
      noteKind
    });
    if (!searchResult?.ok) {
      return;
    }

    const matchCount = Number(searchResult.count) || 0;
    retrieved = (state.results || []).slice(0, topK).map((item) => ({
      chunkId: item.chunkId,
      noteId: item.noteId,
      notePath: item.notePath || '',
      noteTags: item.noteTags || [],
      title: item.title,
      date: item.date,
      clientNames: item.clientNames || [],
      snippet: item.snippet || '',
      startOffset: item.startOffset,
      endOffset: item.endOffset,
      chunkText: item.chunkText
    }));
    contextOnSuccess = matchCount > 0
      ? `${summaryLabel} of top ${Math.min(topK, matchCount)} of ${matchCount} matches for "${queryInput}"`
      : `${summaryLabel} for "${queryInput}"`;
    contextOnError = contextOnSuccess;
  }

  const requestId = generateRequestId('summarize');
  const finishBusy = startBusyStages(
    'Preparing summary...',
    [
      { delayMs: 600, message: 'Collecting top matches...' },
      { delayMs: 1700, message: 'Writing summary...' },
      { delayMs: 3400, message: 'Finalizing summary...' }
    ],
    { blocking: false }
  );
  try {
    beginStreamingAnswer(requestId, 'summarize', contextOnSuccess);
    const result = await window.coachNotes.summarize({
      requestId,
      stream: true,
      query,
      summaryMode,
      noteKind,
      scope: els.scopeSelect.value,
      clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
      includeArchivedClient: els.scopeSelect.value === 'client' ? Boolean(getSelectedClient()?.archived) : false,
      topK,
      relevanceMode: els.relevanceModeSelect.value,
      retrieved
    });
    const fallbackSuffix = result.fallbackUsed ? ' (fallback mode)' : '';
    const context = `${contextOnSuccess}${fallbackSuffix}`;

    renderAnswer(result.summary || '', result.sources || [], result.citations || [], {
      context,
      meta: {
        mode: 'summarize',
        summaryMode,
        prompt: query,
        scope: els.scopeSelect.value,
        clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
        noteId: isConversationSummary ? state.selectedNoteId : null,
        error: false
      },
      addToHistory: true,
      autoOpen: true
    });
  } catch (error) {
    renderAnswer(`Summarize failed: ${error.message}`, [], [], {
      context: contextOnError,
      meta: {
        mode: 'summarize',
        summaryMode,
        prompt: query,
        scope: els.scopeSelect.value,
        clientId: els.scopeSelect.value === 'client' ? state.selectedClientId : null,
        noteId: isConversationSummary ? state.selectedNoteId : null,
        error: true
      },
      addToHistory: true,
      autoOpen: true
    });
  } finally {
    finishBusy();
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

  const selectedClient = getSelectedClient();
  els.newNoteClientSelect.value = selectedClient && !selectedClient.archived ? selectedClient.name : '';

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
    showToast('Client name is required.', 'error');
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
    showToast(`Created client: ${created.name}`);
  } catch (error) {
    showToast(`Create client failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function openEditNoteDialog() {
  if (!state.currentNote || !state.selectedNoteId) {
    showToast('Select a note before editing.', 'error');
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
    showToast('Select a note before editing.', 'error');
    return;
  }

  const title = String(els.editNoteTitleInput.value || '').trim();
  if (!title) {
    showToast('Title is required to save note changes.', 'error');
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
    showToast(`Updated note: ${updated.title}`);
  } catch (error) {
    showToast(`Update note failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function deleteCurrentNote() {
  if (!state.selectedNoteId || !state.currentNote) {
    showToast('Select a note before deleting.', 'error');
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
    showToast(`Moved note to Deleted Notes: ${result.title}`);
  } catch (error) {
    showToast(`Delete note failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function createNewNote(event) {
  event.preventDefault();
  const title = els.newNoteTitleInput.value.trim();
  if (!title) {
    showToast('Title is required to create a note.', 'error');
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
    showToast(`Created note: ${created.title}`);
  } catch (error) {
    showToast(`Create note failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function getClientNameById(clientId) {
  const id = Number(clientId);
  if (!Number.isFinite(id)) {
    return '';
  }

  return (state.allClients || []).find((client) => client.id === id)?.name || '';
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

  for (const client of (state.allClients || []).filter((row) => !row.archived)) {
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    els.saveAnswerClientSelect.appendChild(option);
  }

  if (selected && (state.allClients || []).some((client) => !client.archived && client.name === selected)) {
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

  if (!(state.allClients || []).some((client) => !client.archived)) {
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
    showToast(`Update check failed: ${failedMessage}`, 'error');
    return;
  }

  if (!result) {
    return;
  }

  if (result.updateAvailable) {
    const summary = `Update available: v${result.latestVersion} (current v${result.currentVersion}).`;
    showToast(summary);
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
    showToast('No answer available to copy.', 'error');
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
    showToast(`Copy failed: ${error.message}`, 'error');
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
    showToast(`Saving settings failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function init() {
  initTheme();
  await initTextSizeMode();
  state.settings = await window.coachNotes.getSettings();
  state.status = state.settings.status || {};
  updateBusyUi();
  updateStatusLine();

  window.coachNotes.onStatus((next) => {
    state.status = next;
    updateStatusLine();
    updateBusyUi();
  });

  window.coachNotes.onLlmStream((event) => {
    const requestId = String(event?.requestId || '').trim();
    if (!requestId || requestId !== state.streamingRequestId) {
      return;
    }

    const type = String(event?.type || '').trim().toLowerCase();
    if (type === 'start') {
      const mode = String(event?.mode || state.streamingMode || '').toLowerCase();
      setBusyMessage(mode === 'summarize' ? 'Streaming summary...' : 'Streaming answer...');
      return;
    }

    if (type === 'delta') {
      appendStreamingAnswer(requestId, event?.delta || '');
      return;
    }

    if (type === 'error') {
      const message = String(event?.error || '').trim();
      if (message) {
        appendStreamingAnswer(requestId, `\n\n${message}`);
      }
    }
  });

  await loadTagCategories();
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
  els.textSizeGroup.addEventListener('change', (event) => {
    const target = event.target;
    if (!target || target.name !== 'textSize') {
      return;
    }

    applyTextSizeMode(target.value, true);
  });
  setMenuOpen(false);
  els.moreMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenuOpen(els.moreMenu.hidden);
  });
  document.addEventListener('click', (event) => {
    if (els.moreMenu.hidden) {
      if (state.profileColorPopoverOpen && !els.profileColorPopover.contains(event.target) && event.target !== els.profileColorToggleBtn) {
        setProfileColorPopoverOpen(false);
      }
      return;
    }

    if (!els.moreMenu.contains(event.target) && event.target !== els.moreMenuBtn) {
      setMenuOpen(false);
    }
    if (state.profileColorPopoverOpen && !els.profileColorPopover.contains(event.target) && event.target !== els.profileColorToggleBtn) {
      setProfileColorPopoverOpen(false);
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
  els.editTagsBtn.addEventListener('click', () => {
    setMenuOpen(false);
    openEditTagsDialog();
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
    if (els.scopeSelect.value === 'client') {
      els.scopeSelect.value = 'all';
      state.scope = 'all';
    }
    renderClients();
    renderClientContextStrip();
    if (state.activeQuery) {
      await runSearch(state.activeQuery);
    } else {
      await loadNotes();
    }
    await loadClientProfile();
  });
  els.archivedClientsBtn.addEventListener('click', async () => {
    await setArchivedClientView(!state.showArchivedClients);
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
  els.summaryModeSelect.addEventListener('change', () => {
    els.summaryModeSelect.value = normalizeSummaryMode(els.summaryModeSelect.value);
    if (state.queryMode === 'summarize') {
      setQueryMode('summarize');
    }
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
  els.archiveClientBtn.addEventListener('click', async () => {
    await toggleClientArchived(getSelectedClient());
  });
  const profileInputs = [
    els.profileTopInput,
    els.profileCoachNotesInput,
    els.profileExerciseInput,
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
  els.profileColorToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setProfileColorPopoverOpen(!state.profileColorPopoverOpen);
  });
  els.clearProfileColorBtn.addEventListener('click', () => {
    state.profileColorValue = '';
    renderProfileColorPalette();
    refreshProfileDirtyState();
    setProfileColorPopoverOpen(false);
  });
  els.profileTagsToggleBtn.addEventListener('click', () => {
    setProfileTagEditorOpen(!state.profileTagEditorOpen);
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
  els.profileConfirmNewTagBtn.addEventListener('click', async () => {
    await submitProfileNewTagFromInput();
  });
  els.profileCancelNewTagBtn.addEventListener('click', () => {
    hideProfileNewTagRow();
  });
  els.profileNewTagCategorySelect.addEventListener('change', () => {
    const picked = String(els.profileNewTagCategorySelect.value || '').trim();
    if (picked === '__new__') {
      showProfileNewCategoryRow();
      return;
    }

    hideProfileNewCategoryRow();
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
  els.profileNewCategoryNameInput.addEventListener('keydown', (event) => {
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
  els.tagCategoriesEditorList.addEventListener('change', (event) => {
    const target = event.target;
    if (target.classList.contains('tag-category-name-input')) {
      updateDraftCategoryName(target.dataset.categoryId || '', target.value);
      renderEditTagsDialog();
      return;
    }

    if (target.classList.contains('tag-category-color-input')) {
      updateDraftCategoryColor(target.dataset.categoryId || '', target.value);
      renderEditTagsDialog();
    }
  });
  els.tagCategoriesEditorList.addEventListener('click', (event) => {
    const button = event.target.closest('.tag-category-delete-btn');
    if (!button) {
      return;
    }

    deleteDraftCategory(button.dataset.categoryId || '');
  });
  els.tagAssignmentsList.addEventListener('change', (event) => {
    const select = event.target.closest('.tag-assignment-select');
    if (!select) {
      return;
    }

    setDraftTagCategory(select.dataset.tag || '', String(select.value || ''));
  });
  els.tagAssignmentsList.addEventListener('click', async (event) => {
    const button = event.target.closest('.tag-delete-btn');
    if (!button) {
      return;
    }

    await deleteTagEverywhere(button.dataset.tag || '');
  });
  els.addTagCategoryBtn.addEventListener('click', () => {
    addDraftCategoryFromInputs();
  });
  els.newTagCategoryNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftCategoryFromInputs();
    }
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
      showToast('Root folder selected. Click Save & Reindex to apply.');
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
  els.editTagsForm.addEventListener('submit', saveEditTagsDialog);
  els.cancelEditTagsBtn.addEventListener('click', () => {
    els.editTagsDialog.close();
  });
  els.editTagsDialog.addEventListener('close', () => {
    state.tagEditorDraftCategories = [];
  });
}

init().catch((error) => {
  renderAnswer(`Initialization failed: ${error.message}`);
});
