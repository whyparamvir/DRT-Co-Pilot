import { Logo, IconPlus, IconActivity, IconSettings } from './icons'

export type SessionMeta = {
  id: string
  title: string
  subtitle: string
}

export type ResultMeta = {
  id: string
  label: string
}

type Props = {
  open: boolean
  sessions: SessionMeta[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  results: ResultMeta[]
  activeResultId: string | null
  onSelectResult: (id: string) => void
  activeModelLabel: string
  onOpenModels: () => void
  backendOnline: boolean | null
}

export function Sidebar({
  open,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  results,
  activeResultId,
  onSelectResult,
  activeModelLabel,
  onOpenModels,
  backendOnline,
}: Props) {
  return (
    <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <span className="logo">
          <Logo size={18} />
        </span>
        <strong>DRT Co-Pilot</strong>
      </div>

      <button type="button" className="new-btn" onClick={onNewSession}>
        <IconPlus size={15} />
        New analysis
      </button>

      <div className="sidebar-section">
        <p className="sidebar-label">Chats</p>
        <ul className="sidebar-list">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === activeSessionId ? 'on' : ''}
                onClick={() => onSelectSession(s.id)}
              >
                <span className="row-title">{s.title}</span>
                <span className="row-sub">{s.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section grow">
        <p className="sidebar-label">Results in this chat</p>
        {results.length === 0 ? (
          <p className="sidebar-empty">No analyses yet.</p>
        ) : (
          <ul className="sidebar-list">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={r.id === activeResultId ? 'on' : ''}
                  onClick={() => onSelectResult(r.id)}
                >
                  <span className="row-title">
                    <IconActivity size={13} /> {r.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar-foot">
        <button type="button" className="model-status" onClick={onOpenModels}>
          <span className="ms-dot" />
          <span className="ms-text">
            <em>Model</em>
            {activeModelLabel}
          </span>
          <span className="ms-cog">
            <IconSettings size={15} />
          </span>
        </button>
        <span className={`backend ${backendOnline === false ? 'off' : backendOnline ? 'on' : ''}`}>
          {backendOnline === null ? 'connecting…' : backendOnline ? 'backend online' : 'backend offline'}
        </span>
      </div>
    </aside>
  )
}
