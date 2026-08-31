import type { Snapshot } from '../lib/types.ts'

export function JsonPanel({ snapshot }: { snapshot: Snapshot }) {
  return (
    <details className="rounded-lg border border-stone-200 bg-white p-4">
      <summary className="cursor-pointer text-xs font-medium tracking-widest text-stone-500 uppercase">
        Snapshot JSON
      </summary>
      <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-stone-50 p-3 font-mono text-xs text-stone-700">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </details>
  )
}
