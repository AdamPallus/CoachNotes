const {
  DEFAULT_LLM_MODEL,
  allowModel,
  authAndRateLimit,
  collectCitations,
  getOpenAIClient,
  json,
  splitBullets,
  validateAnswerLikeSources
} = require('./_shared');

const systemPrompt = [
  'You are CoachNotes Assistant.',
  'Use only the provided sources as truth.',
  'Cite every major claim using [c:chunk_id].',
  'If information is missing, reply exactly: Not found in the provided notes.',
  'Do not invent details, dates, or exercises.',
  'Avoid diagnosis language and summarize what the notes explicitly say.'
].join(' ');

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

    const result = await openai.responses.create({
      model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const answerText = result.output_text?.trim() || 'Not found in the provided notes.';
    const citations = collectCitations(answerText);
    const structured = {
      bullets: splitBullets(answerText),
      warnings: answerText.includes('Not found in the provided notes.')
        ? ['Some requested details were not present in the provided notes.']
        : []
    };

    json(res, 200, {
      model,
      answer: answerText,
      citations,
      structured
    });
  } catch (err) {
    json(res, 502, { error: err.message || 'Answer request failed.' });
  }
};
