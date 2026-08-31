/**
 * Allocation rule engine.
 *
 * All math runs in integer cents and only converts back to USD at the edge,
 * so the rows of the output table always add up to the money that came in.
 * Every rule that fires pushes an Alert whose `rule` id matches ENGINE.md.
 */

import { usd } from './format.ts'
import type {
  Alert,
  Allocation,
  Band,
  Health,
  Inputs,
  Result,
  Settings,
  StageThresholds,
} from './types.ts'

export const DEFAULT_THRESHOLDS: StageThresholds = {
  alpha: { tps_min: 95, uptime_min: null },
  beta: { tps_min: 97, uptime_min: 99.0 },
  v1: { tps_min: 98, uptime_min: 99.5 },
}

export const DEFAULT_SETTINGS: Settings = {
  thresholds: DEFAULT_THRESHOLDS,
  discord_per_player_max: 8,
  concurrent_high: 20,
  infra_health_uptime_floor: 99.0,
  min_runway_months: 2,
}

/** Bands apply to `remaining` (cash_in_month minus infra_cost_month). */
export const BANDS: readonly Band[] = [
  { id: 'micro', label: '$0 a $99', min: 0, max: 99.99, ef: 1, product: 0, growth: 0, people: 0 },
  {
    id: 'mid',
    label: '$100 a $499',
    min: 100,
    max: 499.99,
    ef: 0.2,
    product: 0.5,
    growth: 0.3,
    people: 0,
  },
  {
    id: 'large',
    label: '$500 a $1999',
    min: 500,
    max: 1999.99,
    ef: 0.2,
    product: 0.4,
    growth: 0.25,
    people: 0.15,
  },
  {
    id: 'mega',
    label: '$2000 o más',
    min: 2000,
    max: null,
    ef: 0.2,
    product: 0.35,
    growth: 0.25,
    people: 0.2,
  },
]

const toCents = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100)
const toUsd = (c: number): number => c / 100

export const pickBand = (remainingUsd: number): Band => {
  for (let i = BANDS.length - 1; i >= 0; i--) {
    const band = BANDS[i]!
    if (remainingUsd >= band.min) return band
  }
  return BANDS[0]!
}

export const efCapUsd = (inputs: Inputs): number =>
  toUsd(Math.round(toCents(inputs.infra_cost_month) * inputs.ef_target_months))

export const runwayMonths = (inputs: Inputs): number | null => {
  if (inputs.infra_cost_month <= 0) return null
  const left = inputs.cash_on_hand_start + inputs.cash_in_month - inputs.infra_cost_month
  return left / inputs.infra_cost_month
}

/** Stage gates plus the separate notion of "is the infra itself in trouble". */
export function evaluateHealth(
  inputs: Inputs,
  settings: Settings,
  runway: number | null,
): Health {
  const rule = settings.thresholds[inputs.stage]
  const tps_ok = inputs.tps_pct_above_19 >= rule.tps_min
  const uptime_ok = rule.uptime_min === null ? true : inputs.uptime_pct_month >= rule.uptime_min
  const discord_ratio =
    inputs.unique_players_week > 0 ? inputs.discord_members / inputs.unique_players_week : null
  const load_pressure = !tps_ok && inputs.concurrent_avg >= settings.concurrent_high
  const infra_healthy =
    !load_pressure &&
    inputs.uptime_pct_month >= settings.infra_health_uptime_floor &&
    (runway === null || runway >= settings.min_runway_months)
  const ratio_bad = discord_ratio !== null && discord_ratio > settings.discord_per_player_max
  return {
    tps_ok,
    uptime_ok,
    load_pressure,
    infra_healthy,
    growth_blocked: !tps_ok || !uptime_ok || ratio_bad,
    discord_ratio,
  }
}

const emptyAllocation = (infra: number): Allocation => ({
  infra,
  ef_fill: 0,
  product: 0,
  growth: 0,
  people: 0,
  infra_buffer: 0,
  unallocated: 0,
})

const progress = (value: number, cap: number): number =>
  cap <= 0 ? 100 : Math.min(100, (value / cap) * 100)

