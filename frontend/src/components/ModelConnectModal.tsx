import { useState } from 'react'
import type { ConnectedModel, ProviderId } from '../types'
import { MOCK_MODEL_ID } from '../types'
import { PROVIDER_META, newModelId } from '../store/models'
import { IconClose } from './icons'

type Props = {
  open: boolean
  onClose: () => void
  models: ConnectedModel[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: (model: ConnectedModel) => void
  onRemove: (id: string) => void
}

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'openai-compatible']

export function ModelConnectModal({ open, onClose, models, activeId, onSelect, onAdd, onRemove }: Props) {
  const [provider, setProvider] = useState<ProviderId>('openai')
  const [model, setModel] = useState(PROVIDER_META.openai.defaultModel)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = PROVIDER_META[provider]

  function pickProvider(p: ProviderId) {
    setProvider(p)
    setModel(PROVIDER_META[p].defaultModel)
    setError(null)
  }

  function add() {
    if (!apiKey.trim() && provider !== 'openai-compatible') {
      setError('An API key is required for this provider.')
      return
    }
    if (!model.trim()) {
      setError('Enter a model name.')
      return
    }
    if (meta.needsBaseUrl && !baseUrl.trim()) {
      setError('A base URL is required for a custom OpenAI-compatible endpoint.')
      return
    }
    const id = newModelId()
    onAdd({
      id,
      provider,
      model: model.trim(),
      label: `${meta.label.split(' ')[0]} · ${model.trim()}`,
      apiKey: apiKey.trim(),
      baseUrl: meta.needsBaseUrl ? baseUrl.trim() : undefined,
      remember,
    })
    onSelect(id)
    setApiKey('')
    setBaseUrl('')
    setError(null)
  }

  if (!open) return null

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Connect an AI model</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <p className="modal-note">
          Keys stay on this device — kept in this tab only, unless you tick “remember”. They’re sent only to the local
          backend and your chosen provider, never saved to project files.
        </p>

        <div className="model-roster">
          <button
            type="button"
            className={`roster-item ${activeId === MOCK_MODEL_ID ? 'on' : ''}`}
            onClick={() => onSelect(MOCK_MODEL_ID)}
          >
            <span className="row-title">Built-in demo assistant</span>
            <span className="row-sub">no key · template answers</span>
          </button>
          {models.map((m) => (
            <div key={m.id} className={`roster-item ${activeId === m.id ? 'on' : ''}`}>
              <button type="button" className="roster-pick" onClick={() => onSelect(m.id)}>
                <span className="row-title">{m.label}</span>
                <span className="row-sub">
                  {m.provider}
                  {m.remember ? ' · remembered' : ' · this tab'}
                </span>
              </button>
              <button type="button" className="icon-btn sm" onClick={() => onRemove(m.id)} aria-label="Remove">
                <IconClose size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="modal-divider">Add a provider</div>

        <div className="provider-tabs">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              className={provider === p ? 'on' : ''}
              onClick={() => pickProvider(p)}
            >
              {PROVIDER_META[p].label.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Model</label>
          {meta.models.length > 0 ? (
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {meta.models.map((mm) => (
                <option key={mm} value={mm}>
                  {mm}
                </option>
              ))}
            </select>
          ) : (
            <input value={model} placeholder="model name (e.g. llama-3.1-8b)" onChange={(e) => setModel(e.target.value)} />
          )}
        </div>

        {meta.needsBaseUrl && (
          <div className="field">
            <label>Base URL</label>
            <input value={baseUrl} placeholder="http://localhost:1234/v1" onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>API key {provider === 'openai-compatible' && <span className="opt">(optional)</span>}</label>
          <input type="password" value={apiKey} placeholder={meta.keyHint} onChange={(e) => setApiKey(e.target.value)} />
        </div>

        <label className="remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember on this device (stored in this browser only)
        </label>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Done
          </button>
          <button type="button" className="btn-primary" onClick={add}>
            Add model
          </button>
        </div>
      </div>
    </div>
  )
}
