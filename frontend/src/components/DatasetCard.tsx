import type { DatasetSummary, SignConvention } from '../types'
import { formatHz, formatNumber } from '../format'
import { IconFile } from './icons'

type Props = {
  dataset: DatasetSummary
  signConvention: SignConvention
  onSignChange: (value: SignConvention) => void
  locked?: boolean
}

export function DatasetCard({ dataset, signConvention, onSignChange, locked }: Props) {
  const col = dataset.column_summary
  return (
    <div className="artifact">
      <div className="artifact-head">
        <div className="artifact-icon">
          <IconFile size={18} />
        </div>
        <div>
          <h3 className="artifact-title">{dataset.filename}</h3>
          <p className="artifact-sub">
            {dataset.rows} rows · {col.has_header ? 'header detected' : 'no header'}
          </p>
        </div>
      </div>

      <div className="kv-grid">
        <div className="kv">
          <span>Frequency</span>
          <strong>
            {formatHz(dataset.frequency_min)} – {formatHz(dataset.frequency_max)}
          </strong>
        </div>
        <div className="kv">
          <span>Z′ (real)</span>
          <strong>
            {formatNumber(dataset.z_real_min)} – {formatNumber(dataset.z_real_max)} Ω
          </strong>
        </div>
        <div className="kv">
          <span>Column 3 ({col.z_imag_input})</span>
          <strong>
            {formatNumber(dataset.z_imag_input_min)} – {formatNumber(dataset.z_imag_input_max)}
          </strong>
        </div>
        <div className="kv">
          <span>Detected mapping</span>
          <strong>
            {col.frequency} · {col.z_real} · {col.z_imag_input}
          </strong>
        </div>
      </div>

      {dataset.warnings.length > 0 && (
        <ul className="warn-list">
          {dataset.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="sign-row">
        <span className="sign-label">Sign convention for column 3</span>
        <div className="seg">
          <button
            type="button"
            disabled={locked}
            className={signConvention === 'neg_z_imag' ? 'seg-on' : ''}
            onClick={() => onSignChange('neg_z_imag')}
          >
            −Z″ (most common)
          </button>
          <button
            type="button"
            disabled={locked}
            className={signConvention === 'z_imag' ? 'seg-on' : ''}
            onClick={() => onSignChange('z_imag')}
          >
            Z″
          </button>
        </div>
        {signConvention === dataset.sign_convention_guess && <span className="sign-hint">matches my best guess</span>}
      </div>
    </div>
  )
}