/** Charter wording: 20% of accumulated cash, capped at the months of infra. */
function charterTarget(inputs: Inputs, efCapCents: number): number {
  const accumulated = toCents(inputs.cash_on_hand_start + inputs.cash_in_month)
  return toUsd(Math.min(Math.round(accumulated * 0.2), efCapCents))
}

function pushGrowthAlerts(
  alerts: Alert[],
  inputs: Inputs,
  settings: Settings,
  health: Health,
  moved: string,
  target: string,
): void {
  const rule = settings.thresholds[inputs.stage]
  if (!health.tps_ok) {
    alerts.push({
      rule: 'R3',
      level: 'warn',
      message: `Growth queda en 0: el TPS estuvo arriba de 19 solo el ${inputs.tps_pct_above_19}% del tiempo y ${inputs.stage} pide ${rule.tps_min}%. Esos ${moved} van a ${target}.`,
    })
  }
  if (!health.uptime_ok && rule.uptime_min !== null) {
    alerts.push({
      rule: 'R3',
      level: 'warn',
      message: `Growth queda en 0: el uptime del mes fue ${inputs.uptime_pct_month}% y ${inputs.stage} pide ${rule.uptime_min}%. Esos ${moved} van a ${target}.`,
    })
  }
  if (health.discord_ratio !== null && health.discord_ratio > settings.discord_per_player_max) {
    alerts.push({
      rule: 'R4',
      level: 'warn',
      message: `Growth queda en 0: hay ${health.discord_ratio.toFixed(1)} miembros de Discord por cada jugador único de la semana y el máximo es ${settings.discord_per_player_max}. El problema es de conversión y retención, no de publicidad. Esos ${moved} van a ${target}.`,
    })
  }
  if (health.load_pressure) {
    alerts.push({
      rule: 'R5',
      level: 'warn',
      message: `Promedio de ${inputs.concurrent_avg} concurrentes con el TPS por debajo del mínimo. No se gasta en Growth para meterle más carga a un server que ya no da: esa plata queda como reserva de infra.`,
    })
  }
}

function pushContextAlerts(
  alerts: Alert[],
  inputs: Inputs,
  settings: Settings,
  health: Health,
  runway: number | null,
): void {
  if (runway !== null && runway < settings.min_runway_months) {
    alerts.push({
      rule: 'I1',
      level: 'red',
      message: `Runway de ${runway.toFixed(1)} meses, por debajo del piso de ${settings.min_runway_months}. La infra se considera en riesgo hasta que eso mejore.`,
    })
  }
  if (inputs.uptime_pct_month < settings.infra_health_uptime_floor) {
    alerts.push({
      rule: 'I2',
      level: 'warn',
      message: `Uptime de ${inputs.uptime_pct_month}%, abajo del piso de salud de infra (${settings.infra_health_uptime_floor}%). Primero se arregla el server.`,
    })
  }
  if (health.discord_ratio === null && inputs.discord_members > 0) {
    alerts.push({
      rule: 'I3',
      level: 'info',
      message:
        'No hay jugadores únicos cargados en la semana, así que la relación Discord por jugador no se puede medir.',
    })
  }
}

function pushCharterAlert(
  alerts: Alert[],
  efAfterCents: number,
  charterTargetUsd: number,
  efFillCents: number,
): void {
  if (efFillCents <= 0) return
  if (toUsd(efAfterCents) > charterTargetUsd) {
    alerts.push({
      rule: 'I4',
      level: 'info',
      message: `Con este aporte el EF queda en ${usd(toUsd(efAfterCents))}, arriba del objetivo de la carta (${usd(charterTargetUsd)}, 20% del cash acumulado). No rompe ninguna regla, pero conviene tenerlo presente.`,
    })
  }
}

