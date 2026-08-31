import type { Alert, AlertLevel, Result } from '../lib/types.ts'
import { Card } from './Card.tsx'

const TONE: Record<AlertLevel, string> = {
  red: 'border-red-300 bg-red-50 text-red-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-stone-200 bg-stone-50 text-stone-700',
}

const BADGE: Record<AlertLevel, string> = {
  red: 'bg-red-200 text-red-900',
  warn: 'bg-amber-200 text-amber-900',
  info: 'bg-stone-200 text-stone-600',
}

const ORDER: Record<AlertLevel, number> = { red: 0, warn: 1, info: 2 }

const byLevel = (a: Alert, b: Alert): number => ORDER[a.level] - ORDER[b.level]

export function AlertList({ result }: { result: Result }) {
  const alerts = [...result.alerts].sort(byLevel)
  return (
    <Card
      title="Qué dice el motor"
      aside={<span className="text-xs text-stone-500">{alerts.length} reglas</span>}
    >
      <ul className="flex flex-col gap-2">
        {alerts.map((alert, index) => (
          <li
            key={`${alert.rule}-${index}`}
            className={`flex gap-3 rounded-md border px-3 py-2 text-sm ${TONE[alert.level]}`}
          >
            <span
              className={`h-fit rounded px-1.5 py-0.5 font-mono text-xs ${BADGE[alert.level]}`}
            >
              {alert.rule}
            </span>
            <span>{alert.message}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
