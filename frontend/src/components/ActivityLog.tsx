import { useEffect, useRef } from 'react'
import type { ActivityEntry } from '../hooks/useWebSocketGame'

const TYPE_STYLE: Record<ActivityEntry['type'], string> = {
  correct:    'text-emerald-400',
  wrong:      'text-red-400',
  info:       'text-blue-300',
  system:     'text-gray-400 italic',
  join:       'text-violet-400',
  leave:      'text-gray-500',
  suggestion: 'text-sky-400',
  hint:       'text-amber-400',
}

interface Props { entries: ActivityEntry[] }

export function ActivityLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-2 gap-2 font-mono text-xs" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
      {entries.length === 0 && (
        <p className="text-gray-600 text-center pt-4">Activity log — actions will appear here</p>
      )}
      {entries.map(e => (
        <div key={e.id} className="flex gap-2">
          <span className="text-gray-600 shrink-0 mt-0.5">
            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className={TYPE_STYLE[e.type]}>{e.text}</span>
            {e.detail && <span className="text-gray-500 text-xs leading-tight">{e.detail}</span>}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
