/**
 * IncidentTimeline.tsx
 * --------------------
 * Horizontal (desktop) / vertical (mobile) incident timeline.
 * Shows each decision stage as a node with IR phase, label, outcome,
 * and timestamp. Fills in as the analyst progresses through the scenario.
 */
import { memo } from 'react'
import type { DecisionRecord, DecisionStage } from '../types/scenario'

// ── Phase colour palette ──────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; track: string }> = {
  'Preparation':                         { bg: 'bg-violet-950', border: 'border-violet-600', text: 'text-violet-300', track: 'bg-violet-600' },
  'Detection & Analysis':                { bg: 'bg-sky-950',    border: 'border-sky-600',    text: 'text-sky-300',    track: 'bg-sky-600'    },
  'Containment':                         { bg: 'bg-amber-950',  border: 'border-amber-600',  text: 'text-amber-300',  track: 'bg-amber-600'  },
  'Containment, Eradication & Recovery': { bg: 'bg-orange-950', border: 'border-orange-600', text: 'text-orange-300', track: 'bg-orange-600' },
  'Eradication & Recovery':              { bg: 'bg-orange-950', border: 'border-orange-600', text: 'text-orange-300', track: 'bg-orange-600' },
  'Post-Incident Activity':              { bg: 'bg-emerald-950',border: 'border-emerald-600',text: 'text-emerald-300',track: 'bg-emerald-600'},
}

function phaseColor(phase: string) {
  for (const [key, val] of Object.entries(PHASE_COLORS)) {
    if (phase.toLowerCase().includes(key.toLowerCase())) return val
  }
  return { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-400', track: 'bg-gray-600' }
}

// ── Stage status ──────────────────────────────────────────────────────────────

type StageStatus = 'complete-perfect' | 'complete-retry' | 'active' | 'failed' | 'locked' | 'branched-skip'

function getStatus(
  stage:            DecisionStage,
  completedIds:     string[],
  currentStageId:   string | null,
  decisionHistory:  DecisionRecord[],
  gamePhase:        string,
  branchedFrom:     { from_stage: string; to_branch: string }[],
): StageStatus {
  const isCompleted = completedIds.includes(stage.stageId)
  const isCurrent   = stage.stageId === currentStageId
  const isFailed    = gamePhase === 'failed' && isCurrent

  // Branched-skip: stage was bypassed because a wrong answer branched past it
  const wasSkippedByBranch = branchedFrom.some(b => {
    // A stage is skipped if it's not completed, not current,
    // and the branch jumped over it (to_branch reached a later stage)
    return !isCompleted && !isCurrent && b.to_branch !== stage.stageId &&
           branchedFrom.some(bb => bb.from_stage !== stage.stageId)
  })
  // More precise: stage is skipped if it appears between a branched-away path
  // We track this simply: if branchedFrom has a branch that went TO a stage
  // that is not this stage, and this stage was never reached
  const isSkipped = !isCompleted && !isCurrent &&
    branchedFrom.length > 0 &&
    branchedFrom.some(b => {
      // All stages between from_stage and to_branch that are neither completed nor current
      return b.to_branch !== stage.stageId && b.from_stage !== stage.stageId && !isCompleted && !isCurrent
    })

  if (isFailed) return 'failed'
  if (isSkipped && branchedFrom.length > 0 && !isCompleted) return 'branched-skip'
  if (isCurrent && !isCompleted) return 'active'
  if (!isCompleted && !isCurrent) return 'locked'

  // Completed — was it first-attempt correct?
  const stageDecisions = decisionHistory.filter(d => d.stage_id === stage.stageId)
  const firstAttemptCorrect = stageDecisions.length > 0 && stageDecisions[0].is_correct
  return firstAttemptCorrect ? 'complete-perfect' : 'complete-retry'
}

// ── Stage node ────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<StageStatus, string> = {
  'complete-perfect': '✓',
  'complete-retry':   '↩',
  'active':           '▶',
  'failed':           '✗',
  'locked':           '○',
  'branched-skip':    '↷',
}

const STATUS_NODE_CLASS: Record<StageStatus, string> = {
  'complete-perfect': 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/50 shadow-lg',
  'complete-retry':   'bg-amber-700   border-amber-500   text-white',
  'active':           'bg-cyan-600    border-cyan-400    text-white shadow-cyan-900/50 shadow-lg ring-2 ring-cyan-400/30',
  'failed':           'bg-red-700     border-red-500     text-white shadow-red-900/50  shadow-lg',
  'locked':           'bg-gray-800    border-gray-600    text-gray-500',
  'branched-skip':    'bg-gray-900    border-orange-800  text-orange-600 opacity-50',
}

function getTimestamp(
  stageId:         string,
  decisionHistory: DecisionRecord[],
  startedAt:       string,
): string | null {
  const record = decisionHistory.find(d => d.stage_id === stageId && d.is_correct)
  if (record) {
    const d = new Date(record.timestamp)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  }
  return null
}

function getWrongCount(stageId: string, decisionHistory: DecisionRecord[]): number {
  return decisionHistory.filter(d => d.stage_id === stageId && !d.is_correct).length
}

// Short stage label — truncate the irPhase to a readable token
function shortPhaseLabel(irPhase: string): string {
  if (irPhase.includes('Post-Incident'))              return 'Post-Incident'
  if (irPhase.includes('Containment, Eradication'))   return 'Contain+Erad'
  if (irPhase.includes('Eradication'))                return 'Eradication'
  if (irPhase.includes('Containment'))                return 'Containment'
  if (irPhase.includes('Detection'))                  return 'Detection'
  if (irPhase.includes('Preparation'))                return 'Preparation'
  return irPhase.split(' ')[0]
}

