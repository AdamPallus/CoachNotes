const state = {
  settings: null,
  clients: [],
  selectedClientId: null,
  selectedClientDetail: null,
  intakeSources: [],
  noteSources: [],
  viewMode: 'intake',
  detailPage: 'snapshot',
  editSectionKey: '',
  lastUpdateNotice: null,
  askResult: null,
  askLoading: false,
  coachHome: null,
  coachHomeTab: 'attention',
  expandedHomeLanes: new Set(),
  sessionNotesQuery: '',
  sessionNotesType: 'all',
  clientSearchQuery: '',
  clientProfileTagFilter: '',
  clientSortMode: 'name',
  theme: 'light',
  navigationHistory: [],
  restoringNavigation: false,
  loadingClientId: null,
  askAppliedPresetPrompt: '',
  askCustomPromptDraft: '',
  noteTitlePresets: [],
  noteAnnotationPresets: [],
  todoTitlePresets: [],
  addTodoSectionKey: 'coachTasks',
  noteRetryBlocked: false,
  planningHiddenStatuses: new Set(['completed', 'abandoned', 'outdated']),
  expandedPlanningSections: new Set(),
  activeBaseline: null,
  baselineDraft: null,
  busyCount: 0
};

const baselineSections = [
  { key: 'clientProfile', label: 'Client Profile', type: 'object', rows: 6 },
  { key: 'overview', label: 'Current Baseline Snapshot', type: 'text', rows: 4 },
  { key: 'coachTasks', label: 'Coach To-Dos', type: 'list', rows: 5 },
  { key: 'flags', label: 'Flags', type: 'list', rows: 6 },
  { key: 'goalsValues', label: 'Client Goals', type: 'list', rows: 5 },
  { key: 'clientValues', label: 'Client Values', type: 'list', rows: 4 },
  { key: 'coachingPlanApproach', label: 'Coaching Plan / Approach', type: 'list', rows: 5 },
  { key: 'programChanges', label: 'Program Changes', type: 'list', rows: 5 },
  { key: 'progressTracking', label: 'Progress Tracking', type: 'list', rows: 5 },
  { key: 'engagementNotes', label: 'Engagement', type: 'list', rows: 4 },
  { key: 'nutritionThreads', label: 'Nutrition', type: 'list', rows: 5 },
  { key: 'mindsetThreads', label: 'Mindset', type: 'list', rows: 5 },
  { key: 'exerciseThreads', label: 'Exercise', type: 'list', rows: 5 },
  { key: 'resourcesShared', label: 'Resources', type: 'list', rows: 4 },
  { key: 'suggestedTags', label: 'Suggested Tags', type: 'tags', rows: 3 },
  { key: 'timeline', label: 'Timeline', type: 'list', rows: 6 },
  { key: 'missingInfo', label: 'Missing Info', type: 'list', rows: 4 },
  { key: 'confidenceNotes', label: 'Confidence Notes', type: 'list', rows: 4 }
];

const prioritizableSections = new Set(['coachTasks', 'goalsValues']);
const defaultHiddenPlanningStatuses = new Set(['completed', 'abandoned', 'outdated']);
const closedPlanningStatuses = new Set(['completed', 'abandoned', 'outdated']);
const planningHiddenStatusesStorageKey = 'coachnotes.planningHiddenStatuses.v1';
const clientSortStorageKey = 'coachnotes.clientSortMode.v1';
const noteTitlePresetsStorageKey = 'coachnotes.noteTitlePresets.v1';
const noteAnnotationPresetsStorageKey = 'coachnotes.noteAnnotationPresets.v1';
const todoTitlePresetsStorageKey = 'coachnotes.todoTitlePresets.v1';
const themeStorageKey = 'coachnotes.theme.v1';
const maxSavedPresets = 12;
const maxNavigationHistory = 20;
let clientProfileTagFilterTimer = null;
let clientNavigationSequence = 0;
let clientLoadingTimer = null;

const clientProfileExportPrompt = `Create an Everfit client profile from the client intake notes and any related coaching notes.

Use only information supported by the source material. Do not invent details. If a field is not mentioned, leave it blank. Keep the profile concise, coach-friendly, and easy to paste into Everfit. Use plain language and avoid medical diagnosis language beyond what the client/source explicitly states.

Return only the profile. Do not include commentary, citations, source numbers, bracketed references, source notes, markdown fences, or coach/practice guidance.

For the Phone section, include the client's phone number if available, phone type if mentioned, whether calling and/or texting is okay, and their preferred "SOS system" contact plan if the coach has not heard from them in 4+ weeks. If any part is not mentioned, leave it blank.

Format the output exactly like this:

Name:
Pronouns:
DOB:
Age:
Location:

Phone:
Number:
Phone type:
Call/text okay:
SOS system if no contact for 4+ weeks:

CLIENT PROFILE TEMPLATE (Everfit)

Family life, job, pets, hobbies:

Height/Weight:

Training experience:

Equipment access:

Current training goals:

Injuries or limitations, including pelvic floor issues, perimenopause, and menopause:

Nutrition habits/preferences:

GLP 1 use:

Disordered eating or eating disorder:

Top 3 nutrition goals:
1.
2.
3.

Mindset or motivation considerations:

Other coaching considerations:

Any red flags or important items for the coach to consider:

Missing or unclear information:`;

const initialWelcomeMessagePrompt = `Write a warm client-facing initial welcome message from the coach to this client. This is a welcome note, not an intake summary.

Use only information supported by the source material. Do not invent details. If the official coaching start date is not available, leave a clear placeholder for the coach to fill in.

Return only the client-ready message. Do not include commentary, citations, source notes, or coach/practice guidance.

Structure the message naturally:

Open by thanking them for completing their intake.
Use 2 or 3 meaningful personal details only if they help the client feel seen. Do not list demographics or biographical facts.
Synthesize what matters to them, what they want to accomplish, and why those goals matter for their life.
Briefly reassure them that coaching will account for their needs, preferences, history, and relevant considerations. Do not list sensitive medical, mental health, pelvic floor, eating disorder, medication, or diagnosis details unless absolutely necessary for the welcome message.
Let them know they are in the right place and will be supported throughout coaching.
Tell them their official coaching start date.
Explain that on their official coaching start date they will receive their first nutrition and mindset lessons and access to their training programs.
Ask: Do you need help selecting a training program? If so, let me know and we can discuss it.
Invite questions and encourage them to share what is and is not working so coaching can be adjusted.
Close warmly with: I'm so happy you're here!

Style rules:

Focus on the client, not the coach.
Avoid first person statements like I love or I'm proud of you.
Do not try to mention every important detail from the intake. Choose the details that create the warmest and most useful welcome.
Do not simply repeat their intake answers. Synthesize the information so they feel understood.
Use a warm, compassionate tone.
Do not use hyphens, em dashes, or en dashes.
Do not use contrast framing such as It's not X, it's Y.`;

const priorityOptions = [
  { value: 'none', label: 'No priority', rank: 4, className: 'priority-none' },
  { value: 'high', label: 'High', rank: 1, className: 'priority-high' },
  { value: 'medium', label: 'Medium', rank: 2, className: 'priority-medium' },
  { value: 'low', label: 'Low', rank: 3, className: 'priority-low' }
];

const planningStatusOptions = [
  { value: 'active', label: 'In Progress', rank: 1, className: 'status-active' },
  { value: 'recommended', label: 'Recommended', rank: 2, className: 'status-recommended' },
  { value: 'future', label: 'Future', rank: 3, className: 'status-future' },
  { value: 'blocked', label: 'Blocked', rank: 4, className: 'status-blocked' },
  { value: 'completed', label: 'Completed', rank: 5, className: 'status-completed' },
  { value: 'abandoned', label: 'Abandoned', rank: 6, className: 'status-abandoned' },
  { value: 'outdated', label: 'Outdated', rank: 7, className: 'status-outdated' },
  { value: 'needs-review', label: 'Needs Review', rank: 8, className: 'status-needs-review' }
];

const detailPages = [
  { key: 'snapshot', label: 'Snapshot' },
  { key: 'bio', label: 'Bio & Intake' },
  { key: 'approach', label: 'Coaching Plan' },
  { key: 'goals', label: 'Goals' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'program', label: 'Program Changes' },
  { key: 'progress', label: 'Progress' },
  { key: 'notes', label: 'Session Notes' },
  { key: 'resources', label: 'Resources' }
];

const defaultCoachTemplate = {
  schemaVersion: 'coach_template.v1',
  guidance: {
    coachingApproach: [
      'Prioritize practical, evidence-linked coaching context that helps the coach decide what needs attention now.',
      'Keep client dashboards concise and focused on current direction, pain points, momentum, commitments, and watch-outs.'
    ].join('\n'),
    messageStyle: [
      'Client-facing drafts should be warm, direct, concise, and specific.',
      'Avoid diagnosis language, overpromising, or adding details that are not supported by the client notes.'
    ].join('\n'),
    curriculumNotes: ''
  },
  profileSelectFields: [
    {
      key: 'curriculumType',
      label: 'Curriculum',
      chipLabel: 'Curriculum',
      className: 'profile-chip-curriculum',
      options: ['GGS Coaching', 'GLP-1', 'Menopause']
    },
    {
      key: 'programType',
      label: 'Program',
      chipLabel: 'Program',
      className: 'profile-chip-program',
      options: [
        'Fat Loss 3x',
        'Fat Loss 4x',
        'Strength Gain',
        'Pull-Up Strength Gain',
        'Muscle Gain',
        'Dumbbells and Bands',
        'Bodyweight and Bands',
        'KB and Bands',
        'Start Training',
        'Prenatal',
        'Postnatal',
        'Longevity',
        'Cardio',
        'Mobility',
        'Travel'
      ]
    },
    {
      key: 'cohort',
      label: 'Cohort',
      chipLabel: 'Cohort',
      className: 'profile-chip-cohort',
      options: ['January', 'April', 'July']
    },
    {
      key: 'programFormat',
      label: 'Program Format',
      chipLabel: 'Format',
      className: 'profile-chip-format',
      options: ['Coach Assigned', 'On Demand', 'Workout Collections']
    },
    {
      key: 'primaryTrainingGoal',
      label: 'Primary Training Goal',
      chipLabel: 'Goal',
      className: 'profile-chip-goal',
      options: ['Fat Loss', 'Body Recomposition', 'Strength Gain', 'Longevity', 'Bone Density', 'Muscle Maintenance']
    }
  ],
  profileMultiSelectFields: [
    {
      key: 'contraindications',
      label: 'Contraindications',
      chipLabel: 'Contraindication',
      className: 'profile-chip-contraindication',
      options: [
        'Osteopenia',
        'Autoimmune Condition',
        'Surgery',
        'Perimenopause',
        'Sleep Disorder',
        'Eating Disorder'
      ]
    }
  ]
};

const profileControlKeys = new Set([
  'curriculumType',
  'programType',
  'cohort',
  'programFormat',
  'primaryTrainingGoal',
  'contraindications',
  'curriculumStartDate',
  'programStartDate',
  'programWeek',
  'trainingProgramWeek'
]);

const els = {
  statusLine: document.getElementById('statusLine'),
  backBtn: document.getElementById('backBtn'),
  onboardBtn: document.getElementById('onboardBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeToggleLabel: document.getElementById('themeToggleLabel'),
  settingsBtn: document.getElementById('settingsBtn'),
  coachHomeBtn: document.getElementById('coachHomeBtn'),
  clientSearchInput: document.getElementById('clientSearchInput'),
  clientFilterToggle: document.getElementById('clientFilterToggle'),
  clientBioFilter: document.getElementById('clientBioFilter'),
  clientProfileTagFilter: document.getElementById('clientProfileTagFilter'),
  clientProfileTagOptions: document.getElementById('clientProfileTagOptions'),
  clientSortButtons: [...document.querySelectorAll('[data-client-sort]')],
  clientList: document.getElementById('clientList'),
  revealVaultBtn: document.getElementById('revealVaultBtn'),
  mainSurface: document.querySelector('.main-surface'),
  coachHomePanel: document.getElementById('coachHomePanel'),
  coachHomeContent: document.getElementById('coachHomeContent'),
  refreshCoachHomeBtn: document.getElementById('refreshCoachHomeBtn'),
  intakePanel: document.getElementById('intakePanel'),
  resetIntakeBtn: document.getElementById('resetIntakeBtn'),
  runIntakeBtn: document.getElementById('runIntakeBtn'),
  clientNameInput: document.getElementById('clientNameInput'),
  programInput: document.getElementById('programInput'),
  coachNoteInput: document.getElementById('coachNoteInput'),
  intakeProgramSettings: document.getElementById('intakeProgramSettings'),
  importFilesBtn: document.getElementById('importFilesBtn'),
  addSourceBtn: document.getElementById('addSourceBtn'),
  clearSourcesBtn: document.getElementById('clearSourcesBtn'),
  sourceTypeInput: document.getElementById('sourceTypeInput'),
  sourceTitleInput: document.getElementById('sourceTitleInput'),
  sourceDateInput: document.getElementById('sourceDateInput'),
  sourceAnnotationInput: document.getElementById('sourceAnnotationInput'),
  sourceTextInput: document.getElementById('sourceTextInput'),
  sourceList: document.getElementById('sourceList'),
  reviewPanel: document.getElementById('reviewPanel'),
  reviewMeta: document.getElementById('reviewMeta'),
  baselineFields: document.getElementById('baselineFields'),
  baselineJsonInput: document.getElementById('baselineJsonInput'),
  acceptBaselineBtn: document.getElementById('acceptBaselineBtn'),
  clientDetailPanel: document.getElementById('clientDetailPanel'),
  detailClientName: document.getElementById('detailClientName'),
  detailMeta: document.getElementById('detailMeta'),
  detailContent: document.getElementById('detailContent'),
  askClientBtn: document.getElementById('askClientBtn'),
  addNoteBtn: document.getElementById('addNoteBtn'),
  deleteClientBtn: document.getElementById('deleteClientBtn'),
  askDialog: document.getElementById('askDialog'),
  askForm: document.getElementById('askForm'),
  askTitle: document.getElementById('askTitle'),
  askOutputTypeInput: document.getElementById('askOutputTypeInput'),
  askScopeInput: document.getElementById('askScopeInput'),
  askTimeWindowInput: document.getElementById('askTimeWindowInput'),
  askPromptInput: document.getElementById('askPromptInput'),
  askResultPanel: document.getElementById('askResultPanel'),
  askResultMeta: document.getElementById('askResultMeta'),
  askResultOutput: document.getElementById('askResultOutput'),
  askSourceList: document.getElementById('askSourceList'),
  askSubmitBtn: document.getElementById('askSubmitBtn'),
  askProcessing: document.getElementById('askProcessing'),
  askProcessingTitle: document.getElementById('askProcessingTitle'),
  askProcessingText: document.getElementById('askProcessingText'),
  copyAskResultBtn: document.getElementById('copyAskResultBtn'),
  saveAskResultBtn: document.getElementById('saveAskResultBtn'),
  cancelAskBtn: document.getElementById('cancelAskBtn'),
  editSectionDialog: document.getElementById('editSectionDialog'),
  editSectionForm: document.getElementById('editSectionForm'),
  editSectionTitle: document.getElementById('editSectionTitle'),
  editSectionHelp: document.getElementById('editSectionHelp'),
  editSectionInput: document.getElementById('editSectionInput'),
  cancelEditSectionBtn: document.getElementById('cancelEditSectionBtn'),
  addNoteDialog: document.getElementById('addNoteDialog'),
  addNoteForm: document.getElementById('addNoteForm'),
  addNoteTitle: document.getElementById('addNoteTitle'),
  noteSourceTypeInput: document.getElementById('noteSourceTypeInput'),
  noteTitleInput: document.getElementById('noteTitleInput'),
  noteDateInput: document.getElementById('noteDateInput'),
  noteAnnotationInput: document.getElementById('noteAnnotationInput'),
  noteTextInput: document.getElementById('noteTextInput'),
  noteErrorPanel: document.getElementById('noteErrorPanel'),
  noteTitlePresetList: document.getElementById('noteTitlePresetList'),
  noteAnnotationPresetList: document.getElementById('noteAnnotationPresetList'),
  saveNoteTitlePresetBtn: document.getElementById('saveNoteTitlePresetBtn'),
  saveNoteAnnotationPresetBtn: document.getElementById('saveNoteAnnotationPresetBtn'),
  importNoteFilesBtn: document.getElementById('importNoteFilesBtn'),
  clearNoteSourcesBtn: document.getElementById('clearNoteSourcesBtn'),
  noteSourceList: document.getElementById('noteSourceList'),
  cancelAddNoteBtn: document.getElementById('cancelAddNoteBtn'),
  updateNoteSubmitBtn: document.getElementById('updateNoteSubmitBtn'),
  addTodoDialog: document.getElementById('addTodoDialog'),
  addTodoForm: document.getElementById('addTodoForm'),
  todoTitleInput: document.getElementById('todoTitleInput'),
  todoDueDateInput: document.getElementById('todoDueDateInput'),
  todoPriorityInput: document.getElementById('todoPriorityInput'),
  todoStatusInput: document.getElementById('todoStatusInput'),
  todoDetailsInput: document.getElementById('todoDetailsInput'),
  todoTitlePresetList: document.getElementById('todoTitlePresetList'),
  saveTodoTitlePresetBtn: document.getElementById('saveTodoTitlePresetBtn'),
  cancelAddTodoBtn: document.getElementById('cancelAddTodoBtn'),
  citationTooltip: document.getElementById('citationTooltip'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  vaultInput: document.getElementById('vaultInput'),
  chooseVaultBtn: document.getElementById('chooseVaultBtn'),
  proxyInput: document.getElementById('proxyInput'),
  tokenInput: document.getElementById('tokenInput'),
  coachApproachInput: document.getElementById('coachApproachInput'),
  messageStyleInput: document.getElementById('messageStyleInput'),
  curriculumNotesInput: document.getElementById('curriculumNotesInput'),
  profileOptionsPanel: document.getElementById('profileOptionsPanel'),
  resetCoachTemplateBtn: document.getElementById('resetCoachTemplateBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  toast: document.getElementById('toast'),
  busyOverlay: document.getElementById('busyOverlay'),
  busyText: document.getElementById('busyText')
};

let toastTimer = null;
let copyAskResetTimer = null;

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sanitizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function makeLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSectionConfig(key) {
  return baselineSections.find((section) => section.key === key) || { key, label: key, type: 'list', rows: 6 };
}

function sectionLabel(key) {
  return getSectionConfig(key).label || key;
}

function valuesEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function loadStringList(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => sanitizeName(entry)).filter(Boolean).slice(0, maxSavedPresets);
    }
  } catch {
    // Local convenience presets can safely fall back to empty.
  }
  return [];
}

function saveStringList(storageKey, values) {
  try {
    localStorage.setItem(storageKey, JSON.stringify((Array.isArray(values) ? values : []).slice(0, maxSavedPresets)));
  } catch {
    // Presets are best-effort local convenience state.
  }
}

