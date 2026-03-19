/**
 * ScenarioBuilder.tsx
 * -------------------
 * Guided 4-step scenario builder for non-technical trainers.
 * No raw JSON required.
 *
 * Step 1 — Metadata: name, description, difficulty, max attempts, ransomware family,
 *           attack vector, simulation context, initial prompt, key TTPs, IR phase
 * Step 2 — Stages: add/reorder decision stages with IR phase and prompts
 * Step 3 — Options: per-stage answer options with correctness, consequence,
 *           technical explanation, next stage routing, and optional branch stage
 * Step 4 — Review: rendered JSON preview + save
 */
import { useState } from 'react'
import { scenariosApi } from '../api/scenarios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftOption {
  id:                   string
  actionText:           string
  isCorrect:            boolean
  consequence:          string
  technicalExplanation: string
  nextStageId:          string   // '' = end of scenario
  failBranchStageId:    string   // '' = no branch
}

interface DraftStage {
  id:              string   // internal builder ID
  stageId:         string   // the actual stageId used in game logic
  irPhase:         string
  prompt:          string
  analystContext:  string
  networkContext:  string
  endpointContext: string
  irLeadContext:   string
  options:         DraftOption[]
}

interface DraftMeta {
  name:              string
  description:       string
  difficulty:        'easy' | 'medium' | 'hard'
  maxAttempts:       number
  ransomwareFamily:  string
  irPhase:           string
  attackVector:      string
  simulationContext: string
  initialPrompt:     string
  keyTTPs:           string   // newline-separated
  lessonsLearned:    string   // newline-separated
}

const IR_PHASES = [
  'Preparation',
  'Detection & Analysis',
  'Containment',
  'Eradication & Recovery',
  'Post-Incident Activity',
]

const uid = () => Math.random().toString(36).slice(2, 8)

const blankOption = (): DraftOption => ({
  id: uid(), actionText: '', isCorrect: false,
  consequence: '', technicalExplanation: '', nextStageId: '', failBranchStageId: '',
})

