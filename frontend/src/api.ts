import type {
  AnalysisResult,
  ChatMessage,
  ChatResponse,
  ConnectedModel,
  DatasetSummary,
  DRTSettings,
  SignConvention,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function asError(response: Response): Promise<never> {
  let detail = response.statusText
  try {
    const body = await response.json()
    detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body)
  } catch {
    try {
      detail = (await response.text()) || detail
    } catch {
      /* keep statusText */
    }
  }
  throw new Error(detail)
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function uploadDataset(file: File): Promise<DatasetSummary> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${API_BASE}/api/datasets/upload`, { method: 'POST', body: form })
  if (!response.ok) return asError(response)
  return response.json()
}

export async function runAnalysis(
  datasetId: string,
  signConvention: SignConvention,
  settings: DRTSettings,
): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/analysis/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, sign_convention: signConvention, settings }),
  })
  if (!response.ok) return asError(response)
  return response.json()
}

export async function sendChat(args: {
  datasetId?: string
  analysisId?: string
  message: string
  history: ChatMessage[]
  model?: ConnectedModel | null
}): Promise<ChatResponse> {
  const m = args.model
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset_id: args.datasetId,
      analysis_id: args.analysisId,
      message: args.message,
      history: args.history.slice(-8),
      // Per-request model connection (omitted -> backend falls back to env/mock).
      provider: m?.provider,
      model: m?.model,
      api_key: m?.apiKey,
      base_url: m?.baseUrl,
    }),
  })
  if (!response.ok) return asError(response)
  return response.json()
}
