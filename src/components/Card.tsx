import type { ReactNode } from 'react'

type Props = {
  title: string
  aside?: ReactNode
  children: ReactNode
}

export function Card({ title, aside, children }: Props) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium tracking-widest text-stone-500 uppercase">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}
