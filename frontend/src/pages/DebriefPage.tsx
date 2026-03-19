import { useState } from 'react'
import { IrPhaseBadge }   from '../components/IrPhaseBadge'
import { useReportPdf }   from '../hooks/useReportPdf'
import type { ScenarioFull, SessionSummary } from '../types/scenario'

interface Props {
  summary:     SessionSummary
  scenario:    ScenarioFull
  onPlayAgain: () => void
  onBack:      () => void
}

export function DebriefPage({ summary, scenario, onPlayAgain, onBack }: Props) {
  const { exportPdf }    = useReportPdf()
  const [exporting, setExporting] = useState(false)
  const passed = summary.outcome === 'complete'
  const s      = scenario.scenario_structure

  const handleExport = async () => {
    setExporting(true)
    try { await exportPdf(summary, scenario) }
    finally { setExporting(false) }
  }

  const duration = (() => {
    if (!summary.started_at || !summary.completed_at) return null
    const ms = new Date(summary.completed_at).getTime() - new Date(summary.started_at).getTime()
    const m  = Math.floor(ms / 60_000)
    const s  = Math.floor((ms % 60_000) / 1000)
    return `${m}m ${s}s`
  })()

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Outcome banner */}
        <div className={`rounded-xl border p-6 mb-6 text-center ${
          passed
            ? 'bg-emerald-950 border-emerald-700'
            : 'bg-red-950 border-red-800'
        }`}>
          <p className={`text-4xl font-extrabold tracking-tight mb-1 ${passed ? 'text-emerald-300' : 'text-red-300'}`}>
            {passed ? '✓ Simulation Complete' : '✗ Simulation Failed'}
          </p>
          <p className="text-gray-400 text-sm">{scenario.name}</p>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Correct',        value: summary.correct_choices,          color: 'text-emerald-400' },
            { label: 'Wrong',          value: summary.wrong_choices,            color: 'text-red-400' },
            { label: 'Attempts Used',  value: `${summary.attempts_used} / ${scenario.max_attempts}`, color: 'text-amber-400' },
            { label: 'Stages Cleared', value: summary.phases_completed.length,  color: 'text-cyan-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-gray-500 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        {duration && (
          <p className="text-center text-gray-600 text-xs mb-6">Completed in {duration}</p>
        )}

        {/* Scenario metadata */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Scenario Details</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <IrPhaseBadge phase={s.irPhase} />
            <span className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-0.5 font-mono">
              {s.ransomwareFamily}
            </span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">{s.attackVector}</p>
          <div className="flex flex-wrap gap-1.5">
            {s.keyTTPs.map((t, i) => (
              <span key={i} className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-400 font-mono">{t}</span>
            ))}
          </div>
        </div>

        {/* Lessons learned */}
        {s.lessonsLearned?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Key Lessons Learned</p>
            <ol className="flex flex-col gap-3">
              {s.lessonsLearned.map((lesson, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-900 text-cyan-400 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-gray-300 text-sm leading-relaxed">{lesson}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Reference links */}
        {s.referenceLinks?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Reference Links</p>
            <ul className="flex flex-col gap-1.5">
              {s.referenceLinks.map((link, i) => (
                <li key={i}>
                  <a
                    href={link} target="_blank" rel="noopener noreferrer"
                    className="text-cyan-500 hover:text-cyan-300 text-sm underline underline-offset-2 break-all"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-200 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {exporting ? '⏳ Generating PDF…' : '📄 Export PDF Report'}
          </button>
          <button
            onClick={onPlayAgain}
            className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Play Another Scenario →
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 text-sm rounded-lg transition-colors"
          >
            ← Back
          </button>
        </div>

      </div>
    </div>
  )
}
