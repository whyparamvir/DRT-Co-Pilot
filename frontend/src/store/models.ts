import type { ConnectedModel, ProviderId } from '../types'

// Models the user explicitly chose to "remember on this device" live in localStorage.
// Everything else stays in sessionStorage and is gone when the tab closes.
const LOCAL_KEY = 'drt.models.remembered'
const SESSION_KEY = 'drt.models.session'
const ACTIVE_KEY = 'drt.activeModel'

export const PROVIDER_META: Record<ProviderId, { label: string; needsBaseUrl: boolean; keyHint: string; defaultModel: string; models: string[] }> = {
  openai: {
    label: 'OpenAI',
    needsBaseUrl: false,
    keyHint: 'sk-…',
    defaultModel: 'gpt-5.4-mini',
    models: ['gpt-5.4-mini', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-nano'],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    needsBaseUrl: false,
    keyHint: 'sk-ant-…',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8', 'claude-fable-5'],
  },
  gemini: {
    label: 'Google Gemini',
    needsBaseUrl: false,
    keyHint: 'AIza…',
    defaultModel: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  'openai-compatible': {
    label: 'OpenAI-compatible (custom)',
    needsBaseUrl: true,
    keyHint: 'token or sk-…',
    defaultModel: '',
    models: [],
  },
}

function read(key: string, store: Storage): ConnectedModel[] {
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as ConnectedModel[]) : []
  } catch {
    return []
  }
}

export function loadModels(): ConnectedModel[] {
  const remembered = read(LOCAL_KEY, localStorage)
  const session = read(SESSION_KEY, sessionStorage)
  const byId = new Map<string, ConnectedModel>()
  for (const m of [...remembered, ...session]) byId.set(m.id, m)
  return [...byId.values()]
}

export function saveModels(models: ConnectedModel[]): void {
  const remembered = models.filter((m) => m.remember)
  const session = models.filter((m) => !m.remember)
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(remembered))
  } catch {
    /* ignore quota/availability */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function loadActiveModelId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveModelId(id: string): void {
  try {
    sessionStorage.setItem(ACTIVE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function newModelId(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}`
}
