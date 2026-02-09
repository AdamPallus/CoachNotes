const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coachNotes', {
  getSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveSettings: (payload) => ipcRenderer.invoke('app:save-settings', payload),
  selectRootFolder: () => ipcRenderer.invoke('app:select-root-folder'),
  reindex: () => ipcRenderer.invoke('app:reindex'),
  getClients: () => ipcRenderer.invoke('app:get-clients'),
  getClientProfile: (payload) => ipcRenderer.invoke('app:get-client-profile', payload),
  saveClientProfile: (payload) => ipcRenderer.invoke('app:save-client-profile', payload),
  getTags: () => ipcRenderer.invoke('app:get-tags'),
  getNotes: (filters) => ipcRenderer.invoke('app:get-notes', filters),
  getNote: (noteId) => ipcRenderer.invoke('app:get-note', noteId),
  createNote: (payload) => ipcRenderer.invoke('app:create-note', payload),
  createClient: (payload) => ipcRenderer.invoke('app:create-client', payload),
  updateNote: (payload) => ipcRenderer.invoke('app:update-note', payload),
  deleteNote: (payload) => ipcRenderer.invoke('app:delete-note', payload),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  search: (payload) => ipcRenderer.invoke('app:search', payload),
  ask: (payload) => ipcRenderer.invoke('app:ask', payload),
  summarize: (payload) => ipcRenderer.invoke('app:summarize', payload),
  revealInFinder: (noteId) => ipcRenderer.invoke('app:reveal-in-finder', noteId),
  onStatus: (handler) => {
    const wrapped = (_event, value) => handler(value);
    ipcRenderer.on('app:status', wrapped);
    return () => ipcRenderer.off('app:status', wrapped);
  }
});
