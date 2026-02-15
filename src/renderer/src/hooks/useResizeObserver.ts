import { useEffect, useRef } from 'react'

export function useResizeObserver(
  callback: (entry: ResizeObserverEntry) => void
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) callback(entries[0])
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [callback])

  return ref
}
