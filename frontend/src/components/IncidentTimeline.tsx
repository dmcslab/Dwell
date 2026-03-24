/**
 * IncidentTimeline.tsx
 * --------------------
 * Horizontal incident timeline grouped by IR phase.
 * Stages within the same consecutive IR phase are rendered under a shared
 * phase header — eliminating repeated phase labels while preserving full
 * per-stage progress granularity.
 */
import { memo } from 'react'
import type { DecisionRecord, DecisionStage } from '../types/scenario'

// ── Phase colour palette ──────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; track: string; header: string }> = {
  'Preparation':                         { bg: 'bg-violet-950', border: 'border-violet-600', text: 'text-violet-300', track: 'bg-violet-600',  header: 'border-violet-700 text-violet-400' },
  'Detection & Analysis':                { bg: 'bg-sky-950',    border: 'border-sky-600',    text: 'text-sky-300',    track: 'bg-sky-600',     header: 'border-sky-700 text-sky-400'       },
  'Containment':                         { bg: 'bg-amber-950',  border: 'border-amber-600',  text: 'text-amber-300',  track: 'bg-amber-600',   header: 'border-amber-700 text-amber-400'   },
  'Containment, Eradication & Recovery': { bg: 'bg-orange-950', border: 'border-orange-600', text: 'text-orange-300', track: 'bg-orange-600',  header: 'border-orange-700 text-orange-400' },
  'Eradication & Recovery':              { bg: 'bg-orange-950', border: 'border-orange-600', text: 'text-orange-300', track: 'bg-orange-600',  header: 'border-orange-700 text-orange-400' },
  'Post-Incident Activity':              { bg: 'bg-emerald-950',border: 'border-emerald-600',text: 'text-emerald-300',track: 'bg-emerald-600', header: 'border-emerald-700 text-emerald-400'},
}

