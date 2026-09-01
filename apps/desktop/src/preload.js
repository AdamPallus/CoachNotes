const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coachNotes', {
  visualDate: process.env.COACHNOTES_VISUAL_DATE || '',
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
  getClients: () => ipcRenderer.invoke('app:get-clients'),
  getCoachHome: () => ipcRenderer.invoke('app:get-coach-home'),
  getWeeklyReview: () => ipcRenderer.invoke('app:get-weekly-review'),
  generateWeeklyReview: () => ipcRenderer.invoke('app:generate-weekly-review'),
  getClientDetail: (payload) => ipcRenderer.invoke('app:get-client-detail', payload),
  revealVault: () => ipcRenderer.invoke('app:reveal-vault')
});
