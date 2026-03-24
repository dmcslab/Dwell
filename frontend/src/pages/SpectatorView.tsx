/**
 * SpectatorView.tsx
 * -----------------
 * Read-only view of a live game session. Spectators see:
 *   - Current IR phase + stage prompt + all answer options (no submit)
 *   - Live feedback panel when a decision is made (correct/incorrect +
 *     technical explanation)
 *   - Incident timeline
 *   - Active player list with roles
 *
 * State is driven entirely by WS messages forwarded from the game loop.
 * Spectators send no game-affecting messages after joining.
 */
import { useEffect, useRef, useState } from 'react'
import { DwellLogo } from '../components/DwellLogo'
import { getWsBase }          from '../api/client'
import { IrPhaseBadge }     from '../components/IrPhaseBadge'
import { IncidentTimeline } from '../components/IncidentTimeline'
import { ROLE_DEFINITIONS } from '../types/scenario'
import type {
  DecisionStage,
  GamePhase,
  GameState,
  PlayerRole,
  ScenarioFull,
  WsMessage,
} from '../types/scenario'

// ── Helpers ───────────────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D']

const ROLE_ICON: Record<PlayerRole, string> = {
  ir_lead: '🎯', network: '🌐', endpoint: '💻', solo: '👤',
}

const PHASE_PULSE: Record<string, string> = {
  deciding: 'bg-cyan-500 animate-pulse',
  briefing: 'bg-gray-600',
  complete: 'bg-emerald-500',
  failed:   'bg-red-500',
}

// ── Last decision panel ───────────────────────────────────────────────────────

interface LastDecision {
  actionText:           string
  isCorrect:            boolean
  consequence:          string
  technicalExplanation: string
  decidedBy?:           string
  decidedByRole?:       PlayerRole
}

