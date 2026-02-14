const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const chokidar = require('chokidar');
const Database = require('better-sqlite3');
const matter = require('gray-matter');

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.markdown', '.pdf']);
const EDITABLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);
const KEYCHAIN_SERVICE = 'coachnotes-invite-token';
const KEYCHAIN_ACCOUNT = 'coachnotes';
const DELETED_NOTES_DIRNAME = 'Deleted Notes';
const CLIENT_PROFILE_FILE = '_client-profile.md';
const TAG_CATEGORY_SETTINGS_KEY = 'tagCategoriesConfig';
const DEFAULT_PROXY_URL = 'https://coach-notes-five.vercel.app';
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_ANSWER_MODEL = 'gpt-5-mini';
const UPDATE_REPO = process.env.COACHNOTES_UPDATE_REPO || 'AdamPallus/CoachNotes';
const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO}/releases`;
const UPDATE_RELEASE_API = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;

app.setName('CoachNotes');

let db;
let mainWindow;
let watcher;
let reindexTimer;
let indexing = false;
let reindexQueued = false;
let ipcRegistered = false;
let pdfJsModulePromise = null;
let statusState = {
  indexing: false,
  message: 'Not indexed yet.',
  progress: 0,
  filesProcessed: 0,
  totalFiles: 0,
  unsupportedCount: 0,
  unsupportedSummary: '',
  lastError: null,
  lastIndexedAt: null
};

function nowIso() {
  return new Date().toISOString();
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
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

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      date TEXT,
      raw_text TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      size INTEGER NOT NULL,
      sha1 TEXT NOT NULL,
      metadata_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_clients (
      note_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, client_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      note_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      embedding_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS note_overrides (
      note_id INTEGER PRIMARY KEY,
      clients_json TEXT,
      tags_json TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS llm_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      question_text TEXT NOT NULL,
      scope TEXT NOT NULL,
      retrieval_params TEXT,
      model TEXT,
      answer_text TEXT NOT NULL,
      citations TEXT
    );

    CREATE TABLE IF NOT EXISTS index_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      root_folder TEXT,
      status TEXT,
      last_error TEXT,
      indexed_files INTEGER DEFAULT 0,
      last_index_at TEXT
    );

    INSERT OR IGNORE INTO index_state (id, status, indexed_files)
    VALUES (1, 'idle', 0);
  `);
}

function ensureDbSafe() {
  if (db) {
    return true;
  }

  try {
    ensureDb();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateStatus({
      message: 'Database initialization failed.',
      lastError: message
    });
    return false;
  }
}

function requireDb() {
  if (!ensureDbSafe() || !db) {
    throw new Error('Local database unavailable. Run `npm --workspace apps/desktop run rebuild-native` and restart the app.');
  }
}

function setSetting(key, value) {
  if (!ensureDbSafe()) {
    throw new Error('Local database is unavailable.');
  }

  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value ?? null);
}

