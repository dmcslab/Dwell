/**
 * WelcomeScreen.tsx
 * -----------------
 * First-visit name capture. Shown once — never again until the user
 * explicitly clears their name from the Scenario Selector.
 *
 * Design: matches Dwell's dark simulation aesthetic — bg-data-grid,
 * ECG logo, IBM Plex Sans, briefing/onboarding tone.
 */
import { useState } from 'react'
import { DwellLogo } from '../components/DwellLogo'

interface Props {
  onReady: (name: string) => void
}

export function WelcomeScreen({ onReady }: Props) {
  const [name,  setName]  = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter your name to begin.')
      return
    }
    if (trimmed.length > 64) {
      setError('Name must be 64 characters or fewer.')
      return
    }
    localStorage.setItem('dwell_player_name', trimmed)
    onReady(trimmed)
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-data-grid flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-enter">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <DwellLogo size="lg" />
        </div>

        {/* Briefing card */}
        <div className="bg-gray-900/90 border border-gray-700 rounded-2xl p-8 shadow-[0_0_60px_-10px_rgb(0_0_0/0.8)] backdrop-blur-sm">

          {/* Classification strip */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-gray-700" />
            <span className="text-[11px] font-mono text-gray-500 tracking-[0.2em] uppercase">
              Analyst Identification
            </span>
            <div className="h-px flex-1 bg-gray-700" />
          </div>

          {/* Briefing text */}
          <div className="mb-6 space-y-3">
            <p className="text-white font-display font-bold text-xl tracking-wide">
              Identify yourself, Analyst.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed font-ui">
              Your name will appear throughout the simulation and in
              your debrief report. You can change it later from the
              scenario selector.
            </p>
          </div>

          {/* Name input */}
          <div className="mb-6">
            <label className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2 block font-mono">
              Display name
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. J. Rivera"
              maxLength={64}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-ui text-base focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all placeholder:text-gray-600"
            />
            {error && (
              <p className="text-red-400 text-xs mt-2 font-mono">{error}</p>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full py-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-display font-bold tracking-wider rounded-xl transition-all text-sm hover:shadow-[0_0_20px_-4px_#22d3ee66] active:scale-[0.98]"
          >
            BEGIN BRIEFING →
          </button>

        </div>

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs font-mono mt-6 tracking-wider">
          INCIDENT RESPONSE TRAINING · by dMCSlab
        </p>

      </div>
    </div>
  )
}
