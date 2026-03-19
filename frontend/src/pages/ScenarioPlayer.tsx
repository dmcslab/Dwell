import { useEffect, useMemo, useState } from 'react'
import { gameApi }              from '../api/game'
import { ActivityLog }          from '../components/ActivityLog'
import { AttemptsMeter }        from '../components/AttemptsMeter'
import { ErrorBoundary }        from '../components/ErrorBoundary'
import { IrPhaseBadge }         from '../components/IrPhaseBadge'
import { SharePanel }           from '../components/SharePanel'
import { SiemFeedPanel }        from '../components/SiemFeedPanel'
import { IncidentTimeline }     from '../components/IncidentTimeline'
import { VotingPanel }          from '../components/VotingPanel'
import { RoleSelectPage }       from './RoleSelectPage'
import { SpectatorView }        from './SpectatorView'
import { useWebSocketGame }     from '../hooks/useWebSocketGame'
import { ROLE_DEFINITIONS }     from '../types/scenario'
import type { GameState, PlayerRole, ScenarioFull, SessionSummary } from '../types/scenario'

function DiffBadge({ level }: { level?: string }) {
  if (!level) return null
  const c = level === 'easy'   ? 'bg-emerald-900 text-emerald-300 border-emerald-700'
          : level === 'medium' ? 'bg-amber-900 text-amber-300 border-amber-700'
          :                      'bg-red-900 text-red-300 border-red-700'
  return <span className={`border rounded px-2 py-0.5 text-xs font-semibold ${c}`}>{level.toUpperCase()}</span>
}

