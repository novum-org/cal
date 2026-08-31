/**
 * Data sources for a month.
 *
 * The app runs fully local today. Anything that will later come from a real
 * service goes behind this one interface, so the UI never has to change when a
 * source is wired up. Nothing here invents an endpoint or a key.
 */

import { readMonth } from './storage.ts'
import type { Inputs } from './types.ts'

export type NovumFinanceSource = {
  readonly id: string
  readonly label: string
  /** Returns only the fields the source actually knows about. */
  fetchMonth(month: string): Promise<Partial<Inputs>>
}

/** Default. Reads a month already saved in this browser. */
export const LocalJsonSource: NovumFinanceSource = {
  id: 'local-json',
  label: 'LocalJsonSource (mes guardado en el navegador)',
  async fetchMonth(month: string): Promise<Partial<Inputs>> {
    const snapshot = readMonth(month)
    return snapshot === null ? {} : snapshot.inputs
  },
}

/** The form itself is the source: it knows nothing extra. */
export const ManualFormSource: NovumFinanceSource = {
  id: 'manual-form',
  label: 'ManualFormSource (carga a mano)',
  async fetchMonth(): Promise<Partial<Inputs>> {
    return {}
  },
}

export const SOURCES: readonly NovumFinanceSource[] = [LocalJsonSource, ManualFormSource]

export const sourceById = (id: string): NovumFinanceSource =>
  SOURCES.find((source) => source.id === id) ?? LocalJsonSource

/*
 * TODO: revenue sources. Each one implements NovumFinanceSource and fills only
 * `cash_in_month` (net of fees and chargebacks, never gross).
 *
 *   TebexSource          -> monthly net payout for the store
 *   CraftingStoreSource  -> same idea, if the store ever moves
 *   StripeSource         -> direct payments and any future subscription
 *
 * TODO: ServerMetricsSource -> tps_pct_above_19, uptime_pct_month,
 * unique_players_week, concurrent_avg, taken from whatever the VPS exporter
 * ends up being (Spark, Prometheus, a plugin, a cron writing JSON).
 *
 * TODO: DiscordSource -> discord_members, discord_net_growth_month.
 *
 * None of these are implemented on purpose. Credentials, base URLs and the
 * shape of each payload are unknown, and guessing them would put fake numbers
 * in front of a real allocation decision. When one is wired:
 *   1. add the file under src/lib/sources/
 *   2. keep the fetch on the server side if it needs a secret
 *   3. push it into SOURCES and nothing in the UI changes
 */
