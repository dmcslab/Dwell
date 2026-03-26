/**
 * NerveCenterView.tsx — 3-panel SOC layout
 *
 * Critical data shape notes (backend → frontend, snake_case):
 *   gameState.current_stage_id    — ID of active stage
 *   gameState.completed_stage_ids — array of completed stage IDs
 *   gameState.decision_history    — DecisionRecord[]
 *   gameState.attempts_remaining  — number
 *   gameState.participants        — { name, client_id }[]
 *   gameState.roles               — Record<client_id, PlayerRole>
 *   gameState.role_names          — Record<client_id, string>
 *
 * The current stage object is derived by finding current_stage_id
 * in scenario.scenario_structure.decisionTree.
 */
import { useState, useEffect, useRef } from 'react'
import { SiemFeedPanel }    from '../SiemFeedPanel'
import { ActivityLog }      from '../ActivityLog'
import { ROLE_DEFINITIONS } from '../../types/scenario'
import type { ScenarioFull, PlayerRole, DecisionStage } from '../../types/scenario'
import type { GameState, ActivityEntry } from '../../hooks/useWebSocketGame'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  gameState:     GameState | null
  scenario:      ScenarioFull | null
  clientId:      string | null
  playerName:    string
  myRole:        PlayerRole | undefined
  makeChoice:    (idx: number) => void
  suggestChoice: (idx: number) => void
  activityLog:   ActivityEntry[]
  shareLink:     string
  sessionId:     string
  elapsedSecs:   number
  onBack:        () => void
  onSwitchView:  () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D']

const PHASE_ORDER = [
  'Preparation',
  'Detection & Analysis',
  'Containment',
  'Eradication & Recovery',
]

function curPhaseIdx(phase: string): number {
  return PHASE_ORDER.findIndex(p =>
    phase?.toLowerCase().includes(p.toLowerCase().split(' ')[0])
  )
}

