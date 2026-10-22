const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxOS', {
  // Chat
  sendMessage: (message) => ipcRenderer.invoke('chat:sendMessage', message),
  getSystemStatus: () => ipcRenderer.invoke('system:getStatus'),

  // Approved Folders Management
  pickFolder: () => ipcRenderer.invoke('folders:pick'),
  getApprovedFolders: () => ipcRenderer.invoke('folders:get'),
  removeApprovedFolder: (folderPath) => ipcRenderer.invoke('folders:remove', folderPath),

  // File Indexing & Metadata
  startIndexing: () => ipcRenderer.invoke('indexing:start'),
  getIndexSummary: () => ipcRenderer.invoke('indexing:getSummary'),
  onIndexingProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('indexing:progress', handler);
    return () => ipcRenderer.removeListener('indexing:progress', handler);
  },
});