function phaseColor(phase: string) {
  for (const [key, val] of Object.entries(PHASE_COLORS)) {
    if (phase.toLowerCase().includes(key.toLowerCase())) return val
  }
  return { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-400', track: 'bg-gray-600', header: 'border-gray-700 text-gray-400' }
}

// ── Phase grouping ────────────────────────────────────────────────────────────

interface PhaseGroup {
  phase:  string
  stages: DecisionStage[]
}

/** Group consecutive same-phase stages. Non-consecutive same phases
 *  become separate groups — preserves ordering and branch semantics. */
function groupByPhase(tree: DecisionStage[]): PhaseGroup[] {
  const groups: PhaseGroup[] = []
  for (const stage of tree) {
    if (groups.length > 0 && groups[groups.length - 1].phase === stage.irPhase) {
      groups[groups.length - 1].stages.push(stage)
    } else {
      groups.push({ phase: stage.irPhase, stages: [stage] })
    }
  }
  return groups
}

// ── Stage status ──────────────────────────────────────────────────────────────

type StageStatus = 'complete-perfect' | 'complete-retry' | 'active' | 'failed' | 'locked' | 'branched-skip'

function getStatus(
  stage:           DecisionStage,
  completedIds:    string[],
  currentStageId:  string | null,
  decisionHistory: DecisionRecord[],
  gamePhase:       string,
  branchedFrom:    { from_stage: string; to_branch: string }[],
): StageStatus {
  const isCompleted = completedIds.includes(stage.stageId)
  const isCurrent   = stage.stageId === currentStageId
  const isFailed    = gamePhase === 'failed' && isCurrent

  const isSkipped = !isCompleted && !isCurrent &&
    branchedFrom.length > 0 &&
    branchedFrom.some(b =>
      b.to_branch !== stage.stageId && b.from_stage !== stage.stageId && !isCompleted && !isCurrent
    )

  if (isFailed)    return 'failed'
  if (isSkipped && branchedFrom.length > 0 && !isCompleted) return 'branched-skip'
  if (isCurrent && !isCompleted) return 'active'
  if (!isCompleted && !isCurrent) return 'locked'

  const stageDecisions       = decisionHistory.filter(d => d.stage_id === stage.stageId)
  const firstAttemptCorrect  = stageDecisions.length > 0 && stageDecisions[0].is_correct
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

function getTimestamp(stageId: string, decisionHistory: DecisionRecord[]): string | null {
  const record = decisionHistory.find(d => d.stage_id === stageId && d.is_correct)
  if (!record) return null
  const d = new Date(record.timestamp)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

function getWrongCount(stageId: string, decisionHistory: DecisionRecord[]): number {
  return decisionHistory.filter(d => d.stage_id === stageId && !d.is_correct).length
}

interface StageNodeProps {
  stage:           DecisionStage
  globalIndex:     number   // position across the whole tree (for step number)
  status:          StageStatus
  timestamp:       string | null
  wrongCount:      number
  isLastInGroup:   boolean
  isLastGroup:     boolean
  color:           ReturnType<typeof phaseColor>
  showConnector:   boolean  // show track after this node
  nextCompleted:   boolean  // is the next node completed (for track fill)
}

function StageNode({
  stage, globalIndex, status, timestamp, wrongCount,
  color, showConnector, nextCompleted,
}: StageNodeProps) {
  const isActive = status === 'active'

  return (
    <div className="flex items-start">
      {/* Node + label */}
      <div className="flex flex-col items-center min-w-[56px]">
        <div className="text-[11px] text-gray-600 font-mono mb-1 tracking-wider">
          {String(globalIndex + 1).padStart(2, '0')}
        </div>
        <div className="relative">
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-500 ${STATUS_NODE_CLASS[status]}`}
            title={stage.prompt?.slice(0, 80)}
          >
            {STATUS_ICON[status]}
          </div>
          {isActive && (
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/50 animate-ping" />
          )}
        </div>

        {/* Timestamp or status label */}
        <div className="mt-1 h-3 flex items-center justify-center">
          {timestamp ? (
            <span className="text-[11px] text-gray-500 font-mono">{timestamp}</span>
          ) : status === 'active' ? (
            <span className="text-[11px] text-cyan-500 font-mono animate-pulse">NOW</span>
          ) : status === 'locked' ? (
            <span className="text-[11px] text-gray-700 font-mono">—</span>
          ) : null}
        </div>

        {wrongCount > 0 && (
          <span className="text-[11px] text-amber-600 font-mono mt-0.5">
            {wrongCount}✗
          </span>
        )}
      </div>

      {/* Connector track to next node */}
      {showConnector && (
        <div className="flex items-center mt-[22px] flex-1 px-1 min-w-[16px]">
          <div
            className={`w-full h-0.5 transition-all duration-700 ${
              nextCompleted ? color.track : 'bg-gray-800'
            }`}
          />
        </div>
      )}
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
      <span className="text-xs text-gray-500 font-mono shrink-0">{completed}/{total}</span>
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
          <span className="text-[11px] text-gray-500 font-mono">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Short phase label for the header ─────────────────────────────────────────

function shortPhaseLabel(phase: string): string {
  if (phase.includes('Post-Incident'))              return 'Post-Incident'
  if (phase.includes('Containment, Eradication'))   return 'Contain + Erad'
  if (phase.includes('Eradication'))                return 'Eradication'
  if (phase.includes('Containment'))                return 'Containment'
  if (phase.includes('Detection'))                  return 'Detection'
  if (phase.includes('Preparation'))                return 'Preparation'
  return phase.split(' ')[0]
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
  scenarioName,
  branchedFrom = [],
}: Props) {
  if (!decisionTree.length) return null

  const total     = decisionTree.length
  const completed = completedIds.length
  const groups    = groupByPhase(decisionTree)

  // Build a flat index map so each node keeps its global step number
  const globalIndexMap: Record<string, number> = {}
  decisionTree.forEach((s, i) => { globalIndexMap[s.stageId] = i })

  return (
    <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 backdrop-blur-sm">

      {/* Top row */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-600 font-mono uppercase tracking-widest mb-0.5">
            INCIDENT TIMELINE
          </p>
          <p className="text-xs text-gray-300 font-semibold truncate font-ui">{scenarioName}</p>
        </div>
        <div className="w-48 shrink-0">
          <ProgressBar completed={completed} total={total} />
        </div>
      </div>

      {/* Phase groups */}
      <div className="flex items-start gap-0 overflow-x-auto pb-2 scrollbar-thin">
        {groups.map((group, groupIdx) => {
          const color        = phaseColor(group.phase)
          const isLastGroup  = groupIdx === groups.length - 1

          return (
            <div key={`${group.phase}-${groupIdx}`} className="flex items-start">

              {/* Phase section */}
              <div className="flex flex-col">

                {/* Phase header label */}
                <div className={`mb-2 px-2 py-0.5 rounded border text-[11px] font-mono font-semibold uppercase tracking-wider whitespace-nowrap self-start ${color.header} bg-transparent`}>
                  {shortPhaseLabel(group.phase)}
                </div>

                {/* Stage nodes within this phase */}
                <div className="flex items-start">
                  {group.stages.map((stage, stageIdx) => {
                    const isLastInGroup  = stageIdx === group.stages.length - 1
                    const globalIdx      = globalIndexMap[stage.stageId]
                    const nextStage      = decisionTree[globalIdx + 1]
                    const nextCompleted  = nextStage ? completedIds.includes(nextStage.stageId) : false
                    const showConnector  = !(isLastInGroup && isLastGroup)

                    const status    = getStatus(stage, completedIds, currentStageId, decisionHistory, gamePhase, branchedFrom)
                    const timestamp = getTimestamp(stage.stageId, decisionHistory)
                    const wrongs    = getWrongCount(stage.stageId, decisionHistory)

                    return (
                      <StageNode
                        key={stage.stageId}
                        stage={stage}
                        globalIndex={globalIdx}
                        status={status}
                        timestamp={timestamp}
                        wrongCount={wrongs}
                        isLastInGroup={isLastInGroup}
                        isLastGroup={isLastGroup}
                        color={color}
                        showConnector={showConnector}
                        nextCompleted={nextCompleted}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Between-group spacer (slightly wider gap than within-group) */}
              {!isLastGroup && (
                <div className="flex items-center mt-[38px] w-4 shrink-0">
                  <div className="w-full h-0.5 bg-gray-700" />
                </div>
              )}

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
