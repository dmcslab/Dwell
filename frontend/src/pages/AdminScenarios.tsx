import { useEffect, useState } from 'react'
import { scenariosApi } from '../api/scenarios'
import { auth, api }    from '../api/client'
import type { ScenarioFull, ScenarioSummary } from '../types/scenario'

interface Props { onBack: () => void }

// ── Login wall ────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
        <h2 className="text-white font-bold text-xl mb-1">Admin Login</h2>
        <p className="text-gray-500 text-sm mb-6">Scenario management requires admin credentials.</p>
        <div className="flex flex-col gap-3">
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Username" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password"
            placeholder="Password" onKeyDown={e => e.key === 'Enter' && handle()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handle} disabled={loading || !username || !password}
            className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Scenario form (create / edit) ─────────────────────────────────────────────
function ScenarioForm({
  initial, onSave, onCancel,
}: {
  initial?: ScenarioFull | null
  onSave: () => void
  onCancel: () => void
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
      try { structure = JSON.parse(structureRaw) }
      catch { throw new Error('scenario_structure is not valid JSON') }

      const body = { name, description, initial_prompt: prompt, difficulty_level: difficulty,
                     max_attempts: Number(maxAttempts), scenario_structure: structure }

      if (initial) await scenariosApi.update(initial.id, body)
      else          await scenariosApi.create(body)
      onSave()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-600'
  const labelCls = 'text-xs text-gray-400 mb-1 block font-semibold'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto py-8 px-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">{initial ? 'Edit Scenario' : 'New Scenario'}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Operation: …" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line summary" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Initial Prompt (analyst brief)</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
              className={`${inputCls} resize-y font-mono text-xs`} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className={`${inputCls} cursor-pointer`}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="w-28">
              <label className={labelCls}>Max Attempts</label>
              <input value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} type="number" min={1} max={10} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Scenario Structure (JSON)</label>
            <textarea value={structureRaw} onChange={e => setStructureRaw(e.target.value)} rows={12}
              className={`${inputCls} resize-y font-mono text-xs`} spellCheck={false} />
          </div>

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

// ── Main admin panel ──────────────────────────────────────────────────────────
export function AdminScenarios({ onBack }: Props) {
  const [authed,    setAuthed]    = useState(auth.isLoggedIn)
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [editing,   setEditing]   = useState<ScenarioFull | null | 'new'>()
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [deleting,  setDeleting]  = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    scenariosApi.adminList()
      .then(setScenarios)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (authed) load() }, [authed])

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await scenariosApi.delete(id)
      setScenarios(prev => prev.filter(s => s.id !== id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleEditOpen = async (id: number) => {
    try {
      const full = await scenariosApi.adminGet(id)
      setEditing(full)
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />

  const DIFF_COLOR: Record<string, string> = {
    easy:   'text-emerald-400',
    medium: 'text-amber-400',
    hard:   'text-red-400',
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {editing !== undefined && (
        <ScenarioForm
          initial={editing === 'new' ? null : editing}
          onSave={() => { setEditing(undefined); load() }}
          onCancel={() => setEditing(undefined)}
        />
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">← Back</button>
            <div className="h-4 w-px bg-gray-700" />
            <h1 className="text-white font-bold text-xl">Scenario Admin</h1>
            <span className="text-gray-500 text-sm">({scenarios.length} scenarios)</span>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + New Scenario
          </button>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4 flex items-center justify-between">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {loading && <p className="text-gray-500 text-center mt-12">Loading…</p>}

        {!loading && scenarios.length === 0 && (
          <div className="text-center mt-16">
            <p className="text-gray-600 text-lg mb-2">No scenarios yet</p>
            <p className="text-gray-600 text-sm">Run the seed script or create one manually.</p>
            <code className="mt-3 block text-xs text-cyan-700 font-mono">
              docker exec -it cyberrans_backend python scripts/seed_scenarios.py
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
                <button
                  onClick={() => handleEditOpen(s.id)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  disabled={deleting === s.id}
                  className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 hover:text-red-200 text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting === s.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
