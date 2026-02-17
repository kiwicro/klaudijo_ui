import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { useTerminal } from '../../hooks/useTerminal'

interface Props {
  projectId: string | null
}

export interface TerminalViewHandle {
  searchNext: (query: string) => void
  searchPrev: (query: string) => void
  clearSearch: () => void
}

function quotePath(p: string): string {
  return p.includes(' ') ? `"${p}"` : p
}

export const TerminalView = forwardRef<TerminalViewHandle, Props>(({ projectId }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
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

  // Global document-level drag/drop listeners — xterm can't intercept these
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const isOverTerminal = (e: DragEvent) => {
      const rect = wrapper.getBoundingClientRect()
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      )
    }

    const onDragOver = (e: DragEvent) => {
      if (!isOverTerminal(e)) {
        setDragOver(false)
        return
      }
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }

    const onDragLeave = (e: DragEvent) => {
      // Left the window entirely
      if (!e.relatedTarget) {
        setDragOver(false)
      }
    }

    const onDrop = (e: DragEvent) => {
      if (!isOverTerminal(e)) {
        setDragOver(false)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      if (!projectId || !e.dataTransfer) return

      const klaudijoFile = e.dataTransfer.getData('application/klaudijo-file')
      if (klaudijoFile) {
        window.api.ptyInput(projectId, klaudijoFile)
        return
      }

      if (e.dataTransfer.files.length > 0) {
        const paths = Array.from(e.dataTransfer.files)
          .map((f) => window.api.getFilePath(f))
          .filter(Boolean)
          .map(quotePath)
        if (paths.length > 0) {
          window.api.ptyInput(projectId, paths.join(' '))
        }
        return
      }

      const text = e.dataTransfer.getData('text/plain')
      if (text) {
        window.api.ptyInput(projectId, text)
      }
    }

    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [projectId])

  return (
    <div
      ref={wrapperRef}
      className={`terminal-view ${dragOver ? 'terminal-view--dragover' : ''}`}
    >
      {dragOver && <div className="terminal-drop-overlay" />}
      <div
        className="terminal-container"
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
})
