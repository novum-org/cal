import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { pct, usd } from '../lib/format.ts'
import type { Result } from '../lib/types.ts'

export function EfBar({ result }: { result: Result }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Fondo de emergencia</CardTitle>
        <CardDescription>
          {pct(result.ef_progress_pct)} del tope · {usd(result.ef_after)} de {usd(result.ef_cap)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={result.ef_progress_pct} className="h-2" />
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Hoy</dt>
            <dd className="font-mono tabular-nums">{usd(result.inputs.ef_current)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aporte</dt>
            <dd className="font-mono tabular-nums">{usd(result.allocation.ef_fill)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Queda en</dt>
            <dd className="font-mono tabular-nums">{usd(result.ef_after)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tope</dt>
            <dd className="font-mono tabular-nums">{usd(result.ef_cap)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Tope = infra × {result.inputs.ef_target_months} meses. Objetivo de carta:{' '}
          {usd(result.ef_charter_target)}.
        </p>
      </CardContent>
    </Card>
  )
}
