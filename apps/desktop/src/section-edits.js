const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

function sectionRevision(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function hasStructuredItems(value) {
  return Array.isArray(value) && value.some(item => item !== null && typeof item === 'object');
}

function assertSectionEdit(current, payload) {
  if (Object.hasOwn(payload, 'expectedValue') && !isDeepStrictEqual(current, payload.expectedValue)) {
    throw new Error('This section changed while you were editing. Your changes have not been saved. Reopen the section before trying again.');
  }
  if (payload.textEditor && hasStructuredItems(current)) {
    throw new Error('This section contains structured items. Use its individual item controls to preserve dates, status, and sources.');
  }
}

function completePlanningItem(items, { itemIndex, expectedRevision }) {
  if (!Array.isArray(items) || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length
      || !expectedRevision || sectionRevision(items) !== expectedRevision) {
    throw new Error('The list changed since Mission Control was loaded. Refresh and try again. Nothing was marked complete.');
  }
  return items.map((item, index) => index !== itemIndex ? item : {
    ...(item && typeof item === 'object' ? item : { title: String(item || '') }),
    planningStatus: 'completed'
  });
}

module.exports = { sectionRevision, hasStructuredItems, assertSectionEdit, completePlanningItem };
