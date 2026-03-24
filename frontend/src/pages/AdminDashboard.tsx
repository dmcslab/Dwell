import { DwellLogo }   from '../components/DwellLogo'
import { DmcslabLogo } from '../components/DmcslabLogo'
/**
 * AdminDashboard.tsx
 * ------------------
 * Four-tab admin console:
 *   Sessions  — live active sessions from Redis
 *   Stats     — platform-wide metrics
 *   Users     — user management (promote/demote/disable/reset password)
 *   Scenarios — full CRUD (re-uses logic from AdminScenarios)
 *
 * Requires is_admin = true on the backend.
 * Default credentials: admin / Dwell!Change123 (seed_admin.py)
 */
import { useCallback, useEffect, useState } from 'react'
import { ScenarioBuilder } from './ScenarioBuilder'
import { api, auth }    from '../api/client'
import { adminApi }     from '../api/admin'
import { scenariosApi } from '../api/scenarios'
import type { ActiveSession, AdminUser, PlatformStats } from '../api/admin'
import type { ScenarioFull, ScenarioSummary } from '../types/scenario'

// ── Shared helpers ────────────────────────────────────────────────────────────

type Tab = 'sessions' | 'stats' | 'users' | 'scenarios'

const DIFF_COLOR: Record<string, string> = {
  easy:   'text-emerald-400',
  medium: 'text-amber-400',
  hard:   'text-red-400',
}

const PHASE_COLOR: Record<string, string> = {
  briefing:   'text-gray-400',
  deciding:   'text-cyan-400',
  complete:   'text-emerald-400',
  failed:     'text-red-400',
}

const ROLE_ICON: Record<string, string> = {
  ir_lead:  '🎯',
  network:  '🌐',
  endpoint: '💻',
  solo:     '👤',
}

function pill(text: string, color: string) {
  return (
    <span className={`text-xs font-mono border rounded px-1.5 py-0.5 ${color}`}>
      {text}
    </span>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-white font-bold text-lg">{title}</h2>
      {action}
    </div>
  )
}

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
      <p className="text-red-300 text-sm">{msg}</p>
      <button onClick={onDismiss} className="text-red-500 hover:text-red-300 ml-4">✕</button>
    </div>
  )
}