interface StageNodeProps {
  stage:           DecisionStage
  index:           number
  total:           number
  status:          StageStatus
  timestamp:       string | null
  wrongCount:      number
  isLast:          boolean
}

function StageNode({ stage, index, status, timestamp, wrongCount, isLast }: StageNodeProps) {
  const color  = phaseColor(stage.irPhase)
  const isActive = status === 'active'
  const isDone   = status === 'complete-perfect' || status === 'complete-retry'

  return (
    <div className="flex flex-col items-center relative">
      {/* Node */}
      <div className="relative flex flex-col items-center">
        {/* Step number badge */}
        <div className="text-[9px] text-gray-600 font-mono mb-1 tracking-wider">{String(index + 1).padStart(2,'0')}</div>

        {/* Main circle */}
        <div
          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-500 ${STATUS_NODE_CLASS[status]}`}
          title={stage.prompt?.slice(0, 80)}
        >
          {STATUS_ICON[status]}
        </div>

        {/* Active pulse ring */}
        {isActive && (
          <div className="absolute inset-0 rounded-full border-2 border-cyan-400/50 animate-ping" />
        )}
      </div>

      {/* Phase label */}
      <div className={`mt-2 text-[9px] font-mono font-semibold uppercase tracking-wider text-center whitespace-nowrap ${color.text}`}>
        {shortPhaseLabel(stage.irPhase)}
      </div>

      {/* Timestamp or status */}
      <div className="mt-0.5 h-3 flex items-center justify-center">
        {timestamp ? (
          <span className="text-[9px] text-gray-500 font-mono">{timestamp}</span>
        ) : status === 'active' ? (
          <span className="text-[9px] text-cyan-500 font-mono animate-pulse">IN PROGRESS</span>
        ) : status === 'locked' ? (
          <span className="text-[9px] text-gray-600 font-mono">—</span>
        ) : null}
      </div>

      {/* Wrong attempt counter */}
      {wrongCount > 0 && (
        <div className="mt-0.5">
          <span className="text-[9px] text-amber-600 font-mono">{wrongCount} retry{wrongCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

// ── Track connector ───────────────────────────────────────────────────────────

function TrackConnector({ filled, color }: { filled: boolean; color: string }) {
  return (
    <div className="flex-1 flex items-center px-1 mt-[-24px]">
      <div className={`w-full h-0.5 transition-all duration-700 ${filled ? color : 'bg-gray-800'}`} />
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {([
        ['complete-perfect', 'emerald', 'First attempt'],
        ['complete-retry',   'amber',   'Required retry'],
        ['active',           'cyan',    'Current stage'],
        ['failed',           'red',     'Failed'],
        ['locked',           'gray',    'Upcoming'],
      ] as const).map(([, color, label]) => (
        <div key={label} className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full bg-${color}-600`} />
          <span className="text-[9px] text-gray-500 font-mono">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 font-mono shrink-0">{completed}/{total} stages</span>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  decisionTree:    DecisionStage[]
  completedIds:    string[]
  currentStageId:  string | null
  decisionHistory: DecisionRecord[]
  gamePhase:       string
  startedAt:       string
  scenarioName:    string
  branchedFrom?:   { from_stage: string; to_branch: string }[]
}

function IncidentTimelineInner({
  decisionTree,
  completedIds,
  currentStageId,
  decisionHistory,
  gamePhase,
  startedAt,
  scenarioName,
  branchedFrom = [],
}: Props) {
  if (!decisionTree.length) return null

  const total     = decisionTree.length
  const completed = completedIds.length

  return (
    <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 backdrop-blur-sm">

      {/* Top row: scenario name + progress bar */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-0.5">INCIDENT TIMELINE</p>
          <p className="text-xs text-gray-300 font-semibold truncate font-ui">{scenarioName}</p>
        </div>
        <div className="w-48 shrink-0">
          <ProgressBar completed={completed} total={total} />
        </div>
      </div>

      {/* Stage track */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1 scrollbar-thin">
        {decisionTree.map((stage, i) => {
          const status    = getStatus(stage, completedIds, currentStageId, decisionHistory, gamePhase, branchedFrom)
          const timestamp = getTimestamp(stage.stageId, decisionHistory, startedAt)
          const wrongs    = getWrongCount(stage.stageId, decisionHistory)
          const isLast    = i === decisionTree.length - 1
          const prevDone  = i === 0 || completedIds.includes(decisionTree[i - 1].stageId)
          const color     = phaseColor(stage.irPhase)

          return (
            <div key={stage.stageId} className="flex items-start flex-1 min-w-[72px]">
              {/* Connector before node (skip first) */}
              {i > 0 && (
                <TrackConnector filled={prevDone} color={color.track} />
              )}

              {/* Node */}
              <StageNode
                stage={stage}
                index={i}
                total={total}
                status={status}
                timestamp={timestamp}
                wrongCount={wrongs}
                isLast={isLast}
              />

              {/* Connector after last node? No. */}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 pt-2 border-t border-gray-800/60">
        <Legend />
      </div>
    </div>
  )
}

export const IncidentTimeline = memo(IncidentTimelineInner, (prev, next) =>
  prev.gamePhase       === next.gamePhase       &&
  prev.currentStageId  === next.currentStageId  &&
  prev.scenarioName    === next.scenarioName     &&
  prev.startedAt       === next.startedAt        &&
  prev.completedIds.length    === next.completedIds.length    &&
  prev.decisionHistory.length === next.decisionHistory.length &&
  prev.decisionTree.length    === next.decisionTree.length    &&
  (prev.branchedFrom?.length ?? 0) === (next.branchedFrom?.length ?? 0)
)
