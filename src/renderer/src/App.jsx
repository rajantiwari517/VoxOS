import React, { useState, useEffect, useRef } from 'react';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'assistant',
      text: 'Hello! I am VoxOS, your voice-controlled AI desktop assistant. Go to Settings (⚙️) to approve folders for safe file search and document indexing.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    status: 'connecting',
    safeMode: true,
    shellAccess: 'BLOCKED',
    approvedFoldersCount: 0,
    version: '0.2.0',
  });

  const messagesEndRef = useRef(null);

  const fetchStatus = () => {
    if (window.voxOS?.getSystemStatus) {
      window.voxOS.getSystemStatus().then((status) => {
        setSystemStatus(status);
      }).catch((err) => {
        console.error('Failed to get system status:', err);
      });
    } else {
      setSystemStatus({
        status: 'browser-mode',
        safeMode: true,
        shellAccess: 'BLOCKED',
        approvedFoldersCount: 0,
        version: '0.2.0 (Web Preview)',
      });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      let reply;
      if (window.voxOS?.sendMessage) {
        reply = await window.voxOS.sendMessage(text);
      } else {
        reply = {
          id: `reply-${Date.now()}`,
          sender: 'assistant',
          text: `[Web Fallback] Received: "${text}". Run in Electron to test desktop capabilities.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      setMessages((prev) => [...prev, reply]);
    } catch (error) {
      console.error('Error invoking IPC:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: `Error communicating with VoxOS main process: ${error.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <div className="app-container">
      {/* Top Header & Status Area */}
      <header className="header-bar">
        <div className="brand-section">
          <div className="logo-badge">VoxOS</div>
          <div className="title-group">
            <h1>Desktop Assistant</h1>
            <p>Phase 2 • Sandboxed Folders & Text Indexing</p>
          </div>
        </div>

        <div className="status-section">
          <span className="safety-pill">🛡️ Shell: {systemStatus.shellAccess}</span>
          <span className="folders-count-pill" title="Approved Folders count">
            📁 Approved: {systemStatus.approvedFoldersCount || 0}
          </span>
          <div className="status-badge">
            <span className="status-dot"></span>
            <span>{systemStatus.status.toUpperCase()}</span>
          </div>
          <button
            className="settings-icon-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings & Approved Folders"
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-item ${msg.sender}`}>
            <div className="message-bubble">{msg.text}</div>
            <div className="message-meta">
              <span>{msg.sender === 'user' ? 'You' : 'VoxOS'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-item assistant">
            <div className="message-bubble" style={{ opacity: 0.7 }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="input-area">
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a command or question (e.g. Find notes about algorithms)..."
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputText.trim() || isLoading}
          >
            Send
          </button>
        </form>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onFoldersChanged={() => fetchStatus()}
      />
    </div>
  );
}
