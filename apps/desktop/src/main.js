const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

const KEYCHAIN_SERVICE = 'coachnotes-invite-token';
const KEYCHAIN_ACCOUNT = 'coachnotes';
const DEFAULT_PROXY_URL = app.isPackaged ? 'https://coach-notes-five.vercel.app' : 'http://localhost:3011';
const DEFAULT_LLM_MODEL = 'gpt-5.4-mini';
const CLIENT_IMPORTS_DIRNAME = 'Raw Imports';
const MAX_WORKFLOW_CHARS = 220000;
const SUPPORTED_IMPORT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.pdf', '.csv', '.json']);
const APP_NAME = app.isPackaged ? 'CoachNotes' : 'CoachNotes Dev';
const ASK_MAX_SOURCES = 12;
const ASK_MAX_TOTAL_CHARS = 84000;
const COACH_TEMPLATE_SETTING_KEY = 'coachTemplate';
const ASK_STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'based',
  'before',
  'client',
  'could',
  'draft',
  'from',
  'have',
  'into',
  'last',
  'message',
  'note',
  'notes',
  'please',
  'recent',
  'should',
  'that',
  'their',
  'there',
  'these',
  'thing',
  'this',
  'three',
  'using',
  'want',
  'week',
  'weeks',
  'what',
  'when',
  'with',
  'would',
  'write'
]);
const BASELINE_SECTION_KEYS = new Set([
  'clientProfile',
  'overview',
  'coachTasks',
  'flags',
  'goalsValues',
  'clientValues',
  'coachingPlanApproach',
  'programChanges',
  'progressTracking',
  'engagementNotes',
  'nutritionThreads',
  'mindsetThreads',
  'exerciseThreads',
  'resourcesShared',
  'suggestedTags',
  'timeline',
  'missingInfo',
  'confidenceNotes'
]);
const BASELINE_ARRAY_SECTION_KEYS = new Set([
  'coachTasks',
  'flags',
  'goalsValues',
  'clientValues',
  'coachingPlanApproach',
  'programChanges',
  'progressTracking',
  'engagementNotes',
  'nutritionThreads',
  'mindsetThreads',
  'exerciseThreads',
  'resourcesShared',
  'suggestedTags',
  'timeline',
  'missingInfo',
  'confidenceNotes'
]);
const PLANNING_SECTION_KEYS = new Set(['coachTasks', 'goalsValues']);
const PLANNING_METADATA_KEYS = ['priority', 'planningStatus'];
const CLIENT_PROFILE_METADATA_KEYS = [
  'curriculumType',
  'programType',
  'cohort',
  'programFormat',
  'primaryTrainingGoal',
  'contraindications',
  'curriculumStartDate',
  'programStartDate',
  'programWeek'
];
const DEFAULT_COACH_TEMPLATE = {
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

app.setName(APP_NAME);
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));
}

