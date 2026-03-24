import { useCallback, useEffect, useRef, useState } from 'react'
import { getWsBase } from '../api/client'
import type {
  DecisionRecord, GamePhase, GameState, PlayerRole,
  ScenarioFull, SessionSummary, SuggestionEntry, WsMessage,
} from '../types/scenario'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface ActivityEntry {
  id:        number
  timestamp: string
  type:      'info' | 'correct' | 'wrong' | 'system' | 'join' | 'leave' | 'suggestion' | 'hint'
  text:      string
  detail?:   string
  role?:     PlayerRole
}

interface LastChoiceResult {
  isCorrect:            boolean
  consequence:          string
  technicalExplanation: string
  actionText:           string
  decidedBy?:           string
  decidedByRole?:       PlayerRole
  branched?:            boolean
  branchStageName?:     string
}

interface UseWebSocketGameReturn {
  status:              ConnectionStatus
  clientId:            string
  scenario:            ScenarioFull | null
  gameState:           GameState | null
  summary:             SessionSummary | null
  activityLog:         ActivityEntry[]
  onlineParticipants:  string[]
  lastChoiceResult:    LastChoiceResult | null
  currentSuggestions:  SuggestionEntry[]
  myHint:              string | null
  hintUsed:            boolean
  spectators:          Record<string, { name: string; joined_at: string }>
  // actions
  sendBegin:           () => void
  sendAssignRole:      (role: PlayerRole) => void
  sendChoice:          (stageId: string, optionIndex: number) => void
  sendSuggest:         (stageId: string, optionIndex: number) => void
  sendUseHint:         () => void
  sendSaveExit:        () => void
  sendRequestState:    () => void
}

let _id = 0
const nextId = () => ++_id

