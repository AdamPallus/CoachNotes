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
const BASELINE_SECTION_KEYS = new Set([
  'clientProfile',
  'overview',
  'coachTasks',
  'flags',
  'goalsValues',
  'coachingPlanApproach',
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
    inviteToken: getInviteToken()
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
        coachNotes: normalizeMultilineText(payload?.coachNotes || '', 2000)
      },
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

  const structured = response.structured && typeof response.structured === 'object' ? response.structured : {};
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
      tags: normalizeArray(structured.suggestedTags || [], 8),
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
  const nextStructured = {
    ...currentStructured,
    ...updatedBaseline
  };
  const changedSections = [...BASELINE_SECTION_KEYS].filter((sectionKey) => (
    Object.prototype.hasOwnProperty.call(nextStructured, sectionKey)
    && !jsonValuesEqual(currentStructured[sectionKey], nextStructured[sectionKey])
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
  ipcMain.handle('app:undo-client-section', async (_event, payload) => undoClientSection(payload || {}));
  ipcMain.handle('app:update-client-from-note', async (_event, payload) => updateClientFromNote(payload || {}));
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
