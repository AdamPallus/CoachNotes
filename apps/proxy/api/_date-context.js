function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

function dateContext(currentDate, now = new Date()) {
  const supplied = validDate(currentDate);
  const date = supplied ? currentDate : now.toISOString().slice(0, 10);
  return [
    `Reference date: ${date}${supplied ? ' (provided by the coach app)' : ' (server UTC date; the coach-local date may differ)'}.`,
    'Do not assume an unspecified meeting occurs after a future trip or event. Describe future plans as future; when meeting timing is unknown, use conditional phrasing.',
    'A task due on the reference date is due today, not overdue. Only earlier unfinished deadlines are overdue. If the local date or deadline is uncertain, state the actual date instead of inventing urgency.'
  ].join(' ');
}

function taskDueState(task, currentDate) {
  if (!task || typeof task !== 'object') return 'unknown';
  if (['done', 'completed', 'abandoned', 'outdated', 'resolved'].includes(String(task.status || '').toLowerCase())) return 'closed';
  if (!validDate(task.dueDate)) return 'unknown';
  return task.dueDate < currentDate ? 'overdue' : task.dueDate === currentDate ? 'due_today' : 'upcoming';
}

module.exports = { dateContext, taskDueState, validDate };
