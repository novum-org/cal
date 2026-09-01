import { NumberField } from './NumberField.tsx'
import { BUCKET_ROWS } from '../lib/buckets.ts'

/**
 * Actuals are a human fact, not an engine output. Nothing here is derived or
 * guessed: an empty bucket stays zero until somebody types what was spent.
 */
export function ActualsForm({
  actuals,
  onChange,
}: {
  actuals: Record<string, number>
  onChange: (next: Record<string, number>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BUCKET_ROWS.map((row) => (
        <NumberField
          key={row.key}
          name={`actual-${row.key}`}
          label={row.label}
          step={1}
          prefix="USD"
          value={actuals[row.key] ?? 0}
          onChange={(value) => onChange({ ...actuals, [row.key]: value })}
        />
      ))}
    </div>
  )
}
