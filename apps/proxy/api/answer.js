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
    json(res, 502, { error: err.message || 'Answer request failed.' });
  }
};
