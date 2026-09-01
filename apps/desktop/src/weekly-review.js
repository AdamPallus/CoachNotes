const WEEKLY_REVIEW_CONTEXT_SCHEMA_VERSION = 'weekly_review_context.v1';
const WEEKLY_REVIEW_BATCH_MAX_CLIENTS = 12;
const WEEKLY_REVIEW_BATCH_TARGET_CHARS = 100000;

const CLOSED_PLANNING_STATUSES = new Set(['completed', 'done', 'abandoned', 'outdated', 'resolved']);

function cleanText(value, maxLength = 320) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanDate(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : '';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function itemTitle(item) {
  if (typeof item === 'string') {
    return cleanText(item, 160);
  }
  const value = asObject(item);
  return cleanText(value.title || value.label || value.name || value.goal || value.task, 160);
}

function itemDetail(item) {
  if (typeof item === 'string') {
    return '';
  }
  const value = asObject(item);
  return cleanText(
    value.details || value.detail || value.description || value.summary || value.reason || value.note,
    360
  );
}

function itemStatus(item) {
  const value = asObject(item);
  return cleanText(value.planningStatus || value.status || value.state || value.timing, 60).toLowerCase();
}

function compactItems(values, { limit = 8, includeClosed = true } = {}) {
  return asArray(values)
    .filter((item) => includeClosed || !CLOSED_PLANNING_STATUSES.has(itemStatus(item)))
    .map((item) => {
      const value = asObject(item);
      const title = itemTitle(item);
      const detail = itemDetail(item);
      if (!title && !detail) {
        return null;
      }
      const compact = {
        title: title || detail.slice(0, 160)
      };
      if (detail && detail !== compact.title) compact.detail = detail;
      const status = itemStatus(item);
      const priority = cleanText(value.priority || value.urgency, 40).toLowerCase();
      const dueDate = cleanDate(value.dueDate || value.dueOrReviewBy || value.reviewBy || value.date);
      const throughDate = cleanDate(value.throughDate || value.untilDate || value.endDate);
      if (status) compact.status = status;
      if (priority) compact.priority = priority;
      if (dueDate) compact.dueDate = dueDate;
      if (throughDate) compact.throughDate = throughDate;
      return compact;
    })
    .filter(Boolean)
    .slice(0, limit);
}

function compactProfile(value) {
  const profile = asObject(value);
  const fields = [
    'curriculum',
    'curriculumType',
    'trainingProgram',
    'programType',
    'cohort',
    'programFormat',
    'trainingFormat',
    'primaryTrainingGoal',
    'curriculumStartDate',
    'programStartDate',
    'programWeek',
    'trainingProgramWeek'
  ];
  const result = {};
  for (const field of fields) {
    const text = cleanText(profile[field], 160);
    if (text) result[field] = text;
  }
  return result;
}

function compactClientForWeeklyReview(client) {
  const structured = asObject(client.structured);
  return {
    clientId: String(client.id),
    clientName: cleanText(client.name, 160) || 'Client',
    lastDashboardUpdateDate: cleanDate(client.updatedAt || client.acceptedAt),
    daysSinceDashboardUpdate: Number.isFinite(Number(client.daysSinceUpdate))
      ? Math.max(0, Number(client.daysSinceUpdate))
      : null,
    lastSourceDate: cleanDate(client.lastSourceDate),
    recentSourceCount: Math.max(0, Number(client.recentSourceCount || 0)),
    hasRecentMessage: Boolean(client.hasRecentMessage),
    overview: cleanText(structured.overview, 720),
    clientProfile: compactProfile(structured.clientProfile),
    activeCoachTasks: compactItems(structured.coachTasks, { limit: 12, includeClosed: false }),
    radar: compactItems(structured.radarItems, { limit: 8, includeClosed: false }),
    clientGoals: compactItems(structured.goalsValues, { limit: 8, includeClosed: false }),
    coachingApproach: compactItems(structured.coachingPlanApproach, { limit: 8, includeClosed: false }),
    engagement: compactItems(structured.engagementNotes, { limit: 8 }),
    progress: compactItems(structured.progressTracking, { limit: 8 }),
    recentTimeline: compactItems(structured.timeline, { limit: 8 }).slice(-8),
    programChanges: compactItems(structured.programChanges, { limit: 8 }),
    flags: compactItems(structured.flags, { limit: 8, includeClosed: false }),
    missingInfo: compactItems(structured.missingInfo, { limit: 8 }),
    confidenceNotes: compactItems(structured.confidenceNotes, { limit: 6 })
  };
}

function buildWeeklyReviewContext(clients, { currentDate } = {}) {
  const date = cleanDate(currentDate) || new Date().toISOString().slice(0, 10);
  const compactClients = asArray(clients)
    .map(compactClientForWeeklyReview)
    .filter((client) => client.clientId && client.clientName)
    .sort((left, right) => left.clientName.localeCompare(right.clientName));
  return {
    schemaVersion: WEEKLY_REVIEW_CONTEXT_SCHEMA_VERSION,
    currentDate: date,
    clientCount: compactClients.length,
    clients: compactClients
  };
}

function serializedClientLength(client) {
  return JSON.stringify(client).length;
}

function buildWeeklyReviewBatches(context, {
  maxClients = WEEKLY_REVIEW_BATCH_MAX_CLIENTS,
  targetChars = WEEKLY_REVIEW_BATCH_TARGET_CHARS
} = {}) {
  const clients = asArray(context?.clients);
  const clientLimit = Math.max(1, Number(maxClients) || WEEKLY_REVIEW_BATCH_MAX_CLIENTS);
  const charLimit = Math.max(10000, Number(targetChars) || WEEKLY_REVIEW_BATCH_TARGET_CHARS);
  const batches = [];
  let current = [];
  let currentChars = 0;

  const flush = () => {
    if (!current.length) return;
    const batchIndex = batches.length;
    const clientIds = current.map((client) => String(client.clientId));
    batches.push({
      key: `${batchIndex + 1}:${clientIds.join(',')}`,
      index: batchIndex,
      clientIds,
      context: {
        schemaVersion: WEEKLY_REVIEW_CONTEXT_SCHEMA_VERSION,
        currentDate: context.currentDate,
        clientCount: current.length,
        clients: current
      }
    });
    current = [];
    currentChars = 0;
  };

  for (const client of clients) {
    const clientChars = serializedClientLength(client);
    if (current.length && (current.length >= clientLimit || currentChars + clientChars > charLimit)) {
      flush();
    }
    current.push(client);
    currentChars += clientChars;
  }
  flush();
  return batches;
}

function assertExactClientCoverage(clientReviews, expectedClients) {
  const expected = new Set(asArray(expectedClients).map((client) => String(client.clientId)));
  const seen = new Set();
  for (const review of asArray(clientReviews)) {
    const clientId = String(review?.clientId || '');
    if (!expected.has(clientId)) throw new Error(`Weekly review returned unknown client id ${clientId || '(missing)'}.`);
    if (seen.has(clientId)) throw new Error(`Weekly review returned duplicate client id ${clientId}.`);
    seen.add(clientId);
  }
  if (seen.size !== expected.size) {
    throw new Error(`Weekly review covered ${seen.size} of ${expected.size} clients.`);
  }
}

function mergeWeeklyReviewResults(context, batchResults, synthesis) {
  const clientsById = new Map(asArray(context?.clients).map((client) => [String(client.clientId), client]));
  const clientReviews = asArray(batchResults)
    .flatMap((result) => asArray(result?.clientReviews))
    .map((review) => {
      const client = clientsById.get(String(review?.clientId || '')) || {};
      const profile = asObject(client.clientProfile);
      return {
        ...review,
        cohort: cleanText(profile.cohort, 160),
        curriculum: cleanText(profile.curriculum || profile.curriculumType, 160)
      };
    });
  assertExactClientCoverage(clientReviews, context?.clients);
  clientReviews.sort((left, right) => String(left.clientName || '').localeCompare(String(right.clientName || '')));
  return {
    schemaVersion: 'weekly_client_review.v1',
    openingSummary: cleanText(synthesis?.openingSummary, 700) || 'Your weekly client review is ready.',
    practicePatterns: asArray(synthesis?.practicePatterns).slice(0, 3),
    clientReviews
  };
}

module.exports = {
  WEEKLY_REVIEW_BATCH_MAX_CLIENTS,
  WEEKLY_REVIEW_BATCH_TARGET_CHARS,
  WEEKLY_REVIEW_CONTEXT_SCHEMA_VERSION,
  assertExactClientCoverage,
  buildWeeklyReviewBatches,
  buildWeeklyReviewContext,
  compactClientForWeeklyReview,
  mergeWeeklyReviewResults
};
