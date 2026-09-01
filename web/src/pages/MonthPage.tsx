import { Link } from 'react-router'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InputsPanel } from '../components/InputsPanel.tsx'
import { SaveChecklist } from '../components/SaveChecklist.tsx'
import { SummaryStats } from '../components/SummaryStats.tsx'
import { useSession } from '../session/SessionContext.tsx'

export function MonthPage() {
  const {
    inputs,
    result,
    touched,
    dirty,
    origins,
    pulling,
    patchInputs,
    pullSources,
    save,
    importMonth,
    resetMonth,
  } = useSession()

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted-foreground">
            Cargá lo que entró y lo que hizo el server. El reparto y las reglas viven en otras
            pantallas.
          </p>
          <Button type="button" variant="outline" onClick={pullSources} disabled={pulling}>
            <RefreshCw className={pulling ? 'animate-spin' : undefined} />
            {pulling ? 'Trayendo…' : 'Traer de las fuentes'}
          </Button>
        </div>
        {result !== null && <SummaryStats result={result} />}
        <InputsPanel inputs={inputs} onChange={patchInputs} origins={origins} />
        <div className="flex flex-wrap gap-2">
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
      <SaveChecklist inputs={inputs} touched={touched} dirty={dirty} onSave={save} />
    </div>
  )
}
