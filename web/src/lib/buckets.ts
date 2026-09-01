import type { Allocation } from './types.ts'

export type BucketRow = {
  key: keyof Allocation
  label: string
  note: string
  color: string
}

export const BUCKET_ROWS: readonly BucketRow[] = [
  { key: 'infra', label: 'Infra', note: 'Se paga antes que nada', color: 'var(--chart-1)' },
  { key: 'ef_fill', label: 'EF fill', note: 'Aporte al fondo de emergencia', color: 'var(--chart-2)' },
  { key: 'product', label: 'Product', note: 'Server, mundo, herramientas', color: 'var(--chart-3)' },
  { key: 'growth', label: 'Growth', note: 'Difusión, solo con la casa en orden', color: 'var(--chart-4)' },
  { key: 'people', label: 'People', note: 'Bonos y reparto, solo con ganancia', color: 'var(--chart-6)' },
  { key: 'infra_buffer', label: 'Reserva de infra', note: 'Growth frenado por salud del server', color: 'var(--chart-5)' },
  { key: 'unallocated', label: 'Sin asignar', note: 'Queda en la caja, lo decidís vos', color: 'var(--chart-7)' },
]
