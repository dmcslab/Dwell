/**
 * ScoreCard.tsx
 * -------------
 * Debrief summary header — aggregate performance metrics computed
 * entirely from decision_history and scenario structure.
 * No new backend data required.
 */
import { useMemo } from 'react'
import type { DecisionRecord, DecisionStage } from '../types/scenario'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDt(iso: string | null | undefined): Date | null {
  if (!iso) return null
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function shortPhase(phase: string): string {
  if (phase.includes('Post-Incident'))            return 'Post-Incident'
  if (phase.includes('Containment, Eradication')) return 'Contain + Erad'
  if (phase.includes('Eradication'))              return 'Eradication'
  if (phase.includes('Containment'))              return 'Containment'
  if (phase.includes('Detection'))                return 'Detection'
  if (phase.includes('Preparation'))              return 'Preparation'
  return phase.split(' ')[0]
}

// Phase colour tokens (matches IncidentTimeline palette)
function phaseTextColor(phase: string): string {
  if (phase.includes('Preparation'))   return 'text-violet-400'
  if (phase.includes('Detection'))     return 'text-sky-400'
  if (phase.includes('Eradication'))   return 'text-orange-400'
  if (phase.includes('Containment'))   return 'text-amber-400'
  if (phase.includes('Post-Incident')) return 'text-emerald-400'
  return 'text-gray-400'
}

// ── Metric computation ────────────────────────────────────────────────────────

function useMetrics(
  history:     DecisionRecord[],
  tree:        DecisionStage[],
  startedAt:   string | null,
  completedAt: string | null,
) {
  return useMemo(() => {
    // Stage grouping — preserving encounter order
    const stageOrder: string[] = []
    const byStage: Record<string, DecisionRecord[]> = {}
    for (const r of history) {
      if (!byStage[r.stage_id]) {
        byStage[r.stage_id] = []
        stageOrder.push(r.stage_id)
      }
      byStage[r.stage_id].push(r)
    }

    const totalStages       = stageOrder.length
    const firstAttemptOk    = stageOrder.filter(sid => byStage[sid][0].is_correct).length
    const firstAttemptPct   = totalStages > 0 ? Math.round(firstAttemptOk / totalStages * 100) : 0

    const totalDecisions    = history.length
    const correctDecisions  = history.filter(r => r.is_correct).length
    const branches          = history.filter(r => !r.is_correct && r.branched_to).length
    const retries           = history.filter(r => !r.is_correct && !r.branched_to).length

    // Duration
    const start = parseDt(startedAt)
    const end   = parseDt(completedAt)
    const durationSec = start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)) : null

    // Slowest stage — stage with most time between first and last attempt
    let slowestStageId: string | null = null
    let slowestSec = 0
    for (const sid of stageOrder) {
      const records = byStage[sid]
      if (records.length < 2) continue
      const t0 = parseDt(records[0].timestamp)
      const t1 = parseDt(records[records.length - 1].timestamp)
      if (t0 && t1) {
        const diff = Math.round((t1.getTime() - t0.getTime()) / 1000)
        if (diff > slowestSec) { slowestSec = diff; slowestStageId = sid }
      }
    }

    // Per-phase breakdown
    const phaseMap: Record<string, { stages: number; firstCorrect: number }> = {}
    for (const sid of stageOrder) {
      const records = byStage[sid]
      const phase   = records[0].ir_phase
      if (!phaseMap[phase]) phaseMap[phase] = { stages: 0, firstCorrect: 0 }
      phaseMap[phase].stages++
      if (records[0].is_correct) phaseMap[phase].firstCorrect++
    }

    // Missed stages — in tree but never reached
    const touchedIds = new Set(stageOrder)
    const missedStages = tree.filter(s => !touchedIds.has(s.stageId))

    return {
      totalStages, firstAttemptOk, firstAttemptPct,
      totalDecisions, correctDecisions, branches, retries,
      durationSec, phaseMap,
      slowestStageId, slowestSec,
      missedStages,
    }
  }, [history, tree, startedAt, completedAt])
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color = 'text-white' }: {
  label:  string
  value:  string | number
  sub?:   string
  color?: string
}) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex flex-col items-center text-center gap-1">
      <span className={`text-2xl font-display font-bold ${color}`}>{value}</span>
      {sub && <span className="text-[11px] text-gray-500 font-mono">{sub}</span>}
      <span className="text-[11px] text-gray-500 uppercase tracking-wider font-mono">{label}</span>
    </div>
  )
}

function AccuracyBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 font-mono w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono w-8 text-right shrink-0
        ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
        {pct}%
      </span>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  decisionHistory:    DecisionRecord[]
  decisionTree:       DecisionStage[]
  outcome:            string | null
  startedAt:          string | null
  completedAt:        string | null
  maxAttempts:        number
  difficulty:         string
  playerName?:        string
  onPlayAgain?:       () => void
}

