import { useState } from 'react'

interface Props { sessionId: string; shareLink: string }

export function SharePanel({ sessionId, shareLink }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-2 font-mono font-semibold uppercase tracking-widest">INVITE TEAMMATES</p>
      <p className="text-xs text-gray-500 mb-3">Share this link so others can join and observe the session in real-time.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-cyan-400 truncate font-mono">
          {shareLink}
        </code>
        <button
          onClick={copy}
          className="shrink-0 px-3 py-1.5 bg-cyan-800 hover:bg-cyan-700 border border-cyan-700 text-white text-xs rounded-lg transition-all font-mono"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[10px] text-gray-600 mt-2">Session ID: {sessionId}</p>
    </div>
  )
}
