import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent, ReactNode } from 'react'
import './App.css'
import { checkHealth, runAnalysis, sendChat, uploadDataset } from './api'
import type {
  ActionId,
  AnalysisResult,
  ChatMessage,
  ConnectedModel,
  DatasetSummary,
  DRTSettings,
  SignConvention,
} from './types'
import { DEFAULT_SETTINGS, MOCK_MODEL_ID } from './types'
import { formatNumber } from './format'
import { actionById, planRuns, stepLabel } from './agent/actions'
import {
  loadActiveModelId,
  loadModels,
  saveActiveModelId,
  saveModels,
} from './store/models'
import { DatasetCard } from './components/DatasetCard'
import { AnalysisSummary } from './components/AnalysisSummary'
import { ActionProposalCard } from './components/ActionProposalCard'
import { AdvancedPanel } from './components/AdvancedPanel'
import { Sidebar } from './components/Sidebar'
import { ArtifactPanel } from './components/ArtifactPanel'
import { ModelConnectModal } from './components/ModelConnectModal'
import { ModelSelector } from './components/ModelSelector'
import { Logo, IconUpload, IconPlus, IconSend, IconCheck, IconMenu } from './components/icons'

let seq = 0
const uid = () => `t${++seq}`

type Turn =
  | { id: string; role: 'user' | 'assistant'; kind: 'text'; content: string; suggestions?: string[]; modelLabel?: string }
  | { id: string; role: 'assistant'; kind: 'dataset' }
  | { id: string; role: 'assistant'; kind: 'proposal'; offer?: ActionId[]; recommended: ActionId[]; title?: string; intro?: string }
  | { id: string; role: 'assistant'; kind: 'step'; label: string }
  | { id: string; role: 'assistant'; kind: 'analysis'; analysisId: string; label: string }
  | { id: string; role: 'assistant'; kind: 'error'; content: string }

type StoredAnalysis = { analysis: AnalysisResult; label: string }

type Session = {
  id: string
  title: string
  turns: Turn[]
  dataset: DatasetSummary | null
  signConvention: SignConvention
  settings: DRTSettings
  analyses: Record<string, StoredAnalysis>
  activeAnalysisId: string | null
  consumed: string[]
}

const GREETING =
  "Hi — I'm DRT Co-Pilot. Drop an EIS spectrum (.csv or .npy) and I'll check the format, then propose a few DRT analyses you can approve and run. I'll explain everything in plain language — no EIS theory needed to start."

const STARTERS = ['What does lambda do?', 'Is column 3 Z″ or −Z″?', 'Explain DRT like I am new to EIS']

