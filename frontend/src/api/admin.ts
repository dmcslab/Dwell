import { api } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveSession {
  session_id:        string
  scenario_id:       number
  scenario_name:     string
  started_at:        string
  phase:             string | null
  current_stage_id:  string | null
  participants:      { name: string; client_id: string; joined_at: string }[]
  roles:             Record<string, string>
  role_names:        Record<string, string>
  attempts_remaining: number | null
  completed_stages:  number
}

export interface PlatformStats {
  sessions: {
    total:           number
    completed:       number
    failed:          number
    in_progress:     number
    completion_rate: number
  }
  by_difficulty:    Record<string, number>
  top_scenarios:    { name: string; difficulty: string; plays: number }[]
  most_failed_stages: { stage_id: string; fail_count: number }[]
  totals: {
    users:     number
    scenarios: number
  }
}

export interface AdminUser {
  id:         number
  username:   string
  email:      string
  is_admin:   boolean
  is_active:  boolean
  created_at: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const adminApi = {
  getSessions: ()                                   => api.get<ActiveSession[]>('/admin/sessions'),
  getStats:    ()                                   => api.get<PlatformStats>('/admin/stats'),
  getUsers:    ()                                   => api.get<AdminUser[]>('/admin/users'),
  updateUser:  (id: number, body: Partial<{ is_admin: boolean; is_active: boolean }>) =>
                                                       api.put<AdminUser>(`/admin/users/${id}`, body),
  resetPassword: (id: number, newPassword: string) => api.put<{ message: string }>(`/admin/users/${id}/password`, { new_password: newPassword }),
  deleteUser:    (id: number)                         => api.delete<{ message: string }>(`/admin/users/${id}`),
  createUser:    (body: { username: string; email: string; password: string; is_admin: boolean }) =>
                   api.post<AdminUser>('/admin/users', body),
  resetAllStats: () =>
    api.post<{ message: string; reset_by: string }>(
      '/admin/reset-stats',
      { confirm: 'RESET' },       // matches the server-side ResetStatsConfirm model
    ),
}
