export const IPC = {
  // PTY
  PTY_CREATE: 'pty:create',
  PTY_DESTROY: 'pty:destroy',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
  PTY_GET_BUFFER: 'pty:get-buffer',
  PTY_RESTART: 'pty:restart',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',

  // Files
  FILES_LIST_DIR: 'files:list-dir',
  FILES_OPEN_IN_EDITOR: 'files:open-in-editor',
  FILES_SHOW_IN_EXPLORER: 'files:show-in-explorer',
  FILES_DISCOVER_CLAUDE_MD: 'files:discover-claude-md',
  FILES_DETECT_PROJECTS: 'files:detect-projects',
  GIT_BRANCH: 'git:branch',
  GIT_BRANCHES: 'git:branches',
  GIT_WATCH: 'git:watch',
  GIT_BRANCHES_CHANGED: 'git:branches-changed',
  SWITCH_PROJECT: 'app:switch-project',

  // Dialogs
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',
  DIALOG_SELECT_FILES: 'dialog:select-files',

  // Store
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',

  // Window
  SET_TITLE: 'window:set-title',

  // Clipboard
  CLIPBOARD_WRITE: 'clipboard:write',

  // MCP
  MCP_LIST: 'mcp:list'
} as const
