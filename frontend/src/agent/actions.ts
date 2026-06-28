import type { ActionId, DRTSettings, SignConvention } from '../types'

export type ActionDef = {
  id: ActionId
  name: string
  why: string
  runtime: string
  recommended: boolean
}

/** Catalog of analysis actions the agent can propose. All require explicit confirmation. */
export const ACTIONS: ActionDef[] = [
  {
    id: 'run_simple_drt',
    name: 'Run simple DRT',
    why: 'Computes the relaxation-time distribution with sensible defaults — the baseline result everything else compares against.',
    runtime: 'a few seconds',
    recommended: true,
  },
  {
    id: 'compare_regularization_orders',
    name: 'Compare 1st vs 2nd derivative smoothing',
    why: 'Shows whether your peaks survive a smoother penalty. Peaks that vanish under 2nd order are more likely artifacts.',
    runtime: '~2× a single run',
    recommended: true,
  },
  {
    id: 'toggle_inductance_and_compare',
    name: 'Check inductance on / off',
    why: 'Tells you if a high-frequency inductive tail (cables/porous electrode) is distorting the result.',
    runtime: '~2× a single run',
    recommended: false,
  },
  {
    id: 'compare_lambda_modes',
    name: 'Compare lambda selection',
    why: 'Contrasts automatic smoothing (GCV) with a fixed custom value so you can see how sensitive the peaks are to λ.',
    runtime: '~2× a single run',
    recommended: false,
  },
]

export function actionById(id: ActionId): ActionDef {
  return ACTIONS.find((a) => a.id === id) ?? ACTIONS[0]
}

export type RunSpec = {
  label: string
  settings: DRTSettings
  signConvention: SignConvention
}

/** Expand a chosen action into one or more concrete DRT runs. */
export function planRuns(id: ActionId, base: DRTSettings, sign: SignConvention): RunSpec[] {
  const make = (label: string, override: Partial<DRTSettings>): RunSpec => ({
    label,
    settings: { ...base, ...override },
    signConvention: sign,
  })
  switch (id) {
    case 'run_simple_drt':
      return [make('Simple DRT', {})]
    case 'compare_regularization_orders':
      return [make('1st-order penalty', { der_used: '1st order' }), make('2nd-order penalty', { der_used: '2nd order' })]
    case 'toggle_inductance_and_compare':
      return [make('Inductance fitted', { induct_used: 1 }), make('No inductance', { induct_used: 0 })]
    case 'compare_lambda_modes':
      return [make('GCV (automatic λ)', { cv_type: 'GCV' }), make('Custom λ', { cv_type: 'custom' })]
    default:
      return [make('Simple DRT', {})]
  }
}

export function stepLabel(id: ActionId): string {
  switch (id) {
    case 'run_simple_drt':
      return 'Ran simple DRT'
    case 'compare_regularization_orders':
      return 'Compared derivative orders'
    case 'toggle_inductance_and_compare':
      return 'Compared inductance on/off'
    case 'compare_lambda_modes':
      return 'Compared lambda modes'
    default:
      return 'Ran analysis'
  }
}
