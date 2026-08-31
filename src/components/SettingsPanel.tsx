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

const numberInput =
  'w-24 rounded-md border border-stone-300 bg-white px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:border-stone-500'

type Props = {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

export function SettingsPanel({ settings, onChange }: Props) {
  const patchStage = (stage: Stage, rule: StageRule): void =>
    onChange({ thresholds: { ...settings.thresholds, [stage]: rule } })

  return (
    <details className="rounded-lg border border-stone-200 bg-white p-4">
      <summary className="cursor-pointer text-xs font-medium tracking-widest text-stone-500 uppercase">
        Umbrales y reglas
      </summary>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-stone-500">
            <th className="pb-1 font-normal">Etapa</th>
            <th className="pb-1 text-right font-normal">TPS mínimo</th>
            <th className="pb-1 text-right font-normal">Uptime mínimo</th>
          </tr>
        </thead>
        <tbody>
          {STAGES.map((stage) => {
            const rule = settings.thresholds[stage]
            return (
              <tr key={stage} className="border-t border-stone-100">
                <td className="py-2 font-mono">{stage}</td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    step={0.5}
                    value={rule.tps_min}
                    onChange={(event) =>
                      patchStage(stage, { ...rule, tps_min: Number(event.target.value) })
                    }
                    className={numberInput}
                  />
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    step={0.1}
                    disabled={rule.uptime_min === null}
                    value={rule.uptime_min ?? ''}
                    placeholder="no aplica"
                    onChange={(event) =>
                      patchStage(stage, { ...rule, uptime_min: Number(event.target.value) })
                    }
                    className={`${numberInput} disabled:bg-stone-100 disabled:text-stone-400`}
                  />
                  <label className="ml-2 text-xs text-stone-500">
                    <input
                      type="checkbox"
                      checked={rule.uptime_min !== null}
                      onChange={(event) =>
                        patchStage(stage, { ...rule, uptime_min: event.target.checked ? 99 : null })
                      }
                      className="mr-1 align-middle"
                    />
                    pide uptime
                  </label>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
    </details>
  )
}
