import type { DRTSettings, SignConvention } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { IconClose } from './icons'

type Props = {
  open: boolean
  onClose: () => void
  settings: DRTSettings
  onChange: (next: DRTSettings) => void
  signConvention: SignConvention
  onSignChange: (value: SignConvention) => void
}

export function AdvancedPanel({
  open,
  onClose,
  settings,
  onChange,
  signConvention,
  onSignChange,
}: Props) {
  const set = <K extends keyof DRTSettings>(key: K, value: DRTSettings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <>
      <div className={`drawer-scrim ${open ? 'show' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside className={`drawer ${open ? 'show' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h2>Advanced settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <p className="drawer-note">
          Defaults are sensible for a first run. Change these only when you want to experiment — the assistant can explain
          each one.
        </p>

        <div className="field">
          <label>Sign convention (column 3)</label>
          <select value={signConvention} onChange={(e) => onSignChange(e.target.value as SignConvention)}>
            <option value="neg_z_imag">Column 3 is −Z″ (most common)</option>
            <option value="z_imag">Column 3 is Z″</option>
          </select>
        </div>

        <div className="field">
          <label>Derivative order</label>
          <select value={settings.der_used} onChange={(e) => set('der_used', e.target.value)}>
            <option>1st order</option>
            <option>2nd order</option>
          </select>
          <small>1st order → sharper peaks · 2nd order → smoother result</small>
        </div>

        <div className="field">
          <label>Lambda selection</label>
          <select value={settings.cv_type} onChange={(e) => set('cv_type', e.target.value)}>
            <option>GCV</option>
            <option>mGCV</option>
            <option>rGCV</option>
            <option>LC</option>
            <option>re-im</option>
            <option>kf</option>
            <option>custom</option>
          </select>
          <small>Automatic methods choose the smoothing strength for you.</small>
        </div>

        <div className="field">
          <label>Custom lambda (reg_param)</label>
          <input
            type="number"
            step="0.0001"
            value={settings.reg_param}
            onChange={(e) => set('reg_param', Number(e.target.value))}
          />
          <small>Used when lambda selection is set to custom.</small>
        </div>

        <div className="field">
          <label>Fit inductance</label>
          <select value={settings.induct_used} onChange={(e) => set('induct_used', Number(e.target.value))}>
            <option value={1}>Yes — fit a series inductance</option>
            <option value={0}>No</option>
            <option value={2}>Inductance only (no resistance)</option>
          </select>
        </div>

        <div className="field">
          <label>RBF type</label>
          <select value={settings.rbf_type} onChange={(e) => set('rbf_type', e.target.value)}>
            <option>Gaussian</option>
            <option>C0 Matern</option>
            <option>C2 Matern</option>
            <option>C4 Matern</option>
            <option>C6 Matern</option>
            <option>Inverse Quadratic</option>
            <option>Inverse Quadric</option>
            <option>Cauchy</option>
          </select>
        </div>

        <div className="field">
          <label>Data used</label>
          <select value={settings.data_used} onChange={(e) => set('data_used', e.target.value)}>
            <option>Combined Re-Im Data</option>
            <option>Im Data</option>
            <option>Re Data</option>
          </select>
        </div>

        <div className="drawer-actions">
          <button type="button" className="btn-ghost" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
            Reset to defaults
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </aside>
    </>
  )
}
