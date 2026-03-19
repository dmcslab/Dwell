interface Props { remaining: number; max: number }

export function AttemptsMeter({ remaining, max }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 font-mono mr-0.5 tracking-wider">LIVES</span>
      {Array.from({ length: max }, (_, i) => {
        const alive = i < remaining
        const color = remaining === 1 ? '#ef4444' : remaining === 2 ? '#f59e0b' : '#22d3ee'
        return (
          <div
            key={i}
            className="w-4 h-4 rounded flex items-center justify-center text-[9px] transition-all duration-300"
            style={{
              background: alive ? `${color}22` : 'transparent',
              border: `1px solid ${alive ? color : '#374151'}`,
              boxShadow: alive ? `0 0 6px 0 ${color}55` : 'none',
              color: alive ? color : '#374151',
            }}
          >
            {alive ? '◆' : '◇'}
          </div>
        )
      })}
    </div>
  )
}
