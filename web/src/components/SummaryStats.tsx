import { motion } from 'motion/react'

import { itemVariants, listVariants } from '../lib/motion.ts'
import { monthsLabel, usd } from '../lib/format.ts'
import type { Result } from '../lib/types.ts'

export function SummaryStats({ result }: { result: Result }) {
  const short = result.infra_shortfall > 0
  const lowRunway =
    result.runway_months !== null && result.runway_months < result.policy.min_runway_months
  const cells = [
    {
      label: 'Entró',
      value: usd(result.inputs.cash_in_month),
      detail: `${result.inputs.month} · ${result.inputs.stage}`,
      danger: false,
    },
    {
      label: 'Infra',
      value: usd(result.inputs.infra_cost_month),
      detail: short ? `Faltan ${usd(result.infra_shortfall)}` : 'Cubierta',
      danger: short,
    },
    {
      label: 'Sobrante',
      value: usd(result.remaining),
      detail: result.band === null ? 'Sin banda' : result.band.label,
      danger: false,
    },
    {
      label: 'Runway',
      value: monthsLabel(result.runway_months),
      detail:
        result.runway_months === 0
          ? 'No cubre ni este mes'
          : `Piso ${result.policy.min_runway_months} meses`,
      danger: lowRunway,
    },
  ]
  return (
    <motion.div
      variants={listVariants}
      initial="initial"
      animate="animate"
      className="grid divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0"
    >
      {cells.map((cell) => (
        <motion.div key={cell.label} variants={itemVariants} className="px-4 py-3">
          <div className="text-xs tracking-widest text-muted-foreground uppercase">{cell.label}</div>
          <div
            className={`mt-1 font-mono text-2xl tabular-nums transition-colors duration-200 ease-hermite ${cell.danger ? 'text-destructive' : 'text-foreground'}`}
          >
            {cell.value}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{cell.detail}</div>
        </motion.div>
      ))}
    </motion.div>
  )
}
