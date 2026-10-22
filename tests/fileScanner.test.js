const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const PathValidator = require('../src/main/security/pathValidator');
const FileScanner = require('../src/main/services/fileScanner');

describe('FileScanner Tests', () => {
  let tempDir;
  let subDir;
  let hiddenDir;
  let validator;
  let scanner;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voxos-test-'));
    subDir = path.join(tempDir, 'subfolder');
    hiddenDir = path.join(tempDir, '.hidden');

    fs.mkdirSync(subDir, { recursive: true });
    fs.mkdirSync(hiddenDir, { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(tempDir, 'doc1.txt'), 'Hello from document 1');
    fs.writeFileSync(path.join(subDir, 'doc2.md'), '# Markdown Title\nSome content.');
    fs.writeFileSync(path.join(hiddenDir, 'hidden.txt'), 'Secret content that should be skipped');
    fs.writeFileSync(path.join(tempDir, 'ignored.exe'), 'Binary content that should be skipped');

    validator = new PathValidator(() => [tempDir]);
    scanner = new FileScanner(validator);
  });

  after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('scans approved folders and extracts text from .txt and .md', async () => {
    const progressUpdates = [];
    const result = await scanner.scanApprovedFolders([tempDir], (p) => {
      progressUpdates.push(p);
    });

    assert.strictEqual(result.status, 'done');
    assert.strictEqual(result.indexedCount, 2); // doc1.txt and doc2.md
    assert.strictEqual(progressUpdates.length > 0, true);

    const docs = scanner.getIndexedDocuments();
    assert.strictEqual(docs.length, 2);

    const doc1 = docs.find((d) => d.name === 'doc1.txt');
    assert.strictEqual(doc1.fullText, 'Hello from document 1');

    const doc2 = docs.find((d) => d.name === 'doc2.md');
    assert.strictEqual(doc2.fullText.includes('# Markdown Title'), true);
  });

  it('skips hidden folders like .hidden', () => {
    const docs = scanner.getIndexedDocuments();
    const hiddenDoc = docs.find((d) => d.name === 'hidden.txt');
    assert.strictEqual(hiddenDoc, undefined);
  });

  it('blocks indexing on unapproved paths via validator', async () => {
    const fakeValidator = new PathValidator(() => []); // No approved folders
    const strictScanner = new FileScanner(fakeValidator);
    await assert.rejects(
      async () => {
        await strictScanner.scanApprovedFolders([tempDir]);
      },
      /Access denied/
    );
  });
});
