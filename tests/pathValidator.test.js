const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const PathValidator = require('../src/main/security/pathValidator');

describe('PathValidator Security Tests', () => {
  const approvedRoot = path.resolve('C:/VoxOS_Safe_Storage');
  const secondaryApproved = path.resolve('C:/Projects/College');

  const validator = new PathValidator(() => [approvedRoot, secondaryApproved]);

  it('allows files directly inside approved folders', () => {
    const validFile = path.join(approvedRoot, 'notes.txt');
    const result = validator.validate(validFile);
    assert.strictEqual(PathValidator.normalizeForComparison(result), PathValidator.normalizeForComparison(validFile));
    assert.strictEqual(validator.isPathAllowed(validFile), true);
  });

  it('allows files in nested subdirectories inside approved folders', () => {
    const nestedFile = path.join(approvedRoot, 'semester1', 'assignments', 'report.pdf');
    const result = validator.validate(nestedFile);
    assert.strictEqual(validator.isPathAllowed(nestedFile), true);
  });

  it('allows the approved folder itself', () => {
    assert.strictEqual(validator.isPathAllowed(approvedRoot), true);
  });

  it('blocks directory traversal attempts using ../', () => {
    // Attempting to step out of approved folder into parent
    const traversalAttempt = path.join(approvedRoot, '..', 'Windows', 'System32', 'cmd.exe');
    assert.throws(
      () => validator.validate(traversalAttempt),
      /Access denied: Path .* is outside user-approved folders/
    );
    assert.strictEqual(validator.isPathAllowed(traversalAttempt), false);
  });

  it('blocks traversal attempting to return to root and access outside folders', () => {
    const trickyTraversal = `${approvedRoot}/../../secret.txt`;
    assert.throws(() => validator.validate(trickyTraversal), /outside user-approved folders/);
    assert.strictEqual(validator.isPathAllowed(trickyTraversal), false);
  });

  it('blocks sibling folder prefix-collision attacks', () => {
    // Example: C:/VoxOS_Safe_Storage vs C:/VoxOS_Safe_Storage_Private
    const siblingFolder = `${approvedRoot}_HackerFolder/exploit.txt`;
    assert.throws(() => validator.validate(siblingFolder), /outside user-approved folders/);
    assert.strictEqual(validator.isPathAllowed(siblingFolder), false);
  });

  it('blocks null-byte injection attempts', () => {
    const nullByteAttack = `${approvedRoot}\\notes.txt\0.pdf`;
    assert.throws(() => validator.validate(nullByteAttack), /null bytes detected/);
    assert.strictEqual(validator.isPathAllowed(nullByteAttack), false);
  });

  it('rejects empty, undefined, or non-string paths', () => {
    assert.throws(() => validator.validate(''), /Invalid or empty path/);
    assert.throws(() => validator.validate(null), /Invalid or empty path/);
    assert.throws(() => validator.validate(undefined), /Invalid or empty path/);
  });

  it('rejects all access when no folders are approved', () => {
    const emptyValidator = new PathValidator(() => []);
    const anyPath = path.join(approvedRoot, 'notes.txt');
    assert.throws(() => emptyValidator.validate(anyPath), /No approved folders are currently configured/);
    assert.strictEqual(emptyValidator.isPathAllowed(anyPath), false);
  });

  if (process.platform === 'win32') {
    it('handles Windows case-insensitivity correctly', () => {
      const lowerCaseVariant = approvedRoot.toLowerCase() + '\\readme.md';
      assert.strictEqual(validator.isPathAllowed(lowerCaseVariant), true);
    });
  }
});
