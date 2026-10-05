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
  let recorder = null;
  let stream = null;
  let recordingId = null;
  let stopTimer;
  let clockTimer;
  let audioContext;
  let recordingWrite = Promise.resolve();
  let stopPromise = null;
  let working = false;
  let statusText = '';
  let suppressSave = false;
  const error = (err) => showNoteError(err.message || String(err));
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
    byId('noteCaptureList').innerHTML = [...images, ...recordings].map((item) => `
      <div class="capture-item">
        ${item.preview ? `<img src="${item.preview}" alt="Attached image preview" />` : ''}
        <strong>${escapeHtml(item.name)}</strong>
        ${item.kind === 'audio' ? `<button type="button" class="btn btn-ghost" data-transcribe="${item.id}" ${recordingId === item.id || working ? 'disabled' : ''}>Transcribe</button>` : ''}
        <button type="button" class="btn btn-subtle" data-remove-capture="${item.id}" ${recordingId === item.id || working ? 'disabled' : ''}>Remove</button>
      </div>`).join('');
    byId('dictateNoteLabel').textContent = recorder ? 'Stop Recording' : 'Dictate';
    byId('dictateNoteBtn').setAttribute('aria-pressed', recorder ? 'true' : 'false');
    byId('recordingStatus').hidden = !recorder;
    els.updateNoteSubmitBtn.disabled = Boolean(recorder || working || state.noteRetryBlocked);
    for (const id of ['attachNoteImagesBtn', 'captureNoteImageBtn', 'discardNoteDraftBtn']) byId(id).disabled = Boolean(recorder || working);
    byId('dictateNoteBtn').disabled = working;
    els.cancelAddNoteBtn.disabled = working;
    byId('captureStatus').hidden = !working;
    byId('captureStatus').textContent = statusText;
  }
  async function open(id) {
    if (working) throw new Error('Please wait for attachment processing to finish.');
    await stop(false);
    await save();
    suppressSave = true;
    clientId = id;
    images = []; recordings = [];
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
    if (working || recorder) return;
    working = true; statusText = 'Transcribing your recording...'; render(); clearNoteError();
    try {
      const result = await api.processCapture({ id });
      els.noteTextInput.value = [els.noteTextInput.value.trimEnd(), result.text].filter(Boolean).join('\n\n');
      recordings = recordings.filter((item) => item.id !== id);
      await save();
      await api.discardCaptures({ ids: [id] }).catch(() => {});
    } catch (err) { error(new Error(`Transcription failed. Your recording is saved; press Transcribe to retry. ${err.message}`)); }
    finally { working = false; render(); }
  }
  async function start() {
    if (recorder || working) return;
    working = true; statusText = 'Opening microphone...'; render(); clearNoteError();
    try {
      if (!await api.microphonePermission()) throw new Error('Microphone access is off. Enable CoachNotes in macOS Privacy & Security > Microphone.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm' : 'audio/mp4';
      const entry = await api.beginRecording({ mimeType });
      recordingId = entry.id;
      recordings.push(entry);
      await save();
      const id = entry.id;
      recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 });
      recordingWrite = Promise.resolve();
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingWrite = recordingWrite.then(async () => api.appendRecording({ id, bytes: new Uint8Array(await event.data.arrayBuffer()) }));
        recordingWrite.catch((err) => { error(err); stop(false).catch(error); });
      };
      recorder.onerror = () => { error(new Error('Recording stopped unexpectedly. Any recorded audio is saved below.')); stop(false).catch(error); };
      const started = Date.now();
      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const canvas = byId('recordingWaveform');
      const ctx = canvas.getContext('2d');
      clockTimer = setInterval(() => {
        const seconds = Math.min(300, Math.floor((Date.now() - started) / 1000));
        byId('recordingTime').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 5:00`;
        analyser.getByteFrequencyData(samples);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--moss');
        for (let i = 0; i < 30; i++) {
          const height = Math.max(2, samples[i * 3] / 255 * 30);
          ctx.fillRect(i * 6, (32 - height) / 2, 3, height);
        }
      }, 100);
      recorder.start(1000);
      stopTimer = setTimeout(() => stop(true).catch(error), 300000);
    } catch (err) {
      clearInterval(clockTimer); clearTimeout(stopTimer);
      await audioContext?.close().catch(() => {});
      stream?.getTracks().forEach((track) => track.stop());
      if (recordingId) await api.endRecording({ id: recordingId }).catch(() => {});
      recordingId = null; recorder = null; error(err);
    } finally { working = false; render(); }
  }
  async function stop(shouldTranscribe = true) {
    if (stopPromise) return stopPromise;
    if (!recorder) return;
    const current = recorder;
    const id = recordingId;
    stopPromise = (async () => {
      clearTimeout(stopTimer); clearInterval(clockTimer);
      const stopped = new Promise((resolve) => { if (current.state === 'inactive') resolve(); else current.onstop = resolve; });
      if (current.state !== 'inactive') current.stop();
      stream?.getTracks().forEach((track) => track.stop());
      await audioContext?.close().catch(() => {});
      await stopped;
      try { await recordingWrite; }
      finally { await api.endRecording({ id }); }
    })();
    try { await stopPromise; }
    finally { recorder = null; recordingId = null; stopPromise = null; render(); }
    await save();
    if (shouldTranscribe) await transcribe(id);
  }
  async function prepare() {
    if (recorder || working) throw new Error('Finish recording or transcription first.');
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
    clearTimeout(timer); clientId = null; images = []; recordings = []; requestId = ''; render();
  }
  async function discard() {
    if (!confirm('Discard this draft and its attachments?')) return;
    await stop(false); await queue.catch(() => {});
    clearTimeout(timer);
    const ids = [...images, ...recordings].map((item) => item.id).concat(state.noteSources.flatMap((source) => source.attachmentIds || []));
    await api.saveNoteDraft({ clientId, draft: null });
    await api.discardCaptures({ ids });
    requestId = crypto.randomUUID(); images = []; recordings = [];
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
  byId('dictateNoteBtn').onclick = () => (recorder ? stop(true) : start()).catch(error);
  byId('discardNoteDraftBtn').onclick = () => discard().catch(error);
  byId('noteCaptureList').onclick = async (event) => {
    const transcribeId = event.target.closest('[data-transcribe]')?.dataset.transcribe;
    if (transcribeId) return transcribe(transcribeId);
    const remove = event.target.closest('[data-remove-capture]')?.dataset.removeCapture;
    if (remove) { images = images.filter((item) => item.id !== remove); recordings = recordings.filter((item) => item.id !== remove); render(); try { await save(); await api.discardCaptures({ ids: [remove] }); } catch (err) { error(err); } }
  };
  api.onRecordingStop(({ id }) => { if (id === recordingId) stop(true).catch(error); });
  window.addEventListener('beforeunload', () => { stream?.getTracks().forEach((track) => track.stop()); save().catch(() => {}); });
  return { open, save, scheduleSave, prepare, complete, stop, hasDraft: () => Boolean(images.length || recordings.length || state.noteSources.length || fields.slice(1).some((id) => id !== 'noteDateInput' && byId(id).value.trim())) };
})();