function newSession(): Session {
  return {
    id: uid(),
    title: 'New analysis',
    turns: [{ id: uid(), role: 'assistant', kind: 'text', content: GREETING }],
    dataset: null,
    signConvention: 'neg_z_imag',
    settings: { ...DEFAULT_SETTINGS },
    analyses: {},
    activeAnalysisId: null,
    consumed: [],
  }
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([newSession()])
  const [activeId, setActiveId] = useState<string>(() => sessions[0].id)
  const session = sessions.find((s) => s.id === activeId) ?? sessions[0]

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<null | 'upload' | 'run' | 'chat'>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)

  const [models, setModels] = useState<ConnectedModel[]>(() => loadModels())
  const [activeModelId, setActiveModelId] = useState<string>(() => loadActiveModelId() ?? MOCK_MODEL_ID)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeModel = models.find((m) => m.id === activeModelId) ?? null
  const activeModelLabel = activeModel ? activeModel.label : 'Demo assistant'

  useEffect(() => {
    void checkHealth().then(setOnline)
  }, [])
  useEffect(() => saveModels(models), [models])
  useEffect(() => saveActiveModelId(activeModelId), [activeModelId])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [session.turns, busy])

  // ---- session mutation helpers (busy guard prevents concurrent writers) ----
  const patch = (sid: string, fn: (s: Session) => Session) =>
    setSessions((prev) => prev.map((s) => (s.id === sid ? fn(s) : s)))
  const pushTurns = (sid: string, turns: Turn[]) =>
    patch(sid, (s) => ({ ...s, turns: [...s.turns, ...turns] }))

  function chatHistory(s: Session): ChatMessage[] {
    return s.turns
      .filter((t): t is Extract<Turn, { kind: 'text' }> => t.kind === 'text')
      .map((t) => ({ role: t.role, content: t.content }))
  }

  // ---------------- upload ----------------
  async function handleUpload(file: File) {
    if (busy) return
    const sid = activeId
    setBusy('upload')
    pushTurns(sid, [{ id: uid(), role: 'user', kind: 'text', content: `Uploaded ${file.name}` }])
    try {
      const ds = await uploadDataset(file)
      const guess = ds.sign_convention_guess === 'neg_z_imag' ? '−Z″' : 'Z″'
      patch(sid, (s) => ({
        ...s,
        title: file.name,
        dataset: ds,
        signConvention: ds.sign_convention_guess,
        analyses: {},
        activeAnalysisId: null,
        turns: [
          ...s.turns,
          { id: uid(), role: 'assistant', kind: 'step', label: 'Validated CSV' },
          { id: uid(), role: 'assistant', kind: 'dataset' },
          {
            id: uid(),
            role: 'assistant',
            kind: 'text',
            content:
              `I read ${ds.rows} rows spanning ${fmtRange(ds)}. Column 3 looks like ${guess}, selected below — ` +
              `switch it if that's wrong. Here's what I'd run next; pick the checks you want and I'll ask before computing.`,
          },
          {
            id: uid(),
            role: 'assistant',
            kind: 'proposal',
            recommended: ['run_simple_drt', 'compare_regularization_orders'],
          },
        ],
      }))
    } catch (err) {
      pushTurns(sid, [{ id: uid(), role: 'assistant', kind: 'error', content: message(err) }])
    } finally {
      setBusy(null)
    }
  }

  // ---------------- agentic execution ----------------
  async function runActions(proposalId: string, selected: ActionId[]) {
    if (busy || selected.length === 0) return
    const sid = activeId
    const s0 = sessions.find((s) => s.id === sid)
    if (!s0?.dataset) return
    const dataset = s0.dataset
    const sign = s0.signConvention
    const baseSettings = s0.settings

    setBusy('run')
    patch(sid, (s) => ({ ...s, consumed: [...s.consumed, proposalId] }))
    pushTurns(sid, [
      {
        id: uid(),
        role: 'user',
        kind: 'text',
        content: `Run: ${selected.map((id) => actionById(id).name).join(', ')}`,
      },
    ])

    const completed: ActionId[] = []
    let lastResult: AnalysisResult | null = null

    for (const actionId of selected) {
      pushTurns(sid, [{ id: uid(), role: 'assistant', kind: 'step', label: stepLabel(actionId) }])
      const specs = planRuns(actionId, baseSettings, sign)
      for (const spec of specs) {
        try {
          const result = await runAnalysis(dataset.dataset_id, spec.signConvention, spec.settings)
          lastResult = result
          patch(sid, (s) => ({
            ...s,
            analyses: { ...s.analyses, [result.analysis_id]: { analysis: result, label: spec.label } },
            activeAnalysisId: result.analysis_id,
            turns: [
              ...s.turns,
              { id: uid(), role: 'assistant', kind: 'analysis', analysisId: result.analysis_id, label: spec.label },
            ],
          }))
        } catch (err) {
          pushTurns(sid, [
            { id: uid(), role: 'assistant', kind: 'error', content: `${spec.label}: ${message(err)}` },
          ])
        }
      }
      completed.push(actionId)
    }

    if (lastResult) setPanelOpen(true)

    // Summary + suggest-next proposal.
    const remaining = (['run_simple_drt', 'compare_regularization_orders', 'toggle_inductance_and_compare', 'compare_lambda_modes'] as ActionId[]).filter(
      (a) => !completed.includes(a),
    )
    const followUps: Turn[] = [
      {
        id: uid(),
        role: 'assistant',
        kind: 'text',
        content: lastResult ? summarize(lastResult) : 'The runs did not return a usable result — check the warnings above.',
        suggestions: ['Explain this like I am new to EIS', 'Which peaks look real?', 'What should I try next?'],
      },
    ]
    if (remaining.length > 0) {
      followUps.push({
        id: uid(),
        role: 'assistant',
        kind: 'proposal',
        offer: remaining,
        recommended: remaining.slice(0, 1),
        title: 'Want to go further?',
        intro: 'Optional follow-up checks based on what we have so far.',
      })
    }
    pushTurns(sid, followUps)
    setBusy(null)
  }

  // ---------------- chat ----------------
  async function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const sid = activeId

    // Natural-language shortcut: "run drt" runs the simple baseline (explicit user consent).
    if (session.dataset && /\brun\b.*\bdrt\b|^\s*run\s*$/i.test(trimmed)) {
      setInput('')
      void runActions(`nl-${uid()}`, ['run_simple_drt'])
      return
    }

    setInput('')
    pushTurns(sid, [{ id: uid(), role: 'user', kind: 'text', content: trimmed }])
    setBusy('chat')
    try {
      const s = sessions.find((x) => x.id === sid)!
      const res = await sendChat({
        datasetId: s.dataset?.dataset_id,
        analysisId: s.activeAnalysisId ?? undefined,
        message: trimmed,
        history: chatHistory(s),
        model: activeModel,
      })
      pushTurns(sid, [
        {
          id: uid(),
          role: 'assistant',
          kind: 'text',
          content: res.answer,
          suggestions: res.suggested_actions,
          modelLabel: activeModel ? activeModel.label : 'Demo assistant',
        },
      ])
    } catch (err) {
      pushTurns(sid, [{ id: uid(), role: 'assistant', kind: 'error', content: message(err) }])
    } finally {
      setBusy(null)
    }
  }

  // ---------------- model management ----------------
  function addModel(m: ConnectedModel) {
    setModels((prev) => [...prev, m])
  }
  function removeModel(id: string) {
    setModels((prev) => prev.filter((m) => m.id !== id))
    if (activeModelId === id) setActiveModelId(MOCK_MODEL_ID)
  }

  // ---------------- misc ----------------
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void handleSend(input)
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleUpload(file)
  }
  function startNewSession() {
    const s = newSession()
    setSessions((prev) => [s, ...prev])
    setActiveId(s.id)
    setPanelOpen(false)
    setInput('')
  }
  function focusResult(aid: string) {
    patch(activeId, (s) => ({ ...s, activeAnalysisId: aid }))
    setPanelOpen(true)
  }

  const sessionMetas = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.dataset ? `${s.dataset.rows} rows · ${Object.keys(s.analyses).length} result(s)` : 'no data yet',
      })),
    [sessions],
  )
  const resultMetas = useMemo(
    () => Object.entries(session.analyses).map(([id, v]) => ({ id, label: v.label })),
    [session.analyses],
  )

  const activeAnalysis = session.activeAnalysisId ? session.analyses[session.activeAnalysisId] : null
  const showHero = !session.dataset && busy !== 'upload'

  return (
    <div className="app-grid" onDragOver={(e) => e.preventDefault()}>
      <Sidebar
        open={sidebarOpen}
        sessions={sessionMetas}
        activeSessionId={activeId}
        onSelectSession={(id) => {
          setActiveId(id)
          setPanelOpen(false)
        }}
        onNewSession={startNewSession}
        results={resultMetas}
        activeResultId={session.activeAnalysisId}
        onSelectResult={focusResult}
        activeModelLabel={activeModelLabel}
        onOpenModels={() => setModelsOpen(true)}
        backendOnline={online}
      />

      <main className="center">
        <header className="center-head">
          <button type="button" className="icon-btn only-mobile" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle sidebar">
            <IconMenu size={18} />
          </button>
          <div className="head-title">
            <strong>{session.title}</strong>
            <small>{session.dataset ? 'agentic DRT session' : 'upload a spectrum to begin'}</small>
          </div>
          <div className="head-actions">
            {session.dataset && (
              <button type="button" className="btn-ghost sm" onClick={() => setAdvancedOpen(true)}>
                Advanced
              </button>
            )}
            {Object.keys(session.analyses).length > 0 && (
              <button type="button" className="btn-ghost sm" onClick={() => setPanelOpen((o) => !o)}>
                {panelOpen ? 'Hide plots' : 'Plots'}
              </button>
            )}
          </div>
        </header>

        <div className="conversation" ref={scrollRef}>
          <div className="thread">
            {session.turns.map((turn) => (
              <TurnView
                key={turn.id}
                turn={turn}
                session={session}
                onSign={(v) => patch(activeId, (s) => ({ ...s, signConvention: v }))}
                onRunActions={runActions}
                onSuggestion={(s) => void handleSend(s)}
                onViewResult={focusResult}
                busyRun={busy === 'run'}
              />
            ))}

            {showHero && (
              <div
                className={`dropzone ${dragging ? 'drag' : ''}`}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="dropzone-icon">
                  <IconUpload size={24} />
                </div>
                <p className="dropzone-title">Drop your EIS spectrum here</p>
                <p className="dropzone-sub">
                  <code>.csv</code> or <code>.npy</code> · columns <code>frequency, Z′, ±Z″</code> (or a complex Z array) ·
                  headered or headerless
                </p>
              </div>
            )}

            {busy && (
              <div className="turn assistant">
                <div className="avatar"><Logo size={16} /></div>
                <div className="bubble thinking">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <em>{busy === 'upload' ? 'Reading your file…' : busy === 'run' ? 'Running pyDRTtools…' : 'Thinking…'}</em>
                </div>
              </div>
            )}
          </div>
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.npy,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ''
            }}
          />
          <div className="composer-inner">
            <button type="button" className="attach" title="Upload file" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}>
              <IconPlus size={18} />
            </button>
            <textarea
              value={input}
              placeholder={session.dataset ? 'Ask about your result, or type “run DRT”…' : 'Upload a CSV, or ask a question…'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend(input)
                }
              }}
              rows={1}
            />
            <ModelSelector models={models} activeId={activeModelId} onSelect={setActiveModelId} onManage={() => setModelsOpen(true)} />
            <button type="submit" className="send" disabled={!input.trim() || Boolean(busy)} aria-label="Send">
              <IconSend size={16} />
            </button>
          </div>
          {!session.dataset && (
            <div className="starter-row">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      </main>

      <ArtifactPanel
        open={panelOpen}
        analysis={activeAnalysis?.analysis ?? null}
        label={activeAnalysis?.label ?? null}
        onClose={() => setPanelOpen(false)}
      />

      <AdvancedPanel
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        settings={session.settings}
        onChange={(next) => patch(activeId, (s) => ({ ...s, settings: next }))}
        signConvention={session.signConvention}
        onSignChange={(v) => patch(activeId, (s) => ({ ...s, signConvention: v }))}
      />

      <ModelConnectModal
        open={modelsOpen}
        onClose={() => setModelsOpen(false)}
        models={models}
        activeId={activeModelId}
        onSelect={setActiveModelId}
        onAdd={addModel}
        onRemove={removeModel}
      />
    </div>
  )
}

