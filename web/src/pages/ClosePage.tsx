import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ActualsForm } from '../components/ActualsForm.tsx'
import { VarianceChart } from '../components/AllocationCharts.tsx'
import { CloseSummary, RulesFired } from '../components/CloseSummary.tsx'
import { JsonPanel } from '../components/JsonPanel.tsx'
import { MonthComments } from '../components/MonthComments.tsx'
import type { Inputs } from '../lib/types.ts'
import { useSession } from '../session/SessionContext.tsx'

/** True when the month has been edited since the plan was computed from it. */
const planIsStale = (planned: Inputs, current: Inputs): boolean =>
  (Object.keys(planned) as (keyof Inputs)[]).some((key) => planned[key] !== current[key])

const STATUS_LABEL: Record<string, string> = {
  draft: 'borrador',
  planned: 'planificado',
  closed: 'cerrado',
}

export function ClosePage() {
  const {
    id,
    inputs,
    monthRec,
    snapshot,
    plan,
    closeMonth,
    reopenMonth,
    exportMonth,
    exportDump,
    copyMarkdown,
    setActuals,
  } = useSession()

  const actuals = monthRec?.actuals ?? {}
  const planned = monthRec?.planned
  const closed = monthRec?.status === 'closed'
  const stale = planned !== undefined && planIsStale(planned.inputs, inputs)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          Guardá el plan, cargá lo que realmente se gastó, y cerrá. Cerrar congela los números
          del mes; para corregirlos hay que reabrirlo.
        </p>
        <Badge variant={closed ? 'secondary' : 'outline'} className="font-mono">
          {STATUS_LABEL[monthRec?.status ?? 'draft'] ?? monthRec?.status}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {closed ? (
          <Button type="button" onClick={reopenMonth}>
            Reabrir mes
          </Button>
        ) : (
          <Button type="button" onClick={plan}>
            Guardar plan
          </Button>
        )}
        <Button type="button" variant="outline" onClick={copyMarkdown}>
          Copiar markdown
        </Button>
        <Button type="button" variant="outline" onClick={exportMonth}>
          Exportar mes
        </Button>
        <Button type="button" variant="outline" onClick={exportDump}>
          Dump para migrar
        </Button>
      </div>

      {planned === undefined ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Todavía no hay plan</CardTitle>
            <CardDescription>
              Guardá el plan para congelar el reparto y la política con la que se calculó. Recién
              ahí tiene sentido comparar contra lo real.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Plan contra real</CardTitle>
            <CardDescription>
              Plan calculado con la política <span className="font-mono">{planned.policy.name}</span>{' '}
              guardada en el mes.
              {stale && ' Los inputs cambiaron desde entonces: volvé a guardar el plan.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <CloseSummary plan={planned} actuals={actuals} />
            <RulesFired plan={planned} />
            <VarianceChart planned={planned.allocation} actuals={actuals} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Actuales</CardTitle>
          <CardDescription>Lo que realmente salió de la caja, por rubro.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActualsForm actuals={actuals} onChange={setActuals} />
          <Button type="button" className="mt-4" onClick={() => closeMonth(actuals)}>
            {closed ? 'Actualizar reales' : 'Cerrar mes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Comentarios</CardTitle>
          <CardDescription>
            Se guardan al lado del mes, así comentar un mes cerrado no toca el snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthComments id={id} month={inputs.month} />
        </CardContent>
      </Card>

      <JsonPanel snapshot={snapshot} />
    </div>
  )
}
