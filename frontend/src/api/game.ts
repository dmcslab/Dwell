import { api } from './client'

export const gameApi = {
  start: (scenarioId: number, teamName: string, playerName: string) =>
    api.post<{ session_id: string; share_link: string; state: unknown }>('/game/start/' + scenarioId, {
      team_name: teamName,
      player_name: playerName,
    }),

  getJoinInfo: (sessionId: string) =>
    api.get<{ session_id: string; scenario_id: number; phase: string; participants: { name: string; client_id: string }[]; roles: Record<string, string>; role_names: Record<string, string> }>('/game/join/' + sessionId),

  join: (sessionId: string, playerName: string) =>
    api.post<{ session_id: string; state: unknown }>('/game/join/' + sessionId, { player_name: playerName }),

  getScenario: (scenarioId: number) =>
    api.get<import('../types/scenario').ScenarioFull>('/game/scenarios/' + scenarioId),
}
