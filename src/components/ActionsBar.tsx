import { SOURCES } from '../lib/sources.ts'
import { Card } from './Card.tsx'

const BUTTON =
  'rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 active:bg-stone-100'

type Props = {
  sourceId: string
  status: string
  onSourceChange: (id: string) => void
  onFetch: () => void
  onSave: () => void
  onExport: () => void
  onImport: (file: File) => void
  onCopy: () => void
  onReset: () => void
}

export function ActionsBar(props: Props) {
  return (
    <Card
      title="Datos"
      aside={<span className="text-xs text-stone-500">{props.status}</span>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={props.sourceId}
          onChange={(event) => props.onSourceChange(event.target.value)}
          aria-label="Fuente de datos"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800 outline-none focus:border-stone-500"
        >
          {SOURCES.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
        <button type="button" className={BUTTON} onClick={props.onFetch}>
          Traer mes
        </button>
        <button type="button" className={BUTTON} onClick={props.onSave}>
          Guardar mes
        </button>
        <button type="button" className={BUTTON} onClick={props.onExport}>
          Exportar JSON
        </button>
        <label className={`${BUTTON} cursor-pointer`}>
          Importar JSON
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) props.onImport(file)
              event.target.value = ''
            }}
          />
        </label>
        <button type="button" className={BUTTON} onClick={props.onCopy}>
          Copiar markdown
        </button>
        <button type="button" className={`${BUTTON} ml-auto`} onClick={props.onReset}>
          Reset
        </button>
      </div>
    </Card>
  )
}
