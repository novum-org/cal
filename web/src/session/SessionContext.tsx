import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { api, policyWithSettings, settingsFromPolicy } from '../lib/api.ts'
import { copyText, downloadJson } from '../lib/browser.ts'
import { DEFAULT_INPUTS } from '../lib/defaults.ts'
import { toMarkdown } from '../lib/markdown.ts'
import type { Inputs, MonthRecord, Policy, Result, Settings, Snapshot, Space } from '../lib/types.ts'

type SessionValue = {
  id: string
  space: Space
  inputs: Inputs
  result: Result | null
  monthRec: MonthRecord | null
  revision: number
  status: string
  stale: boolean
  settings: Settings
  snapshot: Snapshot
  patchInputs: (patch: Partial<Inputs>) => void
  patchSettings: (patch: Partial<Settings>) => void
  save: () => void
  plan: () => void
  closeMonth: (actuals: Record<string, number>) => void
  exportMonth: () => void
  exportDump: () => void
  importMonth: (file: File) => void
  copyMarkdown: () => void
  resetMonth: () => void
  setActuals: (actuals: Record<string, number>) => void
}

const SessionContext = createContext<SessionValue | null>(null)

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

  const applyMonth = useCallback((rec: MonthRecord): void => {
    setInputs((prev) => ({ ...DEFAULT_INPUTS, ...rec.inputs, month: rec.month || prev.month }))
    setRevision(rec.revision)
    setMonthRec(rec)
  }, [])

  useEffect(() => {
    if (id === undefined) return
    void api
      .session(id)
      .then(async (sp) => {
        setSpace(sp)
        const rec = await api.month(id, DEFAULT_INPUTS.month)
        applyMonth(rec)
      })
      .catch(() => nav('/login', { replace: true }))
  }, [id, nav, applyMonth])

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
  }, [])

  const value = useMemo((): SessionValue | null => {
    if (id === undefined || space === null) return null
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
      save: (): void => {
        void api
          .saveMonth(id, inputs.month, inputs, revision)
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
        void api
          .saveMonth(id, inputs.month, inputs, revision)
          .then((m) => api.close(id, inputs.month, actuals, m.revision))
          .then((m) => {
            applyMonth(m)
            ok(`Cerrado ${m.month}.`)
          })
          .catch((err: unknown) => fail(err, 'close'))
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
            if (parsed.inputs !== undefined) setInputs({ ...DEFAULT_INPUTS, ...parsed.inputs })
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
        ok('Valores por defecto del mes.')
      },
      setActuals: (actuals: Record<string, number>): void => {
        setMonthRec((cur) => (cur === null ? cur : { ...cur, actuals }))
      },
    }
  }, [id, space, inputs, result, monthRec, revision, status, stale, patchInputs, applyMonth])

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
