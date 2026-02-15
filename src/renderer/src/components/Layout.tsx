import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ProjectPanel } from './ProjectPanel/ProjectPanel'
import { TerminalPanel } from './TerminalPanel/TerminalPanel'
import { FilePanel } from './FilePanel/FilePanel'

export const Layout: React.FC = () => {
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(280)
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef<'left' | 'right' | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Load saved widths
  useEffect(() => {
    window.api?.storeGet('panelWidths').then((widths: unknown) => {
      const w = widths as { left: number; right: number } | undefined
      if (w) {
        setLeftWidth(w.left)
        setRightWidth(w.right)
      }
    })
  }, [])

  const handleMouseDown = useCallback(
    (side: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = side
      startX.current = e.clientX
      startWidth.current = side === 'left' ? leftWidth : rightWidth
      setIsDragging(true)
    },
    [leftWidth, rightWidth]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current

      if (dragging.current === 'left') {
        const newWidth = Math.max(160, Math.min(500, startWidth.current + delta))
        setLeftWidth(newWidth)
      } else {
        const newWidth = Math.max(160, Math.min(500, startWidth.current - delta))
        setRightWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = null
        setIsDragging(false)
        // Save widths - read from state via refs would be stale, use a timeout
        setTimeout(() => {
          const root = document.querySelector('.layout')
          if (root) {
            const cols = getComputedStyle(root).gridTemplateColumns.split(' ')
            const left = parseFloat(cols[0])
            const right = parseFloat(cols[4])
            window.api?.storeSet('panelWidths', { left, right })
          }
        }, 0)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div
      className={`layout ${isDragging ? 'layout--dragging' : ''}`}
      style={{
        gridTemplateColumns: `${leftWidth}px 4px 1fr 4px ${rightWidth}px`
      }}
    >
      <ProjectPanel />
      <div className="resize-handle" onMouseDown={handleMouseDown('left')} />
      <TerminalPanel />
      <div className="resize-handle" onMouseDown={handleMouseDown('right')} />
      <FilePanel />
    </div>
  )
}