const ROLE_BADGE: Record<string, string> = {
  ir_lead:  'text-cyan-300 border-cyan-800 bg-cyan-950/50',
  network:  'text-green-300 border-green-800 bg-green-950/50',
  endpoint: 'text-violet-300 border-violet-800 bg-violet-950/50',
  solo:     'text-amber-300 border-amber-800 bg-amber-950/50',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NerveCenterView({
  gameState, scenario, clientId, playerName, myRole,
  makeChoice, suggestChoice, activityLog,
  shareLink, sessionId, elapsedSecs, onBack, onSwitchView,
}: Props) {
  const [lastChoice,  setLastChoice]  = useState<number | null>(null)
  const [flashResult, setFlashResult] = useState<{ correct: boolean; msg: string } | null>(null)
  const prevHistLen = useRef(0)

  const isLead  = myRole === 'ir_lead' || myRole === 'solo'
  const roleDef = ROLE_DEFINITIONS.find(r => r.id === myRole)

  // ── Derive state from backend's snake_case fields ─────────────────────────
  const tree          = scenario?.scenario_structure?.decisionTree ?? []
  const ttps          = scenario?.scenario_structure?.keyTTPs ?? []
  const currentStageId= (gameState as any)?.current_stage_id as string | undefined
  const completedIds  = (gameState as any)?.completed_stage_ids as string[] ?? []
  const history       = (gameState as any)?.decision_history    ?? []
  const attemptsLeft  = (gameState as any)?.attempts_remaining  ?? scenario?.max_attempts ?? 3
  const participants  = (gameState as any)?.participants         ?? []
  const roles         = (gameState as any)?.roles               ?? {}
  const roleNames     = (gameState as any)?.role_names          ?? {}

  // Current stage = look up by ID in the scenario's decision tree
  const st: DecisionStage | undefined = tree.find(s => s.stageId === currentStageId)
  const opts     = st?.options ?? []
  const curPhase = st?.irPhase ?? ''
  const phaseIdx = curPhaseIdx(curPhase)

  const stageNum   = completedIds.length + 1
  const stageTotal = tree.length

  // Role-specific context text
  const roleContext = myRole === 'ir_lead'  ? (st as any)?.irLeadContext
    : myRole === 'network'                  ? (st as any)?.networkContext
    : myRole === 'endpoint'                 ? (st as any)?.endpointContext
    : (st as any)?.analystContext

  // Suggestion tallies from activity log
  const suggestions: Record<number, string[]> = {}
  for (const e of activityLog) {
    if (e.type === 'suggestion' && (e as any).metadata?.optionIdx !== undefined) {
      const idx  = (e as any).metadata.optionIdx as number
      const name = (e as any).metadata?.playerName as string ?? '?'
      suggestions[idx] = [...(suggestions[idx] ?? []), name]
    }
  }

  // Flash consequence from latest history entry
  useEffect(() => {
    if (history.length <= prevHistLen.current) return
    prevHistLen.current = history.length
    const last = history[history.length - 1]
    if (!last) return
    setLastChoice(null)
    setFlashResult({ correct: last.is_correct, msg: last.consequence })
    const t = setTimeout(() => setFlashResult(null), 5000)
    return () => clearTimeout(t)
  }, [history.length])

  function handleChoice(idx: number) {
    if (lastChoice !== null) return
    setLastChoice(idx)
    if (isLead) makeChoice(idx); else suggestChoice(idx)
  }

  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, '0')
  const ss = String(elapsedSecs % 60).padStart(2, '0')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gray-950 bg-data-grid">

      {/* ── Header ─ 56px ── */}
      <header className="flex-shrink-0 h-14 border-b border-gray-800/60
                          bg-gray-950/90 backdrop-blur-md
                          flex items-center px-5 gap-3 z-30">

        <button onClick={onBack}
          className="text-gray-600 hover:text-gray-300 font-mono text-xs
                     tracking-wider transition-colors shrink-0">
          ← Back
        </button>
        <div className="w-px h-4 bg-gray-800 shrink-0" />

        <span className="font-display text-sm text-white tracking-wide truncate">
          {scenario?.name?.replace('Operation: ', '') ?? '…'}
        </span>

        {curPhase && (
          <span className="hidden md:block text-[10px] font-mono text-amber-500
                            tracking-widest uppercase shrink-0">
            {curPhase}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          {/* Breach clock */}
          <span className="font-display text-base text-red-400 tabular-nums tracking-widest">
            {mm}:{ss}
          </span>

          {/* Role badge */}
          {roleDef && (
            <span className={`text-[10px] font-mono tracking-wider uppercase
                              px-2 py-0.5 border rounded
                              ${ROLE_BADGE[myRole ?? ''] ?? 'text-gray-500 border-gray-700'}`}>
              {roleDef.icon} {roleDef.label}
            </span>
          )}

          {/* Stage counter */}
          <span className="text-[10px] font-mono text-gray-600">
            {stageNum}/{stageTotal || '?'}
          </span>

          {/* View switch */}
          <button onClick={onSwitchView}
            className="text-[10px] font-mono text-gray-600 hover:text-cyan-400 uppercase
                       tracking-wider border border-gray-800 hover:border-cyan-800
                       rounded px-2 py-1 transition-all">
            Solo
          </button>
        </div>
      </header>

      {/* ── Three-panel body ── */}
      <div className="flex-1 overflow-hidden grid grid-cols-[240px_1fr_260px]">

        {/* ═══ LEFT: IR lifecycle + stats ══════════════════════════════════ */}
        <aside className="border-r border-gray-800/60 overflow-y-auto flex flex-col gap-5 p-4">

          {/* IR Lifecycle */}
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase mb-3">
              IR Lifecycle
            </div>
            <div className="flex flex-col gap-0">
              {PHASE_ORDER.map((phase, i) => {
                const done = i < phaseIdx
                const now  = i === phaseIdx
                const shortLabel = phase
                  .replace(' & Analysis', '')
                  .replace(' & Recovery', '')

                return (
                  <div key={phase} className="flex gap-3 pb-4 relative">
                    {i < PHASE_ORDER.length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-gray-800" />
                    )}
                    <div className={`w-[18px] h-[18px] rounded-full border-2 flex-shrink-0
                                     z-10 mt-0.5 flex items-center justify-center text-[9px]
                      ${done ? 'bg-cyan-500 border-cyan-500 text-gray-950 font-bold'
                      : now  ? 'bg-transparent border-amber-400'
                      :        'bg-transparent border-gray-700'}`}>
                      {done && '✓'}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-[11px] font-mono leading-tight
                        ${done ? 'text-cyan-600'
                        : now  ? 'text-amber-400 font-semibold'
                        :        'text-gray-700'}`}>
                        {shortLabel}
                      </div>
                      {now && (
                        <div className="text-[10px] text-amber-600 mt-0.5">
                          ▶ Active
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Session stats */}
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase mb-2">
              Session
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: history.filter((h: any) => h.is_correct).length,  label: 'Correct', color: 'text-green-400' },
                { val: history.filter((h: any) => !h.is_correct).length, label: 'Wrong',   color: 'text-red-400'   },
                { val: attemptsLeft,                                       label: 'Atts Left',color: 'text-amber-400'},
                { val: participants.length || 1,                           label: 'Players', color: 'text-gray-300'  },
              ].map(s => (
                <div key={s.label}
                  className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 text-center">
                  <div className={`font-display text-2xl leading-none ${s.color}`}>{s.val}</div>
                  <div className="text-[9px] font-mono text-gray-700 uppercase tracking-wider mt-1">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attempt warning */}
          {attemptsLeft <= 2 && attemptsLeft > 0 && (
            <div className={`text-[11px] font-mono px-3 py-2 rounded-lg border
              ${attemptsLeft === 1
                ? 'text-red-400 border-red-900/60 bg-red-950/25'
                : 'text-amber-400 border-amber-900/40 bg-amber-950/20'}`}>
              ⚠ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left
            </div>
          )}

          {/* Team */}
          {participants.length > 0 && (
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase mb-2">
                Team
              </div>
              <div className="flex flex-col gap-1.5">
                {participants.map((p: any) => {
                  const role = roles[p.client_id]
                  const name = roleNames[p.client_id] ?? p.name
                  const def  = ROLE_DEFINITIONS.find(r => r.id === role)
                  const isMe = p.client_id === clientId
                  return (
                    <div key={p.client_id} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0
                        ${isMe ? 'bg-cyan-400' : 'bg-gray-700'}`} />
                      <span className={`text-xs font-mono truncate flex-1
                        ${isMe ? 'text-cyan-300' : 'text-gray-500'}`}>
                        {isMe ? `You (${playerName})` : name}
                      </span>
                      {def && <span className="text-sm shrink-0">{def.icon}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Share link */}
          {shareLink && (
            <div className="mt-auto pt-3 border-t border-gray-800/40">
              <button
                onClick={() => navigator.clipboard.writeText(shareLink)}
                className="w-full text-[10px] font-mono text-cyan-800 hover:text-cyan-400
                           border border-gray-800 hover:border-cyan-800/50 rounded-lg
                           px-3 py-2 transition-all text-left">
                📋 Copy share link
              </button>
            </div>
          )}
        </aside>

        {/* ═══ CENTRE: prompt + choices ═══════════════════════════════════ */}
        <main className="overflow-y-auto flex flex-col min-w-0">
          <div className="p-6 flex flex-col gap-5 flex-1">

            {/* Phase label */}
            {curPhase && (
              <div className="flex items-center gap-2">
                <div className="h-px w-4 bg-amber-600/40" />
                <span className="text-[10px] font-mono tracking-[0.25em] text-amber-500 uppercase">
                  {curPhase}
                </span>
              </div>
            )}

            {/* Situation prompt */}
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-cyan-700 uppercase mb-2">
                Situation
              </div>
              <div className="pl-3 border-l-2 border-cyan-800/50">
                {st ? (
                  <p className="text-sm text-gray-200 leading-relaxed">{st.prompt}</p>
                ) : gameState ? (
                  <p className="text-sm text-gray-600 italic">
                    Receiving next stage…
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="w-4 h-4 border-2 border-gray-700 border-t-cyan-600
                                    rounded-full animate-spin" />
                    <span className="text-xs font-mono">Connecting…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Role context box */}
            {(roleContext || (st as any)?.analystContext) && (
              <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
                <div className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase mb-2">
                  {roleDef?.label ?? 'Analyst'} Context
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {roleContext ?? (st as any)?.analystContext}
                </p>
              </div>
            )}

            {/* Consequence flash */}
            {flashResult && (
              <div className={`p-4 rounded-xl border text-sm leading-relaxed
                ${flashResult.correct
                  ? 'bg-green-950/30 border-green-800/50 text-green-300'
                  : 'bg-red-950/25  border-red-900/50  text-red-300'}`}>
                <div className={`text-[10px] font-mono uppercase tracking-widest mb-1.5
                  ${flashResult.correct ? 'text-green-600' : 'text-red-600'}`}>
                  {flashResult.correct ? '✓ Outcome' : '✗ Outcome'}
                </div>
                {flashResult.msg}
              </div>
            )}

            {/* Choices */}
            {opts.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="text-[10px] font-mono tracking-[0.2em] text-amber-600 uppercase">
                  {lastChoice !== null
                    ? isLead ? 'Decision submitted' : 'Suggestion submitted'
                    : isLead ? 'Select your decision' : 'Suggest a decision'}
                </div>

                {opts.map((opt: any, idx: number) => {
                  const letter   = LETTERS[idx] ?? String(idx + 1)
                  const isChosen = lastChoice === idx
                  const isOther  = lastChoice !== null && lastChoice !== idx
                  const votes    = suggestions[idx] ?? []

                  return (
                    <button key={idx}
                      disabled={lastChoice !== null}
                      onClick={() => handleChoice(idx)}
                      className={`flex items-start gap-3 p-4 border rounded-xl text-left w-full
                        transition-all duration-150
                        ${isChosen  ? 'border-cyan-600/60 bg-cyan-950/25'
                        : isOther   ? 'border-gray-800/30 opacity-25 pointer-events-none'
                        :             'border-gray-800/70 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-900/70'}`}>

                      <span className={`shrink-0 font-display text-sm w-8 h-8
                                        flex items-center justify-center rounded border
                        ${isChosen
                          ? 'bg-cyan-900/60 border-cyan-600/40 text-cyan-300'
                          : 'bg-gray-800/60 border-gray-700/50 text-gray-500'}`}>
                        {letter}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {opt.actionText}
                        </p>
                        {votes.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {votes.map((name: string, i: number) => (
                              <span key={i}
                                className="text-[10px] font-mono text-cyan-600
                                            bg-cyan-950/40 border border-cyan-900/40
                                            rounded px-1.5 py-0.5">
                                {name} suggests
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* No stage yet but connected */}
            {!st && gameState && (
              <div className="flex items-center gap-2 text-gray-600 mt-2">
                <div className="w-3 h-3 border-2 border-gray-700 border-t-cyan-700
                                rounded-full animate-spin" />
                <span className="text-xs font-mono">Waiting for game to advance…</span>
              </div>
            )}
          </div>
        </main>

        {/* ═══ RIGHT: SIEM + activity ══════════════════════════════════════ */}
        <aside className="border-l border-gray-800/60 overflow-y-auto flex flex-col">

          {/* SIEM feed */}
          <div className="p-4 border-b border-gray-800/40 flex-1 min-h-0">
            <div className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase mb-3">
              SIEM Stream
            </div>
            <SiemFeedPanel
              irPhase={curPhase}
              keyTTPs={ttps}
              sessionSeed={
                sessionId
                  ? parseInt(sessionId.replace(/-/g, '').slice(-8), 16) % 999983
                  : 42
              }
              paused={!st}
              compact
            />
          </div>

          {/* Activity log */}
          <div className="p-4">
            <div className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase mb-2">
              Activity
            </div>
            <ActivityLog entries={activityLog.slice(-12)} compact />
          </div>
        </aside>
      </div>
    </div>
  )
}
