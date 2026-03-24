/**
 * BranchVisualiser.tsx
 * --------------------
 * Debrief component: shows every stage the player touched — completed,
 * retried, or branched through — as a vertical timeline. Branch points
 * call out the divergence from the optimal path.
 */
import type { DecisionRecord, DecisionStage } from '../types/scenario'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, string> = {
  ir_lead:  '🎯',
  network:  '🌐',
  endpoint: '💻',
  solo:     '👤',
}

const ROLE_LABEL: Record<string, string> = {
  ir_lead:  'IR Lead',
  network:  'Network',
  endpoint: 'Endpoint',
  solo:     'Solo',
}

function findStage(tree: DecisionStage[], stageId: string): DecisionStage | undefined {
  return tree.find(s => s.stageId === stageId)
}

/** The optimal choice for a stage — first isCorrect option */
function optimalOption(stage: DecisionStage) {
  return stage.options.find(o => o.isCorrect)
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DecidedByBadge({ name, role }: { name?: string; role?: string }) {
  if (!name) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono border rounded px-1.5 py-0.5 bg-gray-800 border-gray-700 text-gray-400">
      {role ? ROLE_ICON[role] ?? '👤' : '👤'}
      {name}
      {role && <span className="text-gray-600">{ROLE_LABEL[role] ?? role}</span>}
    </span>
  )
}

