const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class FolderStore {
  constructor(customStorePath = null) {
    this.customStorePath = customStorePath;
    this.folders = [];
    this.initialized = false;
  }

  getStorageFilePath() {
    if (this.customStorePath) {
      return this.customStorePath;
    }
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.voxos_data');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'approved_folders.json');
  }

  load() {
    try {
      const filePath = this.getStorageFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Normalize all loaded paths and keep existing folders
          this.folders = parsed
            .filter((p) => typeof p === 'string' && fs.existsSync(p))
            .map((p) => path.resolve(p));
        }
      }
    } catch (err) {
      console.error('Failed to load approved folders:', err);
      this.folders = [];
    }
    this.initialized = true;
    return this.folders;
  }

  save() {
    try {
      const filePath = this.getStorageFilePath();
      fs.writeFileSync(filePath, JSON.stringify(this.folders, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to persist approved folders:', err);
      return false;
    }
  }

  getFolders() {
    if (!this.initialized) {
      this.load();
    }
    return [...this.folders];
  }

  addFolder(folderPath) {
    if (!folderPath || typeof folderPath !== 'string') return false;
    const resolved = path.resolve(folderPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Path "${folderPath}" is not an existing directory.`);
    }

    if (!this.initialized) {
      this.load();
    }

    // Avoid duplicate entries (case-insensitive check on Windows)
    const normalized = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    const exists = this.folders.some((f) => {
      const comp = process.platform === 'win32' ? f.toLowerCase() : f;
      return comp === normalized;
    });

    if (!exists) {
      this.folders.push(resolved);
      this.save();
    }
    return this.folders;
  }

  removeFolder(folderPath) {
    if (!this.initialized) {
      this.load();
    }
    const normalized = process.platform === 'win32' ? path.resolve(folderPath).toLowerCase() : path.resolve(folderPath);
    this.folders = this.folders.filter((f) => {
      const comp = process.platform === 'win32' ? f.toLowerCase() : f;
      return comp !== normalized;
    });
    this.save();
    return this.folders;
  }
}

module.exports = FolderStore;
