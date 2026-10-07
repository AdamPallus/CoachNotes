const dailyWrapup = (() => {
  const api = window.coachNotes;
  const dialog = document.getElementById('wrapupDialog');
  const content = document.getElementById('wrapupContent');
  const actions = document.getElementById('wrapupActions');
  const date = document.getElementById('wrapupDate');
  const errorPanel = document.getElementById('wrapupError');
  let data;
  let progress;
  let activeDay = null;
  let activeClientId = null;
  let working = false;
  let followupSaved = '';
  let followupSavedFor = null;
  let saving = Promise.resolve();
  const error = (err) => {
    errorPanel.textContent = String(err.message || err).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
    errorPanel.hidden = false;
  };
  const tomorrow = () => {
    const date = currentLocalDate(); date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  function lock(value) {
    working = value;
    dialog.querySelectorAll('button, input').forEach((control) => { control.disabled = value; });
    date.disabled = value || Boolean(activeDay);
  }
  function composerLabels(inWrapup) {
    els.cancelAddNoteBtn.textContent = inWrapup ? 'Save Draft & Next' : 'Save & Close';
    els.updateNoteSubmitBtn.textContent = inWrapup ? 'Update Dashboard & Next' : 'Update Dashboard';
  }
  const save = () => {
    const payload = { day: data.day, progress: structuredClone(progress) };
    saving = saving.catch(() => {}).then(() => api.saveWrapup(payload));
    return saving;
  };
  async function load(day) {
    await saving;
    data = await api.getWrapup({ day });
    progress = data.progress || { selected: data.clients.filter((item) => item.activity.length).map((item) => item.id), done: {}, started: false };
    progress.deferred ||= [];
    progress.followupDrafts ||= {};
    followupSaved = '';
    date.value = day;
    date.max = todayLocalDate();
    errorPanel.hidden = true;
    render();
  }
  async function open() {
    try { activeDay = null; activeClientId = null; composerLabels(false); await load(todayLocalDate()); dialog.showModal(); }
    catch (err) { showToast(`Could not open wrap-up: ${err.message}`, 'error'); }
  }
  function render() {
    actions.innerHTML = '';
    content.scrollTop = 0;
    date.disabled = Boolean(activeDay);
    if (!progress.started) {
      content.innerHTML = `<h3>Who did you work with?</h3><p class="muted">Clients updated in CoachNotes on ${escapeHtml(formatDate(data.day))} are selected. Add anyone else you worked with.</p><input id="wrapupSearch" type="search" placeholder="Find a client..." aria-label="Find a client" /><div class="wrapup-roster">${data.clients.map((client) => `<label class="wrapup-client" data-wrapup-name="${escapeHtml(client.name.toLowerCase())}"><input type="checkbox" data-wrapup-client="${client.id}" ${progress.selected.includes(client.id) ? 'checked' : ''} /><span><strong>${escapeHtml(client.name)}</strong><small>${client.activity.length ? `${client.activity.length} updates in CoachNotes` : 'No CoachNotes activity'}</small></span></label>`).join('')}</div><button class="btn btn-primary" type="button" data-wrapup-start>Review ${progress.selected.length} clients</button>`;
      return;
    }
    const pending = progress.selected.filter((id) => !progress.done[id] || progress.followupDrafts[id]?.title?.trim());
    const completed = progress.selected.length - pending.length;
    if (!pending.length) {
      const updated = Object.values(progress.done).filter((status) => status === 'updated').length;
      content.innerHTML = `<section class="wrapup-complete"><p class="section-kicker">Day complete</p><h3>All caught up.</h3><p>${completed} client${completed === 1 ? '' : 's'} reviewed. ${updated} dashboard${updated === 1 ? '' : 's'} updated.</p></section><button class="btn btn-ghost" type="button" data-wrapup-select>Review more clients</button>`;
      return;
    }
    const ready = pending.filter((id) => !progress.deferred.includes(id));
    if (!ready.length) {
      content.innerHTML = `<section class="wrapup-step"><h3>${pending.length} client${pending.length === 1 ? '' : 's'} left for later.</h3><p>${completed} of ${progress.selected.length} reviewed.</p><ul class="wrapup-pending">${pending.map((id) => { const client = data.clients.find((item) => item.id === id); return `<li><strong>${escapeHtml(client.name)}</strong><span>${client.hasDraft ? 'Note draft saved - dashboard not updated' : 'Not yet reviewed'}${progress.followupDrafts[id]?.title ? ' · Follow-up not yet added' : ''}</span></li>`; }).join('')}</ul><button class="btn btn-primary" type="button" data-wrapup-resume>Resume Review</button></section>`;
      return;
    }
    const client = data.clients.find((item) => item.id === ready[0]);
    const draft = progress.followupDrafts[client.id] || {};
    content.innerHTML = `<section class="wrapup-step"><p class="muted">${completed} of ${progress.selected.length} reviewed &middot; ${pending.length} remaining</p><h3>${escapeHtml(client.name)}</h3>${client.hasDraft ? '<p class="wrapup-draft-status">Note draft saved - dashboard not updated</p>' : ''}${client.activity.map((item) => `<div class="wrapup-activity"><strong>${escapeHtml(item.title)}</strong>${item.sourceDate ? `<small> &middot; Note dated ${escapeHtml(formatDate(item.sourceDate))}</small>` : ''}<p>${escapeHtml(item.text || '')}</p></div>`).join('') || '<p class="muted">No CoachNotes activity for this day.</p>'}
      <form class="wrapup-followup" data-wrapup-task="${client.id}">
        <label for="wrapupTaskTitle">Follow-up to schedule</label>
        <input id="wrapupTaskTitle" name="title" maxlength="180" required placeholder="Send the updated workout" value="${escapeHtml(draft.title || '')}" />
        <div class="wrapup-task-controls"><label for="wrapupTaskDate">Due<input id="wrapupTaskDate" name="dueDate" type="date" required value="${escapeHtml(draft.dueDate || tomorrow())}" /></label><button type="submit" class="btn btn-ghost">Add Follow-up</button></div>
        <p class="wrapup-task-status" role="status" ${followupSaved && followupSavedFor === client.id ? '' : 'hidden'}>${escapeHtml(followupSaved)}</p>
      </form>
      <button class="btn btn-subtle" type="button" data-wrapup-select>Change client selection</button></section>`;
    actions.innerHTML = `<button class="btn btn-ghost" type="button" data-wrapup-add="${client.id}">${client.hasDraft ? 'Finish Note' : 'Add Update'}</button><button class="btn btn-subtle" type="button" data-wrapup-later="${client.id}">Later</button><button class="btn btn-primary" type="button" data-wrapup-next="${client.id}">Next</button>`;
  }
  content.addEventListener('input', (event) => {
    if (event.target.id === 'wrapupSearch') content.querySelectorAll('[data-wrapup-name]').forEach((row) => { row.hidden = !row.dataset.wrapupName.includes(event.target.value.toLowerCase()); });
    if (event.target.closest('[data-wrapup-task]')) {
      const id = Number(event.target.closest('[data-wrapup-task]').dataset.wrapupTask);
      progress.followupDrafts[id] = { title: document.getElementById('wrapupTaskTitle').value, dueDate: document.getElementById('wrapupTaskDate').value,
        requestId: progress.followupDrafts[id]?.requestId || crypto.randomUUID() };
      save().catch(error);
    }
  });
  content.addEventListener('change', (event) => {
    if (!event.target.matches('[data-wrapup-client]')) return;
    const id = Number(event.target.dataset.wrapupClient);
    if (!event.target.checked && progress.followupDrafts[id]?.title?.trim()) {
      event.target.checked = true;
      error(new Error('This client has an unfinished follow-up. Add or clear it before removing the client.'));
      return;
    }
    progress.selected = event.target.checked ? [...new Set([...progress.selected, id])] : progress.selected.filter((value) => value !== id);
    if (!event.target.checked) { delete progress.done[id]; progress.deferred = progress.deferred.filter((value) => value !== id); }
    content.querySelector('[data-wrapup-start]').textContent = `Review ${progress.selected.length} clients`;
    save().catch(error);
  });
  content.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-wrapup-task]')) return;
    event.preventDefault();
    if (working) return;
    const clientId = Number(event.target.dataset.wrapupTask);
    const draft = { title: document.getElementById('wrapupTaskTitle').value, dueDate: document.getElementById('wrapupTaskDate').value,
      requestId: progress.followupDrafts[clientId]?.requestId || crypto.randomUUID() };
    progress.followupDrafts[clientId] = draft;
    lock(true); errorPanel.hidden = true;
    try {
      await save();
      const task = await api.addWrapupTask({ day: data.day, clientId, ...draft });
      delete progress.followupDrafts[clientId];
      followupSaved = `Added: ${task.title} - due ${formatDate(task.dueDate)}`;
      followupSavedFor = clientId;
      render();
      content.querySelector('.wrapup-task-status:not([hidden])')?.scrollIntoView({ block: 'nearest' });
      try {
        await loadClients();
        if (state.selectedClientId === clientId) {
          state.selectedClientDetail = await api.getClientDetail({ clientId });
          renderClientDetail(state.selectedClientDetail);
        }
      } catch { error(new Error('Follow-up saved. Reopen the client if it is not visible yet.')); }
    } catch (err) { error(err); }
    finally { lock(false); }
  });
  dialog.addEventListener('click', async (event) => {
    if (working || !event.target.closest('[data-wrapup-add], [data-wrapup-next], [data-wrapup-start], [data-wrapup-later], [data-wrapup-resume], [data-wrapup-select]')) return;
    lock(true); errorPanel.hidden = true;
    try {
      const add = event.target.closest('[data-wrapup-add]');
      const next = event.target.closest('[data-wrapup-next]');
      if (add) {
        await save();
        activeDay = data.day;
        activeClientId = Number(add.dataset.wrapupAdd);
        dialog.close();
        await selectClient(activeClientId);
        if (state.selectedClientDetail?.client?.id !== activeClientId) throw new Error('Could not open this client. Please try again.');
        await openAddNoteDialog();
        composerLabels(true);
      } else if (next) {
        const id = Number(next.dataset.wrapupNext);
        if (progress.followupDrafts[id]?.title?.trim()) throw new Error('Add the follow-up first, or choose Later to keep it as a draft.');
        if (data.clients.find((item) => item.id === id)?.hasDraft) throw new Error('Finish the saved note first, or choose Later. The dashboard has not been updated.');
        progress.done[id] ||= 'no-updates';
        await save(); followupSaved = ''; render();
      } else if (event.target.closest('[data-wrapup-start]')) {
        if (!progress.selected.length) throw new Error('Select at least one client.');
        progress.started = true; await save(); render();
      } else if (event.target.closest('[data-wrapup-later]')) { progress.deferred.push(Number(event.target.closest('[data-wrapup-later]').dataset.wrapupLater)); await save(); followupSaved = ''; render(); }
      else if (event.target.closest('[data-wrapup-resume]')) { progress.deferred = []; await save(); render(); }
      else if (event.target.closest('[data-wrapup-select]')) { progress.started = false; await save(); render(); }
    } catch (err) {
      error(err);
      if (activeDay && !els.addNoteDialog.open) { activeDay = null; activeClientId = null; composerLabels(false); dialog.showModal(); }
    }
    finally { lock(false); }
  });
  document.getElementById('openWrapupBtn').onclick = open;
  document.getElementById('closeWrapupBtn').onclick = async () => { if (working) return; try { await save(); activeDay = null; dialog.close(); } catch (err) { error(err); } };
  dialog.addEventListener('cancel', (event) => { if (working) event.preventDefault(); });
  date.onchange = () => load(date.value).catch(error);
  els.addNoteDialog.addEventListener('cancel', (event) => { if (working) event.preventDefault(); });
  els.addNoteDialog.addEventListener('close', () => {
    if (activeDay && !state.busyCount && !working) setTimeout(async () => {
      if (!activeDay || state.busyCount || working || els.addNoteDialog.open) return;
      try { await noteCapture.stop(false); await noteCapture.save(); await load(activeDay); dialog.showModal(); activeDay = null; activeClientId = null; composerLabels(false); }
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
  return { open, get activeDay() { return activeDay; }, get navigating() { return working && Boolean(activeDay); }, async saveDraftAndNext() {
    if (!activeDay || working) return;
    working = true; els.cancelAddNoteBtn.disabled = true;
    try {
      await noteCapture.stop(false); await noteCapture.save();
      if (noteCapture.hasDraft() || progress.followupDrafts[activeClientId]?.title?.trim()) progress.deferred.push(activeClientId);
      else progress.done[activeClientId] ||= 'no-updates';
      await save();
      els.addNoteDialog.close();
    } finally { working = false; els.cancelAddNoteBtn.disabled = false; }
  }, async afterUpdate() {
    if (!activeDay) return;
    const day = activeDay; activeDay = null;
    activeClientId = null; composerLabels(false);
    await load(day); dialog.showModal();
  } };
})();
