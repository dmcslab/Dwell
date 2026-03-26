/**
 * IncidentTapeView.tsx — single-focus narrative view
 * Viewport-locked: header + progress bar + centred stage content.
 */
import { useState, useEffect, useRef } from 'react'
import type { ScenarioFull, PlayerRole } from '../../types/scenario'
import type { GameState, ActivityEntry } from '../../hooks/useWebSocketGame'

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

const LETTERS = ['A','B','C','D']

const PHASE_ICON: Record<string,string> = {
  preparation: '🛡', detection: '🔍', containment: '🔒',
  eradication: '🧹', recovery: '♻',
}
function phaseIcon(p: string) {
  const k = Object.keys(PHASE_ICON).find(k => p?.toLowerCase().includes(k))
  return k ? PHASE_ICON[k] : '⚡'
}

export function IncidentTapeView({
  gameState, scenario, myRole,
  makeChoice, suggestChoice, elapsedSecs,
  onBack, onSwitchView,
}: Props) {
  const [chosen,      setChosen]      = useState<number | null>(null)
  const [flash,       setFlash]       = useState<{text:string;correct:boolean}|null>(null)
  const prevLen = useRef(0)

  const isLead  = myRole === 'ir_lead' || myRole === 'solo'
  const st      = gameState?.currentStage
  const opts    = st?.options ?? []
  const history = gameState?.decision_history ?? []
  const tree    = scenario?.scenario_structure?.decisionTree ?? []
  const stageIdx   = history.length
  const stageTotal = tree.length
  const pct        = stageTotal > 0 ? Math.round((stageIdx / stageTotal) * 100) : 0
  const attemptsLeft = (gameState as any)?.attempts_remaining ?? scenario?.max_attempts ?? 3

  // Reset state on new stage
  useEffect(() => {
    if (!st?.stageId) return
    setChosen(null)
  }, [st?.stageId])

  // Flash consequence on new history entry
  useEffect(() => {
    if (history.length <= prevLen.current) return
    prevLen.current = history.length
    const last = history[history.length - 1]
    if (!last) return
    setChosen(null)
    setFlash({ text: last.consequence, correct: last.is_correct })
    const t = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(t)
  }, [history.length])

  function handleChoice(idx: number) {
    if (chosen !== null) return
    setChosen(idx)
    if (isLead) makeChoice(idx); else suggestChoice(idx)
  }

  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2,'0')
  const ss = String(elapsedSecs % 60).padStart(2,'0')

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gray-950 bg-data-grid">

      {/* ── Header ── */}
      <header className="flex-shrink-0 h-14 border-b border-gray-800/50
                          bg-gray-950/92 backdrop-blur-md
                          flex items-center px-5 gap-4 z-30">
        <button onClick={onBack}
          className="text-gray-700 hover:text-gray-300 font-mono text-xs tracking-wider
                     transition-colors shrink-0">
          ←
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1 bg-gray-800/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-violet-600
                           transition-all duration-700"
               style={{ width: `${pct}%` }} />
        </div>

        <span className="text-[10px] font-mono text-gray-600 tabular-nums shrink-0">
          {mm}:{ss}
        </span>
        <span className="text-[10px] font-mono text-gray-700 shrink-0">
          {stageIdx + 1}/{stageTotal || '?'}
        </span>
        <button onClick={onSwitchView}
          className="text-[10px] font-mono text-gray-700 hover:text-cyan-400 uppercase
                     tracking-wider border border-gray-800 hover:border-cyan-800
                     rounded px-2 py-0.5 transition-all shrink-0">
          SOC
        </button>
      </header>

      {/* ── Scrollable stage content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

          {/* Phase badge */}
          {st?.irPhase && (
            <div className="flex items-center gap-2">
              <span className="text-base">{phaseIcon(st.irPhase)}</span>
              <span className="text-[10px] font-mono tracking-[0.25em] text-amber-500 uppercase">
                {st.irPhase}
              </span>
            </div>
          )}

          {/* Prompt */}
          <p className="text-[0.95rem] text-gray-200 leading-[1.85]
                         pl-4 border-l-2 border-cyan-700/30">
            {st?.prompt ?? (gameState ? 'Waiting for next stage…' : 'Connecting…')}
          </p>

          {/* Context */}
          {st?.analystContext && (
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
              <div className="text-[9px] font-mono tracking-[0.2em] text-gray-700 uppercase mb-2">
                Context
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{st.analystContext}</p>
            </div>
          )}

          {/* Flash consequence */}
          {flash && (
            <div className={`p-4 rounded-xl border text-sm leading-relaxed
              ${flash.correct
                ? 'bg-green-950/30 border-green-800/40 text-green-300'
                : 'bg-red-950/25  border-red-900/40  text-red-300'}`}>
              <div className={`text-[9px] font-mono uppercase tracking-widest mb-1.5
                ${flash.correct ? 'text-green-600' : 'text-red-600'}`}>
                {flash.correct ? '✓ Outcome' : '✗ Outcome'}
              </div>
              {flash.text}
            </div>
          )}

          {/* Choices */}
          {opts.length > 0 && !flash && (
            <div className="flex flex-col gap-3">
              <div className="text-[9px] font-mono tracking-[0.2em] text-gray-700 uppercase">
                {chosen === null
                  ? (isLead ? 'Select your response' : 'Suggest a response')
                  : 'Submitted — waiting for outcome…'}
              </div>

              {opts.map((opt, idx) => {
                const letter   = LETTERS[idx] ?? String(idx + 1)
                const isChosen = chosen === idx
                const isOther  = chosen !== null && chosen !== idx
                return (
                  <button key={idx}
                    disabled={chosen !== null}
                    onClick={() => handleChoice(idx)}
                    className={`flex items-start gap-4 p-4 border rounded-xl text-left w-full
                      transition-all duration-200
                      ${isChosen  ? 'border-cyan-600/60 bg-cyan-950/25'
                      : isOther   ? 'border-gray-800/30 opacity-25 pointer-events-none'
                      :             'border-gray-800/60 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-900/70 hover:-translate-y-0.5'}`}>
                    <span className={`shrink-0 font-display text-sm w-8 h-8 flex items-center
                                      justify-center rounded border
                      ${isChosen
                        ? 'bg-cyan-900/60 border-cyan-600/40 text-cyan-300'
                        : 'bg-gray-800/60 border-gray-700/50 text-gray-500'}`}>
                      {letter}
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed pt-0.5">
                      {opt.actionText}
                    </p>
                  </button>
                )
              })}

              {attemptsLeft <= 2 && (
                <p className={`text-[10px] font-mono
                  ${attemptsLeft === 1 ? 'text-red-400' : 'text-amber-500'}`}>
                  ⚠ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>
          )}

          {/* Stage dots */}
          {stageTotal > 0 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {Array.from({ length: stageTotal }).map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-300
                  ${i < stageIdx    ? 'w-5 h-2 bg-cyan-600'
                  : i === stageIdx  ? 'w-2 h-2 bg-amber-400'
                  :                   'w-2 h-2 bg-gray-800'}`} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