let db;
let mainWindow;
let ipcRegistered = false;
let pdfJsModulePromise = null;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function extractFilenameDate(filePath) {
  const match = path.basename(String(filePath || '')).match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function normalizeTextContent(value) {
  return String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeMultilineText(value, maxChars = 4000) {
  return normalizeTextContent(value).slice(0, maxChars).trim();
}

function normalizeArray(values, maxItems = 80) {
  const source = Array.isArray(values) ? values : String(values || '').split('\n');
  const seen = new Set();
  const rows = [];
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
    rows.push(value);
    if (rows.length >= maxItems) {
      break;
    }
  }
  return rows;
}

function cloneDefaultCoachTemplate() {
  return JSON.parse(JSON.stringify(DEFAULT_COACH_TEMPLATE));
}

function normalizeTemplateFields(values, defaults) {
  const byKey = new Map((Array.isArray(values) ? values : [])
    .filter((field) => field && typeof field === 'object' && !Array.isArray(field))
    .map((field) => [String(field.key || '').trim(), field]));

  return defaults.map((defaultField) => {
    const saved = byKey.get(defaultField.key) || {};
    const options = normalizeArray(saved.options || defaultField.options, 80);
    return {
      ...defaultField,
      options: options.length ? options : [...defaultField.options]
    };
  });
}

function normalizeCoachTemplate(value) {
  const parsed = typeof value === 'string'
    ? parseJsonObject(value)
    : value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  const defaults = cloneDefaultCoachTemplate();
  const guidance = parsed.guidance && typeof parsed.guidance === 'object' && !Array.isArray(parsed.guidance)
    ? parsed.guidance
    : {};

  return {
    schemaVersion: 'coach_template.v1',
    guidance: {
      coachingApproach: normalizeMultilineText(guidance.coachingApproach || defaults.guidance.coachingApproach, 4000),
      messageStyle: normalizeMultilineText(guidance.messageStyle || defaults.guidance.messageStyle, 4000),
      curriculumNotes: normalizeMultilineText(guidance.curriculumNotes || defaults.guidance.curriculumNotes, 6000)
    },
    profileSelectFields: normalizeTemplateFields(parsed.profileSelectFields, defaults.profileSelectFields),
    profileMultiSelectFields: normalizeTemplateFields(parsed.profileMultiSelectFields, defaults.profileMultiSelectFields)
  };
}

function getCoachTemplateSetting() {
  return normalizeCoachTemplate(getSetting(COACH_TEMPLATE_SETTING_KEY, ''));
}

function renderCoachTemplateLines(coachTemplate) {
  const template = normalizeCoachTemplate(coachTemplate);
  const lines = [];
  if (template.guidance.coachingApproach) {
    lines.push('Coaching approach:', template.guidance.coachingApproach);
  }
  if (template.guidance.messageStyle) {
    lines.push('Message style:', template.guidance.messageStyle);
  }
  if (template.guidance.curriculumNotes) {
    lines.push('Curriculum/program notes:', template.guidance.curriculumNotes);
  }
  const profileFields = [...template.profileSelectFields, ...template.profileMultiSelectFields]
    .map((field) => `${field.label}: ${field.options.join(', ')}`)
    .filter(Boolean);
  if (profileFields.length) {
    lines.push('Profile option defaults:', ...profileFields);
  }
  return lines.join('\n');
}

function buildCoachTemplateForPrompt(coachTemplate) {
  return normalizeCoachTemplate(coachTemplate);
}

function normalizeClientProfilePatch(value) {
  const profile = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const textKeys = [
    'curriculumType',
    'programType',
    'cohort',
    'programFormat',
    'primaryTrainingGoal',
    'programWeek'
  ];
  const dateKeys = ['curriculumStartDate', 'programStartDate'];
  const output = {};

  for (const key of textKeys) {
    const normalized = sanitizeName(profile[key]);
    if (normalized) {
      output[key] = normalized;
    }
  }
  for (const key of dateKeys) {
    const normalized = parseDate(profile[key]);
    if (normalized) {
      output[key] = normalized;
    }
  }
  const contraindications = normalizeArray(profile.contraindications || [], 30);
  if (contraindications.length) {
    output.contraindications = contraindications;
  }
  return output;
}

function applyClientProfilePatch(structured, profilePatch) {
  if (!profilePatch || !Object.keys(profilePatch).length) {
    return structured;
  }
  const baseline = structured && typeof structured === 'object' && !Array.isArray(structured) ? structured : {};
  const currentProfile = baseline.clientProfile && typeof baseline.clientProfile === 'object' && !Array.isArray(baseline.clientProfile)
    ? baseline.clientProfile
    : {};
  return {
    ...baseline,
    clientProfile: {
      ...currentProfile,
      ...profilePatch
    }
  };
}

function yamlQuote(value) {
  return JSON.stringify(String(value || ''));
}

function slugifyFileStem(value) {
  const stem = sanitizeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return stem || 'source';
}

async function getUniqueFilePath(directory, baseStem, extension = '.md') {
  for (let suffix = 1; suffix < 10000; suffix += 1) {
    const filename = suffix === 1 ? `${baseStem}${extension}` : `${baseStem}-${suffix}${extension}`;
    const candidate = path.join(directory, filename);
    try {
      await fsp.access(candidate, fs.constants.F_OK);
    } catch {
      return candidate;
    }
  }
  throw new Error('Could not create a unique filename.');
}

function ensureDb() {
  const dbDir = path.join(app.getPath('userData'), 'coachnotes');
  fs.mkdirSync(dbDir, { recursive: true });
  db = new Database(path.join(dbDir, 'coachnotes.sqlite'));
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS intake_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_date TEXT,
      annotation TEXT,
      original_path TEXT,
      vault_path TEXT,
      raw_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      structured_json TEXT NOT NULL,
      source_ids_json TEXT,
      model TEXT,
      raw_output TEXT,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_section_undo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baseline_id INTEGER NOT NULL,
      section_key TEXT NOT NULL,
      previous_value_json TEXT NOT NULL,
      current_value_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (baseline_id) REFERENCES client_baselines(id) ON DELETE CASCADE
    );
  `);

  if (!tableHasColumn('intake_sources', 'vault_path')) {
    db.exec('ALTER TABLE intake_sources ADD COLUMN vault_path TEXT');
  }
  if (!tableHasColumn('clients', 'archived')) {
    db.exec('ALTER TABLE clients ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }
  if (!tableHasColumn('clients', 'archived_at')) {
    db.exec('ALTER TABLE clients ADD COLUMN archived_at TEXT');
  }
}

function requireDb() {
  if (!db) {
    ensureDb();
  }
}

function tableHasColumn(tableName, columnName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => String(row.name || '').toLowerCase() === String(columnName || '').toLowerCase());
}

function setSetting(key, value) {
  requireDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value ?? null);
}

function getSetting(key, fallback = '') {
  requireDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

function normalizeProxyBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::|\/|$)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^http:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice('http://'.length)}`;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function getInviteToken() {
  const result = spawnSync(
    'security',
    ['find-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE, '-w'],
    { encoding: 'utf8' }
  );
  return result.status === 0 ? result.stdout.trim() : '';
}

function setInviteToken(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) {
    spawnSync('security', ['delete-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE], {
      encoding: 'utf8'
    });
    return;
  }

  const result = spawnSync(
    'security',
    ['add-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE, '-w', trimmed, '-U'],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to store invite token in Keychain.');
  }
}

function getAppSettings() {
  return {
    vaultFolder: getSetting('vaultFolder', ''),
    proxyBaseUrl: normalizeProxyBaseUrl(getSetting('proxyBaseUrl', DEFAULT_PROXY_URL)),
    inviteToken: getInviteToken(),
    coachTemplate: getCoachTemplateSetting()
  };
}

async function ensureVaultRootFolder() {
  requireDb();
  const configured = getSetting('vaultFolder', '');
  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  const documentsDir = app.getPath('documents') || app.getPath('home');
  const rootFolder = path.join(documentsDir, 'CoachNotes Vault');
  await fsp.mkdir(rootFolder, { recursive: true });
  setSetting('vaultFolder', rootFolder);
  return rootFolder;
}

async function callProxy(endpoint, payload, settings = getAppSettings()) {
  const baseUrl = normalizeProxyBaseUrl(settings.proxyBaseUrl || '');
  const token = String(settings.inviteToken || '').trim();
  if (!baseUrl || !token) {
    throw new Error('Proxy URL or invite token is missing in Settings.');
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid JSON from proxy.' };
  }

  if (!response.ok) {
    throw new Error(data.error || `Proxy request failed (${response.status}).`);
  }

  return data;
}

function ensureClient(name) {
  const displayName = sanitizeName(name);
  if (!displayName) {
    return null;
  }
  const key = displayName.toLowerCase();
  db.prepare(
    `INSERT INTO clients (name, display_name, archived, archived_at) VALUES (?, ?, 0, NULL)
     ON CONFLICT(name) DO UPDATE SET display_name = excluded.display_name, archived = 0, archived_at = NULL`
  ).run(key, displayName);
  return db.prepare('SELECT id FROM clients WHERE name = ?').get(key)?.id || null;
}

function normalizeIntakeSourceType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set(['everfit', 'chatgpt', 'transcript', 'check-in', 'message', 'pdf', 'notes', 'manual', 'other']);
  return allowed.has(normalized) ? normalized : 'other';
}

function normalizeIntakeSources(values) {
  const sources = Array.isArray(values) ? values : [];
  return sources.map((source, index) => {
    const rawText = normalizeTextContent(source?.rawText || source?.text || '');
    if (!rawText) {
      return null;
    }
    return {
      title: sanitizeName(source?.title || '') || `Intake Source ${index + 1}`,
      sourceType: normalizeIntakeSourceType(source?.sourceType || source?.source_type || source?.type),
      sourceDate: parseDate(source?.sourceDate || source?.date) || '',
      annotation: normalizeMultilineText(source?.annotation || '', 1200),
      originalPath: String(source?.originalPath || source?.path || '').trim(),
      rawText
    };
  }).filter(Boolean);
}

function buildIntakeSourceContent({ title, clientName, sourceType, sourceDate, annotation, originalPath, rawText }) {
  const frontmatter = [
    '---',
    `client: ${yamlQuote(clientName)}`,
    `date: ${yamlQuote(sourceDate || new Date().toISOString().slice(0, 10))}`,
    `source_type: ${yamlQuote(sourceType)}`,
    `tags: ["intake-source", ${yamlQuote(sourceType)}]`
  ];
  if (annotation) {
    frontmatter.push(`coach_annotation: ${yamlQuote(annotation)}`);
  }
  if (originalPath) {
    frontmatter.push(`original_path: ${yamlQuote(originalPath)}`);
  }
  frontmatter.push('---', '', `# ${title}`, '');

  const metaLines = [
    annotation ? `Coach annotation: ${annotation}` : '',
    originalPath ? `Original file: ${originalPath}` : ''
  ].filter(Boolean);

  return `${frontmatter.join('\n')}${metaLines.length ? `${metaLines.join('\n')}\n\n` : ''}${String(rawText || '').trim()}\n`;
}

