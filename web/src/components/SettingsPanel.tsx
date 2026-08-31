import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STAGES } from '../lib/types.ts'
import type { Settings, Stage, StageRule } from '../lib/types.ts'
import { NumberField } from './NumberField.tsx'

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
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step={0.5}
                      value={rule.tps_min}
                      onChange={(event) =>
                        patchStage(stage, { ...rule, tps_min: Number(event.target.value) })
                      }
                      className="ml-auto h-10 w-24 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <Input
                        type="number"
                        step={0.1}
                        disabled={rule.uptime_min === null}
                        value={rule.uptime_min ?? ''}
                        placeholder="n/a"
                        onChange={(event) =>
                          patchStage(stage, { ...rule, uptime_min: Number(event.target.value) })
                        }
                        className="h-10 w-24 text-right font-mono"
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`uptime-${stage}`}
                          checked={rule.uptime_min !== null}
                          onCheckedChange={(checked) =>
                            patchStage(stage, { ...rule, uptime_min: checked === true ? 99 : null })
                          }
                        />
                        <Label htmlFor={`uptime-${stage}`} className="font-normal text-muted-foreground">
                          pide uptime
                        </Label>
                      </div>
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
