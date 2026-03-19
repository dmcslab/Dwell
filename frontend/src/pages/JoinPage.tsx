/**
 * JoinPage.tsx
 * ------------
 * Handles the invite link flow: #/join/:session_id
 *
 * Steps:
 *   1. Fetch session info (participants, phase, roles already taken)
 *   2. Player enters their name
 *   3. Player picks a role (taken roles are greyed out, IR Lead enforces uniqueness)
 *   4. Player clicks Join → navigate to ScenarioPlayer with role pre-selected
 *      so the WS 'connected' message triggers assign_role immediately
 */
import { useEffect, useState } from 'react'
import { gameApi } from '../api/game'
import { ROLE_DEFINITIONS, type PlayerRole } from '../types/scenario'

// ── Role colours (mirrors RoleSelectPage) ─────────────────────────────────────

const ROLE_COLOR: Record<PlayerRole, { card: string; icon_bg: string }> = {
  ir_lead:  { card: 'border-cyan-600   bg-cyan-950/50  hover:bg-cyan-950/80',  icon_bg: 'bg-cyan-800'   },
  network:  { card: 'border-sky-600    bg-sky-950/50   hover:bg-sky-950/80',   icon_bg: 'bg-sky-800'    },
  endpoint: { card: 'border-violet-600 bg-violet-950/50 hover:bg-violet-950/80', icon_bg: 'bg-violet-800' },
  solo:     { card: 'border-gray-600   bg-gray-900     hover:bg-gray-800',     icon_bg: 'bg-gray-700'   },
}

const ROLE_TAKEN  = 'border-gray-800 bg-gray-900/30 opacity-50 cursor-not-allowed'
const ROLE_ACTIVE = 'ring-2 ring-offset-1 ring-offset-gray-900'

const ROLE_RING: Record<PlayerRole, string> = {
  ir_lead:  'ring-cyan-500',
  network:  'ring-sky-500',
  endpoint: 'ring-violet-500',
  solo:     'ring-gray-500',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string
  onJoined:  (scenarioId: number, sessionId: string, playerName: string, role: PlayerRole) => void
  onBack:    () => void
}

interface SessionInfo {
  session_id:  string
  scenario_id: number
  phase:       string
  participants: { name: string; client_id: string }[]
  roles:        Record<string, PlayerRole>
  role_names:   Record<string, string>
}

