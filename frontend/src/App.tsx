import { useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ScenarioSelector } from './pages/ScenarioSelector'
import { ScenarioPlayer }   from './pages/ScenarioPlayer'
import { JoinPage }         from './pages/JoinPage'
import { DebriefPage }      from './pages/DebriefPage'
import { AdminDashboard }   from './pages/AdminDashboard'
import type { SessionSummary, ScenarioFull } from './types/scenario'
import type { PlayerRole } from './types/scenario'

// ── Session storage key ───────────────────────────────────────────────────────

const SESSION_KEY = 'cr_active_session'

interface SavedSession {
  scenarioId: number
  sessionId:  string
  playerName: string
  shareLink:  string
  joinRole?:  string
}

function saveSession(s: SavedSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {}
}

function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

// ── Route types ───────────────────────────────────────────────────────────────

type Route =
  | { name: 'selector' }
  | { name: 'player';  scenarioId: number; sessionId: string; playerName: string; shareLink: string; joinRole?: PlayerRole }
  | { name: 'join';    sessionId: string }
  | { name: 'debrief'; summary: SessionSummary; scenario: ScenarioFull }
  | { name: 'admin' }

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [route, setRoute] = useState<Route>(() => {
    // 1. Check for /join/:id hash (share link)
    const hash = window.location.hash
    const joinMatch = hash.match(/^#\/join\/([^/]+)$/)
    if (joinMatch) return { name: 'join', sessionId: joinMatch[1] }

    // 2. Check for persisted active session (page refresh recovery)
    const saved = loadSession()
    if (saved) return { name: 'player', ...saved, joinRole: saved.joinRole as PlayerRole | undefined }

    // 3. Default: scenario selector
    return { name: 'selector' }
  })

  const go = (r: Route) => {
    // Persist or clear session state on navigation
    if (r.name === 'player') {
      saveSession({
        scenarioId: r.scenarioId,
        sessionId:  r.sessionId,
        playerName: r.playerName,
        shareLink:  r.shareLink,
        joinRole:   r.joinRole,
      })
      // Update URL hash so browser Back button works
      window.location.hash = `#/play/${r.sessionId}`
    } else {
      clearSession()
      if (r.name !== 'join') window.location.hash = ''
    }
    setRoute(r)
    window.scrollTo(0, 0)
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-950">
      {route.name === 'selector' && (
        <ScenarioSelector
          onSelect={() => {}}
          onSelectWithSession={(scenarioId, sessionId, playerName, shareLink) =>
            go({ name: 'player', scenarioId, sessionId, playerName, shareLink })
          }
        />
      )}

      {route.name === 'player' && (
        <ScenarioPlayer
          scenarioId={route.scenarioId}
          initialSessionId={route.sessionId  || undefined}
          initialPlayerName={route.playerName || undefined}
          initialShareLink={route.shareLink   || undefined}
          initialRole={route.joinRole || undefined}
          onBack={() => go({ name: 'selector' })}
          onDebrief={(summary, scenario) => go({ name: 'debrief', summary, scenario })}
        />
      )}

      {route.name === 'join' && (
        <JoinPage
          sessionId={route.sessionId}
          onJoined={(scenarioId, sessionId, playerName, role) =>
            go({ name: 'player', scenarioId, sessionId, playerName, shareLink: '', joinRole: role })
          }
          onBack={() => go({ name: 'selector' })}
        />
      )}

      {route.name === 'debrief' && (
        <DebriefPage
          summary={route.summary}
          scenario={route.scenario}
          onPlayAgain={() => go({ name: 'selector' })}
          onBack={() => go({ name: 'selector' })}
        />
      )}

      {route.name === 'admin' && (
        <AdminDashboard onBack={() => go({ name: 'selector' })} />
      )}

      {/* Admin button — always visible except on admin page */}
      {route.name !== 'admin' && (
        <button
          onClick={() => go({ name: 'admin' })}
          className="fixed bottom-4 right-4 px-3 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-400 hover:text-white text-xs rounded-lg transition-colors z-50"
          title="Admin dashboard"
        >
          ⚙ Admin
        </button>
      )}
    </div>
    </ErrorBoundary>
  )
}
