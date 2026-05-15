const state = {
  settings: null,
  clients: [],
  selectedClientId: null,
  selectedClientDetail: null,
  intakeSources: [],
  noteSources: [],
  viewMode: 'intake',
  editSectionKey: '',
  lastUpdateNotice: null,
  activeBaseline: null,
  baselineDraft: null,
  busyCount: 0
};

const baselineSections = [
  { key: 'overview', label: 'Snapshot', type: 'text', rows: 4 },
  { key: 'programContext', label: 'Program Context', type: 'object', rows: 4 },
  { key: 'currentGoals', label: 'Current Goals', type: 'list', rows: 4 },
  { key: 'currentPriorities', label: 'Current Priorities', type: 'list', rows: 4 },
  { key: 'activeConstraints', label: 'Active Constraints', type: 'list', rows: 5 },
  { key: 'injuriesLimitations', label: 'Injuries / Limitations', type: 'list', rows: 5 },
  { key: 'medicalScopeFlags', label: 'Medical / Scope Flags', type: 'list', rows: 4 },
  { key: 'habitsBehaviors', label: 'Habits / Behaviors', type: 'list', rows: 4 },
  { key: 'motivationValues', label: 'Motivation / Values', type: 'list', rows: 4 },
  { key: 'preferences', label: 'Preferences', type: 'list', rows: 4 },
  { key: 'communicationNotes', label: 'Communication Notes', type: 'list', rows: 4 },
  { key: 'wins', label: 'Wins', type: 'list', rows: 4 },
  { key: 'challenges', label: 'Challenges', type: 'list', rows: 4 },
  { key: 'openLoops', label: 'Open Loops', type: 'list', rows: 4 },
  { key: 'suggestedTags', label: 'Suggested Tags', type: 'tags', rows: 3 },
  { key: 'timeline', label: 'Timeline', type: 'list', rows: 6 },
  { key: 'missingInfo', label: 'Missing Info', type: 'list', rows: 4 },
  { key: 'confidenceNotes', label: 'Confidence Notes', type: 'list', rows: 4 }
];

const els = {
  statusLine: document.getElementById('statusLine'),
  onboardBtn: document.getElementById('onboardBtn'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  clientList: document.getElementById('clientList'),
  revealVaultBtn: document.getElementById('revealVaultBtn'),
  intakePanel: document.getElementById('intakePanel'),
  resetIntakeBtn: document.getElementById('resetIntakeBtn'),
  runIntakeBtn: document.getElementById('runIntakeBtn'),
  clientNameInput: document.getElementById('clientNameInput'),
  programInput: document.getElementById('programInput'),
  coachNoteInput: document.getElementById('coachNoteInput'),
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
  addNoteBtn: document.getElementById('addNoteBtn'),
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
  importNoteFilesBtn: document.getElementById('importNoteFilesBtn'),
  clearNoteSourcesBtn: document.getElementById('clearNoteSourcesBtn'),
  noteSourceList: document.getElementById('noteSourceList'),
  cancelAddNoteBtn: document.getElementById('cancelAddNoteBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  vaultInput: document.getElementById('vaultInput'),
  chooseVaultBtn: document.getElementById('chooseVaultBtn'),
  proxyInput: document.getElementById('proxyInput'),
  tokenInput: document.getElementById('tokenInput'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  toast: document.getElementById('toast'),
  busyOverlay: document.getElementById('busyOverlay'),
  busyText: document.getElementById('busyText')
};

let toastTimer = null;

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

function getSectionConfig(key) {
  return baselineSections.find((section) => section.key === key) || { key, label: key, type: 'list', rows: 6 };
}

function sectionLabel(key) {
  return getSectionConfig(key).label || key;
}

function valuesEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
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
  }, 3200);
}

function setBusy(on, message = 'Working...') {
  state.busyCount = Math.max(0, state.busyCount + (on ? 1 : -1));
  if (on) {
    els.busyText.textContent = message;
  }
  els.busyOverlay.hidden = state.busyCount === 0;
}

function updateStatusLine() {
  const clientCount = state.clients.length;
  const vault = state.settings?.vaultFolder || 'local vault';
  els.statusLine.textContent = `${clientCount} accepted client${clientCount === 1 ? '' : 's'} • ${vault}`;
}

