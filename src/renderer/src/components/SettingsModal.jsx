import React, { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, onFoldersChanged }) {
  const [folders, setFolders] = useState([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Load folders on open
  useEffect(() => {
    if (isOpen) {
      loadFolders();
      loadSummary();
    }
  }, [isOpen]);

  // Listen to real-time indexing progress events
  useEffect(() => {
    if (!window.voxOS?.onIndexingProgress) return;

    const cleanup = window.voxOS.onIndexingProgress((data) => {
      setProgress(data);
      if (data.status === 'done') {
        setIsIndexing(false);
        loadSummary();
      }
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  const loadFolders = async () => {
    try {
      if (window.voxOS?.getApprovedFolders) {
        const list = await window.voxOS.getApprovedFolders();
        setFolders(list || []);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadSummary = async () => {
    try {
      if (window.voxOS?.getIndexSummary) {
        const data = await window.voxOS.getIndexSummary();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const handleAddFolder = async () => {
    setErrorMsg('');
    try {
      if (window.voxOS?.pickFolder) {
        const updated = await window.voxOS.pickFolder();
        setFolders(updated || []);
        if (onFoldersChanged) onFoldersChanged(updated?.length || 0);
      } else {
        setErrorMsg('Folder picker is only available in Electron desktop mode.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRemoveFolder = async (folderPath) => {
    setErrorMsg('');
    try {
      if (window.voxOS?.removeApprovedFolder) {
        const updated = await window.voxOS.removeApprovedFolder(folderPath);
        setFolders(updated || []);
        if (onFoldersChanged) onFoldersChanged(updated?.length || 0);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleStartIndexing = async () => {
    if (folders.length === 0) {
      setErrorMsg('Please approve at least one folder before indexing.');
      return;
    }
    setErrorMsg('');
    setIsIndexing(true);
    setProgress({
      status: 'starting',
      current: 0,
      total: 0,
      percentage: 0,
      currentFile: 'Starting scanner...',
    });

    try {
      if (window.voxOS?.startIndexing) {
        await window.voxOS.startIndexing();
      } else {
        setIsIndexing(false);
        setErrorMsg('Indexing is only available in Electron desktop mode.');
      }
    } catch (err) {
      setIsIndexing(false);
      setErrorMsg(err.message || 'Error occurred while indexing.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>Approved Folders & Knowledge Index</h2>
            <p>VoxOS can only access files inside folders you explicitly approve here.</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        {/* Section 1: Folder Management */}
        <div className="settings-section">
          <div className="section-header">
            <h3>Approved Storage Locations ({folders.length})</h3>
            <button
              className="btn btn-primary"
              onClick={handleAddFolder}
              disabled={isIndexing}
            >
              + Add Approved Folder
            </button>
          </div>

          <div className="folder-list">
            {folders.length === 0 ? (
              <div className="empty-folder-box">
                <p>No folders approved yet.</p>
                <span>Click "+ Add Approved Folder" to grant safe access to study notes, documents, or project files.</span>
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder} className="folder-card">
                  <div className="folder-info">
                    <span className="folder-icon">📁</span>
                    <span className="folder-path" title={folder}>{folder}</span>
                  </div>
                  <button
                    className="btn btn-danger-ghost"
                    onClick={() => handleRemoveFolder(folder)}
                    disabled={isIndexing}
                    title="Revoke access"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: Indexing Controls & Real-Time Progress */}
        <div className="settings-section">
          <div className="section-header">
            <h3>Document Text Indexer</h3>
            <button
              className="btn btn-accent"
              onClick={handleStartIndexing}
              disabled={isIndexing || folders.length === 0}
            >
              {isIndexing ? 'Indexing...' : 'Scan & Index Documents'}
            </button>
          </div>

          {/* Progress bar and file scanning activity */}
          {progress && (
            <div className="indexing-box">
              <div className="progress-labels">
                <span className="progress-status-text">
                  {progress.status === 'done' ? '✅ Completed' : `⏳ ${progress.currentFile || 'Scanning...'}`}
                </span>
                <span className="progress-pct">{progress.percentage || 0}%</span>
              </div>

              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.percentage || 0}%` }}
                />
              </div>

              <div className="progress-stats-row">
                <span>
                  Processed: {progress.current || 0} / {progress.total || 0} candidate files
                </span>
                {progress.indexedCount !== undefined && (
                  <span>Indexed: {progress.indexedCount} documents</span>
                )}
              </div>
            </div>
          )}

          {/* Index summary stats */}
          {summary && summary.totalDocuments > 0 && (
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{summary.totalDocuments}</span>
                <span className="stat-label">Total Indexed Docs</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{summary.totalWords?.toLocaleString()}</span>
                <span className="stat-label">Total Words Extracted</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">
                  {Object.keys(summary.fileTypes || {}).join(', ') || 'None'}
                </span>
                <span className="stat-label">File Formats Supported</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
