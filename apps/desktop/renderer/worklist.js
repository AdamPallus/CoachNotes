const dailyWorklist = (() => {
  const api = window.coachNotes;
  const byId = id => document.getElementById(id);
  const dialog = byId('worklistDialog');
  const roster = byId('worklistRoster');
  const strip = byId('dailyWorklistStrip');
  let data;
  let busy = false;
  let draggedId = null;
  const candidate = id => data.candidates.find(c => c.id === id);
  const eligible = entry => entry.status === 'pending';
  function error(err) {
    if (dialog.open) { byId('worklistError').textContent = cleanError(err); byId('worklistError').hidden = false; }
    else showToast(cleanError(err), 'error');
  }
  function lock(value) {
    busy = value;
    dialog.querySelectorAll('button,input').forEach(el => { el.disabled = value; });
    strip.querySelectorAll('button').forEach(el => { el.disabled = value; });
  }
  async function load() { data = await api.getWorklist(); renderStrip(); }
  async function save(rules) {
    data = await api.saveWorklist({ day: data.day, plan: data.plan, rules });
    renderStrip();
  }
  async function act(fn) {
    if (busy) return;
    const committed = data && structuredClone(data);
    lock(true); byId('worklistError').hidden = true;
    try {
      if (data && data.day !== todayLocalDate()) { await load(); throw new Error('A new day has started. Review today\'s selection before continuing.'); }
      await fn();
    } catch (err) {
      // Re-read committed state after a failed write; never show an unsaved completion.
      data = committed;
      try { await load(); } catch { /* Keep the last visible list on a read failure. */ }
      error(err);
    } finally { lock(false); if (dialog.open) renderRoster(); renderStrip(); }
  }
  function fillRules() {
    byId('worklistDue').checked = data.rules.due;
    byId('worklistAlerts').checked = data.rules.alerts;
    byId('worklistStale').checked = data.rules.stale;
    byId('worklistDays').value = data.rules.staleDays;
  }
  async function open(settings = false) {
    if (busy) return;
    try {
      await load(); fillRules(); byId('worklistError').hidden = true;
      byId('worklistSearch').value = ''; byId('worklistRules').open = settings;
      renderRoster(); dialog.showModal();
    } catch (err) { error(err); }
  }
  function reasons(client, entry) {
    return [...new Set([...(entry?.reasons || []), ...client.reasons.map(r => r.text)])];
  }
  function renderRoster() {
    if (!data) return;
    const entries = data.plan.entries;
    const selected = new Set(entries.map(e => e.clientId));
    const rows = [...entries.map(e => candidate(e.clientId)), ...data.candidates.filter(c => !selected.has(c.id))];
    const query = byId('worklistSearch').value.trim().toLowerCase();
    byId('worklistDate').textContent = formatDate(data.day);
    byId('worklistCount').textContent = `${entries.length} selected`;
    byId('startWorklistBtn').textContent = data.plan.started ? 'Resume Review' : 'Begin Review';
    roster.innerHTML = rows.filter(c => c.name.toLowerCase().includes(query)).map(client => {
      const index = entries.findIndex(e => e.clientId === client.id);
      const entry = entries[index];
      const detail = reasons(client, entry);
      return `<div class="worklist-row ${entry ? 'is-selected' : ''}" data-worklist-row="${client.id}" draggable="${Boolean(entry) && !query}">
        <label class="worklist-select"><input type="checkbox" data-worklist-select="${client.id}" ${entry ? 'checked' : ''} /><span><strong>${escapeHtml(client.name)}</strong><small>${entry ? `${index + 1} &middot; ${escapeHtml(entry.status === 'pending' ? 'Review client' : entry.status === 'later' ? `Later${entry.deferredUntil ? `: ${formatDate(entry.deferredUntil)}` : ' today'}` : entry.status)}` : 'Not selected'}</small></span></label>
        <div class="worklist-row-controls"><label class="worklist-message"><input type="checkbox" data-worklist-message="${client.id}" ${entry?.message ? 'checked' : ''} /> New message</label>
        ${entry ? `<button type="button" data-worklist-up="${client.id}" title="Move ${escapeHtml(client.name)} up" aria-label="Move ${escapeHtml(client.name)} up" ${index === 0 ? 'disabled' : ''}>&uarr;</button><button type="button" data-worklist-down="${client.id}" title="Move ${escapeHtml(client.name)} down" aria-label="Move ${escapeHtml(client.name)} down" ${index === entries.length - 1 ? 'disabled' : ''}>&darr;</button>` : ''}</div>
        <div class="worklist-context">${detail.length ? `<ul>${detail.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}${entry?.focus ? `<p>${escapeHtml(entry.focus)}</p>` : ''}${client.radar.length ? `<p class="worklist-radar">On the radar: ${escapeHtml(client.radar.join('; '))}</p>` : ''}${client.hasDraft ? '<p>Note draft saved; dashboard not updated.</p>' : ''}
        ${entry && entry.status !== 'pending' ? `<button class="btn btn-subtle" type="button" data-worklist-reopen="${client.id}">Return to Today</button>` : ''}</div></div>`;
    }).join('') || '<p class="muted">No matching clients.</p>';
  }
  function renderStrip() {
    if (!data) return;
    const { plan } = data;
    byId('openWorklistBtn').textContent = plan.started ? 'Today' : 'Start of Day';
    strip.hidden = !plan.started;
    if (!plan.started) return;
    const entry = plan.entries.find(e => e.clientId === plan.currentId);
    const client = entry && candidate(entry.clientId);
    const remaining = plan.entries.filter(e => ['pending', 'later'].includes(e.status)).length;
    const onClient = client && state.viewMode === 'detail' && state.selectedClientId === client.id;
    strip.innerHTML = `<div class="worklist-strip-head"><button class="btn btn-ghost" type="button" data-worklist-edit>Today &middot; ${remaining} remaining</button><span>${escapeHtml(formatDate(data.day))}</span></div>
      ${client ? `<div class="worklist-strip-body"><div class="worklist-current"><strong>${plan.entries.indexOf(entry) + 1} of ${plan.entries.length} &middot; ${escapeHtml(client.name)}</strong><span>${escapeHtml(entry.focus || 'Review this client and decide what needs attention.')}</span><small>${escapeHtml([entry.message ? 'New message' : '', ...reasons(client, entry)].filter(Boolean).join(' · '))}</small>${client.hasDraft ? '<small>Note draft saved; dashboard not updated.</small>' : ''}${client.radar.length ? `<small>On the radar: ${escapeHtml(client.radar.join('; '))}</small>` : ''}</div>
      <div class="worklist-strip-actions">${onClient ? '' : '<button class="btn btn-primary" type="button" data-worklist-open>Resume Client</button>'}
      ${onClient && eligible(entry) ? '<button class="btn btn-primary" type="button" data-worklist-status="done">Done for Today</button><button class="btn btn-ghost" type="button" data-worklist-status="later">Later Today</button><button class="btn btn-ghost" type="button" data-worklist-tomorrow>Tomorrow</button><button class="btn btn-subtle" type="button" data-worklist-status="skipped">Skip</button>' : `<span>${entry.status === 'pending' ? '' : escapeHtml(entry.status === 'later' ? 'Deferred' : entry.status === 'done' ? 'Reviewed today' : 'Skipped today')}</span>`}
      <button class="btn btn-ghost" type="button" data-worklist-next>Next &rarr;</button></div></div>` : `<div class="worklist-strip-body"><strong>${remaining ? 'Clients deferred for later.' : 'Today\'s review is complete.'}</strong><button class="btn btn-ghost" type="button" data-worklist-edit>Review List</button><button class="btn btn-primary" type="button" data-worklist-wrapup>End of Day</button></div>`}`;
  }
  new ResizeObserver(() => {
    els.mainSurface.style.setProperty('--strip-height', `${strip.hidden ? 0 : strip.getBoundingClientRect().height}px`);
  }).observe(strip);
  function add(clientId) {
    let entry = data.plan.entries.find(e => e.clientId === clientId);
    if (!entry) {
      const client = candidate(clientId);
      if (!client) throw new Error('This client is no longer active.');
      entry = { clientId, status: 'pending', reasons: client.reasons.map(r => r.text), message: false, focus: '', deferredUntil: '' };
      data.plan.entries.push(entry);
    }
    return entry;
  }
  async function navigate(id) {
    data.plan.currentId = id;
    await save();
    if (id) {
      await selectClient(id);
      if (state.selectedClientId !== id || state.viewMode !== 'detail') throw new Error('Could not open the next client. Your place is saved.');
    }
    renderStrip();
  }
  async function next() {
    const entries = data.plan.entries;
    const index = entries.findIndex(e => e.clientId === data.plan.currentId);
    const ordered = [...entries.slice(index + 1), ...entries.slice(0, index + 1)];
    const target = ordered.find(eligible);
    await navigate(target?.clientId || null);
  }
  roster.addEventListener('change', event => act(async () => {
    const select = event.target.dataset.worklistSelect;
    const message = event.target.dataset.worklistMessage;
    if (select) {
      const id = Number(select);
      if (event.target.checked) add(id);
      else data.plan.entries = data.plan.entries.filter(e => e.clientId !== id);
    } else if (message) add(Number(message)).message = event.target.checked;
    await save();
  }));
  roster.addEventListener('click', event => {
    const button = event.target.closest('[data-worklist-up],[data-worklist-down],[data-worklist-reopen]');
    if (!button) return;
    act(async () => {
      const id = Number(button.dataset.worklistUp || button.dataset.worklistDown || button.dataset.worklistReopen);
      const entries = data.plan.entries;
      const index = entries.findIndex(e => e.clientId === id);
      if (button.dataset.worklistReopen) { entries[index].status = 'pending'; entries[index].deferredUntil = ''; }
      else { const to = index + (button.dataset.worklistUp ? -1 : 1); if (to >= 0 && to < entries.length) [entries[index], entries[to]] = [entries[to], entries[index]]; }
      await save();
    });
  });
  roster.addEventListener('dragstart', event => {
    if (busy || event.target.closest('input,button') || byId('worklistSearch').value) { event.preventDefault(); return; }
    draggedId = Number(event.target.closest('[data-worklist-row]')?.dataset.worklistRow);
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(draggedId));
  });
  roster.addEventListener('dragover', event => { if (draggedId) event.preventDefault(); });
  roster.addEventListener('dragend', () => { draggedId = null; });
  roster.addEventListener('drop', event => {
    event.preventDefault(); const from = draggedId; draggedId = null;
    const to = Number(event.target.closest('[data-worklist-row]')?.dataset.worklistRow);
    act(async () => {
      const entries = data.plan.entries;
      const a = entries.findIndex(e => e.clientId === from), b = entries.findIndex(e => e.clientId === to);
      if (a >= 0 && b >= 0) { const [entry] = entries.splice(a, 1); entries.splice(b, 0, entry); await save(); }
    });
  });
  strip.addEventListener('click', event => {
    if (event.target.closest('[data-worklist-edit]')) { open(); return; }
    if (event.target.closest('[data-worklist-wrapup]')) { dailyWrapup.open(); return; }
    if (!event.target.closest('button')) return;
    act(async () => {
      const entry = data.plan.entries.find(e => e.clientId === data.plan.currentId);
      if (event.target.closest('[data-worklist-open]')) { await navigate(entry.clientId); return; }
      const status = event.target.closest('[data-worklist-status]')?.dataset.worklistStatus;
      if (status || event.target.closest('[data-worklist-tomorrow]')) {
        if (state.viewMode !== 'detail' || state.selectedClientId !== entry.clientId) return;
        entry.status = status || 'later'; entry.deferredUntil = '';
        if (!status) { const date = currentLocalDate(); date.setDate(date.getDate() + 1); entry.deferredUntil = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
        await save();
      }
      await next();
    });
  });
  byId('startWorklistBtn').onclick = () => act(async () => {
    const started = data.plan.started;
    data.plan.started = true;
    const current = started && data.plan.entries.find(e => e.clientId === data.plan.currentId && eligible(e));
    await navigate(current?.clientId || data.plan.entries.find(eligible)?.clientId || null);
    dialog.close();
  });
  byId('suggestWorklistBtn').onclick = () => act(async () => {
    const score = entry => Math.min(candidate(entry.clientId).rank, entry.message ? 4 : 99);
    data.plan.entries.sort((a, b) => score(a) - score(b) || data.candidates.indexOf(candidate(a.clientId)) - data.candidates.indexOf(candidate(b.clientId)));
    await save();
  });
  byId('saveWorklistRulesBtn').onclick = () => act(async () => {
    const staleDays = Number(byId('worklistDays').value);
    if (!Number.isInteger(staleDays) || staleDays < 1 || staleDays > 90) throw new Error('Choose between 1 and 90 days.');
    await save({ due: byId('worklistDue').checked, alerts: byId('worklistAlerts').checked, stale: byId('worklistStale').checked, staleDays });
    byId('worklistRules').open = false;
  });
  byId('worklistSearch').oninput = renderRoster;
  byId('closeWorklistBtn').onclick = () => { if (!busy) dialog.close(); };
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  byId('openWorklistBtn').onclick = () => open();
  byId('worklistSettingsBtn').onclick = () => open(true);
  document.addEventListener('coachnotes:navigation', renderStrip);
  document.addEventListener('coachnotes:clients-updated', () => { if (!busy && !dialog.open) load().catch(error); });
  byId('wrapupDialog').addEventListener('close', () => { if (!busy) load().catch(error); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-worklist-weekly]');
    if (!button) return;
    act(async () => {
      await load();
      const id = Number(button.dataset.worklistWeekly);
      const saved = state.viewMode === 'detail' ? (state.selectedClientDetail?.weeklyReview || state.weeklyReview) : state.weeklyReview;
      const review = saved?.report?.clientReviews?.find(r => Number(r.clientId) === id);
      const entry = add(id);
      entry.status = 'pending'; entry.deferredUntil = '';
      entry.focus = review?.suggestedCoachFocus ? `Weekly Review (${formatDate(saved.weekOf)}): ${review.suggestedCoachFocus}` : 'Review this client\'s Weekly Review.';
      await save(); button.textContent = 'Added to Today';
    });
  });
  window.addEventListener('focus', () => { if (!busy && !dialog.open) load().catch(error); });
  // IPC is available by the time the renderer is loaded; no client data leaves this Mac.
  load().catch(error);
  return { open, refresh: load };
})();