/** A single attempt row — may be a retry (wrong) or the final decision */
function AttemptRow({
  record,
  attempt,
  isLast,
  stage,
}: {
  record:  DecisionRecord
  attempt: number
  isLast:  boolean
  stage?:  DecisionStage
}) {
  const correct = record.is_correct
  const branched = !correct && !!record.branched_to

  return (
    <div className={`relative pl-6 ${!isLast ? 'pb-3' : ''}`}>
      {/* Vertical connector */}
      {!isLast && (
        <div className="absolute left-[10px] top-5 bottom-0 w-px bg-gray-800" />
      )}

      {/* Status dot */}
      <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold
        ${correct  ? 'bg-emerald-700 border-emerald-500 text-white' :
          branched ? 'bg-orange-800  border-orange-600  text-white' :
                     'bg-red-900     border-red-700      text-red-300'}`}>
        {correct ? '✓' : branched ? '⚡' : '✗'}
      </div>

      {/* Content */}
      <div className={`rounded-lg border p-3 ${
        correct  ? 'bg-emerald-950/30 border-emerald-900' :
        branched ? 'bg-orange-950/30 border-orange-900' :
                   'bg-red-950/20    border-red-900/50'
      }`}>
        {/* Attempt label + who decided */}
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <div className="flex items-center gap-2">
            {attempt > 1 && (
              <span className="text-[11px] font-mono text-gray-600">
                Attempt {attempt}
              </span>
            )}
            <span className={`text-[11px] font-mono font-semibold uppercase tracking-wider
              ${correct ? 'text-emerald-400' : branched ? 'text-orange-400' : 'text-red-400'}`}>
              {correct ? 'Correct' : branched ? 'Branched' : 'Incorrect'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DecidedByBadge name={record.decided_by} role={record.decided_by_role} />
            <span className="text-[11px] text-gray-600 font-mono">{fmtTime(record.timestamp)}</span>
          </div>
        </div>

        {/* Chosen action */}
        <p className="text-gray-200 text-sm font-ui mb-2">
          "{record.action_text}"
        </p>

        {/* Consequence */}
        {record.consequence && (
          <p className="text-gray-400 text-xs leading-relaxed mb-2">{record.consequence}</p>
        )}

        {/* Branch callout */}
        {branched && (
          <div className="mt-2 flex items-start gap-2 bg-orange-950/40 border border-orange-900/60 rounded p-2">
            <span className="text-orange-400 shrink-0 text-sm">⚡</span>
            <p className="text-orange-300 text-xs leading-relaxed">
              This decision branched the scenario — the situation escalated
              as a consequence. See the optimal path below.
            </p>
          </div>
        )}

        {/* Optimal path callout — shown on wrong/branched attempts */}
        {!correct && stage && (
          <OptimalCallout stage={stage} chosenIndex={record.option_index} />
        )}

        {/* Technical explanation */}
        {record.technical_explanation && (
          <details className="mt-2">
            <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 select-none font-mono">
              Technical explanation ▸
            </summary>
            <p className="text-gray-400 text-xs leading-relaxed mt-1.5 pl-2 border-l border-gray-700">
              {record.technical_explanation}
            </p>
          </details>
        )}
      </div>
    </div>
  )
}

/** Shows the correct option alongside the wrong one at a branch/retry point */
function OptimalCallout({ stage, chosenIndex }: { stage: DecisionStage; chosenIndex: number }) {
  const optimal = optimalOption(stage)
  if (!optimal) return null
  // Don't show if they actually chose the correct one (shouldn't happen here but guard anyway)
  const chosenIsCorrect = stage.options[chosenIndex]?.isCorrect
  if (chosenIsCorrect) return null

  return (
    <div className="mt-2 flex items-start gap-2 bg-emerald-950/30 border border-emerald-900/50 rounded p-2">
      <span className="text-emerald-400 shrink-0 text-sm">✓</span>
      <div>
        <p className="text-[11px] text-emerald-500 font-mono font-semibold uppercase tracking-wider mb-0.5">
          Optimal action
        </p>
        <p className="text-emerald-200 text-xs leading-relaxed">
          "{optimal.actionText}"
        </p>
      </div>
    </div>
  )
}

// ── Stage block ───────────────────────────────────────────────────────────────

function StageBlock({
  stageRecords,
  stage,
  stageIndex,
  isLast,
}: {
  stageRecords: DecisionRecord[]
  stage?:       DecisionStage
  stageIndex:   number
  isLast:       boolean
}) {
  const finalRecord  = stageRecords[stageRecords.length - 1]
  const wasCorrect   = finalRecord?.is_correct ?? false
  const wasBranched  = !wasCorrect && !!finalRecord?.branched_to
  const retryCount   = stageRecords.length

  return (
    <div className={`relative ${!isLast ? 'mb-6' : ''}`}>
      {/* Stage header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0
          ${wasCorrect  ? 'bg-emerald-700 border-emerald-500 text-white' :
            wasBranched ? 'bg-orange-800  border-orange-600  text-white' :
                          'bg-red-800     border-red-600      text-white'}`}>
          {stageIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {stage && (
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">
                {stage.irPhase}
              </span>
            )}
            {retryCount > 1 && (
              <span className="text-[11px] font-mono text-amber-600 border border-amber-900 rounded px-1.5 py-0.5">
                {retryCount} attempts
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Attempt rows */}
      <div className="ml-9 flex flex-col gap-0">
        {stageRecords.map((record, i) => (
          <AttemptRow
            key={`${record.stage_id}-${i}`}
            record={record}
            attempt={i + 1}
            isLast={i === stageRecords.length - 1}
            stage={stage}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  decisionHistory: DecisionRecord[]
  decisionTree:    DecisionStage[]
}

export function BranchVisualiser({ decisionHistory, decisionTree }: Props) {
  if (!decisionHistory.length) return null

  // Group records by stage_id preserving order of first appearance
  const stageOrder: string[] = []
  const byStage: Record<string, DecisionRecord[]> = {}

  for (const record of decisionHistory) {
    if (!byStage[record.stage_id]) {
      byStage[record.stage_id] = []
      stageOrder.push(record.stage_id)
    }
    byStage[record.stage_id].push(record)
  }

  const totalAttempts = decisionHistory.length
  const correctCount  = decisionHistory.filter(r => r.is_correct).length
  const branchCount   = decisionHistory.filter(r => !r.is_correct && r.branched_to).length
  const retryCount    = decisionHistory.filter(r => !r.is_correct && !r.branched_to).length

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold font-mono">
          Decision Replay
        </p>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-400">{correctCount} correct</span>
          {retryCount  > 0 && <span className="text-red-400">{retryCount} retr{retryCount === 1 ? 'y' : 'ies'}</span>}
          {branchCount > 0 && <span className="text-orange-400">{branchCount} branch{branchCount === 1 ? '' : 'es'}</span>}
          <span className="text-gray-600">{totalAttempts} total decisions</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-800 flex-wrap">
        {[
          ['bg-emerald-700 border-emerald-500', '✓', 'text-emerald-400', 'Correct'],
          ['bg-red-900 border-red-700',         '✗', 'text-red-400',     'Incorrect / Retry'],
          ['bg-orange-800 border-orange-600',   '⚡', 'text-orange-400', 'Branch triggered'],
        ].map(([dot, icon, text, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] text-white font-bold ${dot}`}>
              {icon}
            </div>
            <span className={`text-[11px] font-mono ${text}`}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-emerald-900 bg-emerald-950/30 flex items-center justify-center text-[9px] text-emerald-400">✓</div>
          <span className="text-[11px] font-mono text-emerald-500">Optimal path shown on wrong choices</span>
        </div>
      </div>

      {/* Stage blocks */}
      <div className="flex flex-col">
        {stageOrder.map((stageId, idx) => {
          const stage   = findStage(decisionTree, stageId)
          const records = byStage[stageId]
          return (
            <StageBlock
              key={stageId}
              stageRecords={records}
              stage={stage}
              stageIndex={idx}
              isLast={idx === stageOrder.length - 1}
            />
          )
        })}
      </div>

    </div>
  )
}
