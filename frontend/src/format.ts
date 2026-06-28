export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 10000 || abs < 0.01) return value.toExponential(2)
  return value.toLocaleString(undefined, { maximumSignificantDigits: digits })
}

export function formatHz(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value >= 1e6) return `${formatNumber(value / 1e6)} MHz`
  if (value >= 1e3) return `${formatNumber(value / 1e3)} kHz`
  if (value < 1) return `${formatNumber(value * 1e3)} mHz`
  return `${formatNumber(value)} Hz`
}

export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toExponential(2)} s`
}