function upsertPresetValue(storageKey, values, value) {
  const normalized = sanitizeName(value).slice(0, 180);
  if (!normalized) {
    return values;
  }
  const existing = Array.isArray(values) ? values : [];
  const next = [
    normalized,
    ...existing.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())
  ].slice(0, maxSavedPresets);
  saveStringList(storageKey, next);
  return next;
}

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // Theme preference can fall back to the operating system.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, persist = true) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  const darkMode = nextTheme === 'dark';
  els.themeToggleBtn.setAttribute('aria-pressed', darkMode ? 'true' : 'false');
  els.themeToggleBtn.title = darkMode ? 'Use light mode' : 'Use dark mode';
  els.themeToggleLabel.textContent = darkMode ? 'Light' : 'Dark';
  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // Theme persistence is a local convenience.
    }
  }
}

function syncChoiceGroups() {
  document.querySelectorAll('[data-choice-group]').forEach((group) => {
    const control = document.getElementById(group.dataset.choiceTarget || '');
    if (!control) {
      return;
    }
    group.querySelectorAll('[data-choice-value]').forEach((button) => {
      const selected = button.dataset.choiceValue === control.value;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.disabled = control.disabled;
    });
  });
  const scopeLabel = els.askScopeInput?.selectedOptions?.[0]?.textContent || '';
  const timeLabel = els.askTimeWindowInput?.selectedOptions?.[0]?.textContent || '';
  const summary = document.getElementById('askContextSummary');
  if (summary) {
    summary.textContent = `Context: ${scopeLabel} · ${timeLabel}`;
  }
}

function loadLocalPreferences() {
  applyTheme(getPreferredTheme(), false);
  loadPlanningHiddenStatuses();
  state.noteTitlePresets = loadStringList(noteTitlePresetsStorageKey);
  state.noteAnnotationPresets = loadStringList(noteAnnotationPresetsStorageKey);
  state.todoTitlePresets = loadStringList(todoTitlePresetsStorageKey);
  try {
    const savedSortMode = localStorage.getItem(clientSortStorageKey);
    state.clientSortMode = savedSortMode === 'updated' ? 'updated' : 'name';
  } catch {
    state.clientSortMode = 'name';
  }
}

function wordCount(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function showToast(message, kind = 'info') {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className = `toast is-visible ${kind === 'error' ? 'error' : ''}`;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible');
    setTimeout(() => {
      els.toast.hidden = true;
    }, 180);
  }, kind === 'error' ? 9000 : 3200);
}

function setBusy(on, message = 'Working...') {
  state.busyCount = Math.max(0, state.busyCount + (on ? 1 : -1));
  if (on) {
    els.busyText.textContent = message;
  }
  els.busyOverlay.hidden = state.busyCount === 0;
}

function setClientNavigationLoading(clientId, active) {
  window.clearTimeout(clientLoadingTimer);
  clientLoadingTimer = null;
  if (!active) {
    state.loadingClientId = null;
    els.mainSurface.classList.remove('is-client-loading');
    els.mainSurface.setAttribute('aria-busy', 'false');
    els.clientList.querySelectorAll('.client-button.is-loading').forEach((button) => {
      button.classList.remove('is-loading');
    });
    return;
  }

  const normalizedClientId = Number(clientId);
  state.loadingClientId = normalizedClientId;
  els.mainSurface.setAttribute('aria-busy', 'true');
  clientLoadingTimer = window.setTimeout(() => {
    if (state.loadingClientId !== normalizedClientId) {
      return;
    }
    els.mainSurface.classList.add('is-client-loading');
    els.clientList.querySelector(`[data-client-id="${normalizedClientId}"]`)?.classList.add('is-loading');
  }, 120);
}

function cancelClientNavigation() {
  clientNavigationSequence += 1;
  setClientNavigationLoading(null, false);
}

function animateClientSurfaceArrival() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  els.detailContent.classList.remove('is-client-arriving');
  void els.detailContent.offsetWidth;
  els.detailContent.classList.add('is-client-arriving');
  window.setTimeout(() => els.detailContent.classList.remove('is-client-arriving'), 180);
}

function updateStatusLine() {
  const clientCount = state.clients.length;
  const vault = state.settings?.vaultFolder || 'local vault';
  els.statusLine.textContent = `${clientCount} accepted client${clientCount === 1 ? '' : 's'} • ${vault}`;
}

function captureNavigationLocation() {
  return {
    viewMode: state.viewMode,
    clientId: state.selectedClientId,
    detailPage: getActiveDetailPage(),
    coachHomeTab: state.coachHomeTab,
    scrollTop: Math.max(0, Number(els.mainSurface?.scrollTop || 0))
  };
}

function navigationLocationKey(location) {
  return [
    location?.viewMode || '',
    location?.clientId || '',
    location?.detailPage || '',
    location?.coachHomeTab || '',
    Math.round(Number(location?.scrollTop || 0))
  ].join(':');
}

function updateBackButton() {
  const available = state.navigationHistory.length > 0 && !state.restoringNavigation;
  els.backBtn.disabled = !available;
  els.backBtn.title = available ? 'Go back' : 'Nothing to go back to yet';
}

function pushNavigationLocation() {
  if (state.restoringNavigation) {
    return;
  }
  const location = captureNavigationLocation();
  const previous = state.navigationHistory[state.navigationHistory.length - 1];
  if (!previous || navigationLocationKey(previous) !== navigationLocationKey(location)) {
    state.navigationHistory.push(location);
    if (state.navigationHistory.length > maxNavigationHistory) {
      state.navigationHistory.splice(0, state.navigationHistory.length - maxNavigationHistory);
    }
  }
  updateBackButton();
}

function restoreNavigationScroll(location) {
  window.requestAnimationFrame(() => {
    if (els.mainSurface) {
      els.mainSurface.scrollTop = Math.max(0, Number(location?.scrollTop || 0));
    }
  });
}

async function goBack() {
  const location = state.navigationHistory.pop();
  if (!location) {
    updateBackButton();
    return;
  }
  state.restoringNavigation = true;
  updateBackButton();
  try {
    if (location.viewMode === 'detail' && Number.isFinite(Number(location.clientId))) {
      await selectClient(Number(location.clientId), {
        detailPage: location.detailPage || 'snapshot',
        recordHistory: false
      });
    } else if (location.viewMode === 'home' && state.clients.length) {
      state.coachHomeTab = location.coachHomeTab || 'attention';
      await openCoachHome({ recordHistory: false });
    } else {
      setViewMode('intake');
    }
    restoreNavigationScroll(location);
  } catch (error) {
    showToast(`Could not go back: ${error.message}`, 'error');
  } finally {
    state.restoringNavigation = false;
    updateBackButton();
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  const showIntake = mode === 'intake' || !state.clients.length;
  const showHome = mode === 'home' && state.clients.length;
  els.intakePanel.hidden = !showIntake;
  if (!showIntake) {
    els.reviewPanel.hidden = true;
  }
  els.coachHomePanel.hidden = !showHome;
  els.clientDetailPanel.hidden = mode !== 'detail' || !state.selectedClientDetail;
  els.coachHomeBtn.classList.toggle('active', showHome);
  els.coachHomeBtn.setAttribute('aria-pressed', showHome ? 'true' : 'false');
  document.body.dataset.viewMode = state.viewMode;
  updateTopbarPrimaryAction();
  updateBackButton();
}

function updateTopbarPrimaryAction() {
  const showRunIntake = !els.intakePanel.hidden;
  els.onboardBtn.textContent = showRunIntake ? 'Run Intake' : 'Onboard New Client';
  els.onboardBtn.title = showRunIntake
    ? 'Run intake for the current onboarding form'
    : 'Start onboarding a new client';
  els.onboardBtn.setAttribute('aria-label', els.onboardBtn.textContent);
}

function handleTopbarPrimaryAction() {
  if (!els.intakePanel.hidden) {
    runIntake();
    return;
  }
  startOnboarding();
}

function truncateText(value, maxLength = 620) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}...`;
}

function buildSourceLookup(sources = []) {
  const lookup = new Map();
  sources.forEach((source, index) => {
    const sourceId = source.sourceId || `intake_source_${source.id}`;
    const normalized = {
      ...source,
      sourceId,
      displayNumber: index + 1,
      excerpt: truncateText(source.rawText || source.annotation || '', 720)
    };
    [
      sourceId,
      String(source.id || ''),
      `source_${index + 1}`,
      `#${index + 1}`
    ].filter(Boolean).forEach((key) => lookup.set(key, normalized));
  });
  return lookup;
}

function normalizeCitationSourceId(value) {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) {
    return `intake_source_${raw}`;
  }
  return raw;
}

function getCitationSource(rawSourceId, sourceLookup) {
  const raw = String(rawSourceId || '').trim();
  const withoutHash = raw.replace(/^#/, '');
  const candidates = [
    raw,
    normalizeCitationSourceId(raw),
    withoutHash,
    normalizeCitationSourceId(withoutHash)
  ];
  if (/^\d+$/.test(withoutHash)) {
    candidates.push(`source_${withoutHash}`, `#${withoutHash}`);
  }
  return candidates.map((candidate) => sourceLookup.get(candidate)).find(Boolean);
}

function renderCitationChip(rawSourceId, sourceLookup) {
  const sourceId = String(rawSourceId || '').trim();
  const source = getCitationSource(sourceId, sourceLookup);
  const label = source ? source.displayNumber : normalizeCitationSourceId(sourceId).replace('intake_source_', '#');
  const title = source?.title || sourceId;
  const meta = source ? [source.sourceType, source.sourceDate].filter(Boolean).join(' • ') : 'Source not found in this baseline';
  const excerpt = source?.excerpt || 'This citation points to a source id that is not available locally.';
  return `
    <button
      class="citation-chip"
      type="button"
      data-source-id="${escapeHtml(source?.sourceId || '')}"
      aria-label="Open source ${escapeHtml(String(label))}"
      ${source ? '' : 'disabled'}
    >
      ${escapeHtml(String(label))}
      <span class="citation-popover" role="tooltip">
        <strong>${escapeHtml(title)}</strong>
        <em>${escapeHtml(meta)}</em>
        <span>${escapeHtml(excerpt)}</span>
      </span>
    </button>
  `;
}

function getCitationTrigger(target) {
  return target?.closest?.('.citation-chip:not(:disabled), .ask-citation:not(:disabled)') || null;
}

function hideCitationTooltip() {
  if (!els.citationTooltip) {
    return;
  }
  if (els.citationTooltip.matches(':popover-open')) {
    els.citationTooltip.hidePopover();
  }
  els.citationTooltip.innerHTML = '';
}

function showCitationTooltip(trigger) {
  const source = trigger?.querySelector('.citation-popover, .ask-citation-popover');
  if (!source || !els.citationTooltip) {
    return;
  }
  hideCitationTooltip();
  els.citationTooltip.innerHTML = source.innerHTML;
  els.citationTooltip.showPopover();
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = els.citationTooltip.getBoundingClientRect();
  const gap = 10;
  const edge = 12;
  const left = Math.min(
    window.innerWidth - tooltipRect.width - edge,
    Math.max(edge, triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2))
  );
  const above = triggerRect.top - tooltipRect.height - gap;
  const top = above >= edge ? above : Math.min(
    window.innerHeight - tooltipRect.height - edge,
    triggerRect.bottom + gap
  );
  els.citationTooltip.style.left = `${Math.round(left)}px`;
  els.citationTooltip.style.top = `${Math.round(Math.max(edge, top))}px`;
  els.citationTooltip.dataset.placement = above >= edge ? 'above' : 'below';
}

function renderEvidenceText(value, sourceLookup, evidenceIds = []) {
  const raw = String(value || '');
  if (!raw && !evidenceIds.length) {
    return '';
  }

  const citedIds = new Set();
  const pattern = /\[((?:\s*(?:intake_source_\d+|source_\d+|#?\d+)\s*,?)+)\]/g;
  let cursor = 0;
  let html = '';
  let match = pattern.exec(raw);
  while (match) {
    html += escapeHtml(raw.slice(cursor, match.index));
    const ids = match[1].match(/intake_source_\d+|source_\d+|#?\d+/g) || [];
    if (ids.length) {
      html += `<span class="citation-cluster">${ids.map((id) => {
        citedIds.add(normalizeCitationSourceId(id.replace(/^#/, '')));
        return renderCitationChip(id, sourceLookup);
      }).join('')}</span>`;
    } else {
      html += escapeHtml(match[0]);
    }
    cursor = match.index + match[0].length;
    match = pattern.exec(raw);
  }
  html += escapeHtml(raw.slice(cursor));

  const appended = evidenceIds.filter((id) => {
    const normalized = normalizeCitationSourceId(String(id || '').replace(/^#/, ''));
    return normalized && !citedIds.has(normalized);
  });
  if (appended.length) {
    html += `<span class="citation-cluster inline-tail">${appended.map((id) => renderCitationChip(id, sourceLookup)).join('')}</span>`;
  }
  return html;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTagList(values, maxItems = 5) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const tags = [];
  for (const item of source) {
    const value = sanitizeName(item);
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(value);
    if (tags.length >= maxItems) {
      break;
    }
  }
  return tags;
}

function getPriorityOption(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return priorityOptions.find((option) => option.value === normalized) || priorityOptions[0];
}

function normalizePlanningStatus(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (['open', 'active', 'in-progress', 'inprogress'].includes(normalized)) {
    return 'active';
  }
  if (['done', 'complete', 'completed'].includes(normalized)) {
    return 'completed';
  }
  if (['coach-recommended', 'coach-recommendation', 'recommendation', 'recommended'].includes(normalized)) {
    return 'recommended';
  }
  if (['needs-review', 'needs-reviewing', 'review'].includes(normalized)) {
    return 'needs-review';
  }
  if (['future', 'later', 'someday'].includes(normalized)) {
    return 'future';
  }
  if (['blocked', 'stalled', 'paused-by-circumstance', 'waiting', 'waiting-on-client', 'waiting-on-external'].includes(normalized)) {
    return 'blocked';
  }
  if (['abandoned', 'dropped', 'stopped'].includes(normalized)) {
    return 'abandoned';
  }
  if (['outdated', 'stale', 'obsolete'].includes(normalized)) {
    return 'outdated';
  }
  return 'active';
}

function getPlanningStatusOption(item) {
  const explicit = item && typeof item === 'object' && !Array.isArray(item)
    ? item.planningStatus || item.status
    : '';
  const value = normalizePlanningStatus(explicit);
  return planningStatusOptions.find((option) => option.value === value) || planningStatusOptions[0];
}

function normalizeDueDateValue(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function getPlanningDueDate(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return '';
  }
  return normalizeDueDateValue(item.dueDate || item.dueOrReviewBy || item.reviewBy || item.due || '');
}

function getDueDateState(dueDate) {
  const due = parseLocalDate(dueDate);
  if (!due) {
    return '';
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (due < today) {
    return 'overdue';
  }
  if (due.getTime() === today.getTime()) {
    return 'due-today';
  }
  return 'upcoming';
}

function isPrioritizableSection(sectionKey) {
  return prioritizableSections.has(sectionKey);
}

function getPlanningHiddenStatuses() {
  return state.planningHiddenStatuses instanceof Set
    ? state.planningHiddenStatuses
    : new Set(defaultHiddenPlanningStatuses);
}

function loadPlanningHiddenStatuses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(planningHiddenStatusesStorageKey) || 'null');
    if (Array.isArray(parsed)) {
      const allowed = new Set(planningStatusOptions.map((option) => option.value));
      const values = parsed.filter((value) => allowed.has(value));
      state.planningHiddenStatuses = new Set(values);
      return;
    }
  } catch {
    // Ignore malformed local preferences and keep the release default.
  }
  state.planningHiddenStatuses = new Set(defaultHiddenPlanningStatuses);
}

function savePlanningHiddenStatuses() {
  try {
    localStorage.setItem(planningHiddenStatusesStorageKey, JSON.stringify([...getPlanningHiddenStatuses()]));
  } catch {
    // Local preference persistence is best-effort.
  }
}

function isPlanningStatusHidden(statusValue) {
  return getPlanningHiddenStatuses().has(statusValue);
}

function planningSectionExpansionKey(sectionKey) {
  return sectionKey || 'planning';
}

function isPlanningSectionExpanded(sectionKey) {
  return state.expandedPlanningSections.has(planningSectionExpansionKey(sectionKey));
}

function setPlanningSectionExpanded(sectionKey, expanded) {
  const key = planningSectionExpansionKey(sectionKey);
  if (expanded) {
    state.expandedPlanningSections.add(key);
  } else {
    state.expandedPlanningSections.delete(key);
  }
}

function getActiveDetailPage() {
  return detailPages.some((page) => page.key === state.detailPage) ? state.detailPage : 'snapshot';
}

function cloneDefaultCoachTemplate() {
  return JSON.parse(JSON.stringify(defaultCoachTemplate));
}

function parseOptionLines(value) {
  const seen = new Set();
  return String(value || '')
    .split('\n')
    .map((entry) => sanitizeName(entry))
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function normalizeTemplateFields(values, defaults) {
  const byKey = new Map((Array.isArray(values) ? values : [])
    .filter((field) => field && typeof field === 'object' && !Array.isArray(field))
    .map((field) => [String(field.key || '').trim(), field]));

  return defaults.map((defaultField) => {
    const saved = byKey.get(defaultField.key) || {};
    const options = Array.isArray(saved.options) ? saved.options.map((option) => sanitizeName(option)).filter(Boolean) : [];
    return {
      ...defaultField,
      options: options.length ? [...new Set(options)] : [...defaultField.options]
    };
  });
}

function normalizeCoachTemplate(value) {
  const parsed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = cloneDefaultCoachTemplate();
  const guidance = parsed.guidance && typeof parsed.guidance === 'object' && !Array.isArray(parsed.guidance)
    ? parsed.guidance
    : {};
  return {
    schemaVersion: 'coach_template.v1',
    guidance: {
      coachingApproach: String(guidance.coachingApproach || defaults.guidance.coachingApproach).trim(),
      messageStyle: String(guidance.messageStyle || defaults.guidance.messageStyle).trim(),
      curriculumNotes: String(guidance.curriculumNotes || defaults.guidance.curriculumNotes).trim()
    },
    profileSelectFields: normalizeTemplateFields(parsed.profileSelectFields, defaults.profileSelectFields),
    profileMultiSelectFields: normalizeTemplateFields(parsed.profileMultiSelectFields, defaults.profileMultiSelectFields)
  };
}

function getCoachTemplate() {
  return normalizeCoachTemplate(state.settings?.coachTemplate);
}

function getProfileSelectFields() {
  return getCoachTemplate().profileSelectFields;
}

function getProfileMultiSelectFields() {
  return getCoachTemplate().profileMultiSelectFields;
}

function toProfileArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeName(entry)).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((entry) => sanitizeName(entry))
    .filter(Boolean);
}

function parseLocalDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function calculateProgramWeek(startDateValue, now = new Date()) {
  const startDate = parseLocalDate(startDateValue);
  if (!startDate) {
    return '';
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dayDelta = Math.floor((today - start) / 86400000);
  if (dayDelta < 0) {
    return 'Starts soon';
  }
  return `Week ${Math.floor(dayDelta / 7) + 1}`;
}

function normalizeProfileSelectValue(profile, config) {
  const explicit = sanitizeName(profile?.[config.key]);
  if (explicit) {
    return explicit;
  }
  const legacyValue = config.key === 'curriculumType'
    ? sanitizeName(profile?.curriculum)
    : config.key === 'programType'
      ? sanitizeName(profile?.trainingProgram)
      : '';
  return config.options.find((option) => option.toLowerCase() === legacyValue.toLowerCase()) || '';
}

function getCurriculumWeek(profile = {}) {
  return calculateProgramWeek(profile.curriculumStartDate);
}

function getTrainingProgramWeek(profile = {}) {
  return calculateProgramWeek(profile.programStartDate);
}

function applyComputedProfileWeeks(profile, changedFields = new Set()) {
  const next = profile && typeof profile === 'object' && !Array.isArray(profile)
    ? { ...profile }
    : {};
  const curriculumWeek = calculateProgramWeek(next.curriculumStartDate);
  if (curriculumWeek) {
    next.programWeek = curriculumWeek;
  } else if (changedFields.has('curriculumStartDate')) {
    delete next.programWeek;
  }

  const trainingProgramWeek = calculateProgramWeek(next.programStartDate);
  if (trainingProgramWeek) {
    next.trainingProgramWeek = trainingProgramWeek;
  } else if (changedFields.has('programStartDate')) {
    delete next.trainingProgramWeek;
  }
  return next;
}

function compactObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) {
        return entry.length > 0;
      }
      return String(entry ?? '').trim();
    })
  );
}

