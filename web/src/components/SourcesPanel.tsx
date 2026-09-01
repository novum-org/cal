import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '../lib/api.ts'
import type { SourceState } from '../lib/types.ts'

const fail = (err: unknown, fallback: string): void => {
  toast.error(err instanceof Error ? err.message : fallback)
}

/**
 * One source's settings. Secret fields start empty even when a secret is
 * stored: the server never sends them back, so an empty box means "keep the one
 * you have", which is also exactly what the server does with it.
 */
function SourceCard({
  id,
  source,
  onSaved,
}: {
  id: string
  source: SourceState
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const save = (): void => {
    setBusy(true)
    void api
      .saveSourceConfig(id, source.id, draft)
      .then(() => {
        setDraft({})
        onSaved()
        toast.success(`${source.name} configurado.`)
      })
      .catch((err: unknown) => fail(err, 'No se pudo guardar.'))
      .finally(() => setBusy(false))
  }

  const clear = (): void => {
    if (!window.confirm(`¿Borrar la configuración de ${source.name}?`)) return
    void api
      .clearSourceConfig(id, source.id)
      .then(() => {
        setDraft({})
        onSaved()
        toast.success(`${source.name} desconectado.`)
      })
      .catch((err: unknown) => fail(err, 'No se pudo borrar.'))
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{source.name}</span>
        {source.configured ? (
          <Badge variant="secondary">conectado</Badge>
        ) : (
          <Badge variant="outline">sin configurar</Badge>
        )}
        <span className="w-full text-xs text-muted-foreground">{source.description}</span>
        <span className="w-full font-mono text-[0.65rem] text-muted-foreground">
          {source.fields.join(' · ')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {source.config.map((field) => {
          const stored = source.values[field.key]
          const placeholder = field.secret
            ? source.secrets_set[field.key]
              ? 'guardado, dejalo vacío para no tocarlo'
              : ''
            : ''
          return (
            <div key={field.key} className="grid content-start gap-2">
              <Label htmlFor={`${source.id}-${field.key}`}>{field.label}</Label>
              <Input
                id={`${source.id}-${field.key}`}
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={placeholder}
                value={draft[field.key] ?? (field.secret ? '' : (stored ?? ''))}
                onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
              {field.hint !== undefined && (
                <p className="text-xs leading-snug text-muted-foreground">{field.hint}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          Guardar
        </Button>
        {source.configured && (
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            Desconectar
          </Button>
        )}
      </div>
    </div>
  )
}

export function SourcesPanel({ id, isOwner }: { id: string; isOwner: boolean }) {
  const [list, setList] = useState<SourceState[]>([])

  const refresh = useCallback((): void => {
    void api
      .sourceStates(id)
      .then(setList)
      .catch(() => undefined)
  }, [id])

  useEffect(refresh, [refresh])

  if (!isOwner) {
    return (
      <p className="text-sm text-muted-foreground">
        Las credenciales de las fuentes las configura el owner de la sesión. Vos igual podés
        traer los datos desde la pantalla del mes.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {list.map((source) => (
        <SourceCard key={source.id} id={id} source={source} onSaved={refresh} />
      ))}
    </div>
  )
}