async function saveIntakeSource({ clientId, clientName, rootFolder, source }) {
  const importDirectory = path.join(rootFolder, clientName, CLIENT_IMPORTS_DIRNAME);
  await fsp.mkdir(importDirectory, { recursive: true });

  const sourceDate = source.sourceDate || new Date().toISOString().slice(0, 10);
  const stem = `${sourceDate}-${source.sourceType}-${slugifyFileStem(source.title)}`.slice(0, 140);
  const vaultPath = await getUniqueFilePath(importDirectory, stem, '.md');
  const content = buildIntakeSourceContent({
    ...source,
    clientName,
    sourceDate
  });

  await fsp.writeFile(vaultPath, content, 'utf8');
  const result = db.prepare(
    `INSERT INTO intake_sources
      (client_id, title, source_type, source_date, annotation, original_path, vault_path, raw_text, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    clientId,
    source.title,
    source.sourceType,
    sourceDate,
    source.annotation,
    source.originalPath,
    vaultPath,
    source.rawText,
    nowIso(),
    JSON.stringify({})
  );

  return {
    id: result.lastInsertRowid,
    sourceId: `intake_source_${result.lastInsertRowid}`,
    title: source.title,
    sourceType: source.sourceType,
    sourceDate,
    annotation: source.annotation,
    originalPath: source.originalPath,
    vaultPath,
    rawText: source.rawText
  };
}

function buildWorkflowSourcePayload(records) {
  const payload = [];
  let remaining = MAX_WORKFLOW_CHARS;

  for (const record of records) {
    if (remaining <= 0) {
      break;
    }
    const raw = String(record.rawText || '').trim();
    if (!raw) {
      continue;
    }
    const text = raw.length > remaining
      ? `${raw.slice(0, Math.max(0, remaining - 120))}\n\n[Truncated by CoachNotes before AI intake.]`
      : raw;
    remaining -= text.length;
    payload.push({
      source_id: record.sourceId,
      title: record.title,
      source_type: record.sourceType,
      date: record.sourceDate,
      annotation: record.annotation,
      text
    });
  }

  return payload;
}

async function generateClientBaseline(payload) {
  requireDb();
  const rootFolder = await ensureVaultRootFolder();
  const settings = getAppSettings();
  const clientName = sanitizeName(payload?.clientName || payload?.client?.name || '');
  if (!clientName) {
    throw new Error('Client name is required.');
  }

  const sources = normalizeIntakeSources(payload?.sources || []);
  if (!sources.length) {
    throw new Error('Add at least one source before running intake.');
  }
  const clientProfilePatch = normalizeClientProfilePatch(payload?.clientProfile);

  const clientId = ensureClient(clientName);
  if (!clientId) {
    throw new Error('Could not create client.');
  }

  const savedSources = [];
  for (const source of sources) {
    savedSources.push(await saveIntakeSource({ clientId, clientName, rootFolder, source }));
  }

  let response;
  try {
    response = await callProxy('/workflow', {
      model: DEFAULT_LLM_MODEL,
      workflow: 'client_intake_baseline',
      client: {
        name: clientName,
        programContext: normalizeMultilineText(payload?.programContext || '', 2000),
        coachNotes: normalizeMultilineText(payload?.coachNotes || '', 2000),
        profileSettings: clientProfilePatch
      },
      coachTemplate: buildCoachTemplateForPrompt(settings.coachTemplate),
      sources: buildWorkflowSourcePayload(savedSources)
    }, settings);
  } catch (error) {
    for (const source of savedSources) {
      db.prepare('DELETE FROM intake_sources WHERE id = ?').run(source.id);
      if (source.vaultPath) {
        await fsp.unlink(source.vaultPath).catch(() => {});
      }
    }
    throw error;
  }

  const structured = applyClientProfilePatch(
    response.structured && typeof response.structured === 'object' ? response.structured : {},
    clientProfilePatch
  );
  const createdAt = nowIso();
  const baseline = db.prepare(
    `INSERT INTO client_baselines
      (client_id, status, structured_json, source_ids_json, model, raw_output, created_at, accepted_at, updated_at)
     VALUES (?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    clientId,
    JSON.stringify(structured),
    JSON.stringify(savedSources.map((source) => source.id)),
    response.model || DEFAULT_LLM_MODEL,
    response.rawOutput || '',
    createdAt,
    createdAt,
    createdAt
  );

  return getClientDetail({ clientId, baselineId: baseline.lastInsertRowid });
}

async function acceptClientBaseline(payload) {
  requireDb();
  const baselineId = Number(payload?.baselineId);
  if (!Number.isFinite(baselineId)) {
    throw new Error('baselineId is required.');
  }

  const baseline = db.prepare('SELECT id, client_id FROM client_baselines WHERE id = ?').get(baselineId);
  if (!baseline) {
    throw new Error('Client baseline not found.');
  }

  const structured = payload?.structured && typeof payload.structured === 'object' ? payload.structured : {};
  const acceptedAt = nowIso();
  db.prepare(
    `UPDATE client_baselines
     SET status = 'accepted', structured_json = ?, accepted_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(JSON.stringify(structured), acceptedAt, acceptedAt, baselineId);

  return getClientDetail({ clientId: baseline.client_id });
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyJsonValue(value) {
  return JSON.stringify(value ?? null);
}

function jsonValuesEqual(left, right) {
  return stringifyJsonValue(left) === stringifyJsonValue(right);
}

function comparableBaselineSectionValue(structured, sectionKey) {
  if (structured && Object.prototype.hasOwnProperty.call(structured, sectionKey)) {
    return structured[sectionKey];
  }
  return BASELINE_ARRAY_SECTION_KEYS.has(sectionKey) ? [] : undefined;
}

function normalizePlanningMatchText(item) {
  if (typeof item === 'string') {
    return sanitizeName(item).toLowerCase();
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return '';
  }
  return [
    item.title,
    item.label,
    item.name,
    item.details,
    item.currentStatus,
    item.summary,
    item.note,
    item.notes
  ].map((value) => sanitizeName(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function extractPlanningMetadata(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return {};
  }
  return Object.fromEntries(
    PLANNING_METADATA_KEYS
      .filter((key) => String(item[key] || '').trim())
      .map((key) => [key, item[key]])
  );
}

function applyPlanningMetadata(item, metadata) {
  if (!metadata || !Object.keys(metadata).length) {
    return item;
  }
  const next = item && typeof item === 'object' && !Array.isArray(item)
    ? { ...item }
    : { details: String(item || '') };
  return { ...next, ...metadata };
}

function preservePlanningMetadata(currentStructured, nextStructured) {
  const output = { ...nextStructured };
  for (const sectionKey of PLANNING_SECTION_KEYS) {
    const currentItems = Array.isArray(currentStructured?.[sectionKey]) ? currentStructured[sectionKey] : [];
    const nextItems = Array.isArray(nextStructured?.[sectionKey]) ? nextStructured[sectionKey] : [];
    if (!currentItems.length || !nextItems.length) {
      continue;
    }

    const metadataByText = new Map();
    currentItems.forEach((item) => {
      const metadata = extractPlanningMetadata(item);
      const textKey = normalizePlanningMatchText(item);
      if (textKey && Object.keys(metadata).length) {
        metadataByText.set(textKey, metadata);
      }
    });
    if (!metadataByText.size) {
      continue;
    }

    output[sectionKey] = nextItems.map((item) => {
      const textKey = normalizePlanningMatchText(item);
      return applyPlanningMetadata(item, metadataByText.get(textKey));
    });
  }
  return output;
}

function extractClientProfileMetadata(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return {};
  }
  return Object.fromEntries(
    CLIENT_PROFILE_METADATA_KEYS
      .filter((key) => {
        const value = profile[key];
        return Array.isArray(value) ? value.length : String(value || '').trim();
      })
      .map((key) => [key, profile[key]])
  );
}

function preserveClientProfileMetadata(currentStructured, nextStructured) {
  const metadata = extractClientProfileMetadata(currentStructured?.clientProfile);
  if (!Object.keys(metadata).length) {
    return nextStructured;
  }
  const nextProfile = nextStructured?.clientProfile && typeof nextStructured.clientProfile === 'object' && !Array.isArray(nextStructured.clientProfile)
    ? nextStructured.clientProfile
    : {};
  return {
    ...nextStructured,
    clientProfile: {
      ...nextProfile,
      ...metadata
    }
  };
}

function assertBaselineSectionKey(sectionKey) {
  const key = String(sectionKey || '').trim();
  if (!BASELINE_SECTION_KEYS.has(key)) {
    throw new Error('Unsupported dashboard section.');
  }
  return key;
}

function getAcceptedBaselineRow(clientId) {
  return db.prepare(
    `SELECT
      c.id AS clientId,
      c.display_name AS clientName,
      b.id AS baselineId,
      b.structured_json AS structuredJson,
      b.source_ids_json AS sourceIdsJson
     FROM clients c
     JOIN client_baselines b ON b.id = (
       SELECT bx.id
       FROM client_baselines bx
       WHERE bx.client_id = c.id AND bx.status = 'accepted'
       ORDER BY bx.accepted_at DESC, bx.id DESC
       LIMIT 1
     )
     WHERE c.id = ?`
  ).get(clientId);
}

function pushSectionUndo({ baselineId, sectionKey, previousValue, currentValue, reason }) {
  if (jsonValuesEqual(previousValue, currentValue)) {
    return false;
  }
  db.prepare(
    `INSERT INTO client_section_undo
      (baseline_id, section_key, previous_value_json, current_value_json, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    baselineId,
    sectionKey,
    stringifyJsonValue(previousValue),
    stringifyJsonValue(currentValue),
    reason || 'Dashboard edit',
    nowIso()
  );
  return true;
}

function getUndoCounts(baselineId) {
  if (!baselineId) {
    return {};
  }
  return Object.fromEntries(db.prepare(
    `SELECT section_key AS sectionKey, COUNT(*) AS count
     FROM client_section_undo
     WHERE baseline_id = ?
     GROUP BY section_key`
  ).all(baselineId).map((row) => [row.sectionKey, row.count]));
}

function getClients() {
  requireDb();
  return db.prepare(
    `SELECT
      c.id,
      c.display_name AS name,
      b.id AS baselineId,
      b.accepted_at AS acceptedAt,
      b.updated_at AS updatedAt,
      b.structured_json AS structuredJson,
      b.source_ids_json AS sourceIdsJson,
      (
        SELECT COUNT(*)
        FROM intake_sources s
        WHERE s.client_id = c.id
      ) AS sourceCount
     FROM clients c
     JOIN client_baselines b ON b.id = (
       SELECT bx.id
       FROM client_baselines bx
       WHERE bx.client_id = c.id AND bx.status = 'accepted'
       ORDER BY bx.accepted_at DESC, bx.id DESC
       LIMIT 1
     )
     WHERE COALESCE(c.archived, 0) = 0
     ORDER BY LOWER(c.display_name) ASC`
  ).all().map((row) => {
    const structured = parseJsonObject(row.structuredJson);
    const sourceIds = parseJsonArray(row.sourceIdsJson);
    const flags = Array.isArray(structured.flags) ? structured.flags : [];
    const tasks = Array.isArray(structured.coachTasks) ? structured.coachTasks : [];
    return {
      id: row.id,
      name: row.name,
      baselineId: row.baselineId,
      acceptedAt: row.acceptedAt,
      updatedAt: row.updatedAt,
      sourceCount: sourceIds.length || Number(row.sourceCount || 0),
      summary: String(structured.overview || '').slice(0, 180),
      tags: normalizeArray(structured.suggestedTags || [], 5),
      flagCount: flags.length,
      taskCount: tasks.length
    };
  });
}

function deleteClient(payload) {
  requireDb();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }

  const row = db.prepare('SELECT id, display_name AS name FROM clients WHERE id = ?').get(clientId);
  if (!row) {
    throw new Error('Client not found.');
  }

  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
  return {
    deleted: result.changes > 0,
    clientId: row.id,
    name: row.name,
    clients: getClients()
  };
}

function updateClientSection(payload) {
  requireDb();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }
  const sectionKey = assertBaselineSectionKey(payload?.sectionKey);
  const row = getAcceptedBaselineRow(clientId);
  if (!row) {
    throw new Error('Accepted client baseline not found.');
  }

  const structured = parseJsonObject(row.structuredJson);
  const previousValue = structured[sectionKey];
  const nextValue = payload?.value;
  if (jsonValuesEqual(previousValue, nextValue)) {
    return getClientDetail({ clientId });
  }

  pushSectionUndo({
    baselineId: row.baselineId,
    sectionKey,
    previousValue,
    currentValue: nextValue,
    reason: 'Coach dashboard edit'
  });
  structured[sectionKey] = nextValue;
  const updatedAt = nowIso();
  db.prepare('UPDATE client_baselines SET structured_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(structured), updatedAt, row.baselineId);
  return getClientDetail({ clientId });
}

function updateClientSections(payload) {
  requireDb();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }
  const updates = payload?.updates;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new Error('updates object is required.');
  }
  const row = getAcceptedBaselineRow(clientId);
  if (!row) {
    throw new Error('Accepted client baseline not found.');
  }

  const structured = parseJsonObject(row.structuredJson);
  const entries = Object.entries(updates).map(([sectionKey, value]) => ({
    sectionKey: assertBaselineSectionKey(sectionKey),
    value
  })).filter(({ sectionKey, value }) => !jsonValuesEqual(structured[sectionKey], value));
  if (!entries.length) {
    return getClientDetail({ clientId });
  }

  const updatedAt = nowIso();
  const saveUpdates = db.transaction(() => {
    for (const { sectionKey, value } of entries) {
      pushSectionUndo({
        baselineId: row.baselineId,
        sectionKey,
        previousValue: structured[sectionKey],
        currentValue: value,
        reason: 'Coach dashboard edit'
      });
      structured[sectionKey] = value;
    }
    db.prepare('UPDATE client_baselines SET structured_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(structured), updatedAt, row.baselineId);
  });
  saveUpdates();
  return getClientDetail({ clientId });
}

