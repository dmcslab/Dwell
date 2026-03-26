/**
 * ScenarioSelector.tsx — Kill Chain Map
 * ──────────────────────────────────────
 * Scenarios filtered by MITRE ATT&CK phase across the top.
 * Grid of cards with difficulty bars, TTP tags, and phase chips.
 * Clicking a phase shows only scenarios that exercise that TTP category.
 * Props interface is unchanged from the previous version.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { gameApi } from '../api/game'
import { api } from '../api/client'
import { DwellLogo } from '../components/DwellLogo'
import type { ScenarioFull } from '../types/scenario'

// ── Props (unchanged contract with App.tsx) ───────────────────────────────────

interface Props {
  playerName:          string
  onClearName:         () => void
  onSelectWithSession: (
    scenarioId: number,
    sessionId:  string,
    shareLink:  string,
    joinToken:  string,
  ) => void
  onAdmin: () => void
}

// ── ATT&CK phase definitions ──────────────────────────────────────────────────

const PHASES = [
  { id: 'all',      label: 'All Phases'      },
  { id: 'initial',  label: 'Initial Access'  },
  { id: 'exec',     label: 'Execution'       },
  { id: 'persist',  label: 'Persistence'     },
  { id: 'lateral',  label: 'Lateral Movement'},
  { id: 'exfil',    label: 'Exfiltration'    },
  { id: 'impact',   label: 'Impact'          },
] as const

type PhaseId = typeof PHASES[number]['id']

// TTP prefix → phase mapping
const TTP_PHASE_MAP: [string, PhaseId[]][] = [
  ['T1566', ['initial']], ['T1078', ['initial']], ['T1190', ['initial']],
  ['T1133', ['initial']], ['T1195', ['initial']], ['T1204', ['initial']],
  ['T1059', ['exec']],    ['T1218', ['exec']],    ['T1055', ['exec']],
  ['T1027', ['exec']],
  ['T1547', ['persist']], ['T1053', ['persist']], ['T1546', ['persist']],
  ['T1036', ['persist']],
  ['T1021', ['lateral']], ['T1210', ['lateral']], ['T1003', ['lateral']],
  ['T1558', ['lateral']],
  ['T1041', ['exfil']],   ['T1048', ['exfil']],   ['T1537', ['exfil']],
  ['T1657', ['exfil', 'impact']],
  ['T1486', ['impact']],  ['T1489', ['impact']],  ['T1490', ['impact']],
  ['T1485', ['impact']],  ['T1562', ['impact']],  ['T1199', ['initial', 'impact']],
]

function getScenarioPhases(keyTTPs: string[], attackVector = ''): Set<PhaseId> {
  const phases = new Set<PhaseId>()
  phases.add('impact')

  // Primary: match on TTP codes
  for (const ttp of keyTTPs) {
    const code = ttp.split(/[\s—]/)[0].trim()
    for (const [prefix, ps] of TTP_PHASE_MAP) {
      if (code.startsWith(prefix)) ps.forEach(p => phases.add(p))
    }
  }

  // Fallback: derive from attack vector text when keyTTPs is empty or sparse
  if (phases.size <= 1 && attackVector) {
    const v = attackVector.toLowerCase()
    if (v.includes('phish') || v.includes('email') || v.includes('vishing') ||
        v.includes('vpn') || v.includes('citrix') || v.includes('exploit') ||
        v.includes('cve-') || v.includes('zero-day') || v.includes('supply chain') ||
        v.includes('download') || v.includes('installer'))
      phases.add('initial')
    if (v.includes('powershell') || v.includes('macro') || v.includes('psexec') ||
        v.includes('cobalt') || v.includes('bazarloader') || v.includes('script') ||
        v.includes('cmd') || v.includes('wmi'))
      phases.add('exec')
    if (v.includes('scheduled') || v.includes('persistence') || v.includes('registry') ||
        v.includes('service') || v.includes('startup'))
      phases.add('persist')
    if (v.includes('lateral') || v.includes('rdp') || v.includes('pass-the') ||
        v.includes('mimikatz') || v.includes('smb') || v.includes('pivot') ||
        v.includes('domain controller') || v.includes('zerologon') || v.includes('golden ticket') ||
        v.includes('credential') || v.includes('spray'))
      phases.add('lateral')
    if (v.includes('rclone') || v.includes('exfil') || v.includes('mega') ||
        v.includes('data theft') || v.includes('double extortion') || v.includes('exfiltration'))
      phases.add('exfil')
  }

  return phases
}

// ── Difficulty config ─────────────────────────────────────────────────────────

const DIFF: Record<string, {
  label: string; barWidth: string; barColor: string
  text: string; border: string
}> = {
  easy: {
    label: '✓ EASY', barWidth: '33%', barColor: '#22c55e',
    text: 'text-emerald-400', border: 'border-emerald-800/60',
  },
  medium: {
    label: '◈ MEDIUM', barWidth: '66%', barColor: '#f59e0b',
    text: 'text-amber-400', border: 'border-amber-800/60',
  },
  hard: {
    label: '⚠ HARD', barWidth: '100%', barColor: '#ef4444',
    text: 'text-red-400', border: 'border-red-900/60',
  },
}

// ── Phase chip colours ────────────────────────────────────────────────────────

const PHASE_COLOR: Record<PhaseId, string> = {
  all:     '',
  initial: 'bg-sky-950 text-sky-400 border-sky-900/60',
  exec:    'bg-violet-950 text-violet-400 border-violet-900/60',
  persist: 'bg-orange-950 text-orange-400 border-orange-900/60',
  lateral: 'bg-amber-950 text-amber-400 border-amber-900/60',
  exfil:   'bg-rose-950 text-rose-400 border-rose-900/60',
  impact:  'bg-red-950 text-red-400 border-red-900/60',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScenarioSelector({
  playerName, onClearName, onSelectWithSession, onAdmin,
}: Props) {
  const [scenarios,   setScenarios]  = useState<ScenarioFull[]>([])
  const [loading,     setLoading]    = useState(true)
  const [starting,    setStarting]   = useState<number | null>(null)
  const [startErr,    setStartErr]   = useState('')
  const [fetchErr,    setFetchErr]   = useState(false)
  const [activePhase, setPhase]      = useState<PhaseId>('all')
  const [diffFilter,  setDiffFilter] = useState('all')
  const [search,      setSearch]     = useState('')

  const fetchScenarios = () => {
    setLoading(true)
    setFetchErr(false)
    api.get<ScenarioFull[]>('/game/scenarios')
      .then(setScenarios)
      .catch(() => setFetchErr(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchScenarios() }, [])

  // Phase sets per scenario
  const phaseMap = useMemo(() =>
    new Map(scenarios.map(s => [
      s.id,
      getScenarioPhases(
      s.scenario_structure?.keyTTPs ?? [],
      s.scenario_structure?.attackVector ?? s.description ?? ''
    ),
    ])),
  [scenarios])

  // Phase counts
  const counts = useMemo(() => {
    const c: Record<PhaseId, number> = {
      all: scenarios.length, initial: 0, exec: 0,
      persist: 0, lateral: 0, exfil: 0, impact: 0,
    }
    for (const s of scenarios) {
      const ps = phaseMap.get(s.id) ?? new Set()
      for (const p of ps) if (p !== 'all') c[p]++
    }
    return c
  }, [scenarios, phaseMap])

  // Filtered list
  const visible = useMemo(() => scenarios.filter(s => {
    if (activePhase !== 'all') {
      if (!(phaseMap.get(s.id) ?? new Set()).has(activePhase)) return false
    }
    if (diffFilter !== 'all' && s.difficulty_level !== diffFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) &&
          !(s.scenario_structure?.attackVector ?? '').toLowerCase().includes(q) &&
          !(s.description ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [scenarios, phaseMap, activePhase, diffFilter, search])

  const handleSelect = useCallback(async (id: number) => {
    setStarting(id); setStartErr('')
    try {
      const res = await gameApi.start(id, '', playerName)
      onSelectWithSession(id, res.session_id, res.share_link, res.join_token)
    } catch (e: any) {
      setStartErr(e.message ?? 'Failed to start session')
      setStarting(null)
    }
  }, [playerName, onSelectWithSession])

  // ── Layout ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 bg-data-grid flex flex-col">

      {/* NAV */}
      <header className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center gap-4">
          <DwellLogo size="sm" />
          <span className="hidden sm:block text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">
            Scenario Library
          </span>

          {/* Search */}
          <div className="flex-1 max-w-xs hidden md:block">
            <input
              type="text"
              placeholder="Search name, vector, TTP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg
                         px-3 py-1.5 text-xs text-gray-300 placeholder-gray-700
                         font-mono focus:outline-none focus:border-cyan-800 transition-colors"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Operator badge */}
            <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-800
                            rounded-lg px-3 py-1.5 select-none">
              <span className="text-[9px] font-mono tracking-[0.2em] text-gray-500 uppercase">
              Operator
              </span>
              <span className="text-xs font-semibold text-cyan-300 font-ui">{playerName}</span>
            </div>
            <button
              onClick={onAdmin}
              className="px-3 py-1.5 bg-gray-900 border border-gray-800
                         hover:bg-gray-800 hover:border-gray-700
                         text-gray-500 hover:text-gray-300
                         text-xs rounded-lg transition-all font-mono"
            >
              ⚙
            </button>
            <button
              onClick={onClearName}
              className="text-xs text-gray-700 hover:text-red-400 font-mono transition-colors"
              title="Change name"
            >
              ✕
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">

        {/* Page heading */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-6 bg-cyan-700/60" />
            <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-700 uppercase">
              MITRE ATT&CK · Navigator
            </span>
          </div>
          <h1 className="font-display text-3xl tracking-wide text-white leading-tight">
            Select Operation
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-ui">
          Filter by attack phase to target your skill gaps
          </p>
        </div>

        {/* ATT&CK phase tabs */}
        <div className="flex gap-1.5 flex-wrap mb-1">
          {PHASES.map(ph => {
            const active = activePhase === ph.id
            const count  = counts[ph.id]
            return (
              <button
                key={ph.id}
                onClick={() => setPhase(ph.id)}
                className={`
                  flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border
                  min-w-[80px] transition-all duration-200 cursor-pointer
                  ${active
                    ? 'bg-cyan-950/50 border-cyan-600/50 shadow-[0_0_14px_-4px_rgba(32,201,188,.25)]'
                    : 'bg-gray-900/50 border-gray-800/80 hover:border-gray-700 hover:bg-gray-900'}
                `}
              >
                <span className={`text-[9px] font-mono tracking-widest uppercase leading-tight
                  ${active ? 'text-cyan-400' : 'text-gray-400'}`}>
                  {ph.label}
                </span>
                <span className={`font-display text-xl leading-none
                  ${active ? 'text-white' : 'text-gray-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Kill-chain flow line */}
        <div className="relative h-px bg-gradient-to-r from-cyan-800/25 via-gray-800/50 to-transparent my-4">
          <div className="absolute right-0 top-1/2 -translate-y-1/2
                          border-t-[5px] border-t-transparent
                          border-b-[5px] border-b-transparent
                          border-l-[8px] border-l-gray-800" />
        </div>

        {/* Secondary filters + mobile search */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-[10px] font-mono tracking-widest text-gray-500 uppercase shrink-0">
          Difficulty:
          </span>
          {(['all', 'easy', 'medium', 'hard'] as const).map(d => {
            const active = diffFilter === d
            const cls = active
              ? d === 'easy'   ? 'border-emerald-700/60 text-emerald-400 bg-emerald-950/40'
              : d === 'medium' ? 'border-amber-700/60 text-amber-400 bg-amber-950/40'
              : d === 'hard'   ? 'border-red-800/60 text-red-400 bg-red-950/40'
              :                  'border-cyan-700/60 text-cyan-400 bg-cyan-950/40'
              : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
            return (
              <button key={d} onClick={() => setDiffFilter(d)}
                className={`text-[10px] font-mono tracking-widest uppercase
                             px-2.5 py-1 rounded-full border transition-all ${cls}`}>
                {d === 'all' ? 'All' : d}
              </button>
            )
          })}

          {/* Mobile search */}
          <div className="md:hidden flex-1 min-w-[140px]">
            <input type="text" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg
                         px-3 py-1.5 text-xs text-gray-300 placeholder-gray-700
                         font-mono focus:outline-none focus:border-cyan-800 transition-colors" />
          </div>

          <span className="ml-auto text-[10px] font-mono text-gray-500 shrink-0">
          {visible.length} / {scenarios.length} operations
          </span>
        </div>

        {/* Error */}
        {startErr && (
          <div className="mb-5 p-3 bg-red-950/50 border border-red-900/60 rounded-xl
                          text-xs text-red-400 font-mono animate-enter">
            {startErr}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-32 gap-3 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-800 border-t-cyan-600
                            rounded-full animate-spin" />
            <span className="text-xs font-mono tracking-wider text-gray-400">Loading operations…</span>
          </div>
        )}

        {/* Fetch error */}
        {!loading && fetchErr && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-500">
            <span className="text-4xl opacity-20">⚠</span>
            <p className="text-sm font-mono text-gray-400">Failed to load scenarios</p>
            <button
              onClick={fetchScenarios}
              className="px-4 py-2 border border-cyan-800 text-cyan-500 hover:bg-cyan-950/40
                         text-xs font-mono rounded-lg transition-all tracking-widest uppercase"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !fetchErr && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-500">
            <span className="text-5xl opacity-10">◎</span>
            <p className="text-sm font-mono text-gray-400">No scenarios match this filter</p>
            <button
              onClick={() => { setPhase('all'); setDiffFilter('all'); setSearch('') }}
              className="text-xs text-cyan-800 hover:text-cyan-500 font-mono transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Scenario grid */}
        {!loading && !fetchErr && visible.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-enter">
            {visible.map(s => {
              const diff    = DIFF[s.difficulty_level] ?? DIFF.easy
              const phases  = phaseMap.get(s.id) ?? new Set<PhaseId>()
              const ttps    = (s.scenario_structure?.keyTTPs ?? []).slice(0, 4)
              const isStart = starting === s.id

              // Phase chips to show (exclude 'all', limit to 2 non-impact + impact)
              const nonImpact = [...phases].filter(p => p !== 'all' && p !== 'impact').slice(0, 2)

              return (
                <button
                  key={s.id}
                  disabled={starting !== null}
                  onClick={() => handleSelect(s.id)}
                  className={`
                    group relative flex flex-col text-left w-full
                    border rounded-xl overflow-hidden
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-wait
                    ${isStart
                      ? 'border-cyan-600/60 bg-cyan-950/20 shadow-[0_0_24px_-6px_rgba(32,201,188,.35)]'
                      : `border-gray-800/80 bg-gray-900/70
                         hover:border-gray-700 hover:bg-gray-900
                         hover:-translate-y-0.5
                         hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,.7)]`
                    }
                  `}
                >
                  {/* Difficulty top stripe */}
                  <div className="h-0.5 w-full opacity-60"
                       style={{ background: diff.barColor }} />

                  {/* Body */}
                  <div className="p-4 pb-2 flex-1">

                    {/* Phase chips */}
                    <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
                      {nonImpact.map(p => (
                        <span key={p}
                          className={`text-[9px] font-mono tracking-wider uppercase
                                      px-1.5 py-0.5 rounded border ${PHASE_COLOR[p]}`}>
                          {PHASES.find(ph => ph.id === p)?.label}
                        </span>
                      ))}
                      <span className={`text-[9px] font-mono tracking-wider uppercase
                                        px-1.5 py-0.5 rounded border ${PHASE_COLOR.impact}`}>
                        Impact
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="font-display text-[1rem] leading-tight text-white
                                   tracking-wide mb-2 group-hover:text-cyan-50 transition-colors">
                      {s.name.replace('Operation: ', '')}
                    </h3>

                    {/* Attack vector (first segment) */}
                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2
                                  font-ui mb-3 group-hover:text-gray-300 transition-colors">
                      {(s.scenario_structure?.attackVector ?? s.description ?? '')
                        .split('→')[0]
                        .trim()
                        .replace(/^.{80}/, m => m.slice(0, 78) + '…')}
                    </p>

                    {/* TTP chips */}
                    {ttps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {ttps.map((t, i) => {
                          const code = t.split(/[\s—]/)[0].trim()
                          return (
                            <span key={i}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded
                                         bg-gray-800/60 border border-gray-700/50
                                         text-gray-400 group-hover:text-gray-300
                                         transition-colors">
                              {code}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-4 mt-auto">
                    {/* Diff label + attempts */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-mono tracking-wider font-semibold ${diff.text}`}>
                        {diff.label}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                      {s.max_attempts}×
                      </span>
                    </div>

                    {/* Difficulty bar */}
                    <div className="h-1 rounded-full bg-gray-800/80 overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-500"
                           style={{ width: diff.barWidth, background: diff.barColor, opacity: 0.75 }} />
                    </div>

                    {/* Launch button */}
                    <div className={`
                      flex items-center justify-center gap-2
                      py-2 rounded-lg border text-[10px] font-mono
                      tracking-widest uppercase transition-all duration-200
                      ${isStart
                        ? 'bg-cyan-900/30 border-cyan-700/60 text-cyan-300'
                        : `bg-gray-800/30 border-gray-700/60 text-gray-600
                           group-hover:bg-cyan-950/40 group-hover:border-cyan-800/50
                           group-hover:text-cyan-400`
                      }
                    `}>
                      {isStart ? (
                        <>
                          <span className="w-3 h-3 border border-cyan-500/60 border-t-transparent
                                           rounded-full animate-spin" />
                          Starting…
                        </>
                      ) : '▶ Launch'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Legend */}
        {!loading && (
          <div className="mt-10 pt-6 border-t border-gray-800/40
                          flex items-center gap-6 flex-wrap">
            <span className="text-[10px] font-mono tracking-widest text-gray-500 uppercase">
            Difficulty:
            </span>
            {(['easy', 'medium', 'hard'] as const).map(d => (
              <div key={d} className="flex items-center gap-2">
                <div className="h-1 rounded-full"
                     style={{
                       width: d === 'easy' ? 20 : d === 'medium' ? 32 : 48,
                       background: DIFF[d].barColor,
                       opacity: 0.6,
                     }} />
                <span className={`text-[10px] font-mono ${DIFF[d].text} opacity-60`}>
                  {d.toUpperCase()}
                </span>
              </div>
            ))}

            <div className="ml-auto flex items-center gap-3 flex-wrap">
              {PHASES.filter(p => p.id !== 'all').map(p => (
                <div key={p.id} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-sm ${PHASE_COLOR[p.id].split(' ')[0]}`} />
                  <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wider">
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
