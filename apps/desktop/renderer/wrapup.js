const dailyWrapup = (() => {
  const api = window.coachNotes;
  const dialog = document.getElementById('wrapupDialog');
  const content = document.getElementById('wrapupContent');
  const date = document.getElementById('wrapupDate');
  const errorPanel = document.getElementById('wrapupError');
  let data;
  let progress;
  let cursor = 0;
  let deferred = new Set();
  let activeDay = null;
  let saving = Promise.resolve();
  const error = (err) => { errorPanel.textContent = err.message; errorPanel.hidden = false; };
  const save = () => {
    const payload = { day: data.day, progress: structuredClone(progress) };
    saving = saving.catch(() => {}).then(() => api.saveWrapup(payload));
    return saving;
  };
  async function load(day) {
    await saving;
    data = await api.getWrapup({ day });
    progress = data.progress || { selected: data.clients.filter((item) => item.activity.length).map((item) => item.id), done: {}, started: false };
    cursor = 0;
    deferred = new Set();
    date.value = day;
    date.max = todayLocalDate();
    errorPanel.hidden = true;
    render();
  }
  async function open() {
    try { activeDay = null; await load(todayLocalDate()); dialog.showModal(); }
    catch (err) { showToast(`Could not open wrap-up: ${err.message}`, 'error'); }
  }
  function render() {
    date.disabled = Boolean(activeDay);
    if (!progress.started) {
      content.innerHTML = `<h3>Who did you work with?</h3><p class="muted">Clients updated in CoachNotes on ${escapeHtml(formatDate(data.day))} are selected. Add anyone else you worked with.</p><input id="wrapupSearch" type="search" placeholder="Find a client..." aria-label="Find a client" /><div class="wrapup-roster">${data.clients.map((client) => `<label class="wrapup-client" data-wrapup-name="${escapeHtml(client.name.toLowerCase())}"><input type="checkbox" data-wrapup-client="${client.id}" ${progress.selected.includes(client.id) ? 'checked' : ''} /><span><strong>${escapeHtml(client.name)}</strong><small>${client.activity.length ? `${client.activity.length} updates in CoachNotes` : 'No CoachNotes activity'}</small></span></label>`).join('')}</div><button class="btn btn-primary" type="button" data-wrapup-start>Review ${progress.selected.length} clients</button>`;
      return;
    }
    const pending = progress.selected.filter((id) => !progress.done[id]);
    const completed = Object.keys(progress.done).length;
    if (!pending.length) {
      const updated = Object.values(progress.done).filter((status) => status === 'updated').length;
      content.innerHTML = `<section class="wrapup-complete"><p class="section-kicker">Day complete</p><h3>All caught up.</h3><p>${completed} client${completed === 1 ? '' : 's'} reviewed. ${updated} dashboard${updated === 1 ? '' : 's'} updated.</p></section><button class="btn btn-ghost" type="button" data-wrapup-select>Review more clients</button>`;
      return;
    }
    const ready = pending.filter((id) => !deferred.has(id));
    if (!ready.length) {
      content.innerHTML = `<section class="wrapup-step"><h3>${pending.length} client${pending.length === 1 ? '' : 's'} left for later.</h3><p>${completed} of ${progress.selected.length} reviewed.</p><button class="btn btn-primary" type="button" data-wrapup-resume>Resume Review</button></section>`;
      return;
    }
    cursor %= ready.length;
    const client = data.clients.find((item) => item.id === ready[cursor]);
    content.innerHTML = `<section class="wrapup-step"><p class="muted">${completed} of ${progress.selected.length} reviewed &middot; ${pending.length} remaining</p><h3>${escapeHtml(client.name)}</h3>${client.activity.map((item) => `<div class="wrapup-activity"><strong>${escapeHtml(item.title)}</strong>${item.sourceDate ? `<small> &middot; Note dated ${escapeHtml(formatDate(item.sourceDate))}</small>` : ''}<p>${escapeHtml(item.text || '')}</p></div>`).join('') || '<p class="muted">No CoachNotes activity for this day.</p>'}<p>Any updates or follow-ups to capture?</p><div class="capture-toolbar"><button class="btn btn-primary" type="button" data-wrapup-add="${client.id}">Add Update</button><button class="btn btn-ghost" type="button" data-wrapup-none="${client.id}">No Further Updates</button><button class="btn btn-subtle" type="button" data-wrapup-later="${client.id}">Come Back Later</button></div><button class="btn btn-subtle" type="button" data-wrapup-select>Change client selection</button></section>`;
  }
  content.addEventListener('input', (event) => {
    if (event.target.id === 'wrapupSearch') content.querySelectorAll('[data-wrapup-name]').forEach((row) => { row.hidden = !row.dataset.wrapupName.includes(event.target.value.toLowerCase()); });
  });
  content.addEventListener('change', (event) => {
    if (!event.target.matches('[data-wrapup-client]')) return;
    const id = Number(event.target.dataset.wrapupClient);
    progress.selected = event.target.checked ? [...new Set([...progress.selected, id])] : progress.selected.filter((value) => value !== id);
    if (!event.target.checked) delete progress.done[id];
    content.querySelector('[data-wrapup-start]').textContent = `Review ${progress.selected.length} clients`;
    save().catch(error);
  });
  content.addEventListener('click', async (event) => {
    try {
      const add = event.target.closest('[data-wrapup-add]');
      const none = event.target.closest('[data-wrapup-none]');
      if (add) {
        await save();
        activeDay = data.day;
        dialog.close();
        await selectClient(Number(add.dataset.wrapupAdd));
        await openAddNoteDialog();
      } else if (none) {
        const id = Number(none.dataset.wrapupNone);
        const draft = await api.getNoteDraft({ clientId: id });
        if (draft && (draft.sources?.length || draft.imageIds?.length || draft.recordingIds?.length || draft.fields?.noteTextInput?.trim())) {
          throw new Error('This client has an unfinished note draft. Add Update to finish it or discard the draft first.');
        }
        progress.done[id] = 'no-updates';
        await save(); render();
      } else if (event.target.closest('[data-wrapup-start]')) {
        if (!progress.selected.length) throw new Error('Select at least one client.');
        progress.selected.sort((a, b) => data.clients.find((c) => c.id === a).name.localeCompare(data.clients.find((c) => c.id === b).name));
        progress.started = true; await save(); render();
      } else if (event.target.closest('[data-wrapup-later]')) { deferred.add(Number(event.target.closest('[data-wrapup-later]').dataset.wrapupLater)); render(); }
      else if (event.target.closest('[data-wrapup-resume]')) { deferred = new Set(); render(); }
      else if (event.target.closest('[data-wrapup-select]')) { progress.started = false; await save(); render(); }
    } catch (err) { error(err); }
  });
  document.getElementById('openWrapupBtn').onclick = open;
  document.getElementById('closeWrapupBtn').onclick = async () => { try { await save(); activeDay = null; dialog.close(); } catch (err) { error(err); } };
  date.onchange = () => load(date.value).catch(error);
  els.addNoteDialog.addEventListener('close', () => {
    if (activeDay && !state.busyCount) setTimeout(async () => {
      if (!activeDay || state.busyCount || els.addNoteDialog.open) return;
      try { await noteCapture.save(); await load(activeDay); dialog.showModal(); activeDay = null; }
      catch (err) { error(err); }
    }, 0);
  });
  document.getElementById('askFollowupBtn').onclick = (event) => submitAsk(event, true);
  document.getElementById('newAskBtn').onclick = () => { resetAskDialog(); els.askPromptInput.focus(); };
  els.detailContent.addEventListener('click', async (event) => {
    const attachment = event.target.closest('[data-note-attachment]');
    if (attachment) {
      try { const message = await api.openNoteAttachment({ sourceId: Number(attachment.dataset.noteAttachment), index: Number(attachment.dataset.attachmentIndex) }); if (message) throw new Error(message); }
      catch (err) { showToast(err.message, 'error'); }
    }
    if (event.target.closest('[data-full-weekly-review]')) { state.coachHomeTab = 'weekly'; openCoachHome(); }
  });
  return { open, get activeDay() { return activeDay; }, async afterUpdate() {
    if (!activeDay) return;
    const day = activeDay; activeDay = null;
    await load(day); dialog.showModal();
  } };
})();