function FeedbackPanel({ isCorrect, consequence, technicalExplanation, actionText, attemptsRemaining, maxAttempts, onContinue, gameOver, branched, branchStageName }: { isCorrect: boolean; consequence: string; technicalExplanation: string; actionText: string; attemptsRemaining: number; maxAttempts: number; onContinue: () => void; gameOver: boolean; branched?: boolean; branchStageName?: string }) {
  return (
    <div className="flex flex-col gap-5 p-6 h-full overflow-y-auto">
      <div className={`rounded-lg p-4 border ${isCorrect ? 'bg-emerald-950 border-emerald-700' : 'bg-red-950 border-red-800'}`}>
        <p className={`font-bold text-base mb-1 ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>{isCorrect ? '✓ Correct Action' : '✗ Incorrect Action'}</p>
        <p className="text-gray-300 text-sm italic">"{actionText}"</p>
      </div>
      {branched && (
        <div className="bg-amber-950 border border-amber-700 rounded-lg p-3 flex items-start gap-2">
          <span className="text-amber-400 text-lg shrink-0">⚡</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">Scenario has branched</p>
            <p className="text-amber-500 text-xs mt-0.5">
              Your decision changed the situation. The next stage reflects the consequences of this path.
              {branchStageName && <span className="block mt-1 font-mono">→ {branchStageName}</span>}
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Consequence</p>
        <p className="text-gray-200 text-sm leading-relaxed">{consequence}</p>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Technical Explanation</p>
        <p className="text-gray-300 text-sm leading-relaxed">{technicalExplanation}</p>
      </div>
      {!isCorrect && !gameOver && (
        <div className="flex items-center gap-2">
          <AttemptsMeter remaining={attemptsRemaining} max={maxAttempts} />
          <span className="text-gray-400 text-xs">{attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining</span>
        </div>
      )}
      {!gameOver && (
        <button onClick={onContinue} className="mt-8 w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm">
          {isCorrect ? 'Next Stage →' : 'Retry Stage →'}
        </button>
      )}
    </div>
  )
}

interface Props {
  scenarioId: number; initialSessionId?: string; initialPlayerName?: string
  initialShareLink?: string; initialRole?: PlayerRole; onBack: () => void
  onDebrief: (summary: SessionSummary, scenario: ScenarioFull) => void
}

export function ScenarioPlayer({ scenarioId, initialSessionId, initialPlayerName, initialShareLink, initialRole, onBack, onDebrief }: Props) {
  const [setupDone,       setSetupDone]       = useState(!!initialSessionId)
  const [sessionId,       setSessionId]       = useState(initialSessionId ?? '')
  const [playerName,      setPlayerName]      = useState(initialPlayerName ?? 'Analyst')
  const [teamName,        setTeamName]        = useState('')
  const [shareLink,       setShareLink]       = useState(initialShareLink ?? '')
  const [startErr,        setStartErr]        = useState('')
  const [starting,        setStarting]        = useState(false)
  const [scenarioMeta,    setScenarioMeta]    = useState<ScenarioFull | null>(null)
  const [showFeedback,    setShowFeedback]    = useState(false)
  const [roleSelected,    setRoleSelected]    = useState(!!initialRole)
  const [isSpectatorMode, setIsSpectatorMode] = useState(false)
  const [showShare,       setShowShare]       = useState(false)
  const [rightTab,        setRightTab]        = useState<'siem' | 'activity'>('siem')
  const [stableScenario,  setStableScenario]  = useState<ScenarioFull | null>(null)
  const [stableGameState, setStableGameState] = useState<GameState | null>(null)

  useEffect(() => { gameApi.getScenario(scenarioId).then(setScenarioMeta).catch(() => {}) }, [scenarioId])

  const ws = useWebSocketGame(sessionId, playerName)

  // Auto-assign role for players who picked it on the join page
  useEffect(() => {
    if (initialRole && ws.status === 'connected' && ws.clientId) {
      ws.sendAssignRole(initialRole)
    }
  }, [ws.status, ws.clientId])

  useEffect(() => { if (ws.scenario)          setStableScenario(ws.scenario)     }, [ws.scenario])
  useEffect(() => { if (ws.gameState)         setStableGameState(ws.gameState)   }, [ws.gameState])
  useEffect(() => { if (ws.lastChoiceResult)  setShowFeedback(true)              }, [ws.lastChoiceResult])
  useEffect(() => {
    if (ws.summary && ws.scenario) setTimeout(() => onDebrief(ws.summary!, ws.scenario!), 1500)
  }, [ws.summary])

  const handleStart = async () => {
    setStarting(true); setStartErr('')
    try {
      const res = await gameApi.start(scenarioId, teamName, playerName)
      setSessionId(res.session_id); setShareLink(res.share_link); setSetupDone(true)
    } catch (e: any) { setStartErr(e.message) }
    finally { setStarting(false) }
  }

  if (!setupDone) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm mb-6">← Back</button>
        <h2 className="text-white font-bold text-xl mb-1">Start Simulation</h2>
        <p className="text-gray-400 text-sm mb-6">{scenarioMeta?.name ?? `Scenario #${scenarioId}`}</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Your name</label>
            <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Analyst" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Team name (optional)</label>
            <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Blue Team" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          </div>
          {startErr && <p className="text-red-400 text-sm">{startErr}</p>}
          <button onClick={handleStart} disabled={starting || !playerName.trim()} className="w-full py-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm">
            {starting ? 'Creating session…' : 'Launch Session →'}
          </button>
        </div>
      </div>
    </div>
  )

  if (isSpectatorMode) return <SpectatorView sessionId={sessionId} playerName={playerName} onLeave={onBack} />

  const scenario  = ws.scenario  ?? stableScenario  ?? scenarioMeta
  const gameState = ws.gameState ?? stableGameState
  const phase     = gameState?.phase ?? 'briefing'
  const tree      = scenario?.scenario_structure?.decisionTree ?? []
  const stageId   = gameState?.current_stage_id ?? null
  const stage     = stageId ? (tree.find(s => s.stageId === stageId) ?? null) : null
  const myRole    = (gameState?.roles?.[ws.clientId] ?? 'solo') as PlayerRole
  const roleDef   = ROLE_DEFINITIONS.find(r => r.id === myRole)
  const sieFilter = roleDef?.siemSources ?? []
  // Stable refs for IncidentTimeline — prevents animation flicker on unrelated WS messages
  const stableCompletedIds    = useMemo(() => gameState?.completed_stage_ids ?? [],  [gameState?.completed_stage_ids?.length, gameState?.completed_stage_ids?.join(',')])
  const stableDecisionHistory = useMemo(() => gameState?.decision_history    ?? [],  [gameState?.decision_history?.length])
  const dot       = ws.status === 'connected' ? 'bg-emerald-500' : ws.status === 'connecting' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3 bg-gray-900 shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">← Scenarios</button>
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-white text-sm font-semibold truncate">{scenario?.name ?? 'Connecting…'}</span>
        {scenario && <DiffBadge level={scenario.difficulty_level} />}
        {ws.clientId && gameState?.roles?.[ws.clientId] && (
          <span className="text-xs font-mono border rounded px-2 py-0.5 border-gray-700 text-gray-400">{roleDef?.icon} {roleDef?.label}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-xs text-gray-500">{ws.status}</span>
          </div>
          <button onClick={() => setShowShare(v => !v)} className="text-xs text-gray-400 hover:text-cyan-400 border border-gray-700 rounded px-2 py-1">Share</button>
        </div>
      </div>

      {showShare && shareLink && (
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
          <SharePanel sessionId={sessionId} shareLink={shareLink} />
        </div>
      )}

      {scenario && gameState && (
        <div className="shrink-0">
          <IncidentTimeline
            decisionTree={tree}
            completedIds={stableCompletedIds}
            currentStageId={gameState.current_stage_id}
            decisionHistory={stableDecisionHistory}
            gamePhase={phase}
            startedAt={gameState.started_at}
            scenarioName={scenario.name}
            branchedFrom={gameState.branched_from ?? []}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">

            {(!scenario || !gameState) && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                {ws.status === 'error' ? (
                  <>
                    <p className="text-red-400 text-sm">Connection failed. Session may have ended.</p>
                    <button onClick={onBack} className="text-xs underline">← Back to scenarios</button>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
                    <p className="text-sm">Connecting to session…</p>
                  </>
                )}
              </div>
            )}

            {scenario && gameState && showFeedback && ws.lastChoiceResult && (
              <FeedbackPanel
                isCorrect={ws.lastChoiceResult.isCorrect}
                consequence={ws.lastChoiceResult.consequence}
                technicalExplanation={ws.lastChoiceResult.technicalExplanation}
                actionText={ws.lastChoiceResult.actionText}
                attemptsRemaining={gameState.attempts_remaining}
                maxAttempts={gameState.max_attempts}
                onContinue={() => setShowFeedback(false)}
                gameOver={phase === 'complete' || phase === 'failed'}
                branched={ws.lastChoiceResult.branched}
                branchStageName={ws.lastChoiceResult.branchStageName}
              />
            )}

            {scenario && gameState && !showFeedback && phase === 'briefing' && (
              roleSelected ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                  <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Starting simulation…</p>
                </div>
              ) : (
                <RoleSelectPage
                  clientId={ws.clientId}
                  playerName={playerName}
                  gameState={gameState}
                  onPickRole={role => ws.sendAssignRole(role)}
                  onBegin={() => { setRoleSelected(true); ws.sendBegin() }}
                  onWatchSession={() => setIsSpectatorMode(true)}
                  onBack={onBack}
                />
              )
            )}

            {scenario && gameState && !showFeedback && phase === 'deciding' && (
              !stage ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                  <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Loading stage…</p>
                </div>
              ) : (
                <ErrorBoundary>
                  <VotingPanel
                    stage={stage}
                    role={myRole}
                    attempts={gameState.attempts_remaining}
                    maxAttempts={gameState.max_attempts}
                    suggestions={ws.currentSuggestions}
                    deciding={false}
                    hintUsed={ws.hintUsed}
                    myHint={ws.myHint}
                    onChoice={i => ws.sendChoice(stageId!, i)}
                    onSuggest={i => ws.sendSuggest(stageId!, i)}
                    onUseHint={() => ws.sendUseHint()}
                  />
                </ErrorBoundary>
              )
            )}

            {scenario && gameState && !showFeedback && (phase === 'complete' || phase === 'failed') && (
              <div className="p-6">
                <div className={`rounded-lg p-5 border text-center ${phase === 'complete' ? 'bg-emerald-950 border-emerald-700' : 'bg-red-950 border-red-800'}`}>
                  <p className={`text-2xl font-bold mb-1 ${phase === 'complete' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {phase === 'complete' ? '✓ Simulation Complete' : '✗ Simulation Failed'}
                  </p>
                  <p className="text-gray-400 text-sm">Preparing debrief report…</p>
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="w-1/2 border-l border-gray-800 flex flex-col bg-gray-900 shrink-0">

          <div className="shrink-0 flex border-b border-gray-800">
            <button onClick={() => setRightTab('siem')} className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${rightTab === 'siem' ? 'text-cyan-400 border-b-2 border-cyan-500 bg-gray-800/50' : 'text-gray-500 hover:text-gray-300'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${phase === 'deciding' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`} />
              SIEM Feed
            </button>
            <button onClick={() => setRightTab('activity')} className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${rightTab === 'activity' ? 'text-cyan-400 border-b-2 border-cyan-500 bg-gray-800/50' : 'text-gray-500 hover:text-gray-300'}`}>
              Activity Log
              {ws.activityLog.length > 0 && (
                <span className="bg-gray-700 text-gray-400 text-[9px] font-mono rounded-full px-1.5 py-0.5">{ws.activityLog.length}</span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'siem' && scenario ? (
              <SiemFeedPanel
                irPhase={stage?.irPhase ?? scenario.scenario_structure.irPhase}
                keyTTPs={scenario.scenario_structure.keyTTPs}
                paused={phase === 'briefing'}
                roleFilter={sieFilter}
              />
            ) : (
              <ActivityLog entries={ws.activityLog} />
            )}
          </div>

          <div className="shrink-0 border-t border-gray-800 px-3 py-2 flex flex-col gap-1">
            {ws.onlineParticipants.length > 0 && (
              <p className="text-[10px] text-gray-600 font-mono">{ws.onlineParticipants.length} participant{ws.onlineParticipants.length !== 1 ? 's' : ''} online</p>
            )}
            {Object.keys(ws.spectators).length > 0 && (
              <div>
                <p className="text-[10px] text-amber-700 font-mono mb-1">👁 {Object.keys(ws.spectators).length} watching</p>
                <div className="flex flex-wrap gap-1">
                  {Object.values(ws.spectators).map((s, i) => (
                    <span key={i} className="text-[9px] text-gray-600 bg-gray-800 border border-gray-700 rounded-full px-1.5 py-0.5">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
