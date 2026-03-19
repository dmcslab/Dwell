/**
 * RoleSelectPage.tsx
 * ------------------
 * Pre-game role lobby. All players pick a role before the IR Lead
 * can start the simulation. Shows who has picked what in real time.
 *
 * Rules:
 *  - IR Lead: only one allowed
 *  - Network / Endpoint: multiple players can share
 *  - Solo: single-player bypass (auto-selected when alone)
 *  - Begin is only enabled once the current player has a role
 *    AND the IR Lead slot is filled (or they ARE the IR Lead)
 */
import { useState } from 'react'
import { ROLE_DEFINITIONS, type PlayerRole, type GameState } from '../types/scenario'

const ROLE_COLOR: Record<PlayerRole, { card: string; badge: string; btn: string }> = {
  ir_lead:  {
    card: 'border-cyan-600   bg-cyan-950/40  hover:bg-cyan-950/70',
    badge: 'bg-cyan-800   text-cyan-200',
    btn:  'bg-cyan-700   hover:bg-cyan-600',
  },
  network:  {
    card: 'border-sky-600    bg-sky-950/40   hover:bg-sky-950/70',
    badge: 'bg-sky-800    text-sky-200',
    btn:  'bg-sky-700    hover:bg-sky-600',
  },
  endpoint: {
    card: 'border-violet-600 bg-violet-950/40 hover:bg-violet-950/70',
    badge: 'bg-violet-800 text-violet-200',
    btn:  'bg-violet-700 hover:bg-violet-600',
  },
  solo:     {
    card: 'border-gray-600   bg-gray-900     hover:bg-gray-800',
    badge: 'bg-gray-700   text-gray-300',
    btn:  'bg-gray-700   hover:bg-gray-600',
  },
}

interface Props {
  clientId:       string
  playerName:     string
  gameState:      GameState
  onPickRole:     (role: PlayerRole) => void
  onBegin:        () => void
  onWatchSession: () => void
  onBack:         () => void
}

export function RoleSelectPage({ clientId, playerName, gameState, onPickRole, onBegin, onWatchSession, onBack }: Props) {
  const myRole      = gameState.roles[clientId] as PlayerRole | undefined
  const irLeadTaken = Object.entries(gameState.roles).some(([cid, r]) => r === 'ir_lead' && cid !== clientId)
  const hasIrLead   = Object.values(gameState.roles).includes('ir_lead')
  const isMultiPlayer = Object.keys(gameState.roles).length > 1 ||
                        (gameState.participants ?? []).length > 1

  // Can begin: must have a role, and if multi-player, IR Lead must be assigned
  const canBegin = !!myRole && (!isMultiPlayer || hasIrLead || myRole === 'ir_lead')

  // Players who have picked roles (excluding self for display)
  const otherRoles = Object.entries(gameState.role_names)
    .filter(([cid]) => cid !== clientId)
    .map(([cid, name]) => ({ cid, name, role: gameState.roles[cid] as PlayerRole }))

  return (
    <div className="h-full overflow-y-auto bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm mb-6">
          ← Back
        </button>

        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
            Role Selection
          </p>
          <h1 className="text-white font-bold text-2xl">Choose your analyst role</h1>
          <p className="text-gray-400 text-sm mt-2">
            Each role sees different telemetry. The IR Lead makes the final call on every decision.
            {isMultiPlayer && (
              <span className="text-amber-400"> An IR Lead must be present to begin.</span>
            )}
          </p>
        </div>

        {/* Other players in lobby */}
        {otherRoles.length > 0 && (
          <div className="mb-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
              Players in lobby
            </p>
            <div className="flex flex-wrap gap-2">
              {otherRoles.map(({ cid, name, role }) => {
                const def  = ROLE_DEFINITIONS.find(r => r.id === role)
                const color = role ? ROLE_COLOR[role] : ROLE_COLOR.solo
                return (
                  <div key={cid} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
                    <span>{def?.icon ?? '👤'}</span>
                    <span className="text-gray-200 text-sm font-medium">{name}</span>
                    {role ? (
                      <span className={`text-xs rounded px-2 py-0.5 font-semibold ${color.badge}`}>
                        {def?.label ?? role}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 italic">choosing…</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {ROLE_DEFINITIONS.map(role => {
            const isSelected  = myRole === role.id
            const isDisabled  = role.id === 'ir_lead' && irLeadTaken
            const takenBy     = isDisabled
              ? otherRoles.find(p => p.role === 'ir_lead')?.name
              : null
            const color       = ROLE_COLOR[role.id]
            const otherPicked = otherRoles.filter(p => p.role === role.id)

            return (
              <button
                key={role.id}
                onClick={() => !isDisabled && onPickRole(role.id)}
                disabled={isDisabled}
                className={`relative flex flex-col text-left p-5 rounded-xl border-2 transition-all duration-200
                  ${isSelected
                    ? `${color.card} ring-2 ring-offset-2 ring-offset-gray-950 ring-current scale-[1.02]`
                    : isDisabled
                      ? 'border-gray-700 bg-gray-900 opacity-50 cursor-not-allowed'
                      : `${color.card} cursor-pointer`
                  }`}
              >
                {/* Selected badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.badge}`}>
                      You
                    </span>
                  </div>
                )}

                {/* Taken badge */}
                {takenBy && (
                  <div className="absolute top-3 right-3">
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                      {takenBy}
                    </span>
                  </div>
                )}

                <span className="text-3xl mb-3">{role.icon}</span>
                <p className="text-white font-bold text-base mb-1">{role.label}</p>
                <p className="text-gray-400 text-xs leading-relaxed mb-3">{role.description}</p>

                {/* SIEM sources */}
                <div className="flex flex-wrap gap-1 mt-auto">
                  {role.siemSources.length === 0 ? (
                    <span className="text-[10px] text-gray-500 font-mono">All sources</span>
                  ) : role.siemSources.map(s => (
                    <span key={s} className="text-[9px] font-mono bg-gray-800 text-gray-400 border border-gray-700 rounded px-1.5 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>

                {/* Other players who picked this role */}
                {otherPicked.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {otherPicked.map(p => (
                      <span key={p.cid} className="text-[9px] text-gray-400">
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Watch option */}
        <div className="text-center my-2">
          <button
            onClick={onWatchSession}
            className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
          >
            👁 Watch session without participating
          </button>
        </div>

        {/* My selection summary + begin */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              {myRole ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ROLE_DEFINITIONS.find(r => r.id === myRole)?.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {playerName} · {ROLE_DEFINITIONS.find(r => r.id === myRole)?.label}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {myRole === 'ir_lead'
                        ? 'You will submit all final decisions'
                        : 'You will suggest options — the IR Lead decides'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">Pick a role above to continue</p>
              )}
            </div>

            <button
              onClick={onBegin}
              disabled={!canBegin}
              className={`px-6 py-3 font-bold text-white rounded-xl text-sm transition-all
                ${canBegin
                  ? 'bg-cyan-700 hover:bg-cyan-600 hover:scale-105 active:scale-100'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
            >
              {!myRole
                ? 'Choose a role first'
                : !hasIrLead && isMultiPlayer
                  ? 'Waiting for IR Lead…'
                  : 'Begin Simulation →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
