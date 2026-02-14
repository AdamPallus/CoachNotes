const {
  DEFAULT_LLM_MODEL,
  allowModel,
  authAndRateLimit,
  collectCitations,
  getOpenAIClient,
  getOpenAITimeoutMs,
  json,
  splitBullets,
  withTimeout,
  validateAnswerLikeSources
} = require('./_shared');

const systemPrompt = [
  'You are CoachNotes Assistant.',
  'Use only the provided sources as truth.',
  'Cite every major claim using [c:chunk_id].',
  'If you cannot provide a solid answer from the available notes, give a brief explanation of what is missing.',
  'Do not invent details, dates, or exercises.',
  'Avoid diagnosis language and summarize what the notes explicitly say.',
  'Do not offer follow-up actions.',
  'Do not ask follow-up questions.',
  'End after the direct answer.'
].join(' ');

function getAnswerMaxOutputTokens() {
  const parsed = Number.parseInt(process.env.ANSWER_MAX_OUTPUT_TOKENS || '1300', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1300;
  }
  return Math.max(500, Math.min(parsed, 4000));
}

function extractOutputText(response) {
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

function beginNdjsonStream(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

function writeNdjsonEvent(res, payload) {
  if (res.writableEnded) {
    return;
  }

  res.write(`${JSON.stringify(payload)}\n`);
}

module.exports = async function answer(req, res) {
  const auth = authAndRateLimit(req, res);
  if (!auth.ok) {
    return;
  }

  const question = String(req.body?.question || '').trim();
  if (!question) {
    json(res, 400, { error: 'question is required.' });
    return;
  }

  const sourcesError = validateAnswerLikeSources(req.body?.sources);
  if (sourcesError) {
    json(res, 400, { error: sourcesError });
    return;
  }

  try {
    const model = allowModel(req.body.model, DEFAULT_LLM_MODEL, 'LLM_MODEL_ALLOWLIST');
    const openai = getOpenAIClient();
    const requestTimeoutMs = getOpenAITimeoutMs();
    const maxOutputTokens = getAnswerMaxOutputTokens();
    const streamRequested = Boolean(req.body?.stream);

    const renderedSources = req.body.sources
      .map((source) => {
        return [
          `chunk_id: ${source.chunk_id}`,
          `title: ${source.title || 'Untitled'}`,
          `date: ${source.date || 'unknown'}`,
          `clients: ${(source.client_ids || []).join(', ') || 'unknown'}`,
          `text: ${source.text}`
        ].join('\n');
      })
      .join('\n\n---\n\n');

    const instructions = req.body.instructions ? `Additional user instructions: ${req.body.instructions}\n\n` : '';

    const userPrompt = `${instructions}Question:\n${question}\n\nSources:\n${renderedSources}`;

    if (streamRequested) {
      beginNdjsonStream(res);
      writeNdjsonEvent(res, {
        type: 'start',
        mode: 'answer',
        model,
        maxOutputTokens
      });

      let answerText = '';
      let completedText = '';
      const stream = await openai.responses.create(
        {
          model,
          max_output_tokens: maxOutputTokens,
          stream: true,
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        },
        { timeout: requestTimeoutMs }
      );

      for await (const event of stream) {
        if (event?.type === 'response.output_text.delta') {
          const delta = typeof event.delta === 'string' ? event.delta : '';
          if (!delta) {
            continue;
          }

          answerText += delta;
          writeNdjsonEvent(res, { type: 'delta', delta });
          continue;
        }

        if (event?.type === 'response.completed') {
          completedText = extractOutputText(event.response || event.data || null);
        }
      }

      if (!answerText && completedText) {
        answerText = completedText;
      }

      if (!answerText.trim()) {
        answerText = 'I could not provide a solid answer from the available notes. Please try a narrower question.';
      }

      const citations = collectCitations(answerText);
      const evidenceLimited = /\b(unable|insufficient|not enough|missing|do not contain|cannot determine|could not)\b/i.test(answerText);
      const structured = {
        bullets: splitBullets(answerText),
        warnings: evidenceLimited
          ? ['The available notes may not contain enough detail to answer this fully.']
          : []
      };

      writeNdjsonEvent(res, {
        type: 'done',
        data: {
          model,
          maxOutputTokens,
          answer: answerText,
          citations,
          structured
        }
      });
      res.end();
      return;
    }

    const result = await withTimeout(
      openai.responses.create({
        model,
        max_output_tokens: maxOutputTokens,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      requestTimeoutMs,
      'Model response timed out. Please retry or reduce search depth.'
    );

    const answerText = result.output_text?.trim()
      || 'I could not provide a solid answer from the available notes. Please try a narrower question.';
    const citations = collectCitations(answerText);
    const evidenceLimited = /\b(unable|insufficient|not enough|missing|do not contain|cannot determine|could not)\b/i.test(answerText);
    const structured = {
      bullets: splitBullets(answerText),
      warnings: evidenceLimited
        ? ['The available notes may not contain enough detail to answer this fully.']
        : []
    };

    json(res, 200, {
      model,
      maxOutputTokens,
      answer: answerText,
      citations,
      structured
    });
  } catch (err) {
    const message = err?.message || 'Answer request failed.';
    if (!res.headersSent) {
      json(res, 502, { error: message });
      return;
    }

    writeNdjsonEvent(res, { type: 'error', error: message });
    res.end();
  }
};
