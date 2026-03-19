interface Props { phase: string; className?: string }

function phaseClass(phase: string): string {
  const p = phase.toLowerCase()
  if (p.includes('preparation'))   return 'phase-prep'
  if (p.includes('detection'))     return 'phase-detect'
  if (p.includes('eradication') || p.includes('recovery')) return 'phase-erad'
  if (p.includes('containment'))   return 'phase-contain'
  if (p.includes('post-incident') || p.includes('post incident')) return 'phase-post'
  return 'bg-gray-800 text-gray-300 border-gray-700'
}

export function IrPhaseBadge({ phase, className = '' }: Props) {
  const label = phase.includes('→') ? phase.split('→')[0].trim() : phase
  const shortened = label
    .replace('Containment, Eradication & Recovery', 'Contain + Erad')
    .replace('Detection & Analysis', 'Detection')
    .replace('Post-Incident Activity', 'Post-Incident')
  return (
    <span className={`inline-block border rounded px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase ${phaseClass(label)} ${className}`}>
      {shortened}
    </span>
  )
}
