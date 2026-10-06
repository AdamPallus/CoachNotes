/* Text stays editable; recording and transcription never submit the surrounding form. */
const fieldDictation = (() => {
  const api = window.coachNotes;
  const staticFields = {
    noteTextInput: 'note', noteAnnotationInput: 'annotation', askPromptInput: 'request',
    askFollowupInput: 'follow-up', sourceTextInput: 'source text', coachNoteInput: 'coach note',
    todoDetailsInput: 'to-do details', coachApproachInput: 'coaching approach',
    messageStyleInput: 'message style', curriculumNotesInput: 'curriculum notes'
  };
  const globalFields = new Set(['sourceTextInput', 'coachNoteInput', 'coachApproachInput', 'messageStyleInput', 'curriculumNotesInput']);
  const widgets = new Map();
  let processing = null;
  let scheduled = false;
  const visible = (field) => field.isConnected && field.getClientRects().length > 0 && !field.closest('[hidden]');
  const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  const hide = (element, value) => { if (element.hidden !== value) element.hidden = value; };
  const errorText = (error) => String(error?.message || error).replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '');
  function keyFor(field) {
    const scope = globalFields.has(field.id) ? 'coach' : `client:${state.selectedClientId || state.selectedClientDetail?.client?.id || 'intake'}`;
    return `dictation:v1:${scope}:${field.dataset.dictation || field.id}`;
  }
  function contextFor(field) {
    return `${keyFor(field)}:${field.id.startsWith('ask') ? state.askResult?.sessionId || 'new' : ''}`;
  }
  function controls(widget) {
    const scope = widget.field.closest('.item-planning-controls, .item-radar-controls') || widget.field.form;
    const found = scope ? [...scope.querySelectorAll('button[type="submit"], .save-planning-item, .save-radar-item')] : [];
    const ids = widget.field.id.startsWith('ask') ? ['askFollowupBtn', 'newAskBtn']
      : ['sourceTextInput', 'coachNoteInput'].includes(widget.field.id) ? ['runIntakeBtn', 'addSourceBtn', 'resetIntakeBtn', 'clearSourcesBtn'] : [];
    return [...found, ...ids.map((id) => document.getElementById(id)).filter(Boolean)];
  }
  const activeWidget = () => widgets.get(dictationRecorder.owner?.field) || processing;
  function releaseControls(widget) {
    for (const [button, wasDisabled] of widget.locks) if (button.isConnected) button.disabled = wasDisabled;
    widget.locks.clear();
  }
  function render(widget) {
    const { field, button, status, meter, recovery, retry, remove } = widget;
    const noteState = widget.note ? noteCapture.dictationState(field.id) : null;
    const pending = noteState?.pending || widget.pending;
    const enabled = Boolean(staticFields[field.id] || field.dataset.dictation);
    hide(button, !enabled || Boolean(pending.length && dictationRecorder.owner?.field !== field));
    widget.shell.classList.toggle('dictation-enabled', enabled);
    const owner = dictationRecorder.owner?.field === field;
    const busy = processing === widget || Boolean(noteState?.busy);
    const noteBusy = widget.note && noteCapture.dictationBusy;
    const pressed = owner && dictationRecorder.phase !== 'stopping';
    button.setAttribute('aria-pressed', String(pressed));
    const title = pressed ? 'Stop dictation' : `Dictate ${widget.label}`;
    button.title = title; button.setAttribute('aria-label', title);
    button.disabled = field.disabled || field.readOnly || widget.loading || busy || noteBusy || (dictationRecorder.active && !owner) || Boolean(processing && !busy) || Boolean(pending.length && !owner);
    hide(meter, !owner);
    const message = noteState?.message || widget.message;
    hide(status, !(message || busy || pending.length) || owner);
    setText(status, busy ? (dictationRecorder.phase === 'opening' ? 'Opening microphone...' : 'Transcribing...') : message || `${pending.length === 1 ? 'Recording' : `${pending.length} recordings`} saved.`);
    status.classList.toggle('dictation-error', Boolean(message));
    hide(recovery, !enabled || !pending.length || owner || busy);
    retry.disabled = remove.disabled = dictationRecorder.active || Boolean(processing) || noteBusy;
    if (widget.note && pending.length && !owner && !busy) retry.dataset.transcribe = pending[0].id;
    else delete retry.dataset.transcribe;
    const hasFeedback = enabled && (!meter.hidden || !status.hidden || !recovery.hidden);
    hide(widget.feedback, !hasFeedback);
    widget.shell.classList.toggle('has-dictation-feedback', hasFeedback);
    if (!widget.note && (owner || busy)) {
      for (const control of controls(widget)) {
        if (!widget.locks.has(control)) widget.locks.set(control, control.disabled);
        control.disabled = true;
      }
    } else releaseControls(widget);
  }
  async function recover(widget) {
    if (widget.note) return;
    const key = widget.key;
    widget.loading = true; render(widget);
    try {
      const entries = await api.listDictations({ targetKey: key });
      if (widget.key === key) { widget.pending = entries; render(widget); }
    } catch (error) { widget.message = errorText(error); }
    finally { if (widget.key === key) widget.loading = false; render(widget); }
  }
  function snapshot(widget) {
    return { key: widget.key, context: contextFor(widget.field), epoch: widget.epoch, value: widget.field.value,
      end: widget.field.selectionEnd };
  }
  function stillHere(widget, origin) {
    return visible(widget.field) && origin.key === keyFor(widget.field) && origin.context === contextFor(widget.field) && origin.epoch === widget.epoch;
  }
  async function transcribe(widget, entry, origin = snapshot(widget)) {
    if (processing || dictationRecorder.active) return;
    processing = widget; widget.message = ''; refresh();
    try {
      const result = await api.processCapture({ id: entry.id });
      if (!stillHere(widget, origin)) return;
      const field = widget.field;
      // Never replace text typed during recording, or overwrite an existing selection.
      const unchanged = field.value === origin.value;
      const position = unchanged ? origin.end : field.value.length;
      const left = field.value.slice(0, position);
      const right = field.value.slice(position);
      const text = left + (left && !/\s$/.test(left) ? ' ' : '') + result.text + (right && !/^\s/.test(right) ? ' ' : '') + right;
      if (field.maxLength >= 0 && text.length > field.maxLength) throw new Error('Text is too long. Shorten it, then retry. Your recording is saved.');
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      widget.pending = widget.pending.filter((item) => item.id !== entry.id);
      await api.discardCaptures({ ids: [entry.id] }).catch(() => {});
    } catch (error) {
      widget.message = error.message.includes('Text is too long') ? error.message : 'Transcription failed. Recording saved.';
      widget.status.title = errorText(error);
    } finally { processing = null; refresh(); }
  }
  async function start(widget) {
    widget.message = '';
    if (widget.note) return noteCapture.start(widget.field);
    const origin = snapshot(widget);
    try {
      await dictationRecorder.start({ owner: { kind: 'field', field: widget.field }, targetKey: widget.key,
        onCreated: (entry) => { widget.pending.push(entry); },
        onAborted: (entry) => { widget.pending = widget.pending.filter((item) => item.id !== entry.id); },
        onMeter: (seconds, samples) => updateMeter(widget, seconds, samples),
        onError: (error) => { widget.message = error.message; refresh(); },
        onStopped: async (entry, shouldTranscribe) => {
          if (shouldTranscribe && stillHere(widget, origin)) await transcribe(widget, entry, origin);
          refresh();
        }
      });
    } catch (error) { widget.message = error.message; }
    refresh();
  }
  function updateMeter(widget, seconds, samples) {
    setText(widget.time, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 5:00`);
    widget.bars.forEach((bar, i) => { bar.style.height = `${3 + Math.min(15, samples[i * 4] / 15)}px`; });
  }
  function attach(field) {
    const shell = document.createElement('div'); shell.className = 'dictation-field';
    field.before(shell); shell.append(field);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'dictation-button';
    button.dataset.dictationFor = field.id || field.dataset.dictation;
    button.innerHTML = '<span class="capture-icon mic-icon" aria-hidden="true"></span>';
    shell.append(button);
    const feedback = document.createElement('div'); feedback.className = 'dictation-feedback'; feedback.hidden = true; shell.append(feedback);
    feedback.innerHTML = '<div class="dictation-meter" hidden><span class="recording-light"></span><span class="dictation-bars" aria-hidden="true">' + '<i></i>'.repeat(12) + '</span><span class="dictation-time">0:00 / 5:00</span></div><div class="dictation-status" role="status" hidden></div><div class="dictation-recovery" hidden><button type="button" class="btn btn-ghost">Retry transcription</button><button type="button" class="btn btn-subtle">Discard</button></div>';
    const widget = { field, shell, button, feedback, label: staticFields[field.id] || field.closest('label')?.querySelector('span')?.textContent.trim() || 'text',
      note: ['noteTextInput', 'noteAnnotationInput'].includes(field.id), pending: [], key: '', epoch: 0, shown: false, message: '', locks: new Map(),
      meter: feedback.querySelector('.dictation-meter'), time: feedback.querySelector('.dictation-time'), bars: [...feedback.querySelectorAll('i')],
      status: feedback.querySelector('.dictation-status'), recovery: feedback.querySelector('.dictation-recovery'),
      retry: feedback.querySelector('.dictation-recovery button'), remove: feedback.querySelector('.dictation-recovery button:last-child') };
    widgets.set(field, widget);
    button.onclick = () => {
      const action = dictationRecorder.owner?.field === field ? dictationRecorder.stop(true) : start(widget);
      action.catch((error) => { widget.message = error.message; refresh(); });
    };
    widget.retry.onclick = () => widget.note ? noteCapture.transcribe(noteCapture.dictationState(field.id).pending[0]?.id) : transcribe(widget, widget.pending[0]);
    widget.remove.onclick = async () => {
      try {
        if (widget.note) await noteCapture.removeRecording(noteCapture.dictationState(field.id).pending[0]?.id);
        else { await api.discardCaptures({ ids: widget.pending.map((entry) => entry.id) }); widget.pending = []; }
        widget.message = '';
      }
      catch (error) { widget.message = error.message; }
      refresh();
    };
    field.closest('dialog')?.addEventListener('close', () => {
      widget.epoch++; widget.shown = false; schedule();
      if (dictationRecorder.owner?.field === field) dictationRecorder.stop(false).catch((error) => { widget.message = error.message; });
    });
  }
  function refresh() {
    for (const field of document.querySelectorAll('textarea')) {
      if ((staticFields[field.id] || field.dataset.dictation) && !widgets.has(field)) attach(field);
    }
    for (const [field, widget] of widgets) {
      const shown = visible(field);
      const key = keyFor(field);
      if ((!shown && widget.shown) || key !== widget.key) {
        widget.epoch++;
        if (dictationRecorder.owner?.field === field) dictationRecorder.stop(false).catch((error) => { widget.message = error.message; });
      }
      if (shown && (!widget.shown || key !== widget.key)) {
        widget.key = key; widget.pending = []; widget.message = ''; recover(widget);
      }
      widget.shown = shown;
      render(widget);
      if (!field.isConnected && processing !== widget && dictationRecorder.owner?.field !== field) { releaseControls(widget); widgets.delete(field); }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true; queueMicrotask(() => { scheduled = false; refresh(); });
  }
  // Capture phase prevents existing submit handlers from running before transcription finishes.
  document.addEventListener('submit', (event) => {
    const widget = activeWidget();
    if (widget && widget.field.form === event.target) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('click', (event) => {
    const widget = activeWidget();
    if (widget && controls(widget).some((button) => button.contains(event.target))) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('dictation-state', schedule);
  window.addEventListener('dictation-meter', ({ detail }) => { const widget = widgets.get(detail.field); if (widget) updateMeter(widget, detail.seconds, detail.samples); });
  new MutationObserver((changes) => {
    if (changes.some((change) => change.type === 'attributes' || [...change.addedNodes, ...change.removedNodes].some((node) => node.nodeType === 1 && !node.closest?.('.dictation-feedback')))) schedule();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'data-dictation'] });
  refresh();
  return { refresh };
})();
