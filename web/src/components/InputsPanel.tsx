import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { INPUT_GROUPS } from '../lib/fields.ts'
import { STAGES } from '../lib/types.ts'
import type { Inputs, SourceOrigin, Stage } from '../lib/types.ts'
import { NumberField } from './NumberField.tsx'
import { OriginMark } from './OriginMark.tsx'

type Props = {
  inputs: Inputs
  onChange: (patch: Partial<Inputs>) => void
  origins?: Record<string, SourceOrigin>
}

export function InputsPanel({ inputs, onChange, origins = {} }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Mes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="month">Mes</Label>
            <Input
              id="month"
              type="month"
              value={inputs.month}
              onChange={(event) => onChange({ month: event.target.value })}
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stage">Etapa</Label>
            <Select value={inputs.stage} onValueChange={(value) => onChange({ stage: value as Stage })}>
              <SelectTrigger id="stage" className="w-full font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {INPUT_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="font-serif">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
                mark={<OriginMark origin={origins[field.key]} value={inputs[field.key]} />}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="notes" className="sr-only">
            Notas
          </Label>
          <Textarea
            id="notes"
            value={inputs.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            rows={3}
            placeholder="Qué pasó este mes."
          />
        </CardContent>
      </Card>
    </div>
  )
}
