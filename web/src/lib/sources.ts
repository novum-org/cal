import type { Inputs } from './types.ts'

export type FinanceSource = {
  readonly id: string
  readonly label: string
  fetchMonth(month: string): Promise<Partial<Inputs>>
}

export const ManualFormSource: FinanceSource = {
  id: 'manual-form',
  label: 'Carga a mano',
  async fetchMonth(): Promise<Partial<Inputs>> {
    return {}
  },
}

export const SOURCES: readonly FinanceSource[] = [ManualFormSource]

export const sourceById = (id: string): FinanceSource =>
  SOURCES.find((source) => source.id === id) ?? ManualFormSource
