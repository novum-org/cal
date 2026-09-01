import { Badge } from '@/components/ui/badge'
import type { SourceOrigin } from '../lib/types.ts'

const SOURCE_LABEL: Record<string, string> = {
  tebex: 'Tebex',
  discord: 'Discord',
  metrics: 'Métricas',
}

/**
 * Says where a number came from. An override is not a separate flag anybody has
 * to remember to set: it is simply the field no longer matching what the source
 * reported, which cannot drift out of sync with the value itself.
 */
export function OriginMark({ origin, value }: { origin?: SourceOrigin; value: number }) {
  if (origin === undefined) return null
  const name = SOURCE_LABEL[origin.source] ?? origin.source
  const overridden = Math.abs(origin.value - value) > 0.0001
  if (!overridden) {
    return (
      <Badge variant="secondary" className="h-5 px-1.5 text-[0.65rem] font-normal">
        {name}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="h-5 border-chart-4/60 px-1.5 text-[0.65rem] font-normal text-chart-4"
      title={`${name} trajo ${origin.value}`}
    >
      editado sobre {name}
    </Badge>
  )
}
