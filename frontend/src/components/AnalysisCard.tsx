import { useState } from 'react'
import type { AnalysisResult } from '../types'
import { formatHz, formatNumber, formatSeconds } from '../format'
import { AxisChart } from './charts'
import { IconActivity } from './icons'

type Tab = 'nyquist' | 'bode' | 'drt' | 'peaks'

const SETTING_NOTES: Record<string, string> = {
  der_used: 'Derivative order penalised during regularisation. 1st order favours narrower peaks; 2nd order favours smoother, broader peaks.',
  cv_type: 'How lambda (the smoothing strength) is chosen. GCV/mGCV pick it automatically; custom uses your fixed value.',
  induct_used: 'Whether a series inductance term is fitted, which absorbs high-frequency inductive artifacts.',
  rbf_type: 'Radial basis function used to discretise the relaxation-time distribution.',
}

export function AnalysisCard({ analysis, label }: { analysis: AnalysisResult; label?: string }) {
  const [tab, setTab] = useState<Tab>('drt')
  const p = analysis.plot_data
  const m = analysis.residual_metrics

  return (
    <div className="artifact analysis">
      <div className="artifact-head">
        <div className="artifact-icon">
          <IconActivity size={18} />
        </div>
        <div>
          <h3 className="artifact-title">{label ?? 'DRT analysis result'}</h3>
          <p className="artifact-sub">
            {analysis.peaks.length} peak{analysis.peaks.length === 1 ? '' : 's'} ·{' '}
            {analysis.sign_convention === 'neg_z_imag' ? 'column 3 = −Z″' : 'column 3 = Z″'}
          </p>
        </div>
      </div>

      <div className="metric-row">
        <div className="metric">
          <span>λ (lambda)</span>
          <strong>{formatNumber(analysis.lambda_value)}</strong>
        </div>
        <div className="metric">
          <span>R estimate</span>
          <strong>{formatNumber(analysis.resistance_ohm)} Ω</strong>
        </div>
        <div className="metric">
          <span>L estimate</span>
          <strong>{analysis.inductance_h === null ? '—' : `${formatNumber(analysis.inductance_h)} H`}</strong>
        </div>
        <div className="metric">
          <span>Combined RMSE</span>
          <strong>{formatNumber(m?.rmse_combined)}</strong>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'drt' ? 'tab-on' : ''} onClick={() => setTab('drt')}>
          DRT
        </button>
        <button className={tab === 'nyquist' ? 'tab-on' : ''} onClick={() => setTab('nyquist')}>
          Nyquist
        </button>
        <button className={tab === 'bode' ? 'tab-on' : ''} onClick={() => setTab('bode')}>
          Bode
        </button>
        <button className={tab === 'peaks' ? 'tab-on' : ''} onClick={() => setTab('peaks')}>
          Peaks
        </button>
      </div>

      <div className="tab-body">
        {tab === 'drt' && (
          <div className="chart-wrap">
            <AxisChart series={p.drt} xLabel="τ / s" yLabel="γ(τ)" logX color="var(--accent)" />
            <p className="chart-caption">
              Each bump is a relaxation process at a time scale τ. Taller, well-separated peaks are more trustworthy than
              small bumps near the baseline.
            </p>
          </div>
        )}
        {tab === 'nyquist' && (
          <div className="chart-wrap">
            <AxisChart
              series={p.nyquist_measured}
              compare={p.nyquist_fit}
              xLabel="Z′ / Ω"
              yLabel="−Z″ / Ω"
              mode="scatter"
            />
            <p className="chart-caption">
              Dots are your measured data{p.nyquist_fit ? '; the line is the DRT model fit' : ''}. A close overlap means the
              model reproduces your spectrum.
            </p>
          </div>
        )}
        {tab === 'bode' && (
          <div className="chart-pair">
            <div className="chart-wrap">
              <AxisChart series={p.bode_magnitude} xLabel="f / Hz" yLabel="|Z| / Ω" logX />
            </div>
            <div className="chart-wrap">
              <AxisChart series={p.bode_phase} xLabel="f / Hz" yLabel="phase / °" logX color="var(--accent-2)" />
            </div>
          </div>
        )}
        {tab === 'peaks' && (
          <div className="peak-table-wrap">
            {analysis.peaks.length === 0 ? (
              <p className="muted">No clear peaks were detected.</p>
            ) : (
              <table className="peak-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>τ (s)</th>
                    <th>f (Hz)</th>
                    <th>γ</th>
                    <th>prominence</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.peaks.map((peak, i) => (
                    <tr key={`${peak.tau}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{formatSeconds(peak.tau)}</td>
                      <td>{formatHz(peak.frequency_hz)}</td>
                      <td>{formatNumber(peak.gamma)}</td>
                      <td>{formatNumber(peak.prominence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {analysis.warnings.length > 0 && (
        <ul className="warn-list">
          {analysis.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <details className="params">
        <summary>Settings used</summary>
        <ul className="param-list">
          <li>
            <code>der_used = {analysis.settings.der_used}</code>
            <span>{SETTING_NOTES.der_used}</span>
          </li>
          <li>
            <code>cv_type = {analysis.settings.cv_type}</code>
            <span>{SETTING_NOTES.cv_type}</span>
          </li>
          <li>
            <code>induct_used = {analysis.settings.induct_used}</code>
            <span>{SETTING_NOTES.induct_used}</span>
          </li>
          <li>
            <code>rbf_type = {analysis.settings.rbf_type}</code>
            <span>{SETTING_NOTES.rbf_type}</span>
          </li>
        </ul>
      </details>
    </div>
  )
}
