const path = require('path');

/**
 * Validates and normalizes paths against user-approved folders.
 * Blocks directory traversal (../, ..\\), null-byte injections, and unauthorized directory escapes.
 */
class PathValidator {
  constructor(getApprovedFolders) {
    // getApprovedFolders: function that returns Array of string paths
    this.getApprovedFolders = typeof getApprovedFolders === 'function' 
      ? getApprovedFolders 
      : () => (Array.isArray(getApprovedFolders) ? getApprovedFolders : []);
  }

  /**
   * Normalizes a path for consistent comparison.
   * On Windows, paths are case-insensitive, so we normalize casing for validation checks.
   */
  static normalizeForComparison(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return '';
    }
    // Resolve absolute path and normalize slashes
    const resolved = path.resolve(filePath);
    // On Windows, normalize drive letter and case
    if (process.platform === 'win32') {
      return resolved.toLowerCase();
    }
    return resolved;
  }

  /**
   * Checks whether a target path is strictly inside or equal to a parent folder.
   * Prevents sibling-prefix attacks (e.g. "C:\Safe" matching "C:\SafeSecret").
   */
  static isInsideOrSame(targetPath, parentFolder) {
    const targetComp = PathValidator.normalizeForComparison(targetPath);
    const parentComp = PathValidator.normalizeForComparison(parentFolder);

    if (!targetComp || !parentComp) return false;
    if (targetComp === parentComp) return true;

    const parentWithSep = parentComp.endsWith(path.sep) 
      ? parentComp 
      : `${parentComp}${path.sep}`;

    return targetComp.startsWith(parentWithSep);
  }

  /**
   * Validates a candidate path against the current list of approved folders.
   * Throws an error or returns the resolved safe path.
   * 
   * @param {string} candidatePath - Path to validate
   * @returns {string} - The fully resolved, validated safe absolute path
   * @throws {Error} - If traversal is detected, path contains illegal characters, or is outside approved folders
   */
  validate(candidatePath) {
    if (!candidatePath || typeof candidatePath !== 'string') {
      throw new Error('Access denied: Invalid or empty path provided.');
    }

    // Check for null-byte injections
    if (candidatePath.indexOf('\0') !== -1) {
      throw new Error('Access denied: Malicious path containing null bytes detected.');
    }

    // Resolve path to absolute standard path
    const resolvedPath = path.resolve(candidatePath);

    // Retrieve currently approved folders
    const approvedFolders = this.getApprovedFolders() || [];
    if (!approvedFolders.length) {
      throw new Error('Access denied: No approved folders are currently configured in VoxOS.');
    }

    // Check if resolved path is inside at least one approved folder
    const isAllowed = approvedFolders.some((approvedFolder) => {
      return PathValidator.isInsideOrSame(resolvedPath, approvedFolder);
    });

    if (!isAllowed) {
      throw new Error(`Access denied: Path "${candidatePath}" is outside user-approved folders.`);
    }

    return resolvedPath;
  }

  /**
   * Non-throwing boolean check for UI checks and guards
   */
  isPathAllowed(candidatePath) {
    try {
      this.validate(candidatePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = PathValidator;
