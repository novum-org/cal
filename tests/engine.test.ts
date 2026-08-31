import { describe, expect, test } from 'bun:test'

import { DEFAULT_SETTINGS, calculate, pickBand } from '../src/lib/engine.ts'
import { DEFAULT_INPUTS } from '../src/lib/defaults.ts'
import type { Inputs, Result, Settings } from '../src/lib/types.ts'

const healthy: Partial<Inputs> = {
  tps_pct_above_19: 100,
  uptime_pct_month: 100,
  concurrent_avg: 5,
  unique_players_week: 50,
  discord_members: 100,
}

const mk = (over: Partial<Inputs>): Inputs => ({ ...DEFAULT_INPUTS, ...healthy, ...over })

const run = (over: Partial<Inputs>, settings: Settings = DEFAULT_SETTINGS): Result =>
  calculate(mk(over), settings)

const ruleIds = (result: Result): string[] => result.alerts.map((a) => a.rule)

const sum = (result: Result): number => {
  const a = result.allocation
  return a.infra + a.ef_fill + a.product + a.growth + a.people + a.infra_buffer + a.unallocated
}

describe('bands', () => {
  test('picks by remaining', () => {
    expect(pickBand(0).id).toBe('micro')
    expect(pickBand(99.99).id).toBe('micro')
    expect(pickBand(100).id).toBe('mid')
    expect(pickBand(499.99).id).toBe('mid')
    expect(pickBand(500).id).toBe('large')
    expect(pickBand(1999.99).id).toBe('large')
    expect(pickBand(2000).id).toBe('mega')
  })

  test('mid band splits 20 / 50 / 30 with no People', () => {
    const r = run({ cash_in_month: 235, infra_cost_month: 35, ef_target_months: 6 })
    expect(r.band?.id).toBe('mid')
    expect(r.remaining).toBe(200)
    expect(r.allocation.ef_fill).toBe(40)
    expect(r.allocation.product).toBe(100)
    expect(r.allocation.growth).toBe(60)
    expect(r.allocation.people).toBe(0)
  })

  test('large band pays People', () => {
    const r = run({ cash_in_month: 1035, infra_cost_month: 35 })
    expect(r.band?.id).toBe('large')
    expect(r.allocation.ef_fill).toBe(200)
    expect(r.allocation.product).toBe(400)
    expect(r.allocation.growth).toBe(250)
    expect(r.allocation.people).toBe(150)
  })

  test('mega band', () => {
    const r = run({ cash_in_month: 3000, infra_cost_month: 1000 })
    expect(r.band?.id).toBe('mega')
    expect(r.allocation.ef_fill).toBe(400)
    expect(r.allocation.product).toBe(700)
    expect(r.allocation.growth).toBe(500)
    expect(r.allocation.people).toBe(400)
  })

  test('micro band sends the leftover to the EF when infra is covered', () => {
    const r = run({ cash_in_month: 85, infra_cost_month: 35 })
    expect(r.band?.id).toBe('micro')
    expect(r.allocation.ef_fill).toBe(50)
    expect(r.allocation.product).toBe(0)
    expect(r.allocation.unallocated).toBe(0)
  })

  test('micro band leaves the leftover as buffer when the EF is full', () => {
    const r = run({ cash_in_month: 85, infra_cost_month: 35, ef_current: 210 })
    expect(r.allocation.ef_fill).toBe(0)
    expect(r.allocation.unallocated).toBe(50)
  })
})

describe('rule 1: infra first', () => {
  test('a shortfall zeroes everything else', () => {
    const r = run({ cash_in_month: 20, infra_cost_month: 35 })
    expect(r.infra_shortfall).toBe(15)
    expect(r.allocation.infra).toBe(20)
    expect(r.allocation.product).toBe(0)
    expect(r.allocation.growth).toBe(0)
    expect(r.allocation.people).toBe(0)
    expect(r.allocation.ef_fill).toBe(0)
    expect(r.band).toBeNull()
    expect(ruleIds(r)).toContain('R1')
  })

  test('exactly covering infra leaves nothing to split', () => {
    const r = run({ cash_in_month: 35, infra_cost_month: 35 })
    expect(r.infra_shortfall).toBe(0)
    expect(r.remaining).toBe(0)
    expect(r.allocation.unallocated).toBe(0)
  })
})

describe('rule 2: EF cap', () => {
  test('cap is infra times ef_target_months', () => {
    const r = run({ cash_in_month: 500, infra_cost_month: 35, ef_target_months: 6 })
    expect(r.ef_cap).toBe(210)
  })

  test('fills only up to the cap and parks the rest', () => {
    const r = run({ cash_in_month: 1035, infra_cost_month: 35, ef_current: 150 })
    expect(r.allocation.ef_fill).toBe(60)
    expect(r.ef_after).toBe(210)
    expect(r.allocation.unallocated).toBe(140)
    expect(ruleIds(r)).toContain('R2')
  })

  test('a full EF sends its whole share to the buffer', () => {
    const r = run({ cash_in_month: 1035, infra_cost_month: 35, ef_current: 210 })
    expect(r.allocation.ef_fill).toBe(0)
    expect(r.allocation.unallocated).toBe(200)
    expect(r.ef_progress_pct).toBe(100)
  })
})

