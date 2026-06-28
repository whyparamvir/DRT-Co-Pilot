import { useId } from 'react'
import type { Series } from '../types'

type Pt = { x: number; y: number }

const W = 460
const H = 280
const PAD = { left: 58, right: 18, top: 16, bottom: 44 }

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min]
  const span = max - min
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(12)))
  return ticks
}

function tickLabel(v: number): string {
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e4 || abs < 1e-2)) return v.toExponential(0)
  return v.toLocaleString(undefined, { maximumSignificantDigits: 3 })
}

type AxisChartProps = {
  series: Series
  compare?: Series | null
  xLabel: string
  yLabel: string
  logX?: boolean
  mode?: 'line' | 'scatter' | 'line+markers'
  color?: string
}

/** Generic 2D chart with linear or log-x axes, gridlines and ticks. */
export function AxisChart({
  series,
  compare,
  xLabel,
  yLabel,
  logX = false,
  mode = 'line',
  color = 'var(--accent)',
}: AxisChartProps) {
  const clipId = useId()
  const tx = (x: number) => (logX ? Math.log10(Math.max(x, 1e-30)) : x)

  const pts = (s: Series): Pt[] =>
    s.x
      .map((x, i) => ({ x, y: s.y[i] }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!logX || p.x > 0))

  const main = pts(series)
  const cmp = compare ? pts(compare) : []
  const all = [...main, ...cmp]
  if (all.length === 0) {
    return <div className="chart-empty">No data to plot.</div>
  }

  const xs = all.map((p) => tx(p.x))
  const ys = all.map((p) => p.y)
  let minX = Math.min(...xs)
  let maxX = Math.max(...xs)
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  if (minX === maxX) {
    minX -= 0.5
    maxX += 0.5
  }
  const yPad = (maxY - minY || 1) * 0.06
  minY -= yPad
  maxY += yPad

  const mapX = (x: number) =>
    PAD.left + ((tx(x) - minX) / (maxX - minX)) * (W - PAD.left - PAD.right)
  const mapY = (y: number) =>
    PAD.top + (1 - (y - minY) / (maxY - minY)) * (H - PAD.top - PAD.bottom)

  const toPath = (p: Pt[]) =>
    p.map((q, i) => `${i === 0 ? 'M' : 'L'} ${mapX(q.x).toFixed(2)} ${mapY(q.y).toFixed(2)}`).join(' ')

  const xTicks = logX
    ? niceTicks(minX, maxX, 5).map((t) => Math.pow(10, t))
    : niceTicks(minX, maxX, 5)
  const yTicks = niceTicks(minY + yPad, maxY - yPad, 5)
  const showMarkers = mode === 'scatter' || mode === 'line+markers'
  const showLine = mode === 'line' || mode === 'line+markers'

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
      <clipPath id={clipId}>
        <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} />
      </clipPath>

      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={mapY(t)} y2={mapY(t)} />
          <text className="tick" x={PAD.left - 8} y={mapY(t) + 3} textAnchor="end">
            {tickLabel(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line className="grid" x1={mapX(t)} x2={mapX(t)} y1={PAD.top} y2={H - PAD.bottom} />
          <text className="tick" x={mapX(t)} y={H - PAD.bottom + 16} textAnchor="middle">
            {tickLabel(t)}
          </text>
        </g>
      ))}

      <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
      <line className="axis" x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} />

      <g clipPath={`url(#${clipId})`}>
        {cmp.length > 0 && <path className="series-line compare" d={toPath(cmp)} />}
        {showLine && <path className="series-line" style={{ stroke: color }} d={toPath(main)} />}
        {showMarkers &&
          main.map((p, i) => (
            <circle key={i} className="series-dot" cx={mapX(p.x)} cy={mapY(p.y)} r={2.4} style={{ fill: color }} />
          ))}
        {cmp.length > 0 &&
          mode !== 'line' &&
          cmp.map((p, i) => <circle key={`c${i}`} className="series-dot compare" cx={mapX(p.x)} cy={mapY(p.y)} r={2} />)}
      </g>

      <text className="axis-label" x={(PAD.left + W - PAD.right) / 2} y={H - 8} textAnchor="middle">
        {xLabel}
      </text>
      <text
        className="axis-label"
        x={14}
        y={(PAD.top + H - PAD.bottom) / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${(PAD.top + H - PAD.bottom) / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  )
}
