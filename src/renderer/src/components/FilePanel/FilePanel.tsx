import React, { useEffect, useCallback, useMemo } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { useFileStore } from '../../stores/file-store'
import { FileItem } from './FileItem'

const EMPTY_FILES: never[] = []

export const FilePanel: React.FC = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const activeProject = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId))
  const loaded = useFileStore((s) => s.loaded)
  const load = useFileStore((s) => s.load)
  const addFiles = useFileStore((s) => s.addFiles)
  const removeFile = useFileStore((s) => s.removeFile)
  const autoPopulateClaudeMd = useFileStore((s) => s.autoPopulateClaudeMd)
  const files = useFileStore((s) =>
    activeProjectId ? s.pinnedFiles[activeProjectId] ?? EMPTY_FILES : EMPTY_FILES
  )

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  useEffect(() => {
    if (!activeProjectId || !loaded) return
    const project = useProjectStore.getState().projects.find((p) => p.id === activeProjectId)
    if (project) {
      autoPopulateClaudeMd(activeProjectId, project.path)
    }
  }, [activeProjectId, loaded, autoPopulateClaudeMd])

  const handleAddFiles = useCallback(async () => {
    if (!activeProjectId || !activeProject) return
    const selected = await window.api.selectFiles(activeProject.path)
    if (selected.length > 0) {
      await addFiles(activeProjectId, selected)
    }
  }, [activeProjectId, activeProject, addFiles])

  const handleRemove = useCallback(
    async (absolutePath: string) => {
      if (!activeProjectId) return
      await removeFile(activeProjectId, absolutePath)
    },
    [activeProjectId, removeFile]
  )

  return (
    <div className="file-panel" tabIndex={0}>
      <div className="panel-header">
        <span className="panel-title">Quick Files</span>
      </div>
      <div className="file-list">
        {!activeProjectId ? (
          <div className="file-placeholder">Select a project</div>
        ) : files.length === 0 ? (
          <div className="file-placeholder">No pinned files</div>
        ) : (
          files.map((file) => (
            <FileItem
              key={file.absolutePath}
              file={file}
              onRemove={() => handleRemove(file.absolutePath)}
            />
          ))
        )}
      </div>
      <button className="add-file-btn" onClick={handleAddFiles} disabled={!activeProjectId}>
        + Pin Files
      </button>
    </div>
  )
}
