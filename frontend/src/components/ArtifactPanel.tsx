import type { AnalysisResult } from '../types'
import { AnalysisCard } from './AnalysisCard'
import { IconChart, IconClose } from './icons'

type Props = {
  open: boolean
  analysis: AnalysisResult | null
  label: string | null
  onClose: () => void
}

export function ArtifactPanel({ open, analysis, label, onClose }: Props) {
  return (
    <section className={`artifact-panel ${open ? 'open' : ''}`}>
      <div className="panel-head">
        <span className="panel-title">Artifact</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
          <IconClose size={16} />
        </button>
      </div>
      <div className="panel-body">
        {analysis ? (
          <AnalysisCard analysis={analysis} label={label ?? undefined} />
        ) : (
          <div className="panel-empty">
            <div className="panel-empty-icon">
              <IconChart size={26} />
            </div>
            <p>Run an analysis and your plots, peak table and diagnostics will appear here.</p>
          </div>
        )}
      </div>
    </section>
  )
}
