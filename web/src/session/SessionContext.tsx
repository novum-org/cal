import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { api, policyWithSettings, settingsFromPolicy } from '../lib/api.ts'
import { copyText, downloadJson } from '../lib/browser.ts'
import { DEFAULT_INPUTS } from '../lib/defaults.ts'
import { toMarkdown } from '../lib/markdown.ts'
import type {
  Inputs,
  MonthRecord,
  Policy,
  Result,
  Settings,
  Snapshot,
  SourceOrigin,
  Space,
} from '../lib/types.ts'

type SessionValue = {
  id: string
  space: Space
  inputs: Inputs
  result: Result | null
  monthRec: MonthRecord | null
  revision: number
  status: string
  stale: boolean
  /** Fields the user has filled in this session, or that came from a save. */
  touched: ReadonlySet<keyof Inputs>
  /** Which ingest source last filled each field, and with what value. */
  origins: Record<string, SourceOrigin>
  /** A pull is in flight. */
  pulling: boolean
  /** The form no longer matches what is stored for this month. */
  dirty: boolean
  settings: Settings
  snapshot: Snapshot
  patchInputs: (patch: Partial<Inputs>) => void
  patchSettings: (patch: Partial<Settings>) => void
  renameSpace: (name: string) => void
  archiveSpace: () => void
  applyPreset: (preset: string) => void
  save: () => void
  plan: () => void
  closeMonth: (actuals: Record<string, number>) => void
  reopenMonth: () => void
  pullSources: () => void
  exportMonth: () => void
  exportDump: () => void
  importMonth: (file: File) => void
  copyMarkdown: () => void
  resetMonth: () => void
  setActuals: (actuals: Record<string, number>) => void
}

const SessionContext = createContext<SessionValue | null>(null)

const INPUT_KEYS = Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]

/** A stored month, filled out with defaults for anything the record omits. */
const storedInputs = (rec: MonthRecord, fallbackMonth: string): Inputs => ({
  ...DEFAULT_INPUTS,
  ...rec.inputs,
  month: rec.month || fallbackMonth,
})

const sameInputs = (a: Inputs, b: Inputs): boolean =>
  INPUT_KEYS.every((key) => a[key] === b[key])

