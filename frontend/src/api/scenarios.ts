import { api } from './client'
import type { ScenarioFull, ScenarioSummary } from '../types/scenario'

export const scenariosApi = {
  list: (difficulty?: string) =>
    api.get<ScenarioSummary[]>(`/game/scenarios${difficulty ? `?difficulty=${difficulty}` : ''}`),

  get: (id: number) =>
    api.get<ScenarioFull>(`/game/scenarios/${id}`),

  // Admin CRUD
  adminList: () =>
    api.get<ScenarioSummary[]>(`/scenarios`),

  adminGet: (id: number) =>
    api.get<ScenarioFull>(`/scenarios/${id}`),

  create: (body: unknown) =>
    api.post<ScenarioFull>(`/scenarios`, body),

  update: (id: number, body: unknown) =>
    api.put<ScenarioFull>(`/scenarios/${id}`, body),

  patch: (id: number, body: unknown) =>
    api.patch<ScenarioFull>(`/scenarios/${id}`, body),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/scenarios/${id}`),
}
