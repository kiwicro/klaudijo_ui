import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'

interface UseTerminalOptions {
  projectId: string | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useTerminal({ projectId, containerRef }: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const fit = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  const searchNext = useCallback((query: string) => {
    searchAddonRef.current?.findNext(query, { caseSensitive: false, regex: false })
  }, [])

  const searchPrev = useCallback((query: string) => {
    searchAddonRef.current?.findPrevious(query, { caseSensitive: false, regex: false })
  }, [])

  const clearSearch = useCallback(() => {
    searchAddonRef.current?.clearDecorations()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !projectId) return

    const term = new Terminal({
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b7066',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8'
      },
      cursorBlink: true,
      allowTransparency: false,
      scrollback: 10000
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(searchAddon)

    term.open(container)

    requestAnimationFrame(() => fitAddon.fit())

    term.onData((data) => {
      window.api.ptyInput(projectId, data)
    })

    // Handle Ctrl+V paste (Electron doesn't wire this up automatically)
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.ctrlKey && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.api.ptyInput(projectId, text)
        })
        return false
      }
      return true
    })

    const removePtyData = window.api.onPtyData((id, data) => {
      if (id === projectId) {
        term.write(data)
      }
    })

    term.onResize(({ cols, rows }) => {
      window.api.ptyResize(projectId, cols, rows)
    })

    termRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    window.api.ptyGetBuffer(projectId).then((buffer) => {
      if (buffer) term.write(buffer)
    })

    cleanupRef.current = () => {
      removePtyData()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
    }

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [projectId, containerRef])

  return { terminal: termRef, fit, searchNext, searchPrev, clearSearch }
}
