import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STAGES } from '../lib/types.ts'
import type { Settings, Stage, StageRule } from '../lib/types.ts'
import { NumberField } from './NumberField.tsx'
import { NumericInput } from './NumericInput.tsx'

type KnobKey =
  | 'discord_per_player_max'
  | 'concurrent_high'
  | 'infra_health_uptime_floor'
  | 'min_runway_months'

type Knob = { key: KnobKey; label: string; step: number; suffix?: string }

const KNOBS: readonly Knob[] = [
  { key: 'discord_per_player_max', label: 'Máximo Discord por jugador', step: 1 },
  { key: 'concurrent_high', label: 'Concurrentes que ya son carga alta', step: 1 },
  { key: 'infra_health_uptime_floor', label: 'Piso de uptime para infra sana', step: 0.1, suffix: '%' },
  { key: 'min_runway_months', label: 'Piso de runway', step: 1, suffix: 'meses' },
]

type Props = {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

export function SettingsPanel({ settings, onChange }: Props) {
  const patchStage = (stage: Stage, rule: StageRule): void =>
    onChange({ thresholds: { ...settings.thresholds, [stage]: rule } })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Umbrales y reglas</CardTitle>
        <CardDescription>Se guardan solas al cambiarlas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">TPS mínimo</TableHead>
              <TableHead className="text-right">Uptime mínimo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STAGES.map((stage) => {
              const rule = settings.thresholds[stage]
              return (
                <TableRow key={stage}>
                  <TableCell className="font-mono">{stage}</TableCell>
                  <TableCell>
                    <NumericInput
                      aria-label={`TPS mínimo en ${stage}`}
                      value={rule.tps_min}
                      step={0.5}
                      suffix="%"
                      onChange={(value) => patchStage(stage, { ...rule, tps_min: value })}
                      className="ml-auto w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`uptime-${stage}`}
                          checked={rule.uptime_min !== null}
                          onCheckedChange={(checked) =>
                            patchStage(stage, { ...rule, uptime_min: checked === true ? 99 : null })
                          }
                        />
                        <Label
                          htmlFor={`uptime-${stage}`}
                          className="cursor-pointer font-normal text-muted-foreground"
                        >
                          pide uptime
                        </Label>
                      </div>
                      <NumericInput
                        aria-label={`Uptime mínimo en ${stage}`}
                        value={rule.uptime_min ?? 0}
                        step={0.1}
                        suffix="%"
                        placeholder="n/a"
                        disabled={rule.uptime_min === null}
                        onChange={(value) => patchStage(stage, { ...rule, uptime_min: value })}
                        className="w-32"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="grid gap-4 sm:grid-cols-2">
          {KNOBS.map((knob) => (
            <NumberField
              key={knob.key}
              name={knob.key}
              label={knob.label}
              step={knob.step}
              suffix={knob.suffix}
              value={settings[knob.key]}
              onChange={(value) => onChange({ [knob.key]: value })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
