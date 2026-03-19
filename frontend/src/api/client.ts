const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const API  = `${BASE}/api/v1`

let _accessToken = ''
let _refreshToken = ''

export const auth = {
  setTokens(access: string, refresh: string) {
    _accessToken  = access
    _refreshToken = refresh
    localStorage.setItem('cr_access',  access)
    localStorage.setItem('cr_refresh', refresh)
  },
  loadTokens() {
    _accessToken  = localStorage.getItem('cr_access')  ?? ''
    _refreshToken = localStorage.getItem('cr_refresh') ?? ''
  },
  clearTokens() {
    _accessToken = _refreshToken = ''
    localStorage.removeItem('cr_access')
    localStorage.removeItem('cr_refresh')
  },
  get accessToken()  { return _accessToken  },
  get refreshToken() { return _refreshToken },
  get isLoggedIn()   { return !!_accessToken },
}

auth.loadTokens()

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)               => _fetch<T>(path),
  post:   <T>(path: string, body: unknown) => _fetch<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => _fetch<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => _fetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)               => _fetch<T>(path, { method: 'DELETE' }),
}

export const WS_BASE = BASE.replace(/^http/, 'ws')
