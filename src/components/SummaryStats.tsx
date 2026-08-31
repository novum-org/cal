import { monthsLabel, usd } from '../lib/format.ts'
import type { Result } from '../lib/types.ts'

type StatProps = {
  label: string
  value: string
  detail?: string
  danger?: boolean
}

function Stat({ label, value, detail, danger = false }: StatProps) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <div className="text-xs tracking-widest text-stone-500 uppercase">{label}</div>
      <div
        className={`mt-1 font-mono text-2xl tabular-nums ${danger ? 'text-red-700' : 'text-stone-900'}`}
      >
        {value}
      </div>
      <div className="mt-0.5 h-4 text-xs text-stone-500">{detail ?? ''}</div>
    </div>
  )
}

export function SummaryStats({ result }: { result: Result }) {
  const short = result.infra_shortfall > 0
  const lowRunway =
    result.runway_months !== null && result.runway_months < result.settings.min_runway_months
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Entró"
        value={usd(result.inputs.cash_in_month)}
        detail={`${result.inputs.month} | ${result.inputs.stage}`}
      />
      <Stat
        label="Infra"
        value={usd(result.inputs.infra_cost_month)}
        detail={short ? `Faltan ${usd(result.infra_shortfall)}` : 'Cubierta'}
        danger={short}
      />
      <Stat
        label="Sobrante"
        value={usd(result.remaining)}
        detail={result.band === null ? 'Sin banda' : `Banda ${result.band.label}`}
      />
      <Stat
        label="Runway"
        value={monthsLabel(result.runway_months)}
        detail={`Piso ${result.settings.min_runway_months} meses`}
        danger={lowRunway}
      />
    </div>
  )
}