describe('rule 3: stage gates', () => {
  test('TPS below the alpha gate moves Growth to Product', () => {
    const r = run({ cash_in_month: 1035, infra_cost_month: 35, tps_pct_above_19: 94 })
    expect(r.allocation.growth).toBe(0)
    expect(r.allocation.product).toBe(650)
    expect(r.allocation.infra_buffer).toBe(0)
    expect(ruleIds(r)).toContain('R3')
  })

  test('alpha ignores uptime, beta does not', () => {
    const low = { cash_in_month: 1035, infra_cost_month: 35, uptime_pct_month: 99.4 }
    expect(run({ ...low, stage: 'alpha' }).allocation.growth).toBe(250)
    expect(run({ ...low, stage: 'beta', tps_pct_above_19: 99 }).allocation.growth).toBe(250)
    expect(run({ ...low, stage: 'v1', tps_pct_above_19: 99 }).allocation.growth).toBe(0)
  })

  test('unhealthy infra parks the Growth share as infra reserve', () => {
    const r = run({
      cash_in_month: 1035,
      infra_cost_month: 35,
      stage: 'v1',
      tps_pct_above_19: 99,
      uptime_pct_month: 98.5,
    })
    expect(r.allocation.growth).toBe(0)
    expect(r.allocation.infra_buffer).toBe(250)
    expect(r.allocation.product).toBe(400)
  })
})

describe('rule 4: community ratio', () => {
  test('too many Discord members per player kills Growth', () => {
    const r = run({
      cash_in_month: 1035,
      infra_cost_month: 35,
      discord_members: 500,
      unique_players_week: 50,
    })
    expect(r.health.discord_ratio).toBe(10)
    expect(r.allocation.growth).toBe(0)
    expect(r.allocation.product).toBe(650)
    expect(ruleIds(r)).toContain('R4')
  })

  test('the ratio is skipped when there are no players', () => {
    const r = run({ cash_in_month: 1035, infra_cost_month: 35, unique_players_week: 0 })
    expect(r.health.discord_ratio).toBeNull()
    expect(r.allocation.growth).toBe(250)
    expect(ruleIds(r)).toContain('I3')
  })
})

describe('rule 5: load pressure', () => {
  test('high concurrency plus failing TPS parks Growth as infra reserve', () => {
    const r = run({
      cash_in_month: 1035,
      infra_cost_month: 35,
      tps_pct_above_19: 90,
      concurrent_avg: 40,
    })
    expect(r.health.load_pressure).toBe(true)
    expect(r.health.infra_healthy).toBe(false)
    expect(r.allocation.growth).toBe(0)
    expect(r.allocation.infra_buffer).toBe(250)
    expect(ruleIds(r)).toContain('R5')
  })

  test('high concurrency alone changes nothing', () => {
    const r = run({ cash_in_month: 1035, infra_cost_month: 35, concurrent_avg: 40 })
    expect(r.health.load_pressure).toBe(false)
    expect(r.allocation.growth).toBe(250)
  })
})

describe('rule 6: People comes out of profit', () => {
  test('People never exceeds what is left after infra and the EF fill', () => {
    for (const cash of [535, 700, 1035, 2035, 5000]) {
      const r = run({ cash_in_month: cash, infra_cost_month: 35 })
      expect(r.allocation.people).toBeLessThanOrEqual(r.remaining - r.allocation.ef_fill)
    }
  })

  test('no leftover means no People', () => {
    const r = run({ cash_in_month: 35, infra_cost_month: 35 })
    expect(r.allocation.people).toBe(0)
  })
})

describe('runway and totals', () => {
  test('runway counts months of infra covered after this month', () => {
    const r = run({ cash_on_hand_start: 100, cash_in_month: 200, infra_cost_month: 50 })
    expect(r.runway_months).toBe(5)
  })

  test('no infra cost means no runway to report', () => {
    expect(run({ infra_cost_month: 0 }).runway_months).toBeNull()
  })

  test('a short runway is flagged', () => {
    const r = run({ cash_on_hand_start: 0, cash_in_month: 70, infra_cost_month: 35 })
    expect(ruleIds(r)).toContain('I1')
  })

  test('the rows always add up to the cash that came in', () => {
    const cases: Partial<Inputs>[] = [
      { cash_in_month: 0, infra_cost_month: 35 },
      { cash_in_month: 20, infra_cost_month: 35 },
      { cash_in_month: 85.37, infra_cost_month: 35 },
      { cash_in_month: 333.33, infra_cost_month: 35.55, ef_current: 12.5 },
      { cash_in_month: 1234.56, infra_cost_month: 47.89, tps_pct_above_19: 80 },
      { cash_in_month: 9999.99, infra_cost_month: 120.01, ef_current: 700 },
    ]
    for (const c of cases) {
      const r = run(c)
      expect(sum(r)).toBeCloseTo(r.inputs.cash_in_month, 2)
    }
  })
})
