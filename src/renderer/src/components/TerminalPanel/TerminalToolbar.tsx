import React, { useState } from 'react'
import { useProjectStore } from '../../stores/project-store'

interface Props {
  projectId: string | null
}

const QUICK_COMMANDS = [
  { label: '/compact', command: '/compact\n', title: 'Compact conversation context' },
  { label: '/clear', command: '/clear\n', title: 'Clear conversation' },
  { label: '/cost', command: '/cost\n', title: 'Show token/cost info' },
  { label: '/help', command: '/help\n', title: 'Show help' }
]

const MODELS = [
  { label: 'opus', value: 'claude-opus-4-6' },
  { label: 'sonnet', value: 'claude-sonnet-4-5-20250929' },
  { label: 'haiku', value: 'claude-haiku-4-5-20251001' }
]

export const TerminalToolbar: React.FC<Props> = ({ projectId }) => {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId))
  const status = useProjectStore((s) => (projectId ? s.statuses[projectId] ?? 'idle' : 'idle'))
  const [selectedModel, setSelectedModel] = useState('')

  const isRunning = status === 'running'

  const handleRestart = async () => {
    if (!projectId || !project) return
    await window.api.ptyRestart(projectId, project.path)
    useProjectStore.getState().setStatus(projectId, 'running')
  }

  const handleQuickCommand = (command: string) => {
    if (!projectId || !isRunning) return
    window.api.ptyInput(projectId, command)
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value
    if (!projectId || !isRunning || !modelId) return
    setSelectedModel(modelId)
    window.api.ptyInput(projectId, `/model ${modelId}\n`)
  }

  if (!project) {
    return (
      <div className="terminal-toolbar">
        <span className="toolbar-text">Select a project to start</span>
      </div>
    )
  }

  return (
    <div className="terminal-toolbar">
      <span className="toolbar-path" title={project.path}>
        {project.path}
      </span>
      <div className="toolbar-commands">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            className="toolbar-cmd-btn"
            onClick={() => handleQuickCommand(cmd.command)}
            disabled={!isRunning}
            title={cmd.title}
          >
            {cmd.label}
          </button>
        ))}
      </div>
      <select
        className="toolbar-model-select"
        value={selectedModel}
        onChange={handleModelChange}
        disabled={!isRunning}
        title="Switch Claude model"
      >
        <option value="" disabled>
          Model
        </option>
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <span className={`toolbar-status toolbar-status--${status}`}>{status}</span>
      <button className="toolbar-btn" onClick={handleRestart} title="Restart Claude">
        Restart
      </button>
    </div>
  )
}
