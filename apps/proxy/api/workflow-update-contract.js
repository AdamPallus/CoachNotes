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

class WorkflowContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowContractError';
    this.isWorkflowContractError = true;
  }
}

function normalizeText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeEvidenceIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => normalizeText(item, 160)).filter(Boolean))].slice(0, 24);
}

function validateUpdateValue(sectionKey, operation, value) {
  if (sectionKey === 'overview') {
    if (operation !== 'replace' || typeof value !== 'string') {
      throw new WorkflowContractError('overview must use replace with a string value.');
    }
    return;
  }

  if (sectionKey === 'clientProfile') {
    if (operation !== 'merge' || !value || typeof value !== 'object' || Array.isArray(value)) {
      throw new WorkflowContractError('clientProfile must use merge with a field patch object.');
    }
    return;
  }

  if (!['append', 'replace'].includes(operation) || !Array.isArray(value)) {
    throw new WorkflowContractError(`${sectionKey} must use append or replace with an array value.`);
  }
}

function normalizeClientUpdatePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkflowContractError('Client update must be a JSON object.');
  }
  if (value.schemaVersion !== CLIENT_UPDATE_SCHEMA_VERSION) {
    throw new WorkflowContractError(`Client update must use ${CLIENT_UPDATE_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(value.sectionUpdates)) {
    throw new WorkflowContractError('Client update must include sectionUpdates[].');
  }
  if (value.sectionUpdates.length > MAX_SECTION_UPDATES) {
    throw new WorkflowContractError(`Client update may change at most ${MAX_SECTION_UPDATES} sections.`);
  }

  const seen = new Set();
  const sectionUpdates = value.sectionUpdates.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new WorkflowContractError('Each section update must be an object.');
    }
    const sectionKey = normalizeText(entry.sectionKey, 80);
    if (!UPDATE_SECTION_KEYS.has(sectionKey)) {
      throw new WorkflowContractError(`Unsupported section update: ${sectionKey || '(missing)'}.`);
    }
    if (seen.has(sectionKey)) {
      throw new WorkflowContractError(`Duplicate section update: ${sectionKey}.`);
    }
    const operation = normalizeText(entry.operation, 40);
    if (!Object.prototype.hasOwnProperty.call(entry, 'value')) {
      throw new WorkflowContractError(`${sectionKey} update is missing value.`);
    }
    validateUpdateValue(sectionKey, operation, entry.value);
    seen.add(sectionKey);
    return {
      sectionKey,
      operation,
      value: entry.value,
      summary: normalizeText(entry.summary, 400),
      reason: normalizeText(entry.reason, 600),
      evidenceIds: normalizeEvidenceIds(entry.evidenceIds)
    };
  });

  const updateSummary = normalizeText(value.updateSummary, 600);
  if (!updateSummary) {
    throw new WorkflowContractError('Client update must include updateSummary.');
  }

  return {
    schemaVersion: CLIENT_UPDATE_SCHEMA_VERSION,
    updateSummary,
    sectionUpdates
  };
}

module.exports = {
  ARRAY_UPDATE_SECTION_KEYS,
  CLIENT_UPDATE_SCHEMA_VERSION,
  MAX_SECTION_UPDATES,
  UPDATE_SECTION_KEYS,
  WorkflowContractError,
  normalizeClientUpdatePatch
};
