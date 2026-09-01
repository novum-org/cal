import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { NumericInput } from './NumericInput.tsx'

type Props = {
  name: string
  label: string
  value: number
  step: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  hint?: string
  /** Rendered next to the label, to say where the number came from. */
  mark?: ReactNode
}

export function NumberField({
  name,
  label,
  value,
  step,
  onChange,
  prefix,
  suffix,
  hint,
  mark,
}: Props) {
  return (
    <div className="grid content-start gap-2">
      <div className="flex min-h-5 items-center gap-2">
        <Label htmlFor={name}>{label}</Label>
        {mark}
      </div>
      <NumericInput
        id={name}
        name={name}
        value={value}
        step={step}
        onChange={onChange}
        prefix={prefix}
        suffix={suffix}
      />
      {hint !== undefined && hint !== '' && (
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