export function SessionProvider({ children }: { children: ReactNode }) {
  const { id } = useParams()
  const nav = useNavigate()
  const [space, setSpace] = useState<Space | null>(null)
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const [revision, setRevision] = useState(0)
  const [monthRec, setMonthRec] = useState<MonthRecord | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [status, setStatus] = useState('')
  const [stale, setStale] = useState(false)
  const [touched, setTouched] = useState<ReadonlySet<keyof Inputs>>(() => new Set())
  const [origins, setOrigins] = useState<Record<string, SourceOrigin>>({})
  const [pulling, setPulling] = useState(false)

  const applyMonth = useCallback((rec: MonthRecord): void => {
    setInputs((prev) => storedInputs(rec, prev.month))
    setRevision(rec.revision)
    setMonthRec(rec)
    // A month that was saved once is complete by definition; a fresh one starts
    // with nothing checked off.
    setTouched(rec.revision > 0 ? new Set(INPUT_KEYS) : new Set())
    setOrigins(rec.sources ?? {})
  }, [])

  // `useNavigate` hands back a new function on every location change, so
  // keeping it in the dep array below re-ran the load on every tab switch and
  // silently threw away whatever had been typed but not saved.
  const navRef = useRef(nav)
  useEffect(() => {
    navRef.current = nav
  }, [nav])

  useEffect(() => {
    if (id === undefined) return
    let cancelled = false
    void api
      .session(id)
      .then(async (sp) => {
        const rec = await api.month(id, DEFAULT_INPUTS.month)
        if (cancelled) return
        setSpace(sp)
        applyMonth(rec)
      })
      .catch(() => navRef.current('/login', { replace: true }))
    return () => {
      cancelled = true
    }
  }, [id, applyMonth])

  useEffect(() => {
    if (id === undefined || space === null) return
    const t = setTimeout(() => {
      void api
        .preview(id, inputs)
        .then(setResult)
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'preview'
          setStatus(message)
          toast.error(message)
        })
    }, 150)
    return () => clearTimeout(t)
  }, [id, inputs, space])

  useEffect(() => {
    if (id === undefined || space === null || monthRec === null) return
    const month = inputs.month
    if (monthRec.month === month) return
    void api
      .month(id, month)
      .then(applyMonth)
      .catch((err: unknown) => setStatus(err instanceof Error ? err.message : 'month'))
  }, [id, space, inputs.month, monthRec, applyMonth])

  useEffect(() => {
    if (status === '') return
    const t = setTimeout(() => setStatus(''), 4000)
    return () => clearTimeout(t)
  }, [status])

  const patchInputs = useCallback((patch: Partial<Inputs>): void => {
    setInputs((s) => ({ ...s, ...patch }))
    setTouched((prev) => {
      const keys = Object.keys(patch) as (keyof Inputs)[]
      if (keys.every((key) => prev.has(key))) return prev
      const next = new Set(prev)
      for (const key of keys) next.add(key)
      return next
    })
  }, [])

  const value = useMemo((): SessionValue | null => {
    if (id === undefined || space === null) return null
    const dirty = monthRec !== null && !sameInputs(inputs, storedInputs(monthRec, inputs.month))
    const settings = settingsFromPolicy(space.policy)
    const snapshot: Snapshot = {
      version: 1,
      saved_at: new Date().toISOString(),
      inputs,
      policy: space.policy,
    }
    const fail = (err: unknown, fallback: string): void => {
      if (err instanceof Error && err.message.includes('stale')) setStale(true)
      const message = err instanceof Error ? err.message : fallback
      setStatus(message)
      toast.error(message)
    }
    const ok = (message: string): void => {
      setStatus(message)
      toast.success(message)
    }
    return {
      id,
      space,
      inputs,
      result,
      monthRec,
      revision,
      status,
      stale,
      touched,
      dirty,
      origins,
      pulling,
      settings,
      snapshot,
      patchInputs,
      patchSettings: (patch: Partial<Settings>): void => {
        const next = policyWithSettings(space.policy, {
          ...settings,
          ...patch,
          thresholds: patch.thresholds ?? settings.thresholds,
        })
        setSpace({ ...space, policy: next })
        void api
          .patchSession(id, { policy: next, revision: space.revision })
          .then((sp) => {
            setSpace(sp)
            setStale(false)
          })
          .catch((err: unknown) => fail(err, 'policy'))
      },
      renameSpace: (name: string): void => {
        if (name === '' || name === space.name) return
        void api
          .patchSession(id, { name, revision: space.revision })
          .then((sp) => {
            setSpace(sp)
            setStale(false)
            ok(`Ahora se llama ${sp.name}.`)
          })
          .catch((err: unknown) => fail(err, 'rename'))
      },
      applyPreset: (preset: string): void => {
        void api
          .applyPreset(id, preset, space.revision)
          .then((sp) => {
            setSpace(sp)
            setStale(false)
            ok(`Política ${sp.policy.name} aplicada. Los meses quedaron como estaban.`)
          })
          .catch((err: unknown) => fail(err, 'preset'))
      },
      archiveSpace: (): void => {
        void api
          .patchSession(id, { archived: true, revision: space.revision })
          .then(() => ok(`${space.name} quedó archivada.`))
          .catch((err: unknown) => fail(err, 'archive'))
      },
      save: (): void => {
        void api
          .saveMonth(id, inputs.month, inputs, revision, origins)
          .then((m) => {
            applyMonth(m)
            ok(`Guardado ${m.month}.`)
          })
          .catch((err: unknown) => fail(err, 'save'))
      },
      plan: (): void => {
        void api
          .saveMonth(id, inputs.month, inputs, revision)
          .then((m) => {
            applyMonth(m)
            return api.plan(id, inputs.month)
          })
          .then((m) => {
            applyMonth(m)
            ok(`Plan guardado para ${m.month}.`)
          })
          .catch((err: unknown) => fail(err, 'plan'))
      },
      closeMonth: (actuals: Record<string, number>): void => {
        // A closed month refuses input writes, so re-closing only sends the
        // actuals. Saving first is for the month that is still open.
        const saved =
          monthRec?.status === 'closed'
            ? Promise.resolve(revision)
            : api.saveMonth(id, inputs.month, inputs, revision).then((m) => m.revision)
        void saved
          .then((rev) => api.close(id, inputs.month, actuals, rev))
          .then((m) => {
            applyMonth(m)
            ok(`Cerrado ${m.month}.`)
          })
          .catch((err: unknown) => fail(err, 'close'))
      },
      pullSources: (): void => {
        if (pulling) return
        setPulling(true)
        void api
          .pull(id, inputs.month)
          .then((res) => {
            const fields = Object.keys(res.patch)
            if (fields.length > 0) {
              patchInputs(res.patch as Partial<Inputs>)
              setOrigins((prev) => ({ ...prev, ...res.origins }))
              ok(`${fields.length} campo(s) traídos de las fuentes.`)
            }
            // Failures are shown one by one on purpose: a dead source is a
            // thing to fix, not a footnote under a number nobody measured.
            for (const failure of res.failures) {
              toast.error(failure.source === '' ? failure.error : `${failure.source}: ${failure.error}`)
            }
            if (fields.length === 0 && res.failures.length === 0) {
              ok('Las fuentes no trajeron ningún campo nuevo.')
            }
          })
          .catch((err: unknown) => fail(err, 'pull'))
          .finally(() => setPulling(false))
      },
      reopenMonth: (): void => {
        void api
          .reopen(id, inputs.month, revision)
          .then((m) => {
            applyMonth(m)
            ok(`${m.month} reabierto. El plan y los reales quedaron.`)
          })
          .catch((err: unknown) => fail(err, 'reopen'))
      },
      exportMonth: (): void => downloadJson(`cal-${space.name}-${inputs.month}.json`, snapshot),
      exportDump: (): void => {
        void api
          .exportDump()
          .then((blob) => {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'cal-dump.json'
            a.click()
            URL.revokeObjectURL(url)
            ok('Dump privado descargado.')
          })
          .catch(() => fail(new Error('No se pudo exportar el dump.'), 'export'))
      },
      importMonth: (file: File): void => {
        void file.text().then((text) => {
          try {
            const parsed = JSON.parse(text) as { inputs?: Inputs; policy?: Policy }
            if (parsed.inputs !== undefined) {
              setInputs({ ...DEFAULT_INPUTS, ...parsed.inputs })
              setTouched(new Set(INPUT_KEYS))
            }
            ok(`Importado ${parsed.inputs?.month ?? inputs.month}.`)
          } catch {
            fail(new Error('JSON inválido.'), 'import')
          }
        })
      },
      copyMarkdown: (): void => {
        if (result === null) return
        void copyText(toMarkdown(result)).then((copied) => {
          if (copied) ok('Markdown copiado.')
          else fail(new Error('No se pudo copiar.'), 'copy')
        })
      },
      resetMonth: (): void => {
        setInputs({ ...DEFAULT_INPUTS, month: inputs.month })
        setTouched(new Set(['month']))
        ok('Valores por defecto del mes.')
      },
      setActuals: (actuals: Record<string, number>): void => {
        setMonthRec((cur) => (cur === null ? cur : { ...cur, actuals }))
      },
    }
  }, [
    id,
    space,
    inputs,
    result,
    monthRec,
    revision,
    status,
    stale,
    touched,
    origins,
    pulling,
    patchInputs,
    applyMonth,
  ])

  if (value === null) {
    return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (ctx === null) throw new Error('useSession outside SessionProvider')
  return ctx
}
