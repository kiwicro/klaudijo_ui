import { shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface DirEntry {
  name: string
  isDirectory: boolean
  absolutePath: string
}

export function listDirectory(dirPath: string): DirEntry[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        absolutePath: path.join(dirPath, e.name)
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

export function openInEditor(filePath: string): void {
  shell.openPath(filePath)
}

export function showInExplorer(filePath: string): void {
  shell.showItemInFolder(filePath)
}

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'go.mod',
  'project.godot',
  'pom.xml',
  'build.gradle',
  'CMakeLists.txt',
  'Makefile',
  '.claude',
  'CLAUDE.md'
]

const MAX_SCAN_DEPTH = 4
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'release', '__pycache__', '.venv', 'venv', 'target', '.next', '.nuxt'])

export function detectProjects(parentDir: string): { name: string; path: string }[] {
  const results: { name: string; path: string }[] = []
  const seen = new Set<string>()

  function isProject(dirPath: string): boolean {
    return PROJECT_MARKERS.some((marker) => {
      try {
        fs.statSync(path.join(dirPath, marker))
        return true
      } catch {
        return false
      }
    })
  }

  function scan(dir: string, depth: number): void {
    if (depth > MAX_SCAN_DEPTH) return
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.') && entry.name !== '.claude') continue
        if (SKIP_DIRS.has(entry.name)) continue
        const dirPath = path.join(dir, entry.name)
        if (isProject(dirPath) && !seen.has(dirPath)) {
          seen.add(dirPath)
          results.push({ name: entry.name, path: dirPath })
          // Don't recurse into projects (a project inside a project is unusual)
          continue
        }
        scan(dirPath, depth + 1)
      }
    } catch {
      // can't read directory
    }
  }

  scan(parentDir, 0)
  return results.sort((a, b) => a.name.localeCompare(b.name))
}

export function discoverClaudeMdFiles(projectPath: string): { absolutePath: string; relativePath: string; name: string }[] {
  console.log('[file-service] discoverClaudeMdFiles called with:', projectPath)
  const results: { absolutePath: string; relativePath: string; name: string }[] = []

  const addIfExists = (relPath: string) => {
    const abs = path.join(projectPath, relPath)
    try {
      if (fs.statSync(abs).isFile()) {
        console.log('[file-service] Found:', abs)
        results.push({
          absolutePath: abs,
          relativePath: relPath,
          name: path.basename(relPath)
        })
      }
    } catch {
      // doesn't exist, skip
    }
  }

  // Root-level CLAUDE.md
  addIfExists('CLAUDE.md')

  // .claude directory md files
  const claudeDir = path.join(projectPath, '.claude')
  console.log('[file-service] Checking .claude dir:', claudeDir)
  try {
    if (fs.statSync(claudeDir).isDirectory()) {
      console.log('[file-service] .claude dir exists, scanning...')
      const scanDir = (dir: string, relBase: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const rel = relBase ? `${relBase}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            scanDir(path.join(dir, entry.name), rel)
          } else if (entry.name.toLowerCase().endsWith('.md')) {
            console.log('[file-service] Found .claude MD:', entry.name)
            results.push({
              absolutePath: path.join(dir, entry.name),
              relativePath: `.claude/${rel}`,
              name: entry.name
            })
          }
        }
      }
      scanDir(claudeDir, '')
    }
  } catch (err) {
    console.log('[file-service] .claude dir error:', err)
  }

  console.log('[file-service] Total discovered:', results.length)
  return results
}
