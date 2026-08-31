import { AllocationDonut } from '../components/AllocationCharts.tsx'
import { AlertList } from '../components/AlertList.tsx'
import { AllocationTable } from '../components/AllocationTable.tsx'
import { EfBar } from '../components/EfBar.tsx'
import { useSession } from '../session/SessionContext.tsx'

export function AllocationPage() {
  const { result } = useSession()
  if (result === null) {
    return <p className="text-sm text-muted-foreground">Calculando…</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Resultado del motor para este mes. Las reglas que dispararon aparecen abajo.
      </p>
      <AllocationDonut result={result} />
      <AllocationTable result={result} />
      <EfBar result={result} />
      <AlertList result={result} />
    </div>
  )
}