function TurnView({
  turn,
  session,
  onSign,
  onRunActions,
  onSuggestion,
  onViewResult,
  busyRun,
}: {
  turn: Turn
  session: Session
  onSign: (v: SignConvention) => void
  onRunActions: (proposalId: string, selected: ActionId[]) => void
  onSuggestion: (s: string) => void
  onViewResult: (aid: string) => void
  busyRun: boolean
}) {
  if (turn.kind === 'step') {
    return (
      <div className="step-chip">
        <span className="step-tick">
          <IconCheck size={10} />
        </span>
        {turn.label}
      </div>
    )
  }

  if (turn.kind === 'dataset') {
    if (!session.dataset) return null
    return (
      <Assistant wide>
        <DatasetCard dataset={session.dataset} signConvention={session.signConvention} onSignChange={onSign} locked={busyRun} />
      </Assistant>
    )
  }

  if (turn.kind === 'proposal') {
    return (
      <Assistant wide>
        <ActionProposalCard
          offer={turn.offer}
          recommended={turn.recommended}
          title={turn.title}
          intro={turn.intro}
          consumed={session.consumed.includes(turn.id)}
          onRun={(sel) => onRunActions(turn.id, sel)}
        />
      </Assistant>
    )
  }

  if (turn.kind === 'analysis') {
    return (
      <Assistant wide>
        <AnalysisSummary
          analysis={session.analyses[turn.analysisId]?.analysis ?? ({} as AnalysisResult)}
          label={turn.label}
          active={session.activeAnalysisId === turn.analysisId}
          onView={() => onViewResult(turn.analysisId)}
        />
      </Assistant>
    )
  }

  if (turn.kind === 'error') {
    return (
      <div className="turn assistant">
        <div className="avatar err">!</div>
        <div className="bubble error-bubble">
          <strong>Something went wrong.</strong>
          <p>{turn.content}</p>
        </div>
      </div>
    )
  }

  // text
  return (
    <div className={`turn ${turn.role}`}>
      {turn.role === 'assistant' && (
        <div className="avatar">
          <Logo size={16} />
        </div>
      )}
      <div className="bubble">
        {turn.content.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {turn.modelLabel && <span className="answered-by">{turn.modelLabel}</span>}
        {turn.suggestions && turn.suggestions.length > 0 && (
          <div className="suggestions">
            {turn.suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => onSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Assistant({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="turn assistant">
      <div className="avatar">
        <Logo size={16} />
      </div>
      <div className={`bubble ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  )
}

function fmtRange(ds: DatasetSummary): string {
  return `${formatNumber(ds.frequency_min)}–${formatNumber(ds.frequency_max)} Hz`
}

function summarize(r: AnalysisResult): string {
  const n = r.peaks.length
  const top = r.peaks[0]
  const peakBit =
    n === 0
      ? 'I could not isolate a clear peak'
      : `I found ${n} peak${n === 1 ? '' : 's'}${top ? `, the strongest near τ ≈ ${top.tau.toExponential(1)} s` : ''}`
  const rmse = r.residual_metrics ? `, and the fit RMSE is ${formatNumber(r.residual_metrics.rmse_combined)}` : ''
  return `Done. ${peakBit}. Lambda settled at ${formatNumber(r.lambda_value)}${rmse}. The plots are in the panel on the right — ask me what they mean, or approve a follow-up below.`
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error'
}

export default App
