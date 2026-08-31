/** Display formatting. Numbers are the hero, so they are always explicit. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const usd = (n: number): string => USD.format(n)

export const pct = (n: number, digits = 1): string => `${n.toFixed(digits)}%`

export const ratio = (n: number | null): string => (n === null ? 'n/d' : n.toFixed(1))

export const monthsLabel = (n: number | null): string =>
  n === null ? 'n/d' : `${n.toFixed(1)} meses`

/** Share of a total, guarded against a zero total. */
export const shareOf = (part: number, total: number): string =>
  total <= 0 ? '0.0%' : pct((part / total) * 100)

/** Current month as YYYY-MM. */
export const currentMonth = (): string => new Date().toISOString().slice(0, 7)
