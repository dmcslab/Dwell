import { useState } from 'react'
import { WelcomeScreen }    from './pages/WelcomeScreen'
import { ScenarioSelector } from './pages/ScenarioSelector'
import { ScenarioPlayer }   from './pages/ScenarioPlayer'
import { JoinPage }         from './pages/JoinPage'
import { DebriefPage }      from './pages/DebriefPage'
import { AdminDashboard }   from './pages/AdminDashboard'
import { useTheme }         from './contexts/ThemeContext'
import type { SessionSummary, ScenarioFull, PlayerRole } from './types/scenario'

// ── Player name persistence ───────────────────────────────────────────────────

const NAME_KEY = 'dwell_player_name'

function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
}
function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name) } catch {}
}
function clearName() {
  try { localStorage.removeItem(NAME_KEY) } catch {}
}

// ── Session persistence ───────────────────────────────────────────────────────

const SESSION_KEY = 'cr_active_session'

interface SavedSession {
  scenarioId: number
  sessionId:  string
  playerName: string
  shareLink:  string
  joinToken:  string
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
  | { name: 'welcome' }
  | { name: 'selector' }
  | { name: 'player';  scenarioId: number; sessionId: string; playerName: string; shareLink: string; joinToken: string; joinRole?: PlayerRole }
  | { name: 'join';    sessionId: string; joinToken: string }
  | { name: 'debrief'; summary: SessionSummary; scenario: ScenarioFull }
  | { name: 'admin' }

// ── Theme toggle (selector only — kept here so it stays in this file) ─────────

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

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [playerName, setPlayerName] = useState<string>(loadName)

  // Determine initial route
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash

    // Share link: #/join/{session_id}/{join_token}
    const joinMatch = hash.match(/^#\/join\/([^/]+)\/([^/]+)$/)
    if (joinMatch) {
      // Even via share link, require a name
      if (!loadName()) return { name: 'welcome' }
      return { name: 'join', sessionId: joinMatch[1], joinToken: joinMatch[2] }
    }

    // No name yet → welcome screen
    if (!loadName()) return { name: 'welcome' }

    // Restore in-progress session
    const saved = loadSession()
    if (saved) return {
      name:       'player',
      scenarioId: saved.scenarioId,
      sessionId:  saved.sessionId,
      playerName: saved.playerName,
      shareLink:  saved.shareLink,
      joinToken:  saved.joinToken,
      joinRole:   saved.joinRole as PlayerRole | undefined,
    }

    return { name: 'selector' }
  })

  // Track the route the user was on before entering admin,
  // so the Back button can return them there.
  const [preAdminRoute, setPreAdminRoute] = useState<Route>({ name: 'selector' })

  const go = (r: Route) => {
    if (r.name === 'admin') {
      // Remember where we came from
      setPreAdminRoute(route)
    }

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
    } else if (r.name !== 'join' && r.name !== 'admin') {
      clearSession()
      window.location.hash = ''
    }

    setRoute(r)
    window.scrollTo(0, 0)
  }

  // Called from WelcomeScreen when name is submitted
  const handleNameSet = (name: string) => {
    saveName(name)
    setPlayerName(name)

    // If arrived via share link, go there now
    const hash = window.location.hash
    const joinMatch = hash.match(/^#\/join\/([^/]+)\/([^/]+)$/)
    if (joinMatch) {
      go({ name: 'join', sessionId: joinMatch[1], joinToken: joinMatch[2] })
    } else {
      go({ name: 'selector' })
    }
  }

  // Called from ScenarioSelector when user clears their name
  const handleClearName = () => {
    clearName()
    clearSession()
    setPlayerName('')
    window.location.hash = ''
    setRoute({ name: 'welcome' })
  }

  return (
    <div className="min-h-screen bg-gray-950 font-ui">

      {route.name === 'welcome' && (
        <WelcomeScreen onReady={handleNameSet} />
      )}

      {route.name === 'selector' && (
        <>
          <ScenarioSelector
            playerName={playerName}
            onClearName={handleClearName}
            onSelectWithSession={(scenarioId, sessionId, shareLink, joinToken) =>
              go({ name: 'player', scenarioId, sessionId, playerName, shareLink, joinToken })
            }
            onAdmin={() => go({ name: 'admin' })}
          />
          {/* Theme toggle: selector only */}
          <div className="fixed bottom-4 right-4 z-50">
            <ThemeToggle />
          </div>
        </>
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
          onJoined={(scenarioId, sessionId, name, role, joinToken) =>
            go({ name: 'player', scenarioId, sessionId, playerName: name, shareLink: '', joinToken, joinRole: role })
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
        <AdminDashboard onBack={() => go(preAdminRoute)} />
      )}

    </div>
  )
}
