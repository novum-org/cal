import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  name: string
  label: string
  value: number
  step: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  hint?: string
}

export function NumberField({ name, label, value, step, onChange, prefix, suffix, hint }: Props) {
  const [draft, setDraft] = useState<string>(() => String(value))
  const [seen, setSeen] = useState<number>(value)

  if (seen !== value) {
    setSeen(value)
    if (Number(draft) !== value) setDraft(String(value))
  }

  const handleChange = (raw: string): void => {
    setDraft(raw)
    const parsed = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(parsed)) onChange(parsed)
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        {prefix !== undefined && (
          <span className="text-xs text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={name}
          name={name}
          type="number"
          inputMode="decimal"
          step={step}
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setDraft(String(value))}
          className="h-10 text-right font-mono tabular-nums"
        />
        {suffix !== undefined && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint !== undefined && hint !== '' && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
