import { useEffect, useMemo, useState } from 'react'

import { ActionsBar } from './components/ActionsBar.tsx'
import { AlertList } from './components/AlertList.tsx'
import { AllocationTable } from './components/AllocationTable.tsx'
import { EfBar } from './components/EfBar.tsx'
import { InputsPanel } from './components/InputsPanel.tsx'
import { JsonPanel } from './components/JsonPanel.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { SummaryStats } from './components/SummaryStats.tsx'
import { downloadJson, copyText } from './lib/browser.ts'
import { DEFAULT_SETTINGS, calculate } from './lib/engine.ts'
import { DEFAULT_INPUTS } from './lib/defaults.ts'
import { toMarkdown } from './lib/markdown.ts'
import { sourceById } from './lib/sources.ts'
import { loadDraft, parseSnapshotJson, saveDraft, saveMonth, toSnapshot } from './lib/storage.ts'
import type { Inputs, Settings } from './lib/types.ts'

type State = { inputs: Inputs; settings: Settings }

export default function App() {
  const [state, setState] = useState<State>(() => {
    const draft = loadDraft()
    return { inputs: draft.inputs, settings: draft.settings }
  })
  const [sourceId, setSourceId] = useState('local-json')
  const [status, setStatus] = useState('')

  const { inputs, settings } = state
  const result = useMemo(() => calculate(inputs, settings), [inputs, settings])
  const snapshot = useMemo(() => toSnapshot(inputs, settings), [inputs, settings])

  useEffect(() => {
    saveDraft(inputs, settings)
  }, [inputs, settings])

  useEffect(() => {
    if (status === '') return
    const timer = setTimeout(() => setStatus(''), 4000)
    return () => clearTimeout(timer)
  }, [status])

  const patchInputs = (patch: Partial<Inputs>): void =>
    setState((s) => ({ ...s, inputs: { ...s.inputs, ...patch } }))

  const patchSettings = (patch: Partial<Settings>): void =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  const handleFetch = async (): Promise<void> => {
    const patch = await sourceById(sourceId).fetchMonth(inputs.month)
    const fields = Object.keys(patch).length
    if (fields === 0) {
      setStatus(`Sin datos para ${inputs.month} en esa fuente.`)
      return
    }
    patchInputs(patch)
    setStatus(`${fields} campos traídos de ${sourceId}.`)
  }

  const handleImport = async (file: File): Promise<void> => {
    const parsed = parseSnapshotJson(await file.text())
    if (!parsed.ok) {
      setStatus(parsed.error)
      return
    }
    setState({ inputs: parsed.value.inputs, settings: parsed.value.settings })
    setStatus(`Importado ${parsed.value.inputs.month}.`)
  }

  const handleCopy = async (): Promise<void> => {
    const ok = await copyText(toMarkdown(result))
    setStatus(ok ? 'Markdown copiado.' : 'No se pudo copiar al portapapeles.')
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="font-mono text-lg text-stone-900">novum-cal</h1>
        <p className="text-xs text-stone-500">
          Interno. No es la carta pública. Infra primero, después EF, después el resto.
        </p>
      </header>

      <SummaryStats result={result} />

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <InputsPanel inputs={inputs} onChange={patchInputs} />
          <SettingsPanel settings={settings} onChange={patchSettings} />
        </div>

        <div className="flex flex-col gap-4">
          <AllocationTable result={result} />
          <EfBar result={result} />
          <AlertList result={result} />
          <ActionsBar
            sourceId={sourceId}
            status={status}
            onSourceChange={setSourceId}
            onFetch={() => void handleFetch()}
            onSave={() => {
              const ok = saveMonth(snapshot)
              setStatus(ok ? `Guardado ${inputs.month}.` : 'No se pudo guardar en este navegador.')
            }}
            onExport={() => downloadJson(`novum-cal-${inputs.month}.json`, snapshot)}
            onImport={(file) => void handleImport(file)}
            onCopy={() => void handleCopy()}
            onReset={() => {
              setState({ inputs: DEFAULT_INPUTS, settings: DEFAULT_SETTINGS })
              setStatus('Valores por defecto.')
            }}
          />
          <JsonPanel snapshot={snapshot} />
        </div>
      </div>
    </main>
  )
}