export function ScoreCard({
  decisionHistory,
  decisionTree,
  outcome,
  startedAt,
  completedAt,
  maxAttempts,
  difficulty,
  playerName,
  onPlayAgain,
}: Props) {
  const m = useMetrics(decisionHistory, decisionTree, startedAt, completedAt)

  const passed        = outcome === 'complete'
  const accuracyColor = m.firstAttemptPct >= 80 ? 'text-emerald-400'
                      : m.firstAttemptPct >= 50 ? 'text-amber-400'
                      : 'text-red-400'

  const diffColor = difficulty === 'easy'   ? 'text-emerald-400'
                  : difficulty === 'medium' ? 'text-amber-400'
                  : 'text-red-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-1">
            Performance Report
          </p>
          {playerName && (
            <p className="text-gray-400 text-sm font-ui">
              Analyst: <span className="text-white font-semibold">{playerName}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-mono uppercase border rounded px-2 py-0.5 ${diffColor} border-current opacity-70`}>
            {difficulty}
          </span>
          <span className={`text-xs font-mono font-bold uppercase border rounded px-2 py-0.5
            ${passed ? 'text-emerald-400 border-emerald-700 bg-emerald-950/40'
                     : 'text-red-400 border-red-800 bg-red-950/40'}`}>
            {passed ? '✓ Passed' : '✗ Failed'}
          </span>
        </div>
      </div>

      {/* Top stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="First-attempt accuracy"
          value={`${m.firstAttemptPct}%`}
          sub={`${m.firstAttemptOk} of ${m.totalStages} stages`}
          color={accuracyColor}
        />
        <StatTile
          label="Time to complete"
          value={m.durationSec !== null ? fmtDuration(m.durationSec) : '—'}
          color="text-cyan-400"
        />
        <StatTile
          label="Retries"
          value={m.retries}
          sub={m.retries === 0 ? 'clean run' : `${m.retries} wrong, no branch`}
          color={m.retries === 0 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <StatTile
          label="Branches triggered"
          value={m.branches}
          sub={m.branches === 0 ? 'none' : 'scenario diverged'}
          color={m.branches === 0 ? 'text-emerald-400' : 'text-orange-400'}
        />
      </div>

      {/* Per-phase accuracy bars */}
      {Object.keys(m.phaseMap).length > 1 && (
        <div className="mb-5">
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-mono mb-3">
            First-attempt accuracy by phase
          </p>
          <div className="flex flex-col gap-2">
            {Object.entries(m.phaseMap).map(([phase, stats]) => {
              const pct = Math.round(stats.firstCorrect / stats.stages * 100)
              return (
                <AccuracyBar
                  key={phase}
                  pct={pct}
                  label={shortPhase(phase)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Slowest stage callout */}
      {m.slowestStageId && m.slowestSec > 30 && (
        <div className="mb-5 bg-amber-950/30 border border-amber-900/50 rounded-lg px-4 py-3 flex items-start gap-2">
          <span className="text-amber-400 shrink-0">⏱</span>
          <p className="text-amber-300 text-xs leading-relaxed">
            Most time spent on <span className="font-mono font-semibold">{m.slowestStageId}</span> — {fmtDuration(m.slowestSec)} between first and final attempt.
            Review the decision replay below to see what happened.
          </p>
        </div>
      )}

      {/* Missed stages note */}
      {m.missedStages.length > 0 && (
        <div className="mb-5 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 flex items-start gap-2">
          <span className="text-gray-500 shrink-0">○</span>
          <p className="text-gray-400 text-xs leading-relaxed">
            <span className="text-gray-300 font-semibold">{m.missedStages.length} stage{m.missedStages.length > 1 ? 's' : ''} not reached</span>
            {' '}— a branch or failed run ended the simulation before these stages.
            Replay the scenario to explore the full path.
          </p>
        </div>
      )}

      {/* Replay prompt */}
      {onPlayAgain && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 flex-wrap
          ${m.firstAttemptPct < 100 || m.branches > 0
            ? 'bg-cyan-950/30 border-cyan-900/50'
            : 'bg-emerald-950/30 border-emerald-900/50'}`}>
          <p className={`text-sm font-ui ${m.firstAttemptPct < 100 || m.branches > 0 ? 'text-cyan-300' : 'text-emerald-300'}`}>
            {m.branches > 0
              ? `${m.branches} branch${m.branches > 1 ? 'es' : ''} triggered — replay to take the optimal path.`
              : m.retries > 0
                ? `${m.retries} retr${m.retries > 1 ? 'ies' : 'y'} needed — replay for a clean first-attempt run.`
                : 'Perfect run — every stage correct on the first attempt.'}
          </p>
          {(m.firstAttemptPct < 100 || m.branches > 0) && (
            <button
              onClick={onPlayAgain}
              className="shrink-0 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold rounded-lg transition-colors font-ui"
            >
              Replay scenario →
            </button>
          )}
        </div>
      )}

    </div>
  )
}
