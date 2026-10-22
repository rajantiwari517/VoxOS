const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const dotenv = require('dotenv');
const FolderStore = require('./security/folderStore');
const PathValidator = require('./security/pathValidator');
const FileScanner = require('./services/fileScanner');

// Load environment variables strictly into main process
dotenv.config();

let mainWindow = null;
const isDev = process.env.NODE_ENV !== 'production';

// Initialize Security & Storage
const folderStore = new FolderStore();
const pathValidator = new PathValidator(() => folderStore.getFolders());
const fileScanner = new FileScanner(pathValidator);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 840,
    minHeight: 620,
    backgroundColor: '#0a0f1d',
    title: 'VoxOS - Voice-Controlled AI Desktop Assistant',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// Chat messages
ipcMain.handle('chat:sendMessage', async (event, message) => {
  const text = typeof message === 'string' ? message : (message?.text || '');
  const docsCount = fileScanner.getIndexedDocuments().length;

  return {
    id: `reply-${Date.now()}`,
    sender: 'assistant',
    text: `VoxOS Main Process received: "${text}". [Active indexed documents: ${docsCount}]`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'received',
  };
});

// System Status
ipcMain.handle('system:getStatus', async () => {
  const approved = folderStore.getFolders();
  return {
    status: 'online',
    safeMode: true,
    shellAccess: 'BLOCKED',
    approvedFoldersCount: approved.length,
    version: '0.2.0 (Phase 2)',
  };
});

// Approved Folders Management
ipcMain.handle('folders:pick', async () => {
  if (!mainWindow) return folderStore.getFolders();

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Approved Folder for VoxOS',
    properties: ['openDirectory', 'dontAddToRecent'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selected = result.filePaths[0];
    folderStore.addFolder(selected);
  }

  return folderStore.getFolders();
});

ipcMain.handle('folders:get', async () => {
  return folderStore.getFolders();
});

ipcMain.handle('folders:remove', async (event, folderPath) => {
  return folderStore.removeFolder(folderPath);
});

// File Indexing
ipcMain.handle('indexing:start', async () => {
  const approvedFolders = folderStore.getFolders();
  if (!approvedFolders.length) {
    throw new Error('Please add at least one approved folder before indexing.');
  }

  return await fileScanner.scanApprovedFolders(approvedFolders, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('indexing:progress', progress);
    }
  });
});

ipcMain.handle('indexing:getSummary', async () => {
  return fileScanner.getIndexSummary();
});

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(() => {
  folderStore.load();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
