/** Copy as markdown: the summary the owner pastes into notes or a doc. */

import { monthsLabel, pct, ratio, shareOf, usd } from './format.ts'
import type { Result } from './types.ts'

const row = (label: string, amount: number, total: number): string =>
  `| ${label} | ${usd(amount)} | ${shareOf(amount, total)} |`

function buildTable(result: Result): string[] {
  const a = result.allocation
  const total = result.total_allocated
  return [
    '| Rubro | USD | % del cash in |',
    '| --- | ---: | ---: |',
    row('Infra', a.infra, total),
    row('EF fill', a.ef_fill, total),
    row('Product', a.product, total),
    row('Growth', a.growth, total),
    row('People', a.people, total),
    row('Reserva de infra', a.infra_buffer, total),
    row('Sin asignar', a.unallocated, total),
  ]
}

function buildContext(result: Result): string[] {
  const i = result.inputs
  return [
    `- Banda: ${result.band === null ? 'sin banda, no se cubrió infra' : result.band.label}`,
    `- Cash in: ${usd(i.cash_in_month)} | Infra: ${usd(i.infra_cost_month)} | Sobrante: ${usd(result.remaining)}`,
    `- Cash on hand al inicio: ${usd(i.cash_on_hand_start)}`,
    `- Runway: ${monthsLabel(result.runway_months)}`,
    `- EF: ${usd(result.ef_after)} de ${usd(result.ef_cap)} (${pct(result.ef_progress_pct)})`,
    `- TPS arriba de 19: ${pct(i.tps_pct_above_19)} | Uptime: ${pct(i.uptime_pct_month, 2)}`,
    `- Discord: ${i.discord_members} (${i.discord_net_growth_month} neto) | Jugadores únicos semana: ${i.unique_players_week} | Concurrentes promedio: ${i.concurrent_avg}`,
    `- Discord por jugador: ${ratio(result.health.discord_ratio)}`,
  ]
}

export function toMarkdown(result: Result): string {
  const i = result.inputs
  const alerts = result.alerts.map((alert) => `- [${alert.rule}] ${alert.message}`)
  const notes = i.notes.trim()
  return [
    `# Novum ${i.month} (${i.stage})`,
    '',
    ...buildContext(result),
    '',
    ...buildTable(result),
    '',
    '## Reglas que aplicaron',
    ...(alerts.length > 0 ? alerts : ['- Ninguna regla especial.']),
    ...(notes.length > 0 ? ['', '## Notas', notes] : []),
    '',
  ].join('\n')
}
