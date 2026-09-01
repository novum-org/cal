import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BUCKET_ROWS } from '../lib/buckets.ts'
import { usd } from '../lib/format.ts'
import type { Allocation, Result } from '../lib/types.ts'

type Row = {
  key: keyof Allocation
  label: string
  planned: number
  actual: number
  delta: number
}

const buildRows = (planned: Allocation, actuals: Record<string, number>): Row[] =>
  BUCKET_ROWS.map((bucket) => {
    const plan = planned[bucket.key]
    const actual = actuals[bucket.key] ?? 0
    return { key: bucket.key, label: bucket.label, planned: plan, actual, delta: actual - plan }
  })

/** Zero is neither over nor under, so it gets no colour and no sign. */
function Delta({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) {
    return <span className="font-mono text-xs text-muted-foreground">sin desvío</span>
  }
  const over = value > 0
  return (
    <span className={`font-mono tabular-nums ${over ? 'text-destructive' : 'text-chart-2'}`}>
      {over ? '+' : '-'}
      {usd(Math.abs(value))}
    </span>
  )
}

export function CloseSummary({ plan, actuals }: { plan: Result; actuals: Record<string, number> }) {
  const rows = buildRows(plan.allocation, actuals)
  const totalPlanned = rows.reduce((sum, row) => sum + row.planned, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rubro</TableHead>
          <TableHead className="text-right">Plan</TableHead>
          <TableHead className="text-right">Real</TableHead>
          <TableHead className="text-right">Desvío</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
              {usd(row.planned)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{usd(row.actual)}</TableCell>
            <TableCell className="text-right text-sm">
              <Delta value={row.delta} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
            {usd(totalPlanned)}
          </TableCell>
          <TableCell className="text-right font-mono tabular-nums">{usd(totalActual)}</TableCell>
          <TableCell className="text-right text-sm">
            <Delta value={totalActual - totalPlanned} />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

/**
 * The rules that fired when the plan was computed, read off the snapshot rather
 * than recomputed, so a later policy change cannot rewrite the record of why
 * the money went where it went.
 */
export function RulesFired({ plan }: { plan: Result }) {
  if (plan.alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ninguna regla especial se activó sobre este plan.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {plan.alerts.map((alert, index) => (
        <li key={`${alert.rule}-${index}`} className="flex items-start gap-2 text-sm">
          <Badge
            variant={alert.level === 'red' ? 'destructive' : 'secondary'}
            className="mt-0.5 shrink-0 font-mono"
          >
            {alert.rule}
          </Badge>
          <span className="text-muted-foreground">{alert.message}</span>
        </li>
      ))}
    </ul>
  )
}
