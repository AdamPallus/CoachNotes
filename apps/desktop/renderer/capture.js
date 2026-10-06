/* Durable composer state is independent of the dashboard update transaction. */
const noteCapture = (() => {
  const api = window.coachNotes;
  const byId = (id) => document.getElementById(id);
  const fields = ['noteSourceTypeInput', 'noteTitleInput', 'noteDateInput', 'noteAnnotationInput', 'noteTextInput'];
  let clientId = null;
  let requestId = '';
  let images = [];
  let recordings = [];
  let timer;
  let queue = Promise.resolve();
  let recordingId = null;
  let working = false;
  let statusText = '';
  let dictationField = '';
  const dictationMessages = new Map();
  let suppressSave = false;
  const error = (err) => showNoteError(err.message || String(err));
  const recording = () => dictationRecorder.owner?.kind === 'note';
  function snapshot() {
    return { requestId, fields: Object.fromEntries(fields.map((id) => [id, byId(id).value])),
      sources: state.noteSources, imageIds: images.map((item) => item.id), recordingIds: recordings.map((item) => item.id) };
  }
  function save() {
    clearTimeout(timer);
    if (!clientId || suppressSave) return queue;
    const payload = { clientId, draft: snapshot() };
    queue = queue.catch(() => {}).then(() => api.saveNoteDraft(payload));
    return queue;
  }
  function scheduleSave() {
    if (!suppressSave) { clearTimeout(timer); timer = setTimeout(() => save().catch(error), 180); }
  }
  function render() {
    byId('noteCaptureList').innerHTML = images.map((item) => `
      <div class="capture-item">
        ${item.preview ? `<img src="${item.preview}" alt="Attached image preview" />` : ''}
        <strong>${escapeHtml(item.name)}</strong>
        <button type="button" class="btn btn-subtle" data-remove-capture="${item.id}" ${recordingId === item.id || working ? 'disabled' : ''}>Remove</button>
      </div>`).join('');
    els.updateNoteSubmitBtn.disabled = Boolean(recording() || working || state.noteRetryBlocked);
    for (const id of ['attachNoteImagesBtn', 'captureNoteImageBtn', 'discardNoteDraftBtn']) byId(id).disabled = Boolean(recording() || working);
    els.cancelAddNoteBtn.disabled = working;
    byId('captureStatus').hidden = !working || Boolean(dictationField);
    byId('captureStatus').textContent = statusText;
    window.dispatchEvent(new Event('dictation-state'));
  }
  async function open(id) {
    if (working) throw new Error('Please wait for attachment processing to finish.');
    await stop(false);
    await save();
    suppressSave = true;
    clientId = id;
    images = []; recordings = []; dictationField = ''; dictationMessages.clear();
    requestId = crypto.randomUUID();
    try {
      resetNoteDialog();
      const draft = await api.getNoteDraft({ clientId });
      if (draft) {
        requestId = draft.requestId || requestId;
        for (const key of fields) if (draft.fields?.[key] !== undefined) byId(key).value = draft.fields[key];
        state.noteSources = draft.sources || [];
        for (const [ids, target] of [[draft.imageIds, images], [draft.recordingIds, recordings]]) {
          for (const captureId of ids || []) target.push(await api.getCapture({ id: captureId }));
        }
      }
      renderNoteSources(); syncChoiceGroups(); resizeNoteAnnotation(); render();
    } finally { suppressSave = false; }
  }
  async function addImages(items) {
    if (images.length + items.length > 6) throw new Error('Attach up to six images per note.');
    images.push(...items); render(); await save();
  }
  async function transcribe(id) {
    if (working || recording()) return;
    const entry = recordings.find((item) => item.id === id);
    if (!entry) return;
    dictationField = entry.targetField || 'noteTextInput'; dictationMessages.delete(dictationField);
    working = true; statusText = 'Transcribing your recording...'; render(); clearNoteError();
    try {
      const result = await api.processCapture({ id });
      const field = byId(result.targetField || 'noteTextInput');
      field.value = [field.value.trimEnd(), result.text].filter(Boolean).join('\n\n');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      recordings = recordings.filter((item) => item.id !== id);
      await save();
      await api.discardCaptures({ ids: [id] }).catch(() => {});
    } catch { dictationMessages.set(dictationField, 'Transcription failed. Recording saved.'); }
    finally { working = false; dictationField = ''; render(); }
  }
  async function start(field = els.noteTextInput) {
    if (dictationRecorder.active || working) return;
    dictationField = field.id; dictationMessages.delete(field.id);
    const recordingError = (err) => { dictationMessages.set(field.id, err.message || String(err)); render(); };
    working = true; statusText = 'Opening microphone...'; render(); clearNoteError();
    try {
      await dictationRecorder.start({ owner: { kind: 'note', field }, targetField: field.id,
        onCreated: async (entry) => { recordingId = entry.id; recordings.push(entry); await save(); },
        onAborted: async (entry) => { recordings = recordings.filter((item) => item.id !== entry.id); recordingId = null; await save(); },
        onMeter: (seconds, samples) => window.dispatchEvent(new CustomEvent('dictation-meter', { detail: { field, seconds, samples } })),
        onError: recordingError,
        onStopped: async (entry, shouldTranscribe) => { recordingId = null; render(); await save(); if (shouldTranscribe) await transcribe(entry.id); }
      });
    } catch (err) {
      recordingId = null; recordingError(err);
    } finally { working = false; dictationField = ''; render(); }
  }
  async function stop(shouldTranscribe = true) {
    if (recording()) await dictationRecorder.stop(shouldTranscribe);
  }
  async function prepare() {
    if (recording() || working) throw new Error('Finish recording or transcription first.');
    if (recordings.length) throw new Error('Transcribe or remove the saved recording before updating.');
    working = true; statusText = 'Reading attached images...'; render();
    try {
      await save();
      const parts = [];
      for (const item of images) {
        const result = await api.processCapture({ id: item.id });
        parts.push(`Attached image: ${item.name}\n${result.text}`);
      }
      if (images.length) {
        addNoteSources([{ title: els.noteTitleInput.value || 'Client note with images', sourceType: els.noteSourceTypeInput.value,
          sourceDate: els.noteDateInput.value, annotation: els.noteAnnotationInput.value,
          rawText: [els.noteTextInput.value.trim(), ...parts].filter(Boolean).join('\n\n'), attachmentIds: images.map((item) => item.id) }]);
        images = [];
        els.noteTextInput.value = ''; els.noteTitleInput.value = ''; els.noteAnnotationInput.value = '';
      } else addPastedNoteSource({ silent: true });
      await save();
      return { requestId, clientId };
    } finally { working = false; render(); }
  }
  function complete() {
    clearTimeout(timer); clientId = null; images = []; recordings = []; requestId = ''; dictationMessages.clear(); render();
  }
  async function removeRecording(id) {
    if (working || recording()) return;
    const entry = recordings.find((item) => item.id === id);
    if (!entry) return;
    const previous = recordings;
    recordings = recordings.filter((item) => item.id !== id);
    try { await save(); }
    catch (err) { recordings = previous; throw err; }
    dictationMessages.delete(entry.targetField || 'noteTextInput'); render();
    await api.discardCaptures({ ids: [id] });
  }
  async function discard() {
    if (!confirm('Discard this draft and its attachments?')) return;
    await stop(false); await queue.catch(() => {});
    clearTimeout(timer);
    const ids = [...images, ...recordings].map((item) => item.id).concat(state.noteSources.flatMap((source) => source.attachmentIds || []));
    await api.saveNoteDraft({ clientId, draft: null });
    await api.discardCaptures({ ids });
    requestId = crypto.randomUUID(); images = []; recordings = []; dictationMessages.clear();
    suppressSave = true; resetNoteDialog(); suppressSave = false; render();
  }
  for (const field of fields) byId(field).addEventListener('input', scheduleSave);
  els.addNoteForm.addEventListener('change', scheduleSave);
  els.addNoteForm.addEventListener('click', scheduleSave);
  els.addNoteDialog.addEventListener('close', () => { stop(false).then(save).catch(error); });
  els.addNoteDialog.addEventListener('cancel', (event) => { if (working) event.preventDefault(); });
  els.noteTextInput.addEventListener('paste', async (event) => {
    const files = [...event.clipboardData.items].filter((item) => item.type.startsWith('image/')).map((item) => item.getAsFile());
    if (!files.length) return;
    event.preventDefault();
    try { for (const file of files) await addImages([await api.pasteNoteImage({ bytes: new Uint8Array(await file.arrayBuffer()), name: file.name || 'Pasted image' })]); }
    catch (err) { error(err); }
  });
  byId('attachNoteImagesBtn').onclick = () => api.selectNoteImages().then(addImages).catch(error);
  byId('captureNoteImageBtn').onclick = () => api.captureNoteImage().then((item) => item && addImages([item])).catch(error);
  byId('discardNoteDraftBtn').onclick = () => discard().catch(error);
  byId('noteCaptureList').onclick = async (event) => {
    const remove = event.target.closest('[data-remove-capture]')?.dataset.removeCapture;
    if (remove) { images = images.filter((item) => item.id !== remove); recordings = recordings.filter((item) => item.id !== remove); render(); try { await save(); await api.discardCaptures({ ids: [remove] }); } catch (err) { error(err); } }
  };
  window.addEventListener('beforeunload', () => { save().catch(() => {}); });
  return { open, save, scheduleSave, prepare, complete, stop, start, transcribe, removeRecording,
    dictationState: (fieldId) => ({ pending: recordings.filter((item) => (item.targetField || 'noteTextInput') === fieldId),
      busy: working && dictationField === fieldId, message: dictationMessages.get(fieldId) || '' }),
    get dictationBusy() { return working; }, hasDraft: () => Boolean(images.length || recordings.length || state.noteSources.length || fields.slice(1).some((id) => id !== 'noteDateInput' && byId(id).value.trim())) };
})();
