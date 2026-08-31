import { shareOf, usd } from '../lib/format.ts'
import type { Allocation, Result } from '../lib/types.ts'
import { Card } from './Card.tsx'

type Row = { key: keyof Allocation; label: string; note: string }

const ROWS: readonly Row[] = [
  { key: 'infra', label: 'Infra', note: 'Se paga antes que nada' },
  { key: 'ef_fill', label: 'EF fill', note: 'Aporte al fondo de emergencia' },
  { key: 'product', label: 'Product', note: 'Server, mundo, herramientas' },
  { key: 'growth', label: 'Growth', note: 'Difusión, solo con la casa en orden' },
  { key: 'people', label: 'People', note: 'Bonos y reparto, solo con ganancia' },
  { key: 'infra_buffer', label: 'Reserva de infra', note: 'Growth frenado por salud del server' },
  { key: 'unallocated', label: 'Sin asignar', note: 'Queda en la caja, lo decidís vos' },
]

export function AllocationTable({ result }: { result: Result }) {
  const total = result.total_allocated
  return (
    <Card title="Reparto del mes" aside={<span className="text-xs text-stone-500">USD</span>}>
      <table className="w-full text-sm">
        <tbody>
          {ROWS.map((row) => {
            const amount = result.allocation[row.key]
            const off = amount === 0
            return (
              <tr key={row.key} className="border-b border-stone-100 last:border-0">
                <td className={`py-2 pr-2 ${off ? 'text-stone-400' : 'text-stone-900'}`}>
                  <div>{row.label}</div>
                  <div className="text-xs text-stone-400">{row.note}</div>
                </td>
                <td
                  className={`py-2 text-right font-mono text-base tabular-nums ${off ? 'text-stone-400' : 'text-stone-900'}`}
                >
                  {usd(amount)}
                </td>
                <td className="w-16 py-2 text-right font-mono text-xs tabular-nums text-stone-400">
                  {shareOf(amount, total)}
                </td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-stone-300">
            <td className="py-2 pr-2 text-stone-900">Total repartido</td>
            <td className="py-2 text-right font-mono text-base tabular-nums text-stone-900">
              {usd(total)}
            </td>
            <td className="py-2 text-right font-mono text-xs tabular-nums text-stone-400">100.0%</td>
          </tr>
        </tbody>
      </table>
    </Card>
  )
}
