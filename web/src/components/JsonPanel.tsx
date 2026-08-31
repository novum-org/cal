import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import type { Snapshot } from '../lib/types.ts'

export function JsonPanel({ snapshot }: { snapshot: Snapshot }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="px-0">
          Snapshot JSON
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
