import React from 'react'
import { Project, PtyStatus } from '../../../../shared/types'

interface Props {
  project: Project
  index: number
  isActive: boolean
  status: PtyStatus
  onSelect: () => void
  onRemove: () => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (index: number) => void
  isDragOver: boolean
}

const statusColors: Record<PtyStatus, string> = {
  running: '#a6e3a1',
  exited: '#f38ba8',
  idle: '#585b70'
}

export const ProjectItem: React.FC<Props> = ({
  project, index, isActive, status, onSelect, onRemove,
  onDragStart, onDragOver, onDrop, isDragOver
}) => {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    window.api.showInExplorer(project.path)
  }

  return (
    <div
      className={`project-item ${isActive ? 'active' : ''} ${isDragOver ? 'project-item--dragover' : ''}`}
      draggable
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      title={project.path}
    >
      <span className="project-status-dot" style={{ backgroundColor: statusColors[status] }} />
      <span className="project-name">{project.name}</span>
      <button
        className="project-remove-btn"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        title="Remove project"
      >
        &times;
      </button>
    </div>
  )
}
