import { INPUT_GROUPS } from '../lib/fields.ts'
import { STAGES } from '../lib/types.ts'
import type { Inputs, Stage } from '../lib/types.ts'
import { Card } from './Card.tsx'
import { NumberField } from './NumberField.tsx'

type Props = {
  inputs: Inputs
  onChange: (patch: Partial<Inputs>) => void
}

export function InputsPanel({ inputs, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Card title="Mes">
        <div className="grid grid-cols-2 gap-3">
          <label className="block" htmlFor="month">
            <span className="block text-sm text-stone-700">Mes</span>
            <input
              id="month"
              type="month"
              value={inputs.month}
              onChange={(event) => onChange({ month: event.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-base text-stone-900 outline-none focus:border-stone-500"
            />
          </label>
          <label className="block" htmlFor="stage">
            <span className="block text-sm text-stone-700">Etapa</span>
            <select
              id="stage"
              value={inputs.stage}
              onChange={(event) => onChange({ stage: event.target.value as Stage })}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-base text-stone-900 outline-none focus:border-stone-500"
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {INPUT_GROUPS.map((group) => (
        <Card key={group.title} title={group.title}>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <NumberField
                key={field.key}
                name={field.key}
                label={field.label}
                step={field.step}
                prefix={field.prefix}
                suffix={field.suffix}
                hint={field.hint}
                value={inputs[field.key]}
                onChange={(value) => onChange({ [field.key]: value })}
              />
            ))}
          </div>
        </Card>
      ))}

      <Card title="Notas">
        <textarea
          id="notes"
          value={inputs.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          rows={3}
          placeholder="Qué pasó este mes."
          className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 outline-none focus:border-stone-500"
        />
      </Card>
    </div>
  )
}
