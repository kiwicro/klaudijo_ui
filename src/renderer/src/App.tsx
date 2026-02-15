import React, { useEffect } from 'react'
import { Layout } from './components/Layout'
import { useProjectStore } from './stores/project-store'

function App(): React.ReactElement {
  // Listen for PTY exit events
  useEffect(() => {
    if (!window.api) return
    const cleanup = window.api.onPtyExit((projectId, _exitCode) => {
      useProjectStore.getState().setStatus(projectId, 'exited')
    })
    return cleanup
  }, [])

  // Listen for switch-project from notification click
  useEffect(() => {
    if (!window.api) return
    const cleanup = window.api.onSwitchProject((projectId) => {
      const store = useProjectStore.getState()
      const project = store.projects.find((p) => p.id === projectId)
      if (project) {
        store.setActive(projectId)
        // Create PTY if not running
        const status = store.statuses[projectId]
        if (!status || status === 'idle') {
          window.api.ptyCreate(projectId, project.path, project.name).then(() => {
            useProjectStore.getState().setStatus(projectId, 'running')
          })
        }
      }
    })
    return cleanup
  }, [])

  // Update window title when active project changes
  useEffect(() => {
    if (!window.api) return
    const unsub = useProjectStore.subscribe((state) => {
      const project = state.projects.find((p) => p.id === state.activeProjectId)
      window.api.setTitle(project ? `${project.name} - Klaudijo UI` : 'Klaudijo UI')
    })
    return unsub
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault()
        document.querySelector<HTMLElement>('.project-panel')?.focus()
      } else if (e.ctrlKey && e.key === '2') {
        e.preventDefault()
        document.querySelector<HTMLElement>('.terminal-container .xterm-helper-textarea')?.focus()
      } else if (e.ctrlKey && e.key === '3') {
        e.preventDefault()
        document.querySelector<HTMLElement>('.file-panel')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return <Layout />
}

export default App