function buildDashboardModel(structured = {}) {
  return {
    clientProfile: compactObject(structured.clientProfile || {}),
    overview: structured.overview || '',
    coachTasks: asArray(structured.coachTasks),
    flags: asArray(structured.flags),
    goalsValues: asArray(structured.goalsValues),
    clientValues: asArray(structured.clientValues),
    coachingPlanApproach: asArray(structured.coachingPlanApproach),
    programChanges: asArray(structured.programChanges),
    progressTracking: asArray(structured.progressTracking),
    engagementNotes: asArray(structured.engagementNotes),
    nutritionThreads: asArray(structured.nutritionThreads),
    mindsetThreads: asArray(structured.mindsetThreads),
    exerciseThreads: asArray(structured.exerciseThreads),
    resourcesShared: asArray(structured.resourcesShared),
    suggestedTags: normalizeTagList(structured.suggestedTags),
    timeline: asArray(structured.timeline),
    missingInfo: asArray(structured.missingInfo),
    confidenceNotes: asArray(structured.confidenceNotes)
  };
}

function normalizeDetailItem(item, options = {}) {
  if (typeof item === 'string') {
    return {
      title: '',
      detail: item,
      evidenceIds: [],
      priority: getPriorityOption('none'),
      planningStatus: planningStatusOptions[0],
      dueDate: ''
    };
  }
  if (!item || typeof item !== 'object') {
    return {
      title: '',
      detail: '',
      evidenceIds: [],
      priority: getPriorityOption('none'),
      planningStatus: planningStatusOptions[0],
      dueDate: ''
    };
  }
  const planningSection = isPrioritizableSection(options.sectionKey);
  const title = item.title || item.label || item.resource || item.name || item.date || '';
  const detail = item.details
    || item.currentStatus
    || (planningSection ? '' : item.status)
    || item.urgency
    || item.summary
    || item.note
    || item.notes
    || '';
  const fallback = Object.entries(item)
    .filter(([key]) => ![
      'title',
      'label',
      'resource',
      'name',
      'date',
      'details',
      'currentStatus',
      'status',
      'planningStatus',
      'priority',
      'urgency',
      'summary',
      'note',
      'notes',
      'dueDate',
      'dueOrReviewBy',
      'reviewBy',
      'due',
      'evidenceIds'
    ].includes(key))
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(' · ');
  return {
    title,
    detail: [detail, fallback].filter(Boolean).join(' · '),
    evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
    priority: getPriorityOption(item.priority),
    planningStatus: getPlanningStatusOption(item),
    dueDate: getPlanningDueDate(item)
  };
}

function normalizeTimelineItem(item) {
  if (typeof item === 'string') {
    return {
      dateLabel: 'Date unknown',
      detail: item,
      evidenceIds: []
    };
  }
  if (!item || typeof item !== 'object') {
    return {
      dateLabel: 'Date unknown',
      detail: '',
      evidenceIds: []
    };
  }

  const dateLabel = item.date || item.dateRange || item.date_range || item.date_or_range || item.when || 'Date unknown';
  const label = item.label || item.title || item.resource || item.name || '';
  const detail = item.details || item.currentStatus || item.status || item.urgency || item.summary || item.note || item.notes || '';
  const fallback = Object.entries(item)
    .filter(([key]) => ![
      'title',
      'label',
      'resource',
      'name',
      'date',
      'dateRange',
      'date_range',
      'date_or_range',
      'when',
      'details',
      'currentStatus',
      'status',
      'planningStatus',
      'priority',
      'urgency',
      'summary',
      'note',
      'notes',
      'dateBasis',
      'confidence',
      'evidenceIds'
    ].includes(key))
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(' · ');
  const labeledDetail = label && detail ? `${label}: ${detail}` : (label || detail);
  return {
    dateLabel,
    detail: [labeledDetail, fallback].filter(Boolean).join(' · '),
    evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : []
  };
}

function normalizeSource(source) {
  const rawText = String(source?.rawText || source?.text || '').replace(/\r\n/g, '\n').trim();
  if (!rawText) {
    return null;
  }
  return {
    localId: source.localId || makeLocalId(),
    title: sanitizeName(source.title || '') || 'Untitled source',
    sourceType: String(source.sourceType || source.type || 'notes').trim().toLowerCase(),
    sourceDate: String(source.sourceDate || source.date || '').trim(),
    annotation: String(source.annotation || '').trim(),
    originalPath: String(source.originalPath || '').trim(),
    rawText
  };
}

function addSources(sources) {
  const normalized = (Array.isArray(sources) ? sources : [])
    .map((source) => normalizeSource(source))
    .filter(Boolean);
  if (!normalized.length) {
    return 0;
  }
  state.intakeSources = [...state.intakeSources, ...normalized];
  renderSources();
  return normalized.length;
}

function renderSources() {
  els.sourceList.innerHTML = '';
  if (!state.intakeSources.length) {
    els.sourceList.innerHTML = `
      <div class="empty-inline">
        <strong>No sources added.</strong>
        <span>Paste text, load sample data, or import files before running intake.</span>
      </div>
    `;
    return;
  }

  for (const source of state.intakeSources) {
    const row = document.createElement('div');
    row.className = 'source-row';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(source.title)}</strong>
        <p>${escapeHtml(source.sourceType)}${source.sourceDate ? ` • ${escapeHtml(source.sourceDate)}` : ''} • ${wordCount(source.rawText)} words</p>
        ${source.annotation ? `<p class="muted">${escapeHtml(source.annotation)}</p>` : ''}
        ${source.originalPath ? `<p class="path-line">${escapeHtml(source.originalPath)}</p>` : ''}
      </div>
      <button class="btn btn-subtle source-remove" type="button" data-id="${escapeHtml(source.localId)}">Remove</button>
    `;
    els.sourceList.appendChild(row);
  }
}

function renderNoteSources() {
  els.noteSourceList.innerHTML = '';
  if (!state.noteSources.length) {
    els.noteSourceList.innerHTML = `
      <div class="empty-inline">
        <strong>No update sources added.</strong>
        <span>Paste a note or import files before updating the dashboard.</span>
      </div>
    `;
    return;
  }

  for (const source of state.noteSources) {
    const row = document.createElement('div');
    row.className = 'source-row';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(source.title)}</strong>
        <p>${escapeHtml(source.sourceType)}${source.sourceDate ? ` • ${escapeHtml(source.sourceDate)}` : ''} • ${wordCount(source.rawText)} words</p>
        ${source.annotation ? `<p class="muted">${escapeHtml(source.annotation)}</p>` : ''}
        ${source.originalPath ? `<p class="path-line">${escapeHtml(source.originalPath)}</p>` : ''}
      </div>
      <button class="btn btn-subtle note-source-remove" type="button" data-id="${escapeHtml(source.localId)}">Remove</button>
    `;
    els.noteSourceList.appendChild(row);
  }
}

function addPastedSource(options = {}) {
  const rawText = String(els.sourceTextInput.value || '').trim();
  if (!rawText) {
    if (!options.silent) {
      showToast('Paste source text before adding it.', 'error');
    }
    return false;
  }

  addSources([{
    title: els.sourceTitleInput.value || 'Pasted Client Context',
    sourceType: els.sourceTypeInput.value || 'notes',
    sourceDate: els.sourceDateInput.value || '',
    annotation: els.sourceAnnotationInput.value || '',
    rawText
  }]);
  els.sourceTitleInput.value = '';
  els.sourceDateInput.value = '';
  els.sourceAnnotationInput.value = '';
  els.sourceTextInput.value = '';
  if (!options.silent) {
    showToast('Added pasted source.');
  }
  return true;
}

function addPastedNoteSource(options = {}) {
  const rawText = String(els.noteTextInput.value || '').trim();
  if (!rawText) {
    if (!options.silent) {
      showToast('Paste note text before adding it.', 'error');
    }
    return false;
  }

  const added = addNoteSources([{
    title: els.noteTitleInput.value || 'New Client Note',
    sourceType: els.noteSourceTypeInput.value || 'notes',
    sourceDate: els.noteDateInput.value || '',
    annotation: els.noteAnnotationInput.value || '',
    rawText
  }]);
  if (added) {
    els.noteTitleInput.value = '';
    els.noteDateInput.value = todayLocalDate();
    els.noteAnnotationInput.value = '';
    els.noteTextInput.value = '';
    if (!options.silent) {
      showToast('Added note source.');
    }
  }
  return Boolean(added);
}

function addNoteSources(sources) {
  const normalized = (Array.isArray(sources) ? sources : [])
    .map((source) => normalizeSource({
      ...source,
      sourceDate: source?.sourceDate || source?.date || todayLocalDate()
    }))
    .filter(Boolean);
  if (!normalized.length) {
    return 0;
  }
  state.noteSources = [...state.noteSources, ...normalized];
  renderNoteSources();
  return normalized.length;
}

function resetIntake(options = {}) {
  state.intakeSources = [];
  state.activeBaseline = null;
  state.baselineDraft = null;
  els.clientNameInput.value = '';
  els.programInput.value = '';
  els.coachNoteInput.value = '';
  els.sourceTypeInput.value = 'notes';
  els.sourceTitleInput.value = '';
  els.sourceDateInput.value = '';
  els.sourceAnnotationInput.value = '';
  els.sourceTextInput.value = '';
  els.reviewPanel.hidden = true;
  els.baselineFields.innerHTML = '';
  els.baselineJsonInput.value = '';
  renderIntakeProgramSettings();
  renderSources();
  if (!options.keepMode) {
    state.selectedClientId = null;
    state.selectedClientDetail = null;
    renderClients();
    setViewMode('intake');
  }
}

function startOnboarding() {
  cancelClientNavigation();
  if (state.viewMode !== 'intake') {
    pushNavigationLocation();
  }
  resetIntake();
  els.clientNameInput.focus();
}

function renderPresetList(container, values, emptyLabel, options = {}) {
  if (!container) {
    return;
  }
  if (!values.length) {
    container.innerHTML = `<span class="preset-empty">${escapeHtml(emptyLabel)}</span>`;
    return;
  }
  container.innerHTML = values.map((value, index) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    const label = options.truncate && normalized.length > 48
      ? `${normalized.slice(0, 47).trim()}…`
      : normalized;
    return `
    <button
      class="preset-chip ${options.className || ''}"
      type="button"
      data-preset-index="${escapeHtml(String(index))}"
      title="${escapeHtml(normalized)}"
      aria-label="Use saved preset: ${escapeHtml(normalized)}"
    >
      ${escapeHtml(label)}
    </button>
  `;
  }).join('');
}

function renderNotePresetControls() {
  renderPresetList(els.noteTitlePresetList, state.noteTitlePresets, 'No saved titles yet.');
  renderPresetList(els.noteAnnotationPresetList, state.noteAnnotationPresets, 'No saved annotations yet.', {
    truncate: true,
    className: 'annotation-preset'
  });
}

function renderTodoPresetControls() {
  renderPresetList(els.todoTitlePresetList, state.todoTitlePresets, 'No saved to-do titles yet.');
}

function saveNoteTitlePreset() {
  const next = upsertPresetValue(noteTitlePresetsStorageKey, state.noteTitlePresets, els.noteTitleInput.value);
  if (next === state.noteTitlePresets) {
    showToast('Enter a note title before saving it.', 'error');
    return;
  }
  state.noteTitlePresets = next;
  renderNotePresetControls();
  showToast('Note title saved.');
}

function saveNoteAnnotationPreset() {
  const next = upsertPresetValue(noteAnnotationPresetsStorageKey, state.noteAnnotationPresets, els.noteAnnotationInput.value);
  if (next === state.noteAnnotationPresets) {
    showToast('Enter an annotation before saving it.', 'error');
    return;
  }
  state.noteAnnotationPresets = next;
  renderNotePresetControls();
  showToast('Annotation saved.');
}

function saveTodoTitlePreset() {
  const next = upsertPresetValue(todoTitlePresetsStorageKey, state.todoTitlePresets, els.todoTitleInput.value);
  if (next === state.todoTitlePresets) {
    showToast('Enter a to-do title before saving it.', 'error');
    return;
  }
  state.todoTitlePresets = next;
  renderTodoPresetControls();
  showToast('To-do title saved.');
}

function resizeNoteAnnotation() {
  const control = els.noteAnnotationInput;
  if (!control) {
    return;
  }
  control.style.height = 'auto';
  const minimumHeight = 40;
  const maximumHeight = 132;
  const nextHeight = Math.min(maximumHeight, Math.max(minimumHeight, control.scrollHeight));
  control.style.height = `${nextHeight}px`;
  control.style.overflowY = control.scrollHeight > maximumHeight ? 'auto' : 'hidden';
}

function resetNoteDialog() {
  state.noteSources = [];
  state.noteRetryBlocked = false;
  els.noteSourceTypeInput.value = 'notes';
  els.noteTitleInput.value = '';
  els.noteDateInput.value = todayLocalDate();
  els.noteAnnotationInput.value = '';
  els.noteTextInput.value = '';
  els.updateNoteSubmitBtn.disabled = false;
  clearNoteError();
  syncChoiceGroups();
  renderNotePresetControls();
  renderNoteSources();
  resizeNoteAnnotation();
}

function clearNoteError() {
  els.noteErrorPanel.textContent = '';
  els.noteErrorPanel.hidden = true;
}

function showNoteError(message) {
  els.noteErrorPanel.textContent = message;
  els.noteErrorPanel.hidden = false;
}