const blankStage = (index: number): DraftStage => ({
  id: uid(), stageId: `stage_${index + 1}`,
  irPhase: 'Detection & Analysis', prompt: '',
  analystContext: '', networkContext: '', endpointContext: '', irLeadContext: '',
  options: [blankOption(), blankOption()],
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'op-input w-full'
const textareaCls = `${inputCls} resize-y font-mono text-xs`

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">{children}</p>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>
}

// ── Step 1: Metadata ──────────────────────────────────────────────────────────

function StepMeta({ meta, onChange }: { meta: DraftMeta; onChange: (m: DraftMeta) => void }) {
  const set = (k: keyof DraftMeta, v: string | number) => onChange({ ...meta, [k]: v })
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Scenario name">
          <input value={meta.name} onChange={e => set('name', e.target.value)}
            placeholder="Operation: Encrypted Inbox" className={inputCls} />
        </Field>
        <Field label="Difficulty">
          <select value={meta.difficulty} onChange={e => set('difficulty', e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </Field>
      </div>

      <Field label="Short description">
        <input value={meta.description} onChange={e => set('description', e.target.value)}
          placeholder="One-line summary for the scenario card" className={inputCls} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ransomware / threat family">
          <input value={meta.ransomwareFamily} onChange={e => set('ransomwareFamily', e.target.value)}
            placeholder="LockBit 3.0" className={inputCls} />
        </Field>
        <Field label="Primary IR phase">
          <select value={meta.irPhase} onChange={e => set('irPhase', e.target.value)} className={inputCls + ' cursor-pointer'}>
            {IR_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Attack vector">
        <input value={meta.attackVector} onChange={e => set('attackVector', e.target.value)}
          placeholder="Phishing email → macro → Cobalt Strike beacon" className={inputCls} />
      </Field>

      <Field label="Simulation context (org / environment)">
        <textarea value={meta.simulationContext} onChange={e => set('simulationContext', e.target.value)}
          rows={2} placeholder="Financial services firm, 800 endpoints, EDR deployed…" className={textareaCls} />
      </Field>

      <Field label="Key TTPs — MITRE ATT&CK (one per line)">
        <textarea value={meta.keyTTPs} onChange={e => set('keyTTPs', e.target.value)}
          rows={4} placeholder={"T1566.001 — Spearphishing Attachment\nT1059.001 — PowerShell\nT1486 — Data Encrypted for Impact"}
          className={textareaCls} />
      </Field>

      <Field label="Initial prompt (shown to players at briefing)">
        <textarea value={meta.initialPrompt} onChange={e => set('initialPrompt', e.target.value)}
          rows={5} placeholder="You receive an alert at 02:14…" className={textareaCls} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Max attempts per stage">
          <input type="number" min={1} max={10} value={meta.maxAttempts}
            onChange={e => set('maxAttempts', Number(e.target.value))} className={inputCls} />
        </Field>
      </div>

      <Field label="Lessons learned (one per line)">
        <textarea value={meta.lessonsLearned} onChange={e => set('lessonsLearned', e.target.value)}
          rows={4} placeholder={"Always isolate affected systems before…\nBackups must be tested quarterly…"}
          className={textareaCls} />
      </Field>
    </div>
  )
}

// ── Step 2: Stages ────────────────────────────────────────────────────────────

function StepStages({ stages, onChange }: { stages: DraftStage[]; onChange: (s: DraftStage[]) => void }) {
  const update = (id: string, patch: Partial<DraftStage>) =>
    onChange(stages.map(s => s.id === id ? { ...s, ...patch } : s))

  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...stages]
    const swp = arr[idx + dir]; arr[idx + dir] = arr[idx]; arr[idx] = swp
    onChange(arr)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500">
        Define each decision point. Stages run in order unless a branch option redirects players.
        The stage ID is used internally for routing — keep it short and unique.
      </p>

      {stages.map((stage, idx) => (
        <div key={stage.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500 font-mono font-bold">STAGE {idx + 1}</span>
            <div className="flex gap-1">
              <button disabled={idx === 0} onClick={() => move(idx, -1)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-white disabled:opacity-30 border border-gray-700 rounded">↑</button>
              <button disabled={idx === stages.length - 1} onClick={() => move(idx, 1)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-white disabled:opacity-30 border border-gray-700 rounded">↓</button>
              <button onClick={() => onChange(stages.filter(s => s.id !== stage.id))}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-400 border border-gray-700 hover:border-red-700 rounded">✕</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage ID">
              <input value={stage.stageId} onChange={e => update(stage.id, { stageId: e.target.value })}
                placeholder="stage_1" className={inputCls} />
            </Field>
            <Field label="IR Phase">
              <select value={stage.irPhase} onChange={e => update(stage.id, { irPhase: e.target.value })}
                className={inputCls + ' cursor-pointer'}>
                {IR_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Stage prompt (the question / situation presented to players)">
            <textarea value={stage.prompt} onChange={e => update(stage.id, { prompt: e.target.value })}
              rows={3} placeholder="The IR team has isolated the affected host. SIEM shows lateral movement indicators to 3 other machines. What do you do next?"
              className={textareaCls} />
          </Field>

          <Field label="Analyst context (all roles see this)">
            <textarea value={stage.analystContext} onChange={e => update(stage.id, { analystContext: e.target.value })}
              rows={2} placeholder="SIEM logs show…" className={textareaCls} />
          </Field>

          <details className="group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none">
              Role-specific context overrides (optional) ▸
            </summary>
            <div className="flex flex-col gap-2 mt-2">
              {(['networkContext', 'endpointContext', 'irLeadContext'] as const).map(field => (
                <Field key={field} label={field.replace('Context', ' context')}>
                  <input value={stage[field]} onChange={e => update(stage.id, { [field]: e.target.value })}
                    placeholder="Additional context shown only to this role…" className={inputCls} />
                </Field>
              ))}
            </div>
          </details>
        </div>
      ))}

      <button onClick={() => onChange([...stages, blankStage(stages.length)])}
        className="w-full py-2.5 border border-dashed border-gray-700 hover:border-cyan-700 text-gray-500 hover:text-cyan-400 text-sm rounded-xl transition-colors">
        + Add Stage
      </button>
    </div>
  )
}

// ── Step 3: Options ───────────────────────────────────────────────────────────

function OptionCard({
  opt, index, stages, stageId, onChange, onDelete,
}: {
  opt: DraftOption; index: number; stages: DraftStage[]
  stageId: string; onChange: (o: DraftOption) => void; onDelete: () => void
}) {
  const set = (k: keyof DraftOption, v: string | boolean) => onChange({ ...opt, [k]: v })
  const otherStages = stages.filter(s => s.stageId !== stageId)

  return (
    <div className={`rounded-lg border p-4 flex flex-col gap-3 ${
      opt.isCorrect ? 'border-emerald-800 bg-emerald-950/20' : 'border-gray-700 bg-gray-800/50'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-mono">Option {String.fromCharCode(65 + index)}</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={opt.isCorrect} onChange={e => set('isCorrect', e.target.checked)}
              className="w-4 h-4 accent-emerald-600" />
            <span className={`text-xs font-semibold ${opt.isCorrect ? 'text-emerald-400' : 'text-gray-500'}`}>
              {opt.isCorrect ? '✓ Correct answer' : 'Wrong answer'}
            </span>
          </label>
        </div>
        <button onClick={onDelete} className="text-xs text-red-700 hover:text-red-400">✕</button>
      </div>

      <Field label="Action text (what the player clicks)">
        <input value={opt.actionText} onChange={e => set('actionText', e.target.value)}
          placeholder="Isolate the affected host immediately" className={inputCls} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="On correct — go to stage">
          <select value={opt.nextStageId} onChange={e => set('nextStageId', e.target.value)}
            className={inputCls + ' cursor-pointer'}>
            <option value="">— End of scenario (complete) —</option>
            {otherStages.map(s => (
              <option key={s.stageId} value={s.stageId}>{s.stageId}</option>
            ))}
          </select>
        </Field>
        {!opt.isCorrect && (
          <Field label="⚡ Wrong → branch to stage (optional)">
            <select value={opt.failBranchStageId} onChange={e => set('failBranchStageId', e.target.value)}
              className={inputCls + ' cursor-pointer'}>
              <option value="">— No branch (decrement attempts) —</option>
              {otherStages.map(s => (
                <option key={s.stageId} value={s.stageId}>{s.stageId}</option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="Consequence (shown after the decision)">
        <textarea value={opt.consequence} onChange={e => set('consequence', e.target.value)}
          rows={2} placeholder="The threat actor detected the isolation and triggered the payload…" className={textareaCls} />
      </Field>

      <Field label="Technical explanation">
        <textarea value={opt.technicalExplanation} onChange={e => set('technicalExplanation', e.target.value)}
          rows={2} placeholder="In a ransomware scenario, waiting to confirm before isolating gives the threat actor time to…" className={textareaCls} />
      </Field>
    </div>
  )
}

function StepOptions({ stages, onChange }: { stages: DraftStage[]; onChange: (s: DraftStage[]) => void }) {
  const [activeStage, setActiveStage] = useState(stages[0]?.id ?? '')

  const updateStage = (id: string, patch: Partial<DraftStage>) =>
    onChange(stages.map(s => s.id === id ? { ...s, ...patch } : s))

  const updateOption = (stageId: string, optId: string, patch: Partial<DraftOption>) =>
    updateStage(stageId, {
      options: stages.find(s => s.id === stageId)!.options.map(o => o.id === optId ? { ...o, ...patch } : o),
    })

  const deleteOption = (stageId: string, optId: string) =>
    updateStage(stageId, {
      options: stages.find(s => s.id === stageId)!.options.filter(o => o.id !== optId),
    })

  const stage = stages.find(s => s.id === activeStage)

  return (
    <div className="flex gap-4">
      {/* Stage selector sidebar */}
      <div className="w-44 shrink-0 flex flex-col gap-1">
        {stages.map((s, idx) => (
          <button key={s.id} onClick={() => setActiveStage(s.id)}
            className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${
              activeStage === s.id
                ? 'bg-cyan-900 text-cyan-300 border border-cyan-700'
                : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
            }`}>
            <span className="text-gray-600 font-mono text-[10px]">{idx + 1}. </span>
            {s.stageId}
            <div className="text-[10px] text-gray-600 mt-0.5">{s.options.length} options</div>
          </button>
        ))}
      </div>

      {/* Options editor */}
      {stage && (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-xs text-gray-500 font-mono">{stage.stageId}</p>
              <p className="text-sm text-gray-300 font-semibold">{stage.prompt.slice(0, 80) || '(no prompt yet)'}</p>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              stage.options.some(o => o.isCorrect)
                ? 'text-emerald-400 border-emerald-800 bg-emerald-950/30'
                : 'text-amber-400 border-amber-800 bg-amber-950/30'
            }`}>
              {stage.options.filter(o => o.isCorrect).length} correct
            </span>
          </div>

          {stage.options.map((opt, idx) => (
            <OptionCard
              key={opt.id} opt={opt} index={idx}
              stages={stages} stageId={stage.stageId}
              onChange={o => updateOption(stage.id, opt.id, o)}
              onDelete={() => deleteOption(stage.id, opt.id)}
            />
          ))}

          <button onClick={() => updateStage(stage.id, { options: [...stage.options, blankOption()] })}
            className="w-full py-2 border border-dashed border-gray-700 hover:border-cyan-700 text-gray-500 hover:text-cyan-400 text-xs rounded-lg transition-colors">
            + Add Option
          </button>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Review ────────────────────────────────────────────────────────────

function buildScenarioPayload(meta: DraftMeta, stages: DraftStage[]) {
  return {
    name:              meta.name.trim(),
    description:       meta.description.trim(),
    initial_prompt:    meta.initialPrompt.trim(),
    difficulty_level:  meta.difficulty,
    max_attempts:      meta.maxAttempts,
    scenario_structure: {
      ransomwareFamily:  meta.ransomwareFamily.trim(),
      irPhase:           meta.irPhase,
      attackVector:      meta.attackVector.trim(),
      simulationContext: meta.simulationContext.trim(),
      keyTTPs:           meta.keyTTPs.split('\n').map(t => t.trim()).filter(Boolean),
      lessonsLearned:    meta.lessonsLearned.split('\n').map(t => t.trim()).filter(Boolean),
      referenceLinks:    [],
      decisionTree:      stages.map(s => ({
        stageId:         s.stageId,
        irPhase:         s.irPhase,
        prompt:          s.prompt,
        analystContext:  s.analystContext,
        ...(s.networkContext  ? { networkContext:  s.networkContext  } : {}),
        ...(s.endpointContext ? { endpointContext: s.endpointContext } : {}),
        ...(s.irLeadContext   ? { irLeadContext:   s.irLeadContext   } : {}),
        options: s.options.map(o => ({
          actionText:           o.actionText,
          isCorrect:            o.isCorrect,
          consequence:          o.consequence,
          technicalExplanation: o.technicalExplanation,
          nextStageId:          o.nextStageId || null,
          ...((!o.isCorrect && o.failBranchStageId) ? { failBranchStageId: o.failBranchStageId } : {}),
        })),
      })),
    },
  }
}

function validate(meta: DraftMeta, stages: DraftStage[]): string[] {
  const errors: string[] = []
  if (!meta.name.trim())         errors.push('Scenario name is required')
  if (!meta.initialPrompt.trim()) errors.push('Initial prompt is required')
  if (!meta.ransomwareFamily.trim()) errors.push('Ransomware / threat family is required')
  if (stages.length === 0)       errors.push('At least one stage is required')
  stages.forEach((s, i) => {
    if (!s.stageId.trim())  errors.push(`Stage ${i+1}: Stage ID is required`)
    if (!s.prompt.trim())   errors.push(`Stage ${i+1}: Prompt is required`)
    if (s.options.length < 2) errors.push(`Stage ${i+1}: At least 2 options required`)
    if (!s.options.some(o => o.isCorrect)) errors.push(`Stage ${i+1}: Must have at least one correct option`)
    s.options.forEach((o, j) => {
      if (!o.actionText.trim()) errors.push(`Stage ${i+1} Option ${String.fromCharCode(65+j)}: Action text required`)
      if (!o.consequence.trim()) errors.push(`Stage ${i+1} Option ${String.fromCharCode(65+j)}: Consequence required`)
    })
  })
  return errors
}

function StepReview({ meta, stages, onSave }: {
  meta: DraftMeta; stages: DraftStage[]
  onSave: () => void
}) {
  const errors  = validate(meta, stages)
  const payload = buildScenarioPayload(meta, stages)

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4">
          <p className="text-red-300 font-semibold text-sm mb-2">Fix these before saving:</p>
          <ul className="flex flex-col gap-1">
            {errors.map((e, i) => <li key={i} className="text-red-400 text-xs">• {e}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Summary</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Name:</span> <span className="text-white">{meta.name || '—'}</span></div>
          <div><span className="text-gray-500">Difficulty:</span> <span className="text-white capitalize">{meta.difficulty}</span></div>
          <div><span className="text-gray-500">Stages:</span> <span className="text-white">{stages.length}</span></div>
          <div><span className="text-gray-500">Max attempts:</span> <span className="text-white">{meta.maxAttempts}</span></div>
          <div><span className="text-gray-500">Branch options:</span> <span className="text-amber-400">{
            stages.reduce((n, s) => n + s.options.filter(o => o.failBranchStageId).length, 0)
          }</span></div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">JSON Preview</p>
        <pre className="text-[10px] text-gray-400 font-mono overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>

      <button
        onClick={onSave}
        disabled={errors.length > 0}
        className="btn-accent w-full py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save Scenario →
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const STEPS = ['Metadata', 'Stages', 'Options', 'Review & Save']

interface Props {
  onSaved: () => void
  onCancel: () => void
}

export function ScenarioBuilder({ onSaved, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [meta, setMeta] = useState<DraftMeta>({
    name: '', description: '', difficulty: 'medium', maxAttempts: 3,
    ransomwareFamily: '', irPhase: 'Detection & Analysis',
    attackVector: '', simulationContext: '', initialPrompt: '',
    keyTTPs: '', lessonsLearned: '',
  })

  const [stages, setStages] = useState<DraftStage[]>([blankStage(0)])

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    try {
      const payload = buildScenarioPayload(meta, stages)
      await scenariosApi.create(payload)
      onSaved()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-[0_0_60px_-10px_rgb(0_0_0/0.9)] animate-enter">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-display font-bold text-base tracking-wider">SCENARIO BUILDER</h2>
            <p className="text-gray-500 text-xs mt-0.5 font-mono">Build a scenario step by step — no JSON required</p>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-xl">✕</button>
        </div>

        {/* Step bar */}
        <div className="flex border-b border-gray-800 px-6">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i < step + 1 && setStep(i)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
                i === step
                  ? 'border-cyan-500 text-cyan-400'
                  : i < step
                    ? 'border-gray-700 text-gray-400 hover:text-gray-200 cursor-pointer'
                    : 'border-transparent text-gray-600 cursor-default'
              }`}>
              <span className={`mr-1.5 ${i < step ? 'text-emerald-500' : i === step ? 'text-cyan-400' : 'text-gray-700'}`}>
                {i < step ? '✓' : i + 1}.
              </span>
              {s}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 0 && <StepMeta meta={meta} onChange={setMeta} />}
          {step === 1 && <StepStages stages={stages} onChange={setStages} />}
          {step === 2 && <StepOptions stages={stages} onChange={setStages} />}
          {step === 3 && <StepReview meta={meta} stages={stages}
            onSave={async () => { setSaving(true); await handleSave() }} />}

          {saveError && (
            <div className="mt-4 bg-red-950 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{saveError}</div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <button
            onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)}
            className="px-4 py-2 border border-gray-700 hover:border-gray-600 rounded-xl text-gray-400 hover:text-white text-sm transition-all font-ui"
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 && (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && stages.length === 0}
              className="btn-accent px-5 py-2 rounded-xl disabled:opacity-40"
            >
              Next →
            </button>
          )}
          {step === 3 && (
            <button onClick={handleSave} disabled={saving || validate(meta, stages).length > 0}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 border border-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all font-ui">
              {saving ? 'Saving…' : 'Save Scenario'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