function DecisionFeedback({ d, onDismiss }: { d: LastDecision; onDismiss: () => void }) {
  return (
    <div className={`rounded-xl border p-5 relative mb-4 ${
      d.isCorrect
        ? 'bg-emerald-950 border-emerald-700'
        : 'bg-red-950 border-red-800'
    }`}>
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 text-lg"
      >×</button>

      <div className="flex items-center gap-2 mb-3">
        <span className={`font-bold text-base ${d.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
          {d.isCorrect ? '✓ Correct' : '✗ Incorrect'}
        </span>
        {d.decidedBy && (
          <span className="text-xs text-gray-400">
            — {d.decidedBy}
            {d.decidedByRole && (
              <span className="ml-1">{ROLE_ICON[d.decidedByRole]}</span>
            )}
          </span>
        )}
      </div>

      <p className="text-gray-300 text-sm italic mb-3">"{d.actionText}"</p>

      <div className="mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
          Consequence
        </p>
        <p className="text-gray-200 text-sm leading-relaxed">{d.consequence}</p>
      </div>

      <div className="bg-black/20 rounded-lg p-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
          Technical Explanation
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">{d.technicalExplanation}</p>
      </div>
    </div>
  )
}

// ── Read-only options list ────────────────────────────────────────────────────

function ReadOnlyOptions({
  stage,
  lastDecision,
}: {
  stage:        DecisionStage
  lastDecision: LastDecision | null
}) {
  const chosenIdx = lastDecision
    ? stage.options.findIndex(o => o.actionText === lastDecision.actionText)
    : -1

  return (
    <div className="flex flex-col gap-2">
      {stage.options.map((opt, i) => {
        const wasChosen  = i === chosenIdx
        const isCorrect  = opt.isCorrect
        const highlight  = wasChosen
          ? isCorrect ? 'border-emerald-500 bg-emerald-950/40' : 'border-red-500 bg-red-950/30'
          : 'border-gray-700 bg-gray-800/50'

        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${highlight}`}
          >
            <span className="shrink-0 w-6 h-6 rounded bg-gray-700 text-gray-400 text-xs font-bold flex items-center justify-center mt-0.5">
              {OPTION_LABELS[i]}
            </span>
            <div className="flex-1">
              <span className="text-gray-200 text-sm leading-snug">{opt.actionText}</span>
              {wasChosen && (
                <div className="mt-1">
                  <span className={`text-xs font-mono font-semibold ${
                    isCorrect ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {isCorrect ? '✓ Chosen — Correct' : '✗ Chosen — Incorrect'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Player roster ─────────────────────────────────────────────────────────────

function PlayerRoster({
  gameState,
  spectators,
}: {
  gameState:  GameState
  spectators: Record<string, { name: string; joined_at: string }>
}) {
  const players = Object.entries(gameState.role_names).map(([cid, name]) => ({
    cid,
    name,
    role: gameState.roles[cid] as PlayerRole,
  }))

  const spectatorList = Object.entries(spectators).map(([cid, s]) => ({
    cid,
    name: s.name,
  }))

  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-mono font-semibold mb-3">
        Players
      </p>
      <div className="flex flex-col gap-2 mb-3">
        {players.length === 0 && (
          <p className="text-gray-600 text-xs">No roles assigned yet.</p>
        )}
        {players.map(p => {
          const def = ROLE_DEFINITIONS.find(r => r.id === p.role)
          return (
            <div key={p.cid} className="flex items-center gap-2">
              <span className="text-base">{ROLE_ICON[p.role] ?? '👤'}</span>
              <span className="text-gray-200 text-sm font-medium">{p.name}</span>
              {def && (
                <span className="text-xs text-gray-500 font-mono">{def.label}</span>
              )}
            </div>
          )
        })}
      </div>

      {spectatorList.length > 0 && (
        <>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">
            👁 Watching ({spectatorList.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {spectatorList.map(s => (
              <span key={s.cid} className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5">
                {s.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main SpectatorView ────────────────────────────────────────────────────────

interface Props {
  sessionId:  string
  playerName: string
  onLeave:    () => void
}

export function SpectatorView({ sessionId, playerName, onLeave }: Props) {
  const wsRef = useRef<WebSocket | null>(null)

  const [status,       setStatus]       = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting')
  const [scenario,     setScenario]     = useState<ScenarioFull | null>(null)
  const [gameState,    setGameState]    = useState<GameState | null>(null)
  const [spectators,   setSpectators]   = useState<Record<string, { name: string; joined_at: string }>>({})
  const [lastDecision, setLastDecision] = useState<LastDecision | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [eventLog,     setEventLog]     = useState<string[]>([])

  const addEvent = (msg: string) =>
    setEventLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 50))

  useEffect(() => {
    const url = `${getWsBase()}/api/v1/game/play/${sessionId}?name=${encodeURIComponent(playerName)}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      // Immediately register as spectator once connected
      ws.send(JSON.stringify({ type: 'join_as_spectator' }))
    }
    ws.onerror = () => setStatus('error')
    ws.onclose = () => setStatus('disconnected')

    ws.onmessage = (evt) => {
      let msg: WsMessage
      try { msg = JSON.parse(evt.data) } catch { return }

      switch (msg.type) {

        case 'spectator_joined_ack':
          setScenario(msg.scenario)
          setGameState(msg.state)
          setSpectators(msg.state.spectators ?? {})
          addEvent('You joined as a spectator')
          break

        case 'state_sync':
          setGameState(msg.state)
          setSpectators(msg.state.spectators ?? {})
          break

        case 'choice_result':
          setGameState(prev => prev ? {
            ...prev,
            phase: msg.phase as GamePhase,
            attempts_remaining: msg.attempts_remaining,
          } : prev)
          setLastDecision({
            actionText:           msg.action_text,
            isCorrect:            msg.is_correct,
            consequence:          msg.consequence,
            technicalExplanation: msg.technical_explanation,
            decidedBy:            msg.decided_by,
            decidedByRole:        msg.decided_by_role,
          })
          setShowFeedback(true)
          addEvent(`Decision: "${msg.action_text}" — ${msg.is_correct ? '✓ correct' : '✗ wrong'}`)
          break

        case 'game_end':
          setGameState(msg.state)
          addEvent(`Simulation ${msg.summary.outcome === 'complete' ? 'complete ✓' : 'failed ✗'}`)
          break

        case 'spectator_joined':
          setSpectators(msg.spectators)
          addEvent(`${msg.name} is now watching`)
          break

        case 'spectator_left':
          setSpectators(msg.spectators)
          addEvent(`${msg.name} stopped watching`)
          break

        case 'member_joined':
          addEvent(`${msg.name} joined the session`)
          break

        case 'member_left':
          addEvent(`${msg.name} left the session`)
          break

        case 'role_assigned':
          setGameState(prev => prev
            ? { ...prev, roles: msg.roles, role_names: msg.role_names }
            : prev)
          addEvent(`${msg.name} took the ${msg.role.replace('_', ' ')} role`)
          break

        default: break
      }
    }

    return () => { ws.close() }
  }, [sessionId, playerName])

  // ── Render ─────────────────────────────────────────────────────────────────

  const phase = gameState?.phase ?? 'briefing'
  const tree  = scenario?.scenario_structure?.decisionTree ?? []
  const stage = tree.find(s => s.stageId === gameState?.current_stage_id) ?? null

  return (
    <div className="min-h-screen bg-gray-950 bg-data-grid flex flex-col">

      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 sticky top-0 z-10">
        <span className="text-xs font-mono border border-amber-700 text-amber-400 bg-amber-950/70 rounded-lg px-2.5 py-1 tracking-wider">
          👁 SPECTATOR
        </span>
        <div className="h-4 w-px bg-gray-700" />
        <DwellLogo size="sm" />
        <div className="h-4 w-px bg-gray-700/60" />
        <span className="text-white text-sm font-display font-semibold truncate tracking-wide">
          {scenario?.name ?? 'Connecting…'}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${PHASE_PULSE[phase] ?? 'bg-gray-600'}`} />
            <span className="text-xs text-gray-500 capitalize">{phase}</span>
          </div>
          <button
            onClick={onLeave}
            className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded-lg px-3 py-1.5 font-mono transition-all"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Connecting state */}
      {status === 'connecting' && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Connecting to session…
        </div>
      )}
      {status === 'error' && (
        <div className="flex-1 flex items-center justify-center text-red-400">
          Connection failed. The session may have ended.
        </div>
      )}

      {status === 'connected' && gameState && scenario && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left — main content */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Timeline */}
            <IncidentTimeline
              decisionTree={tree}
              completedIds={gameState.completed_stage_ids}
              currentStageId={gameState.current_stage_id}
              decisionHistory={gameState.decision_history}
              gamePhase={phase}
              startedAt={gameState.started_at}
              scenarioName={scenario.name}
            />

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

              {/* Attempts */}
              <div className="flex items-center gap-3">
                {stage && <IrPhaseBadge phase={stage.irPhase} />}
                <div className="flex items-center gap-1.5 ml-auto">
                  {Array.from({ length: gameState.max_attempts }, (_, i) => (
                    <span
                      key={i}
                      className={`w-4 h-4 rounded-full text-[11px] flex items-center justify-center
                        ${i < gameState.attempts_remaining
                          ? gameState.attempts_remaining === 1 ? 'bg-red-500' : 'bg-emerald-600'
                          : 'bg-gray-800 opacity-40'
                        }`}
                    >
                      {i < gameState.attempts_remaining ? '●' : '○'}
                    </span>
                  ))}
                  <span className="text-xs text-gray-500 ml-1">
                    {gameState.attempts_remaining} attempt{gameState.attempts_remaining !== 1 ? 's' : ''} left
                  </span>
                </div>
              </div>

              {/* Feedback panel */}
              {showFeedback && lastDecision && (
                <DecisionFeedback
                  d={lastDecision}
                  onDismiss={() => setShowFeedback(false)}
                />
              )}

              {/* Briefing */}
              {phase === 'briefing' && (
                <div className="bg-gray-800 border border-cyan-900 rounded-xl p-5">
                  <p className="text-xs text-cyan-600 uppercase tracking-widest mb-2 font-semibold">
                    Incident Brief
                  </p>
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">
                    {scenario.initial_prompt}
                  </p>
                  <p className="text-gray-500 text-xs mt-3 italic">
                    Waiting for the team to begin…
                  </p>
                </div>
              )}

              {/* Deciding / feedback stage */}
              {(phase === 'deciding' || phase === 'briefing' && false) && stage && (
                <>
                  {stage.analystContext && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-semibold">
                        Analyst Context
                      </p>
                      <p className="text-gray-300 text-xs leading-relaxed">{stage.analystContext}</p>
                    </div>
                  )}

                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <p className="text-gray-100 text-sm leading-relaxed">{stage.prompt}</p>
                  </div>

                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
                    Options (read-only)
                  </p>
                  <ReadOnlyOptions
                    stage={stage}
                    lastDecision={showFeedback ? null : lastDecision}
                  />

                  {/* Waiting indicator */}
                  {!showFeedback && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-700 animate-pulse" />
                      Waiting for the IR Lead to submit a decision…
                    </div>
                  )}
                </>
              )}

              {/* Game over */}
              {(phase === 'complete' || phase === 'failed') && (
                <div className={`rounded-xl border p-5 text-center ${
                  phase === 'complete'
                    ? 'bg-emerald-950 border-emerald-700'
                    : 'bg-red-950 border-red-800'
                }`}>
                  <p className={`text-xl font-bold ${
                    phase === 'complete' ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    {phase === 'complete' ? '✓ Simulation Complete' : '✗ Simulation Failed'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {gameState.completed_stage_ids.length} of {tree.length} stages completed
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-72 border-l border-gray-800 flex flex-col bg-gray-900/80 overflow-y-auto">

            {/* Player roster */}
            <div className="p-4 border-b border-gray-800">
              <PlayerRoster gameState={gameState} spectators={spectators} />
            </div>

            {/* Event log */}
            <div className="flex-1 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-mono font-semibold mb-3">
                Event Log
              </p>
              <div className="flex flex-col gap-1.5">
                {eventLog.length === 0 && (
                  <p className="text-gray-700 text-xs italic">No events yet</p>
                )}
                {eventLog.map((e, i) => (
                  <p key={i} className="text-gray-500 text-xs font-mono leading-relaxed" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                    {e}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
