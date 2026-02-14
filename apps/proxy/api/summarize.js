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

    const renderedSources = req.body.sources
      .map((source) => `chunk_id: ${source.chunk_id}\ntext: ${source.text}`)
      .join('\n\n---\n\n');

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
    json(res, 502, { error: err.message || 'Summarize request failed.' });
  }
};
