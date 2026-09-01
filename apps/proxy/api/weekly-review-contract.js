const WEEKLY_REVIEW_SCHEMA_VERSION = 'weekly_client_review.v1';
const ATTENTION_LEVELS = new Set([
  'needs_attention',
  'watch',
  'routine',
  'expected_pause',
  'insufficient_evidence'
]);
const RETENTION_CONCERNS = new Set(['low', 'some', 'high', 'insufficient_evidence']);

function contractError(message) {
  const error = new Error(message);
  error.isWeeklyReviewContractError = true;
  return error;
}

function text(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function stringList(value, { limit = 1, maxLength = 180 } = {}) {
  return (Array.isArray(value) ? value : [])
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeWeeklyReview(value, expectedClients) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw contractError('Weekly review must be a JSON object.');
  }
  if (value.schemaVersion !== WEEKLY_REVIEW_SCHEMA_VERSION) {
    throw contractError(`Weekly review must use ${WEEKLY_REVIEW_SCHEMA_VERSION}.`);
  }

  const expected = new Map((Array.isArray(expectedClients) ? expectedClients : []).map((client) => [
    String(client.clientId),
    text(client.clientName, 160) || 'Client'
  ]));
  const reviews = Array.isArray(value.clientReviews) ? value.clientReviews : [];
  if (reviews.length !== expected.size) {
    throw contractError(`Weekly review covered ${reviews.length} of ${expected.size} clients.`);
  }

  const seen = new Set();
  const clientReviews = reviews.map((review) => {
    const item = review && typeof review === 'object' && !Array.isArray(review) ? review : {};
    const clientId = String(item.clientId || '');
    if (!expected.has(clientId)) {
      throw contractError(`Weekly review returned unknown client id ${clientId || '(missing)'}.`);
    }
    if (seen.has(clientId)) {
      throw contractError(`Weekly review returned duplicate client id ${clientId}.`);
    }
    seen.add(clientId);

    const attentionLevel = text(item.attentionLevel, 40).toLowerCase();
    const retentionConcern = text(item.retentionConcern, 40).toLowerCase();
    if (!ATTENTION_LEVELS.has(attentionLevel)) {
      throw contractError(`Invalid attention level for client ${clientId}.`);
    }
    if (!RETENTION_CONCERNS.has(retentionConcern)) {
      throw contractError(`Invalid retention concern for client ${clientId}.`);
    }

    const currentFocus = text(item.currentFocus, 260);
    const weeklyAssessment = text(item.weeklyAssessment, 360);
    const suggestedCoachFocus = text(item.suggestedCoachFocus, 260);
    if (!currentFocus || !weeklyAssessment || !suggestedCoachFocus) {
      throw contractError(`Client ${clientId} is missing a required review field.`);
    }
    return {
      clientId,
      clientName: expected.get(clientId),
      attentionLevel,
      retentionConcern,
      currentFocus,
      weeklyAssessment,
      suggestedCoachFocus,
      evidence: stringList(item.evidence),
      counterevidence: stringList(item.counterevidence)
    };
  });

  for (const clientId of expected.keys()) {
    if (!seen.has(clientId)) {
      throw contractError(`Weekly review omitted client id ${clientId}.`);
    }
  }

  const practicePatterns = (Array.isArray(value.practicePatterns) ? value.practicePatterns : [])
    .map((pattern) => {
      const item = pattern && typeof pattern === 'object' && !Array.isArray(pattern) ? pattern : {};
      const clientIds = [...new Set((Array.isArray(item.clientIds) ? item.clientIds : [])
        .map((id) => String(id))
        .filter((id) => expected.has(id)))]
        .slice(0, 12);
      const title = text(item.title, 100);
      const summary = text(item.summary, 300);
      return title && summary ? { title, summary, clientIds } : null;
    })
    .filter(Boolean)
    .slice(0, 3);

  return {
    schemaVersion: WEEKLY_REVIEW_SCHEMA_VERSION,
    openingSummary: text(value.openingSummary, 700) || 'Your weekly client review is ready.',
    practicePatterns,
    clientReviews
  };
}

module.exports = {
  ATTENTION_LEVELS,
  RETENTION_CONCERNS,
  WEEKLY_REVIEW_SCHEMA_VERSION,
  normalizeWeeklyReview
};
