const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coachNotes', {
  visualDate: process.env.COACHNOTES_VISUAL_DATE || '',
  getNoteDraft: (payload) => ipcRenderer.invoke('app:get-note-draft', payload),
  saveNoteDraft: (payload) => ipcRenderer.invoke('app:save-note-draft', payload),
  getWrapup: (payload) => ipcRenderer.invoke('app:get-wrapup', payload),
  getWorklist: () => ipcRenderer.invoke('app:get-worklist'),
  saveWorklist: (payload) => ipcRenderer.invoke('app:save-worklist', payload),
  addWrapupTask: (payload) => ipcRenderer.invoke('app:add-wrapup-task', payload),
  saveWrapup: (payload) => ipcRenderer.invoke('app:save-wrapup', payload),
  selectNoteImages: () => ipcRenderer.invoke('app:select-note-images'),
  pasteNoteImage: (payload) => ipcRenderer.invoke('app:paste-note-image', payload),
  captureNoteImage: () => ipcRenderer.invoke('app:capture-note-image'),
  microphonePermission: () => ipcRenderer.invoke('app:microphone-permission'),
  beginRecording: (payload) => ipcRenderer.invoke('app:begin-recording', payload),
  listDictations: (payload) => ipcRenderer.invoke('app:list-dictations', payload),
  appendRecording: (payload) => ipcRenderer.invoke('app:append-recording', payload),
  endRecording: (payload) => ipcRenderer.invoke('app:end-recording', payload),
  processCapture: (payload) => ipcRenderer.invoke('app:process-capture', payload),
  getCapture: (payload) => ipcRenderer.invoke('app:get-capture', payload),
  discardCaptures: (payload) => ipcRenderer.invoke('app:discard-captures', payload),
  openNoteAttachment: (payload) => ipcRenderer.invoke('app:open-note-attachment', payload),
  onRecordingStop: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:recording-stop', listener);
    return () => ipcRenderer.removeListener('app:recording-stop', listener);
  },
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveSettings: (payload) => ipcRenderer.invoke('app:save-settings', payload),
  selectVaultFolder: () => ipcRenderer.invoke('app:select-vault-folder'),
  selectIntakeFiles: () => ipcRenderer.invoke('app:select-intake-files'),
  generateClientBaseline: (payload) => ipcRenderer.invoke('app:generate-client-baseline', payload),
  acceptClientBaseline: (payload) => ipcRenderer.invoke('app:accept-client-baseline', payload),
  updateClientSection: (payload) => ipcRenderer.invoke('app:update-client-section', payload),
  updateClientSections: (payload) => ipcRenderer.invoke('app:update-client-sections', payload),
  undoClientSection: (payload) => ipcRenderer.invoke('app:undo-client-section', payload),
  updateClientFromNote: (payload) => ipcRenderer.invoke('app:update-client-from-note', payload),
  askClient: (payload) => ipcRenderer.invoke('app:ask-client', payload),
  saveAskResultAsNote: (payload) => ipcRenderer.invoke('app:save-ask-result-as-note', payload),
  deleteClient: (payload) => ipcRenderer.invoke('app:delete-client', payload),
  setClientArchived: (payload) => ipcRenderer.invoke('app:set-client-archived', payload),
  getClients: (payload) => ipcRenderer.invoke('app:get-clients', payload),
  getCoachHome: () => ipcRenderer.invoke('app:get-coach-home'),
  getWeeklyReview: () => ipcRenderer.invoke('app:get-weekly-review'),
  generateWeeklyReview: () => ipcRenderer.invoke('app:generate-weekly-review'),
  onWeeklyReviewProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:weekly-review-progress', listener);
    return () => ipcRenderer.removeListener('app:weekly-review-progress', listener);
  },
  getClientDetail: (payload) => ipcRenderer.invoke('app:get-client-detail', payload),
  revealVault: () => ipcRenderer.invoke('app:reveal-vault')
});
