interface Props { phase: string; className?: string }

const COLORS: Record<string, string> = {
  'Preparation':                  'bg-violet-900 text-violet-200 border-violet-700',
  'Detection & Analysis':         'bg-sky-900 text-sky-200 border-sky-700',
  'Containment':                  'bg-amber-900 text-amber-200 border-amber-700',
  'Containment, Eradication & Recovery': 'bg-orange-900 text-orange-200 border-orange-700',
  'Eradication & Recovery':       'bg-orange-900 text-orange-200 border-orange-700',
  'Post-Incident Activity':       'bg-emerald-900 text-emerald-200 border-emerald-700',
}

function matchPhase(phase: string): string {
  for (const [key, cls] of Object.entries(COLORS)) {
    if (phase.toLowerCase().includes(key.toLowerCase())) return cls
  }
  return 'bg-gray-800 text-gray-300 border-gray-600'
}

export function IrPhaseBadge({ phase, className = '' }: Props) {
  const label = phase.includes('→') ? phase.split('→')[0].trim() : phase
  return (
    <span className={`inline-block border rounded px-2 py-0.5 text-xs font-mono font-semibold tracking-wide ${matchPhase(label)} ${className}`}>
      {phase}
    </span>
  )
}
