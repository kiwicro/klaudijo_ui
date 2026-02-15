import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { TerminalView, TerminalViewHandle } from './TerminalView'
import { TerminalToolbar } from './TerminalToolbar'
import { McpServer } from '../../../../shared/types'

interface GitBranchInfo {
  current: string | null
  branches: string[]
}

export const TerminalPanel: React.FC = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const [branchInfo, setBranchInfo] = useState<GitBranchInfo>({ current: null, branches: [] })
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const termViewRef = useRef<TerminalViewHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activeProjectId) {
      setBranchInfo({ current: null, branches: [] })
      return
    }
    const project = useProjectStore.getState().projects.find((p) => p.id === activeProjectId)
    if (!project) {
      setBranchInfo({ current: null, branches: [] })
      return
    }
    let cancelled = false

    // Fetch initial branches
    window.api.gitBranches(project.path).then((info) => {
      if (!cancelled) setBranchInfo(info)
    })

    // Start watching for changes
    window.api.gitWatch(activeProjectId, project.path)

    // Listen for real-time updates
    const unsub = window.api.onGitBranchesChanged((projectId, info) => {
      if (!cancelled && projectId === activeProjectId) {
        setBranchInfo(info)
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [activeProjectId])

  // Fetch MCP servers on project switch
  useEffect(() => {
    if (!activeProjectId) {
      setMcpServers([])
      return
    }
    const project = useProjectStore.getState().projects.find((p) => p.id === activeProjectId)
    if (!project) {
      setMcpServers([])
      return
    }
    let cancelled = false
    window.api.getMcpServers(project.path).then((servers) => {
      if (!cancelled) setMcpServers(servers)
    })
    return () => { cancelled = true }
  }, [activeProjectId])

  // Ctrl+F to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch((prev) => {
          if (!prev) {
            setTimeout(() => searchInputRef.current?.focus(), 0)
          } else {
            termViewRef.current?.clearSearch()
            setSearchQuery('')
          }
          return !prev
        })
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
        termViewRef.current?.clearSearch()
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSearch])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setSearchQuery(q)
    if (q) termViewRef.current?.searchNext(q)
    else termViewRef.current?.clearSearch()
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery) {
      if (e.shiftKey) termViewRef.current?.searchPrev(searchQuery)
      else termViewRef.current?.searchNext(searchQuery)
    }
  }, [searchQuery])

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    termViewRef.current?.clearSearch()
    setSearchQuery('')
  }, [])

  return (
    <div className="terminal-panel">
      <TerminalToolbar projectId={activeProjectId} />
      {showSearch && (
        <div className="terminal-search-bar">
          <input
            ref={searchInputRef}
            className="terminal-search-input"
            type="text"
            placeholder="Search terminal..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="terminal-search-btn" onClick={() => searchQuery && termViewRef.current?.searchPrev(searchQuery)} title="Previous (Shift+Enter)">
            &#9650;
          </button>
          <button className="terminal-search-btn" onClick={() => searchQuery && termViewRef.current?.searchNext(searchQuery)} title="Next (Enter)">
            &#9660;
          </button>
          <button className="terminal-search-btn" onClick={closeSearch} title="Close (Esc)">
            &times;
          </button>
        </div>
      )}
      <div className="terminal-content">
        {activeProjectId ? (
          <TerminalView ref={termViewRef} projectId={activeProjectId} />
        ) : (
          <div className="terminal-placeholder">
            <p>No project selected</p>
            <p className="terminal-placeholder-hint">
              Add a project from the left panel to get started
            </p>
          </div>
        )}
      </div>
      {activeProjectId && (
        <div className="terminal-statusbar">
          {branchInfo.branches.length > 0 ? (
            <div className="statusbar-branches">
              <span className="statusbar-branch-icon">&#9588;</span>
              {branchInfo.branches.map((branch) => (
                <span
                  key={branch}
                  className={`statusbar-branch-item ${branch === branchInfo.current ? 'statusbar-branch-item--current' : ''}`}
                  title={branch}
                >
                  {branch}
                </span>
              ))}
            </div>
          ) : (
            <span className="statusbar-no-git">No Git</span>
          )}
          {mcpServers.length > 0 && (
            <div className="statusbar-mcp">
              <span className="statusbar-mcp-label">MCP:</span>
              {mcpServers.map((server) => (
                <span
                  key={server.name}
                  className="statusbar-mcp-pill"
                  title={`${server.name} (${server.type})`}
                >
                  {server.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
