/**
 * AttemptsMeter.tsx
 * -----------------
 * Three visual states that escalate with urgency:
 *   comfortable (full)  → cyan, small, calm
 *   caution (1 left)    → amber, medium
 *   danger (1 left)     → red, pulsing glow + FINAL ATTEMPT label
 */
interface Props { remaining: number; max: number }

export function AttemptsMeter({ remaining, max }: Props) {
  const isFinal   = remaining === 1
  const isCaution = remaining === 2

  const activeColor = isFinal   ? '#ef4444'   // red
                    : isCaution ? '#f59e0b'   // amber
                    :             '#22d3ee'   // cyan

  const glowColor = isFinal   ? '#ef444455'
                  : isCaution ? '#f59e0b33'
                  :             '#22d3ee33'

  const dotSize = isFinal   ? 'w-5 h-5'
                : isCaution ? 'w-4 h-4'
                :             'w-3.5 h-3.5'

  return (
    <div className={`flex flex-col items-end gap-1 transition-all duration-300 ${isFinal ? 'animate-pulse' : ''}`}>

      {/* FINAL ATTEMPT label — only on last attempt */}
      {isFinal && (
        <span className="text-[11px] font-mono font-bold tracking-widest text-red-400 uppercase animate-pulse">
          ⚠ Final Attempt
        </span>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-500 font-mono tracking-widest mr-0.5">
          {isFinal ? '' : isCaution ? 'CAUTION' : 'LIVES'}
        </span>

        {Array.from({ length: max }, (_, i) => {
          const alive = i < remaining

          return (
            <div
              key={i}
              className={`${dotSize} rounded flex items-center justify-center transition-all duration-300`}
              style={{
                background: alive ? `${activeColor}22` : 'transparent',
                border:     `1.5px solid ${alive ? activeColor : '#374151'}`,
                boxShadow:  alive ? `0 0 8px 0 ${glowColor}` : 'none',
                color:      alive ? activeColor : '#374151',
                fontSize:   isFinal ? '13px' : isCaution ? '11px' : '10px',
              }}
            >
              {alive ? '◆' : '◇'}
            </div>
          )
        })}
      </div>

    </div>
  )
}