function extractErrorReference(error) {
  const match = String(error?.message || '').match(/Reference:\s*([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

function formatAddNoteError(error) {
  const reference = extractErrorReference(error);
  return [
    'CoachNotes could not update the dashboard.',
    'The source is still listed below.',
    'Click Update Dashboard to retry.',
    reference ? `Reference: ${reference}` : ''
  ].filter(Boolean).join(' ');
}

function formatAddNoteRefreshError() {
  return [
    'CoachNotes finished the update, but could not refresh the screen afterward.',
    'The note may already be saved.',
    'Close this dialog, reopen the client, and only retry if the new note is missing.'
  ].join(' ');
}

function openAddNoteDialog() {
  if (!state.selectedClientDetail?.client?.id) {
    showToast('Select a client before adding a note.', 'error');
    return;
  }
  resetNoteDialog();
  els.addNoteTitle.textContent = `Add Note for ${state.selectedClientDetail.client.name}`;
  els.addNoteDialog.showModal();
  window.requestAnimationFrame(resizeNoteAnnotation);
  els.noteTextInput.focus();
}

function resetAskDialog() {
  state.askResult = null;
  state.askAppliedPresetPrompt = '';
  state.askCustomPromptDraft = '';
  setAskLoading(false);
  window.clearTimeout(copyAskResetTimer);
  copyAskResetTimer = null;
  els.copyAskResultBtn.textContent = els.copyAskResultBtn.dataset.defaultLabel || 'Copy';
  els.copyAskResultBtn.disabled = false;
  els.askOutputTypeInput.value = 'client-message';
  els.askScopeInput.value = 'recent-notes';
  els.askTimeWindowInput.value = 'last-3-weeks';
  els.askPromptInput.value = '';
  els.askResultPanel.hidden = true;
  els.askResultMeta.textContent = '';
  els.askResultOutput.innerHTML = '';
  els.askSourceList.innerHTML = '';
  syncChoiceGroups();
}

function openAskDialog() {
  if (!state.selectedClientDetail?.client?.id) {
    showToast('Select a client before using ASK.', 'error');
    return;
  }
  resetAskDialog();
  els.askTitle.textContent = `Ask about ${state.selectedClientDetail.client.name}`;
  els.askDialog.showModal();
  els.askPromptInput.focus();
}

function applyAskOutputPreset() {
  const presets = {
    'client-message': { scope: 'recent-notes', timeWindow: 'last-3-weeks', prompt: '' },
    'session-prep': { scope: 'recent-notes', timeWindow: 'last-90-days', prompt: '' },
    'initial-welcome-message': { scope: 'all-sources', timeWindow: 'all-time', prompt: initialWelcomeMessagePrompt },
    'client-profile-export': { scope: 'all-sources', timeWindow: 'all-time', prompt: clientProfileExportPrompt },
    'general-answer': { scope: 'recent-notes', timeWindow: 'last-3-weeks', prompt: '' }
  };
  const preset = presets[els.askOutputTypeInput.value] || presets['client-message'];
  const currentPrompt = els.askPromptInput.value;
  const currentlyUsingPreset = Boolean(state.askAppliedPresetPrompt)
    && currentPrompt === state.askAppliedPresetPrompt;
  if (!currentlyUsingPreset) {
    state.askCustomPromptDraft = currentPrompt;
  }

  els.askScopeInput.value = preset.scope;
  els.askTimeWindowInput.value = preset.timeWindow;
  if (preset.prompt) {
    els.askPromptInput.value = preset.prompt;
    state.askAppliedPresetPrompt = preset.prompt;
  } else {
    els.askPromptInput.value = state.askCustomPromptDraft;
    state.askAppliedPresetPrompt = '';
  }
  syncChoiceGroups();
}

function setAskLoading(on, message = 'Using the selected client context.') {
  state.askLoading = Boolean(on);
  els.askForm.classList.toggle('is-loading', state.askLoading);
  els.askForm.setAttribute('aria-busy', state.askLoading ? 'true' : 'false');
  els.askProcessing.hidden = !state.askLoading;
  els.askProcessingText.textContent = message;
  const controls = [
    els.askOutputTypeInput,
    els.askScopeInput,
    els.askTimeWindowInput,
    els.askPromptInput,
    els.askSubmitBtn,
    els.cancelAskBtn,
    els.copyAskResultBtn,
    els.saveAskResultBtn
  ];
  controls.forEach((control) => {
    if (control) {
      control.disabled = state.askLoading;
    }
  });
  syncChoiceGroups();
}

function renderAskCitationChip(chunkId, sourceLookup) {
  const source = sourceLookup.get(String(chunkId || '').trim());
  if (!source) {
    return escapeHtml(`[c:${chunkId}]`);
  }
  const label = source.displayNumber || chunkId;
  const title = source.title || chunkId;
  const meta = [source.sourceType, formatDate(source.date)].filter(Boolean).join(' • ') || 'Selected ASK source';
  const excerpt = source.excerpt || 'No preview text is available for this source.';
  return `
    <button
      class="ask-citation"
      type="button"
      data-source-id="${escapeHtml(source.sourceId || '')}"
      aria-label="Open ASK source ${escapeHtml(String(label))}"
      ${source.sourceId ? '' : 'disabled'}
    >
      ${escapeHtml(String(label))}
      <span class="ask-citation-popover" role="tooltip">
        <strong>${escapeHtml(title)}</strong>
        <em>${escapeHtml(meta)}</em>
        <span>${escapeHtml(excerpt)}</span>
      </span>
    </button>
  `;
}

function renderAskInlineMarkdown(text, sourceLookup) {
  const citationHtml = [];
  let html = '';
  const pattern = /\[c:\s*([^\]\s]+)\s*\]/g;
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    html += escapeHtml(text.slice(cursor, match.index));
    const token = `@@ASK_CITATION_${citationHtml.length}@@`;
    citationHtml.push(renderAskCitationChip(match[1], sourceLookup));
    html += token;
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  html += escapeHtml(text.slice(cursor));

  html = html
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  citationHtml.forEach((citation, index) => {
    html = html.replaceAll(`@@ASK_CITATION_${index}@@`, citation);
  });
  return html;
}

function renderAskAnswerText(answer, sources = []) {
  const sourceLookup = new Map((sources || []).map((source) => [String(source.chunkId || ''), source]));
  const raw = String(answer || '').replace(/\r\n/g, '\n').trim();
  if (!raw) {
    return '<p>No answer returned.</p>';
  }
  const lines = raw.split('\n');
  const blocks = [];
  let paragraph = [];
  let listType = '';

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    blocks.push(`<p>${renderAskInlineMarkdown(paragraph.join(' '), sourceLookup)}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) {
      blocks.push(`</${listType}>`);
      listType = '';
    }
  };
  const ensureList = (type) => {
    flushParagraph();
    if (listType && listType !== type) {
      closeList();
    }
    if (!listType) {
      listType = type;
      blocks.push(`<${type}>`);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      blocks.push(`<h4>${renderAskInlineMarkdown(heading[2], sourceLookup)}</h4>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      ensureList('ul');
      blocks.push(`<li>${renderAskInlineMarkdown(bullet[1], sourceLookup)}</li>`);
      continue;
    }
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      ensureList('ol');
      blocks.push(`<li>${renderAskInlineMarkdown(numbered[1], sourceLookup)}</li>`);
      continue;
    }
    if (listType && /^\s{2,}\S/.test(line)) {
      blocks.push(`<li>${renderAskInlineMarkdown(trimmed, sourceLookup)}</li>`);
      continue;
    }
    closeList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  closeList();
  return blocks.join('');
}

function renderAskSources(sources = []) {
  if (!sources.length) {
    return '';
  }
  return `
    <div class="ask-source-head">Sources used</div>
    ${sources.map((source) => `
      <div class="ask-source-row">
        <span>${escapeHtml(String(source.displayNumber || ''))}</span>
        <div>
          <strong>${escapeHtml(source.title || source.chunkId)}</strong>
          <em>${escapeHtml([source.sourceType, formatDate(source.date)].filter(Boolean).join(' • '))}</em>
        </div>
      </div>
    `).join('')}
  `;
}

function renderAskResult(result) {
  state.askResult = result;
  els.askResultPanel.hidden = false;
  els.askResultMeta.textContent = `${result.outputLabel || 'ASK'} • ${result.scopeLabel || 'selected context'} • ${result.timeWindowLabel || 'time window'}`;
  els.askResultOutput.innerHTML = renderAskAnswerText(result.answer || '', result.selectedSources || []);
  els.askSourceList.innerHTML = renderAskSources(result.selectedSources || []);
}

function openAskCitationSource(sourceId) {
  const normalized = String(sourceId || '').trim();
  if (!normalized) {
    showToast('Source is not available locally.', 'error');
    return;
  }
  if (els.askDialog.open) {
    els.askDialog.close();
  }
  if (normalized === 'dashboard_current') {
    if (getActiveDetailPage() !== 'snapshot') {
      pushNavigationLocation();
    }
    state.detailPage = 'snapshot';
    renderClientDetail(state.selectedClientDetail);
    els.clientDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  openCitedSource(normalized);
}

async function submitAsk(event) {
  event.preventDefault();
  const clientId = state.selectedClientDetail?.client?.id;
  const prompt = String(els.askPromptInput.value || '').trim();
  if (!clientId) {
    showToast('Select a client before using ASK.', 'error');
    return;
  }
  if (!prompt) {
    showToast('Enter a request first.', 'error');
    els.askPromptInput.focus();
    return;
  }

  setAskLoading(true, 'Using the selected client context.');
  try {
    const result = await window.coachNotes.askClient({
      clientId,
      prompt,
      outputType: els.askOutputTypeInput.value,
      scope: els.askScopeInput.value,
      timeWindow: els.askTimeWindowInput.value
    });
    renderAskResult(result);
    showToast('ASK draft ready.');
  } catch (error) {
    showToast(`ASK failed: ${error.message}`, 'error');
  } finally {
    setAskLoading(false);
  }
}

async function copyText(value) {
  const text = String(value || '');
  if (!text) {
    return false;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

async function copyAskResult() {
  if (!state.askResult?.answer) {
    showToast('Run ASK before copying.', 'error');
    return;
  }
  try {
    await copyText(state.askResult.answer);
    window.clearTimeout(copyAskResetTimer);
    const originalLabel = els.copyAskResultBtn.dataset.defaultLabel || els.copyAskResultBtn.textContent || 'Copy';
    els.copyAskResultBtn.dataset.defaultLabel = originalLabel;
    els.copyAskResultBtn.textContent = 'Copied!';
    els.copyAskResultBtn.disabled = true;
    copyAskResetTimer = window.setTimeout(() => {
      els.copyAskResultBtn.textContent = originalLabel;
      els.copyAskResultBtn.disabled = false;
    }, 1400);
  } catch (error) {
    showToast(`Copy failed: ${error.message}`, 'error');
  }
}

async function saveAskResultAsNote() {
  if (!state.askResult?.answer || !state.selectedClientDetail?.client?.id) {
    showToast('Run ASK before saving.', 'error');
    return;
  }
  setBusy(true, 'Saving ASK note...');
  try {
    const detail = await window.coachNotes.saveAskResultAsNote({
      clientId: state.selectedClientDetail.client.id,
      title: `ASK ${state.askResult.outputLabel || 'Output'}`,
      outputType: state.askResult.outputType,
      scope: state.askResult.scope,
      timeWindow: state.askResult.timeWindow,
      question: state.askResult.question,
      answer: state.askResult.answer
    });
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast('ASK output saved as a note.');
  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function formatValue(value, type) {
  if (type === 'text') {
    return String(value || '');
  }
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '';
    }
    return Object.entries(value).map(([key, entry]) => `${key}: ${entry || ''}`).join('\n');
  }
  if (!Array.isArray(value)) {
    return '';
  }
  return value.map((entry) => {
    if (typeof entry === 'string') {
      return entry;
    }
    if (entry && typeof entry === 'object') {
      const evidence = Array.isArray(entry.evidenceIds) && entry.evidenceIds.length ? ` [${entry.evidenceIds.join(', ')}]` : '';
      return [
        entry.date,
        entry.title || entry.label,
        entry.details || entry.currentStatus || entry.status || entry.urgency
      ].filter(Boolean).join(' - ') + evidence;
    }
    return '';
  }).filter(Boolean).join('\n');
}

function parseFieldValue(value, type) {
  const raw = String(value || '').trim();
  if (type === 'text') {
    return raw;
  }
  if (type === 'object') {
    const output = {};
    for (const line of raw.split('\n')) {
      const index = line.indexOf(':');
      if (index > 0) {
        output[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      }
    }
    return output;
  }
  return raw
    .split(type === 'tags' ? /[,\n]/ : '\n')
    .map((line) => sanitizeName(line))
    .filter(Boolean);
}

function syncJsonFromFields() {
  if (!state.baselineDraft) {
    return;
  }
  for (const field of els.baselineFields.querySelectorAll('[data-key]')) {
    state.baselineDraft[field.dataset.key] = parseFieldValue(field.value, field.dataset.type);
  }
  els.baselineJsonInput.value = JSON.stringify(state.baselineDraft, null, 2);
}

function renderBaselineReview(result) {
  const structured = result?.structured && typeof result.structured === 'object' ? result.structured : {};
  state.activeBaseline = result;
  state.baselineDraft = JSON.parse(JSON.stringify(structured));
  els.reviewPanel.hidden = false;
  els.reviewMeta.textContent = `${result.clientName || 'Client'} • ${result.sourceRecords?.length || 0} sources • ${result.model || 'model unknown'}`;
  els.baselineFields.innerHTML = '';

  for (const section of baselineSections) {
    const label = document.createElement('label');
    label.className = 'baseline-field';
    label.innerHTML = `
      <span>${escapeHtml(section.label)}</span>
      <textarea rows="${section.rows}" data-key="${escapeHtml(section.key)}" data-type="${escapeHtml(section.type)}">${escapeHtml(formatValue(structured[section.key], section.type))}</textarea>
    `;
    els.baselineFields.appendChild(label);
  }
  els.baselineJsonInput.value = JSON.stringify(state.baselineDraft, null, 2);
  els.reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function runIntake() {
  addPastedSource({ silent: true });
  const clientName = sanitizeName(els.clientNameInput.value);
  if (!clientName) {
    showToast('Enter a client name first.', 'error');
    els.clientNameInput.focus();
    return;
  }
  if (!state.intakeSources.length) {
    showToast('Add at least one source first.', 'error');
    return;
  }

  setBusy(true, 'Running client intake...');
  try {
    const detail = await window.coachNotes.generateClientBaseline({
      clientName,
      programContext: els.programInput.value,
      coachNotes: els.coachNoteInput.value,
      clientProfile: collectIntakeClientProfile(),
      sources: state.intakeSources
    });
    resetIntake({ keepMode: true });
    await loadClients();
    await selectClient(detail.client.id);
    showToast('Client profile created.');
  } catch (error) {
    showToast(`Intake failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function acceptBaseline() {
  if (!state.activeBaseline?.baselineId) {
    showToast('Run intake before accepting.', 'error');
    return;
  }
  syncJsonFromFields();
  let structured;
  try {
    structured = JSON.parse(els.baselineJsonInput.value || '{}');
  } catch (error) {
    showToast(`Structured JSON is invalid: ${error.message}`, 'error');
    return;
  }

  setBusy(true, 'Accepting baseline...');
  try {
    const detail = await window.coachNotes.acceptClientBaseline({
      baselineId: state.activeBaseline.baselineId,
      structured
    });
    await loadClients();
    await selectClient(detail.client.id);
    els.reviewPanel.hidden = true;
    showToast('Client baseline accepted.');
  } catch (error) {
    showToast(`Accept failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function getClientProfileTagOptions() {
  const tags = new Set();
  for (const client of state.clients) {
    for (const tag of client.profileTags || []) {
      const normalized = sanitizeName(tag);
      if (normalized) {
        tags.add(normalized);
      }
    }
  }
  return [...tags].sort((left, right) => left.localeCompare(right));
}

function renderClientProfileTagFilter() {
  const tags = getClientProfileTagOptions();
  els.clientProfileTagFilter.placeholder = tags.length ? 'Any bio tag' : 'No bio tags yet';
  els.clientProfileTagOptions.innerHTML = tags.map((tag) => `<option value="${escapeHtml(tag)}"></option>`).join('');
  const hasFilter = Boolean(state.clientProfileTagFilter);
  els.clientFilterToggle.classList.toggle('is-active', hasFilter);
  els.clientFilterToggle.textContent = hasFilter ? 'Bio •' : 'Bio';
  els.clientFilterToggle.setAttribute('aria-label', hasFilter
    ? `Bio filter active: ${state.clientProfileTagFilter}`
    : 'Filter the client index by a bio tag');
  els.clientFilterToggle.title = hasFilter ? `Filtering by ${state.clientProfileTagFilter}` : 'Filter the client index by a bio tag';
}

function renderClientSortControl() {
  els.clientSortButtons.forEach((button) => {
    const active = button.dataset.clientSort === state.clientSortMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function getFilteredClients() {
  const query = state.clientSearchQuery.toLowerCase();
  const tagQuery = state.clientProfileTagFilter.toLowerCase();
  const filtered = state.clients.filter((client) => {
    const matchesSearch = !query || sanitizeName(client.name).toLowerCase().includes(query);
    const matchesProfileTag = !tagQuery
      || (client.profileTags || []).some((tag) => sanitizeName(tag).toLowerCase().includes(tagQuery));
    return matchesSearch && matchesProfileTag;
  });
  return filtered.sort((left, right) => {
    if (state.clientSortMode === 'updated') {
      const leftTime = Date.parse(left.updatedAt || left.acceptedAt || '') || 0;
      const rightTime = Date.parse(right.updatedAt || right.acceptedAt || '') || 0;
      return rightTime - leftTime || sanitizeName(left.name).localeCompare(sanitizeName(right.name));
    }
    return sanitizeName(left.name).localeCompare(sanitizeName(right.name));
  });
}

function renderClients() {
  els.clientList.innerHTML = '';
  renderClientProfileTagFilter();
  renderClientSortControl();
  if (!state.clients.length) {
    els.clientList.innerHTML = `
      <div class="empty-rail">
        <strong>No accepted clients yet.</strong>
        <span>Run intake to create the first client profile.</span>
      </div>
    `;
    updateStatusLine();
    return;
  }

  const clients = getFilteredClients();
  if (!clients.length) {
    els.clientList.innerHTML = `
      <div class="empty-rail">
        <strong>No clients match.</strong>
        <span>Clear search or tag filter.</span>
      </div>
    `;
    updateStatusLine();
    return;
  }

  clients.forEach((client, clientIndex) => {
    const button = document.createElement('button');
    button.className = 'client-button';
    button.dataset.clientId = String(client.id);
    if (state.selectedClientId === client.id) {
      button.classList.add('active');
    }
    if (state.loadingClientId === client.id && els.mainSurface.classList.contains('is-client-loading')) {
      button.classList.add('is-loading');
    }
    const clientTags = client.profileTags || [];
    const visibleTags = clientTags.slice(0, 1).map((tag) => `<span>${escapeHtml(tag)}</span>`);
    if (clientTags.length > 1) {
      visibleTags.push(`<span>+${clientTags.length - 1}</span>`);
    }
    const tags = visibleTags.join('');
    const dueTaskCount = Number(client.dueTaskCount || 0);
    const overdueTaskCount = Number(client.overdueTaskCount || 0);
    const dueTodayCount = Math.max(0, dueTaskCount - overdueTaskCount);
    const dueAlertLabel = overdueTaskCount && dueTodayCount
      ? `${overdueTaskCount} overdue, ${dueTodayCount} due`
      : overdueTaskCount
        ? `${overdueTaskCount} overdue`
        : `${dueTaskCount} due today`;
    const dueBadgeCount = overdueTaskCount || dueTaskCount;
    const ledgerNumber = String(clientIndex + 1).padStart(3, '0');
    const dueAlert = dueTaskCount
      ? `
        <span class="client-notification-badge ${overdueTaskCount ? 'overdue' : 'due-today'}" title="${escapeHtml(dueAlertLabel)}">
          ${escapeHtml(String(dueBadgeCount))}
        </span>
        <em class="client-alert-text">${escapeHtml(dueAlertLabel)}</em>
      `
      : '';
    button.innerHTML = `
      <span class="client-ledger-index" aria-hidden="true">${escapeHtml(ledgerNumber)}</span>
      <span class="client-card-copy">
        <strong>${escapeHtml(client.name)}</strong>
        <em>${client.sourceCount} sources • ${client.flagCount || 0} flags • ${client.taskCount || 0} to-dos</em>
        ${dueAlert}
        ${tags ? `<span class="tag-strip">${tags}</span>` : ''}
      </span>
    `;
    button.addEventListener('click', () => selectClient(client.id));
    els.clientList.appendChild(button);
  });
  updateStatusLine();
}

function getCoachHomeData() {
  return state.coachHome || {
    rules: { activityDays: 7, staleDays: 14, dueSoonDays: 7 },
    stats: {},
    attention: {},
    activity: {},
    segments: {}
  };
}

function formatDaysAgo(days) {
  if (!Number.isFinite(Number(days))) {
    return 'No date';
  }
  const value = Number(days);
  if (value === 0) {
    return 'today';
  }
  if (value === 1) {
    return '1 day ago';
  }
  return `${value} days ago`;
}

function detailPageForHomeSection(sectionKey) {
  if (sectionKey === 'coachTasks' || sectionKey === 'goalsValues') {
    return 'goals';
  }
  if (sectionKey === 'missingInfo' || sectionKey === 'flags') {
    return 'snapshot';
  }
  return 'snapshot';
}

function renderHomeTabs(activeTab) {
  const tabs = [
    { key: 'attention', label: 'Attention' },
    { key: 'activity', label: 'Activity' },
    { key: 'segments', label: 'Segments' }
  ];
  return `
    <nav class="home-tabs" aria-label="Coach home views">
      ${tabs.map((tab) => `
        <button class="home-tab ${tab.key === activeTab ? 'active' : ''}" type="button" data-home-tab="${escapeHtml(tab.key)}" aria-pressed="${tab.key === activeTab ? 'true' : 'false'}">
          ${escapeHtml(tab.label)}
        </button>
      `).join('')}
    </nav>
  `;
}

function renderHomeItemRows(items = [], emptyText = 'Nothing needs attention here.', options = {}) {
  if (!items.length) {
    return `<p class="empty-section-copy">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <div class="home-row-list">
      ${items.map((item) => {
        const meta = [
          item.dueDate ? `Due ${formatDate(item.dueDate)}` : '',
          item.priority === 'high' ? 'High priority' : '',
          item.planningStatus && item.planningStatus !== 'active' ? item.planningStatus : ''
        ].filter(Boolean).join(' • ');
        const page = options.detailPage || detailPageForHomeSection(item.sectionKey);
        const canComplete = ['coachTasks', 'goalsValues'].includes(item.sectionKey)
          && !closedPlanningStatuses.has(item.planningStatus);
        return `
          <div class="home-row ${escapeHtml(options.rowTone || '')}">
            <button class="home-row-open" type="button" data-home-client-id="${escapeHtml(String(item.clientId))}" data-home-detail-page="${escapeHtml(page)}">
              <span class="home-row-main">
                <strong>${escapeHtml(item.clientName || 'Client')}</strong>
                <span>${escapeHtml(item.title || 'Untitled item')}</span>
                ${item.detail ? `<em>${escapeHtml(item.detail)}</em>` : ''}
              </span>
            </button>
            ${meta ? `<span class="home-row-meta">${escapeHtml(meta)}</span>` : ''}
            <span class="home-row-actions">
              ${canComplete ? `
                <button
                  class="home-row-action complete"
                  type="button"
                  data-home-action="complete"
                  data-home-client-id="${escapeHtml(String(item.clientId))}"
                  data-home-section-key="${escapeHtml(item.sectionKey)}"
                  data-home-item-index="${escapeHtml(String(item.itemIndex))}"
                  title="Mark ${escapeHtml(item.title || 'item')} complete"
                >Done</button>
              ` : ''}
              <button class="home-row-action open" type="button" data-home-client-id="${escapeHtml(String(item.clientId))}" data-home-detail-page="${escapeHtml(page)}">Open</button>
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function homeItemKey(item) {
  return `${item.clientId}:${item.sectionKey}:${item.itemIndex}`;
}

function renderAttentionLane(label, caption, items, tone = '') {
  const expanded = state.expandedHomeLanes.has(tone);
  const initialLimit = tone === 'overdue' || tone === 'today' ? 8 : 6;
  const visibleItems = expanded ? items : items.slice(0, initialLimit);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  return `
    <section class="attention-lane ${escapeHtml(tone)}" data-home-anchor="${escapeHtml(tone)}">
      <header class="attention-lane-label">
        <span class="attention-leaf" aria-hidden="true"></span>
        <strong>${escapeHtml(label)}</strong>
        <em>${escapeHtml(String(items.length))}</em>
        <small>${escapeHtml(caption)}</small>
      </header>
      <div class="attention-lane-body">
        ${renderHomeItemRows(visibleItems, `Nothing in ${label.toLowerCase()}.`, { rowTone: tone })}
        ${items.length > initialLimit ? `
          <button class="attention-lane-more" type="button" data-home-lane="${escapeHtml(tone)}">
            ${expanded ? 'Show fewer' : `Show ${hiddenCount} more`}
          </button>
        ` : ''}
      </div>
    </section>
  `;
}

function renderHomeClientRows(clients = [], emptyText = 'No clients in this group.') {
  if (!clients.length) {
    return `<p class="empty-section-copy">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <div class="home-row-list">
      ${clients.map((client) => {
        const meta = [
          client.daysSinceUpdate != null ? `Updated ${formatDaysAgo(client.daysSinceUpdate)}` : '',
          client.lastSourceDate ? `Last source ${formatDate(client.lastSourceDate)}` : '',
          `${client.sourceCount || 0} sources`
        ].filter(Boolean).join(' • ');
        return `
          <button class="home-row home-client-row" type="button" data-home-client-id="${escapeHtml(String(client.id))}" data-home-detail-page="snapshot">
            <span class="home-row-main">
              <strong>${escapeHtml(client.name || 'Client')}</strong>
              ${client.summary ? `<span>${escapeHtml(client.summary)}</span>` : '<span>No overview captured yet.</span>'}
            </span>
            <span class="home-row-meta">${escapeHtml(meta)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderHomeGroup(title, subtitle, bodyHtml, tone = '', anchor = '') {
  return `
    <section class="home-group ${escapeHtml(tone)}" ${anchor ? `data-home-anchor="${escapeHtml(anchor)}"` : ''}>
      <div class="home-group-head">
        <h3>${escapeHtml(title)}</h3>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ''}
      </div>
      ${bodyHtml}
    </section>
  `;
}

function renderCoachHomeAttention(home) {
  const attention = home.attention || {};
  const scheduledKeys = new Set([
    ...(attention.overdueTasks || []),
    ...(attention.dueTodayTasks || []),
    ...(attention.dueThisWeekTasks || [])
  ].map(homeItemKey));
  const watchItems = (attention.highPriorityItems || []).filter((item) => !scheduledKeys.has(homeItemKey(item)));
  return `
    <div class="attention-ledger">
      <div class="attention-ledger-head">
        <div>
          <span>Priority path</span>
          <h3>Attention ledger</h3>
        </div>
        <p>Work top to bottom. Dated high-priority items appear once, in their due-date lane.</p>
      </div>
      ${renderAttentionLane('Overdue', 'Past due', attention.overdueTasks || [], 'overdue')}
      ${renderAttentionLane('Today', 'Due now', attention.dueTodayTasks || [], 'today')}
      ${renderAttentionLane('Missing Info', 'Context needed before the next decision', attention.missingInfoItems || [], 'missing')}
      ${renderAttentionLane('Next', `${home.rules?.dueSoonDays || 7}-day horizon`, attention.dueThisWeekTasks || [], 'next')}
      ${renderAttentionLane('Watch', 'Undated priorities', watchItems, 'watch')}
    </div>
  `;
}

function renderHomeBriefing(home) {
  const stats = home.stats || {};
  const urgentCount = Number(stats.overdueTaskCount || 0) + Number(stats.dueTodayTaskCount || 0);
  const summary = urgentCount
    ? `${urgentCount} client action${urgentCount === 1 ? '' : 's'} need attention now.`
    : 'No client actions are due right now.';
  return `
    <section class="home-briefing" aria-label="Practice status">
      <div class="home-brief-copy">
        <span class="home-brief-signal">Needs attention now</span>
        <h3>${escapeHtml(summary)}</h3>
        <p>Start with overdue and missing-context work, then move through today's follow-ups.</p>
      </div>
      <div class="home-brief-facts" aria-label="Practice summary">
        <button class="home-brief-fact overdue" type="button" data-home-jump="overdue"><strong>${escapeHtml(String(stats.overdueTaskCount || 0))}</strong><small>overdue</small></button>
        <button class="home-brief-fact today" type="button" data-home-jump="today"><strong>${escapeHtml(String(stats.dueTodayTaskCount || 0))}</strong><small>due today</small></button>
        <button class="home-brief-fact missing" type="button" data-home-jump="missing"><strong>${escapeHtml(String(stats.missingInfoCount || 0))}</strong><small>missing info</small></button>
        <button class="home-brief-fact quiet" type="button" data-home-jump="quiet"><strong>${escapeHtml(String(stats.staleClientCount || 0))}</strong><small>quiet clients</small></button>
      </div>
    </section>
  `;
}

function renderCoachHomeActivity(home) {
  const activity = home.activity || {};
  const stats = home.stats || {};
  const sourceTypes = activity.sourceTypes || [];
  return `
    <div class="home-grid">
      ${renderHomeGroup(
        'Recently Updated',
        'Most recent accepted dashboard updates',
        renderHomeClientRows(activity.recentlyUpdated || [], 'No recent client updates yet.')
      )}
      ${renderHomeGroup(
        'Quiet Clients',
        `No dashboard update in ${home.rules?.staleDays || 14}+ days`,
        renderHomeClientRows(activity.staleClients || [], 'No clients are stale by this rule.'),
        activity.staleClients?.length ? 'warm' : '',
        'quiet'
      )}
      ${renderHomeGroup(
        'Messages This Week',
        `${stats.recentMessageCoveragePercent || 0}% client coverage`,
        `
          <div class="home-statement">
            <strong>${escapeHtml(String(stats.recentMessageClientCount || 0))} of ${escapeHtml(String(stats.clientCount || 0))}</strong>
            <span>clients have a message source in the last ${escapeHtml(String(home.rules?.activityDays || 7))} days.</span>
          </div>
        `
      )}
      ${renderHomeGroup(
        'Source Types',
        `${stats.recentSourceCount || 0} new source${stats.recentSourceCount === 1 ? '' : 's'} in the last ${home.rules?.activityDays || 7} days`,
        sourceTypes.length
          ? `<div class="source-type-list">${sourceTypes.map((entry) => `<span><strong>${escapeHtml(String(entry.count))}</strong>${escapeHtml(entry.label)}</span>`).join('')}</div>`
          : '<p class="empty-section-copy">No source metadata yet.</p>'
      )}
    </div>
  `;
}

function renderSegmentGroupRows(groups = [], emptyText = 'No segment data yet.') {
  if (!groups.length) {
    return `<p class="empty-section-copy">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <div class="segment-list">
      ${groups.map((group) => `
        <div class="segment-row">
          <div class="segment-row-head">
            <strong>${escapeHtml(group.label)}</strong>
            <span>${escapeHtml(String(group.count))} client${group.count === 1 ? '' : 's'}</span>
          </div>
          <div class="segment-clients">
            ${(group.clients || []).slice(0, 10).map((client) => `
              <button type="button" data-home-client-id="${escapeHtml(String(client.id))}" data-home-detail-page="snapshot">
                ${escapeHtml(client.name)}
              </button>
            `).join('')}
            ${(group.clients || []).length > 10 ? `<span>+${escapeHtml(String(group.clients.length - 10))} more</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCoachHomeSegments(home) {
  const segments = home.segments || {};
  return `
    <div class="home-grid">
      ${renderHomeGroup(
        'Profile Segments',
        'Cohort, program, curriculum, goal, format, and contraindication fields',
        renderSegmentGroupRows(segments.profileSegments || [], 'No profile segment fields yet.')
      )}
      ${renderHomeGroup(
        'Client Tags',
        'Themes captured in saved client profiles',
        renderSegmentGroupRows(segments.suggestedTags || [], 'No suggested tags yet.')
      )}
    </div>
  `;
}

function renderCoachHome() {
  const home = getCoachHomeData();
  const activeTab = ['attention', 'activity', 'segments'].includes(state.coachHomeTab)
    ? state.coachHomeTab
    : 'attention';
  state.coachHomeTab = activeTab;
  const tabContent = activeTab === 'activity'
    ? renderCoachHomeActivity(home)
    : activeTab === 'segments'
      ? renderCoachHomeSegments(home)
      : renderCoachHomeAttention(home);
  els.coachHomeContent.innerHTML = `
    <div class="home-atlas">
      ${renderHomeBriefing(home)}
    </div>
    <div class="home-workbench">
      ${renderHomeTabs(activeTab)}
      <div class="home-tab-content">${tabContent}</div>
    </div>
  `;
}

function jumpToHomeSection(jumpKey) {
  const destinations = {
    overdue: { tab: 'attention', anchor: 'overdue' },
    today: { tab: 'attention', anchor: 'today' },
    missing: { tab: 'attention', anchor: 'missing' },
    quiet: { tab: 'activity', anchor: 'quiet' }
  };
  const destination = destinations[jumpKey];
  if (!destination) {
    return;
  }
  pushNavigationLocation();
  state.coachHomeTab = destination.tab;
  renderCoachHome();
  window.requestAnimationFrame(() => {
    const target = els.coachHomeContent.querySelector(`[data-home-anchor="${destination.anchor}"]`);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('is-jump-target');
    window.setTimeout(() => target.classList.remove('is-jump-target'), 1500);
  });
}

function renderDetailMetric(label, value, tone = '') {
  return `
    <div class="metric ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function countHighPriorityOpenItems(dashboard) {
  return [...dashboard.coachTasks, ...dashboard.goalsValues].filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const priority = getPriorityOption(item.priority);
    const status = getPlanningStatusOption(item);
    return priority.value === 'high' && !['completed', 'abandoned', 'outdated'].includes(status.value);
  }).length;
}

function renderSectionActions(sectionKey) {
  const undoCount = Number(state.selectedClientDetail?.undoCounts?.[sectionKey] || 0);
  const editAction = isPrioritizableSection(sectionKey)
    ? ''
    : `<button class="section-link edit-section" type="button" data-section-key="${escapeHtml(sectionKey)}">Edit</button>`;
  return `
    <div class="section-actions">
      ${editAction}
      <button class="section-link undo-section" type="button" data-section-key="${escapeHtml(sectionKey)}" ${undoCount ? '' : 'disabled'}>
        Undo${undoCount ? ` ${undoCount}` : ''}
      </button>
    </div>
  `;
}

function renderPlanningVisibilityMenu() {
  const hiddenStatuses = getPlanningHiddenStatuses();
  return `
    <details class="planning-visibility-menu">
      <summary>Hide statuses</summary>
      <div class="planning-visibility-options">
        ${planningStatusOptions.map((option) => `
          <label>
            <input
              type="checkbox"
              data-planning-hidden-status="${escapeHtml(option.value)}"
              ${hiddenStatuses.has(option.value) ? 'checked' : ''}
            />
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join('')}
      </div>
    </details>
  `;
}

function renderSectionTitleActions(sectionKey, planningSection) {
  return `
    <div class="section-title-actions">
      ${sectionKey === 'coachTasks' ? '<button class="section-add-button add-planning-item" type="button" data-section-key="coachTasks"><span aria-hidden="true">+</span> Add to-do</button>' : ''}
      ${planningSection ? renderPlanningVisibilityMenu() : ''}
      ${renderSectionActions(sectionKey)}
    </div>
  `;
}

function sectionWasUpdated(sectionKey) {
  return Boolean(
    state.lastUpdateNotice?.clientId === state.selectedClientDetail?.client?.id
    && state.lastUpdateNotice?.sectionKeys?.includes(sectionKey)
  );
}

function renderUpdateNotice(detail) {
  const notice = state.lastUpdateNotice;
  if (!notice || notice.clientId !== detail?.client?.id) {
    return '';
  }
  const labels = (notice.sectionKeys || []).map((key) => sectionLabel(key));
  const fallback = labels.length
    ? `Updated ${labels.join(', ')} from the new note.`
    : 'Updated the dashboard from the new note.';
  return `
    <section class="update-notice">
      <div>
        <p class="section-kicker">AI Update</p>
        <strong>${escapeHtml(notice.summary || fallback)}</strong>
        ${labels.length ? `<span>${escapeHtml(labels.length)} section${labels.length === 1 ? '' : 's'} changed: ${escapeHtml(labels.join(', '))}</span>` : ''}
      </div>
      <button class="section-link dismiss-update-notice" type="button">Dismiss</button>
    </section>
  `;
}

function renderDetailPageTabs(activePage) {
  return `
    <nav class="detail-page-tabs" aria-label="Client profile sections">
      ${detailPages.map((page) => `
        <button class="detail-page-tab ${page.key === activePage ? 'active' : ''}" type="button" data-detail-page="${escapeHtml(page.key)}">
          ${escapeHtml(page.label)}
        </button>
      `).join('')}
    </nav>
  `;
}

function renderProfileReferenceChips(profile = {}) {
  const chips = [];
  const curriculumWeek = getCurriculumWeek(profile);
  const trainingProgramWeek = getTrainingProgramWeek(profile);
  if (curriculumWeek) {
    chips.push({ label: `Curriculum: ${curriculumWeek}`, className: 'profile-chip-week' });
  }
  if (trainingProgramWeek) {
    chips.push({ label: `Training: ${trainingProgramWeek}`, className: 'profile-chip-week' });
  }
  for (const config of getProfileSelectFields()) {
    const value = normalizeProfileSelectValue(profile, config);
    if (value) {
      chips.push({ label: `${config.chipLabel}: ${value}`, className: config.className });
    }
  }
  for (const config of getProfileMultiSelectFields()) {
    for (const value of toProfileArray(profile[config.key])) {
      chips.push({ label: value, className: config.className });
    }
  }
  if (!chips.length) {
    return '';
  }
  return `
    <div class="profile-chip-strip">
      ${chips.map((chip) => `<span class="profile-chip ${escapeHtml(chip.className)}">${escapeHtml(chip.label)}</span>`).join('')}
    </div>
  `;
}

function renderProfileSelectOptions(options, selectedValue) {
  return [
    '<option value="">Not set</option>',
    ...options.map((option) => `<option value="${escapeHtml(option)}" ${option === selectedValue ? 'selected' : ''}>${escapeHtml(option)}</option>`)
  ].join('');
}

function renderProgramSettingsFields(profile = {}, dataAttribute = 'data-profile-field') {
  const selectControls = getProfileSelectFields().map((config) => {
    const value = normalizeProfileSelectValue(profile, config);
    return `
      <label>
        ${escapeHtml(config.label)}
        <select ${dataAttribute}="${escapeHtml(config.key)}">
          ${renderProfileSelectOptions(config.options, value)}
        </select>
      </label>
    `;
  }).join('');

  const multiControls = getProfileMultiSelectFields().map((config) => {
    const values = new Set(toProfileArray(profile[config.key]));
    return `
      <label>
        ${escapeHtml(config.label)}
        <select multiple size="6" ${dataAttribute}="${escapeHtml(config.key)}" data-profile-multiple="true">
          ${config.options.map((option) => `<option value="${escapeHtml(option)}" ${values.has(option) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
        </select>
      </label>
    `;
  }).join('');

  return `
    ${selectControls}
    <label>
      Curriculum start date
      <input type="date" value="${escapeHtml(profile.curriculumStartDate || '')}" ${dataAttribute}="curriculumStartDate" />
    </label>
    <label>
      Training program start date
      <input type="date" value="${escapeHtml(profile.programStartDate || '')}" ${dataAttribute}="programStartDate" />
    </label>
    <div class="computed-week">
      <span>Curriculum Week</span>
      <strong data-curriculum-week-display>${escapeHtml(getCurriculumWeek(profile) || 'Not set')}</strong>
    </div>
    <div class="computed-week">
      <span>Training Program Week</span>
      <strong data-training-program-week-display>${escapeHtml(getTrainingProgramWeek(profile) || 'Not set')}</strong>
    </div>
    ${multiControls}
  `;
}

function renderClientProfileControls(profile = {}) {
  return `
    <div class="profile-control-panel">
      <div class="profile-control-head">
        <strong>Program Settings</strong>
        <span>Most fields are single-select; contraindications can have multiple selections. Selected values appear on Snapshot.</span>
      </div>
      <div class="profile-control-grid">
        ${renderProgramSettingsFields(profile)}
      </div>
    </div>
  `;
}

function collectIntakeClientProfile() {
  const profile = {};
  for (const control of els.intakeProgramSettings.querySelectorAll('[data-intake-profile-field]')) {
    const field = control.dataset.intakeProfileField || '';
    if (!profileControlKeys.has(field)) {
      continue;
    }
    const value = control.multiple
      ? [...control.selectedOptions].map((option) => option.value).filter(Boolean)
      : control.value;
    if (Array.isArray(value) ? value.length : String(value || '').trim()) {
      profile[field] = value;
    }
  }
  return applyComputedProfileWeeks(profile, new Set(['curriculumStartDate', 'programStartDate']));
}

function updateIntakeProgramWeek() {
  const curriculumStartDate = els.intakeProgramSettings.querySelector('[data-intake-profile-field="curriculumStartDate"]')?.value || '';
  const programStartDate = els.intakeProgramSettings.querySelector('[data-intake-profile-field="programStartDate"]')?.value || '';
  const curriculumDisplay = els.intakeProgramSettings.querySelector('[data-curriculum-week-display]');
  const trainingDisplay = els.intakeProgramSettings.querySelector('[data-training-program-week-display]');
  if (curriculumDisplay) {
    curriculumDisplay.textContent = calculateProgramWeek(curriculumStartDate) || 'Not set';
  }
  if (trainingDisplay) {
    trainingDisplay.textContent = calculateProgramWeek(programStartDate) || 'Not set';
  }
}

function renderIntakeProgramSettings(profile = {}) {
  if (!els.intakeProgramSettings) {
    return;
  }
  els.intakeProgramSettings.innerHTML = `
    <div class="profile-control-panel">
      <div class="profile-control-head">
        <strong>Program Settings</strong>
        <span>Set known cohort/program fields now; they stay editable on Bio & Intake.</span>
      </div>
      <div class="profile-control-grid">
        ${renderProgramSettingsFields(profile, 'data-intake-profile-field')}
      </div>
    </div>
  `;
  updateIntakeProgramWeek();
}

function sortPlanningRows(rows) {
  return [...rows].sort((left, right) => (
    left.normalized.planningStatus.rank - right.normalized.planningStatus.rank
    || left.normalized.priority.rank - right.normalized.priority.rank
    || left.index - right.index
  ));
}

function renderSelectOptions(options, selectedValue) {
  return options.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>
  `).join('');
}

function renderPlanningControls(sectionKey, itemIndex, normalized) {
  return `
    <details class="item-planning-menu">
      <summary>Adjust</summary>
      <div class="item-planning-controls">
        <label class="planning-copy-field planning-title-field">
          <span>Title</span>
          <input type="text" value="${escapeHtml(normalized.title || '')}" data-planning-input="title" />
        </label>
        <label class="planning-copy-field planning-details-field">
          <span>Details</span>
          <textarea rows="3" data-planning-input="details">${escapeHtml(normalized.detail || '')}</textarea>
        </label>
        <label>
          <span>Priority</span>
          <select data-planning-input="priority">
            ${renderSelectOptions(priorityOptions, normalized.priority.value)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select data-planning-input="planningStatus">
            ${renderSelectOptions(planningStatusOptions, normalized.planningStatus.value)}
          </select>
        </label>
        <label>
          <span>Due</span>
          <input type="date" value="${escapeHtml(normalized.dueDate || '')}" data-planning-input="dueDate" />
        </label>
        <div class="planning-adjust-actions">
          <span>Text and scheduling stay together.</span>
          <button
            class="btn btn-primary save-planning-item"
            type="button"
            data-section-key="${escapeHtml(sectionKey)}"
            data-item-index="${escapeHtml(String(itemIndex))}"
          >Save changes</button>
        </div>
      </div>
    </details>
  `;
}

function renderPlanningChips(normalized) {
  const priorityChip = normalized.priority.value === 'none'
    ? ''
    : `<span class="planning-chip ${escapeHtml(normalized.priority.className)}">${escapeHtml(normalized.priority.label)}</span>`;
  const dueState = getDueDateState(normalized.dueDate);
  const dueLabel = dueState === 'overdue'
    ? `Overdue ${formatDate(normalized.dueDate)}`
    : dueState === 'due-today'
      ? 'Due today'
      : `Due ${formatDate(normalized.dueDate)}`;
  const dueChip = normalized.dueDate
    ? `<span class="planning-chip due-chip ${escapeHtml(dueState)}">${escapeHtml(dueLabel)}</span>`
    : '';
  return `
    <div class="planning-chip-row">
      ${priorityChip}
      <span class="planning-chip ${escapeHtml(normalized.planningStatus.className)}">${escapeHtml(normalized.planningStatus.label)}</span>
      ${dueChip}
    </div>
  `;
}

function renderMissingInfoActions(itemIndex) {
  return `
    <div class="missing-info-actions">
      <button
        class="section-link missing-info-action"
        type="button"
        data-missing-info-action="convert"
        data-item-index="${escapeHtml(String(itemIndex))}"
      >
        Convert to to-do
      </button>
      <button
        class="section-link missing-info-action"
        type="button"
        data-missing-info-action="resolve"
        data-item-index="${escapeHtml(String(itemIndex))}"
      >
        Resolve
      </button>
    </div>
  `;
}

function renderPlanningHiddenSummary(sectionKey, hiddenRows, expanded) {
  const count = hiddenRows.length;
  const hiddenStatusValues = new Set(hiddenRows.map(({ normalized }) => normalized.planningStatus.value));
  const closedOnly = [...hiddenStatusValues].every((value) => closedPlanningStatuses.has(value));
  const label = closedOnly ? 'closed' : 'filtered';
  return `
    <li class="planning-hidden-summary">
      <span>${escapeHtml(String(count))} ${label} item${count === 1 ? '' : 's'} ${expanded ? 'shown' : 'hidden'}</span>
      <button
        class="section-link toggle-hidden-planning"
        type="button"
        data-section-key="${escapeHtml(sectionKey)}"
        data-expanded="${expanded ? 'false' : 'true'}"
      >
        ${expanded ? 'Hide' : 'Show'}
      </button>
    </li>
  `;
}

function renderDetailList(title, value, sourceLookup, options = {}) {
  const values = Array.isArray(value) ? value : [];
  if (!values.length && !options.sectionKey) {
    return '';
  }
  const planningSection = isPrioritizableSection(options.sectionKey);
  const missingInfoSection = options.sectionKey === 'missingInfo';
  const rowModels = values.map((item, index) => ({
    item,
    index,
    normalized: normalizeDetailItem(item, { sectionKey: options.sectionKey })
  }));
  const sortedRows = planningSection ? sortPlanningRows(rowModels) : rowModels;
  const sectionExpanded = planningSection && isPlanningSectionExpanded(options.sectionKey);
  const hiddenRows = planningSection
    ? sortedRows.filter(({ normalized }) => isPlanningStatusHidden(normalized.planningStatus.value))
    : [];
  const visibleRows = planningSection && !sectionExpanded
    ? sortedRows.filter(({ normalized }) => !isPlanningStatusHidden(normalized.planningStatus.value))
    : sortedRows;
  const renderedRows = visibleRows.map(({ index, normalized }) => {
    const titleHtml = normalized.title ? `<strong>${renderEvidenceText(normalized.title, sourceLookup, normalized.evidenceIds)}</strong>` : '';
    const detailHtml = normalized.detail ? `<span>${renderEvidenceText(normalized.detail, sourceLookup, normalized.evidenceIds)}</span>` : '';
    const bodyHtml = titleHtml || detailHtml
      ? `${titleHtml}${detailHtml}`
      : '<span>No details captured yet.</span>';
    if (missingInfoSection) {
      return `
        <li class="missing-info-item">
          <div>${bodyHtml}</div>
          ${renderMissingInfoActions(index)}
        </li>
      `;
    }
    if (!planningSection) {
      return `<li>${bodyHtml}</li>`;
    }
    return `
      <li class="planning-item ${escapeHtml(normalized.priority.className)} ${escapeHtml(normalized.planningStatus.className)}">
        <div class="planning-item-body">
          ${bodyHtml}
          ${renderPlanningChips(normalized)}
        </div>
        ${renderPlanningControls(options.sectionKey, index, normalized)}
      </li>
    `;
  }).join('');
  const hiddenSummary = planningSection && hiddenRows.length
    ? renderPlanningHiddenSummary(options.sectionKey, hiddenRows, sectionExpanded)
    : '';
  const emptyRow = !renderedRows && !hiddenSummary
    ? '<li><span>No entries yet.</span></li>'
    : '';
  const rows = `${renderedRows}${hiddenSummary}${emptyRow}`;
  return `
    <section class="${options.wide ? 'detail-section wide' : 'detail-section'} ${planningSection ? 'prioritizable' : ''} ${options.tone || ''} ${sectionWasUpdated(options.sectionKey) ? 'is-recently-updated' : ''}">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        ${renderSectionTitleActions(options.sectionKey, planningSection)}
      </div>
      <ul>${rows}</ul>
    </section>
  `;
}

function formatObjectLabel(key) {
  const spaced = String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderObjectSection(title, value, sourceLookup, options = {}) {
  const sectionKey = options.sectionKey || 'clientProfile';
  if ((!value || typeof value !== 'object' || Array.isArray(value)) && !sectionKey) {
    return '';
  }
  const entries = Object.entries(compactObject(value))
    .filter(([key]) => sectionKey !== 'clientProfile' || !profileControlKeys.has(key));
  const rows = entries.length ? entries.map(([key, entry]) => `
    <div class="object-row">
      <span>${escapeHtml(formatObjectLabel(key))}</span>
      <strong>${renderEvidenceText(entry, sourceLookup)}</strong>
    </div>
  `).join('') : '<p class="empty-section-copy">No entries yet.</p>';
  const profileControls = sectionKey === 'clientProfile' ? renderClientProfileControls(value || {}) : '';
  return `
    <section class="detail-section compact-list ${options.tone || ''} ${sectionWasUpdated(sectionKey) ? 'is-recently-updated' : ''}">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        ${renderSectionActions(sectionKey)}
      </div>
      ${rows}
      ${profileControls}
    </section>
  `;
}

function renderTimeline(value, sourceLookup) {
  const values = Array.isArray(value) ? value : [];
  return `
    <section class="timeline-section ${sectionWasUpdated('timeline') ? 'is-recently-updated' : ''}">
      <div class="section-title-row">
        <h3>Timeline</h3>
        ${renderSectionActions('timeline')}
      </div>
      <div class="timeline-list">
        ${values.length ? values.map((item) => {
          const normalized = normalizeTimelineItem(item);
          return `
            <div class="timeline-item">
              <time>${renderEvidenceText(normalized.dateLabel, sourceLookup)}</time>
              <p>${renderEvidenceText(normalized.detail, sourceLookup, normalized.evidenceIds)}</p>
            </div>
          `;
        }).join('') : '<p class="empty-section-copy">No timeline entries yet.</p>'}
      </div>
    </section>
  `;
}

function renderSourceDrawer(source) {
  const meta = [source.sourceType, source.sourceDate, `${wordCount(source.rawText)} words`].filter(Boolean).join(' • ');
  return `
    <details
      class="raw-source"
      data-session-source
      data-source-id="${escapeHtml(source.sourceId || '')}"
      data-source-type="${escapeHtml(source.sourceType || 'unknown')}"
    >
      <summary>
        <span class="source-number">${escapeHtml(String(source.displayNumber || ''))}</span>
        <span>
          <strong>${escapeHtml(source.title)}</strong>
          <em>${escapeHtml(meta)}</em>
        </span>
      </summary>
      ${source.annotation ? `<p class="source-annotation">${escapeHtml(source.annotation)}</p>` : ''}
      <pre>${escapeHtml(source.rawText || '')}</pre>
    </details>
  `;
}

function openCitedSource(sourceId) {
  const normalizedSourceId = String(sourceId || '').trim();
  if (!normalizedSourceId || !state.selectedClientDetail) {
    showToast('Source is not available locally.', 'error');
    return;
  }
  if (getActiveDetailPage() !== 'notes') {
    pushNavigationLocation();
  }
  state.detailPage = 'notes';
  renderClientDetail(state.selectedClientDetail);
  const drawer = [...els.detailContent.querySelectorAll('[data-session-source]')]
    .find((candidate) => candidate.dataset.sourceId === normalizedSourceId);
  if (!drawer) {
    showToast('Source is not available in the local archive.', 'error');
    return;
  }
  drawer.open = true;
  drawer.classList.add('is-targeted-source');
  drawer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => drawer.classList.remove('is-targeted-source'), 1800);
}

function getSessionNoteTypeOptions(sources = []) {
  const values = [...new Set(sources.map((source) => sanitizeName(source.sourceType || 'unknown')).filter(Boolean))];
  return values.sort((left, right) => left.localeCompare(right));
}

function renderSessionNotesArchiveControls(sources = []) {
  const types = getSessionNoteTypeOptions(sources);
  const activeType = types.includes(state.sessionNotesType) ? state.sessionNotesType : 'all';
  if (activeType !== state.sessionNotesType) {
    state.sessionNotesType = activeType;
  }
  return `
    <div class="archive-filter-bar">
      <label>
        Search notes
        <input
          type="search"
          data-session-notes-search
          value="${escapeHtml(state.sessionNotesQuery)}"
          placeholder="Search title, annotation, or source text"
        />
      </label>
      <label>
        Source type
        <select data-session-notes-type>
          <option value="all" ${activeType === 'all' ? 'selected' : ''}>All source types</option>
          ${types.map((type) => `<option value="${escapeHtml(type)}" ${activeType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
        </select>
      </label>
      <div class="archive-filter-count">
        <span>Showing</span>
        <strong data-session-notes-count>${escapeHtml(String(sources.length))}</strong>
      </div>
    </div>
  `;
}

function applySessionNoteFilters() {
  const archive = els.detailContent.querySelector('[data-session-notes-archive]');
  if (!archive) {
    return;
  }
  const query = String(state.sessionNotesQuery || '').trim().toLowerCase();
  const type = state.sessionNotesType || 'all';
  const sources = [...archive.querySelectorAll('[data-session-source]')];
  let visible = 0;
  sources.forEach((source) => {
    const sourceType = source.dataset.sourceType || '';
    const searchText = source.dataset.sourceSearch || source.textContent.toLowerCase();
    const typeMatches = type === 'all' || sourceType === type;
    const queryMatches = !query || searchText.includes(query);
    const show = typeMatches && queryMatches;
    source.hidden = !show;
    if (show) {
      visible += 1;
    }
  });
  const count = archive.querySelector('[data-session-notes-count]');
  if (count) {
    count.textContent = String(visible);
  }
  const empty = archive.querySelector('[data-session-notes-empty]');
  if (empty) {
    empty.hidden = visible !== 0 || sources.length === 0;
  }
}

function renderClientDetail(detail) {
  state.selectedClientDetail = detail;
  const structured = detail?.baseline?.structured || {};
  const dashboard = buildDashboardModel(structured);
  const sources = detail?.sources || [];
  const sourceLookup = buildSourceLookup(sources);
  els.detailClientName.textContent = detail?.client?.name || 'Client';
  els.detailMeta.textContent = `${sources.length} raw sources • accepted ${formatDate(detail?.baseline?.acceptedAt) || 'recently'}`;

  const tags = dashboard.suggestedTags.length
    ? `<div class="detail-tags">${dashboard.suggestedTags.map((tag) => `<span>${renderEvidenceText(tag, sourceLookup)}</span>`).join('')}</div>`
    : '';
  const taskCount = dashboard.coachTasks.filter((item) => !closedPlanningStatuses.has(getPlanningStatusOption(item).value)).length;
  const flagCount = dashboard.flags.length;
  const highPriorityCount = countHighPriorityOpenItems(dashboard);
  const missingInfoCount = dashboard.missingInfo.length;
  const sourceDrawers = sources.map((source, index) => renderSourceDrawer({
    ...source,
    displayNumber: index + 1
  })).join('');
  const activePage = getActiveDetailPage();
  const profileChips = renderProfileReferenceChips(dashboard.clientProfile);

  const snapshotHero = `
    <section class="detail-overview dashboard-hero ${sectionWasUpdated('overview') || sectionWasUpdated('clientProfile') || sectionWasUpdated('suggestedTags') ? 'is-recently-updated' : ''}">
      <div>
        <div class="section-title-row hero-title-row">
          <p class="section-kicker">Current Snapshot</p>
          ${renderSectionActions('overview')}
        </div>
        <p class="overview-copy">${renderEvidenceText(dashboard.overview || 'No overview captured yet.', sourceLookup)}</p>
        <div class="tag-block">
          ${profileChips}
          ${tags}
          ${renderSectionActions('suggestedTags')}
        </div>
      </div>
      <div class="metric-stack hero-stack">
        ${renderDetailMetric('Open To-Dos', taskCount, taskCount ? 'warm' : '')}
        ${renderDetailMetric('High Priority', highPriorityCount, highPriorityCount ? 'priority-hot' : '')}
        ${renderDetailMetric('Missing Info', missingInfoCount, missingInfoCount ? 'missing-hot' : '')}
        ${renderDetailMetric('Flags', flagCount, flagCount ? 'alert' : '')}
      </div>
    </section>
  `;

  const clientProfileBand = `
    <div class="dashboard-band">
      <div class="band-head">
        <span>Client Profile</span>
        <strong>Name, location, values, curriculum, program, and intake context</strong>
      </div>
      <div class="detail-grid">
        ${renderObjectSection('Profile Basics', dashboard.clientProfile, sourceLookup, { sectionKey: 'clientProfile' })}
        ${renderDetailList('Client Values', dashboard.clientValues, sourceLookup, { sectionKey: 'clientValues' })}
      </div>
    </div>
  `;

  const coachingPlanBand = `
    <div class="dashboard-band">
      <div class="band-head">
        <span>Coaching Plan</span>
        <strong>Agreed approach, habit focus, commitments, and future coaching direction</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Coaching Plan / Approach', dashboard.coachingPlanApproach, sourceLookup, { wide: true, sectionKey: 'coachingPlanApproach' })}
      </div>
    </div>
  `;

  const attentionBand = `
    <div class="dashboard-band attention-band">
      <div class="band-head">
        <span>Needs Attention</span>
        <strong>Coach to-dos, flags, and current follow-up items</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Coach To-Dos', dashboard.coachTasks, sourceLookup, { tone: 'priority', sectionKey: 'coachTasks' })}
        ${renderDetailList('Flags', dashboard.flags, sourceLookup, { tone: flagCount ? 'scope' : '', sectionKey: 'flags' })}
        ${renderDetailList('Missing Info', dashboard.missingInfo, sourceLookup, { wide: true, tone: 'missing-focus', sectionKey: 'missingInfo' })}
      </div>
    </div>
  `;

  const goalsBand = `
    <div class="dashboard-band">
      <div class="band-head">
        <span>Goals</span>
        <strong>Client goals and related coach to-dos</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Client Goals', dashboard.goalsValues, sourceLookup, { sectionKey: 'goalsValues' })}
        ${renderDetailList('Coach To-Dos', dashboard.coachTasks, sourceLookup, { tone: 'priority', sectionKey: 'coachTasks' })}
      </div>
    </div>
  `;

  const progressBand = `
    <div class="dashboard-band">
      <div class="band-head">
        <span>Progress</span>
        <strong>Compliance, workout completion, strength progression, and engagement</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Progress Tracking', dashboard.progressTracking, sourceLookup, { sectionKey: 'progressTracking' })}
        ${renderDetailList('Engagement', dashboard.engagementNotes, sourceLookup, { sectionKey: 'engagementNotes' })}
        ${renderDetailList('Nutrition', dashboard.nutritionThreads, sourceLookup, { sectionKey: 'nutritionThreads' })}
        ${renderDetailList('Mindset', dashboard.mindsetThreads, sourceLookup, { sectionKey: 'mindsetThreads' })}
        ${renderDetailList('Exercise', dashboard.exerciseThreads, sourceLookup, { sectionKey: 'exerciseThreads' })}
      </div>
    </div>
  `;

  const programBand = `
    <div class="dashboard-band domain-band">
      <div class="band-head">
        <span>Program Changes</span>
        <strong>Specific modifications, movement constraints, and decision memory seeds</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Program Changes', dashboard.programChanges, sourceLookup, { wide: true, sectionKey: 'programChanges' })}
        ${renderDetailList('Exercise', dashboard.exerciseThreads, sourceLookup, { sectionKey: 'exerciseThreads' })}
        ${renderDetailList('Flags', dashboard.flags, sourceLookup, { tone: flagCount ? 'scope' : '', sectionKey: 'flags' })}
      </div>
    </div>
  `;

  const resourcesBand = `
    <div class="dashboard-band">
      <div class="band-head">
        <span>Resources</span>
        <strong>Shared materials and education references</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Resources Shared', dashboard.resourcesShared, sourceLookup, { sectionKey: 'resourcesShared' })}
      </div>
    </div>
  `;

  const notesBand = `
    <div class="dashboard-band">
      <div class="band-head">
        <span>Session Notes</span>
        <strong>Source-linked history and evidence quality</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Confidence Notes', dashboard.confidenceNotes, sourceLookup, { sectionKey: 'confidenceNotes' })}
      </div>
    </div>
    <section class="source-summary session-notes-archive" data-session-notes-archive>
      <div class="source-summary-head">
        <h3>Check-In Archive</h3>
        <p>Search saved notes, transcripts, check-ins, and imported source material.</p>
      </div>
      ${renderSessionNotesArchiveControls(sources)}
      <p class="empty-section-copy" data-session-notes-empty hidden>No notes match the current filters.</p>
      ${sourceDrawers || '<p>No sources found.</p>'}
    </section>
  `;

  const timelineBand = renderTimeline(dashboard.timeline, sourceLookup);
  const pageContent = {
    snapshot: `${snapshotHero}${attentionBand}`,
    bio: clientProfileBand,
    approach: coachingPlanBand,
    goals: goalsBand,
    timeline: timelineBand,
    program: programBand,
    progress: progressBand,
    notes: notesBand,
    resources: resourcesBand
  };

  els.detailContent.innerHTML = `
    ${renderUpdateNotice(detail)}
    ${renderDetailPageTabs(activePage)}
    <div class="detail-page-panel">
      ${pageContent[activePage] || pageContent.snapshot}
    </div>
  `;
  applySessionNoteFilters();
}

function openEditSection(sectionKey) {
  const config = getSectionConfig(sectionKey);
  const structured = state.selectedClientDetail?.baseline?.structured || {};
  const dashboard = buildDashboardModel(structured);
  state.editSectionKey = sectionKey;
  els.editSectionTitle.textContent = `Edit ${config.label}`;
  els.editSectionHelp.textContent = config.type === 'text'
    ? 'Edit this dashboard text directly. This coach edit becomes part of the client profile and can be undone.'
    : config.type === 'object'
    ? 'Use one key: value pair per line. This coach edit becomes part of the client profile and can be undone.'
    : 'Use one item per line for lists and tags. Keep citation markers if you want existing evidence popovers to stay attached.';
  els.editSectionInput.rows = Math.max(config.rows || 6, 7);
  els.editSectionInput.value = formatValue(
    Object.prototype.hasOwnProperty.call(structured, sectionKey) ? structured[sectionKey] : dashboard[sectionKey],
    config.type
  );
  els.editSectionDialog.showModal();
  els.editSectionInput.focus();
}

async function saveEditedSection(event) {
  event.preventDefault();
  const sectionKey = state.editSectionKey;
  if (!sectionKey || !state.selectedClientDetail?.client?.id) {
    return;
  }
  const config = getSectionConfig(sectionKey);
  const value = parseFieldValue(els.editSectionInput.value, config.type);
  const currentValue = state.selectedClientDetail?.baseline?.structured?.[sectionKey];
  if (valuesEqual(currentValue, value)) {
    els.editSectionDialog.close();
    return;
  }

  setBusy(true, 'Saving section...');
  try {
    const detail = await window.coachNotes.updateClientSection({
      clientId: state.selectedClientDetail.client.id,
      sectionKey,
      value
    });
    els.editSectionDialog.close();
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast('Section updated.');
  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function undoSection(sectionKey) {
  if (!sectionKey || !state.selectedClientDetail?.client?.id) {
    return;
  }
  setBusy(true, 'Undoing section...');
  try {
    const detail = await window.coachNotes.undoClientSection({
      clientId: state.selectedClientDetail.client.id,
      sectionKey
    });
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast('Section reverted.');
  } catch (error) {
    showToast(`Undo failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function applyPlanningPatch(item, patch) {
  const next = item && typeof item === 'object' && !Array.isArray(item)
    ? { ...item }
    : { details: String(item || '') };

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    const title = String(patch.title || '').trim();
    ['title', 'label', 'resource', 'name', 'date'].forEach((key) => delete next[key]);
    if (title) {
      next.title = title;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'details')) {
    const details = String(patch.details || '').trim();
    ['details', 'currentStatus', 'urgency', 'summary', 'note', 'notes'].forEach((key) => delete next[key]);
    if (details) {
      next.details = details;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'priority')) {
    next.priority = getPriorityOption(patch.priority).value;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'planningStatus')) {
    next.planningStatus = normalizePlanningStatus(patch.planningStatus);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'dueDate')) {
    const dueDate = normalizeDueDateValue(patch.dueDate);
    if (dueDate) {
      next.dueDate = dueDate;
      delete next.dueOrReviewBy;
    } else {
      delete next.dueDate;
      delete next.dueOrReviewBy;
    }
  }
  return next;
}

function buildCoachTaskFromMissingInfo(item) {
  const normalized = normalizeDetailItem(item, { sectionKey: 'missingInfo' });
  const detail = normalized.detail || normalized.title || 'Clarify missing client context.';
  return {
    title: normalized.title || 'Clarify missing information',
    details: detail,
    priority: 'none',
    planningStatus: 'active',
    dueDate: '',
    evidenceIds: normalized.evidenceIds
  };
}

async function saveMissingInfoAction(button) {
  const action = button?.dataset?.missingInfoAction || '';
  const itemIndex = Number(button?.dataset?.itemIndex);
  const clientId = state.selectedClientDetail?.client?.id;
  const structured = state.selectedClientDetail?.baseline?.structured || {};
  const currentMissingInfo = Array.isArray(structured.missingInfo) ? structured.missingInfo : [];
  const currentCoachTasks = Array.isArray(structured.coachTasks) ? structured.coachTasks : [];
  if (!clientId || !['resolve', 'convert'].includes(action) || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= currentMissingInfo.length) {
    return;
  }

  const targetItem = currentMissingInfo[itemIndex];
  const nextMissingInfo = currentMissingInfo.filter((_, index) => index !== itemIndex);
  const updates = { missingInfo: nextMissingInfo };
  if (action === 'convert') {
    updates.coachTasks = [
      ...currentCoachTasks,
      buildCoachTaskFromMissingInfo(targetItem)
    ];
  }

  setBusy(true, action === 'convert' ? 'Converting missing info...' : 'Resolving missing info...');
  try {
    const detail = await window.coachNotes.updateClientSections({
      clientId,
      updates
    });
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast(action === 'convert' ? 'Missing info converted to a coach to-do.' : 'Missing info resolved.');
  } catch (error) {
    renderClientDetail(state.selectedClientDetail);
    showToast(`Missing info update failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function savePlanningItem(button) {
  const sectionKey = button?.dataset?.sectionKey || '';
  const itemIndex = Number(button?.dataset?.itemIndex);
  const controls = button?.closest('.item-planning-controls');
  if (!controls || !isPrioritizableSection(sectionKey) || !Number.isInteger(itemIndex)) {
    return;
  }
  const clientId = state.selectedClientDetail?.client?.id;
  const currentSection = state.selectedClientDetail?.baseline?.structured?.[sectionKey];
  if (!clientId || !Array.isArray(currentSection) || itemIndex < 0 || itemIndex >= currentSection.length) {
    return;
  }

  const readValue = (field) => controls.querySelector(`[data-planning-input="${field}"]`)?.value || '';
  const patch = {
    title: readValue('title'),
    details: readValue('details'),
    priority: readValue('priority'),
    planningStatus: readValue('planningStatus'),
    dueDate: readValue('dueDate')
  };
  const nextSection = currentSection.map((item, index) => (
    index === itemIndex ? applyPlanningPatch(item, patch) : item
  ));
  if (valuesEqual(currentSection, nextSection)) {
    return;
  }

  setBusy(true, 'Saving to-do...');
  try {
    const detail = await window.coachNotes.updateClientSection({
      clientId,
      sectionKey,
      value: nextSection
    });
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast('To-do updated.');
  } catch (error) {
    renderClientDetail(state.selectedClientDetail);
    showToast(`To-do save failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function buildNextClientProfile(currentProfile, patch) {
  const next = currentProfile && typeof currentProfile === 'object' && !Array.isArray(currentProfile)
    ? { ...currentProfile }
    : {};
  Object.assign(next, patch);
  return applyComputedProfileWeeks(next, new Set(Object.keys(patch)));
}

async function saveProfileField(control) {
  const field = control?.dataset?.profileField || '';
  if (!profileControlKeys.has(field)) {
    return;
  }
  const clientId = state.selectedClientDetail?.client?.id;
  const currentProfile = state.selectedClientDetail?.baseline?.structured?.clientProfile || {};
  if (!clientId || typeof currentProfile !== 'object' || Array.isArray(currentProfile)) {
    return;
  }

  const value = control.multiple
    ? [...control.selectedOptions].map((option) => option.value).filter(Boolean)
    : control.value;
  const nextProfile = buildNextClientProfile(currentProfile, { [field]: value });
  if (valuesEqual(currentProfile, nextProfile)) {
    return;
  }

  setBusy(true, 'Saving profile settings...');
  try {
    const detail = await window.coachNotes.updateClientSection({
      clientId,
      sectionKey: 'clientProfile',
      value: nextProfile
    });
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast('Profile settings updated.');
  } catch (error) {
    renderClientDetail(state.selectedClientDetail);
    showToast(`Profile save failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function openAddTodoDialog(sectionKey = 'coachTasks') {
  if (!state.selectedClientDetail?.client?.id || sectionKey !== 'coachTasks') {
    showToast('Select a client before adding a coach to-do.', 'error');
    return;
  }
  state.addTodoSectionKey = sectionKey;
  els.todoTitleInput.value = '';
  els.todoDueDateInput.value = '';
  els.todoPriorityInput.value = 'none';
  els.todoStatusInput.value = 'active';
  els.todoDetailsInput.value = '';
  renderTodoPresetControls();
  els.addTodoDialog.showModal();
  els.todoTitleInput.focus();
}

function buildCoachTodoFromDialog() {
  const title = sanitizeName(els.todoTitleInput.value);
  const details = sanitizeName(els.todoDetailsInput.value);
  if (!title && !details) {
    return null;
  }
  const item = {
    title: title || 'Coach to-do',
    details,
    priority: getPriorityOption(els.todoPriorityInput.value).value,
    planningStatus: normalizePlanningStatus(els.todoStatusInput.value),
    evidenceIds: []
  };
  const dueDate = normalizeDueDateValue(els.todoDueDateInput.value);
  if (dueDate) {
    item.dueDate = dueDate;
  }
  return item;
}

async function submitAddTodo(event) {
  event.preventDefault();
  const clientId = state.selectedClientDetail?.client?.id;
  const sectionKey = state.addTodoSectionKey || 'coachTasks';
  const currentSection = Array.isArray(state.selectedClientDetail?.baseline?.structured?.[sectionKey])
    ? state.selectedClientDetail.baseline.structured[sectionKey]
    : [];
  if (!clientId || sectionKey !== 'coachTasks') {
    showToast('Coach to-dos are not available for this client yet.', 'error');
    return;
  }
  const item = buildCoachTodoFromDialog();
  if (!item) {
    showToast('Enter a to-do title or details first.', 'error');
    els.todoTitleInput.focus();
    return;
  }

  setBusy(true, 'Adding coach to-do...');
  try {
    const detail = await window.coachNotes.updateClientSection({
      clientId,
      sectionKey,
      value: [...currentSection, item]
    });
    els.addTodoDialog.close();
    state.selectedClientDetail = detail;
    await loadClients();
    renderClientDetail(detail);
    setViewMode('detail');
    showToast('Coach to-do added.');
  } catch (error) {
    showToast(`To-do add failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function submitAddedNote(event) {
  event.preventDefault();
  if (state.noteRetryBlocked) {
    showToast('Reopen the client before retrying this note to avoid a duplicate.', 'error');
    return;
  }
  clearNoteError();
  addPastedNoteSource({ silent: true });
  if (!state.noteSources.length) {
    showToast('Add a note source before updating.', 'error');
    return;
  }

  const sources = [...state.noteSources];
  let reopenDialogOnError = false;
  let updateCompleted = false;
  let refreshFailedAfterUpdate = false;
  els.addNoteDialog.close();
  setBusy(true, 'Updating client dashboard...');
  try {
    const result = await window.coachNotes.updateClientFromNote({
      clientId: state.selectedClientDetail.client.id,
      sources
    });
    updateCompleted = true;
    state.selectedClientDetail = result.detail || result;
    const changedSections = Array.isArray(result.changedSections) ? result.changedSections : [];
    state.lastUpdateNotice = {
      clientId: state.selectedClientDetail.client.id,
      sectionKeys: changedSections,
      summary: result.updateSummary || ''
    };
    await loadClients();
    renderClientDetail(state.selectedClientDetail);
    setViewMode('detail');
    resetNoteDialog();
    const changeCount = changedSections.length || (Array.isArray(result.changes) ? result.changes.length : 0);
    showToast(changeCount ? `Dashboard updated: ${changeCount} section${changeCount === 1 ? '' : 's'} changed.` : 'Dashboard updated.');
  } catch (error) {
    reopenDialogOnError = true;
    if (updateCompleted) {
      refreshFailedAfterUpdate = true;
      state.noteRetryBlocked = true;
      els.updateNoteSubmitBtn.disabled = true;
      showNoteError(formatAddNoteRefreshError(error));
    } else {
      showNoteError(formatAddNoteError(error));
    }
  } finally {
    setBusy(false);
    if (reopenDialogOnError && !els.addNoteDialog.open) {
      renderNoteSources();
      els.addNoteDialog.showModal();
    }
    if (refreshFailedAfterUpdate) {
      showToast('Dashboard may have updated. Reopen the client before retrying.', 'error');
    } else if (reopenDialogOnError) {
      showToast('Update failed. The source is still in the dialog so you can retry.', 'error');
    }
  }
}

function formatDate(value) {
  const dateOnly = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString();
}

async function selectClient(clientId, options = {}) {
  const normalizedClientId = Number(clientId);
  if (!Number.isFinite(normalizedClientId) || state.loadingClientId === normalizedClientId) {
    return;
  }
  const requestedDetailPage = options.detailPage || '';
  const targetDetailPage = requestedDetailPage
    || (state.selectedClientId === normalizedClientId ? getActiveDetailPage() : 'snapshot');
  const changesLocation = state.viewMode !== 'detail'
    || state.selectedClientId !== normalizedClientId
    || getActiveDetailPage() !== targetDetailPage;
  if (!changesLocation && state.selectedClientDetail) {
    return;
  }
  if (options.recordHistory !== false && changesLocation) {
    pushNavigationLocation();
  }
  const navigationSequence = ++clientNavigationSequence;
  setClientNavigationLoading(normalizedClientId, true);
  try {
    const detail = await window.coachNotes.getClientDetail({ clientId: normalizedClientId });
    if (navigationSequence !== clientNavigationSequence) {
      return;
    }
    if (state.selectedClientId !== normalizedClientId) {
      state.detailPage = requestedDetailPage || 'snapshot';
    } else if (requestedDetailPage) {
      state.detailPage = requestedDetailPage;
    }
    state.selectedClientId = normalizedClientId;
    renderClients();
    renderClientDetail(detail);
    setViewMode('detail');
    animateClientSurfaceArrival();
  } catch (error) {
    if (navigationSequence === clientNavigationSequence) {
      showToast(`Load client failed: ${error.message}`, 'error');
    }
  } finally {
    if (navigationSequence === clientNavigationSequence) {
      setClientNavigationLoading(null, false);
    }
  }
}

async function loadCoachHome() {
  state.coachHome = await window.coachNotes.getCoachHome();
  renderCoachHome();
}

async function loadClients() {
  state.clients = await window.coachNotes.getClients();
  await loadCoachHome();
  if (state.selectedClientId && !state.clients.some((client) => client.id === state.selectedClientId)) {
    state.selectedClientId = null;
    state.selectedClientDetail = null;
    els.clientDetailPanel.hidden = true;
  }
  renderClients();
  updateStatusLine();
}

async function openCoachHome(options = {}) {
  cancelClientNavigation();
  if (!state.clients.length) {
    setViewMode('intake');
    return;
  }
  const resetToAttention = options.resetToAttention === true;
  const alreadyHome = state.viewMode === 'home';
  if (alreadyHome && !options.refresh && resetToAttention) {
    const atAttentionOrigin = state.coachHomeTab === 'attention'
      && Math.max(0, Number(els.mainSurface?.scrollTop || 0)) <= 1;
    if (atAttentionOrigin) {
      return;
    }
    if (options.recordHistory !== false) {
      pushNavigationLocation();
    }
    state.coachHomeTab = 'attention';
    renderCoachHome();
    els.mainSurface.scrollTop = 0;
    return;
  }
  if (options.recordHistory !== false && state.viewMode !== 'home') {
    pushNavigationLocation();
  }
  if (options.refresh) {
    setBusy(true, 'Refreshing Coach Home...');
    try {
      await loadClients();
    } catch (error) {
      showToast(`Coach Home refresh failed: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  } else {
    if (resetToAttention) {
      state.coachHomeTab = 'attention';
    }
    renderCoachHome();
  }
  state.selectedClientId = null;
  state.selectedClientDetail = null;
  renderClients();
  setViewMode('home');
  if (resetToAttention) {
    els.mainSurface.scrollTop = 0;
  }
}

async function completeHomePlanningItem(button) {
  const clientId = Number(button?.dataset?.homeClientId);
  const sectionKey = button?.dataset?.homeSectionKey || '';
  const itemIndex = Number(button?.dataset?.homeItemIndex);
  if (!Number.isFinite(clientId) || !isPrioritizableSection(sectionKey) || !Number.isInteger(itemIndex)) {
    showToast('This item could not be updated from Mission Control.', 'error');
    return;
  }

  button.disabled = true;
  setBusy(true, 'Closing the loop...');
  try {
    const detail = await window.coachNotes.getClientDetail({ clientId });
    const currentSection = detail?.baseline?.structured?.[sectionKey];
    if (!Array.isArray(currentSection) || itemIndex < 0 || itemIndex >= currentSection.length) {
      throw new Error('The item changed since Mission Control was loaded. Refresh and try again.');
    }
    const nextSection = currentSection.map((item, index) => (
      index === itemIndex ? applyPlanningPatch(item, { planningStatus: 'completed' }) : item
    ));
    await window.coachNotes.updateClientSection({ clientId, sectionKey, value: nextSection });
    await loadClients();
    renderCoachHome();
    setViewMode('home');
    showToast('Loop closed. Item marked completed.');
  } catch (error) {
    renderCoachHome();
    showToast(`Mission Control update failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function deleteSelectedClient() {
  const client = state.selectedClientDetail?.client;
  if (!client?.id) {
    showToast('Select a client before deleting.', 'error');
    return;
  }

  const confirmed = window.confirm(`Delete ${client.name} from CoachNotes?\n\nThis removes the local profile, sources, dashboard history, and undo history from the app database. Exported vault files are left on disk.`);
  if (!confirmed) {
    return;
  }

  setBusy(true, 'Deleting client...');
  try {
    await window.coachNotes.deleteClient({ clientId: client.id });
    state.selectedClientId = null;
    state.selectedClientDetail = null;
    state.lastUpdateNotice = null;
    await loadClients();
    if (state.clients.length) {
      await openCoachHome({ recordHistory: false });
    } else {
      resetIntake({ keepMode: true });
      setViewMode('intake');
    }
    showToast(`${client.name} deleted.`);
  } catch (error) {
    showToast(`Delete failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function renderProfileOptionSettings(template = getCoachTemplate()) {
  const fields = [
    ...template.profileSelectFields.map((field) => ({ ...field, group: 'single' })),
    ...template.profileMultiSelectFields.map((field) => ({ ...field, group: 'multi' }))
  ];
  els.profileOptionsPanel.innerHTML = `
    <div class="profile-options-head">
      <strong>Profile Options</strong>
      <span>One option per line. These values populate profile dropdowns and guide AI profile labeling.</span>
    </div>
    <div class="profile-options-grid">
      ${fields.map((field) => `
        <label>
          ${escapeHtml(field.label)}
          <textarea
            rows="5"
            data-template-options-key="${escapeHtml(field.key)}"
            data-template-options-group="${escapeHtml(field.group)}"
          >${escapeHtml(field.options.join('\n'))}</textarea>
        </label>
      `).join('')}
    </div>
  `;
}

function setSettingsTemplateInputs(template = getCoachTemplate()) {
  const normalized = normalizeCoachTemplate(template);
  els.coachApproachInput.value = normalized.guidance.coachingApproach;
  els.messageStyleInput.value = normalized.guidance.messageStyle;
  els.curriculumNotesInput.value = normalized.guidance.curriculumNotes;
  renderProfileOptionSettings(normalized);
}

function collectCoachTemplateFromSettings() {
  const current = getCoachTemplate();
  const optionControls = [...els.profileOptionsPanel.querySelectorAll('[data-template-options-key]')];
  const optionsByKey = new Map(optionControls.map((control) => [
    control.dataset.templateOptionsKey,
    parseOptionLines(control.value)
  ]));
  return normalizeCoachTemplate({
    ...current,
    guidance: {
      coachingApproach: els.coachApproachInput.value,
      messageStyle: els.messageStyleInput.value,
      curriculumNotes: els.curriculumNotesInput.value
    },
    profileSelectFields: current.profileSelectFields.map((field) => ({
      ...field,
      options: optionsByKey.get(field.key) || field.options
    })),
    profileMultiSelectFields: current.profileMultiSelectFields.map((field) => ({
      ...field,
      options: optionsByKey.get(field.key) || field.options
    }))
  });
}

function openSettings() {
  els.vaultInput.value = state.settings?.vaultFolder || '';
  els.proxyInput.value = state.settings?.proxyBaseUrl || '';
  els.tokenInput.value = state.settings?.inviteToken || '';
  setSettingsTemplateInputs();
  els.settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();
  setBusy(true, 'Saving settings...');
  try {
    state.settings = await window.coachNotes.saveSettings({
      vaultFolder: els.vaultInput.value,
      proxyBaseUrl: els.proxyInput.value,
      inviteToken: els.tokenInput.value,
      coachTemplate: collectCoachTemplateFromSettings()
    });
    els.settingsDialog.close();
    updateStatusLine();
    if (state.selectedClientDetail) {
      renderClientDetail(state.selectedClientDetail);
    }
    renderIntakeProgramSettings(collectIntakeClientProfile());
    showToast('Settings saved.');
  } catch (error) {
    showToast(`Settings failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function init() {
  loadLocalPreferences();
  syncChoiceGroups();
  setBusy(true, 'Opening CoachNotes...');
  try {
    const appState = await window.coachNotes.getState();
    state.settings = appState.settings || {};
    state.clients = appState.clients || [];
    state.coachHome = appState.coachHome || null;
    renderIntakeProgramSettings();
    renderSources();
    renderNoteSources();
    renderNotePresetControls();
    renderTodoPresetControls();
    renderClients();
    renderCoachHome();
    updateStatusLine();
    if (state.clients.length) {
      setViewMode('home');
    } else {
      setViewMode('intake');
    }
  } catch (error) {
    showToast(`Startup failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }

  els.backBtn.addEventListener('click', goBack);
  els.onboardBtn.addEventListener('click', handleTopbarPrimaryAction);
  els.themeToggleBtn.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });
  els.settingsBtn.addEventListener('click', openSettings);
  els.coachHomeBtn.addEventListener('click', () => openCoachHome({ resetToAttention: true }));
  els.refreshCoachHomeBtn.addEventListener('click', () => openCoachHome({ refresh: true }));
  els.coachHomeContent.addEventListener('click', async (event) => {
    const jumpButton = event.target.closest('[data-home-jump]');
    if (jumpButton) {
      jumpToHomeSection(jumpButton.dataset.homeJump || '');
      return;
    }
    const tabButton = event.target.closest('[data-home-tab]');
    if (tabButton) {
      const nextTab = tabButton.dataset.homeTab || 'attention';
      if (nextTab !== state.coachHomeTab) {
        pushNavigationLocation();
      }
      state.coachHomeTab = nextTab;
      renderCoachHome();
      return;
    }
    const homeAction = event.target.closest('[data-home-action]');
    if (homeAction?.dataset?.homeAction === 'complete') {
      await completeHomePlanningItem(homeAction);
      return;
    }
    const laneToggle = event.target.closest('[data-home-lane]');
    if (laneToggle) {
      const lane = laneToggle.dataset.homeLane || '';
      if (state.expandedHomeLanes.has(lane)) {
        state.expandedHomeLanes.delete(lane);
      } else {
        state.expandedHomeLanes.add(lane);
      }
      renderCoachHome();
      return;
    }
    const clientButton = event.target.closest('[data-home-client-id]');
    if (clientButton) {
      const clientId = Number(clientButton.dataset.homeClientId);
      if (Number.isFinite(clientId)) {
        selectClient(clientId, { detailPage: clientButton.dataset.homeDetailPage || 'snapshot' });
      }
    }
  });
  els.clientSearchInput.addEventListener('input', () => {
    state.clientSearchQuery = sanitizeName(els.clientSearchInput.value);
    renderClients();
  });
  els.clientFilterToggle.addEventListener('click', () => {
    const nextExpanded = els.clientFilterToggle.getAttribute('aria-expanded') !== 'true';
    els.clientFilterToggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
    els.clientBioFilter.hidden = !nextExpanded;
    if (nextExpanded) {
      els.clientProfileTagFilter.focus();
    }
  });
  els.clientProfileTagFilter.addEventListener('input', () => {
    window.clearTimeout(clientProfileTagFilterTimer);
    clientProfileTagFilterTimer = window.setTimeout(() => {
      state.clientProfileTagFilter = sanitizeName(els.clientProfileTagFilter.value);
      renderClients();
    }, 180);
  });
  els.clientSortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.clientSortMode = button.dataset.clientSort === 'updated' ? 'updated' : 'name';
      try {
        localStorage.setItem(clientSortStorageKey, state.clientSortMode);
      } catch {
        // Sort preference is convenience state.
      }
      renderClients();
    });
  });
  els.askClientBtn.addEventListener('click', openAskDialog);
  els.addNoteBtn.addEventListener('click', openAddNoteDialog);
  els.deleteClientBtn.addEventListener('click', deleteSelectedClient);
  els.revealVaultBtn.addEventListener('click', async () => {
    await window.coachNotes.revealVault();
  });
  els.resetIntakeBtn.addEventListener('click', resetIntake);
  els.intakeProgramSettings.addEventListener('change', updateIntakeProgramWeek);
  els.intakeProgramSettings.addEventListener('input', updateIntakeProgramWeek);
  els.addSourceBtn.addEventListener('click', () => addPastedSource());
  els.clearSourcesBtn.addEventListener('click', () => {
    state.intakeSources = [];
    renderSources();
  });
  els.importFilesBtn.addEventListener('click', async () => {
    setBusy(true, 'Importing files...');
    try {
      const imported = await window.coachNotes.selectIntakeFiles();
      const errors = imported.filter((source) => source.error);
      const added = addSources(imported.filter((source) => !source.error));
      if (added) {
        showToast(`Imported ${added} source${added === 1 ? '' : 's'}.`);
      }
      if (errors.length) {
        showToast(`${errors.length} file${errors.length === 1 ? '' : 's'} could not be imported.`, 'error');
      }
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  });
  els.sourceList.addEventListener('click', (event) => {
    const button = event.target.closest('.source-remove');
    if (!button) {
      return;
    }
    state.intakeSources = state.intakeSources.filter((source) => source.localId !== button.dataset.id);
    renderSources();
  });
  els.detailContent.addEventListener('click', (event) => {
    if (event.target.closest('.dismiss-update-notice')) {
      state.lastUpdateNotice = null;
      renderClientDetail(state.selectedClientDetail);
      return;
    }
    const pageButton = event.target.closest('.detail-page-tab');
    if (pageButton) {
      const nextPage = pageButton.dataset.detailPage || 'snapshot';
      if (nextPage !== getActiveDetailPage()) {
        pushNavigationLocation();
      }
      state.detailPage = nextPage;
      renderClientDetail(state.selectedClientDetail);
      return;
    }
    const hiddenToggle = event.target.closest('.toggle-hidden-planning');
    if (hiddenToggle) {
      setPlanningSectionExpanded(hiddenToggle.dataset.sectionKey, hiddenToggle.dataset.expanded === 'true');
      renderClientDetail(state.selectedClientDetail);
      return;
    }
    const citationButton = event.target.closest('.citation-chip[data-source-id]');
    if (citationButton && citationButton.dataset.sourceId) {
      openCitedSource(citationButton.dataset.sourceId);
      return;
    }
    const addPlanningButton = event.target.closest('.add-planning-item');
    if (addPlanningButton) {
      openAddTodoDialog(addPlanningButton.dataset.sectionKey);
      return;
    }
    const savePlanningButton = event.target.closest('.save-planning-item');
    if (savePlanningButton) {
      savePlanningItem(savePlanningButton);
      return;
    }
    const missingInfoButton = event.target.closest('.missing-info-action');
    if (missingInfoButton) {
      saveMissingInfoAction(missingInfoButton);
      return;
    }
    const editButton = event.target.closest('.edit-section');
    if (editButton) {
      openEditSection(editButton.dataset.sectionKey);
      return;
    }
    const undoButton = event.target.closest('.undo-section');
    if (undoButton && !undoButton.disabled) {
      undoSection(undoButton.dataset.sectionKey);
    }
  });
  els.detailContent.addEventListener('input', (event) => {
    const searchControl = event.target.closest('[data-session-notes-search]');
    if (searchControl) {
      state.sessionNotesQuery = searchControl.value;
      applySessionNoteFilters();
    }
  });
  els.detailContent.addEventListener('change', (event) => {
    const sessionNotesType = event.target.closest('[data-session-notes-type]');
    if (sessionNotesType) {
      state.sessionNotesType = sessionNotesType.value || 'all';
      applySessionNoteFilters();
      return;
    }
    const hiddenStatusControl = event.target.closest('[data-planning-hidden-status]');
    if (hiddenStatusControl) {
      const hiddenStatuses = new Set(getPlanningHiddenStatuses());
      const statusValue = hiddenStatusControl.dataset.planningHiddenStatus;
      if (hiddenStatusControl.checked) {
        hiddenStatuses.add(statusValue);
      } else {
        hiddenStatuses.delete(statusValue);
      }
      state.planningHiddenStatuses = hiddenStatuses;
      state.expandedPlanningSections.clear();
      savePlanningHiddenStatuses();
      renderClientDetail(state.selectedClientDetail);
      return;
    }
    const profileControl = event.target.closest('[data-profile-field]');
    if (profileControl) {
      saveProfileField(profileControl);
      return;
    }
  });
  els.noteSourceList.addEventListener('click', (event) => {
    const button = event.target.closest('.note-source-remove');
    if (!button) {
      return;
    }
    state.noteSources = state.noteSources.filter((source) => source.localId !== button.dataset.id);
    renderNoteSources();
  });
  els.runIntakeBtn.addEventListener('click', runIntake);
  els.acceptBaselineBtn.addEventListener('click', acceptBaseline);
  els.baselineFields.addEventListener('input', syncJsonFromFields);
  els.baselineJsonInput.addEventListener('change', () => {
    try {
      state.baselineDraft = JSON.parse(els.baselineJsonInput.value || '{}');
      renderBaselineReview({
        ...state.activeBaseline,
        structured: state.baselineDraft
      });
    } catch (error) {
      showToast(`Structured JSON is invalid: ${error.message}`, 'error');
    }
  });
  els.settingsForm.addEventListener('submit', saveSettings);
  els.resetCoachTemplateBtn.addEventListener('click', () => setSettingsTemplateInputs(cloneDefaultCoachTemplate()));
  els.cancelSettingsBtn.addEventListener('click', () => els.settingsDialog.close());
  els.editSectionForm.addEventListener('submit', saveEditedSection);
  els.cancelEditSectionBtn.addEventListener('click', () => els.editSectionDialog.close());
  els.askDialog.addEventListener('cancel', (event) => {
    if (state.askLoading) {
      event.preventDefault();
    }
  });
  els.askForm.addEventListener('submit', submitAsk);
  document.addEventListener('click', (event) => {
    const choiceButton = event.target.closest('[data-choice-value]');
    const group = choiceButton?.closest('[data-choice-group]');
    const control = group ? document.getElementById(group.dataset.choiceTarget || '') : null;
    if (!choiceButton || !control || choiceButton.disabled) {
      return;
    }
    control.value = choiceButton.dataset.choiceValue || '';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    syncChoiceGroups();
  });
  document.addEventListener('pointerover', (event) => {
    const trigger = getCitationTrigger(event.target);
    if (!trigger || trigger.contains(event.relatedTarget)) {
      return;
    }
    showCitationTooltip(trigger);
  });
  document.addEventListener('pointerout', (event) => {
    const trigger = getCitationTrigger(event.target);
    if (!trigger || trigger.contains(event.relatedTarget)) {
      return;
    }
    hideCitationTooltip();
  });
  document.addEventListener('focusin', (event) => {
    const trigger = getCitationTrigger(event.target);
    if (trigger) {
      showCitationTooltip(trigger);
    }
  });
  document.addEventListener('focusout', (event) => {
    const trigger = getCitationTrigger(event.target);
    if (trigger && !trigger.contains(event.relatedTarget)) {
      hideCitationTooltip();
    }
  });
  window.addEventListener('scroll', hideCitationTooltip, true);
  window.addEventListener('resize', hideCitationTooltip);
  els.askOutputTypeInput.addEventListener('change', applyAskOutputPreset);
  els.askResultOutput.addEventListener('click', (event) => {
    const citationButton = event.target.closest('.ask-citation[data-source-id]');
    if (citationButton && citationButton.dataset.sourceId) {
      openAskCitationSource(citationButton.dataset.sourceId);
    }
  });
  els.cancelAskBtn.addEventListener('click', () => els.askDialog.close());
  els.copyAskResultBtn.addEventListener('click', copyAskResult);
  els.saveAskResultBtn.addEventListener('click', saveAskResultAsNote);
  els.addNoteForm.addEventListener('submit', submitAddedNote);
  els.cancelAddNoteBtn.addEventListener('click', () => els.addNoteDialog.close());
  els.saveNoteTitlePresetBtn.addEventListener('click', saveNoteTitlePreset);
  els.saveNoteAnnotationPresetBtn.addEventListener('click', saveNoteAnnotationPreset);
  els.noteTitlePresetList.addEventListener('click', (event) => {
    const button = event.target.closest('.preset-chip');
    const index = Number(button?.dataset?.presetIndex);
    if (Number.isInteger(index) && state.noteTitlePresets[index]) {
      els.noteTitleInput.value = state.noteTitlePresets[index];
      els.noteTitleInput.focus();
    }
  });
  els.noteAnnotationPresetList.addEventListener('click', (event) => {
    const button = event.target.closest('.preset-chip');
    const index = Number(button?.dataset?.presetIndex);
    if (Number.isInteger(index) && state.noteAnnotationPresets[index]) {
      els.noteAnnotationInput.value = state.noteAnnotationPresets[index];
      resizeNoteAnnotation();
      els.noteAnnotationInput.focus();
    }
  });
  els.noteAnnotationInput.addEventListener('input', resizeNoteAnnotation);
  els.addTodoForm.addEventListener('submit', submitAddTodo);
  els.cancelAddTodoBtn.addEventListener('click', () => els.addTodoDialog.close());
  els.saveTodoTitlePresetBtn.addEventListener('click', saveTodoTitlePreset);
  els.todoTitlePresetList.addEventListener('click', (event) => {
    const button = event.target.closest('.preset-chip');
    const index = Number(button?.dataset?.presetIndex);
    if (Number.isInteger(index) && state.todoTitlePresets[index]) {
      els.todoTitleInput.value = state.todoTitlePresets[index];
      els.todoTitleInput.focus();
    }
  });
  els.clearNoteSourcesBtn.addEventListener('click', () => {
    state.noteSources = [];
    renderNoteSources();
  });
  els.importNoteFilesBtn.addEventListener('click', async () => {
    setBusy(true, 'Importing note files...');
    try {
      const imported = await window.coachNotes.selectIntakeFiles();
      const errors = imported.filter((source) => source.error);
      const added = addNoteSources(imported.filter((source) => !source.error));
      if (added) {
        showToast(`Imported ${added} note source${added === 1 ? '' : 's'}.`);
      }
      if (errors.length) {
        showToast(`${errors.length} file${errors.length === 1 ? '' : 's'} could not be imported.`, 'error');
      }
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  });
  els.chooseVaultBtn.addEventListener('click', async () => {
    const selected = await window.coachNotes.selectVaultFolder();
    if (selected) {
      els.vaultInput.value = selected;
    }
  });
}

init();
