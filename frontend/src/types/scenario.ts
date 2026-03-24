// ── Roles ─────────────────────────────────────────────────────────────────────

export type PlayerRole = 'network' | 'endpoint' | 'ir_lead' | 'solo'

export interface RoleDefinition {
  id:          PlayerRole
  label:       string
  icon:        string
  description: string
  siemSources: string[]   // which SIEM sources this role sees
  color:       string     // tailwind colour token
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id:          'ir_lead',
    label:       'IR Lead',
    icon:        '🎯',
    description: 'Full situational picture. Makes the final call on every decision.',
    siemSources: [],    // empty = show all
    color:       'cyan',
  },
  {
    id:          'network',
    label:       'Network Analyst',
    icon:        '🌐',
    description: 'Owns the perimeter. Sees firewall, DNS, and proxy telemetry.',
    siemSources: ['Firewall', 'DNS', 'Proxy', 'SIEM'],
    color:       'sky',
  },
  {
    id:          'endpoint',
    label:       'Endpoint Analyst',
    icon:        '💻',
    description: 'Owns the host. Sees EDR, Sysmon, and Windows Event logs.',
    siemSources: ['EDR', 'Sysmon', 'WinEvent', 'AV', 'SIEM'],
    color:       'violet',
  },
  {
    id:          'solo',
    label:       'Solo Analyst',
    icon:        '👤',
    description: 'Single-player mode. Full picture, no role restrictions.',
    siemSources: [],   // empty = show all sources
    color:       'gray',
  },
]

// ── Scenario structure ────────────────────────────────────────────────────────

export interface ScenarioOption {
  actionText:            string
  isCorrect:             boolean
  consequence:           string
  nextStageId:           string | null
  technicalExplanation:  string
  /** If set and option is wrong, jumps to this stage instead of decrementing attempts */
  failBranchStageId?:    string | null
}

export interface DecisionStage {
  stageId:        string
  irPhase:        string
  prompt:         string
  analystContext: string
  // Role-specific context overrides (optional)
  networkContext?:  string
  endpointContext?: string
  irLeadContext?:   string
  options:          ScenarioOption[]
}

export interface ScenarioStructure {
  ransomwareFamily:  string
  irPhase:           string
  attackVector:      string
  keyTTPs:           string[]
  simulationContext: string
  decisionTree:      DecisionStage[]
  lessonsLearned:    string[]
  referenceLinks:    string[]
  roleHints?: {
    network?:  string
    endpoint?: string
    ir_lead?:  string
    solo?:     string
  }
}

export interface ScenarioSummary {
  id:               number
  name:             string
  description:      string
  difficulty_level: 'easy' | 'medium' | 'hard'
  max_attempts:     number
}

export interface ScenarioFull extends ScenarioSummary {
  initial_prompt:     string
  scenario_structure: ScenarioStructure
}

// ── Game state ────────────────────────────────────────────────────────────────

export type GamePhase = 'briefing' | 'deciding' | 'complete' | 'failed'

export interface DecisionRecord {
  stage_id:              string
  ir_phase:              string
  option_index:          number
  action_text:           string
  is_correct:            boolean
  consequence:           string
  technical_explanation: string
  timestamp:             string
  decided_by?:           string
  decided_by_role?:      PlayerRole
}

export interface GameState {
  session_id:           string
  scenario_id:          number
  phase:                GamePhase
  current_stage_id:     string | null
  attempts_remaining:   number
  max_attempts:         number
  decision_history:     DecisionRecord[]
  completed_stage_ids:  string[]
  started_at:           string
  last_action_at:       string
  completed_at:         string | null
  outcome:              'complete' | 'failed' | null
  participants?:        Participant[]
  // Role system
  roles:                Record<string, PlayerRole>
  role_names:           Record<string, string>
  role_locked:          boolean
  suggestions:          Record<string, number>   // client_id → option_index
  hints_used:           Record<string, boolean>
  spectators:           Record<string, { name: string; joined_at: string }>
  branched_from:        { from_stage: string; to_branch: string }[]
}

export interface Participant {
  name:       string
  client_id:  string
  joined_at:  string
}

// ── WS messages ───────────────────────────────────────────────────────────────

export interface WsConnected    { type: 'connected';      client_id: string; session_id: string; state: GameState; scenario: ScenarioFull }
export interface WsStateSync    { type: 'state_sync';     state: GameState }
export interface WsChoiceResult { type: 'choice_result';  is_correct: boolean; attempts_remaining: number; consequence: string; technical_explanation: string; action_text: string; next_stage_id: string | null; phase: GamePhase; game_over: boolean; outcome: string | null; decided_by?: string; decided_by_role?: PlayerRole; decision_record: DecisionRecord; branched?: boolean; branch_stage_id?: string | null }
export interface WsGameEnd      { type: 'game_end';       summary: SessionSummary; state: GameState }
export interface WsPresence     { type: 'presence_update'; online_client_ids: string[] }
export interface WsMemberJoined { type: 'member_joined';  name: string; client_id: string }
export interface WsMemberLeft   { type: 'member_left';    name: string; client_id: string }
export interface WsRoleAssigned { type: 'role_assigned';  client_id: string; name: string; role: PlayerRole; roles: Record<string, PlayerRole>; role_names: Record<string, string> }
export interface WsSuggestion   { type: 'suggestion';     client_id: string; name: string; role: PlayerRole; stage_id: string; option_index: number; action_text: string; suggestions: Record<string, number> }
export interface WsHint         { type: 'hint';           client_id: string; role: PlayerRole; hint: string }
export interface WsHintUsed     { type: 'hint_used';      name: string; role: PlayerRole }
export interface WsPong         { type: 'pong' }
export interface WsError        { type: 'error';          message: string }
export interface WsSessionSaved { type: 'session_saved' }

export interface WsSpectatorJoinedAck { type: 'spectator_joined_ack'; client_id: string; session_id: string; state: GameState; scenario: ScenarioFull }
export interface WsSpectatorJoined    { type: 'spectator_joined'; client_id: string; name: string; spectators: Record<string, { name: string; joined_at: string }> }
export interface WsSpectatorLeft      { type: 'spectator_left';  client_id: string; name: string; spectators: Record<string, { name: string; joined_at: string }> }

export type WsMessage =
  | WsConnected | WsStateSync | WsChoiceResult | WsGameEnd
  | WsPresence  | WsMemberJoined | WsMemberLeft
  | WsRoleAssigned | WsSuggestion | WsHint | WsHintUsed
  | WsSpectatorJoinedAck | WsSpectatorJoined | WsSpectatorLeft
  | WsPong | WsError | WsSessionSaved

export interface SessionSummary {
  session_id:        string
  scenario_id:       number
  outcome:           string | null
  phases_completed:  string[]
  correct_choices:   number
  wrong_choices:     number
  attempts_used:     number
  started_at:        string | null
  completed_at:      string | null
  roles:             Record<string, PlayerRole>
  role_names:        Record<string, string>
  decision_history:  DecisionRecord[] 
}

// ── Suggestion tracking ───────────────────────────────────────────────────────

export interface SuggestionEntry {
  clientId:    string
  name:        string
  role:        PlayerRole
  optionIndex: number
  actionText:  string
}
