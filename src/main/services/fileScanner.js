const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.docx']);

const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.vscode',
  '.idea',
  'dist',
  'build',
  'out',
  'appdata',
  '$recycle.bin',
  'system volume information',
  'temp',
  'tmp',
  '.voxos_data',
]);

class FileScanner {
  constructor(pathValidator) {
    this.pathValidator = pathValidator;
    this.indexedDocuments = new Map(); // path -> document metadata & text
    this.isScanning = false;
  }

  isIgnoredFolder(dirName) {
    if (!dirName) return true;
    const lower = dirName.toLowerCase();
    if (lower.startsWith('.')) return true;
    return IGNORED_DIRECTORY_NAMES.has(lower);
  }

  async extractText(filePath, ext) {
    // Re-verify security before reading any file content
    this.pathValidator.validate(filePath);

    const stats = await fs.promises.stat(filePath);
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      return { skipped: true, reason: 'File exceeds 10MB limit' };
    }

    let text = '';
    const extension = ext.toLowerCase();

    if (extension === '.txt' || extension === '.md') {
      text = await fs.promises.readFile(filePath, 'utf-8');
    } else if (extension === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value || '';
    } else if (extension === '.pdf') {
      const buffer = await fs.promises.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        text = parsed?.text || '';
      } finally {
        if (parser.destroy) {
          await parser.destroy();
        }
      }
    }

    return {
      text: text.trim(),
      size: stats.size,
      mtime: stats.mtime,
      skipped: false,
    };
  }

  async collectCandidateFiles(dirPath, filesList = []) {
    // Validate directory path before reading
    this.pathValidator.validate(dirPath);

    let entries = [];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`Cannot read directory ${dirPath}:`, err.message);
      return filesList;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!this.isIgnoredFolder(entry.name)) {
          await this.collectCandidateFiles(fullPath, filesList);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          filesList.push({ fullPath, ext, name: entry.name });
        }
      }
    }

    return filesList;
  }

  async scanApprovedFolders(approvedFolders, onProgress = () => {}) {
    if (this.isScanning) {
      throw new Error('A file scan is already in progress.');
    }

    this.isScanning = true;
    const startTime = Date.now();
    const candidateFiles = [];

    try {
      onProgress({
        status: 'discovering',
        current: 0,
        total: 0,
        percentage: 0,
        currentFile: 'Discovering files...',
      });

      // 1. Discover all candidate files across approved folders
      for (const folder of approvedFolders) {
        if (fs.existsSync(folder)) {
          await this.collectCandidateFiles(folder, candidateFiles);
        }
      }

      const total = candidateFiles.length;
      let processed = 0;
      let indexedCount = 0;
      let skippedCount = 0;

      onProgress({
        status: 'indexing',
        current: 0,
        total,
        percentage: 0,
        currentFile: total > 0 ? candidateFiles[0].name : 'No files found',
      });

      // 2. Extract content from each file
      for (const item of candidateFiles) {
        processed++;
        const pct = total > 0 ? Math.round((processed / total) * 100) : 100;

        onProgress({
          status: 'indexing',
          current: processed,
          total,
          percentage: pct,
          currentFile: item.name,
        });

        try {
          const result = await this.extractText(item.fullPath, item.ext);
          if (result.skipped) {
            skippedCount++;
            continue;
          }

          const docEntry = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            path: item.fullPath,
            name: item.name,
            extension: item.ext,
            size: result.size,
            mtime: result.mtime,
            textPreview: result.text.slice(0, 300),
            fullText: result.text,
            wordCount: result.text ? result.text.split(/\s+/).length : 0,
            indexedAt: new Date().toISOString(),
          };

          this.indexedDocuments.set(item.fullPath, docEntry);
          indexedCount++;
        } catch (err) {
          console.error(`Error extracting text from ${item.fullPath}:`, err.message);
          skippedCount++;
        }
      }

      const durationMs = Date.now() - startTime;
      const finalResult = {
        status: 'done',
        current: total,
        total,
        percentage: 100,
        currentFile: 'Indexing complete',
        indexedCount,
        skippedCount,
        durationMs,
      };

      onProgress(finalResult);
      return finalResult;
    } finally {
      this.isScanning = false;
    }
  }

  getIndexedDocuments() {
    return Array.from(this.indexedDocuments.values());
  }

  getIndexSummary() {
    const docs = this.getIndexedDocuments();
    return {
      totalDocuments: docs.length,
      totalWords: docs.reduce((acc, d) => acc + (d.wordCount || 0), 0),
      fileTypes: docs.reduce((acc, d) => {
        acc[d.extension] = (acc[d.extension] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

module.exports = FileScanner;
