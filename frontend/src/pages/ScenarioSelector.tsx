import { useEffect, useState } from 'react'
import { DwellLogo } from '../components/DwellLogo'
import { gameApi }      from '../api/game'
import { scenariosApi } from '../api/scenarios'
import type { ScenarioSummary } from '../types/scenario'

const DIFF_META: Record<string, { label: string; stripe: string; badge: string; glow: string }> = {
  easy:   { label: 'EASY',   stripe: 'diff-stripe-easy',   badge: 'bg-emerald-950 text-emerald-400 border-emerald-800', glow: 'hover:shadow-[0_0_20px_-4px_#10b98133]' },
  medium: { label: 'MEDIUM', stripe: 'diff-stripe-medium', badge: 'bg-amber-950   text-amber-400   border-amber-800',   glow: 'hover:shadow-[0_0_20px_-4px_#f59e0b33]' },
  hard:   { label: 'HARD',   stripe: 'diff-stripe-hard',   badge: 'bg-red-950     text-red-400     border-red-800',     glow: 'hover:shadow-[0_0_20px_-4px_#ef444433]' },
}

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

export function ScenarioSelector({ playerName, onClearName, onSelectWithSession, onAdmin }: Props) {
  const [scenarios,  setScenarios]  = useState<ScenarioSummary[]>([])
  const [filter,     setFilter]     = useState<string>('')
  const [loading,    setLoading]    = useState(true)
  const [launching,  setLaunching]  = useState<number | null>(null)
  const [error,      setError]      = useState('')

  useEffect(() => {
    scenariosApi.list()
      .then(setScenarios)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (id: number) => {
    setLaunching(id)
    try {
      const res = await gameApi.start(id, '', playerName || 'Analyst')
      onSelectWithSession(id, res.session_id, res.share_link, res.join_token)
    } catch (e: any) {
      setError(e.message)
      setLaunching(null)
    }
  }

  const visible = filter ? scenarios.filter(s => s.difficulty_level === filter) : scenarios

  return (
    <div className="min-h-screen bg-gray-950 bg-data-grid">
      {/* ── Hero header ── */}
      <header className="relative border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <DwellLogo size="md" />
          </div>

          {/* Analyst name input */}
          <div className="flex items-center gap-3">
            {/* Analyst name display */}
            <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5">
              <span className="text-gray-500 text-xs font-mono tracking-wider">OPERATOR</span>
              <span className="text-cyan-300 text-xs font-semibold font-ui">{playerName}</span>
            </div>
 
            {/* Admin button */}
            <button
              onClick={onAdmin}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 text-gray-400 hover:text-white text-xs rounded-lg transition-all font-mono"
              title="Admin dashboard"
            >
              ⚙ Admin
            </button>
 
            {/* Clear name — resets to welcome screen */}
            <button
              onClick={onClearName}
              className="text-xs text-gray-600 hover:text-red-400 font-mono transition-colors"
              title="Clear name and return to welcome screen"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Thin accent line under header */}
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Mission briefing ── */}
        <div className="mb-8 animate-enter">
          <h2 className="text-xl font-display font-semibold text-white mb-1 tracking-wide">
            SELECT MISSION
          </h2>
          <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
            Each scenario drops you into an active ransomware incident. Navigate through
            IR phases — from preparation through eradication — making decisions that
            determine the outcome.
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-gray-600 text-xs font-mono mr-1">FILTER:</span>
          {(['', 'easy', 'medium', 'hard'] as const).map(d => (
            <button key={d} onClick={() => setFilter(d)}
              className={`px-4 py-1.5 rounded-full border text-xs font-semibold tracking-wider transition-all ${
                filter === d
                  ? 'bg-cyan-900/50 border-cyan-600 text-cyan-300 shadow-[0_0_8px_-2px_#22d3ee40]'
                  : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}>
              {d === '' ? 'ALL' : d.toUpperCase()}
            </button>
          ))}
          {!loading && (
            <span className="ml-auto text-gray-600 text-xs font-mono">
              {visible.length} SCENARIO{visible.length !== 1 ? 'S' : ''}
            </span>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm font-mono">
            ⚠ {error}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="h-4 bg-gray-800 rounded w-16 mb-4" />
                <div className="h-5 bg-gray-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-800 rounded w-full mb-1.5" />
                <div className="h-3 bg-gray-800 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* ── Scenario grid ── */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((s, idx) => {
              const meta = DIFF_META[s.difficulty_level] ?? DIFF_META.medium
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  disabled={launching === s.id}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`relative group bg-gray-900 border border-gray-800 rounded-xl p-5 text-left
                    transition-all duration-200 cursor-pointer
                    hover:border-gray-600 hover:-translate-y-0.5
                    disabled:opacity-60 disabled:cursor-wait
                    ${meta.stripe} ${meta.glow}
                    animate-enter`}
                >
                  {/* Corner brackets */}
                  <div className="absolute top-2 right-2 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-500/70" />
                  </div>

                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <span className={`hex-badge ${meta.badge}`}>{meta.label}</span>
                    <span className="text-gray-600 text-xs font-mono">{s.max_attempts}× ATT</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-white font-semibold text-sm mb-2 group-hover:text-cyan-300 transition-colors leading-snug font-ui">
                    {s.name}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-3 font-ui">
                    {s.description}
                  </p>

                  {/* CTA */}
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-mono font-medium text-gray-600 group-hover:text-cyan-400 transition-colors">
                    <span className="group-hover:translate-x-0.5 transition-transform inline-block">
                      {launching === s.id ? '⟳ LAUNCHING...' : '▶ DEPLOY MISSION'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-600 font-mono text-sm">NO SCENARIOS FOUND</p>
          </div>
        )}
      </main>
    </div>
  )
}
