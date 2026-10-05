/* One microphone owner, shared by note capture and field dictation. */
const dictationRecorder = (() => {
  const api = window.coachNotes;
  let job = null;
  const changed = () => window.dispatchEvent(new Event('dictation-state'));
  async function start(options) {
    if (job) throw new Error('Finish the current recording first.');
    const session = { ...options, phase: 'opening', cancelled: false, writes: Promise.resolve() };
    job = session; changed();
    session.opening = (async () => {
      try {
        if (!await api.microphonePermission()) throw new Error('Enable CoachNotes microphone access in macOS Privacy & Security.');
        if (session.cancelled) return;
        session.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (session.cancelled) return;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm' : 'audio/mp4';
        session.entry = await api.beginRecording({ mimeType, targetKey: options.targetKey, targetField: options.targetField });
        session.recorder = new MediaRecorder(session.stream, { mimeType, audioBitsPerSecond: 24000 });
        session.context = new AudioContext();
        const analyser = session.context.createAnalyser(); analyser.fftSize = 256;
        session.context.createMediaStreamSource(session.stream).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        await options.onCreated?.(session.entry);
        if (session.cancelled) return;
        session.recorder.ondataavailable = (event) => {
          if (event.data.size) session.writes = session.writes.then(async () => api.appendRecording({ id: session.entry.id, bytes: new Uint8Array(await event.data.arrayBuffer()) }));
          session.writes.catch((error) => { options.onError?.(error); stop(false).catch(options.onError); });
        };
        session.recorder.onerror = () => { options.onError?.(new Error('Recording stopped unexpectedly. Recorded audio is kept for retry.')); stop(false).catch(options.onError); };
        const started = Date.now();
        session.meter = setInterval(() => {
          analyser.getByteFrequencyData(samples);
          options.onMeter?.(Math.min(300, Math.floor((Date.now() - started) / 1000)), samples);
        }, 100);
        session.recorder.start(1000); session.phase = 'recording'; changed();
        session.deadline = setTimeout(() => stop(true).catch(options.onError), 300000);
      } catch (error) {
        session.cancelled = true;
        throw error;
      } finally {
        if (session.cancelled) {
          session.stream?.getTracks().forEach((track) => track.stop());
          await session.context?.close().catch(() => {});
          try {
            if (session.entry) {
              await api.endRecording({ id: session.entry.id });
              await api.discardCaptures({ ids: [session.entry.id] });
              await options.onAborted?.(session.entry);
            }
          } finally { job = null; changed(); }
        }
      }
    })();
    return session.opening;
  }
  async function stop(transcribe = true) {
    const session = job;
    if (!session) return;
    if (session.phase === 'opening') {
      session.cancelled = true;
      await session.opening.catch(() => {});
      return;
    }
    if (session.stopping) return session.stopping;
    session.stopping = (async () => {
      session.phase = 'stopping'; changed();
      clearTimeout(session.deadline); clearInterval(session.meter);
      const recorder = session.recorder;
      const stopped = new Promise((resolve) => { if (recorder.state === 'inactive') resolve(); else recorder.onstop = resolve; });
      if (recorder.state !== 'inactive') recorder.stop();
      session.stream?.getTracks().forEach((track) => track.stop());
      await session.context?.close().catch(() => {});
      await stopped;
      let failure;
      try { await session.writes; } catch (error) { failure = error; }
      try { await api.endRecording({ id: session.entry.id }); } catch (error) { failure ||= error; }
      finally { job = null; changed(); }
      await session.onStopped?.(session.entry, transcribe && !failure);
      if (failure) throw failure;
    })();
    return session.stopping;
  }
  api.onRecordingStop(({ id }) => { if (job?.entry?.id === id) stop(true).catch(job.onError); });
  window.addEventListener('beforeunload', () => {
    job?.stream?.getTracks().forEach((track) => track.stop());
    if (job?.entry) api.endRecording({ id: job.entry.id }).catch(() => {});
  });
  return { start, stop, get owner() { return job?.owner; }, get phase() { return job?.phase || ''; }, get active() { return Boolean(job); } };
})();