function setViewMode(mode) {
  state.viewMode = mode;
  const showIntake = mode === 'intake' || !state.clients.length;
  els.intakePanel.hidden = !showIntake;
  if (!showIntake) {
    els.reviewPanel.hidden = true;
  }
  els.clientDetailPanel.hidden = mode !== 'detail' || !state.selectedClientDetail;
  document.body.dataset.viewMode = state.viewMode;
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
    lookup.set(sourceId, {
      ...source,
      sourceId,
      displayNumber: index + 1,
      excerpt: truncateText(source.rawText || source.annotation || '', 720)
    });
  });
  return lookup;
}

function renderCitationChip(sourceId, sourceLookup) {
  const source = sourceLookup.get(sourceId);
  const label = source ? source.displayNumber : sourceId.replace('intake_source_', '#');
  const title = source?.title || sourceId;
  const meta = source ? [source.sourceType, source.sourceDate].filter(Boolean).join(' • ') : 'Source not found in this baseline';
  const excerpt = source?.excerpt || 'This citation points to a source id that is not available locally.';
  return `
    <span class="citation-chip" tabindex="0" role="button" aria-label="Show source ${escapeHtml(String(label))}">
      ${escapeHtml(String(label))}
      <span class="citation-popover" role="tooltip">
        <strong>${escapeHtml(title)}</strong>
        <em>${escapeHtml(meta)}</em>
        <span>${escapeHtml(excerpt)}</span>
      </span>
    </span>
  `;
}

function renderEvidenceText(value, sourceLookup, evidenceIds = []) {
  const raw = String(value || '');
  if (!raw && !evidenceIds.length) {
    return '';
  }

  const citedIds = new Set();
  const pattern = /\[((?:\s*intake_source_\d+\s*,?)+)\]/g;
  let cursor = 0;
  let html = '';
  let match = pattern.exec(raw);
  while (match) {
    html += escapeHtml(raw.slice(cursor, match.index));
    const ids = match[1].match(/intake_source_\d+/g) || [];
    if (ids.length) {
      html += `<span class="citation-cluster">${ids.map((id) => {
        citedIds.add(id);
        return renderCitationChip(id, sourceLookup);
      }).join('')}</span>`;
    } else {
      html += escapeHtml(match[0]);
    }
    cursor = match.index + match[0].length;
    match = pattern.exec(raw);
  }
  html += escapeHtml(raw.slice(cursor));

  const appended = evidenceIds.filter((id) => id && !citedIds.has(id));
  if (appended.length) {
    html += `<span class="citation-cluster inline-tail">${appended.map((id) => renderCitationChip(id, sourceLookup)).join('')}</span>`;
  }
  return html;
}

