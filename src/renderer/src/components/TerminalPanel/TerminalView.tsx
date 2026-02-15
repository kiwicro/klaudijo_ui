import React, { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { useTerminal } from '../../hooks/useTerminal'

interface Props {
  projectId: string | null
}

export interface TerminalViewHandle {
  searchNext: (query: string) => void
  searchPrev: (query: string) => void
  clearSearch: () => void
}

export const TerminalView = forwardRef<TerminalViewHandle, Props>(({ projectId }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { fit, searchNext, searchPrev, clearSearch } = useTerminal({ projectId, containerRef })
  const [dragOver, setDragOver] = useState(false)

  useImperativeHandle(ref, () => ({ searchNext, searchPrev, clearSearch }), [searchNext, searchPrev, clearSearch])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      fit()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fit, projectId])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (!projectId) return

      const klaudijoFile = e.dataTransfer.getData('application/klaudijo-file')
      if (klaudijoFile) {
        window.api.ptyInput(projectId, klaudijoFile)
        return
      }

      if (e.dataTransfer.files.length > 0) {
        const paths = Array.from(e.dataTransfer.files).map((f) => f.path)
        window.api.ptyInput(projectId, paths.join(' '))
        return
      }

      const text = e.dataTransfer.getData('text/plain')
      if (text) {
        window.api.ptyInput(projectId, text)
      }
    },
    [projectId]
  )

  return (
    <div
      className={`terminal-view ${dragOver ? 'terminal-view--dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="terminal-container"
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
})