function undoClientSection(payload) {
  requireDb();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }
  const sectionKey = assertBaselineSectionKey(payload?.sectionKey);
  const row = getAcceptedBaselineRow(clientId);
  if (!row) {
    throw new Error('Accepted client baseline not found.');
  }

  const undo = db.prepare(
    `SELECT id, previous_value_json AS previousValueJson
     FROM client_section_undo
     WHERE baseline_id = ? AND section_key = ?
     ORDER BY id DESC
     LIMIT 1`
  ).get(row.baselineId, sectionKey);
  if (!undo) {
    throw new Error('Nothing to undo for this section.');
  }

  const structured = parseJsonObject(row.structuredJson);
  structured[sectionKey] = JSON.parse(undo.previousValueJson);
  const updatedAt = nowIso();
  db.prepare('UPDATE client_baselines SET structured_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(structured), updatedAt, row.baselineId);
  db.prepare('DELETE FROM client_section_undo WHERE id = ?').run(undo.id);
  return getClientDetail({ clientId });
}

function extractUpdatedBaselineResponse(response, currentStructured) {
  const structured = response.structured && typeof response.structured === 'object' ? response.structured : {};
  const updatedBaseline = structured.updatedBaseline && typeof structured.updatedBaseline === 'object'
    ? structured.updatedBaseline
    : structured.baseline && typeof structured.baseline === 'object'
      ? structured.baseline
      : structured;
  return {
    updatedBaseline: updatedBaseline && typeof updatedBaseline === 'object' ? updatedBaseline : currentStructured,
    changes: Array.isArray(structured.changes) ? structured.changes : [],
    updateSummary: normalizeMultilineText(structured.updateSummary || '', 600)
  };
}

