import React, { useState, useCallback } from 'react'
import { PinnedFile } from '../../../../shared/types'

interface Props {
  file: PinnedFile
  onRemove: () => void
}

const fileIcons: Record<string, string> = {
  ts: 'TS',
  tsx: 'TX',
  js: 'JS',
  jsx: 'JX',
  py: 'PY',
  json: '{}',
  md: 'MD',
  css: 'CS',
  html: 'HT',
  yaml: 'YA',
  yml: 'YA',
  toml: 'TM',
  rs: 'RS',
  go: 'GO'
}

function getFileLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return fileIcons[ext] ?? name.slice(0, 2).toUpperCase()
}

export const FileItem: React.FC<Props> = ({ file, onRemove }) => {
  const [showContext, setShowContext] = useState(false)

  const handleClick = useCallback(() => {
    window.api.clipboardWrite(file.relativePath)
  }, [file.relativePath])

  const handleDoubleClick = useCallback(() => {
    window.api.openInEditor(file.absolutePath)
  }, [file.absolutePath])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setShowContext(true)
  }, [])

  const closeContext = useCallback(() => setShowContext(false), [])

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', file.relativePath)
      e.dataTransfer.setData('application/klaudijo-file', file.relativePath)
      e.dataTransfer.effectAllowed = 'copy'
    },
    [file.relativePath]
  )

  return (
    <div className="file-item-wrapper">
      <div
        className="file-item"
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={`Click: copy path | Double-click: open | Drag: drop into terminal\n${file.absolutePath}`}
      >
        <span className="file-icon">{getFileLabel(file.name)}</span>
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-path">{file.relativePath}</span>
        </div>
      </div>
      {showContext && (
        <>
          <div className="context-overlay" onClick={closeContext} />
          <div className="context-menu">
            <button
              onClick={() => {
                window.api.openInEditor(file.absolutePath)
                closeContext()
              }}
            >
              Open in Editor
            </button>
            <button
              onClick={() => {
                window.api.showInExplorer(file.absolutePath)
                closeContext()
              }}
            >
              Show in Explorer
            </button>
            <button
              onClick={() => {
                window.api.clipboardWrite(file.relativePath)
                closeContext()
              }}
            >
              Copy Path
            </button>
            <div className="context-separator" />
            <button
              onClick={() => {
                onRemove()
                closeContext()
              }}
            >
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  )
}
