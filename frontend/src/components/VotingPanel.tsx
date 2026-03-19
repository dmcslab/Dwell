/**
 * VotingPanel.tsx
 * ---------------
 * Shown during the deciding phase. Behaviour differs by role:
 *
 * IR Lead    — sees full option list + suggestion badges from teammates,
 *              clicks to submit the final decision.
 * Network /
 * Endpoint   — sees full option list, clicks to suggest (not submit),
 *              sees a "waiting for IR Lead" indicator.
 * Solo       — normal make_choice, no suggestion UI.
 *
 * Hint button available once per session for all roles.
 */
import type { DecisionStage, PlayerRole, SuggestionEntry } from '../types/scenario'
import { ROLE_DEFINITIONS } from '../types/scenario'
import { AttemptsMeter } from './AttemptsMeter'
import { IrPhaseBadge }  from './IrPhaseBadge'

// ── Helpers ───────────────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function roleLabel(role: PlayerRole): string {
  return ROLE_DEFINITIONS.find(r => r.id === role)?.label ?? role
}

function roleIcon(role: PlayerRole): string {
  return ROLE_DEFINITIONS.find(r => r.id === role)?.icon ?? '👤'
}

const ROLE_BADGE: Record<PlayerRole, string> = {
  ir_lead:  'bg-cyan-900   text-cyan-300   border-cyan-700',
  network:  'bg-sky-900    text-sky-300    border-sky-700',
  endpoint: 'bg-violet-900 text-violet-300 border-violet-700',
  solo:     'bg-gray-800   text-gray-300   border-gray-700',
}

// ── Role context resolver ─────────────────────────────────────────────────────

function getRoleContext(stage: DecisionStage, role: PlayerRole): string {
  if (role === 'network'  && stage.networkContext)  return stage.networkContext
  if (role === 'endpoint' && stage.endpointContext) return stage.endpointContext
  if (role === 'ir_lead'  && stage.irLeadContext)   return stage.irLeadContext
  return stage.analystContext
}

// ── Suggestion badge row ──────────────────────────────────────────────────────

function SuggestionBadges({ suggestions, optionIndex }: {
  suggestions: SuggestionEntry[]
  optionIndex: number
}) {
  const forThis = suggestions.filter(s => s.optionIndex === optionIndex)
  if (forThis.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {forThis.map(s => (
        <span
          key={s.clientId}
          className={`inline-flex items-center gap-1 text-xs font-mono border rounded px-1.5 py-0.5 ${ROLE_BADGE[s.role]}`}
        >
          {roleIcon(s.role)} {s.name}
        </span>
      ))}
    </div>
  )
}

// ── Hint panel ────────────────────────────────────────────────────────────────

