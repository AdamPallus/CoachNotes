function localDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDayActivity({ clients, sources, revisions, day }) {
  const result = new Map(clients.map((client) => [client.id, { ...client, activity: [] }]));
  for (const source of sources) {
    if (localDate(source.createdAt) !== day || !result.has(source.clientId)) continue;
    result.get(source.clientId).activity.push({ title: source.title, text: source.rawText?.slice(0, 1000) || '', sourceDate: source.sourceDate, kind: 'note' });
  }
  for (const revision of revisions) {
    if (localDate(revision.createdAt) !== day || !result.has(revision.clientId) || /^AI update/.test(revision.reason || '')) continue;
    const activity = result.get(revision.clientId).activity;
    if (!activity.some((item) => item.section === revision.section)) activity.push({ title: `Edited ${revision.section}`, section: revision.section, kind: 'edit' });
  }
  for (const client of result.values()) {
    if (!client.activity.length && localDate(client.updatedAt) === day) client.activity.push({ title: 'Updated client profile', kind: 'edit' });
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeWrapup(value, clients) {
  const ids = new Set(clients.map((client) => Number(client.id)));
  const selected = [...new Set((value?.selected || []).map(Number))].filter((id) => ids.has(id));
  const done = {};
  for (const id of selected) if (['updated', 'no-updates'].includes(value?.done?.[id])) done[id] = value.done[id];
  const followupDrafts = {};
  for (const id of selected) {
    const draft = value?.followupDrafts?.[id];
    if (draft && typeof draft.title === 'string' && draft.title.trim()) {
      followupDrafts[id] = { title: draft.title.slice(0, 180), dueDate: String(draft.dueDate || '').slice(0, 10), requestId: String(draft.requestId || '').slice(0, 80) };
    }
  }
  const deferred = [...new Set((value?.deferred || []).map(Number))].filter((id) => selected.includes(id) && (!done[id] || followupDrafts[id]));
  return { selected, done, deferred, followupDrafts, started: Boolean(value?.started), updatedAt: new Date().toISOString() };
}

function isCalendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function buildWrapupTask({ title, dueDate }) {
  if (typeof title !== 'string' || !title.trim() || title.length > 180) throw new Error('Enter a follow-up of up to 180 characters.');
  if (!isCalendarDay(dueDate)) throw new Error('Choose a valid due date.');
  return { title: title.trim(), dueDate, details: '', priority: 'none', planningStatus: 'active', evidenceIds: [] };
}

function hasNoteDraft(draft) {
  return Boolean(draft && (draft.sources?.length || draft.imageIds?.length || draft.recordingIds?.length
    || ['noteTextInput', 'noteTitleInput', 'noteAnnotationInput'].some((key) => draft.fields?.[key]?.trim())));
}

module.exports = { localDate, buildDayActivity, normalizeWrapup, isCalendarDay, buildWrapupTask, hasNoteDraft };