function normalizeDetailItem(item) {
  if (typeof item === 'string') {
    return { title: '', detail: item, evidenceIds: [] };
  }
  if (!item || typeof item !== 'object') {
    return { title: '', detail: '', evidenceIds: [] };
  }
  const title = item.title || item.label || item.date || '';
  const detail = item.details || item.currentStatus || item.status || item.urgency || item.summary || '';
  const fallback = Object.entries(item)
    .filter(([key]) => !['title', 'label', 'date', 'details', 'currentStatus', 'status', 'urgency', 'summary', 'evidenceIds'].includes(key))
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(' · ');
  return {
    title,
    detail: detail || fallback,
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
    els.noteDateInput.value = '';
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
    .map((source) => normalizeSource(source))
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
  renderSources();
  if (!options.keepMode) {
    state.selectedClientId = null;
    state.selectedClientDetail = null;
    renderClients();
    setViewMode('intake');
  }
}

function startOnboarding() {
  resetIntake();
  els.clientNameInput.focus();
}

function resetNoteDialog() {
  state.noteSources = [];
  els.noteSourceTypeInput.value = 'notes';
  els.noteTitleInput.value = '';
  els.noteDateInput.value = '';
  els.noteAnnotationInput.value = '';
  els.noteTextInput.value = '';
  renderNoteSources();
}

function openAddNoteDialog() {
  if (!state.selectedClientDetail?.client?.id) {
    showToast('Select a client before adding a note.', 'error');
    return;
  }
  resetNoteDialog();
  els.addNoteTitle.textContent = `Add Note for ${state.selectedClientDetail.client.name}`;
  els.addNoteDialog.showModal();
  els.noteTextInput.focus();
}

function loadSampleData() {
  resetIntake();
  els.clientNameInput.value = 'Jordan Ellis';
  els.programInput.value = 'Strength and nutrition coaching, week 4, travel-heavy work schedule, shoulder-friendly training modifications';
  els.coachNoteInput.value = 'Watch shoulder symptoms, inconsistent meals during travel, and desire for a simple plan. Use coach-first language and ask for clarification where the data is thin.';
  addSources([
    {
      title: 'Everfit weekly check-ins',
      sourceType: 'everfit',
      sourceDate: '2026-05-06',
      annotation: 'Recent check-ins copied from Everfit.',
      rawText: `Week 2 check-in: Jordan completed 2 of 4 planned strength sessions and got 7,200 average daily steps. Energy was 7/10 on days with lunch, 4/10 on travel days. He wrote that hotel workouts feel "annoying but doable" if they are under 25 minutes. Shoulder discomfort was 2/10 during pressing and 0/10 afterward.

Week 3 check-in: Completed 3 strength sessions, including one band-only hotel workout. Jordan skipped overhead presses after feeling a pinch in the front of the right shoulder. He substituted incline push-ups and rows without pain. Biggest win: "I packed protein snacks and did not get stuck eating airport pretzels for dinner." Biggest challenge: late client dinners and two nights of poor sleep.

Week 4 check-in: Jordan reports shoulder is calm with rows, carries, lower-body work, and incline push-ups, but overhead movement still feels uncertain. He wants a plan that keeps him progressing without making the shoulder a whole project. He asked whether he should cut carbs on travel days because he is less active.`
    },
    {
      title: 'Client message thread',
      sourceType: 'message',
      sourceDate: '2026-05-10',
      annotation: 'Messages Liz would normally paste into ChatGPT.',
      rawText: `Jordan: Next week is Denver Monday to Thursday and I probably have dinner events every night. I can use the hotel gym in the morning if it is simple. I just do not want to make my shoulder worse before the company golf thing.

Coach: We can build a travel version around what you can repeat without turning the trip into a fitness project.

Jordan: That sounds perfect. I care more about staying consistent than crushing it. Also if there is a low-effort way to handle dinner without being weird at work events, that would help.`
    },
    {
      title: 'EchoScribe call transcript excerpt',
      sourceType: 'transcript',
      sourceDate: '2026-04-29',
      annotation: 'Short excerpt from a coaching call.',
      rawText: `Coach: When you picture this working in real life, what has changed?

Jordan: I am not starting over every Monday. I can travel, go to dinners, and still feel like I am the kind of person who trains.

Coach: So consistency and identity matter more than a perfect week.

Jordan: Exactly. I need the minimum version written down. If the plan is vague, I negotiate with myself and skip it.

Coach: What has been getting in the way?

Jordan: Travel, work dinners, and shoulder uncertainty. If something hurts I freeze up and do nothing because I do not know what is safe.`
    },
    {
      title: 'Coach planning note',
      sourceType: 'manual',
      sourceDate: '2026-05-01',
      annotation: 'Internal coach note before the next monthly review.',
      rawText: `Jordan responds well to short explanations and dislikes being micromanaged. He likes "default meals" and simple decision rules. Current focus: maintain training during travel, protect shoulder while symptoms settle, and avoid skipping meals until late dinners. Consider asking whether shoulder has been evaluated if symptoms persist or increase. Avoid turning travel dinners into strict food rules; he is worried about looking difficult in work settings.`
    }
  ]);
  showToast('Test client loaded. Run intake when you want to try it.');
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

function renderClients() {
  els.clientList.innerHTML = '';
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

  for (const client of state.clients) {
    const button = document.createElement('button');
    button.className = 'client-button';
    if (state.selectedClientId === client.id) {
      button.classList.add('active');
    }
    const tags = (client.tags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
    button.innerHTML = `
      <strong>${escapeHtml(client.name)}</strong>
      <em>${client.sourceCount} sources • ${client.activeConstraintCount} constraints • ${client.openLoopCount} open loops</em>
      ${tags ? `<div class="tag-strip">${tags}</div>` : ''}
    `;
    button.addEventListener('click', () => selectClient(client.id));
    els.clientList.appendChild(button);
  }
  updateStatusLine();
}

function renderDetailMetric(label, value, tone = '') {
  return `
    <div class="metric ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderSectionActions(sectionKey) {
  const undoCount = Number(state.selectedClientDetail?.undoCounts?.[sectionKey] || 0);
  return `
    <div class="section-actions">
      <button class="section-link edit-section" type="button" data-section-key="${escapeHtml(sectionKey)}">Edit</button>
      <button class="section-link undo-section" type="button" data-section-key="${escapeHtml(sectionKey)}" ${undoCount ? '' : 'disabled'}>
        Undo${undoCount ? ` ${undoCount}` : ''}
      </button>
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

function renderDetailList(title, value, sourceLookup, options = {}) {
  const values = Array.isArray(value) ? value : [];
  if (!values.length && !options.sectionKey) {
    return '';
  }
  const rows = values.length ? values.map((item) => {
    const normalized = normalizeDetailItem(item);
    const titleHtml = normalized.title ? `<strong>${renderEvidenceText(normalized.title, sourceLookup, normalized.evidenceIds)}</strong>` : '';
    const detailHtml = normalized.detail ? `<span>${renderEvidenceText(normalized.detail, sourceLookup, normalized.evidenceIds)}</span>` : '';
    return `<li>${titleHtml}${detailHtml}</li>`;
  }).join('') : '<li><span>No entries yet.</span></li>';
  return `
    <section class="${options.wide ? 'detail-section wide' : 'detail-section'} ${options.tone || ''} ${sectionWasUpdated(options.sectionKey) ? 'is-recently-updated' : ''}">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        ${renderSectionActions(options.sectionKey)}
      </div>
      <ul>${rows}</ul>
    </section>
  `;
}

function renderObjectSection(title, value, sourceLookup) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const entries = Object.entries(value);
  const rows = entries.length ? entries.map(([key, entry]) => `
    <div class="object-row">
      <span>${escapeHtml(key)}</span>
      <strong>${renderEvidenceText(entry, sourceLookup)}</strong>
    </div>
  `).join('') : '<p class="empty-section-copy">No entries yet.</p>';
  return `
    <section class="detail-section compact-list ${sectionWasUpdated('programContext') ? 'is-recently-updated' : ''}">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        ${renderSectionActions('programContext')}
      </div>
      ${rows}
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
          const normalized = normalizeDetailItem(item);
          return `
            <div class="timeline-item">
              <time>${renderEvidenceText(normalized.title || 'Recent', sourceLookup, normalized.evidenceIds)}</time>
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
    <details class="raw-source">
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

function renderClientDetail(detail) {
  state.selectedClientDetail = detail;
  const structured = detail?.baseline?.structured || {};
  const sources = detail?.sources || [];
  const sourceLookup = buildSourceLookup(sources);
  els.detailClientName.textContent = detail?.client?.name || 'Client';
  els.detailMeta.textContent = `${sources.length} raw sources • accepted ${formatDate(detail?.baseline?.acceptedAt) || 'recently'}`;

  const tags = Array.isArray(structured.suggestedTags) && structured.suggestedTags.length
    ? `<div class="detail-tags">${structured.suggestedTags.map((tag) => `<span>${renderEvidenceText(tag, sourceLookup)}</span>`).join('')}</div>`
    : '';
  const attentionCount = (Array.isArray(structured.activeConstraints) ? structured.activeConstraints.length : 0)
    + (Array.isArray(structured.medicalScopeFlags) ? structured.medicalScopeFlags.length : 0);
  const sourceDrawers = sources.map((source, index) => renderSourceDrawer({
    ...source,
    displayNumber: index + 1
  })).join('');

  els.detailContent.innerHTML = `
    ${renderUpdateNotice(detail)}

    <section class="detail-overview dashboard-hero ${sectionWasUpdated('overview') || sectionWasUpdated('suggestedTags') ? 'is-recently-updated' : ''}">
      <div>
        <div class="section-title-row hero-title-row">
          <p class="section-kicker">Current Baseline</p>
          ${renderSectionActions('overview')}
        </div>
        <p class="overview-copy">${renderEvidenceText(structured.overview || 'No overview captured yet.', sourceLookup)}</p>
        <div class="tag-block">
          ${tags}
          ${renderSectionActions('suggestedTags')}
        </div>
      </div>
      <div class="metric-stack">
        ${renderDetailMetric('Sources', sources.length)}
        ${renderDetailMetric('Open Loops', Array.isArray(structured.openLoops) ? structured.openLoops.length : 0, 'warm')}
        ${renderDetailMetric('Attention Areas', attentionCount, attentionCount ? 'alert' : '')}
      </div>
    </section>

    <div class="dashboard-band attention-band">
      <div class="band-head">
        <span>Needs Attention</span>
        <strong>Constraints, scope flags, and unanswered items</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Active Constraints', structured.activeConstraints, sourceLookup, { tone: 'priority', sectionKey: 'activeConstraints' })}
        ${renderDetailList('Injuries / Limitations', structured.injuriesLimitations, sourceLookup, { sectionKey: 'injuriesLimitations' })}
        ${renderDetailList('Medical / Scope Flags', structured.medicalScopeFlags, sourceLookup, { tone: 'scope', sectionKey: 'medicalScopeFlags' })}
        ${renderDetailList('Open Loops', structured.openLoops, sourceLookup, { tone: 'priority', sectionKey: 'openLoops' })}
      </div>
    </div>

    <div class="dashboard-band">
      <div class="band-head">
        <span>Coaching Profile</span>
        <strong>What should shape messages and plans</strong>
      </div>
      <div class="detail-grid">
        ${renderObjectSection('Program Context', structured.programContext || {}, sourceLookup)}
        ${renderDetailList('Current Goals', structured.currentGoals, sourceLookup, { sectionKey: 'currentGoals' })}
        ${renderDetailList('Current Priorities', structured.currentPriorities, sourceLookup, { sectionKey: 'currentPriorities' })}
        ${renderDetailList('Motivation / Values', structured.motivationValues, sourceLookup, { sectionKey: 'motivationValues' })}
        ${renderDetailList('Preferences', structured.preferences, sourceLookup, { sectionKey: 'preferences' })}
        ${renderDetailList('Communication Notes', structured.communicationNotes, sourceLookup, { sectionKey: 'communicationNotes' })}
      </div>
    </div>

    <div class="dashboard-band">
      <div class="band-head">
        <span>Progress + Patterns</span>
        <strong>Wins, friction, habits, and confidence notes</strong>
      </div>
      <div class="detail-grid">
        ${renderDetailList('Wins', structured.wins, sourceLookup, { sectionKey: 'wins' })}
        ${renderDetailList('Challenges', structured.challenges, sourceLookup, { sectionKey: 'challenges' })}
        ${renderDetailList('Habits / Behaviors', structured.habitsBehaviors, sourceLookup, { sectionKey: 'habitsBehaviors' })}
        ${renderDetailList('Missing Info', structured.missingInfo, sourceLookup, { sectionKey: 'missingInfo' })}
        ${renderDetailList('Confidence Notes', structured.confidenceNotes, sourceLookup, { wide: true, sectionKey: 'confidenceNotes' })}
      </div>
    </div>

    ${renderTimeline(structured.timeline, sourceLookup)}

    <section class="source-summary">
      <div class="source-summary-head">
        <h3>Raw Sources</h3>
        <p>Citation chips above refer to these local source excerpts.</p>
      </div>
      ${sourceDrawers || '<p>No sources found.</p>'}
    </section>
  `;
}

function openEditSection(sectionKey) {
  const config = getSectionConfig(sectionKey);
  const structured = state.selectedClientDetail?.baseline?.structured || {};
  state.editSectionKey = sectionKey;
  els.editSectionTitle.textContent = `Edit ${config.label}`;
  els.editSectionHelp.textContent = config.type === 'text'
    ? 'Edit this dashboard text directly. This coach edit becomes part of the client profile and can be undone.'
    : config.type === 'object'
    ? 'Use one key: value pair per line. This coach edit becomes part of the client profile and can be undone.'
    : 'Use one item per line for lists and tags. Keep citation markers if you want existing evidence popovers to stay attached.';
  els.editSectionInput.rows = Math.max(config.rows || 6, 7);
  els.editSectionInput.value = formatValue(structured[sectionKey], config.type);
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

async function submitAddedNote(event) {
  event.preventDefault();
  addPastedNoteSource({ silent: true });
  if (!state.noteSources.length) {
    showToast('Add a note source before updating.', 'error');
    return;
  }

  const sources = [...state.noteSources];
  let reopenDialogOnError = false;
  els.addNoteDialog.close();
  setBusy(true, 'Updating client dashboard...');
  try {
    const result = await window.coachNotes.updateClientFromNote({
      clientId: state.selectedClientDetail.client.id,
      sources
    });
    resetNoteDialog();
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
    const changeCount = changedSections.length || (Array.isArray(result.changes) ? result.changes.length : 0);
    showToast(changeCount ? `Dashboard updated: ${changeCount} section${changeCount === 1 ? '' : 's'} changed.` : 'Dashboard updated.');
  } catch (error) {
    reopenDialogOnError = true;
    showToast(`Update failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
    if (reopenDialogOnError && !els.addNoteDialog.open) {
      renderNoteSources();
      els.addNoteDialog.showModal();
    }
  }
}

function formatDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString();
}

async function selectClient(clientId) {
  setBusy(true, 'Loading client...');
  try {
    const detail = await window.coachNotes.getClientDetail({ clientId });
    state.selectedClientId = clientId;
    renderClients();
    renderClientDetail(detail);
    setViewMode('detail');
  } catch (error) {
    showToast(`Load client failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function loadClients() {
  state.clients = await window.coachNotes.getClients();
  if (state.selectedClientId && !state.clients.some((client) => client.id === state.selectedClientId)) {
    state.selectedClientId = null;
    els.clientDetailPanel.hidden = true;
  }
  renderClients();
}

function openSettings() {
  els.vaultInput.value = state.settings?.vaultFolder || '';
  els.proxyInput.value = state.settings?.proxyBaseUrl || '';
  els.tokenInput.value = state.settings?.inviteToken || '';
  els.settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();
  setBusy(true, 'Saving settings...');
  try {
    state.settings = await window.coachNotes.saveSettings({
      vaultFolder: els.vaultInput.value,
      proxyBaseUrl: els.proxyInput.value,
      inviteToken: els.tokenInput.value
    });
    els.settingsDialog.close();
    updateStatusLine();
    showToast('Settings saved.');
  } catch (error) {
    showToast(`Settings failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function init() {
  setBusy(true, 'Opening CoachNotes...');
  try {
    const appState = await window.coachNotes.getState();
    state.settings = appState.settings || {};
    state.clients = appState.clients || [];
    renderSources();
    renderNoteSources();
    renderClients();
    updateStatusLine();
    if (state.clients.length) {
      await selectClient(state.clients[0].id);
    } else {
      setViewMode('intake');
    }
  } catch (error) {
    showToast(`Startup failed: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }

  els.onboardBtn.addEventListener('click', startOnboarding);
  els.loadSampleBtn.addEventListener('click', loadSampleData);
  els.settingsBtn.addEventListener('click', openSettings);
  els.addNoteBtn.addEventListener('click', openAddNoteDialog);
  els.revealVaultBtn.addEventListener('click', async () => {
    await window.coachNotes.revealVault();
  });
  els.resetIntakeBtn.addEventListener('click', resetIntake);
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
  els.cancelSettingsBtn.addEventListener('click', () => els.settingsDialog.close());
  els.editSectionForm.addEventListener('submit', saveEditedSection);
  els.cancelEditSectionBtn.addEventListener('click', () => els.editSectionDialog.close());
  els.addNoteForm.addEventListener('submit', submitAddedNote);
  els.cancelAddNoteBtn.addEventListener('click', () => els.addNoteDialog.close());
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