async function updateClientFromNote(payload) {
  requireDb();
  const rootFolder = await ensureVaultRootFolder();
  const settings = getAppSettings();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }

  const row = getAcceptedBaselineRow(clientId);
  if (!row) {
    throw new Error('Accepted client baseline not found.');
  }
  const sources = normalizeIntakeSources(payload?.sources || []);
  if (!sources.length) {
    throw new Error('Add at least one note source before updating.');
  }

  const savedSources = [];
  for (const source of sources) {
    savedSources.push(await saveIntakeSource({
      clientId,
      clientName: row.clientName,
      rootFolder,
      source
    }));
  }

  const currentStructured = parseJsonObject(row.structuredJson);
  let response;
  try {
    response = await callProxy('/workflow', {
      model: DEFAULT_LLM_MODEL,
      workflow: 'client_note_update',
      client: {
        name: row.clientName
      },
      coachTemplate: buildCoachTemplateForPrompt(settings.coachTemplate),
      currentBaseline: currentStructured,
      sources: buildWorkflowSourcePayload(savedSources)
    }, settings);
  } catch (error) {
    for (const source of savedSources) {
      db.prepare('DELETE FROM intake_sources WHERE id = ?').run(source.id);
      if (source.vaultPath) {
        await fsp.unlink(source.vaultPath).catch(() => {});
      }
    }
    throw error;
  }

  const { updatedBaseline, changes, updateSummary } = extractUpdatedBaselineResponse(response, currentStructured);
  const nextStructured = preserveClientProfileMetadata(
    currentStructured,
    preservePlanningMetadata(currentStructured, {
      ...currentStructured,
      ...updatedBaseline
    })
  );
  const changedSections = [...BASELINE_SECTION_KEYS].filter((sectionKey) => (
    Object.prototype.hasOwnProperty.call(nextStructured, sectionKey)
    && !jsonValuesEqual(
      comparableBaselineSectionValue(currentStructured, sectionKey),
      comparableBaselineSectionValue(nextStructured, sectionKey)
    )
  ));

  for (const sectionKey of changedSections) {
    pushSectionUndo({
      baselineId: row.baselineId,
      sectionKey,
      previousValue: currentStructured[sectionKey],
      currentValue: nextStructured[sectionKey],
      reason: `AI update from ${savedSources.length} new source${savedSources.length === 1 ? '' : 's'}`
    });
  }

  const sourceIds = new Set(parseJsonArray(row.sourceIdsJson).map((id) => Number(id)).filter(Number.isFinite));
  for (const source of savedSources) {
    sourceIds.add(source.id);
  }
  const updatedAt = nowIso();
  db.prepare(
    `UPDATE client_baselines
     SET structured_json = ?, source_ids_json = ?, model = ?, raw_output = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    JSON.stringify(nextStructured),
    JSON.stringify([...sourceIds]),
    response.model || DEFAULT_LLM_MODEL,
    response.rawOutput || '',
    updatedAt,
    row.baselineId
  );

  return {
    detail: getClientDetail({ clientId }),
    changes,
    changedSections,
    updateSummary
  };
}

function normalizeAskChoice(value, allowedValues, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowedValues.has(normalized) ? normalized : fallback;
}

function askOutputLabel(outputType) {
  if (outputType === 'client-profile-export') {
    return 'Client profile export';
  }
  if (outputType === 'initial-welcome-message') {
    return 'Initial welcome message';
  }
  if (outputType === 'session-prep') {
    return 'Session prep';
  }
  if (outputType === 'general-answer') {
    return 'General answer';
  }
  return 'Client message draft';
}

function askScopeLabel(scope) {
  if (scope === 'dashboard') {
    return 'Current dashboard only';
  }
  if (scope === 'all-sources') {
    return 'All sources for this client';
  }
  return 'Recent notes + dashboard';
}

function askTimeWindowLabel(timeWindow) {
  if (timeWindow === 'latest-note') {
    return 'Latest note';
  }
  if (timeWindow === 'last-90-days') {
    return 'Last 90 days';
  }
  if (timeWindow === 'all-time') {
    return 'All time';
  }
  return 'Last 3 weeks';
}

function renderAskValue(value, depth = 0) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sanitizeName(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => renderAskValue(entry, depth + 1))
      .filter(Boolean)
      .map((entry) => `- ${entry}`)
      .join('\n');
  }
  if (typeof value === 'object') {
    const preferred = [
      value.title,
      value.label,
      value.name,
      value.date,
      value.details,
      value.currentStatus,
      value.status,
      value.summary,
      value.note,
      value.notes
    ].map((entry) => sanitizeName(entry)).filter(Boolean);
    if (preferred.length && depth > 0) {
      return preferred.join(' - ');
    }
    return Object.entries(value)
      .filter(([key]) => !['evidenceIds', 'priority', 'planningStatus'].includes(key))
      .map(([key, entry]) => {
        const rendered = renderAskValue(entry, depth + 1);
        return rendered ? `${key}: ${rendered}` : '';
      })
      .filter(Boolean)
      .join(depth > 0 ? ' | ' : '\n');
  }
  return '';
}

function buildDashboardAskText(clientName, structured = {}) {
  const lines = [
    `Client: ${clientName}`,
    `Overview: ${sanitizeName(structured.overview || '')}`
  ];
  for (const sectionKey of BASELINE_SECTION_KEYS) {
    if (sectionKey === 'overview') {
      continue;
    }
    const value = structured[sectionKey];
    const rendered = renderAskValue(value);
    if (rendered) {
      lines.push('', `${sectionKey}:`, rendered);
    }
  }
  return normalizeTextContent(lines.join('\n')).slice(0, 18000);
}

function getAskSourceTime(source) {
  const raw = source?.sourceDate || source?.createdAt || '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getAskSourcesForClient(clientId, sourceIds = []) {
  const activeIds = sourceIds.map((id) => Number(id)).filter(Number.isFinite);
  const rows = activeIds.length
    ? db.prepare(
      `SELECT id, title, source_type AS sourceType, source_date AS sourceDate, annotation, original_path AS originalPath, vault_path AS vaultPath, raw_text AS rawText, created_at AS createdAt
       FROM intake_sources
       WHERE client_id = ? AND id IN (${activeIds.map(() => '?').join(', ')})
       ORDER BY created_at DESC, id DESC`
    ).all(clientId, ...activeIds)
    : db.prepare(
      `SELECT id, title, source_type AS sourceType, source_date AS sourceDate, annotation, original_path AS originalPath, vault_path AS vaultPath, raw_text AS rawText, created_at AS createdAt
       FROM intake_sources
       WHERE client_id = ?
       ORDER BY created_at DESC, id DESC`
    ).all(clientId);

  return rows.map((source) => ({
    ...source,
    sourceId: `intake_source_${source.id}`,
    rawText: normalizeTextContent(source.rawText || '')
  }));
}

function filterAskSourcesByTimeWindow(sources, timeWindow) {
  if (timeWindow === 'all-time') {
    return sources;
  }
  const dated = [...sources].filter((source) => getAskSourceTime(source));
  if (timeWindow === 'latest-note') {
    const latest = dated.sort((left, right) => getAskSourceTime(right) - getAskSourceTime(left))[0];
    return latest ? [latest] : [];
  }
  const days = timeWindow === 'last-90-days' ? 90 : 21;
  const cutoff = Date.now() - days * 86400000;
  return sources.filter((source) => getAskSourceTime(source) >= cutoff);
}

function tokenizeAskQuery(value) {
  return normalizeTextContent(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !ASK_STOP_WORDS.has(token));
}

function scoreAskSource(source, tokens) {
  const haystack = `${source.title || ''} ${source.annotation || ''} ${source.rawText || ''}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    const pattern = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    score += (haystack.match(pattern) || []).length;
  }
  return score;
}

