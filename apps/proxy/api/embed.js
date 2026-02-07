const {
  DEFAULT_EMBED_MODEL,
  allowModel,
  authAndRateLimit,
  getOpenAIClient,
  json,
  validateEmbeddingRequest
} = require('./_shared');

module.exports = async function embed(req, res) {
  const auth = authAndRateLimit(req, res);
  if (!auth.ok) {
    return;
  }

  const error = validateEmbeddingRequest(req.body);
  if (error) {
    json(res, 400, { error });
    return;
  }

  try {
    const model = allowModel(req.body.model, DEFAULT_EMBED_MODEL, 'EMBED_MODEL_ALLOWLIST');
    const openai = getOpenAIClient();

    const response = await openai.embeddings.create({
      model,
      input: req.body.inputs.map((entry) => entry.text)
    });

    const data = response.data.map((item, index) => ({
      id: req.body.inputs[index].id,
      embedding: item.embedding
    }));

    json(res, 200, { model, data });
  } catch (err) {
    json(res, 502, { error: err.message || 'Embedding request failed.' });
  }
};
