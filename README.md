# VoxOS - Voice-Controlled AI Desktop Assistant

VoxOS is a voice-controlled desktop assistant for Windows built with Electron, React, and Node.js. It indexes files by semantic meaning and purpose rather than just file names, performs multi-step desktop tasks, and operates under strict sandboxed safety principles.

---

## Safety Guarantees

1. **Zero Shell Execution**: The AI assistant never generates or runs shell commands (`cmd.exe`, PowerShell, or child processes).
2. **Fixed Action Whitelist**: The LLM outputs strict JSON mapped to pre-vetted, coded actions.
3. **Folder Sandboxing**: Access is strictly confined to user-approved folders. Path traversal (e.g. `../`) is strictly blocked.
4. **Human-in-the-Loop Confirmation**: Destructive actions (delete, overwrite, move) require explicit user approval.
5. **Secret Isolation**: API keys reside exclusively in `.env` read by the Electron main process and are never sent to the renderer.

---

## Architecture

- `src/main`: Electron main process (Node.js backend, sandboxed file operations, LLM client).
- `src/preload`: Secure `contextBridge` with `contextIsolation: true` and `nodeIntegration: false`.
- `src/renderer`: React frontend built with Vite (modern dark-themed chat interface, speech I/O).

---

## Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Start the application**:
   ```bash
   npm start
   ```
