const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { buildWeeklyReviewContext } = require('../src/weekly-review');
const { FIXTURE_PREFIX, buildWeeklyReviewScenarios } = require('./weekly-review-fixture');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function hasOption(name) {
  return process.argv.includes(name);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function dateKey(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : '';
}

function daysBetween(earlier, later) {
  const left = new Date(`${earlier}T12:00:00.000Z`);
  const right = new Date(`${later}T12:00:00.000Z`);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.max(0, Math.floor((right.getTime() - left.getTime()) / 86400000));
}

function addDays(dateValue, offset) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function getToken() {
  if (process.env.COACHNOTES_INVITE_TOKEN) return process.env.COACHNOTES_INVITE_TOKEN.trim();
  const result = spawnSync(
    'security',
    ['find-generic-password', '-a', 'coachnotes', '-s', 'coachnotes-invite-token', '-w'],
    { encoding: 'utf8' }
  );
  return result.status === 0 ? result.stdout.trim() : '';
}

async function requestWeeklyReview(endpoint, token, requestBody) {
  if (!hasOption('--vercel-preview')) {
    const response = await fetch(`${endpoint}/weekly-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Weekly review request failed (${response.status}).`);
    return payload;
  }

  const requestPath = path.join(os.tmpdir(), `coachnotes-weekly-review-${process.pid}.json`);
  fs.writeFileSync(requestPath, JSON.stringify(requestBody));
  try {
    const proxyDir = path.resolve(__dirname, '..', '..', 'proxy');
    const result = spawnSync('vercel', [
      'curl',
      '/weekly-review',
      '--yes',
      '--deployment',
      endpoint,
      '--',
      '--silent',
      '--show-error',
      '--request',
      'POST',
      '--header',
      'Content-Type: application/json',
      '--header',
      `Authorization: Bearer ${token}`,
      '--data-binary',
      `@${requestPath}`
    ], {
      cwd: proxyDir,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'Vercel preview request failed.');
    }
    const payload = parseJson(result.stdout, null);
    if (!payload) throw new Error(`Vercel preview returned invalid JSON: ${result.stdout.slice(0, 500)}`);
    if (payload.error) throw new Error(payload.error);
    return payload;
  } finally {
    fs.rmSync(requestPath, { force: true });
  }
}

function getContext(db, referenceDate, prefix) {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.display_name AS name,
      b.accepted_at AS acceptedAt,
      b.updated_at AS updatedAt,
      b.structured_json AS structuredJson
    FROM clients c
    JOIN client_baselines b ON b.id = (
      SELECT bx.id FROM client_baselines bx
      WHERE bx.client_id = c.id AND bx.status = 'accepted'
      ORDER BY bx.accepted_at DESC, bx.id DESC LIMIT 1
    )
    WHERE COALESCE(c.archived, 0) = 0
      AND (? = '' OR LOWER(c.display_name) LIKE LOWER(?))
    ORDER BY LOWER(c.display_name)
  `).all(prefix, `${prefix}%`);
  const recentCutoff = addDays(referenceDate, -6);
  const clients = rows.map((row) => {
    const sources = db.prepare(`
      SELECT source_type AS sourceType, source_date AS sourceDate, created_at AS createdAt
      FROM intake_sources WHERE client_id = ?
    `).all(row.id);
    let lastSourceDate = '';
    let recentSourceCount = 0;
    let hasRecentMessage = false;
    for (const source of sources) {
      const sourceDate = dateKey(source.sourceDate || source.createdAt);
      if (sourceDate && (!lastSourceDate || sourceDate > lastSourceDate)) lastSourceDate = sourceDate;
      if (sourceDate && sourceDate >= recentCutoff && sourceDate <= referenceDate) {
        recentSourceCount += 1;
        if (String(source.sourceType || '').toLowerCase() === 'message') hasRecentMessage = true;
      }
    }
    const updatedDate = dateKey(row.updatedAt || row.acceptedAt || lastSourceDate);
    return {
      id: row.id,
      name: row.name,
      acceptedAt: row.acceptedAt,
      updatedAt: row.updatedAt,
      daysSinceUpdate: updatedDate ? daysBetween(updatedDate, referenceDate) : null,
      lastSourceDate,
      recentSourceCount,
      hasRecentMessage,
      structured: parseJson(row.structuredJson, {})
    };
  });
  return buildWeeklyReviewContext(clients, { currentDate: referenceDate });
}

function scoreFixture(report, referenceDate) {
  const expected = new Map(buildWeeklyReviewScenarios(referenceDate).map((scenario) => [
    `${FIXTURE_PREFIX}${scenario.name}`,
    scenario
  ]));
  const reviews = Array.isArray(report?.clientReviews) ? report.clientReviews : [];
  const scored = reviews
    .filter((review) => expected.has(review.clientName))
    .map((review) => {
      const scenario = expected.get(review.clientName);
      const attentionPass = scenario.expectedAttentionLevel.includes(review.attentionLevel);
      const retentionPass = scenario.expectedRetentionConcern.includes(review.retentionConcern);
      return {
        key: scenario.key,
        attention: `${review.attentionLevel}${attentionPass ? '' : ` (expected ${scenario.expectedAttentionLevel.join(' or ')})`}`,
        retention: `${review.retentionConcern}${retentionPass ? '' : ` (expected ${scenario.expectedRetentionConcern.join(' or ')})`}`,
        pass: attentionPass && retentionPass
      };
    });
  return {
    passed: scored.filter((row) => row.pass).length,
    total: expected.size,
    rows: scored
  };
}

function weekStart(dateValue) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function saveReport(db, response, context) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_of TEXT UNIQUE NOT NULL,
      generated_at TEXT NOT NULL,
      model TEXT,
      report_json TEXT NOT NULL,
      context_stats_json TEXT,
      usage_json TEXT
    )
  `);
  db.prepare(`
    INSERT INTO weekly_reviews
      (week_of, generated_at, model, report_json, context_stats_json, usage_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(week_of) DO UPDATE SET
      generated_at = excluded.generated_at,
      model = excluded.model,
      report_json = excluded.report_json,
      context_stats_json = excluded.context_stats_json,
      usage_json = excluded.usage_json
  `).run(
    weekStart(context.currentDate),
    response.generatedAt || new Date().toISOString(),
    response.model || '',
    JSON.stringify(response.report),
    JSON.stringify({ clientCount: context.clientCount, contextChars: JSON.stringify(context).length }),
    JSON.stringify(response.usage || {})
  );
}

