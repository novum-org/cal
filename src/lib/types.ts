/** Domain types for the Novum / WeFaber internal finance calculator. */

export type Stage = 'alpha' | 'beta' | 'v1'

export const STAGES: readonly Stage[] = ['alpha', 'beta', 'v1']

/** Everything the owner types in (or a source fills in) for a single month. */
export type Inputs = {
  month: string // YYYY-MM
  cash_in_month: number
  cash_on_hand_start: number
  infra_cost_month: number
  ef_current: number
  ef_target_months: number
  tps_pct_above_19: number
  uptime_pct_month: number
  discord_members: number
  discord_net_growth_month: number
  unique_players_week: number
  concurrent_avg: number
  stage: Stage
  notes: string
}

/** Keys of Inputs that hold a plain number, used to drive the form. */
export type NumericInputKey = {
  [K in keyof Inputs]: Inputs[K] extends number ? K : never
}[keyof Inputs]

/** Health gate per stage. `uptime_min: null` means uptime is not required. */
export type StageRule = {
  tps_min: number
  uptime_min: number | null
}

export type StageThresholds = Record<Stage, StageRule>

/** Editable knobs for the override rules. Not part of Inputs: they are policy. */
export type Settings = {
  thresholds: StageThresholds
  /** Rule 4: max discord_members / unique_players_week before Growth is cut. */
  discord_per_player_max: number
  /** Rule 5: concurrent_avg at or above this counts as "high load". */
  concurrent_high: number
  /** Infra health floor for uptime, independent of the stage gate. */
  infra_health_uptime_floor: number
  /** Infra health floor for runway, in months. */
  min_runway_months: number
}

export type BandId = 'micro' | 'mid' | 'large' | 'mega'

/** Allocation band applied to what is left AFTER infra is paid. */
export type Band = {
  id: BandId
  label: string
  /** Inclusive lower bound of `remaining`, in USD. */
  min: number
  /** Inclusive upper bound, or null for the open ended top band. */
  max: number | null
  ef: number
  product: number
  growth: number
  people: number
}

export type AlertLevel = 'red' | 'warn' | 'info'

export type Alert = {
  /** Rule id as documented in ENGINE.md. */
  rule: string
  level: AlertLevel
  /** Rioplatense Spanish, shown as is in the UI. */
  message: string
}

export type Allocation = {
  infra: number
  ef_fill: number
  product: number
  growth: number
  people: number
  /** Growth money parked for infra because the server is not healthy (rules 3 and 5). */
  infra_buffer: number
  unallocated: number
}

export type Health = {
  tps_ok: boolean
  uptime_ok: boolean
  /** Rule 5: many concurrent players while TPS fails. */
  load_pressure: boolean
  infra_healthy: boolean
  growth_blocked: boolean
  /** discord_members / unique_players_week, or null when there are no players. */
  discord_ratio: number | null
}

export type Result = {
  inputs: Inputs
  settings: Settings
  /** null when infra was not covered: no band applies. */
  band: Band | null
  /** cash_in_month - infra_cost_month, floored at 0. */
  remaining: number
  infra_shortfall: number
  allocation: Allocation
  ef_cap: number
  ef_after: number
  ef_progress_pct: number
  /** Charter reference only (20% of accumulated cash, capped). Never binds. */
  ef_charter_target: number
  /** null when infra_cost_month is 0. */
  runway_months: number | null
  health: Health
  alerts: Alert[]
  total_allocated: number
}

/** Errors as values, used by the JSON import path. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export type Snapshot = {
  version: 1
  saved_at: string
  inputs: Inputs
  settings: Settings
}
