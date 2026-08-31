import { pct, usd } from '../lib/format.ts'
import type { Result } from '../lib/types.ts'
import { Card } from './Card.tsx'

const clamp = (n: number): number => Math.max(0, Math.min(100, n))

export function EfBar({ result }: { result: Result }) {
  const cap = result.ef_cap
  const current = result.inputs.ef_current
  const fill = result.allocation.ef_fill
  const currentPct = cap <= 0 ? 0 : clamp((current / cap) * 100)
  const fillPct = cap <= 0 ? 0 : clamp((fill / cap) * 100)
  const charterPct = cap <= 0 ? 0 : clamp((result.ef_charter_target / cap) * 100)

  return (
    <Card
      title="Fondo de emergencia"
      aside={
        <span className="font-mono text-xs tabular-nums text-stone-500">
          {pct(result.ef_progress_pct)} del tope
        </span>
      }
    >
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="absolute inset-y-0 left-0 bg-stone-700" style={{ width: `${currentPct}%` }} />
        <div
          className="absolute inset-y-0 bg-teal-600"
          style={{ left: `${currentPct}%`, width: `${fillPct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-stone-900/60"
          style={{ left: `${charterPct}%` }}
          title="Objetivo de la carta"
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <Item label="Hoy" value={usd(current)} />
        <Item label="Aporte" value={usd(fill)} />
        <Item label="Queda en" value={usd(result.ef_after)} />
        <Item label="Tope" value={usd(cap)} />
      </dl>
      <p className="mt-3 text-xs text-stone-500">
        Tope = infra por {result.inputs.ef_target_months} meses. La marca fina es el objetivo de la
        carta: {usd(result.ef_charter_target)}, o sea 20% del cash acumulado.
      </p>
    </Card>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-mono text-base tabular-nums text-stone-900">{value}</dd>
    </div>
  )
}
