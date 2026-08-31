export type Stage = 'alpha' | 'beta' | 'v1'

export const STAGES: readonly Stage[] = ['alpha', 'beta', 'v1']

export type Inputs = {
  month: string
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

export type NumericInputKey = {
  [K in keyof Inputs]: Inputs[K] extends number ? K : never
}[keyof Inputs]

export type StageRule = {
  tps_min: number
  uptime_min: number | null
}

export type StageThresholds = Record<Stage, StageRule>

export type Settings = {
  thresholds: StageThresholds
  discord_per_player_max: number
  concurrent_high: number
  infra_health_uptime_floor: number
  min_runway_months: number
}

export type Band = {
  id: string
  label: string
  min: number
  max: number | null
  shares: Record<string, number>
}

export type Bucket = {
  id: string
  label: string
  note: string
}

export type Policy = {
  name: string
  buckets: Bucket[]
  bands: Band[]
  stages: Record<string, StageRule>
  infra_id: string
  ef_id: string
  product_id: string
  growth_id: string
  people_id: string
  infra_buffer_id: string
  unallocated_id: string
  discord_per_player_max: number
  concurrent_high: number
  infra_health_uptime_floor: number
  min_runway_months: number
  charter_ef_share: number
  stage_gates: boolean
  community_ratio: boolean
  load_pressure: boolean
  people_from_profit: boolean
  ef_cap: boolean
}

export type AlertLevel = 'red' | 'warn' | 'info'

export type Alert = {
  rule: string
  level: AlertLevel
  message: string
}

export type Allocation = {
  infra: number
  ef_fill: number
  product: number
  growth: number
  people: number
  infra_buffer: number
  unallocated: number
}

export type Health = {
  tps_ok: boolean
  uptime_ok: boolean
  load_pressure: boolean
  infra_healthy: boolean
  growth_blocked: boolean
  discord_ratio: number | null
}

export type Result = {
  inputs: Inputs
  policy: Policy
  band: Band | null
  remaining: number
  infra_shortfall: number
  allocation: Allocation
  by_id: Record<string, number>
  ef_cap: number
  ef_after: number
  ef_progress_pct: number
  ef_charter_target: number
  runway_months: number | null
  health: Health
  alerts: Alert[]
  total_allocated: number
}

export type User = {
  id: string
  email: string
  created_at: string
}

export type Space = {
  id: string
  name: string
  owner_id: string
  policy: Policy
  archived: boolean
  revision: number
  created_at: string
  role?: string
}

export type MonthRecord = {
  space_id: string
  month: string
  inputs: Inputs
  actuals?: Record<string, number>
  planned?: Result
  status: string
  revision: number
  updated_at: string
  updated_by: string
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export type Snapshot = {
  version: 1
  saved_at: string
  inputs: Inputs
  policy: Policy
}
