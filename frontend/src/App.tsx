import { useState } from 'react'
import { ScenarioSelector } from './pages/ScenarioSelector'
import { ScenarioPlayer }   from './pages/ScenarioPlayer'
import { JoinPage }         from './pages/JoinPage'
import { DebriefPage }      from './pages/DebriefPage'
import { AdminDashboard }   from './pages/AdminDashboard'
import { useTheme }         from './contexts/ThemeContext'
import type { SessionSummary, ScenarioFull } from './types/scenario'
import type { PlayerRole } from './types/scenario'

const SESSION_KEY = 'cr_active_session'

interface SavedSession {
  scenarioId: number
  sessionId:  string
  playerName: string
  shareLink:  string
  joinToken:  string   // HMAC token — required for WS authentication
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

type Route =
  | { name: 'selector' }
  | { name: 'player';  scenarioId: number; sessionId: string; playerName: string; shareLink: string; joinToken: string; joinRole?: PlayerRole }
  | { name: 'join';    sessionId: string; joinToken: string }
  | { name: 'debrief'; summary: SessionSummary; scenario: ScenarioFull }
  | { name: 'admin' }

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      <div className="theme-toggle-knob">
        {theme === 'dark' ? '☾' : '☀'}
      </div>
    </button>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash

    // Share link format: #/join/{session_id}/{join_token}
    const joinMatch = hash.match(/^#\/join\/([^/]+)\/([^/]+)$/)
    if (joinMatch) return { name: 'join', sessionId: joinMatch[1], joinToken: joinMatch[2] }

    const saved = loadSession()
    if (saved) return {
      name:      'player',
      scenarioId: saved.scenarioId,
      sessionId:  saved.sessionId,
      playerName: saved.playerName,
      shareLink:  saved.shareLink,
      joinToken:  saved.joinToken,
      joinRole:   saved.joinRole as PlayerRole | undefined,
    }

    return { name: 'selector' }
  })

  const go = (r: Route) => {
    if (r.name === 'player') {
      saveSession({
        scenarioId: r.scenarioId,
        sessionId:  r.sessionId,
        playerName: r.playerName,
        shareLink:  r.shareLink,
        joinToken:  r.joinToken,
        joinRole:   r.joinRole,
      })
      window.location.hash = `#/play/${r.sessionId}`
    } else {
      clearSession()
      if (r.name !== 'join') window.location.hash = ''
    }
    setRoute(r)
    window.scrollTo(0, 0)
  }

  return (
    <div className="min-h-screen bg-gray-950 font-ui">
      {route.name === 'selector' && (
        <ScenarioSelector
          onSelect={() => {}}
          onSelectWithSession={(scenarioId, sessionId, playerName, shareLink, joinToken) =>
            go({ name: 'player', scenarioId, sessionId, playerName, shareLink, joinToken })
          }
        />
      )}

      {route.name === 'player' && (
        <ScenarioPlayer
          scenarioId={route.scenarioId}
          initialSessionId={route.sessionId   || undefined}
          initialPlayerName={route.playerName || undefined}
          initialShareLink={route.shareLink   || undefined}
          initialToken={route.joinToken       || undefined}
          initialRole={route.joinRole         || undefined}
          onBack={() => go({ name: 'selector' })}
          onDebrief={(summary, scenario) => go({ name: 'debrief', summary, scenario })}
        />
      )}

      {route.name === 'join' && (
        <JoinPage
          sessionId={route.sessionId}
          joinToken={route.joinToken}
          onJoined={(scenarioId, sessionId, playerName, role, joinToken) =>
            go({ name: 'player', scenarioId, sessionId, playerName, shareLink: '', joinToken, joinRole: role })
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

      {/* Global floating controls */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 z-50">
        <ThemeToggle />
        {route.name !== 'admin' && (
          <button
            onClick={() => go({ name: 'admin' })}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 text-gray-400 hover:text-white text-xs rounded-lg transition-all font-mono"
            title="Admin dashboard"
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  )
}
