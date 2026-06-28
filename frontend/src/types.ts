// Types mirror the FastAPI backend models in backend/app/models.py.

export type SignConvention = 'z_imag' | 'neg_z_imag'
export type AIProvider = 'mock' | 'openai' | 'gemini' | 'anthropic' | 'openai-compatible'

export type ColumnSummary = {
  frequency: string
  z_real: string
  z_imag_input: string
  has_header: boolean
}

export type DatasetSummary = {
  dataset_id: string
  filename: string
  rows: number
  frequency_min: number
  frequency_max: number
  z_real_min: number
  z_real_max: number
  z_imag_input_min: number
  z_imag_input_max: number
  sign_convention_guess: SignConvention
  column_summary: ColumnSummary
  warnings: string[]
}

export type DRTSettings = {
  rbf_type: string
  data_used: string
  induct_used: number
  der_used: string
  cv_type: string
  reg_param: number
  shape_control: string
  coeff: number
}

export type Series = { x: number[]; y: number[] }

export type Peak = {
  tau: number
  frequency_hz: number
  gamma: number
  prominence: number | null
  width_tau: number | null
}

export type ResidualMetrics = {
  rmse_real: number
  rmse_imag: number
  rmse_combined: number
  max_abs_real: number
  max_abs_imag: number
}

export type PlotData = {
  nyquist_measured: Series
  nyquist_fit: Series | null
  bode_magnitude: Series
  bode_phase: Series
  drt: Series
}

export type AnalysisResult = {
  analysis_id: string
  dataset: DatasetSummary
  sign_convention: SignConvention
  settings: DRTSettings
  lambda_value: number | null
  resistance_ohm: number | null
  inductance_h: number | null
  residual_metrics: ResidualMetrics | null
  peaks: Peak[]
  warnings: string[]
  plot_data: PlotData
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ChatResponse = {
  provider: AIProvider
  answer: string
  suggested_actions: string[]
}

// ---- In-app AI model connections (stored locally, never committed) ----

export type ProviderId = 'openai' | 'gemini' | 'anthropic' | 'openai-compatible'

export type ConnectedModel = {
  id: string
  provider: ProviderId
  label: string
  model: string
  apiKey: string
  baseUrl?: string
  remember: boolean
}

/** Pseudo-model that always works without a key (backend mock provider). */
export const MOCK_MODEL_ID = 'mock'

// ---- Agentic action catalog ----

export type ActionId =
  | 'run_simple_drt'
  | 'compare_regularization_orders'
  | 'toggle_inductance_and_compare'
  | 'compare_lambda_modes'

export const DEFAULT_SETTINGS: DRTSettings = {
  rbf_type: 'Gaussian',
  data_used: 'Combined Re-Im Data',
  induct_used: 1,
  der_used: '1st order',
  cv_type: 'GCV',
  reg_param: 1e-3,
  shape_control: 'FWHM Coefficient',
  coeff: 0.5,
}
