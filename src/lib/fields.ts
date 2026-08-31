/** Form layout as data: one descriptor per numeric input. */

import type { NumericInputKey } from './types.ts'

export type FieldSpec = {
  key: NumericInputKey
  label: string
  step: number
  prefix?: string
  suffix?: string
  hint?: string
}

export type FieldGroup = {
  title: string
  fields: readonly FieldSpec[]
}

export const INPUT_GROUPS: readonly FieldGroup[] = [
  {
    title: 'Plata',
    fields: [
      { key: 'cash_in_month', label: 'Entró este mes', step: 10, prefix: 'USD' },
      { key: 'cash_on_hand_start', label: 'Caja al empezar el mes', step: 10, prefix: 'USD' },
      {
        key: 'infra_cost_month',
        label: 'Costo de infra del mes',
        step: 5,
        prefix: 'USD',
        hint: 'VPS, dominio, backups y plugins pagos obligatorios',
      },
      { key: 'ef_current', label: 'Fondo de emergencia hoy', step: 10, prefix: 'USD' },
      {
        key: 'ef_target_months',
        label: 'Meses de infra que tiene que cubrir el EF',
        step: 1,
        suffix: 'meses',
      },
    ],
  },
  {
    title: 'Server',
    fields: [
      { key: 'tps_pct_above_19', label: 'Tiempo con TPS de 19 o más', step: 0.5, suffix: '%' },
      { key: 'uptime_pct_month', label: 'Uptime del mes', step: 0.1, suffix: '%' },
      { key: 'concurrent_avg', label: 'Concurrentes promedio', step: 1 },
    ],
  },
  {
    title: 'Comunidad',
    fields: [
      { key: 'discord_members', label: 'Miembros de Discord', step: 10 },
      { key: 'discord_net_growth_month', label: 'Crecimiento neto de Discord', step: 10 },
      { key: 'unique_players_week', label: 'Jugadores únicos por semana', step: 5 },
    ],
  },
]
