/**
 * dMCSlab logo component
 * Hex-bracket icon + three-weight wordmark
 * No tagline — domain-agnostic, works across all project types
 * Uses CSS variables so it adapts to dark/light theme automatically
 */

interface Props {
  size?: 'sm' | 'md' | 'lg'
  /** Override for contexts where CSS variables aren't available */
  accentColor?: string
  textColor?: string
  mutedColor?: string
}

export function DmcslabLogo({
  size = 'md',
  accentColor = 'rgb(var(--accent))',
  textColor   = 'rgb(var(--gwhite))',
  mutedColor  = 'rgb(var(--g500))',
}: Props) {
  const s = size === 'sm' ? 0.72 : size === 'lg' ? 1.5 : 1

  const iconW  = Math.round(36 * s)
  const iconH  = Math.round(40 * s)
  const fs_d   = Math.round(20 * s)
  const fs_mcs = Math.round(20 * s)
  const fs_lab = Math.round(16 * s)
  const gap    = Math.round(10 * s)

  return (
    <div
      className="flex items-center select-none"
      style={{ gap }}
    >
      {/* ── Hex-bracket icon mark ── */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 36 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Flat-top hexagon */}
        <path
          d="M18 1L34 10V30C34 35 27 39 18 40C9 39 2 35 2 30V10L18 1Z"
          fill="rgb(var(--g900, 24 33 54))"
          stroke={accentColor}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Left bracket < */}
        <path
          d="M13 13L7 20L13 27"
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
        {/* Right bracket > */}
        <path
          d="M23 13L29 20L23 27"
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
        {/* d letterform — vertical stem */}
        <rect
          x="15"
          y="12"
          width="3"
          height="16"
          rx="1.5"
          fill={accentColor}
        />
        {/* d letterform — bowl arc */}
        <path
          d="M18 12 Q26 12 26 20 Q26 28 18 28"
          fill="none"
          stroke={accentColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {/* ── Wordmark ── */}
      <div style={{ lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 0 }}>
        {/* d — accent, regular weight */}
        <span
          className="font-ui"
          style={{
            fontSize:   fs_d,
            fontWeight: 400,
            color:      accentColor,
            letterSpacing: '-0.01em',
          }}
        >
          d
        </span>
        {/* MCS — bold, white */}
        <span
          className="font-display"
          style={{
            fontSize:   fs_mcs,
            fontWeight: 700,
            color:      textColor,
            letterSpacing: '-0.03em',
          }}
        >
          MCS
        </span>
        {/* lab — light, muted, slightly smaller */}
        <span
          className="font-ui"
          style={{
            fontSize:   fs_lab,
            fontWeight: 300,
            color:      mutedColor,
            letterSpacing: '0.02em',
            marginLeft: Math.round(2 * s),
          }}
        >
          lab
        </span>
      </div>
    </div>
  )
}
