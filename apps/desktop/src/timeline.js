function timelineDateKey(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return '';
  }
  const raw = String(item.date || item.dateLabel || '').trim();
  if (!raw || raw.toLowerCase() === 'unknown') {
    return '';
  }

  const isoDate = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }
  const isoMonth = raw.match(/\b(\d{4})-(\d{2})\b/);
  if (isoMonth) {
    return `${isoMonth[1]}-${isoMonth[2]}-01`;
  }
  const year = raw.match(/\b(19|20)\d{2}\b/);
  if (!year) {
    return '';
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return `${year[0]}-01-01`;
}

function sortTimelineItemsChronologically(values) {
  return (Array.isArray(values) ? values : [])
    .map((value, index) => ({ value, index, dateKey: timelineDateKey(value) }))
    .sort((left, right) => {
      if (left.dateKey && right.dateKey) {
        return left.dateKey.localeCompare(right.dateKey) || left.index - right.index;
      }
      if (left.dateKey) return -1;
      if (right.dateKey) return 1;
      return left.index - right.index;
    })
    .map(({ value }) => value);
}

function normalizeStructuredTimeline(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.timeline)) {
    return value;
  }
  return {
    ...value,
    timeline: sortTimelineItemsChronologically(value.timeline)
  };
}

module.exports = {
  normalizeStructuredTimeline,
  sortTimelineItemsChronologically,
  timelineDateKey
};