function selectAskSources({ clientName, structured, sources, prompt, scope, timeWindow }) {
  const selected = [{
    chunk_id: 'dashboard_current',
    title: 'Current dashboard',
    date: '',
    client_ids: [clientName],
    text: buildDashboardAskText(clientName, structured),
    sourceId: 'dashboard_current',
    sourceType: 'dashboard',
    displayTitle: 'Current dashboard'
  }];

  if (scope === 'dashboard') {
    return selected;
  }

  const filtered = filterAskSourcesByTimeWindow(sources, timeWindow);
  const tokens = tokenizeAskQuery(prompt);
  const sorted = filtered
    .map((source) => ({
      source,
      score: scoreAskSource(source, tokens),
      time: getAskSourceTime(source)
    }))
    .sort((left, right) => (
      right.score - left.score
      || right.time - left.time
      || Number(right.source.id) - Number(left.source.id)
    ));
  const limit = scope === 'all-sources' ? ASK_MAX_SOURCES - 1 : Math.min(8, ASK_MAX_SOURCES - 1);

  for (const { source } of sorted.slice(0, limit)) {
    selected.push({
      chunk_id: source.sourceId,
      title: source.title || 'Untitled source',
      date: source.sourceDate || source.createdAt || '',
      client_ids: [clientName],
      text: source.rawText,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      displayTitle: source.title || 'Untitled source'
    });
  }

  return selected;
}

function fitAskSourcesForProxy(sources) {
  let remaining = ASK_MAX_TOTAL_CHARS;
  const output = [];
  for (const source of sources.slice(0, ASK_MAX_SOURCES)) {
    if (remaining <= 0) {
      break;
    }
    const raw = normalizeTextContent(source.text || '');
    if (!raw) {
      continue;
    }
    const text = raw.length > remaining
      ? `${raw.slice(0, Math.max(0, remaining - 120))}\n\n[Truncated by CoachNotes before ASK.]`
      : raw;
    remaining -= text.length;
    output.push({
      chunk_id: source.chunk_id,
      title: source.title,
      date: source.date,
      client_ids: source.client_ids,
      text
    });
  }
  return output;
}

function buildAskInstructions({ outputType, scope, timeWindow, coachTemplate }) {
  const shared = [
    `Output type: ${askOutputLabel(outputType)}.`,
    `Context scope selected by coach: ${askScopeLabel(scope)}.`,
    `Time window selected by coach: ${askTimeWindowLabel(timeWindow)}.`,
    'Respect the selected context boundary. If the selected sources do not support the request, say what is missing.'
  ];
  const shouldIncludeCitations = !['client-profile-export', 'initial-welcome-message'].includes(outputType);
  if (shouldIncludeCitations) {
    shared.push('Keep citations next to source-grounded claims.');
  } else {
    shared.push('Do not include citations, source numbers, bracketed references, or source markers in the output.');
  }
  if (outputType === 'client-message') {
    shared.push(
      'Write a client-ready message draft from the coach to the client.',
      'Keep it practical, warm, and concise.',
      'Do not include a subject line unless the coach asks for one.',
      'Do not diagnose or overstate medical conclusions.'
    );
  } else if (outputType === 'initial-welcome-message') {
    shared.push(
      'Write a warm client-facing initial welcome message from the coach to this client. This is a welcome note, not an intake summary.',
      'Use only information supported by the source material. Do not invent details.',
      'If the official coaching start date is not available, leave a clear placeholder for the coach to fill in.',
      'Return only the client-ready message. Do not include commentary, citations, source notes, or coach/practice guidance.',
      'Thank the client for completing their intake.',
      'Use 2 or 3 meaningful personal details only if they help the client feel seen. Do not list demographics or biographical facts.',
      'Synthesize what matters to the client, what they want to accomplish, and why those goals matter for their life.',
      'Briefly reassure them that coaching will account for their needs, preferences, history, and relevant considerations.',
      'Do not list sensitive medical, mental health, pelvic floor, eating disorder, medication, or diagnosis details unless absolutely necessary for the welcome message.',
      'Let them know they are in the right place and will be supported throughout coaching.',
      'Tell them their official coaching start date.',
      'Explain that on their official coaching start date they will receive their first nutrition and mindset lessons and access to their training programs.',
      'Ask exactly this question somewhere natural in the message: Do you need help selecting a training program? If so, let me know and we can discuss it.',
      'Invite any questions.',
      'Encourage them to share what is and is not working so coaching can be adjusted.',
      'Close warmly with this sentence: I am so happy you are here!',
      'Focus on the client, not the coach.',
      'Avoid first person statements like I love or I am proud of you.',
      'Do not try to mention every important detail from the intake. Choose the details that create the warmest and most useful welcome.',
      'Do not simply repeat their intake answers. Synthesize the information so they feel understood.',
      'Use a warm, compassionate tone.',
      'Do not use hyphens, em dashes, or en dashes.',
      'Do not use contrast framing such as It is not X, it is Y.'
    );
  } else if (outputType === 'session-prep') {
    shared.push(
      'Return concise session prep notes with headings: Focus, Recent Context, Watch-outs, Suggested Talking Points.',
      'Prefer bullets that help the coach prepare quickly.'
    );
  } else if (outputType === 'client-profile-export') {
    shared.push(
      'Create an Everfit client profile from the client intake notes and any related coaching notes.',
      'Use only information supported by the source material. Do not invent details. If a field is not mentioned, leave it blank.',
      'Keep the profile concise, coach-friendly, and easy to paste into Everfit.',
      'Use plain language and avoid medical diagnosis language beyond what the client/source explicitly states.',
      'Return only the profile. Do not include commentary, citations, source numbers, bracketed references, source notes, markdown fences, or coach/practice guidance.',
      'For the Phone section, include the client phone number if available, phone type if mentioned, whether calling and/or texting is okay, and the preferred SOS system contact plan if the coach has not heard from the client in 4+ weeks.',
      'If any phone detail is not mentioned, leave it blank.',
      '',
      'Format the output exactly like this:',
      '',
      'Name:',
      'Pronouns:',
      'DOB:',
      'Age:',
      'Location:',
      '',
      'Phone:',
      'Number:',
      'Phone type:',
      'Call/text okay:',
      'SOS system if no contact for 4+ weeks:',
      '',
      'CLIENT PROFILE TEMPLATE (Everfit)',
      '',
      'Family life, job, pets, hobbies:',
      '',
      'Height/Weight:',
      '',
      'Training experience:',
      '',
      'Equipment access:',
      '',
      'Current training goals:',
      '',
      'Injuries or limitations, including pelvic floor issues, perimenopause, and menopause:',
      '',
      'Nutrition habits/preferences:',
      '',
      'GLP 1 use:',
      '',
      'Disordered eating or eating disorder:',
      '',
      'Top 3 nutrition goals:',
      '1.',
      '2.',
      '3.',
      '',
      'Mindset or motivation considerations:',
      '',
      'Other coaching considerations:',
      '',
      'Any red flags or important items for the coach to consider:',
      '',
      'Missing or unclear information:'
    );
  } else {
    shared.push('Answer the coach directly and keep it concise.');
  }
  const coachGuidance = renderCoachTemplateLines(coachTemplate);
  if (coachGuidance && shouldIncludeCitations) {
    shared.push(
      '',
      'Coach/practice guidance:',
      coachGuidance,
      'Use this guidance for tone, emphasis, profile option labels, and coaching priorities. Do not cite it as client evidence; client-specific claims still need the provided sources.'
    );
  }
  return shared.join('\n');
}

