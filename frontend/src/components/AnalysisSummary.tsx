import type { AnalysisResult } from '../types'
import { formatNumber } from '../format'
import { IconActivity } from './icons'

type Props = {
  analysis: AnalysisResult
  label?: string
  active?: boolean
  onView: () => void
}

/** Compact inline result card shown in the conversation. Full plots live in the artifact panel. */
export function AnalysisSummary({ analysis, label, active, onView }: Props) {
  const m = analysis.residual_metrics
  const top = analysis.peaks[0]
  return (
    <div className={`result-card ${active ? 'active' : ''}`}>
      <div className="result-head">
        <span className="result-icon">
          <IconActivity size={15} />
        </span>
        <strong>{label ?? 'DRT result'}</strong>
        <button type="button" className="view-btn" onClick={onView}>
          View plots →
        </button>
      </div>
      <div className="result-metrics">
        <span>
          <em>peaks</em>
          {analysis.peaks.length}
        </span>
        <span>
          <em>λ</em>
          {formatNumber(analysis.lambda_value)}
        </span>
        <span>
          <em>R</em>
          {formatNumber(analysis.resistance_ohm)} Ω
        </span>
        <span>
          <em>RMSE</em>
          {formatNumber(m?.rmse_combined)}
        </span>
      </div>
      {top && (
        <p className="result-note">
          Strongest peak near τ ≈ {top.tau.toExponential(1)} s (f ≈ {formatNumber(top.frequency_hz)} Hz).
        </p>
      )}
      {analysis.warnings.length > 0 && (
        <p className="result-warn">{analysis.warnings.length} caution(s), see the panel.</p>
      )}
    </div>
  )
}