export function JoinPage({ sessionId, onJoined, onBack }: Props) {
  const [info,       setInfo]       = useState<SessionInfo | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [joining,    setJoining]    = useState(false)
  const [error,      setError]      = useState('')
  const [playerName, setPlayerName] = useState('')
  const [pickedRole, setPickedRole] = useState<PlayerRole | null>(null)

  useEffect(() => {
    gameApi.getJoinInfo(sessionId)
      .then(d => setInfo(d as SessionInfo))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  const takenRoles   = new Set(Object.values(info?.roles ?? {}))
  const irLeadTaken  = takenRoles.has('ir_lead')

  const isRoleTaken = (role: PlayerRole): boolean => {
    // IR Lead: only one allowed
    if (role === 'ir_lead') return irLeadTaken
    // Others: multiple players can share
    return false
  }

  const handleJoin = async () => {
    if (!info || !pickedRole || !playerName.trim()) return
    setJoining(true)
    try {
      await gameApi.join(sessionId, playerName.trim())
      onJoined(info.scenario_id, sessionId, playerName.trim(), pickedRole)
    } catch (e: any) {
      setError(e.message)
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-data-grid flex items-center justify-center p-6">
      <div className="w-full max-w-xl animate-enter">

        {/* Header */}
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm mb-6 flex items-center gap-1">
          ← Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl filter drop-shadow-lg">🔗</span>
          <div>
            <h2 className="text-white font-display font-bold text-xl tracking-wider">JOIN SESSION</h2>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{sessionId}</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-700 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm">Loading session…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {info && !loading && (
          <div className="flex flex-col gap-5">

            {/* Session status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Phase</span>
                <span className={`font-semibold capitalize ${
                  info.phase === 'briefing' ? 'text-cyan-400' :
                  info.phase === 'deciding' ? 'text-amber-400' :
                  info.phase === 'complete' ? 'text-emerald-400' : 'text-gray-300'
                }`}>{info.phase}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Players in session</span>
                <span className="text-gray-300">{info.participants.length}</span>
              </div>
              {info.participants.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {info.participants.map((p, i) => {
                    const role = info.roles[p.client_id]
                    const def  = ROLE_DEFINITIONS.find(r => r.id === role)
                    return (
                      <span key={i} className="flex items-center gap-1 bg-gray-800 border border-gray-700 text-xs rounded-full px-2 py-0.5">
                        {def ? <span>{def.icon}</span> : null}
                        <span className="text-gray-300">{p.name}</span>
                        {def && <span className="text-gray-500">{def.label}</span>}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Name input */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-semibold uppercase tracking-wider">
                Your display name
              </label>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Analyst"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>

            {/* Role picker */}
            <div>
              <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">
                Choose your role
              </p>
              <div className="grid grid-cols-2 gap-3">
                {ROLE_DEFINITIONS.map(def => {
                  const taken    = isRoleTaken(def.id)
                  const selected = pickedRole === def.id
                  const takenBy  = taken && def.id === 'ir_lead'
                    ? Object.entries(info.role_names).find(([cid]) => info.roles[cid] === 'ir_lead')?.[1]
                    : null

                  return (
                    <button
                      key={def.id}
                      disabled={taken}
                      onClick={() => !taken && setPickedRole(def.id)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all duration-150
                        ${taken
                          ? ROLE_TAKEN
                          : selected
                            ? `${ROLE_COLOR[def.id].card} ${ROLE_ACTIVE} ${ROLE_RING[def.id]}`
                            : `${ROLE_COLOR[def.id].card} border-opacity-60`
                        }`}
                    >
                      {/* Selected indicator */}
                      {selected && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[11px]">✓</span>
                      )}

                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${taken ? 'bg-gray-800' : ROLE_COLOR[def.id].icon_bg}`}>
                          {def.icon}
                        </span>
                        <span className={`font-semibold text-sm ${taken ? 'text-gray-600' : 'text-white'}`}>
                          {def.label}
                        </span>
                      </div>

                      <p className={`text-xs leading-snug ${taken ? 'text-gray-700' : 'text-gray-400'}`}>
                        {def.description}
                      </p>

                      {def.siemSources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {def.siemSources.map(src => (
                            <span key={src} className={`text-[11px] font-mono rounded px-1 py-0.5 ${taken ? 'bg-gray-800 text-gray-700' : 'bg-gray-800 text-gray-500'}`}>
                              {src}
                            </span>
                          ))}
                        </div>
                      )}

                      {taken && takenBy && (
                        <p className="text-xs text-gray-600 mt-2 font-mono">Taken by {takenBy}</p>
                      )}
                      {taken && !takenBy && def.id === 'ir_lead' && (
                        <p className="text-xs text-gray-600 mt-2 font-mono">Already taken</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Spectator option */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => onJoined(info.scenario_id, sessionId, playerName.trim() || 'Spectator', 'solo')}
                className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
              >
                👁 Watch session without participating
              </button>
            </div>

            {/* Join button */}
            <button
              onClick={handleJoin}
              disabled={joining || !playerName.trim() || !pickedRole}
              className="w-full py-3 bg-cyan-800 hover:bg-cyan-700 border border-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm font-ui tracking-wide"
            >
              {joining
                ? 'Joining…'
                : !playerName.trim()
                  ? 'Enter your name first'
                  : !pickedRole
                    ? 'Pick a role to continue'
                    : `Join as ${ROLE_DEFINITIONS.find(r => r.id === pickedRole)?.label} →`
              }
            </button>

            {(info.phase === 'complete' || info.phase === 'failed') && (
              <p className="text-amber-400 text-xs text-center">
                ⚠ This session has already ended. You can observe the debrief.
              </p>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