app.whenReady().then(async () => {
  const dbPath = optionValue('--db') || path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'CoachNotes Dev',
    'coachnotes',
    'coachnotes.sqlite'
  );
  const referenceDate = optionValue('--date') || new Date().toISOString().slice(0, 10);
  const prefix = optionValue('--prefix');
  const endpoint = optionValue('--url').replace(/\/+$/, '');
  const db = new Database(dbPath);
  try {
    const context = getContext(db, referenceDate, prefix);
    const contextChars = JSON.stringify(context).length;
    process.stdout.write(`${JSON.stringify({
      clientCount: context.clientCount,
      contextChars,
      approximateInputTokensBeforeInstructions: Math.ceil(contextChars / 4),
      prefix: prefix || '(all clients)'
    }, null, 2)}\n`);
    if (!endpoint) return;
    const token = getToken();
    if (!token) throw new Error('No CoachNotes invite token is available in the environment or Keychain.');
    const coachTemplateRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('coachTemplate');
    const payload = await requestWeeklyReview(endpoint, token, {
      model: 'gpt-5.6-luna',
      coachTemplate: parseJson(coachTemplateRow?.value, {}),
      context
    });

    const outputDir = path.resolve(__dirname, '..', '..', '..', 'output', 'weekly-review');
    fs.mkdirSync(outputDir, { recursive: true });
    const slug = prefix
      ? prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'all-clients';
    const outputPath = path.join(outputDir, `${slug || 'portfolio'}-${referenceDate}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      outputPath,
      model: payload.model,
      generatedAt: payload.generatedAt,
      usage: payload.usage
    }, null, 2)}\n`);

    if (prefix === FIXTURE_PREFIX) {
      process.stdout.write(`${JSON.stringify({ fixtureScore: scoreFixture(payload.report, referenceDate) }, null, 2)}\n`);
    }
    if (hasOption('--save')) {
      saveReport(db, payload, context);
      process.stdout.write('Saved the generated review to CoachNotes Dev.\n');
    }
  } finally {
    db.close();
    app.quit();
  }
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  app.exit(1);
});