async function askClient(payload) {
  requireDb();
  const settings = getAppSettings();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }
  const prompt = normalizeMultilineText(payload?.prompt || payload?.question || '', 4000);
  if (!prompt) {
    throw new Error('Ask request is required.');
  }
  const outputType = normalizeAskChoice(
    payload?.outputType,
    new Set(['client-message', 'initial-welcome-message', 'session-prep', 'client-profile-export', 'general-answer']),
    'client-message'
  );
  let scope = normalizeAskChoice(
    payload?.scope,
    new Set(['dashboard', 'recent-notes', 'all-sources']),
    'recent-notes'
  );
  let timeWindow = normalizeAskChoice(
    payload?.timeWindow,
    new Set(['latest-note', 'last-3-weeks', 'last-90-days', 'all-time']),
    'last-3-weeks'
  );
  if (outputType === 'client-profile-export' || outputType === 'initial-welcome-message') {
    scope = 'all-sources';
    timeWindow = 'all-time';
  }
  const row = getAcceptedBaselineRow(clientId);
  if (!row) {
    throw new Error('Accepted client baseline not found.');
  }

  const structured = parseJsonObject(row.structuredJson);
  const allSources = getAskSourcesForClient(clientId, parseJsonArray(row.sourceIdsJson));
  const selected = selectAskSources({
    clientName: row.clientName,
    structured,
    sources: allSources,
    prompt,
    scope,
    timeWindow
  });
  const sources = fitAskSourcesForProxy(selected);
  if (!sources.length) {
    throw new Error('No local context is available for this client.');
  }

  const response = await callProxy('/answer', {
    model: DEFAULT_LLM_MODEL,
    question: prompt,
    instructions: buildAskInstructions({
      outputType,
      scope,
      timeWindow,
      coachTemplate: settings.coachTemplate
    }),
    sources
  }, settings);

  return {
    outputType,
    outputLabel: askOutputLabel(outputType),
    scope,
    scopeLabel: askScopeLabel(scope),
    timeWindow,
    timeWindowLabel: askTimeWindowLabel(timeWindow),
    question: prompt,
    answer: response.answer || '',
    citations: Array.isArray(response.citations) ? response.citations : [],
    model: response.model || DEFAULT_LLM_MODEL,
    selectedSources: selected.map((source, index) => ({
      chunkId: source.chunk_id,
      sourceId: source.sourceId,
      title: source.displayTitle || source.title,
      sourceType: source.sourceType || 'notes',
      date: source.date || '',
      displayNumber: index + 1
    }))
  };
}

async function saveAskResultAsNote(payload) {
  requireDb();
  const rootFolder = await ensureVaultRootFolder();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }
  const answer = normalizeMultilineText(payload?.answer || '', 16000);
  if (!answer) {
    throw new Error('Ask output is required.');
  }
  const row = getAcceptedBaselineRow(clientId);
  if (!row) {
    throw new Error('Accepted client baseline not found.');
  }
  const question = normalizeMultilineText(payload?.question || '', 4000);
  const outputType = normalizeAskChoice(
    payload?.outputType,
    new Set(['client-message', 'initial-welcome-message', 'session-prep', 'client-profile-export', 'general-answer']),
    'client-message'
  );
  const scopeLabel = askScopeLabel(normalizeAskChoice(payload?.scope, new Set(['dashboard', 'recent-notes', 'all-sources']), 'recent-notes'));
  const timeWindowLabel = askTimeWindowLabel(normalizeAskChoice(payload?.timeWindow, new Set(['latest-note', 'last-3-weeks', 'last-90-days', 'all-time']), 'last-3-weeks'));
  const createdDate = new Date().toISOString().slice(0, 10);
  const rawText = normalizeTextContent([
    `ASK output type: ${askOutputLabel(outputType)}`,
    `Context: ${scopeLabel}`,
    `Time window: ${timeWindowLabel}`,
    '',
    'Request:',
    question,
    '',
    'Output:',
    answer
  ].join('\n'));
  const savedSource = await saveIntakeSource({
    clientId,
    clientName: row.clientName,
    rootFolder,
    source: {
      title: sanitizeName(payload?.title || '') || `ASK ${askOutputLabel(outputType)}`,
      sourceType: 'manual',
      sourceDate: createdDate,
      annotation: 'Generated by CoachNotes ASK. Review before treating as source-of-truth coaching context.',
      originalPath: '',
      rawText
    }
  });

  const sourceIds = new Set(parseJsonArray(row.sourceIdsJson).map((id) => Number(id)).filter(Number.isFinite));
  sourceIds.add(savedSource.id);
  const updatedAt = nowIso();
  db.prepare('UPDATE client_baselines SET source_ids_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify([...sourceIds]), updatedAt, row.baselineId);
  return getClientDetail({ clientId });
}

