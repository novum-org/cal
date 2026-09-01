import { CalendarDays, ChartPie, FileCheck, SlidersHorizontal, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'
import { SPRING } from '../lib/motion.ts'

const ITEMS = [
  { path: '.', end: true, label: 'Mes', icon: CalendarDays },
  { path: 'politica', end: false, label: 'Política', icon: SlidersHorizontal },
  { path: 'reparto', end: false, label: 'Reparto', icon: ChartPie },
  { path: 'cierre', end: false, label: 'Cierre', icon: FileCheck },
  { path: 'equipo', end: false, label: 'Equipo', icon: Users },
] as const

/**
 * Real links in a segmented control: hover, icons and a sliding pill make it
 * obvious these are places you can go, not a row of section titles.
 */
export function SessionNav() {
  return (
    <nav
      aria-label="Secciones de la sesión"
      className="flex w-full gap-1 rounded-xl bg-card p-1 ring-1 ring-foreground/10"
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.label}
          to={item.path}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-hermite outline-none',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              'active:translate-y-px',
              isActive
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="session-nav-pill"
                  transition={SPRING}
                  className="absolute inset-0 rounded-lg bg-primary"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <item.icon className="size-4" />
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