/** Runs the whole month. Pure: same inputs, same output. */
export function calculate(inputs: Inputs, settings: Settings): Result {
  const alerts: Alert[] = []
  const cashIn = toCents(inputs.cash_in_month)
  const infraCost = toCents(inputs.infra_cost_month)
  const efCurrent = toCents(inputs.ef_current)
  const efCap = Math.max(0, Math.round(infraCost * inputs.ef_target_months))
  const runway = runwayMonths(inputs)
  const health = evaluateHealth(inputs, settings, runway)
  const shortfall = Math.max(0, infraCost - cashIn)

  const base = {
    inputs,
    settings,
    ef_cap: toUsd(efCap),
    ef_charter_target: charterTarget(inputs, efCap),
    runway_months: runway,
    health,
  }

  // Rule 1: infra is paid before anything else exists.
  if (shortfall > 0) {
    alerts.push({
      rule: 'R1',
      level: 'red',
      message: `No alcanza para infra: faltan ${usd(toUsd(shortfall))}. Todo lo que entró va a infra y no queda nada para repartir, así que Product, Growth y People quedan en 0.`,
    })
    pushContextAlerts(alerts, inputs, settings, health, runway)
    return {
      ...base,
      band: null,
      remaining: 0,
      infra_shortfall: toUsd(shortfall),
      allocation: emptyAllocation(toUsd(cashIn)),
      ef_after: toUsd(efCurrent),
      ef_progress_pct: progress(efCurrent, efCap),
      alerts,
      total_allocated: toUsd(cashIn),
    }
  }

  const remaining = cashIn - infraCost
  const band = pickBand(toUsd(remaining))
  alerts.push({
    rule: 'B0',
    level: 'info',
    message: `Banda ${band.label}: después de pagar infra quedan ${usd(toUsd(remaining))} para repartir.`,
  })

  // Rule 2: the emergency fund fills up to its cap and not one cent further.
  const efRoom = Math.max(0, efCap - efCurrent)
  const efShare = Math.floor(remaining * band.ef)
  const efFill = Math.min(efShare, efRoom)
  const efOverflow = efShare - efFill
  if (efShare > 0 && efRoom === 0) {
    alerts.push({
      rule: 'R2',
      level: 'info',
      message: `El EF ya está en el tope de ${usd(toUsd(efCap))} (${inputs.ef_target_months} meses de infra). No se llena más y esa parte queda sin asignar.`,
    })
  } else if (efOverflow > 0) {
    alerts.push({
      rule: 'R2',
      level: 'info',
      message: `El EF se llena hasta el tope de ${usd(toUsd(efCap))} y sobran ${usd(toUsd(efOverflow))} de esa parte, que quedan sin asignar.`,
    })
  }

  let product = Math.floor(remaining * band.product)
  let growth = Math.floor(remaining * band.growth)
  let people = Math.floor(remaining * band.people)
  let infraBuffer = 0

  // Rules 3, 4 and 5: when Growth is blocked its share moves somewhere useful.
  if (growth > 0 && health.growth_blocked) {
    const target = health.infra_healthy ? 'Product' : 'reserva de infra'
    if (health.infra_healthy) product += growth
    else infraBuffer += growth
    pushGrowthAlerts(alerts, inputs, settings, health, usd(toUsd(growth)), target)
    growth = 0
  }

  // Rule 6: People only comes out of the profit left after infra and the EF fill.
  const profitAfterEf = Math.max(0, remaining - efFill)
  if (people > profitAfterEf) people = profitAfterEf
  if (band.people > 0 && people === 0) {
    alerts.push({
      rule: 'R6',
      level: 'warn',
      message:
        'People queda en 0: después de infra y del aporte al EF no sobra ganancia para bonos ni reparto.',
    })
  }

  const unallocated = remaining - efFill - product - growth - people - infraBuffer
  const efAfter = efCurrent + efFill
  pushContextAlerts(alerts, inputs, settings, health, runway)
  pushCharterAlert(alerts, efAfter, base.ef_charter_target, efFill)

  return {
    ...base,
    band,
    remaining: toUsd(remaining),
    infra_shortfall: 0,
    allocation: {
      infra: toUsd(infraCost),
      ef_fill: toUsd(efFill),
      product: toUsd(product),
      growth: toUsd(growth),
      people: toUsd(people),
      infra_buffer: toUsd(infraBuffer),
      unallocated: toUsd(unallocated),
    },
    ef_after: toUsd(efAfter),
    ef_progress_pct: progress(efAfter, efCap),
    alerts,
    total_allocated: toUsd(cashIn),
  }
}
