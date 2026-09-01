import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsPanel } from '../components/SettingsPanel.tsx'
import { api } from '../lib/api.ts'
import type { Preset } from '../lib/types.ts'
import { useSession } from '../session/SessionContext.tsx'

export function PolicyPage() {
  const { settings, patchSettings, space, applyPreset } = useSession()
  const [presets, setPresets] = useState<Preset[]>([])
  const [choice, setChoice] = useState('')

  useEffect(() => {
    void api
      .presets()
      .then((list) => {
        setPresets(list)
        setChoice((current) => (current === '' ? (list[0]?.id ?? '') : current))
      })
      .catch(() => undefined)
  }, [])

  const selected = presets.find((preset) => preset.id === choice)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Bandas, umbrales y reglas de esta sesión. No es el mes: es la política. Preset actual:{' '}
        <span className="font-mono">{space.policy.name}</span>.
      </p>
      <SettingsPanel settings={settings} onChange={patchSettings} />

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Empezar de un preset</CardTitle>
          <CardDescription>
            Reemplaza bandas, umbrales y reglas por las del preset. Los meses guardados no se tocan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor="preset-choice">Preset</Label>
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger id="preset-choice" className="w-full">
                  <SelectValue placeholder="Elegí uno" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={choice === ''}
              onClick={() => {
                const name = selected?.name ?? choice
                const warning =
                  `¿Aplicar el preset ${name} a ${space.name}?\n\n` +
                  'Se pierde la política actual de esta sesión. Los meses guardados quedan como están.'
                if (!window.confirm(warning)) return
                applyPreset(choice)
              }}
            >
              Aplicar preset
            </Button>
          </div>
          {selected !== undefined && (
            <p className="text-xs text-muted-foreground">{selected.description}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
