import { useEffect, useRef, useState, useCallback } from 'react'
import {
  generateLogBatch,
  generateLogLine,
  hashSeed,
  SEVERITY_CLASSES,
  SEVERITY_DOT,
  SOURCE_CLASSES,
  type SiemLogLine,
} from '../lib/siemLogs'

// ── Config ────────────────────────────────────────────────────────────────────

const INITIAL_LINES   = 18    // backlog shown on mount
const STREAM_INTERVAL = 2800  // ms between new lines during deciding phase
const BURST_INTERVAL  = 600   // ms during encryption / worm phases (panic mode)
const MAX_LINES       = 120   // cap to avoid memory growth

// Panic mode triggers on phases that ARE crisis phases, not phases that merely
// mention related words in their description (e.g. "no encryption" in Detection).
// startsWith() is intentional — it matches "Containment, Eradication & Recovery"
// and "Emergency Response" while ignoring "Detection & Analysis (no encryption...)".
const PANIC_PHASE_PREFIXES = ['containment', 'eradication', 'emergency']

// ── Sub-components ────────────────────────────────────────────────────────────

function LogRow({ line, isNew }: { line: SiemLogLine; isNew: boolean }) {
  return (
    <div
      className={`flex gap-2 items-start font-mono text-[11px] leading-tight px-3 py-1 border-b border-gray-800/60 transition-colors duration-300 ${
        isNew ? 'bg-gray-700/30' : 'bg-transparent'
      }`}
    >
      {/* Severity dot */}
      <div className="shrink-0 mt-1">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[line.severity]}`} />
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-gray-600 w-[82px]">{line.ts}</span>

      {/* Source badge */}
      <span className={`shrink-0 w-[62px] ${SOURCE_CLASSES[line.source]}`}>{line.source}</span>

      {/* Event ID */}
      <span className="shrink-0 text-gray-600 w-[78px]">{line.eventId}</span>

      {/* Host */}
      <span className="shrink-0 text-gray-500 w-[88px] truncate">{line.host}</span>

      {/* Message */}
      <span className={`flex-1 min-w-0 break-words ${SEVERITY_CLASSES[line.severity]}`}>
        {line.message}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  irPhase:      string
  keyTTPs:      string[]
  paused?:      boolean    // pause streaming when not on deciding phase
  roleFilter?:  string[]   // if set, only show logs from these sources (role-based)
  sessionSeed?: number     // stable seed shared by all clients in the same session
}

export function SiemFeedPanel({ irPhase, keyTTPs, paused = false, roleFilter, sessionSeed }: Props) {
  const [lines,      setLines]     = useState<SiemLogLine[]>([])
  const [newIds,     setNewIds]    = useState<Set<number>>(new Set())
  const [autoScroll, setAutoScroll] = useState(true)
  const [filterSev,  setFilterSev]  = useState<string>('ALL')
  const [filterSrc,  setFilterSrc]  = useState<string>('ALL')
  const [panicMode,  setPanicMode]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // H1 fix: use startsWith so "Detection & Analysis (no encryption...)" never triggers
  useEffect(() => {
    const lp = irPhase.toLowerCase().trimStart()
    setPanicMode(PANIC_PHASE_PREFIXES.some(p => lp.startsWith(p)))
  }, [irPhase])

  // Track whether this is the first mount (needs full backlog) vs a phase transition
  const isFirstMount = useRef(true)

  // On first mount: generate a full backlog.
  // On phase change: prepend a small contextual batch to the existing history
  // so analysts keep the logs they were reading instead of losing them.
  // H2 fix: seeded so all clients in the same session see the same initial backlog.
  useEffect(() => {
    if (paused && !isFirstMount.current) return   // L2: skip phase transitions while paused
    const seed = sessionSeed !== undefined ? sessionSeed ^ hashSeed(irPhase) : undefined

    if (isFirstMount.current) {
      isFirstMount.current = false
      const initial = generateLogBatch(irPhase, keyTTPs, INITIAL_LINES, seed)
      const stamped = initial.map((l, i) => ({
        ...l,
        ts: offsetTs(l.ts, -(INITIAL_LINES - i) * 3000),
      }))
      setLines(stamped)
    } else {
      // Phase advanced — inject 4 transition lines at the top, keep full history
      const transition = generateLogBatch(irPhase, keyTTPs, 4, seed)
      setLines(prev => [...transition, ...prev].slice(0, MAX_LINES))
      setNewIds(new Set(transition.map(l => l.id)))
    }
  }, [irPhase, sessionSeed])
  // keyTTPs is intentionally excluded from this dep array.
  // It comes from scenario.scenario_structure.keyTTPs which is a stable
  // object reference for the lifetime of a scenario — it never changes
  // after the scenario loads. Including it would cause the entire log
  // backlog to regenerate (and scroll to top) on every render that
  // produces a new array reference, which React may do even when the
  // contents are identical. If keyTTPs ever becomes dynamic, add it here
  // and memoize the prop at the callsite with useMemo.

  // Streaming interval
  useEffect(() => {
    if (paused) return
    const interval = panicMode ? BURST_INTERVAL : STREAM_INTERVAL
    const timer = setInterval(() => {
      const newLine = generateLogLine(irPhase, keyTTPs)
      setLines(prev => {
        const next = [newLine, ...prev].slice(0, MAX_LINES)
        return next
      })
      setNewIds(prev => {
        const next = new Set([newLine.id, ...prev])
        if (next.size > 10) {
          const arr = [...next]
          arr.splice(8)
          return new Set(arr)
        }
        return next
      })
    }, interval)
    return () => clearInterval(timer)
  }, [irPhase, keyTTPs, paused, panicMode])

  // Auto-scroll to top (newest-first layout)
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [lines.length, autoScroll])

  // Pause auto-scroll when user scrolls down
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    setAutoScroll(containerRef.current.scrollTop < 40)
  }, [])

  // Filtered view
  const visible = lines.filter(l => {
    if (filterSev !== 'ALL' && l.severity !== filterSev) return false
    if (filterSrc !== 'ALL' && l.source   !== filterSrc) return false
    // Role-based source filter (Network sees Firewall/DNS/Proxy, Endpoint sees EDR/Sysmon/WinEvent)
    if (roleFilter && roleFilter.length > 0 && !roleFilter.includes(l.source)) return false
    return true
  })

  const criticalCount = lines.filter(l => l.severity === 'CRITICAL').length
  const highCount     = lines.filter(l => l.severity === 'HIGH').length

  return (
    <div className="flex flex-col h-full bg-gray-950/90 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${paused ? 'bg-gray-600' : panicMode ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-xs text-gray-300 font-semibold font-mono tracking-widest">SIEM FEED</span>
            {roleFilter && roleFilter.length > 0 && (
              <span className="text-[11px] font-mono text-gray-500 border border-gray-700 rounded px-1">
                {roleFilter.join(' · ')}
              </span>
            )}
            {panicMode && (
              <span className="text-xs text-red-400 font-mono border border-red-800 rounded px-1 animate-pulse">
                HIGH VOLUME
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            {criticalCount > 0 && (
              <span className="text-red-400 font-bold">{criticalCount} CRIT</span>
            )}
            {highCount > 0 && (
              <span className="text-orange-400">{highCount} HIGH</span>
            )}
            <span className="text-gray-600">{lines.length} events</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {/* Severity filter */}
          <div className="flex items-center gap-1">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'WARN', 'INFO'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterSev(s)}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors ${
                  filterSev === s
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
            {(['ALL', 'EDR', 'WinEvent', 'Sysmon', 'AV', 'Firewall', 'DNS', 'Proxy', 'SIEM'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterSrc(s)}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors ${
                  filterSrc === s
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="shrink-0 flex gap-2 px-3 py-1 border-b border-gray-800 bg-gray-900/50 font-mono text-[11px] text-gray-600 uppercase tracking-wider">
        <span className="w-1.5 shrink-0" />
        <span className="w-[82px] shrink-0">Time</span>
        <span className="w-[62px] shrink-0">Source</span>
        <span className="w-[78px] shrink-0">Event ID</span>
        <span className="w-[88px] shrink-0">Host</span>
        <span className="flex-1">Message</span>
      </div>

      {/* Log lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {visible.length === 0 ? (
          <p className="text-gray-600 text-xs text-center pt-6 font-mono">No events match current filter</p>
        ) : (
          visible.map(line => (
            <LogRow key={line.id} line={line} isNew={newIds.has(line.id)} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll indicator */}
      {!autoScroll && (
        <div className="shrink-0 border-t border-gray-800 px-3 py-1.5 bg-gray-900/80">
          <button
            onClick={() => { setAutoScroll(true); if (containerRef.current) containerRef.current.scrollTop = 0 }}
            className="w-full text-xs text-cyan-500 hover:text-cyan-300 font-mono flex items-center justify-center gap-1 transition-colors"
          >
            ↑ Jump to latest
          </button>
        </div>
      )}
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function offsetTs(ts: string, offsetMs: number): string {
  const [h, m, rest]   = ts.split(':')
  const [s, ms]        = rest.split('.')
  const base = new Date()
  base.setHours(Number(h), Number(m), Number(s), Number(ms))
  const shifted = new Date(base.getTime() + offsetMs)
  const hh = String(shifted.getHours()).padStart(2, '0')
  const mm = String(shifted.getMinutes()).padStart(2, '0')
  const ss = String(shifted.getSeconds()).padStart(2, '0')
  const mss = String(shifted.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${mss}`
}
