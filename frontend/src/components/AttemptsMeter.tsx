interface Props { remaining: number; max: number }

export function AttemptsMeter({ remaining, max }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 mr-1">Attempts</span>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < remaining
        const color  = remaining === 1 ? 'bg-red-500' : remaining === 2 ? 'bg-amber-500' : 'bg-emerald-500'
        return (
          <div key={i} className={`w-5 h-5 rounded flex items-center justify-center text-xs ${filled ? color : 'bg-gray-700 opacity-40'}`}>
            {filled ? '🛡' : '✗'}
          </div>
        )
      })}
    </div>
  )
}
