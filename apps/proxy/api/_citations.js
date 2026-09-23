const { isDeepStrictEqual } = require('node:util');
const { WorkflowContractError } = require('./workflow-update-contract');

function normalizeAnswerCitations(text, sources) {
  const allowed = new Set(sources.map((source) => source.chunk_id));
  let unchecked = String(text || '');
  const normalized = unchecked.replace(/\[\s*c\s*:\s*([^\]\n]+)\]/gi, (marker, rawId) => {
    const id = rawId.trim();
    if (!allowed.has(id)) {
      throw new Error('The AI returned a source reference that could not be verified. Please try again.');
    }
    return `[c:${id}]`;
  });
  unchecked = normalized.replace(/\[c:[^\]\n]+\]/g, '');
  if (/\[\s*c\s*:/i.test(unchecked)) {
    throw new Error('The AI returned an unfinished source reference. Please try again.');
  }
  return normalized;
}

// Hold an unfinished bracket across chunks so malformed citation tokens are
// never streamed to the desktop before they can be normalized and checked.
function createCitationStream(sources) {
  let pending = '';
  return {
    push(chunk, final = false) {
      pending += chunk;
      const lastOpen = pending.lastIndexOf('[');
      const end = !final && lastOpen > pending.lastIndexOf(']') ? lastOpen : pending.length;
      const ready = pending.slice(0, end);
      pending = pending.slice(end);
      return normalizeAnswerCitations(ready, sources);
    }
  };
}

function walk(value, visit) {
  if (Array.isArray(value)) return value.map((item) => walk(item, visit));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === 'evidenceIds' && Array.isArray(item)
        ? item.map((id) => visit(String(id).trim()))
        : walk(item, visit)
    ]));
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\[(?:c:)?\s*((?:intake_)?source_[^\]\n]+)\]/g,
    (marker, id) => `[${visit(id.trim())}]`);
}

function validateWorkflowEvidence(structured, body, workflow) {
  const allowed = new Set((body.sources || []).map((source) => source.source_id));
  for (const source of body.existingSourceIndex || []) allowed.add(source.source_id);
  // Some older dashboards predate the source index. Existing references and
  // uncited coach edits remain valid context; do not manufacture provenance.
  walk(body.currentBaseline, (id) => { allowed.add(id); return id; });
  const validateId = (id) => {
    if (!allowed.has(id)) throw new WorkflowContractError('The response contains an unrecognized source reference. Use only supplied source IDs.');
    return id;
  };
  if (workflow !== 'client_note_update') return walk(structured, validateId);

  for (const update of structured.sectionUpdates) {
    update.evidenceIds = (update.evidenceIds || []).map(validateId);
    if (!Array.isArray(update.value)) {
      update.value = walk(update.value, validateId);
      continue;
    }
    const previous = Array.isArray(body.currentBaseline?.[update.sectionKey])
      ? body.currentBaseline[update.sectionKey] : [];
    update.value = update.value.map((item) => {
      if (previous.some((old) => isDeepStrictEqual(old, item))) return item;
      let referenceCount = 0;
      const result = walk(item, (id) => { referenceCount += 1; return validateId(id); });
      if (item && typeof item === 'object' && !referenceCount) {
        throw new WorkflowContractError('A changed dashboard item is missing its own source reference. Add evidenceIds to each changed item, not just the section.');
      }
      return result;
    });
  }
  return structured;
}

module.exports = { createCitationStream, normalizeAnswerCitations, validateWorkflowEvidence };
