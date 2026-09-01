import { useState, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  id?: string
  name?: string
  value: number
  step: number
  onChange: (value: number) => void
  /** Unit shown inside the field, before the number. */
  prefix?: string
  /** Unit shown inside the field, after the number. */
  suffix?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
}

/** Trims the float noise that `1.1 + 0.1` leaves behind. */
const quantize = (value: number, step: number): number => {
  const decimals = (String(step).split('.')[1] ?? '').length
  return Number(value.toFixed(Math.min(decimals + 1, 6)))
}

/**
 * A number field without the native spinners: they are visual noise, and the
 * scroll wheel silently edits whatever number the cursor happens to rest on.
 * Arrow keys still step the value (Shift for ten steps), and the unit lives
 * inside the control instead of floating next to it.
 */
export function NumericInput({
  id,
  name,
  value,
  step,
  onChange,
  prefix,
  suffix,
  disabled = false,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const [draft, setDraft] = useState<string>(() => String(value))
  const [seen, setSeen] = useState<number>(value)

  if (seen !== value) {
    setSeen(value)
    if (Number(draft) !== value) setDraft(String(value))
  }

  const commit = (raw: string): void => {
    setDraft(raw)
    const parsed = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(parsed)) onChange(parsed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const delta = (event.key === 'ArrowUp' ? step : -step) * (event.shiftKey ? 10 : 1)
    const next = quantize((Number.isFinite(Number(draft)) ? Number(draft) : value) + delta, step)
    setDraft(String(next))
    onChange(next)
  }

  return (
    <div
      data-slot="numeric-input"
      className={cn(
        'flex h-(--control-h) w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-[color,box-shadow,border-color] duration-150 ease-hermite dark:bg-input/30',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        disabled && 'pointer-events-none bg-input/50 opacity-50 dark:bg-input/80',
        className,
      )}
    >
      {prefix !== undefined && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground/70 select-none">
          {prefix}
        </span>
      )}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={draft}
        onChange={(event) => commit(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setDraft(String(value))}
        onFocus={(event) => event.target.select()}
        className="min-w-0 flex-1 bg-transparent text-right font-mono tabular-nums outline-none placeholder:text-muted-foreground"
      />
      {suffix !== undefined && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground/70 select-none">
          {suffix}
        </span>
      )}
    </div>
  )
}
