import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { InputsPanel } from '../components/InputsPanel.tsx'
import { SummaryStats } from '../components/SummaryStats.tsx'
import { useSession } from '../session/SessionContext.tsx'

export function MonthPage() {
  const { inputs, result, patchInputs, save, importMonth, resetMonth } = useSession()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cargá lo que entró y lo que hizo el server. El reparto y las reglas viven en otras
        pantallas.
      </p>
      {result !== null && <SummaryStats result={result} />}
      <InputsPanel inputs={inputs} onChange={patchInputs} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save}>
          Guardar mes
        </Button>
        <Button type="button" variant="outline" asChild>
          <label className="cursor-pointer">
            Importar JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file !== undefined) importMonth(file)
                event.target.value = ''
              }}
            />
          </label>
        </Button>
        <Button type="button" variant="ghost" onClick={resetMonth}>
          Reset
        </Button>
        <Button type="button" variant="link" asChild>
          <Link to="reparto">Ver reparto</Link>
        </Button>
      </div>
    </div>
  )
}
