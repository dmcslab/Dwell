/**
 * API client — zero-config, works locally and behind any reverse proxy / tunnel.
 *
 * All paths are relative (/api/v1/...) so the browser always calls the same
 * host:port it loaded the page from. Vite proxies these to the backend
 * internally — the user never needs to configure any URLs.
 *
 * F-01 fix: 401 responses now trigger a token refresh + single retry.
 * If refresh fails, SESSION_EXPIRED_EVENT is emitted for App.tsx to handle.
 */

const API = '/api/v1'

let _accessToken = ''
let _refreshToken = ''

export const SESSION_EXPIRED_EVENT = 'dwell:session_expired'

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

// ── Token refresh (F-01) ─────────────────────────────────────────────────────
let _refreshing: Promise<boolean> | null = null

async function _attemptRefresh(): Promise<boolean> {
  const rt = auth.refreshToken
  if (!rt) return false
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) { auth.clearTokens(); return false }
    const data = await res.json()
    auth.setTokens(data.access_token, data.refresh_token ?? rt)
    return true
  } catch {
    auth.clearTokens()
    return false
  }
}

async function _fetch<T>(path: string, init?: RequestInit, _retry = true): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  // F-01: on 401, attempt a single token refresh then retry once
  if (res.status === 401 && _retry) {
    if (!_refreshing) {
      _refreshing = _attemptRefresh().finally(() => { _refreshing = null })
    }
    const ok = await _refreshing
    if (ok) return _fetch<T>(path, init, false)
    // Refresh failed — session truly expired
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    throw new Error('Session expired — please log in again')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                => _fetch<T>(path),
  post:   <T>(path: string, body: unknown) => _fetch<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => _fetch<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => _fetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)               => _fetch<T>(path, { method: 'DELETE' }),
}

/**
 * Derive the WebSocket base URL from window.location at runtime.
 * http://  → ws://   (preserves host and port exactly)
 * https:// → wss://  (required for Cloudflare Tunnel / TLS termination)
 */
export function getWsBase(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}

// Legacy export kept for compatibility — now computed at call time
export const WS_BASE = ''