export function useWebSocketGame(
  sessionId:  string,
  playerName: string,
): UseWebSocketGameReturn {
  const wsRef = useRef<WebSocket | null>(null)

  const [status,             setStatus]             = useState<ConnectionStatus>('connecting')
  const [clientId,           setClientId]           = useState('')
  const [scenario,           setScenario]           = useState<ScenarioFull | null>(null)
  const [gameState,          setGameState]          = useState<GameState | null>(null)
  const [summary,            setSummary]            = useState<SessionSummary | null>(null)
  const [activityLog,        setActivityLog]        = useState<ActivityEntry[]>([])
  const [onlineParticipants, setOnline]             = useState<string[]>([])
  const [lastChoiceResult,   setLastChoice]         = useState<LastChoiceResult | null>(null)
  const [currentSuggestions, setSuggestions]        = useState<SuggestionEntry[]>([])
  const [myHint,             setMyHint]             = useState<string | null>(null)
  const [hintUsed,           setHintUsed]           = useState(false)
  const [spectators,         setSpectators]         = useState<Record<string, { name: string; joined_at: string }>>({})

  const addLog = useCallback((entry: Omit<ActivityEntry, 'id'>) => {
    setActivityLog(prev => [...prev, { ...entry, id: nextId() }])
  }, [])

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(msg))
  }, [])

  useEffect(() => {
    if (!sessionId) return
    const url = `${getWsBase()}/api/v1/game/play/${sessionId}?name=${encodeURIComponent(playerName)}`
    const ws  = new WebSocket(url)
    wsRef.current = ws
    let intentionalClose = false  // flag to suppress onclose during cleanup

    ws.onopen  = () => {}  // status set to 'connected' only after WS handshake message arrives
    ws.onerror = () => setStatus('error')
    ws.onclose = () => { if (!intentionalClose) setStatus('disconnected') }

    ws.onmessage = (evt) => {
      let msg: WsMessage
      try { msg = JSON.parse(evt.data) } catch { return }

      switch (msg.type) {

        case 'connected':
          setStatus('connected')  // set here — scenario + state arrive same render, eliminates black-screen gap
          setClientId(msg.client_id)
          setScenario(msg.scenario)
          setGameState(msg.state)
          setSpectators(msg.state.spectators ?? {})
          addLog({ timestamp: new Date().toISOString(), type: 'system', text: `Connected as "${playerName}"` })
          break

        case 'state_sync':
          setGameState(msg.state)
          setSpectators(msg.state.spectators ?? {})
          // Rebuild suggestions from state
          buildSuggestionsFromState(msg.state)
          break

        case 'role_assigned':
          setGameState(prev => prev
            ? { ...prev, roles: msg.roles, role_names: msg.role_names }
            : prev)
          addLog({
            timestamp: new Date().toISOString(), type: 'info',
            text: `${msg.name} took the ${roleLabel(msg.role)} role`,
            role: msg.role,
          })
          break

        case 'suggestion':
          setSuggestions(prev => {
            const next = prev.filter(s => s.clientId !== msg.client_id)
            next.push({ clientId: msg.client_id, name: msg.name, role: msg.role,
                        optionIndex: msg.option_index, actionText: msg.action_text })
            return next
          })
          addLog({
            timestamp: new Date().toISOString(), type: 'suggestion',
            text: `${msg.name} (${roleLabel(msg.role)}) suggests: "${msg.action_text}"`,
            role: msg.role,
          })
          break

        case 'choice_result':
          setGameState(prev => prev
            ? { ...prev, phase: msg.phase as GamePhase, attempts_remaining: msg.attempts_remaining }
            : prev)
          setLastChoice({
            isCorrect: msg.is_correct, consequence: msg.consequence,
            technicalExplanation: msg.technical_explanation, actionText: msg.action_text,
            decidedBy: msg.decided_by, decidedByRole: msg.decided_by_role,
            branched: msg.branched,
            branchStageName: msg.branch_stage_id ?? undefined,
          })
          setSuggestions([])  // clear on submit
          addLog({
            timestamp: new Date().toISOString(),
            type: msg.is_correct ? 'correct' : 'wrong',
            text: `${msg.decided_by ?? 'Player'}: ${msg.action_text}`,
            detail: msg.consequence,
            role: msg.decided_by_role,
          })
          break

        case 'game_end':
          setGameState(msg.state)
          setSummary(msg.summary)
          addLog({
            timestamp: new Date().toISOString(), type: 'system',
            text: `Simulation ${msg.summary.outcome === 'complete' ? 'complete ✓' : 'failed ✗'}`,
          })
          break

        case 'presence_update':
          setOnline(msg.online_client_ids)
          break

        case 'member_joined':
          addLog({ timestamp: new Date().toISOString(), type: 'join', text: `${msg.name} joined` })
          break

        case 'member_left':
          addLog({ timestamp: new Date().toISOString(), type: 'leave', text: `${msg.name} left` })
          setSuggestions(prev => prev.filter(s => s.clientId !== msg.client_id))
          break

        case 'hint':
          setMyHint(msg.hint)
          setHintUsed(true)
          addLog({ timestamp: new Date().toISOString(), type: 'hint', text: 'Hint revealed' })
          break

        case 'hint_used':
          addLog({
            timestamp: new Date().toISOString(), type: 'hint',
            text: `${msg.name} (${roleLabel(msg.role)}) used their hint`,
          })
          break

        case 'error':
          addLog({ timestamp: new Date().toISOString(), type: 'system', text: `Error: ${msg.message}` })
          break

        case 'spectator_joined':
          setSpectators(msg.spectators)
          addLog({ timestamp: new Date().toISOString(), type: 'join', text: `${msg.name} is now watching 👁` })
          break

        case 'spectator_left':
          setSpectators(msg.spectators)
          addLog({ timestamp: new Date().toISOString(), type: 'leave', text: `${msg.name} stopped watching` })
          break

        default: break
      }
    }

    return () => { intentionalClose = true; ws.close() }
  }, [sessionId])
  // Dependency array intentionally contains only sessionId.
  //
  // playerName: captured into the WS URL at connection time. If the user
  //   changes their name after connecting we do NOT want to tear down and
  //   rebuild the WebSocket — that would drop the live game session.
  //   The name is cosmetic after connect; the server already registered it.
  //
  // addLog: stable — defined with useCallback and no deps of its own.
  //   Including it would satisfy ESLint but never actually change between
  //   renders, so it is safe to omit.
  //
  // token: captured into the URL at connection time, same reasoning as
  //   playerName. Re-connecting with a new token is never needed within
  //   a single session lifecycle.
  //
  // If you add deps here, be aware that ANY change will close and reopen
  // the WebSocket, disconnecting all players from the live session.

  // Helper: rebuild suggestion list from synced state
  function buildSuggestionsFromState(state: GameState) {
    if (!state.suggestions || Object.keys(state.suggestions).length === 0) {
      setSuggestions([])
      return
    }
    // We don't have full action text here — keep existing if stage unchanged
    setSuggestions(prev => {
      const next = prev.filter(s => state.suggestions[s.clientId] === s.optionIndex)
      return next
    })
  }

  return {
    status, clientId, scenario, gameState, summary,
    activityLog, onlineParticipants, lastChoiceResult,
    currentSuggestions, myHint, hintUsed, spectators,
    sendBegin:         () => send({ type: 'begin' }),
    sendAssignRole:    (role) => send({ type: 'assign_role', role }),
    sendChoice:        (stageId, optionIndex) => send({ type: 'make_choice', stage_id: stageId, option_index: optionIndex }),
    sendSuggest:       (stageId, optionIndex) => send({ type: 'suggest_choice', stage_id: stageId, option_index: optionIndex }),
    sendUseHint:       () => send({ type: 'use_hint' }),
    sendSaveExit:      () => send({ type: 'save_exit' }),
    sendRequestState:  () => send({ type: 'request_state' }),
  }
}

function roleLabel(role: PlayerRole): string {
  const map: Record<PlayerRole, string> = {
    ir_lead:  'IR Lead',
    network:  'Network',
    endpoint: 'Endpoint',
    solo:     'Solo',
  }
  return map[role] ?? role
}
