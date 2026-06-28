import { useState } from 'react'
import type { ActionId } from '../types'
import { ACTIONS, actionById } from '../agent/actions'
import { IconCheck } from './icons'

type Props = {
  /** Which actions to offer; defaults to the full catalog. */
  offer?: ActionId[]
  recommended: ActionId[]
  title?: string
  intro?: string
  consumed?: boolean
  onRun: (selected: ActionId[]) => void
}

export function ActionProposalCard({ offer, recommended, title, intro, consumed, onRun }: Props) {
  const offered = offer ? ACTIONS.filter((a) => offer.includes(a.id)) : ACTIONS
  const [selected, setSelected] = useState<Set<ActionId>>(new Set(recommended))

  const toggle = (id: ActionId) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const chosen = offered.filter((a) => selected.has(a.id)).map((a) => a.id)

  return (
    <div className={`artifact proposal ${consumed ? 'consumed' : ''}`}>
      <div className="proposal-head">
        <span className="proposal-tag">Proposed analysis · needs your OK</span>
        <h3 className="artifact-title">{title ?? 'Here are some useful checks I can run'}</h3>
        {intro && <p className="artifact-sub">{intro}</p>}
      </div>

      <ul className="action-list">
        {offered.map((a) => {
          const isRec = recommended.includes(a.id)
          return (
            <li key={a.id} className={selected.has(a.id) ? 'on' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  disabled={consumed}
                  onChange={() => toggle(a.id)}
                />
                <span className="action-main">
                  <span className="action-name">
                    {a.name}
                    {isRec && <em className="rec">recommended</em>}
                  </span>
                  <span className="action-why">{a.why}</span>
                  <span className="action-meta">⏱ {a.runtime} · asks before running</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="proposal-actions">
        {consumed ? (
          <span className="proposal-done">
            <IconCheck size={14} /> Approved and executed
          </span>
        ) : (
          <>
            <button type="button" className="btn-primary" disabled={chosen.length === 0} onClick={() => onRun(chosen)}>
              Run {chosen.length > 0 ? `${chosen.length} selected` : 'selected'}
            </button>
            <span className="proposal-hint">
              {chosen.length === 0
                ? 'Select at least one check.'
                : chosen.map((id) => actionById(id).name).join(' · ')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