function getSetting(key, fallback = '') {
  if (!ensureDbSafe()) {
    return fallback;
  }

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

function getInviteToken() {
  const result = spawnSync(
    'security',
    ['find-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE, '-w'],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    return '';
  }

  return result.stdout.trim();
}

function setInviteToken(token) {
  const trimmed = (token || '').trim();
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
    rootFolder: getSetting('rootFolder', ''),
    proxyBaseUrl: getSetting('proxyBaseUrl', DEFAULT_PROXY_URL),
    inviteToken: getInviteToken()
  };
}

function slugifyCategoryId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTagCategoriesConfig(payload) {
  const source = Array.isArray(payload?.categories) ? payload.categories : [];
  const categories = [];
  const usedIds = new Set();
  const assignedTags = new Set();

  for (let i = 0; i < source.length; i += 1) {
    const row = source[i] || {};
    const name = sanitizeName(row.name || '');
    if (!name) {
      continue;
    }

    const idBase = slugifyCategoryId(row.id || name) || `category-${i + 1}`;
    let id = idBase;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const color = normalizeHexColor(row.color) || '#64748b';
    const rawTags = normalizeArray(row.tags || row.tagNames || []);
    const tags = [];
    for (const tag of rawTags) {
      const key = tag.toLowerCase();
      if (assignedTags.has(key)) {
        continue;
      }

      assignedTags.add(key);
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

function getTagCategoriesConfig() {
  if (!ensureDbSafe()) {
    return { categories: [] };
  }

  const raw = getSetting(TAG_CATEGORY_SETTINGS_KEY, '');
  if (!raw) {
    return { categories: [] };
  }

  try {
    return normalizeTagCategoriesConfig(JSON.parse(raw));
  } catch {
    return { categories: [] };
  }
}

function saveTagCategoriesConfig(payload) {
  const normalized = normalizeTagCategoriesConfig(payload);
  setSetting(TAG_CATEGORY_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

function updateStatus(patch) {
  statusState = { ...statusState, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:status', statusState);
  }
}

function setDockIconIfAvailable() {
  if (process.platform !== 'darwin' || !app.dock?.setIcon) {
    return;
  }

  const iconCandidates = [
    path.join(__dirname, '..', 'build', 'icon_1024.png'),
    path.join(process.cwd(), 'build', 'icon_1024.png')
  ];

  for (const iconPath of iconCandidates) {
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
      return;
    }
  }
}

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugifyFileStem(value) {
  const normalized = sanitizeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'note';
}

function yamlQuote(value) {
  return `"${String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => sanitizeName(item)).filter(Boolean))];
  }

  if (typeof value === 'string') {
    return [...new Set(value.split(',').map((item) => sanitizeName(item)).filter(Boolean))];
  }

  return [];
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const short = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(short)) {
      return short;
    }

    const asDate = new Date(short);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString().slice(0, 10);
    }

    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return null;
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

function normalizeVersion(value) {
  const raw = String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0];

  const parts = raw
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  while (parts.length < 3) {
    parts.push(0);
  }

  return parts.slice(0, 3);
}

function compareVersions(left, right) {
  const a = normalizeVersion(left);
  const b = normalizeVersion(right);

  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) {
      return 1;
    }

    if (a[i] < b[i]) {
      return -1;
    }
  }

  return 0;
}

function extractFirstHeading(text) {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? sanitizeName(match[1]) : '';
}

function extractFilenameDate(filePath) {
  const match = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseHashtags(text) {
  const matches = text.match(/(?:^|\s)#([a-zA-Z0-9_-]+)/g) || [];
  return [...new Set(matches.map((entry) => entry.replace(/[#\s]/g, '').trim()).filter(Boolean))];
}

function isClientProfilePath(filePath) {
  return path.basename(String(filePath || '')).toLowerCase() === CLIENT_PROFILE_FILE.toLowerCase();
}

function parseMetadata(content, filePath, rootFolder) {
  let data = {};
  let body = content;

  try {
    const parsed = matter(content);
    data = parsed.data || {};
    body = parsed.content || content;
  } catch {
    data = {};
    body = content;
  }

  const inlineClients = [
    ...normalizeArray(data.clients),
    ...normalizeArray(data.client)
  ];

  const tags = [
    ...normalizeArray(data.tags),
    ...parseHashtags(body)
  ];

  const relativePath = path.relative(rootFolder, filePath);
  let firstSegment = '';
  if (relativePath && !relativePath.startsWith('..')) {
    const segments = relativePath.split(path.sep).filter(Boolean);
    // Only treat first segment as client when file is nested under a subfolder.
    if (segments.length > 1) {
      firstSegment = sanitizeName(segments[0]);
    }
  }

  const profilePath = isClientProfilePath(filePath);
  const title = profilePath
    ? 'Client Profile'
    : sanitizeName(data.title) || extractFirstHeading(body) || path.basename(filePath, path.extname(filePath));
  const profileDate = profilePath ? parseDate(data.updated_at || data.updatedAt) : null;

  return {
    title,
    date: profileDate || parseDate(data.date) || extractFilenameDate(filePath),
    inlineClients: [...new Set(inlineClients)],
    folderClient: firstSegment,
    tags: [...new Set(tags)],
    bodyText: body,
    frontmatter: data
  };
}

async function getUniqueFilePath(directory, baseStem, extension = '.md') {
  let suffix = 1;
  while (suffix < 10000) {
    const candidate = suffix === 1
      ? path.join(directory, `${baseStem}${extension}`)
      : path.join(directory, `${baseStem}-${suffix}${extension}`);

    try {
      await fsp.access(candidate, fs.constants.F_OK);
      suffix += 1;
    } catch {
      return candidate;
    }
  }

  throw new Error('Could not create a unique filename.');
}

function getClientFolderNames(rootFolder) {
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    return [];
  }

  const names = [];
  const entries = fs.readdirSync(rootFolder, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith('.')) {
      continue;
    }

    if (entry.name === DELETED_NOTES_DIRNAME) {
      continue;
    }

    const normalized = sanitizeName(entry.name).toLowerCase();
    if (normalized) {
      names.push(normalized);
    }
  }

  return names;
}

function findClientDirectory(rootFolder, clientRow) {
  const preferred = path.join(rootFolder, clientRow.display_name || '');
  if (clientRow.display_name && fs.existsSync(preferred) && fs.statSync(preferred).isDirectory()) {
    return preferred;
  }

  if (!rootFolder || !fs.existsSync(rootFolder)) {
    return preferred;
  }

  const entries = fs.readdirSync(rootFolder, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    if (entry.name === DELETED_NOTES_DIRNAME) {
      continue;
    }

    const normalized = sanitizeName(entry.name).toLowerCase();
    if (normalized === String(clientRow.name || '').toLowerCase()) {
      return path.join(rootFolder, entry.name);
    }
  }

  return preferred;
}

function normalizeFocusList(values, maxItems = 80) {
  return normalizeArray(values)
    .map((value) => sanitizeName(value))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseClientProfileContent(content) {
  let data = {};
  try {
    const parsed = matter(content);
    data = parsed.data || {};
  } catch {
    data = {};
  }

  return {
    topPriorities: normalizeFocusList(data.top_priorities || data.topPriorities || data.current_focus || data.currentFocus, 3),
    clientTags: normalizeFocusList(data.client_tags || data.clientTags || data.profile_tags || data.profileTags, 40),
    clientColor: normalizeHexColor(data.client_color || data.clientColor || data.color),
    ongoingMedicalConsiderations: normalizeFocusList(
      data.ongoing_medical_considerations
      || data.ongoingMedicalConsiderations
      || data.medical_considerations
      || data.medicalConsiderations
    ),
    acuteInjuries: normalizeFocusList(data.acute_injuries || data.acuteInjuries),
    completedFocus: normalizeFocusList(data.completed_focus || data.completedFocus),
    futureFocus: normalizeFocusList(data.future_focus || data.futureFocus),
    updatedAt: parseDate(data.updated_at || data.updatedAt) || null
  };
}

function inferProfileClientName(rawText, metadata) {
  const folderClient = sanitizeName(metadata?.folderClient || '');
  if (folderClient) {
    return folderClient;
  }

  const inlineClient = sanitizeName(metadata?.inlineClients?.[0] || '');
  if (inlineClient) {
    return inlineClient;
  }

  const heading = sanitizeName(extractFirstHeading(rawText));
  if (!heading) {
    return '';
  }

  return heading.replace(/\s+focus profile$/i, '').trim();
}

function buildClientProfileIndexText(rawText, metadata, parsedProfile) {
  const profile = parsedProfile || parseClientProfileContent(rawText);
  const clientName = inferProfileClientName(rawText, metadata) || 'Unknown client';

  function listLine(label, values) {
    const items = normalizeFocusList(values || []);
    return `${label}: ${items.length ? items.join(', ') : '(none)'}`;
  }

  const lines = [
    'Document: Client Profile',
    `Client: ${clientName}`,
    listLine('Tags', profile.clientTags),
    listLine('Top Priorities', profile.topPriorities),
    listLine('Ongoing Medical Considerations', profile.ongoingMedicalConsiderations),
    listLine('Acute Injuries', profile.acuteInjuries),
    listLine('Completed Focus', profile.completedFocus),
    listLine('Future Focus', profile.futureFocus)
  ];

  if (profile.updatedAt) {
    lines.push(`Profile Updated: ${profile.updatedAt}`);
  }

  return lines.join('\n');
}

function buildClientProfileContent({
  clientName,
  topPriorities,
  clientTags,
  clientColor,
  ongoingMedicalConsiderations,
  acuteInjuries,
  completedFocus,
  futureFocus,
  updatedAt
}) {
  const lines = ['---'];

  function appendList(key, items) {
    lines.push(`${key}:`);
    if (!items.length) {
      lines.push('  []');
      return;
    }

    for (const item of items) {
      lines.push(`  - ${yamlQuote(item)}`);
    }
  }

  appendList('top_priorities', topPriorities);
  appendList('client_tags', clientTags);
  lines.push(`client_color: ${yamlQuote(clientColor)}`);
  appendList('ongoing_medical_considerations', ongoingMedicalConsiderations);
  appendList('acute_injuries', acuteInjuries);
  appendList('completed_focus', completedFocus);
  appendList('future_focus', futureFocus);
  lines.push(`updated_at: ${yamlQuote(updatedAt)}`);
  lines.push('---', '', `# ${clientName} Focus Profile`, '', 'Managed by CoachNotes.');
  return `${lines.join('\n')}\n`;
}

function buildStructuredNoteContent({ title, noteDate, clientName, tags, body }) {
  const frontmatterLines = [
    '---',
    `date: ${yamlQuote(noteDate)}`,
    `tags: [${tags.map((tag) => yamlQuote(tag)).join(', ')}]`
  ];

  if (clientName) {
    frontmatterLines.splice(1, 0, `client: ${yamlQuote(clientName)}`);
  }

  frontmatterLines.push('---', '', `# ${title}`, '');
  return `${frontmatterLines.join('\n')}${body ? `${body}\n` : ''}`;
}

function buildChunks(text, targetSize = 2200, maxSize = 3200, overlap = 300) {
  const source = String(text || '');
  const chunks = [];
  if (!source.trim()) {
    return chunks;
  }

  let start = 0;
  let guard = 0;

  while (start < source.length && guard < 10000) {
    guard += 1;
    const tentative = Math.min(start + targetSize, source.length);
    let end = tentative;

    if (end < source.length) {
      const forwardWindowEnd = Math.min(start + maxSize, source.length);
      const forwardSlice = source.slice(tentative, forwardWindowEnd);
      const forwardBreak = forwardSlice.search(/\n{2,}/);

      if (forwardBreak >= 0) {
        end = tentative + forwardBreak + 2;
      } else {
        const backSlice = source.slice(start, tentative);
        const backBreak = backSlice.lastIndexOf('\n\n');
        if (backBreak > targetSize * 0.4) {
          end = start + backBreak + 2;
        }
      }
    }

    const raw = source.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed) {
      const leftTrim = raw.indexOf(trimmed);
      const chunkStart = start + (leftTrim >= 0 ? leftTrim : 0);
      const chunkEnd = chunkStart + trimmed.length;
      chunks.push({
        content: trimmed,
        startOffset: chunkStart,
        endOffset: chunkEnd
      });
    }

    if (end >= source.length) {
      break;
    }

    const nextStart = Math.max(end - overlap, start + 1);
    start = nextStart;
  }

  if (chunks.length === 0) {
    chunks.push({
      content: source.trim(),
      startOffset: 0,
      endOffset: source.trim().length
    });
  }

  return chunks;
}

function buildUnsupportedSummary(counterMap) {
  const entries = [...counterMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `${ext} (${count})`);

  return entries.join(', ');
}

function normalizeTextContent(input) {
  return String(input || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

async function readNoteText(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') {
    const text = normalizeTextContent(await extractPdfText(filePath));
    if (!text) {
      throw new Error('PDF contains no extractable text.');
    }

    return text;
  }

  const raw = await fsp.readFile(filePath, 'utf8');
  return normalizeTextContent(raw);
}

async function scanNoteFiles(rootFolder) {
  const supported = [];
  let unsupportedCount = 0;
  const unsupportedByExt = new Map();

  async function walk(currentPath) {
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === DELETED_NOTES_DIRNAME) {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        supported.push(fullPath);
      } else {
        unsupportedCount += 1;
        const key = ext || '(no extension)';
        unsupportedByExt.set(key, (unsupportedByExt.get(key) || 0) + 1);
      }
    }
  }

  await walk(rootFolder);
  return {
    supported,
    unsupportedCount,
    unsupportedSummary: buildUnsupportedSummary(unsupportedByExt)
  };
}

function ensureClient(name) {
  const normalized = sanitizeName(name);
  if (!normalized) {
    return null;
  }

  db.prepare(
    `INSERT INTO clients (name, display_name) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET display_name = excluded.display_name`
  ).run(normalized.toLowerCase(), normalized);

  const row = db.prepare('SELECT id FROM clients WHERE name = ?').get(normalized.toLowerCase());
  return row?.id ?? null;
}

function ensureTag(name) {
  const normalized = sanitizeName(name);
  if (!normalized) {
    return null;
  }

  db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING').run(normalized.toLowerCase());
  const row = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalized.toLowerCase());
  return row?.id ?? null;
}

async function callProxy(endpoint, payload, settings) {
  const baseUrl = (settings.proxyBaseUrl || '').trim().replace(/\/$/, '');
  const token = (settings.inviteToken || '').trim();
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

async function embedTexts(inputs, settings) {
  const vectors = new Map();
  const batchSize = 32;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const payload = {
      model: DEFAULT_EMBED_MODEL,
      inputs: batch.map((item) => ({ id: item.id, text: item.text }))
    };

    const result = await callProxy('/embed', payload, settings);
    for (const row of result.data || []) {
      if (row.id && Array.isArray(row.embedding)) {
        vectors.set(row.id, row.embedding);
      }
    }
  }

  return vectors;
}

async function verifyEmbeddingProxy(settings) {
  if (!settings?.proxyBaseUrl || !settings?.inviteToken) {
    return {
      ok: false,
      error: 'Proxy URL or invite token is missing in Settings.'
    };
  }

  try {
    await callProxy(
      '/embed',
      {
        model: DEFAULT_EMBED_MODEL,
        inputs: [{ id: 'healthcheck', text: 'proxy check' }]
      },
      settings
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

function keywordScore(text, title, terms) {
  if (terms.length === 0) {
    return 0;
  }

  const corpus = `${title || ''}\n${text || ''}`.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (!term) {
      continue;
    }

    if (corpus.includes(term)) {
      hits += 1;
    }
  }

  return hits / terms.length;
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function buildSnippet(text, query) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }

  const lower = clean.toLowerCase();
  const token = String(query || '').toLowerCase().split(/\s+/).find((part) => part.length > 2);
  if (!token) {
    return clean.slice(0, 220);
  }

  const index = lower.indexOf(token);
  if (index < 0) {
    return clean.slice(0, 220);
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(clean.length, index + 180);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function parseRelevanceMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'narrow' || normalized === 'wide') {
    return normalized;
  }

  return 'default';
}

function relevanceProfile(mode) {
  const profiles = {
    narrow: {
      relativeToBest: 0.68,
      absoluteFloor: 0.18,
      keywordFloor: 0.5
    },
    default: {
      relativeToBest: 0.52,
      absoluteFloor: 0.1,
      keywordFloor: 0.25
    },
    wide: {
      relativeToBest: 0.34,
      absoluteFloor: 0.03,
      keywordFloor: 0.12
    }
  };

  return profiles[parseRelevanceMode(mode)];
}

function isTimeoutLikeError(error) {
  const message = String(error?.message || error || '');
  return /FUNCTION_INVOCATION_TIMEOUT|timeout|timed out/i.test(message);
}

async function upsertFileIndex(filePath, stat, rootFolder, appSettings, forceRebuild = false, diagnostics = null) {
  const rawText = await readNoteText(filePath);
  const hash = sha1(rawText);
  const mtimeMs = Math.floor(stat.mtimeMs);
  const existing = db
    .prepare('SELECT id, sha1 FROM notes WHERE path = ?')
    .get(filePath);

  if (existing && existing.sha1 === hash && !forceRebuild) {
    db.prepare('UPDATE notes SET mtime_ms = ?, size = ?, updated_at = ? WHERE id = ?').run(
      mtimeMs,
      stat.size,
      nowIso(),
      existing.id
    );
    return false;
  }

  const metadata = parseMetadata(rawText, filePath, rootFolder);
  if (isClientProfilePath(filePath)) {
    const profile = parseClientProfileContent(rawText);
    const profileClientName = inferProfileClientName(rawText, metadata);
    if (profileClientName && !metadata.inlineClients.length) {
      metadata.inlineClients = [profileClientName];
    }
    if (profileClientName) {
      metadata.folderClient = profileClientName;
    }
    metadata.title = 'Client Profile';
    metadata.bodyText = buildClientProfileIndexText(rawText, metadata, profile);
  }

  if (existing) {
    db.prepare(
      `UPDATE notes
       SET title = ?, date = ?, raw_text = ?, mtime_ms = ?, size = ?, sha1 = ?, metadata_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      metadata.title,
      metadata.date,
      rawText,
      mtimeMs,
      stat.size,
      hash,
      JSON.stringify(metadata.frontmatter || {}),
      nowIso(),
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO notes (path, title, date, raw_text, mtime_ms, size, sha1, metadata_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      filePath,
      metadata.title,
      metadata.date,
      rawText,
      mtimeMs,
      stat.size,
      hash,
      JSON.stringify(metadata.frontmatter || {}),
      nowIso()
    );
  }

  const note = db.prepare('SELECT id FROM notes WHERE path = ?').get(filePath);
  if (!note) {
    throw new Error(`Failed to create note index for ${filePath}`);
  }

  const noteId = note.id;

  db.prepare('DELETE FROM note_clients WHERE note_id = ?').run(noteId);
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
  db.prepare('DELETE FROM chunks WHERE note_id = ?').run(noteId);

  const override = db.prepare('SELECT clients_json, tags_json FROM note_overrides WHERE note_id = ?').get(noteId);
  const hasOverrideClients = override && override.clients_json !== null;
  const hasOverrideTags = override && override.tags_json !== null;

  const overrideClients = hasOverrideClients ? normalizeArray(JSON.parse(override.clients_json || '[]')) : [];
  const overrideTags = hasOverrideTags ? normalizeArray(JSON.parse(override.tags_json || '[]')) : [];

  const resolvedClients = hasOverrideClients
    ? overrideClients
    : metadata.inlineClients.length
      ? metadata.inlineClients
      : metadata.folderClient
        ? [metadata.folderClient]
        : [];

  const resolvedTags = hasOverrideTags ? overrideTags : metadata.tags;

  for (const clientName of resolvedClients) {
    const clientId = ensureClient(clientName);
    if (clientId) {
      db.prepare('INSERT OR IGNORE INTO note_clients (note_id, client_id) VALUES (?, ?)').run(noteId, clientId);
    }
  }

  for (const tagName of resolvedTags) {
    const tagId = ensureTag(tagName);
    if (tagId) {
      db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId);
    }
  }

  const chunks = buildChunks(metadata.bodyText || rawText);
  const contextualChunks = chunks.map((chunk, idx) => {
    const chunkId = `${noteId}_chunk_${idx}`;
    const clientLabel = resolvedClients.length ? resolvedClients.join(', ') : 'Unknown';
    const dateLabel = metadata.date || 'Unknown date';
    const enrichedText = `Title: ${metadata.title}\nClient: ${clientLabel}\nDate: ${dateLabel}\n\n${chunk.content}`;
    return {
      id: chunkId,
      text: enrichedText,
      content: chunk.content,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      index: idx
    };
  });

  let embeddings = new Map();
  if (contextualChunks.length > 0 && appSettings.proxyBaseUrl && appSettings.inviteToken) {
    try {
      embeddings = await embedTexts(contextualChunks, appSettings);
    } catch (error) {
      if (diagnostics && !diagnostics.embeddingError) {
        diagnostics.embeddingError = error.message;
      }
    }
  }

  const insertChunk = db.prepare(
    `INSERT INTO chunks (id, note_id, chunk_index, content, start_offset, end_offset, embedding_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const chunk of contextualChunks) {
    const vector = embeddings.get(chunk.id) || null;
    insertChunk.run(
      chunk.id,
      noteId,
      chunk.index,
      chunk.content,
      chunk.startOffset,
      chunk.endOffset,
      vector ? JSON.stringify(vector) : null,
      nowIso()
    );
  }

  return true;
}

function startWatching(rootFolder) {
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  if (!rootFolder || !fs.existsSync(rootFolder)) {
    return;
  }

  watcher = chokidar.watch(
    [
      path.join(rootFolder, '**/*.md'),
      path.join(rootFolder, '**/*.txt'),
      path.join(rootFolder, '**/*.markdown'),
      path.join(rootFolder, '**/*.pdf')
    ],
    {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 600,
        pollInterval: 100
      }
    }
  );

  const queue = () => {
    if (reindexTimer) {
      clearTimeout(reindexTimer);
    }

    reindexTimer = setTimeout(() => {
      runIndex('watcher');
    }, 1200);
  };

  watcher.on('add', queue);
  watcher.on('change', queue);
  watcher.on('unlink', queue);
}

function pruneOrphans() {
  if (!db) {
    return;
  }

  const rootFolder = getSetting('rootFolder', '');
  const folderNames = getClientFolderNames(rootFolder);
  if (folderNames.length) {
    const placeholders = folderNames.map(() => '?').join(', ');
    db.prepare(
      `DELETE FROM clients
       WHERE id NOT IN (SELECT DISTINCT client_id FROM note_clients)
         AND name NOT IN (${placeholders})`
    ).run(...folderNames);
  } else {
    db.prepare('DELETE FROM clients WHERE id NOT IN (SELECT DISTINCT client_id FROM note_clients)').run();
  }

  db.prepare('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)').run();
}

async function runIndex(reason = 'manual', forceRebuild = false) {
  requireDb();

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;

  if (!rootFolder || !fs.existsSync(rootFolder)) {
    updateStatus({
      indexing: false,
      message: 'Select a root notes folder to start indexing.',
      progress: 0
    });
    return { indexed: 0, changed: 0 };
  }

  if (indexing) {
    reindexQueued = true;
    return { indexed: 0, changed: 0, queued: true };
  }

  indexing = true;
  updateStatus({
    indexing: true,
    message: `Indexing (${reason})...`,
    progress: 0,
    filesProcessed: 0,
    totalFiles: 0,
    unsupportedCount: 0,
    unsupportedSummary: '',
    lastError: null
  });

  try {
    const scan = await scanNoteFiles(rootFolder);
    const files = scan.supported;
    const fileErrors = [];
    const diagnostics = { embeddingError: null };
    const existingNotes = db
      .prepare('SELECT id, path, mtime_ms, size FROM notes')
      .all();

    const existingByPath = new Map(existingNotes.map((row) => [row.path, row]));
    const liveSet = new Set(files);

    for (const row of existingNotes) {
      if (!liveSet.has(row.path)) {
        db.prepare('DELETE FROM notes WHERE id = ?').run(row.id);
      }
    }

    let changedFiles = 0;
    for (let i = 0; i < files.length; i += 1) {
      const filePath = files[i];
      const stat = await fsp.stat(filePath);
      const existing = existingByPath.get(filePath);
      const mtimeMs = Math.floor(stat.mtimeMs);

      const shouldSkip = !forceRebuild && existing && existing.mtime_ms === mtimeMs && existing.size === stat.size;
      if (!shouldSkip) {
        try {
          const changed = await upsertFileIndex(filePath, stat, rootFolder, settings, forceRebuild, diagnostics);
          if (changed) {
            changedFiles += 1;
          }
        } catch (error) {
          const basename = path.basename(filePath);
          fileErrors.push(`${basename}: ${error.message}`);
          updateStatus({
            lastError: fileErrors[fileErrors.length - 1]
          });
        }
      }

      updateStatus({
        filesProcessed: i + 1,
        totalFiles: files.length,
        progress: files.length ? (i + 1) / files.length : 1
      });
    }

    pruneOrphans();

    db.prepare(
      `UPDATE index_state
       SET root_folder = ?, status = ?, last_error = NULL, indexed_files = ?, last_index_at = ?
       WHERE id = 1`
    ).run(rootFolder, fileErrors.length ? 'up_to_date_with_errors' : 'up_to_date', files.length, nowIso());

    const errorSummary = fileErrors.length
      ? ` ${fileErrors.length} files failed to index.`
      : '';
    const embeddingSummary = diagnostics.embeddingError
      ? ' Embeddings unavailable: running keyword-only fallback until proxy/auth is fixed.'
      : '';

    updateStatus({
      indexing: false,
      message: `Up to date. Indexed ${files.length} notes (${changedFiles} changed).${errorSummary}${embeddingSummary}`,
      progress: 1,
      unsupportedCount: scan.unsupportedCount,
      unsupportedSummary: scan.unsupportedSummary,
      lastIndexedAt: nowIso(),
      lastError: fileErrors[0] || diagnostics.embeddingError || null
    });

    return {
      indexed: files.length,
      changed: changedFiles,
      errors: fileErrors,
      embeddingError: diagnostics.embeddingError
    };
  } catch (error) {
    if (db) {
      db.prepare(
        `UPDATE index_state
         SET status = ?, last_error = ?, last_index_at = ?
         WHERE id = 1`
      ).run('error', error.message, nowIso());
    }

    updateStatus({
      indexing: false,
      message: 'Indexing failed.',
      lastError: error.message
    });
    throw error;
  } finally {
    indexing = false;

    if (reindexQueued) {
      reindexQueued = false;
      setTimeout(() => {
        runIndex('queued', false).catch(() => {});
      }, 200);
    }
  }
}

async function waitForIndexIdle(timeoutMs = 180000) {
  const started = Date.now();
  while (indexing) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for indexing to finish.');
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function queryCandidates(scope, clientId, tags) {
  if (!db) {
    return [];
  }

  const where = [];
  const params = [];

  if (scope === 'client' && clientId) {
    where.push('EXISTS (SELECT 1 FROM note_clients x WHERE x.note_id = n.id AND x.client_id = ?)');
    params.push(clientId);
  }

  const normalizedTags = normalizeArray(tags).map((value) => value.toLowerCase());
  if (normalizedTags.length) {
    const placeholders = normalizedTags.map(() => '?').join(', ');
    where.push(
      `EXISTS (
        SELECT 1 FROM note_tags nt
        JOIN tags t ON t.id = nt.tag_id
        WHERE nt.note_id = n.id AND t.name IN (${placeholders})
      )`
    );
    params.push(...normalizedTags);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT
        c.id AS chunk_id,
        c.content,
        c.start_offset,
        c.end_offset,
        c.embedding_json,
        n.id AS note_id,
        n.path AS note_path,
        n.title AS note_title,
        n.date AS note_date,
        COALESCE(GROUP_CONCAT(DISTINCT cl.display_name), '') AS client_names
      FROM chunks c
      JOIN notes n ON n.id = c.note_id
      LEFT JOIN note_clients nc ON nc.note_id = n.id
      LEFT JOIN clients cl ON cl.id = nc.client_id
      ${whereSql}
      GROUP BY c.id`
    )
    .all(...params);
}

async function runSearch(payload) {
  const query = String(payload?.query || '').trim();
  const scope = payload?.scope === 'client' ? 'client' : 'all';
  const clientId = payload?.clientId ? Number(payload.clientId) : null;
  const limit = Math.max(1, Math.min(Number(payload?.limit) || 30, 50));
  const tags = payload?.tags || [];
  const relevanceMode = parseRelevanceMode(payload?.relevanceMode);
  const relevance = relevanceProfile(relevanceMode);

  if (!query) {
    return [];
  }

  const candidates = queryCandidates(scope, clientId, tags);
  if (!candidates.length) {
    return [];
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

  let queryEmbedding = null;
  const settings = getAppSettings();

  if (settings.proxyBaseUrl && settings.inviteToken) {
    try {
      const response = await callProxy(
        '/embed',
        {
          model: DEFAULT_EMBED_MODEL,
          inputs: [{ id: 'query', text: query }]
        },
        settings
      );

      const found = (response.data || []).find((entry) => entry.id === 'query');
      queryEmbedding = found?.embedding || null;
    } catch {
      queryEmbedding = null;
    }
  }

  const scored = candidates.map((row) => {
    const keyword = keywordScore(row.content, row.note_title, terms);
    const vector = row.embedding_json ? JSON.parse(row.embedding_json) : null;
    const semantic = queryEmbedding && vector ? cosineSimilarity(queryEmbedding, vector) : 0;
    const score = queryEmbedding ? semantic * 0.88 + keyword * 0.12 : keyword;

    return {
      chunkId: row.chunk_id,
      noteId: row.note_id,
      notePath: row.note_path,
      title: isClientProfilePath(row.note_path) ? 'Client Profile' : row.note_title,
      date: row.note_date,
      clientNames: row.client_names ? row.client_names.split(',').filter(Boolean) : [],
      snippet: buildSnippet(row.content, query),
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      chunkText: row.content,
      keyword,
      semantic,
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) {
    return [];
  }

  const topScore = scored[0].score;
  let filtered;
  const hasSemanticCoverage = Boolean(queryEmbedding) && scored.some((entry) => Math.abs(entry.semantic) > 0.00001);
  if (hasSemanticCoverage) {
    const floor = Math.max(relevance.absoluteFloor, topScore * relevance.relativeToBest);
    filtered = scored.filter((entry) => entry.score >= floor);
  } else {
    filtered = scored.filter((entry) => entry.keyword >= relevance.keywordFloor);
  }

  const finalRows = (filtered.length ? filtered : [scored[0]]).slice(0, limit);
  return finalRows.map((entry) => {
    const { keyword, semantic, ...rest } = entry;
    void keyword;
    void semantic;
    return rest;
  });
}

async function runAsk(payload) {
  const question = String(payload?.question || '').trim();
  if (!question) {
    throw new Error('Question is required.');
  }

  const scope = payload?.scope === 'client' ? 'client' : 'all';
  const clientId = payload?.clientId ? Number(payload.clientId) : null;
  const maxSources = Math.max(3, Math.min(Number(payload?.topK) || 8, 12));
  const relevanceMode = parseRelevanceMode(payload?.relevanceMode);

  const results = await runSearch({
    query: question,
    scope,
    clientId,
    limit: maxSources,
    relevanceMode
  });

  if (!results.length) {
    const answer = 'Not found in the provided notes.';
    db.prepare(
      `INSERT INTO llm_answers (created_at, question_text, scope, retrieval_params, model, answer_text, citations)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nowIso(),
      question,
      scope,
      JSON.stringify({ topK: maxSources, relevanceMode }),
      DEFAULT_ANSWER_MODEL,
      answer,
      JSON.stringify([])
    );

    return {
      model: DEFAULT_ANSWER_MODEL,
      answer,
      citations: [],
      structured: { bullets: [answer], warnings: [] },
      sources: []
    };
  }

  const settings = getAppSettings();
  const sources = results.map((item) => ({
    chunk_id: item.chunkId,
    note_id: `note_${item.noteId}`,
    client_ids: item.clientNames,
    title: item.title,
    date: item.date,
    text: item.chunkText
  }));

  let response;
  let fallbackUsed = false;
  try {
    response = await callProxy(
      '/answer',
      {
        model: DEFAULT_ANSWER_MODEL,
        question,
        instructions: payload?.instructions || '',
        sources,
        response_format: 'coachnotes.v1'
      },
      settings
    );
  } catch (error) {
    if (!isTimeoutLikeError(error)) {
      throw error;
    }

    fallbackUsed = true;
    const reducedSources = sources
      .slice(0, Math.min(4, sources.length))
      .map((source) => ({
        ...source,
        text: String(source.text || '').slice(0, 1800)
      }));

    try {
      response = await callProxy(
        '/answer',
        {
          model: DEFAULT_ANSWER_MODEL,
          question,
          instructions: 'Answer concisely from the provided sources only.',
          sources: reducedSources,
          response_format: 'coachnotes.v1'
        },
        settings
      );
    } catch (retryError) {
      if (!isTimeoutLikeError(retryError)) {
        throw retryError;
      }

      const timeoutAnswer = 'Answer timed out on the server. Try a more specific question or lower AI source depth.';
      response = {
        model: DEFAULT_ANSWER_MODEL,
        answer: timeoutAnswer,
        citations: [],
        structured: {
          bullets: [timeoutAnswer],
          warnings: ['Request timed out in proxy function.']
        }
      };
    }
  }

  db.prepare(
    `INSERT INTO llm_answers (created_at, question_text, scope, retrieval_params, model, answer_text, citations)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nowIso(),
    question,
    scope,
    JSON.stringify({ topK: maxSources, relevanceMode, fallbackUsed }),
    response.model || DEFAULT_ANSWER_MODEL,
    response.answer || '',
    JSON.stringify(response.citations || [])
  );

  return {
    ...response,
    fallbackUsed,
    sources: results.map((item) => ({
      chunkId: item.chunkId,
      title: item.title,
      date: item.date,
      clientNames: item.clientNames,
      snippet: item.snippet,
      noteId: item.noteId,
      startOffset: item.startOffset,
      endOffset: item.endOffset
    }))
  };
}

async function runSummarize(payload) {
  const query = String(payload?.query || '').trim();
  if (!query) {
    throw new Error('Summary query is required.');
  }

  const scope = payload?.scope === 'client' ? 'client' : 'all';
  const clientId = payload?.clientId ? Number(payload.clientId) : null;
  const topK = Math.max(3, Math.min(Number(payload?.topK) || 8, 12));
  const relevanceMode = parseRelevanceMode(payload?.relevanceMode);
  const providedResults = Array.isArray(payload?.retrieved)
    ? payload.retrieved
      .map((row) => ({
        chunkId: String(row?.chunkId || '').trim(),
        noteId: Number(row?.noteId),
        title: String(row?.title || ''),
        date: String(row?.date || ''),
        clientNames: Array.isArray(row?.clientNames) ? row.clientNames.map((name) => String(name || '')) : [],
        snippet: String(row?.snippet || ''),
        startOffset: Number(row?.startOffset),
        endOffset: Number(row?.endOffset),
        chunkText: String(row?.chunkText || '')
      }))
      .filter((row) => row.chunkId && row.chunkText)
      .slice(0, topK)
    : [];

  const results = providedResults.length
    ? providedResults
    : await runSearch({
      query,
      scope,
      clientId,
      limit: topK,
      relevanceMode
    });
  const summarizeSources = results.map((item) => ({
    chunk_id: item.chunkId,
    text: item.chunkText
  }));

  if (!summarizeSources.length) {
    return {
      model: DEFAULT_ANSWER_MODEL,
      summary: 'Not found in the provided notes.',
      citations: [],
      sources: []
    };
  }

  const settings = getAppSettings();
  const answerSources = results.map((item) => ({
    chunk_id: item.chunkId,
    note_id: `note_${item.noteId}`,
    client_ids: item.clientNames,
    title: item.title,
    date: item.date,
    text: item.chunkText
  }));

  let response;
  let fallbackUsed = false;
  try {
    response = await callProxy(
      '/summarize',
      {
        model: DEFAULT_ANSWER_MODEL,
        mode: 'search_results_summary',
        sources: summarizeSources
      },
      settings
    );
  } catch (error) {
    const message = String(error?.message || error || '');
    const isTimeout = /FUNCTION_INVOCATION_TIMEOUT|timeout|timed out/i.test(message);
    if (!isTimeout) {
      throw error;
    }

    fallbackUsed = true;
    const fallback = await callProxy(
      '/answer',
      {
        model: DEFAULT_ANSWER_MODEL,
        question: `Summarize these notes for query: ${query}`,
        instructions: 'Provide a concise summary with citations for each major point.',
        sources: answerSources,
        response_format: 'coachnotes.v1'
      },
      settings
    );

    response = {
      model: fallback.model || DEFAULT_ANSWER_MODEL,
      summary: fallback.answer || 'Not found in the provided notes.',
      citations: fallback.citations || []
    };
  }

  return {
    ...response,
    fallbackUsed,
    sources: results.map((item) => ({
      chunkId: item.chunkId,
      title: item.title,
      date: item.date,
      clientNames: item.clientNames,
      snippet: item.snippet,
      noteId: item.noteId,
      startOffset: item.startOffset,
      endOffset: item.endOffset
    }))
  };
}

async function createNote(payload) {
  requireDb();

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    throw new Error('Set a valid root notes folder before creating notes.');
  }

  const noteDate = parseDate(payload?.date) || new Date().toISOString().slice(0, 10);
  const clientName = sanitizeName(payload?.clientName || '');
  const title = sanitizeName(payload?.title || '') || `Session ${noteDate}`;
  const tags = normalizeArray(payload?.tags || []);
  const body = String(payload?.body || '').replace(/\r\n/g, '\n').trimEnd();

  const noteDirectory = clientName ? path.join(rootFolder, clientName) : rootFolder;
  await fsp.mkdir(noteDirectory, { recursive: true });

  const stem = `${noteDate}-${slugifyFileStem(title)}`.slice(0, 120);
  const filePath = await getUniqueFilePath(noteDirectory, stem, '.md');
  const content = buildStructuredNoteContent({
    title,
    noteDate,
    clientName,
    tags,
    body
  });
  await fsp.writeFile(filePath, content, 'utf8');

  const stat = await fsp.stat(filePath);
  await upsertFileIndex(filePath, stat, rootFolder, settings, true);
  pruneOrphans();

  const note = db.prepare('SELECT id, path, title, date FROM notes WHERE path = ?').get(filePath);
  if (!note) {
    throw new Error('Note file was created but indexing failed.');
  }

  return {
    noteId: note.id,
    path: note.path,
    title: note.title,
    date: note.date,
    clientName,
    tags
  };
}

async function createClient(payload) {
  requireDb();

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    throw new Error('Set a valid root notes folder before creating clients.');
  }

  const clientName = sanitizeName(payload?.name || '');
  if (!clientName) {
    throw new Error('Client name is required.');
  }

  const clientDirectory = path.join(rootFolder, clientName);
  await fsp.mkdir(clientDirectory, { recursive: true });
  const clientId = ensureClient(clientName);

  return {
    id: clientId,
    name: clientName,
    noteCount: 0,
    path: clientDirectory
  };
}

async function updateNote(payload) {
  requireDb();

  const noteId = Number(payload?.noteId);
  if (!Number.isFinite(noteId)) {
    throw new Error('noteId is required.');
  }

  const existing = db
    .prepare('SELECT id, path, title, date FROM notes WHERE id = ?')
    .get(noteId);
  if (!existing) {
    throw new Error('Note not found.');
  }

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    throw new Error('Set a valid root notes folder before editing notes.');
  }

  const currentPath = existing.path;
  const extension = path.extname(currentPath).toLowerCase();
  if (!EDITABLE_EXTENSIONS.has(extension)) {
    throw new Error(`Editing is supported for ${[...EDITABLE_EXTENSIONS].join(', ')} files only.`);
  }

  const noteDate = parseDate(payload?.date) || parseDate(existing.date) || new Date().toISOString().slice(0, 10);
  const clientName = sanitizeName(payload?.clientName || '');
  const title = sanitizeName(payload?.title || '') || sanitizeName(existing.title) || `Session ${noteDate}`;
  const tags = normalizeArray(payload?.tags || []);
  const body = String(payload?.body || '').replace(/\r\n/g, '\n').trimEnd();

  const targetDirectory = clientName ? path.join(rootFolder, clientName) : rootFolder;
  await fsp.mkdir(targetDirectory, { recursive: true });

  const stem = `${noteDate}-${slugifyFileStem(title)}`.slice(0, 120);
  const desiredPath = path.join(targetDirectory, `${stem}${extension}`);
  let targetPath = desiredPath;
  if (path.resolve(desiredPath) !== path.resolve(currentPath)) {
    try {
      await fsp.access(desiredPath, fs.constants.F_OK);
      targetPath = await getUniqueFilePath(targetDirectory, stem, extension);
    } catch {
      targetPath = desiredPath;
    }
  }

  const content = buildStructuredNoteContent({
    title,
    noteDate,
    clientName,
    tags,
    body
  });
  await fsp.writeFile(targetPath, content, 'utf8');
  if (path.resolve(targetPath) !== path.resolve(currentPath) && fs.existsSync(currentPath)) {
    await fsp.unlink(currentPath);
  }

  const stat = await fsp.stat(targetPath);
  await upsertFileIndex(targetPath, stat, rootFolder, settings, true);
  if (path.resolve(targetPath) !== path.resolve(currentPath)) {
    db.prepare('DELETE FROM notes WHERE path = ?').run(currentPath);
  }
  pruneOrphans();

  const note = db.prepare('SELECT id, path, title, date FROM notes WHERE path = ?').get(targetPath);
  if (!note) {
    throw new Error('Note was updated but indexing failed.');
  }

  return {
    noteId: note.id,
    path: note.path,
    title: note.title,
    date: note.date,
    clientName,
    tags
  };
}

async function deleteNote(payload) {
  requireDb();

  const noteId = Number(payload?.noteId);
  if (!Number.isFinite(noteId)) {
    throw new Error('noteId is required.');
  }

  const note = db
    .prepare('SELECT id, path, title FROM notes WHERE id = ?')
    .get(noteId);
  if (!note) {
    throw new Error('Note not found.');
  }

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    throw new Error('Set a valid root notes folder before deleting notes.');
  }

  const relativePath = path.relative(rootFolder, note.path);
  if (!relativePath || relativePath.startsWith('..')) {
    throw new Error('Note is outside the configured root folder.');
  }

  const deletedRoot = path.join(rootFolder, DELETED_NOTES_DIRNAME);
  const relativeDir = path.dirname(relativePath);
  const targetDirectory = relativeDir === '.'
    ? deletedRoot
    : path.join(deletedRoot, relativeDir);
  await fsp.mkdir(targetDirectory, { recursive: true });

  const extension = path.extname(note.path);
  const baseName = path.basename(note.path, extension);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destinationPath = await getUniqueFilePath(
    targetDirectory,
    `${stamp}-${slugifyFileStem(baseName)}`,
    extension
  );

  await fsp.rename(note.path, destinationPath);
  db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
  pruneOrphans();

  return {
    noteId: note.id,
    title: note.title,
    movedTo: destinationPath
  };
}

async function getClientProfile(payload) {
  requireDb();

  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }

  const client = db.prepare('SELECT id, name, display_name FROM clients WHERE id = ?').get(clientId);
  if (!client) {
    throw new Error('Client not found.');
  }

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    throw new Error('Set a valid root notes folder before editing client profiles.');
  }

  const clientDirectory = findClientDirectory(rootFolder, client);
  const profilePath = path.join(clientDirectory, CLIENT_PROFILE_FILE);

  let parsed = {
    topPriorities: [],
    clientTags: [],
    clientColor: '',
    ongoingMedicalConsiderations: [],
    acuteInjuries: [],
    completedFocus: [],
    futureFocus: [],
    updatedAt: null
  };
  let exists = false;

  try {
    const content = await fsp.readFile(profilePath, 'utf8');
    parsed = parseClientProfileContent(content);
    exists = true;
  } catch {
    exists = false;
  }

  return {
    clientId: client.id,
    clientName: client.display_name,
    topPriorities: parsed.topPriorities,
    clientTags: parsed.clientTags,
    clientColor: parsed.clientColor,
    ongoingMedicalConsiderations: parsed.ongoingMedicalConsiderations,
    acuteInjuries: parsed.acuteInjuries,
    completedFocus: parsed.completedFocus,
    futureFocus: parsed.futureFocus,
    updatedAt: parsed.updatedAt,
    exists
  };
}

async function saveClientProfile(payload) {
  requireDb();

  const clientId = Number(payload?.clientId);
  if (!Number.isFinite(clientId)) {
    throw new Error('clientId is required.');
  }

  const client = db.prepare('SELECT id, name, display_name FROM clients WHERE id = ?').get(clientId);
  if (!client) {
    throw new Error('Client not found.');
  }

  const settings = getAppSettings();
  const rootFolder = settings.rootFolder;
  if (!rootFolder || !fs.existsSync(rootFolder)) {
    throw new Error('Set a valid root notes folder before editing client profiles.');
  }

  const topPriorities = normalizeFocusList(payload?.topPriorities, 3);
  if (normalizeArray(payload?.topPriorities).length > 3) {
    throw new Error('Top priorities is limited to 3 items.');
  }

  const clientTags = normalizeFocusList(payload?.clientTags, 40);
  const clientColor = normalizeHexColor(payload?.clientColor);
  const completedFocus = normalizeFocusList(payload?.completedFocus);
  const futureFocus = normalizeFocusList(payload?.futureFocus);
  const ongoingMedicalConsiderations = normalizeFocusList(payload?.ongoingMedicalConsiderations);
  const acuteInjuries = normalizeFocusList(payload?.acuteInjuries);
  const clientDirectory = findClientDirectory(rootFolder, client);
  await fsp.mkdir(clientDirectory, { recursive: true });
  const profilePath = path.join(clientDirectory, CLIENT_PROFILE_FILE);
  const updatedAt = nowIso();
  const content = buildClientProfileContent({
    clientName: client.display_name,
    topPriorities,
    clientTags,
    clientColor,
    ongoingMedicalConsiderations,
    acuteInjuries,
    completedFocus,
    futureFocus,
    updatedAt
  });
  await fsp.writeFile(profilePath, content, 'utf8');
  const stat = await fsp.stat(profilePath);
  await upsertFileIndex(profilePath, stat, rootFolder, settings, true);
  pruneOrphans();

  return {
    clientId: client.id,
    clientName: client.display_name,
    topPriorities,
    clientTags,
    clientColor,
    ongoingMedicalConsiderations,
    acuteInjuries,
    completedFocus,
    futureFocus,
    updatedAt: parseDate(updatedAt),
    exists: true
  };
}

async function removeProfileTag(payload) {
  requireDb();

  const tagName = sanitizeName(payload?.tagName || '');
  if (!tagName) {
    throw new Error('tagName is required.');
  }

  const allClients = db.prepare('SELECT id FROM clients ORDER BY id ASC').all();
  if (!allClients.length) {
    return { removedFromClients: 0 };
  }

  const target = tagName.toLowerCase();
  let removedFromClients = 0;

  for (const row of allClients) {
    const clientId = Number(row.id);
    if (!Number.isFinite(clientId)) {
      continue;
    }

    const profile = await getClientProfile({ clientId });
    const currentTags = normalizeFocusList(profile.clientTags || [], 40);
    if (!currentTags.some((tag) => String(tag).toLowerCase() === target)) {
      continue;
    }

    const nextTags = currentTags.filter((tag) => String(tag).toLowerCase() !== target);
    await saveClientProfile({
      clientId,
      topPriorities: profile.topPriorities || [],
      clientTags: nextTags,
      clientColor: profile.clientColor || '',
      ongoingMedicalConsiderations: profile.ongoingMedicalConsiderations || [],
      acuteInjuries: profile.acuteInjuries || [],
      completedFocus: profile.completedFocus || [],
      futureFocus: profile.futureFocus || []
    });
    removedFromClients += 1;
  }

  return { removedFromClients };
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();

  let response;
  try {
    response = await fetch(UPDATE_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CoachNotes Desktop'
      }
    });
  } catch (error) {
    throw new Error(`Could not reach GitHub releases: ${error.message}`);
  }

  if (response.status === 404) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: UPDATE_RELEASES_URL,
      releasesUrl: UPDATE_RELEASES_URL,
      message: 'No published release found yet.'
    };
  }

  if (!response.ok) {
    throw new Error(`GitHub release check failed (${response.status}).`);
  }

  const release = await response.json();
  const latestVersionRaw = release.tag_name || release.name || '';
  const latestVersion = latestVersionRaw.replace(/^v/i, '');
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl: release.html_url || UPDATE_RELEASES_URL,
    releasesUrl: UPDATE_RELEASES_URL,
    publishedAt: release.published_at || null,
    message: updateAvailable
      ? `Update available: v${latestVersion}`
      : `You are up to date (v${currentVersion}).`
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 700,
    title: 'CoachNotes',
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

  ipcMain.handle('app:get-settings', async () => {
    return {
      ...getAppSettings(),
      status: statusState
    };
  });

  ipcMain.handle('app:save-settings', async (_event, payload) => {
    const previous = getAppSettings();
    const rootFolder = payload?.rootFolder ? String(payload.rootFolder).trim() : '';
    const proxyBaseUrl = payload?.proxyBaseUrl ? String(payload.proxyBaseUrl).trim() : '';

    if (rootFolder) {
      setSetting('rootFolder', rootFolder);
    }

    if (proxyBaseUrl) {
      setSetting('proxyBaseUrl', proxyBaseUrl);
    }

    if (Object.prototype.hasOwnProperty.call(payload || {}, 'inviteToken')) {
      setInviteToken(payload.inviteToken || '');
    }

    const latest = getAppSettings();
    startWatching(latest.rootFolder);

    if (payload?.runIndexAfterSave) {
      const proxyCheck = await verifyEmbeddingProxy(latest);
      if (!proxyCheck.ok) {
        updateStatus({
          message: 'Proxy check failed: indexing will continue in keyword-only mode until fixed.',
          lastError: proxyCheck.error
        });
      }

      const forceFullReindex =
        Boolean(payload?.forceFullReindex) ||
        latest.rootFolder !== previous.rootFolder ||
        latest.proxyBaseUrl !== previous.proxyBaseUrl ||
        latest.inviteToken !== previous.inviteToken;
      const result = await runIndex('settings-update', forceFullReindex);
      if (result?.queued) {
        // If a prior index is in flight, guarantee one final pass with latest settings.
        await waitForIndexIdle();
        await runIndex('settings-update-followup', true);
      }
    }

    return latest;
  });

  ipcMain.handle('app:select-root-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Notes Folder',
      properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('app:reindex', async () => {
    requireDb();
    return runIndex('manual', true);
  });

  ipcMain.handle('app:get-clients', async () => {
    requireDb();
    const rows = db
      .prepare(
        `SELECT
          c.id,
          c.name AS key_name,
          c.display_name AS display_name,
          COUNT(DISTINCT CASE
            WHEN LOWER(REPLACE(COALESCE(n.path, ''), '\\', '/')) LIKE ? THEN NULL
            ELSE nc.note_id
          END) AS noteCount
         FROM clients c
         LEFT JOIN note_clients nc ON nc.client_id = c.id
         LEFT JOIN notes n ON n.id = nc.note_id
         GROUP BY c.id
         ORDER BY LOWER(c.display_name) ASC`
      )
      .all(`%/${CLIENT_PROFILE_FILE.toLowerCase()}`);

    const settings = getAppSettings();
    const rootFolder = settings.rootFolder;
    const canReadProfiles = Boolean(rootFolder && fs.existsSync(rootFolder));

    const enriched = await Promise.all(rows.map(async (row) => {
      let parsed = null;
      if (canReadProfiles) {
        const clientDirectory = findClientDirectory(rootFolder, {
          name: row.key_name,
          display_name: row.display_name
        });
        const profilePath = path.join(clientDirectory, CLIENT_PROFILE_FILE);
        try {
          const content = await fsp.readFile(profilePath, 'utf8');
          parsed = parseClientProfileContent(content);
        } catch {
          parsed = null;
        }
      }

      return {
        id: row.id,
        name: row.display_name,
        noteCount: Number(row.noteCount || 0),
        profileTags: parsed?.clientTags || [],
        color: parsed?.clientColor || ''
      };
    }));

    return enriched;
  });

  ipcMain.handle('app:get-client-profile', async (_event, payload) => {
    return getClientProfile(payload || {});
  });

  ipcMain.handle('app:save-client-profile', async (_event, payload) => {
    return saveClientProfile(payload || {});
  });

  ipcMain.handle('app:remove-profile-tag', async (_event, payload) => {
    return removeProfileTag(payload || {});
  });

  ipcMain.handle('app:get-tag-categories', async () => {
    requireDb();
    return getTagCategoriesConfig();
  });

  ipcMain.handle('app:save-tag-categories', async (_event, payload) => {
    requireDb();
    return saveTagCategoriesConfig(payload || {});
  });

  ipcMain.handle('app:get-tags', async () => {
    requireDb();
    return db
      .prepare(
        `SELECT t.name AS name, COUNT(DISTINCT nt.note_id) AS noteCount
         FROM tags t
         LEFT JOIN note_tags nt ON nt.tag_id = t.id
         GROUP BY t.id
         HAVING COUNT(DISTINCT nt.note_id) > 0
         ORDER BY LOWER(t.name) ASC`
      )
      .all();
  });

  ipcMain.handle('app:get-notes', async (_event, filters = {}) => {
    requireDb();
    const where = [];
    const params = [];

    where.push("LOWER(REPLACE(n.path, '\\', '/')) NOT LIKE ?");
    params.push(`%/${CLIENT_PROFILE_FILE.toLowerCase()}`);

    if (filters.clientId) {
      where.push('EXISTS (SELECT 1 FROM note_clients x WHERE x.note_id = n.id AND x.client_id = ?)');
      params.push(Number(filters.clientId));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    return db
      .prepare(
        `SELECT
          n.id,
          n.path,
          n.title,
          n.date,
          n.updated_at,
          COALESCE(GROUP_CONCAT(DISTINCT c.display_name), '') AS client_names,
          COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tags
         FROM notes n
         LEFT JOIN note_clients nc ON nc.note_id = n.id
         LEFT JOIN clients c ON c.id = nc.client_id
         LEFT JOIN note_tags nt ON nt.note_id = n.id
         LEFT JOIN tags t ON t.id = nt.tag_id
         ${whereSql}
         GROUP BY n.id
         ORDER BY COALESCE(n.date, n.updated_at) DESC, n.updated_at DESC`
      )
      .all(...params)
      .map((row) => ({
        id: row.id,
        path: row.path,
        title: row.title,
        date: row.date,
        updatedAt: row.updated_at,
        clients: row.client_names ? row.client_names.split(',').filter(Boolean) : [],
        tags: row.tags ? row.tags.split(',').filter(Boolean) : []
      }));
  });

  ipcMain.handle('app:get-note', async (_event, noteId) => {
    requireDb();
    const row = db
      .prepare(
        `SELECT n.id, n.path, n.title, n.date, n.raw_text,
          COALESCE(GROUP_CONCAT(DISTINCT c.display_name), '') AS client_names,
          COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tags
         FROM notes n
         LEFT JOIN note_clients nc ON nc.note_id = n.id
         LEFT JOIN clients c ON c.id = nc.client_id
         LEFT JOIN note_tags nt ON nt.note_id = n.id
         LEFT JOIN tags t ON t.id = nt.tag_id
         WHERE n.id = ?
         GROUP BY n.id`
      )
      .get(Number(noteId));

    if (!row) {
      return null;
    }

    const chunks = db
      .prepare('SELECT id, chunk_index, start_offset, end_offset, content FROM chunks WHERE note_id = ? ORDER BY chunk_index ASC')
      .all(Number(noteId));

    return {
      id: row.id,
      path: row.path,
      title: row.title,
      date: row.date,
      text: row.raw_text,
      clients: row.client_names ? row.client_names.split(',').filter(Boolean) : [],
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
      chunks
    };
  });

  ipcMain.handle('app:search', async (_event, payload) => {
    requireDb();
    return runSearch(payload);
  });

  ipcMain.handle('app:create-note', async (_event, payload) => {
    return createNote(payload || {});
  });

  ipcMain.handle('app:create-client', async (_event, payload) => {
    return createClient(payload || {});
  });

  ipcMain.handle('app:update-note', async (_event, payload) => {
    return updateNote(payload || {});
  });

  ipcMain.handle('app:delete-note', async (_event, payload) => {
    return deleteNote(payload || {});
  });

  ipcMain.handle('app:check-for-updates', async () => {
    return checkForUpdates();
  });

  ipcMain.handle('app:open-external', async (_event, url) => {
    const target = String(url || '').trim();
    if (!/^https?:\/\//i.test(target)) {
      throw new Error('Invalid URL.');
    }

    await shell.openExternal(target);
    return true;
  });

  ipcMain.handle('app:ask', async (_event, payload) => {
    requireDb();
    return runAsk(payload);
  });

  ipcMain.handle('app:summarize', async (_event, payload) => {
    requireDb();
    return runSummarize(payload);
  });

  ipcMain.handle('app:reveal-in-finder', async (_event, noteId) => {
    requireDb();
    const row = db.prepare('SELECT path FROM notes WHERE id = ?').get(Number(noteId));
    if (!row) {
      return false;
    }

    shell.showItemInFolder(row.path);
    return true;
  });
}

async function bootstrap() {
  setupIpc();
  ensureDbSafe();
  setDockIconIfAvailable();
  createWindow();

  const settings = getAppSettings();
  startWatching(settings.rootFolder);

  if (settings.rootFolder && ensureDbSafe()) {
    runIndex('startup').catch(() => {});
  } else {
    updateStatus({ message: 'Select a root notes folder to start indexing.' });
  }
}

app.whenReady().then(bootstrap);

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  updateStatus({
    message: 'Unexpected background error.',
    lastError: message
  });
});

app.on('window-all-closed', () => {
  if (watcher) {
    watcher.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
