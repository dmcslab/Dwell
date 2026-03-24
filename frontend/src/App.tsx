import { useState, useEffect } from 'react'
import { SESSION_EXPIRED_EVENT, auth } from './api/client'
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
  | { name: 'player';  scenarioId: number; sessionId: string; playerName: string; shareLink: string; joinRole?: PlayerRole }
  | { name: 'join';    sessionId: string }
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
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const handler = () => { auth.clearTokens(); setSessionExpired(true) }
    window.addEventListener(SESSION_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
  }, [])

  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash
    const joinMatch = hash.match(/^#\/join\/([^/]+)$/)
    if (joinMatch) return { name: 'join', sessionId: joinMatch[1] }
    const saved = loadSession()
    if (saved) return { name: 'player', ...saved, joinRole: saved.joinRole as PlayerRole | undefined }
    return { name: 'selector' }
  })

  const go = (r: Route) => {
    if (r.name === 'player') {
      saveSession({ scenarioId: r.scenarioId, sessionId: r.sessionId, playerName: r.playerName, shareLink: r.shareLink, joinRole: r.joinRole })
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
      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-700 rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <h2 className="text-red-400 text-lg font-bold font-mono mb-3 tracking-wider">SESSION EXPIRED</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your session has timed out. Please log in again to continue.
            </p>
            <button
              onClick={() => { setSessionExpired(false); setRoute({ name: 'selector' }) }}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold px-6 py-2.5 rounded-lg transition"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {route.name === 'selector' && (
        <ScenarioSelector
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
