import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VarianceChart } from '../components/AllocationCharts.tsx'
import { JsonPanel } from '../components/JsonPanel.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { BUCKET_ROWS } from '../lib/buckets.ts'
import { useSession } from '../session/SessionContext.tsx'

export function ClosePage() {
  const {
    result,
    monthRec,
    snapshot,
    plan,
    closeMonth,
    exportMonth,
    exportDump,
    copyMarkdown,
    setActuals,
  } = useSession()
  const actuals = monthRec?.actuals ?? {}
  const planned = monthRec?.planned?.allocation ?? result?.allocation

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Guardá el plan, cargá lo que realmente se gastó, y exportá. El dump privado es para
        migrar a self-host.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={plan}>
          Guardar plan
        </Button>
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
      {planned !== undefined && <VarianceChart planned={planned} actuals={actuals} />}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Actuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {BUCKET_ROWS.map((row) => (
              <NumberField
                key={row.key}
                name={`actual-${row.key}`}
                label={row.label}
                step={1}
                prefix="USD"
                value={actuals[row.key] ?? 0}
                onChange={(value) => setActuals({ ...actuals, [row.key]: value })}
              />
            ))}
          </div>
          <Button type="button" className="mt-4" onClick={() => closeMonth(actuals)}>
            Cerrar mes
          </Button>
        </CardContent>
      </Card>
      <JsonPanel snapshot={snapshot} />
    </div>
  )
}