function getClientDetail(payload) {
  requireDb();
  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }

  const row = db.prepare(
    `SELECT
      c.id,
      c.display_name AS name,
      b.id AS baselineId,
      b.status,
      b.model,
      b.created_at AS createdAt,
      b.accepted_at AS acceptedAt,
      b.updated_at AS updatedAt,
      b.structured_json AS structuredJson,
      b.source_ids_json AS sourceIdsJson
     FROM clients c
     LEFT JOIN client_baselines b ON b.id = (
       SELECT bx.id
       FROM client_baselines bx
       WHERE bx.client_id = c.id AND bx.status = 'accepted'
       ORDER BY bx.accepted_at DESC, bx.id DESC
       LIMIT 1
     )
     WHERE c.id = ?`
  ).get(clientId);

  if (!row) {
    throw new Error('Client not found.');
  }

  const sourceIds = parseJsonArray(row.sourceIdsJson).map((id) => Number(id)).filter(Number.isFinite);
  let sources = [];
  if (sourceIds.length) {
    const placeholders = sourceIds.map(() => '?').join(', ');
    sources = db.prepare(
      `SELECT id, title, source_type AS sourceType, source_date AS sourceDate, annotation, original_path AS originalPath, vault_path AS vaultPath, raw_text AS rawText, created_at AS createdAt
       FROM intake_sources
       WHERE id IN (${placeholders})
       ORDER BY created_at DESC, id DESC`
    ).all(...sourceIds);
  } else {
    sources = db.prepare(
      `SELECT id, title, source_type AS sourceType, source_date AS sourceDate, annotation, original_path AS originalPath, vault_path AS vaultPath, raw_text AS rawText, created_at AS createdAt
       FROM intake_sources
       WHERE client_id = ?
       ORDER BY created_at DESC, id DESC`
    ).all(clientId);
  }

  sources = sources.map((source) => ({
    ...source,
    sourceId: `intake_source_${source.id}`,
    rawText: normalizeTextContent(source.rawText || '')
  }));

  return {
    client: {
      id: row.id,
      name: row.name
    },
    baseline: row.baselineId ? {
      id: row.baselineId,
      status: row.status,
      model: row.model,
      createdAt: row.createdAt,
      acceptedAt: row.acceptedAt,
      updatedAt: row.updatedAt,
      structured: parseJsonObject(row.structuredJson)
    } : null,
    undoCounts: getUndoCounts(row.baselineId),
    sources
  };
}

async function getPdfJsModule() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfJsModulePromise;
}

async function extractPdfText(filePath) {
  const pdfJs = await getPdfJsModule();
  const fileBuffer = await fsp.readFile(filePath);
  const loadingTask = pdfJs.getDocument({
    data: new Uint8Array(fileBuffer),
    disableWorker: true,
    verbosity: pdfJs.VerbosityLevel.ERRORS
  });
  const pdfDocument = await loadingTask.promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum += 1) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return normalizeTextContent(pages.join('\n\n'));
}

async function readImportText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const text = await extractPdfText(filePath);
    if (!text) {
      throw new Error('PDF contains no extractable text.');
    }
    return text;
  }
  return normalizeTextContent(await fsp.readFile(filePath, 'utf8'));
}

async function selectIntakeFiles() {
  const result = await dialog.showOpenDialog({
    title: 'Import Client Sources',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'CoachNotes sources', extensions: ['md', 'markdown', 'txt', 'pdf', 'csv', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return [];
  }

  const imported = [];
  for (const filePath of result.filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_IMPORT_EXTENSIONS.has(ext)) {
      imported.push({
        title: path.basename(filePath),
        originalPath: filePath,
        error: `Unsupported file type: ${ext || 'unknown'}`
      });
      continue;
    }

    try {
      imported.push({
        title: path.basename(filePath, ext),
        sourceType: ext === '.pdf' ? 'pdf' : 'notes',
        sourceDate: extractFilenameDate(filePath),
        originalPath: filePath,
        rawText: await readImportText(filePath)
      });
    } catch (error) {
      imported.push({
        title: path.basename(filePath),
        originalPath: filePath,
        error: error.message || 'Could not read file.'
      });
    }
  }

  return imported;
}

async function selectVaultFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Select CoachNotes Vault',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
}

async function revealVault() {
  const vaultFolder = await ensureVaultRootFolder();
  await shell.openPath(vaultFolder);
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    title: 'CoachNotes',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function setupIpc() {
  if (ipcRegistered) {
    return;
  }
  ipcRegistered = true;

  ipcMain.handle('app:get-state', async () => ({
    settings: {
      ...getAppSettings(),
      vaultFolder: await ensureVaultRootFolder()
    },
    clients: getClients()
  }));

  ipcMain.handle('app:save-settings', async (_event, payload) => {
    const vaultFolder = String(payload?.vaultFolder || '').trim();
    const proxyBaseUrl = normalizeProxyBaseUrl(payload?.proxyBaseUrl || '');
    if (vaultFolder) {
      await fsp.mkdir(vaultFolder, { recursive: true });
      setSetting('vaultFolder', vaultFolder);
    }
    if (proxyBaseUrl) {
      setSetting('proxyBaseUrl', proxyBaseUrl);
    }
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'inviteToken')) {
      setInviteToken(payload.inviteToken || '');
    }
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'coachTemplate')) {
      setSetting(COACH_TEMPLATE_SETTING_KEY, JSON.stringify(normalizeCoachTemplate(payload.coachTemplate)));
    }
    return {
      ...getAppSettings(),
      vaultFolder: await ensureVaultRootFolder()
    };
  });

  ipcMain.handle('app:select-vault-folder', async () => selectVaultFolder());
  ipcMain.handle('app:select-intake-files', async () => selectIntakeFiles());
  ipcMain.handle('app:generate-client-baseline', async (_event, payload) => generateClientBaseline(payload || {}));
  ipcMain.handle('app:accept-client-baseline', async (_event, payload) => acceptClientBaseline(payload || {}));
  ipcMain.handle('app:update-client-section', async (_event, payload) => updateClientSection(payload || {}));
  ipcMain.handle('app:update-client-sections', async (_event, payload) => updateClientSections(payload || {}));
  ipcMain.handle('app:undo-client-section', async (_event, payload) => undoClientSection(payload || {}));
  ipcMain.handle('app:update-client-from-note', async (_event, payload) => updateClientFromNote(payload || {}));
  ipcMain.handle('app:ask-client', async (_event, payload) => askClient(payload || {}));
  ipcMain.handle('app:save-ask-result-as-note', async (_event, payload) => saveAskResultAsNote(payload || {}));
  ipcMain.handle('app:delete-client', async (_event, payload) => deleteClient(payload || {}));
  ipcMain.handle('app:get-clients', async () => getClients());
  ipcMain.handle('app:get-client-detail', async (_event, payload) => getClientDetail(payload || {}));
  ipcMain.handle('app:reveal-vault', async () => revealVault());
}

app.whenReady().then(async () => {
  ensureDb();
  await ensureVaultRootFolder();
  setupIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
