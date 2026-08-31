import { useState } from 'react'

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

/** Keeps a text draft so the field can be empty while the owner types. */
export function NumberField({ name, label, value, step, onChange, prefix, suffix, hint }: Props) {
  const [draft, setDraft] = useState<string>(() => String(value))
  const [seen, setSeen] = useState<number>(value)

  // Value changed from outside (import, reset, source fetch): resync the draft.
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
    <label className="block" htmlFor={name}>
      <span className="block text-sm text-stone-700">{label}</span>
      <span className="mt-1 flex items-stretch rounded-md border border-stone-300 bg-white focus-within:border-stone-500">
        {prefix !== undefined && (
          <span className="flex items-center px-2 text-xs text-stone-400">{prefix}</span>
        )}
        <input
          id={name}
          name={name}
          type="number"
          inputMode="decimal"
          step={step}
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setDraft(String(value))}
          className="w-full bg-transparent px-2 py-1.5 text-right font-mono text-base tabular-nums text-stone-900 outline-none"
        />
        {suffix !== undefined && (
          <span className="flex items-center px-2 text-xs text-stone-400">{suffix}</span>
        )}
      </span>
      <span className="mt-1 flex justify-between gap-2 text-xs text-stone-400">
        <span>{hint ?? ''}</span>
        <span className="font-mono">{name}</span>
      </span>
    </label>
  )
}
