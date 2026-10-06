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

// Normalize presentation only: never infer a source number or substitute an ID.
function referenceIds(value) {
  let text = String(value).trim();
  if (/^\[[^\[\]\n]+\]$/.test(text)) text = text.slice(1, -1).trim();
  text = text.replace(/^c\s*:\s*/i, '');
  const parts = text.split(/\s*[,;]\s*/).map((id) => id.replace(/^c\s*:\s*/i, '').trim());
  if (parts.length > 1 && parts.every((id) => /^(?:intake_)?source_[A-Za-z0-9_-]+$/.test(id))) return parts;
  return [text];
}

function walk(value, visit) {
  if (Array.isArray(value)) return value.map((item) => walk(item, visit));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === 'evidenceIds' && Array.isArray(item)
        ? [...new Set(item.flatMap((id) => referenceIds(id).map(visit)))]
        : walk(item, visit)
    ]));
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\[\s*(?:[cC]\s*:\s*)?((?:intake_)?source_[^\]\n]+)\]/g,
    (marker, ids) => referenceIds(ids).map((id) => `[${visit(id)}]`).join(' '));
}

function workflowSourceIds(body) {
  const allowed = new Set((body.sources || []).map((source, index) => String(source.source_id || `source_${index + 1}`).trim()));
  for (const source of body.existingSourceIndex || []) {
    const id = String(source.source_id || '').trim();
    if (id) allowed.add(id);
  }
  // Some older dashboards predate the source index. Existing references and
  // uncited coach edits remain valid context; do not manufacture provenance.
  walk(body.currentBaseline, (id) => { allowed.add(id); return id; });
  return allowed;
}

function validateWorkflowEvidence(structured, body, workflow) {
  const allowed = workflowSourceIds(body);
  const validateId = (id) => {
    if (!allowed.has(id)) {
      const error = new WorkflowContractError('The response contains an unrecognized source reference. Use only supplied source IDs.');
      // Logs get only categories/counts. The rejected ID goes back to the model,
      // within this request, not to telemetry or the coach's error message.
      error.workflowDiagnostics = {
        code: 'unknown_source_reference',
        referenceForm: id === 'source_id' ? 'placeholder' : /^(?:intake_)?source_\d+$/.test(id) ? 'unknown_numbered_id' : 'other_format',
        allowedSourceCount: allowed.size
      };
      error.retryFeedback = `The rejected reference was ${JSON.stringify(id.slice(0, 200))}. Use exact IDs from the permitted list, not placeholders or altered IDs. Only cite evidence that actually supports the claim; do not guess a replacement or silently remove existing coach context.`;
      throw error;
    }
    return id;
  };
  if (workflow !== 'client_note_update') return walk(structured, validateId);

  for (const update of structured.sectionUpdates) {
    update.evidenceIds = [...new Set((update.evidenceIds || []).flatMap((id) => referenceIds(id).map(validateId)))];
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
        const error = new WorkflowContractError('A changed dashboard item is missing its own source reference. Add evidenceIds to each changed item, not just the section.');
        error.workflowDiagnostics = { code: 'missing_item_reference', sectionKey: update.sectionKey };
        throw error;
      }
      return result;
    });
  }
  return structured;
}

module.exports = { createCitationStream, normalizeAnswerCitations, validateWorkflowEvidence, workflowSourceIds };
