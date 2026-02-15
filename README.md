# Klaudijo UI

A desktop app for managing multiple [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI sessions in parallel.

Built with Electron, React, and xterm.js.

![Windows](https://img.shields.io/badge/platform-Windows-blue)

## What it does

Klaudijo UI lets you run several Claude Code terminals side by side from a single window. Add your projects, and each one gets its own persistent PTY session with a 1MB rolling buffer — switch between them without losing context.

**Key features:**

- **Multi-project management** — Add projects from the sidebar, each with its own Claude Code session
- **Persistent terminals** — PTY sessions run in the background; switching projects replays the buffer instantly
- **Quick commands** — Toolbar buttons for `/compact`, `/clear`, `/cost`, `/help`
- **Model switcher** — Dropdown to switch between Opus, Sonnet, and Haiku
- **Git branch tracking** — Status bar shows branches with real-time updates via file watching
- **MCP server display** — Shows configured MCP servers from `.mcp.json` and Claude project settings
- **File pinning** — Pin files to the right panel for quick reference per project
- **Terminal search** — Ctrl+F search through terminal output
- **Drag & drop** — Drop files into the terminal to reference them

## Tech stack

- **Electron** + **electron-vite** — App shell and build tooling
- **React 19** + **TypeScript** — UI
- **xterm.js** — Terminal emulation (WebGL renderer)
- **node-pty** — Native PTY backend
- **Zustand** — State management
- **electron-store** — Persistent settings (panel widths, window bounds, projects)

## Getting started

### Prerequisites

- Node.js 18+
- Windows (node-pty native build requires Visual Studio Build Tools)
- Claude Code CLI installed and available on PATH

### Install

```bash
npm install
```

This runs `postinstall` automatically which patches node-pty and rebuilds it for Electron.

### Development

```bash
npm run dev
```

### Build

```bash
# Unpacked build
npm run dist

# Installer
npm run dist:installer
```

The output goes to `release/`.

## Usage

1. **Add a project** — Click "Add Project" in the left sidebar and select a directory
2. **Start coding** — Click the project name to activate it; Claude Code launches automatically in that directory
3. **Switch projects** — Click another project in the sidebar; the previous session keeps running in the background
4. **Quick commands** — Use the toolbar buttons (`/compact`, `/clear`, `/cost`, `/help`) to send commands without typing
5. **Switch models** — Use the Model dropdown in the toolbar to switch between Opus, Sonnet, and Haiku
6. **Pin files** — Click "Add Files" in the right panel to pin frequently referenced files for a project
7. **Search terminal** — Press `Ctrl+F` to search through terminal output
8. **Restart session** — Click "Restart" in the toolbar to restart the Claude Code session
9. **Drop files** — Drag and drop files from your file explorer into the terminal

The bottom status bar shows git branches for the active project and any configured MCP servers.

## Project structure

```
src/
  main/           # Electron main process
    pty-manager.ts    # PTY lifecycle, buffer management
    ipc-handlers.ts   # All IPC handlers
    git-watcher.ts    # File system watcher for git branches
    file-service.ts   # File operations
    store.ts          # electron-store config
  preload/        # contextBridge API
  renderer/src/   # React UI
    components/
      ProjectPanel/   # Sidebar project list
      TerminalPanel/  # Terminal, toolbar, status bar
      FilePanel/      # Pinned files panel
    stores/           # Zustand stores
    hooks/            # Terminal and resize hooks
  shared/         # IPC channels and shared types
scripts/
  patch-node-pty.js   # Pre-rebuild patches for Windows
```

## License

MIT
