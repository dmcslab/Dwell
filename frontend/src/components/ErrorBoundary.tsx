import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: (err: Error) => ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return this.props.fallback ? this.props.fallback(error) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <div className="bg-red-950 border border-red-800 rounded-xl p-5 max-w-lg w-full">
            <p className="text-red-300 font-bold mb-2">⚠ Render Error (check console)</p>
            <p className="text-red-400 text-xs font-mono break-all">{error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-3 px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 text-xs rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