// ── Login wall ────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handle = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/login', { username, password }
      )
      auth.setTokens(res.access_token, res.refresh_token)
      onLogin()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚙</span>
          <div>
            <h2 className="text-white font-bold text-xl">Admin Login</h2>
            <p className="text-gray-500 text-xs">Default: admin / Dwell!Change123</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password"
            placeholder="Password" onKeyDown={e => e.key === 'Enter' && handle()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handle} disabled={loading || !username || !password}
            className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sessions tab ──────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    try {
      setSessions(await adminApi.getSessions())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 10s
  useEffect(() => {
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div>
      <SectionHeader
        title={`Live Sessions (${sessions.length})`}
        action={
          <button onClick={load} className="text-xs text-gray-400 hover:text-cyan-400 border border-gray-700 rounded px-3 py-1.5 transition-colors">
            ↻ Refresh
          </button>
        }
      />

      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}
      {loading && <p className="text-gray-500 text-sm">Loading sessions…</p>}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-600 text-4xl mb-3">📭</p>
          <p className="text-gray-500">No active sessions right now.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sessions.map(s => (
          <div key={s.session_id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
              <div>
                <p className="text-white font-semibold text-sm">{s.scenario_name}</p>
                <p className="text-gray-600 text-xs font-mono mt-0.5">{s.session_id}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold capitalize ${PHASE_COLOR[s.phase ?? ''] ?? 'text-gray-400'}`}>
                  {s.phase ?? 'unknown'}
                </span>
                {s.phase === 'deciding' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Players</p>
                <p className="text-white font-bold">{s.participants.length}</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Attempts Left</p>
                <p className={`font-bold ${s.attempts_remaining === 1 ? 'text-red-400' : 'text-white'}`}>
                  {s.attempts_remaining ?? '—'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Stages Done</p>
                <p className="text-white font-bold">{s.completed_stages}</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Started</p>
                <p className="text-gray-300 text-xs font-mono">
                  {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Participants + roles */}
            {s.participants.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.participants.map(p => {
                  const role = s.roles[p.client_id]
                  return (
                    <div key={p.client_id} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1">
                      <span className="text-sm">{ROLE_ICON[role] ?? '👤'}</span>
                      <span className="text-gray-200 text-xs font-medium">{p.name}</span>
                      {role && (
                        <span className="text-[11px] text-gray-500 font-mono capitalize">{role.replace('_', ' ')}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {s.current_stage_id && (
              <p className="text-gray-600 text-xs font-mono mt-2">
                Stage: {s.current_stage_id}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────



// ── Reset Stats Button ────────────────────────────────────────────────────────

function ResetStatsButton({ onDone }: { onDone: (msg: string) => void }) {
  const [confirm,  setConfirm]  = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error,    setError]    = useState('')

  const doReset = async () => {
    setResetting(true)
    try {
      const res = await adminApi.resetAllStats()
      setConfirm(false)
      onDone(res.message)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setResetting(false)
    }
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="px-4 py-2 bg-red-900 hover:bg-red-800 border border-red-700 text-red-300 text-sm font-semibold rounded-lg transition-colors shrink-0"
      >
        Reset All Stats
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <p className="text-red-400 text-xs font-semibold">Are you sure? This cannot be undone.</p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)} className="px-3 py-1.5 border border-gray-700 rounded text-gray-400 text-xs hover:text-white">Cancel</button>
        <button onClick={doReset} disabled={resetting}
          className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors">
          {resetting ? 'Resetting…' : 'Yes, Reset Everything'}
        </button>
      </div>
    </div>
  )
}

function StatsTab() {
  const [stats,   setStats]   = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState('')

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading stats…</p>
  if (error)   return <ErrorBanner msg={error} onDismiss={() => setError('')} />
  if (!stats)  return null

  const { sessions, by_difficulty, top_scenarios, most_failed_stages, totals } = stats

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Platform Statistics"
        action={<ResetStatsButton />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions',   value: sessions.total,           color: 'text-cyan-400' },
          { label: 'Completed',         value: sessions.completed,       color: 'text-emerald-400' },
          { label: 'Failed',            value: sessions.failed,          color: 'text-red-400' },
          { label: 'Completion Rate',   value: `${sessions.completion_rate}%`, color: 'text-amber-400' },
          { label: 'Total Users',       value: totals.users,             color: 'text-violet-400' },
          { label: 'Scenarios',         value: totals.scenarios,         color: 'text-sky-400' },
          { label: 'In Progress',       value: sessions.in_progress,     color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Sessions by difficulty */}
      {Object.keys(by_difficulty).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Sessions by Difficulty</p>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(by_difficulty).map(([diff, count]) => {
              const total = sessions.total || 1
              const pct   = Math.round((count / total) * 100)
              return (
                <div key={diff} className="flex-1 min-w-[80px]">
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`capitalize font-semibold ${DIFF_COLOR[diff]}`}>{diff}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        diff === 'easy' ? 'bg-emerald-600' : diff === 'medium' ? 'bg-amber-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{pct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top scenarios */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Top Scenarios by Plays</p>
          {top_scenarios.length === 0 ? (
            <p className="text-gray-600 text-sm">No data yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {top_scenarios.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-gray-600 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-xs font-medium truncate">{s.name}</p>
                    <span className={`text-xs ${DIFF_COLOR[s.difficulty]}`}>{s.difficulty}</span>
                  </div>
                  <span className="text-cyan-400 text-xs font-mono shrink-0">{s.plays} plays</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Most failed stages */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Most Failed Stages</p>
          {most_failed_stages.length === 0 ? (
            <p className="text-gray-600 text-sm">No failure data yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {most_failed_stages.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-gray-600 text-xs font-mono w-4 shrink-0">{i + 1}</span>
                  <p className="text-gray-300 text-xs font-mono flex-1 truncate">{s.stage_id}</p>
                  <span className="text-red-400 text-xs font-mono shrink-0">{s.fail_count}✗</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="bg-red-950/30 border border-red-900 rounded-xl p-5">
        <p className="text-xs text-red-500 uppercase tracking-widest font-semibold mb-3">⚠ Danger Zone</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white text-sm font-semibold">Reset All Stats & Sessions</p>
            <p className="text-gray-400 text-xs mt-0.5">
              Permanently deletes all game sessions and clears Redis state. Scenarios and user accounts are NOT affected.
            </p>
          </div>
          <ResetStatsButton onDone={(msg) => setToast(msg)} />
        </div>
        {toast && (
          <div className="mt-3 bg-emerald-950 border border-emerald-800 rounded-lg px-3 py-2 text-emerald-300 text-sm">
            ✓ {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────



function PasswordResetModal({ user, onClose, onDone }: {
  user:    AdminUser
  onClose: () => void
  onDone:  (msg: string) => void
}) {
  const [pw,      setPw]      = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handle = async () => {
    if (pw !== confirm) { setError('Passwords do not match'); return }
    if (pw.length < 8)  { setError('Minimum 8 characters');  return }
    setSaving(true)
    try {
      const res = await adminApi.resetPassword(user.id, pw)
      onDone(res.message)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Reset Password — {user.username}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm password" onKeyDown={e => e.key === 'Enter' && handle()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
            <button onClick={handle} disabled={saving || !pw}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Create User modal ─────────────────────────────────────────────────────────

function AddUserModal({ onClose, onDone }: {
  onClose: () => void
  onDone:  (msg: string) => void
}) {
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const handle = async () => {
    if (!username || !email || !password) { setError('All fields required'); return }
    setSaving(true)
    try {
      const user = await adminApi.createUser({ username, email, password, is_admin: isAdmin })
      onDone(`User "${user.username}" created`)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">Create User</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="analyst01" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="analyst@org.com" type="email" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Password (min 8 chars)</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-600" />
            <span className="text-sm text-gray-300">Grant admin privileges</span>
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
            <button onClick={handle} disabled={saving}
              className="px-5 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const [users,       setUsers]       = useState<AdminUser[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [toast,       setToast]       = useState('')
  const [resetting,   setResetting]   = useState<AdminUser | null>(null)
  const [deleting,    setDeleting]    = useState<number | null>(null)
  const [creating,    setCreating]    = useState(false)

  const load = () => adminApi.getUsers()
    .then(setUsers)
    .catch((e: any) => setError(e.message))
    .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const toggleAdmin = async (u: AdminUser) => {
    try {
      const updated = await adminApi.updateUser(u.id, { is_admin: !u.is_admin })
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
      showToast(`${updated.username} ${updated.is_admin ? 'promoted to admin' : 'demoted from admin'}`)
    } catch (e: any) { setError(e.message) }
  }

  const toggleActive = async (u: AdminUser) => {
    try {
      const updated = await adminApi.updateUser(u.id, { is_active: !u.is_active })
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
      showToast(`${updated.username} ${updated.is_active ? 'enabled' : 'disabled'}`)
    } catch (e: any) { setError(e.message) }
  }

  const deleteUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete "${u.username}"? This cannot be undone.`)) return
    setDeleting(u.id)
    try {
      await adminApi.deleteUser(u.id)
      setUsers(prev => prev.filter(x => x.id !== u.id))
      showToast(`User "${u.username}" deleted`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      {creating && (
        <AddUserModal
          onClose={() => setCreating(false)}
          onDone={(msg) => { setCreating(false); load(); showToast(msg) }}
        />
      )}
      {resetting && (
        <PasswordResetModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={(msg) => { setResetting(null); showToast(msg) }}
        />
      )}

      <SectionHeader
        title={`Users (${users.length})`}
        action={
          <button onClick={() => setCreating(true)}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold rounded-lg transition-colors">
            + Create User
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div className="bg-emerald-950 border border-emerald-700 rounded-lg px-4 py-2.5 mb-4 text-emerald-300 text-sm">
          ✓ {toast}
        </div>
      )}

      {error    && <ErrorBanner msg={error} onDismiss={() => setError('')} />}
      {loading  && <p className="text-gray-500 text-sm">Loading users…</p>}

      <div className="flex flex-col gap-2">
        {users.map(u => (
          <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap">
            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-gray-500 text-xs font-mono">#{u.id}</span>
                {u.is_admin  && pill('Admin',    'bg-cyan-900 text-cyan-300 border-cyan-700')}
                {!u.is_active && pill('Disabled', 'bg-red-900 text-red-300 border-red-700')}
              </div>
              <p className="text-white font-semibold text-sm">{u.username}</p>
              <p className="text-gray-500 text-xs">{u.email}</p>
              <p className="text-gray-600 text-xs font-mono mt-0.5">
                Joined {new Date(u.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={() => toggleAdmin(u)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  u.is_admin
                    ? 'bg-cyan-950 border-cyan-800 text-cyan-400 hover:bg-red-950 hover:border-red-800 hover:text-red-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-cyan-950 hover:border-cyan-800 hover:text-cyan-400'
                }`}
                title={u.is_admin ? 'Remove admin' : 'Make admin'}
              >
                {u.is_admin ? '★ Admin' : '☆ Make Admin'}
              </button>

              <button
                onClick={() => toggleActive(u)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  u.is_active
                    ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-amber-950 hover:border-amber-800 hover:text-amber-400'
                    : 'bg-amber-950 border-amber-800 text-amber-400 hover:bg-gray-800 hover:border-gray-700 hover:text-gray-400'
                }`}
              >
                {u.is_active ? 'Disable' : 'Enable'}
              </button>

              <button
                onClick={() => setResetting(u)}
                className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-700 rounded-lg transition-colors"
              >
                Reset PW
              </button>

              <button
                onClick={() => deleteUser(u)}
                disabled={deleting === u.id}
                className="px-3 py-1.5 text-xs bg-red-950 border border-red-900 text-red-400 hover:bg-red-900 hover:text-red-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting === u.id ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Scenarios tab (lifted from AdminScenarios) ────────────────────────────────

function ScenarioForm({ initial, onSave, onCancel }: {
  initial?:  ScenarioFull | null
  onSave:    () => void
  onCancel:  () => void
}) {
  const [name,         setName]         = useState(initial?.name ?? '')
  const [description,  setDescription]  = useState(initial?.description ?? '')
  const [prompt,       setPrompt]       = useState(initial?.initial_prompt ?? '')
  const [difficulty,   setDifficulty]   = useState(initial?.difficulty_level ?? 'medium')
  const [maxAttempts,  setMaxAttempts]  = useState(String(initial?.max_attempts ?? 3))
  const [structureRaw, setStructureRaw] = useState(
    initial?.scenario_structure ? JSON.stringify(initial.scenario_structure, null, 2) : '{}'
  )
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    setSaving(true); setError('')
    try {
      let structure: unknown
      try { structure = JSON.parse(structureRaw) } catch { throw new Error('scenario_structure is not valid JSON') }
      const body = { name, description, initial_prompt: prompt, difficulty_level: difficulty,
                     max_attempts: Number(maxAttempts), scenario_structure: structure }
      if (initial) await scenariosApi.update(initial.id, body)
      else         await scenariosApi.create(body)
      onSave()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto py-8 px-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">{initial ? 'Edit Scenario' : 'New Scenario'}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>
        <div className="flex flex-col gap-4">
          <div><label className="text-xs text-gray-400 mb-1 block font-semibold">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Operation: …" className={inputCls} /></div>
          <div><label className="text-xs text-gray-400 mb-1 block font-semibold">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line summary" className={inputCls} /></div>
          <div><label className="text-xs text-gray-400 mb-1 block font-semibold">Initial Prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} className={`${inputCls} resize-y font-mono text-xs`} /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="text-xs text-gray-400 mb-1 block font-semibold">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select></div>
            <div className="w-28"><label className="text-xs text-gray-400 mb-1 block font-semibold">Max Attempts</label>
              <input value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} type="number" min={1} max={10} className={inputCls} /></div>
          </div>
          <div><label className="text-xs text-gray-400 mb-1 block font-semibold">Scenario Structure (JSON)</label>
            <textarea value={structureRaw} onChange={e => setStructureRaw(e.target.value)} rows={14}
              className={`${inputCls} resize-y font-mono text-xs`} spellCheck={false} /></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
            <button onClick={handle} disabled={saving || !name || !prompt}
              className="px-5 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Scenario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScenariosTab() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [editing,   setEditing]   = useState<ScenarioFull | null | 'new'>()
  const [building,  setBuilding]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [deleting,  setDeleting]  = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    scenariosApi.adminList().then(setScenarios).catch((e: any) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    setDeleting(id)
    try { await scenariosApi.delete(id); setScenarios(prev => prev.filter(s => s.id !== id)) }
    catch (e: any) { setError(e.message) }
    finally { setDeleting(null) }
  }

  const handleEditOpen = async (id: number) => {
    try { setEditing(await scenariosApi.adminGet(id)) }
    catch (e: any) { setError(e.message) }
  }

  return (
    <div>
      {editing !== undefined && (
        <ScenarioForm
          initial={editing === 'new' ? null : editing}
          onSave={() => { setEditing(undefined); load() }}
          onCancel={() => setEditing(undefined)}
        />
      )}

      {building && (
        <ScenarioBuilder
          onSaved={() => { setBuilding(false); load() }}
          onCancel={() => setBuilding(false)}
        />
      )}

      <SectionHeader
        title={`Scenarios (${scenarios.length})`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setBuilding(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
              🧱 Build Scenario
            </button>
            <button onClick={() => setEditing('new')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors border border-gray-600">
              { } Raw JSON
            </button>
          </div>
        }
      />

      {error   && <ErrorBanner msg={error} onDismiss={() => setError('')} />}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && scenarios.length === 0 && (
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-2">No scenarios yet.</p>
          <code className="text-xs text-cyan-700 font-mono block">
            docker exec -it dwell_backend python scripts/seed_scenarios.py
          </code>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {scenarios.map(s => (
          <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-gray-500 text-xs font-mono">#{s.id}</span>
                <span className={`text-xs font-semibold ${DIFF_COLOR[s.difficulty_level]}`}>
                  {s.difficulty_level.toUpperCase()}
                </span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{s.name}</p>
              <p className="text-gray-500 text-xs truncate">{s.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleEditOpen(s.id)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs rounded-lg transition-colors">
                Edit
              </button>
              <button onClick={() => handleDelete(s.id, s.name)} disabled={deleting === s.id}
                className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 hover:text-red-200 text-xs rounded-lg transition-colors disabled:opacity-50">
                {deleting === s.id ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main dashboard shell ──────────────────────────────────────────────────────

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'sessions',  label: 'Sessions',  icon: '📡' },
  { id: 'stats',     label: 'Stats',     icon: '📊' },
  { id: 'users',     label: 'Users',     icon: '👥' },
  { id: 'scenarios', label: 'Scenarios', icon: '🎯' },
]

interface Props { onBack: () => void }

export function AdminDashboard({ onBack }: Props) {
  const [authed, setAuthed] = useState(auth.isLoggedIn)
  const [tab,    setTab]    = useState<Tab>('sessions')

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />

  return (
    <div className="min-h-screen bg-gray-950 bg-data-grid">

      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4">
        <button onClick={onBack} className="text-gray-500 hover:text-cyan-400 text-xs font-mono tracking-wider transition-colors">
          ← BACK
        </button>
        <div className="h-4 w-px bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙</span>
          <span className="text-white font-bold text-sm">Admin Dashboard</span>
        </div>
        <button
          onClick={() => { auth.clearTokens(); setAuthed(false) }}
          className="ml-auto text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded px-2 py-1 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 flex gap-1">
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {tab === 'sessions'  && <SessionsTab />}
        {tab === 'stats'     && <StatsTab />}
        {tab === 'users'     && <UsersTab />}
        {tab === 'scenarios' && <ScenariosTab />}
      </div>
    </div>
  )
}
