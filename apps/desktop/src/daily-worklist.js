const { localDate, isCalendarDay } = require('./daily-wrapup');

const DEFAULT_RULES = { due: true, alerts: true, stale: true, staleDays: 7 };
function normalizeRules(value = {}) {
  const result = { ...DEFAULT_RULES };
  for (const key of ['due', 'alerts', 'stale']) if (typeof value[key] === 'boolean') result[key] = value[key];
  if (Number.isInteger(value.staleDays) && value.staleDays >= 1 && value.staleDays <= 90) result.staleDays = value.staleDays;
  return result;
}
function daysBetween(a, b) {
  return Math.floor((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}
function buildCandidates({ clients, home, lastNotes, flags = [], day, rules }) {
  const attention = home?.attention || {};
  const candidates = clients.filter(c => !c.archived).map(client => {
    const reasons = [];
    const add = (items, rank, prefix) => (items || []).filter(item => item.clientId === client.id).forEach(item => {
      if (!reasons.some(reason => reason.key === `${item.sectionKey}:${item.itemIndex}`)) {
        reasons.push({ key: `${item.sectionKey}:${item.itemIndex}`, rank, text: `${prefix}: ${item.title}`, dueDate: item.dueDate || '' });
      }
    });
    if (rules.due) { add(attention.overdueTasks, 0, 'Overdue'); add(attention.dueTodayTasks, 1, 'Due today'); }
    if (rules.alerts) { add(attention.highPriorityItems, 2, 'High priority'); add(flags, 3, 'Flag'); }
    const lastNoteDay = localDate(lastNotes[client.id]);
    if (rules.stale && (!lastNoteDay || daysBetween(lastNoteDay, day) >= rules.staleDays)) {
      reasons.push({ key: 'stale', rank: 5, text: lastNoteDay ? `No note recorded for ${daysBetween(lastNoteDay, day)} days` : 'No note recorded' });
    }
    return { id: client.id, name: client.name, reasons, rank: Math.min(99, ...reasons.map(r => r.rank)),
      lastNoteDay, radar: (attention.radarItems || []).filter(item => item.clientId === client.id).map(item => item.title),
      summary: client.summary || '' };
  });
  return candidates.sort((a, b) => a.rank - b.rank
    || (a.reasons[0]?.dueDate || '').localeCompare(b.reasons[0]?.dueDate || '')
    || a.name.localeCompare(b.name));
}
function normalizePlan(value, candidates) {
  const valid = new Set(candidates.map(c => c.id));
  const entries = [];
  for (const entry of Array.isArray(value?.entries) ? value.entries : []) {
    const clientId = Number(entry.clientId);
    if (!valid.has(clientId) || entries.some(item => item.clientId === clientId)) continue;
    entries.push({ clientId, status: ['pending', 'done', 'later', 'skipped'].includes(entry.status) ? entry.status : 'pending',
      deferredUntil: isCalendarDay(entry.deferredUntil) ? entry.deferredUntil : '',
      focus: String(entry.focus || '').slice(0, 1600), message: Boolean(entry.message),
      reasons: (Array.isArray(entry.reasons) ? entry.reasons : []).filter(r => typeof r === 'string').map(r => r.slice(0, 300)).slice(0, 30) });
  }
  return { entries, started: Boolean(value?.started), currentId: value?.currentId === null ? null : entries.some(e => e.clientId === value?.currentId) ? value.currentId : (entries[0]?.clientId || null), revision: Number.isSafeInteger(value?.revision) ? value.revision : 0 };
}
function createPlan(candidates, previous, day) {
  const entries = [];
  if (previous) {
    for (const entry of normalizePlan(previous, candidates).entries) {
      if ((previous.started || entry.reasons.includes('Carried forward')) && ['pending', 'later'].includes(entry.status)) entries.push({ ...entry, status: entry.deferredUntil > day ? 'later' : 'pending', reasons: [...entry.reasons.filter(r => r !== 'Carried forward'), 'Carried forward'] });
    }
  }
  for (const client of candidates) {
    if (client.reasons.length && !entries.some(e => e.clientId === client.id)) entries.push({ clientId: client.id, status: 'pending', reasons: client.reasons.map(r => r.text) });
  }
  return normalizePlan({ entries }, candidates);
}

module.exports = { normalizeRules, buildCandidates, normalizePlan, createPlan, daysBetween };
