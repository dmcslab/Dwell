/**
 * DwellLogo — App brand mark (Option C: Signal/ECG)
 * ECG waveform icon + DWELL wordmark
 * D in alert red (the incident), WELL in white (the response)
 * Adapts to dark/light theme via CSS variables
 */

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

export function DwellLogo({ size = 'md' }: Props) {
  const s = size === 'sm' ? 0.70 : size === 'lg' ? 1.45 : 1

  const iconW   = Math.round(88 * s)
  const iconH   = Math.round(40 * s)
  const fsD     = Math.round(22 * s)
  const fsWell  = Math.round(22 * s)
  const gap     = Math.round(10 * s)

  // ECG path: flat → P wave → QRS spike → T wave → flatline
  // Viewbox 88×40, midline at y=20
  const ecgPath = `
    M2,20 L14,20
    Q17,15 20,20
    L23,20 L25,23
    L28,4 L31,28
    L33,20
    Q38,13 43,20
    L86,20
  `.trim().replace(/\s+/g, ' ')

  // The spike segment (QRS) highlighted separately in red
  const spikePath = `M25,23 L28,4 L31,28 L33,20`.trim()

  return (
    <div
      className="flex items-center select-none"
      style={{ gap }}
    >
      {/* ── ECG icon ── */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 88 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Baseline */}
        <line x1="2" y1="20" x2="86" y2="20"
          stroke="rgb(var(--g700))" strokeWidth="0.8"/>

        {/* Flatline / P / T in teal */}
        <polyline
          points="2,20 14,20"
          stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round"/>
        {/* P wave */}
        <path d="M14,20 Q17,14 20,20"
          fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round"/>
        {/* PR segment */}
        <line x1="20" y1="20" x2="25" y2="20"
          stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round"/>
        {/* Q dip */}
        <line x1="25" y1="20" x2="27" y2="24"
          stroke="#f87171" strokeWidth="2.2" strokeLinecap="round"/>
        {/* R spike */}
        <line x1="27" y1="24" x2="30" y2="2"
          stroke="#f87171" strokeWidth="2.4" strokeLinecap="round"/>
        {/* R down */}
        <line x1="30" y1="2" x2="33" y2="30"
          stroke="#f87171" strokeWidth="2.2" strokeLinecap="round"/>
        {/* S recovery */}
        <line x1="33" y1="30" x2="35" y2="20"
          stroke="#f87171" strokeWidth="2" strokeLinecap="round"/>
        {/* T wave */}
        <path d="M35,20 Q40,12 45,20"
          fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round"/>
        {/* Flatline — dwell phase */}
        <line x1="45" y1="20" x2="86" y2="20"
          stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round"/>

        {/* Dwell bracket over flatline */}
        {size !== 'sm' && (
          <>
            <polyline
              points="45,11 45,13 86,13 86,11"
              fill="none" stroke="rgb(var(--accent))"
              strokeWidth="1.2" strokeLinecap="round"/>
          </>
        )}
      </svg>

      {/* ── Wordmark ── */}
      <div style={{ lineHeight: 1, display: 'flex', alignItems: 'baseline' }}>
        {/* D — red, the incident */}
        <span
          className="font-display"
          style={{ fontSize: fsD, fontWeight: 700, color: '#f87171', letterSpacing: '-0.02em' }}
        >
          D
        </span>
        {/* WELL — white/dark, the response */}
        <span
          className="font-display"
          style={{ fontSize: fsWell, fontWeight: 700,
                   color: 'rgb(var(--gwhite))', letterSpacing: '-0.03em' }}
        >
          WELL
        </span>
      </div>
    </div>
  )
}
