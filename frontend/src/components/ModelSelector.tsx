import { useEffect, useRef, useState } from 'react'
import type { ConnectedModel } from '../types'
import { MOCK_MODEL_ID } from '../types'
import { IconPlus } from './icons'

type Props = {
  models: ConnectedModel[]
  activeId: string
  onSelect: (id: string) => void
  onManage: () => void
}

export function ModelSelector({ models, activeId, onSelect, onManage }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const active = models.find((m) => m.id === activeId)
  const label = active ? active.label : 'Demo assistant'

  return (
    <div className="model-select" ref={ref}>
      <button type="button" className="model-select-btn" onClick={() => setOpen((o) => !o)}>
        <span className="ms-mini-dot" />
        {label}
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="model-menu">
          <button
            type="button"
            className={activeId === MOCK_MODEL_ID ? 'on' : ''}
            onClick={() => {
              onSelect(MOCK_MODEL_ID)
              setOpen(false)
            }}
          >
            Built-in demo assistant
            <small>no key needed</small>
          </button>
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              className={activeId === m.id ? 'on' : ''}
              onClick={() => {
                onSelect(m.id)
                setOpen(false)
              }}
            >
              {m.label}
              <small>{m.provider}</small>
            </button>
          ))}
          <button
            type="button"
            className="menu-manage"
            onClick={() => {
              setOpen(false)
              onManage()
            }}
          >
            <IconPlus size={14} /> Connect a model…
          </button>
        </div>
      )}
    </div>
  )
}
