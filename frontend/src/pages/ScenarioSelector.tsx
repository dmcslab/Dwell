import { useEffect, useState } from 'react'
import { gameApi }      from '../api/game'
import { scenariosApi } from '../api/scenarios'
import type { ScenarioSummary } from '../types/scenario'

const DIFF_COLOR: Record<string, string> = {
  easy:   'bg-emerald-900 text-emerald-300 border-emerald-700',
  medium: 'bg-amber-900   text-amber-300   border-amber-700',
  hard:   'bg-red-900     text-red-300     border-red-700',
}

const DIFF_STRIPE: Record<string, string> = {
  easy:   'border-t-emerald-500',
  medium: 'border-t-amber-500',
  hard:   'border-t-red-500',
}

interface Props {
  onSelect: (id: number) => void
  onSelectWithSession: (scenarioId: number, sessionId: string, playerName: string, shareLink: string) => void
}

export function ScenarioSelector({ onSelectWithSession }: Props) {
  const [scenarios,  setScenarios]  = useState<ScenarioSummary[]>([])
  const [filter,     setFilter]     = useState<string>('')
  const [loading,    setLoading]    = useState(true)
  const [launching,  setLaunching]  = useState<number | null>(null)
  const [error,      setError]      = useState('')
  const [playerName, setPlayerName] = useState('Analyst')

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
      onSelectWithSession(id, res.session_id, playerName || 'Analyst', res.share_link)
    } catch (e: any) {
      setError(e.message)
      setLaunching(null)
    }
  }

  const visible = filter ? scenarios.filter(s => s.difficulty_level === filter) : scenarios

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🛡️</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cyber-Rans</h1>
          <span className="text-gray-500 text-sm mt-1">IR Training Platform</span>
        </div>
        <p className="text-gray-400 text-sm max-w-xl">
          Step through a ransomware incident as a security analyst and make decisions at each IR phase.
        </p>
      </div>

      {/* Player name + filters row */}
      <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3 mb-6">
        <input
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          placeholder="Your name"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-600 w-40"
        />
        <div className="flex gap-2">
          {['', 'easy', 'medium', 'hard'].map(d => (
            <button key={d} onClick={() => setFilter(d)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                filter === d ? 'bg-cyan-700 border-cyan-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}>
              {d === '' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500 text-center mt-12">Loading scenarios…</p>}
      {error   && <p className="text-red-400 text-center mt-12">{error}</p>}

      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map(s => (
          <button key={s.id} onClick={() => handleSelect(s.id)}
            disabled={launching === s.id}
            className={`bg-gray-900 border-t-4 border border-gray-800 rounded-xl p-5 text-left hover:bg-gray-800 transition-all hover:scale-[1.02] group disabled:opacity-60 disabled:cursor-wait ${DIFF_STRIPE[s.difficulty_level]}`}>
            <div className="flex items-start justify-between mb-3">
              <span className={`text-xs font-semibold border rounded px-2 py-0.5 ${DIFF_COLOR[s.difficulty_level]}`}>
                {s.difficulty_level.toUpperCase()}
              </span>
              <span className="text-gray-600 text-xs">{s.max_attempts} attempts</span>
            </div>
            <h2 className="text-white font-semibold text-base mb-2 group-hover:text-cyan-300 transition-colors leading-snug">
              {s.name}
            </h2>
            <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{s.description}</p>
            <div className="mt-4 text-cyan-500 text-xs font-medium group-hover:translate-x-1 transition-transform">
              {launching === s.id ? 'Launching…' : 'Start Simulation →'}
            </div>
          </button>
        ))}
      </div>

      {!loading && !error && visible.length === 0 && (
        <p className="text-gray-600 text-center mt-12">No scenarios found.</p>
      )}
    </div>
  )
}