function HintPanel({ hint, onClose }: { hint: string; onClose: () => void }) {
  return (
    <div className="bg-amber-950 border border-amber-700 rounded-xl p-4 mb-4 relative">
      <button
        onClick={onClose}
        className="absolute top-2 right-3 text-amber-600 hover:text-amber-300 text-lg"
      >×</button>
      <p className="text-xs text-amber-500 uppercase tracking-widest font-semibold mb-2">
        💡 Role Hint
      </p>
      <p className="text-amber-200 text-sm leading-relaxed">{hint}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  stage:           DecisionStage
  role:            PlayerRole
  attempts:        number
  maxAttempts:     number
  suggestions:     SuggestionEntry[]
  deciding:        boolean
  hintUsed:        boolean
  myHint:          string | null
  onChoice:        (idx: number) => void   // IR Lead / solo → make_choice
  onSuggest:       (idx: number) => void   // Network / Endpoint → suggest_choice
  onUseHint:       () => void
}

export function VotingPanel({
  stage, role, attempts, maxAttempts,
  suggestions, deciding, hintUsed, myHint,
  onChoice, onSuggest, onUseHint,
}: Props) {
  const isSubmitter = role === 'ir_lead' || role === 'solo'
  const context     = getRoleContext(stage, role)
  const hasHint     = !hintUsed

  // Track hint visibility locally
  const [showHint, setShowHint] = useLiftedState(!!myHint)

  // Show hint when it arrives
  useEffect(() => { if (myHint) setShowHint(true) }, [myHint])

  const handleOptionClick = (i: number) => {
    if (deciding) return
    if (isSubmitter) onChoice(i)
    else             onSuggest(i)
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto animate-enter">

      {/* Phase + attempts row */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <IrPhaseBadge phase={stage.irPhase} />
          {/* Role badge */}
          <span className={`text-xs font-mono border rounded px-2 py-0.5 font-semibold ${ROLE_BADGE[role]}`}>
            {roleIcon(role)} {roleLabel(role)}
          </span>
        </div>
        <AttemptsMeter remaining={attempts} max={maxAttempts} />
      </div>

      {/* Role instruction banner */}
      {!isSubmitter && (
        <div className="bg-sky-950/60 border border-sky-800/70 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-sky-400 text-lg">🎯</span>
          <p className="text-sky-300 text-xs leading-snug">
            <span className="font-bold">You are suggesting.</span> The IR Lead will make the final call.
            Your suggestion is visible to all team members.
          </p>
        </div>
      )}
      {role === 'ir_lead' && suggestions.length > 0 && (
        <div className="bg-cyan-950/60 border border-cyan-800/70 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-cyan-400 text-lg">📡</span>
          <p className="text-cyan-300 text-xs">
            <span className="font-bold">Team suggestions visible</span> — review before submitting.
          </p>
        </div>
      )}

      {/* Hint panel */}
      {showHint && myHint && (
        <HintPanel hint={myHint} onClose={() => setShowHint(false)} />
      )}

      {/* Analyst context — role-specific */}
      {context && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-semibold">
            {roleLabel(role)} Context
          </p>
          <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-line">{context}</p>
        </div>
      )}

      {/* Decision prompt */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <p className="text-gray-100 text-sm leading-relaxed">{stage.prompt}</p>
      </div>

      {/* Hint button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
          {isSubmitter ? 'Submit your action' : 'Suggest an action'}
        </p>
        {hasHint && !myHint && (
          <button
            onClick={onUseHint}
            className="text-xs text-amber-500 hover:text-amber-300 border border-amber-800/60 hover:border-amber-600 bg-amber-950/30 hover:bg-amber-950/50 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 font-mono"
          >
            💡 Use hint <span className="text-amber-700">(1 remaining)</span>
          </button>
        )}
        {hintUsed && !myHint && (
          <span className="text-xs text-gray-600">Hint used</span>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {(stage.options ?? []).map((opt, i) => {
          const mySuggestion     = suggestions.find(s => s.optionIndex === i)
          const iMySuggested     = !isSubmitter && mySuggestion !== undefined
          const suggestionCount  = suggestions.filter(s => s.optionIndex === i).length

          return (
            <button
              key={i}
              disabled={deciding}
              onClick={() => handleOptionClick(i)}
              className={`flex flex-col text-left w-full border rounded-xl p-4 transition-all duration-200 group disabled:opacity-50 disabled:cursor-wait
                ${iMySuggested
                  ? 'bg-sky-950 border-sky-600 ring-1 ring-sky-500/40'
                  : 'bg-gray-800 border-gray-700 hover:border-cyan-600 hover:bg-gray-750'
                }`}
            >
              <div className="flex items-start gap-3">
                {/* Label */}
                <span className={`shrink-0 w-6 h-6 rounded text-xs font-bold font-mono flex items-center justify-center transition-colors
                  ${iMySuggested
                    ? 'bg-sky-700 text-white'
                    : 'bg-gray-700 group-hover:bg-cyan-800 text-gray-300 group-hover:text-white'
                  }`}>
                  {OPTION_LABELS[i]}
                </span>
                <span className="text-gray-200 text-sm leading-snug group-hover:text-white transition-colors flex-1 font-ui">
                  {opt.actionText}
                </span>
                {/* Suggestion count badge */}
                {suggestionCount > 0 && isSubmitter && (
                  <span className="shrink-0 bg-sky-900 text-sky-300 text-xs font-mono border border-sky-700 rounded-full px-2 py-0.5">
                    {suggestionCount} suggest{suggestionCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Suggestion badges per option */}
              <div className="ml-9">
                <SuggestionBadges suggestions={suggestions} optionIndex={i} />
              </div>

              {/* "Your suggestion" label */}
              {iMySuggested && (
                <div className="ml-9 mt-1">
                  <span className="text-xs text-sky-400 font-mono">↑ Your suggestion</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Waiting indicator for non-submitters */}
      {!isSubmitter && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse" />
          Waiting for IR Lead to submit the final decision…
        </div>
      )}

      {/* Branch warning — shown when wrong options carry branching consequences */}
      {stage.options.some(o => o.failBranchStageId) && (
        <div className="flex items-center gap-2 text-xs text-amber-600 mt-2 border border-amber-900/60 rounded-xl px-3 py-2 bg-amber-950/40">
          <span>⚡</span>
          <span>Some wrong answers will branch the scenario — consequences affect all remaining stages.</span>
        </div>
      )}
    </div>
  )
}

// ── Tiny local useState wrapper ───────────────────────────────────────────────
// Avoids pulling in a separate file for a one-line hook

import { useEffect, useState } from 'react'

function useLiftedState<T>(initial: T): [T, (v: T) => void] {
  return useState<T>(initial)
}
