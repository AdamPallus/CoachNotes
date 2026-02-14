const {
  DEFAULT_LLM_MODEL,
  allowModel,
  authAndRateLimit,
  collectCitations,
  getOpenAIClient,
  getOpenAITimeoutMs,
  json,
  withTimeout,
  validateAnswerLikeSources
} = require('./_shared');

const summaryPrompt = [
  'You are CoachNotes Assistant.',
  'Summarize only what appears in provided sources.',
  'Use concise coaching language.',
  'Cite each major point with [c:chunk_id].'
].join(' ');

function getSummaryMaxOutputTokens() {
  const parsed = Number.parseInt(process.env.SUMMARY_MAX_OUTPUT_TOKENS || '1100', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1100;
  }
  return Math.max(400, Math.min(parsed, 3000));
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

module.exports = async function summarize(req, res) {
  const auth = authAndRateLimit(req, res);
  if (!auth.ok) {
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
    const maxOutputTokens = getSummaryMaxOutputTokens();
    const streamRequested = Boolean(req.body?.stream);

    const renderedSources = req.body.sources
      .map((source) => `chunk_id: ${source.chunk_id}\ntext: ${source.text}`)
      .join('\n\n---\n\n');

    if (streamRequested) {
      beginNdjsonStream(res);
      writeNdjsonEvent(res, {
        type: 'start',
        mode: 'summarize',
        model,
        maxOutputTokens
      });

      let summary = '';
      let completedText = '';
      const stream = await openai.responses.create(
        {
          model,
          max_output_tokens: maxOutputTokens,
          stream: true,
          input: [
            { role: 'system', content: summaryPrompt },
            { role: 'user', content: `Mode: ${req.body.mode || 'search_results_summary'}\n\nSources:\n${renderedSources}` }
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

          summary += delta;
          writeNdjsonEvent(res, { type: 'delta', delta });
          continue;
        }

        if (event?.type === 'response.completed') {
          completedText = extractOutputText(event.response || event.data || null);
        }
      }

      if (!summary && completedText) {
        summary = completedText;
      }

      if (!summary.trim()) {
        summary = 'I could not generate a summary from the provided notes. Please try again with a narrower scope.';
      }

      writeNdjsonEvent(res, {
        type: 'done',
        data: {
          model,
          maxOutputTokens,
          summary,
          citations: collectCitations(summary)
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
          { role: 'system', content: summaryPrompt },
          { role: 'user', content: `Mode: ${req.body.mode || 'search_results_summary'}\n\nSources:\n${renderedSources}` }
        ]
      }),
      requestTimeoutMs,
      'Model summary timed out. Please retry or reduce search depth.'
    );

    const summary = result.output_text?.trim()
      || 'I could not generate a summary from the provided notes. Please try again with a narrower scope.';

    json(res, 200, {
      model,
      maxOutputTokens,
      summary,
      citations: collectCitations(summary)
    });
  } catch (err) {
    const message = err?.message || 'Summarize request failed.';
    if (!res.headersSent) {
      json(res, 502, { error: message });
      return;
    }

    writeNdjsonEvent(res, { type: 'error', error: message });
    res.end();
  }
};
