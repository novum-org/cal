/**
 * localStorage persistence plus JSON import and export.
 * There is no backend yet, so a month lives as one Snapshot under its own key.
 * Parsing never throws: it returns a Parsed<T> so callers handle the failure.
 */

import { DEFAULT_SETTINGS } from './engine.ts'
import { DEFAULT_INPUTS } from './defaults.ts'
import { STAGES } from './types.ts'
import type { Inputs, Parsed, Settings, Snapshot, Stage, StageThresholds } from './types.ts'

const DRAFT_KEY = 'novum-cal.draft'
const MONTH_PREFIX = 'novum-cal.month.'

const monthKey = (month: string): string => `${MONTH_PREFIX}${month}`

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)

const stage = (v: unknown, fallback: Stage): Stage =>
  typeof v === 'string' && (STAGES as readonly string[]).includes(v) ? (v as Stage) : fallback

/** Fills every field, so a partial or hand edited file still imports. */
export function coerceInputs(raw: unknown, base: Inputs = DEFAULT_INPUTS): Inputs {
  const r = isRecord(raw) ? raw : {}
  return {
    month: str(r['month'], base.month),
    cash_in_month: num(r['cash_in_month'], base.cash_in_month),
    cash_on_hand_start: num(r['cash_on_hand_start'], base.cash_on_hand_start),
    infra_cost_month: num(r['infra_cost_month'], base.infra_cost_month),
    ef_current: num(r['ef_current'], base.ef_current),
    ef_target_months: num(r['ef_target_months'], base.ef_target_months),
    tps_pct_above_19: num(r['tps_pct_above_19'], base.tps_pct_above_19),
    uptime_pct_month: num(r['uptime_pct_month'], base.uptime_pct_month),
    discord_members: num(r['discord_members'], base.discord_members),
    discord_net_growth_month: num(r['discord_net_growth_month'], base.discord_net_growth_month),
    unique_players_week: num(r['unique_players_week'], base.unique_players_week),
    concurrent_avg: num(r['concurrent_avg'], base.concurrent_avg),
    stage: stage(r['stage'], base.stage),
    notes: str(r['notes'], base.notes),
  }
}

function coerceThresholds(raw: unknown): StageThresholds {
  const r = isRecord(raw) ? raw : {}
  const one = (key: Stage): StageThresholds[Stage] => {
    const fallback = DEFAULT_SETTINGS.thresholds[key]
    const v = isRecord(r[key]) ? (r[key] as Record<string, unknown>) : {}
    const uptime = v['uptime_min']
    return {
      tps_min: num(v['tps_min'], fallback.tps_min),
      uptime_min: uptime === null ? null : num(uptime, fallback.uptime_min ?? 0),
    }
  }
  return { alpha: one('alpha'), beta: one('beta'), v1: one('v1') }
}

export function coerceSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {}
  return {
    thresholds: coerceThresholds(r['thresholds']),
    discord_per_player_max: num(
      r['discord_per_player_max'],
      DEFAULT_SETTINGS.discord_per_player_max,
    ),
    concurrent_high: num(r['concurrent_high'], DEFAULT_SETTINGS.concurrent_high),
    infra_health_uptime_floor: num(
      r['infra_health_uptime_floor'],
      DEFAULT_SETTINGS.infra_health_uptime_floor,
    ),
    min_runway_months: num(r['min_runway_months'], DEFAULT_SETTINGS.min_runway_months),
  }
}

export const toSnapshot = (inputs: Inputs, settings: Settings): Snapshot => ({
  version: 1,
  saved_at: new Date().toISOString(),
  inputs,
  settings,
})

export function parseSnapshot(raw: unknown): Parsed<Snapshot> {
  if (!isRecord(raw)) return { ok: false, error: 'El JSON no es un objeto.' }
  if (!isRecord(raw['inputs'])) return { ok: false, error: 'Falta el objeto "inputs".' }
  return {
    ok: true,
    value: {
      version: 1,
      saved_at: str(raw['saved_at'], new Date().toISOString()),
      inputs: coerceInputs(raw['inputs']),
      settings: coerceSettings(raw['settings']),
    },
  }
}

export function parseSnapshotJson(text: string): Parsed<Snapshot> {
  try {
    return parseSnapshot(JSON.parse(text) as unknown)
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' }
  }
}

export const saveDraft = (inputs: Inputs, settings: Settings): boolean =>
  write(DRAFT_KEY, JSON.stringify(toSnapshot(inputs, settings)))

export function loadDraft(): Snapshot {
  const raw = read(DRAFT_KEY)
  if (raw === null) return toSnapshot(DEFAULT_INPUTS, DEFAULT_SETTINGS)
  const parsed = parseSnapshotJson(raw)
  return parsed.ok ? parsed.value : toSnapshot(DEFAULT_INPUTS, DEFAULT_SETTINGS)
}

export const saveMonth = (snapshot: Snapshot): boolean =>
  write(monthKey(snapshot.inputs.month), JSON.stringify(snapshot))

export function readMonth(month: string): Snapshot | null {
  const raw = read(monthKey(month))
  if (raw === null) return null
  const parsed = parseSnapshotJson(raw)
  return parsed.ok ? parsed.value : null
}

/** Months already saved in this browser, newest first. */
export function listMonths(): string[] {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(MONTH_PREFIX)) keys.push(key.slice(MONTH_PREFIX.length))
    }
    return keys.sort().reverse()
  } catch {
    return []
  }
}
