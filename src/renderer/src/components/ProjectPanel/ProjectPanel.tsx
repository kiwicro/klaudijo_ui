import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { ProjectItem } from './ProjectItem'

export const ProjectPanel: React.FC = () => {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const statuses = useProjectStore((s) => s.statuses)
  const loaded = useProjectStore((s) => s.loaded)
  const load = useProjectStore((s) => s.load)
  const addProject = useProjectStore((s) => s.addProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const setActive = useProjectStore((s) => s.setActive)
  const setStatus = useProjectStore((s) => s.setStatus)
  const reorderProjects = useProjectStore((s) => s.reorderProjects)

  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  const handleAdd = useCallback(async () => {
    const dirPath = await window.api.selectDirectory()
    if (!dirPath) return
    const name = dirPath.split(/[\\/]/).pop() || dirPath
    const project = await addProject(name, dirPath)
    setActive(project.id)
    await window.api.ptyCreate(project.id, project.path, project.name)
    setStatus(project.id, 'running')
  }, [addProject, setActive, setStatus])

  const handleScanFolder = useCallback(async () => {
    const dirPath = await window.api.selectDirectory()
    if (!dirPath) return
    const detected = await window.api.detectProjects(dirPath)
    if (detected.length === 0) return
    const existingPaths = new Set(useProjectStore.getState().projects.map((p) => p.path))
    let lastProject: { id: string; name: string; path: string } | null = null
    for (const d of detected) {
      if (existingPaths.has(d.path)) continue
      lastProject = await addProject(d.name, d.path)
    }
    if (lastProject) {
      setActive(lastProject.id)
    }
  }, [addProject, setActive])

  const handleSelect = useCallback(
    async (id: string) => {
      if (activeProjectId === id) return
      setActive(id)

      const project = useProjectStore.getState().projects.find((p) => p.id === id)
      if (!project) return

      const status = statuses[id]
      if (!status || status === 'idle') {
        await window.api.ptyCreate(id, project.path, project.name)
        setStatus(id, 'running')
      }
    },
    [activeProjectId, setActive, setStatus, statuses]
  )

  const handleRemove = useCallback(
    async (id: string) => {
      await removeProject(id)
    },
    [removeProject]
  )

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (toIndex: number) => {
      const fromIndex = dragIndexRef.current
      dragIndexRef.current = null
      setDragOverIndex(null)
      if (fromIndex !== null && fromIndex !== toIndex) {
        reorderProjects(fromIndex, toIndex)
      }
    },
    [reorderProjects]
  )

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }, [])

  return (
    <div className="project-panel" tabIndex={0} onDragEnd={handleDragEnd}>
      <div className="panel-header">
        <span className="panel-title">Projects</span>
      </div>
      <div className="project-list">
        {projects.map((project, index) => (
          <ProjectItem
            key={project.id}
            project={project}
            index={index}
            isActive={activeProjectId === project.id}
            status={statuses[project.id] ?? 'idle'}
            onSelect={() => handleSelect(project.id)}
            onRemove={() => handleRemove(project.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragOver={dragOverIndex === index}
          />
        ))}
      </div>
      <div className="project-actions">
        <button className="add-project-btn" onClick={handleAdd}>
          + Add Project
        </button>
        <button className="add-project-btn scan-btn" onClick={handleScanFolder}>
          Scan Folder
        </button>
      </div>
    </div>
  )
}
