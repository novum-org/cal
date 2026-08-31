/** Seed values. Placeholders only: the real numbers come from the owner. */

import { currentMonth } from './format.ts'
import type { Inputs } from './types.ts'

export const DEFAULT_INPUTS: Inputs = {
  month: currentMonth(),
  cash_in_month: 0,
  cash_on_hand_start: 0,
  infra_cost_month: 35,
  ef_current: 0,
  ef_target_months: 6,
  tps_pct_above_19: 100,
  uptime_pct_month: 100,
  discord_members: 0,
  discord_net_growth_month: 0,
  unique_players_week: 0,
  concurrent_avg: 0,
  stage: 'alpha',
  notes: '',
}
