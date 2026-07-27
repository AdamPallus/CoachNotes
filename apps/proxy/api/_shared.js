const crypto = require('node:crypto');
const OpenAI = require('openai');

const rateWindowMs = 60 * 1000;
const rateState = new Map();

const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_LLM_MODEL = 'gpt-5.6-luna';
const MAX_EMBED_ITEMS = 32;
const MAX_EMBED_TOTAL_CHARS = 120000;
const MAX_SOURCES = 12;
const MAX_SOURCES_TOTAL_CHARS = 90000;
const MAX_WORKFLOW_SOURCES = 24;
const MAX_WORKFLOW_TOTAL_CHARS = 240000;
const DEFAULT_OPENAI_TIMEOUT_MS = 95 * 1000;
const MAX_OPENAI_TIMEOUT_MS = 115 * 1000;

function parsePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseTokensFromEnv() {
  const list = [process.env.INVITE_TOKEN, process.env.INVITE_TOKENS]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(list);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

function json(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return header.slice(7).trim();
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function authAndRateLimit(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    json(res, 200, { ok: true });
    return { ok: false };
  }

  applyCors(res);

  const validTokens = parseTokensFromEnv();
  if (!validTokens.size) {
    json(res, 500, { error: 'Server misconfigured: no invite tokens set.' });
    return { ok: false };
  }

  const token = readBearerToken(req);
  if (!token || !validTokens.has(token)) {
    json(res, 401, { error: 'Unauthorized' });
    return { ok: false };
  }

  const now = Date.now();
  const bucket = rateState.get(token) || { count: 0, resetAt: now + rateWindowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + rateWindowMs;
  }

  const maxPerMinute = Number(process.env.RATE_LIMIT_PER_MIN || 60);
  bucket.count += 1;
  rateState.set(token, bucket);

  if (bucket.count > maxPerMinute) {
    json(res, 429, { error: 'Rate limit exceeded' });
    return { ok: false };
  }

  return { ok: true, token, tokenId: tokenHash(token) };
}

function validateEmbeddingRequest(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid JSON body.';
  }

  if (!Array.isArray(body.inputs) || body.inputs.length === 0) {
    return 'inputs[] is required.';
  }

  if (body.inputs.length > MAX_EMBED_ITEMS) {
    return `Too many inputs. Max ${MAX_EMBED_ITEMS}.`;
  }

  let totalChars = 0;
  for (const item of body.inputs) {
    if (!item || typeof item !== 'object') {
      return 'Each input must be an object.';
    }

    if (typeof item.id !== 'string' || !item.id.trim()) {
      return 'Each input requires id.';
    }

    if (typeof item.text !== 'string' || !item.text.trim()) {
      return 'Each input requires text.';
    }

    totalChars += item.text.length;
  }

  if (totalChars > MAX_EMBED_TOTAL_CHARS) {
    return `Total input text too large. Max ${MAX_EMBED_TOTAL_CHARS} chars.`;
  }

  return null;
}

function validateAnswerLikeSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return 'sources[] is required.';
  }

  if (sources.length > MAX_SOURCES) {
    return `Too many sources. Max ${MAX_SOURCES}.`;
  }

  let totalChars = 0;
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      return 'Each source must be an object.';
    }

    if (typeof source.chunk_id !== 'string' || !source.chunk_id.trim()) {
      return 'Each source requires chunk_id.';
    }

    if (typeof source.text !== 'string' || !source.text.trim()) {
      return 'Each source requires text.';
    }

    totalChars += source.text.length;
  }

  if (totalChars > MAX_SOURCES_TOTAL_CHARS) {
    return `Total source text too large. Max ${MAX_SOURCES_TOTAL_CHARS} chars.`;
  }

  return null;
}

function validateWorkflowSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return 'sources[] is required.';
  }

  if (sources.length > MAX_WORKFLOW_SOURCES) {
    return `Too many sources. Max ${MAX_WORKFLOW_SOURCES}.`;
  }

  let totalChars = 0;
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      return 'Each source must be an object.';
    }

    if (typeof source.source_id !== 'string' || !source.source_id.trim()) {
      return 'Each source requires source_id.';
    }

    if (typeof source.text !== 'string' || !source.text.trim()) {
      return 'Each source requires text.';
    }

    totalChars += source.text.length;
  }

  if (totalChars > MAX_WORKFLOW_TOTAL_CHARS) {
    return `Total source text too large. Max ${MAX_WORKFLOW_TOTAL_CHARS} chars.`;
  }

  return null;
}

function allowModel(requested, defaultModel, envKey) {
  const allow = new Set(
    [process.env[envKey], defaultModel]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const model = requested && allow.has(requested) ? requested : defaultModel;
  return model;
}

function getOpenAITimeoutMs() {
  const configured = parsePositiveInt(process.env.OPENAI_TIMEOUT_MS, DEFAULT_OPENAI_TIMEOUT_MS);
  return clamp(configured, 5 * 1000, MAX_OPENAI_TIMEOUT_MS);
}

async function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timer = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

let cachedClient;
function getOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing.');
  }

  cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

function collectCitations(answerText) {
  const ids = new Set();
  const pattern = /\[c:([^\]]+)\]/g;
  let match = pattern.exec(answerText || '');
  while (match) {
    ids.add(match[1]);
    match = pattern.exec(answerText || '');
  }
  return [...ids];
}

function splitBullets(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''))
    .slice(0, 8);
}

function extractResponseOutputText(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  const parts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const row of content) {
      if (row?.type === 'output_text' && typeof row.text === 'string' && row.text) {
        parts.push(row.text);
      }
    }
  }

  return parts.join('');
}

module.exports = {
  DEFAULT_EMBED_MODEL,
  DEFAULT_LLM_MODEL,
  authAndRateLimit,
  allowModel,
  collectCitations,
  extractResponseOutputText,
  getOpenAIClient,
  getOpenAITimeoutMs,
  json,
  splitBullets,
  withTimeout,
  validateAnswerLikeSources,
  validateEmbeddingRequest,
  validateWorkflowSources
};
