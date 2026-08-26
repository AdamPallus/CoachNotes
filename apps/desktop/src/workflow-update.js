const CLIENT_UPDATE_SCHEMA_VERSION = 'client_update_patch.v1';
const MAX_SECTION_UPDATES = 12;

const UPDATE_SECTION_KEYS = new Set([
  'clientProfile',
  'overview',
  'coachTasks',
  'flags',
  'radarItems',
  'goalsValues',
  'clientValues',
  'coachingPlanApproach',
  'programChanges',
  'progressTracking',
  'engagementNotes',
  'nutritionThreads',
  'mindsetThreads',
  'exerciseThreads',
  'resourcesShared',
  'suggestedTags',
  'timeline',
  'missingInfo',
  'confidenceNotes'
]);

const ARRAY_UPDATE_SECTION_KEYS = new Set([
  'coachTasks',
  'flags',
  'radarItems',
  'goalsValues',
  'clientValues',
  'coachingPlanApproach',
  'programChanges',
  'progressTracking',
  'engagementNotes',
  'nutritionThreads',
  'mindsetThreads',
  'exerciseThreads',
  'resourcesShared',
  'suggestedTags',
  'timeline',
  'missingInfo',
  'confidenceNotes'
]);

function normalizeText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function validateUpdateValue(sectionKey, operation, value) {
  if (sectionKey === 'overview' && (operation !== 'replace' || typeof value !== 'string')) {
    throw new Error('Invalid CoachNotes update: overview must use replace with text.');
  }
  if (sectionKey === 'clientProfile' && (
    operation !== 'merge' || !value || typeof value !== 'object' || Array.isArray(value)
  )) {
    throw new Error('Invalid CoachNotes update: client profile must use merge with a field patch.');
  }
  if (ARRAY_UPDATE_SECTION_KEYS.has(sectionKey) && (
    !['append', 'replace'].includes(operation) || !Array.isArray(value)
  )) {
    throw new Error(`Invalid CoachNotes update: ${sectionKey} must use append or replace with a list.`);
  }
}

function extractPartialUpdateResponse(response) {
  const structured = response?.structured;
  if (!structured || typeof structured !== 'object' || Array.isArray(structured)) {
    throw new Error('Invalid CoachNotes update: missing structured response.');
  }
  if (structured.schemaVersion !== CLIENT_UPDATE_SCHEMA_VERSION) {
    throw new Error(`Invalid CoachNotes update: expected ${CLIENT_UPDATE_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(structured.sectionUpdates)) {
    throw new Error('Invalid CoachNotes update: missing section updates.');
  }
  if (structured.sectionUpdates.length > MAX_SECTION_UPDATES) {
    throw new Error(`Invalid CoachNotes update: more than ${MAX_SECTION_UPDATES} sections changed.`);
  }

  const seen = new Set();
  const sectionUpdates = structured.sectionUpdates.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Invalid CoachNotes update: malformed section update.');
    }
    const sectionKey = normalizeText(entry.sectionKey, 80);
    if (!UPDATE_SECTION_KEYS.has(sectionKey)) {
      throw new Error(`Invalid CoachNotes update: unsupported section ${sectionKey || '(missing)'}.`);
    }
    if (seen.has(sectionKey)) {
      throw new Error(`Invalid CoachNotes update: duplicate section ${sectionKey}.`);
    }
    const operation = normalizeText(entry.operation, 40);
    if (!Object.prototype.hasOwnProperty.call(entry, 'value')) {
      throw new Error(`Invalid CoachNotes update: ${sectionKey} has no value.`);
    }
    validateUpdateValue(sectionKey, operation, entry.value);
    seen.add(sectionKey);
    return {
      sectionKey,
      operation,
      value: entry.value,
      summary: normalizeText(entry.summary, 400),
      reason: normalizeText(entry.reason, 600),
      evidenceIds: Array.isArray(entry.evidenceIds)
        ? entry.evidenceIds.map((item) => normalizeText(item, 160)).filter(Boolean).slice(0, 24)
        : []
    };
  });

  const updateSummary = normalizeText(structured.updateSummary, 600);
  if (!updateSummary) {
    throw new Error('Invalid CoachNotes update: missing update summary.');
  }

  return {
    sectionUpdates,
    changes: sectionUpdates.map(({ sectionKey, summary, reason, evidenceIds }) => ({
      sectionKey,
      summary,
      reason,
      evidenceIds
    })),
    updateSummary
  };
}

function applyPartialUpdate(currentStructured, sectionUpdates) {
  const current = currentStructured && typeof currentStructured === 'object' && !Array.isArray(currentStructured)
    ? currentStructured
    : {};
  const next = { ...current };

  for (const update of sectionUpdates) {
    if (update.sectionKey === 'clientProfile') {
      const currentProfile = current.clientProfile && typeof current.clientProfile === 'object' && !Array.isArray(current.clientProfile)
        ? current.clientProfile
        : {};
      next.clientProfile = { ...currentProfile, ...update.value };
    } else if (update.operation === 'append') {
      const currentItems = Array.isArray(current[update.sectionKey]) ? current[update.sectionKey] : [];
      next[update.sectionKey] = [...currentItems, ...update.value];
    } else {
      next[update.sectionKey] = update.value;
    }
  }

  return next;
}

module.exports = {
  applyPartialUpdate,
  extractPartialUpdateResponse
};
