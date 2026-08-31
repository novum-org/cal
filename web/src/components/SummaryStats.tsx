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
      detail: `Piso ${result.policy.min_runway_months} meses`,
      danger: lowRunway,
    },
  ]
  return (
    <div className="grid divide-y overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0">
      {cells.map((cell) => (
        <div key={cell.label} className="px-4 py-3">
          <div className="text-xs tracking-widest text-muted-foreground uppercase">{cell.label}</div>
          <div
            className={`mt-1 font-mono text-2xl tabular-nums ${cell.danger ? 'text-destructive' : 'text-foreground'}`}
          >
            {cell.value}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{cell.detail}</div>
        </div>
      ))}
    </div>
  )
}
