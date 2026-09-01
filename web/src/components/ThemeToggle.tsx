import { Monitor, Moon, Sun } from 'lucide-react'
import { motion } from 'motion/react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { SPRING } from '../lib/motion.ts'

/** system → light → dark → system. Each step names the one after it. */
const CYCLE = [
  { value: 'system', icon: Monitor, label: 'Tema del sistema' },
  { value: 'light', icon: Sun, label: 'Tema claro' },
  { value: 'dark', icon: Moon, label: 'Tema oscuro' },
] as const

/**
 * No mounted guard: this app is client-only, so next-themes has already read
 * storage by the first render, and index.html painted the class before that.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const index = Math.max(
    0,
    CYCLE.findIndex((step) => step.value === (theme ?? 'system')),
  )
  const current = CYCLE[index]!
  const next = CYCLE[(index + 1) % CYCLE.length]!
  const Icon = current.icon

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`${current.label}. Cambiar a: ${next.label.toLowerCase()}`}
      title={current.label}
      className="text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(next.value)}
    >
      {/* Keyed so each theme spins its own icon in. Deliberately no opacity or
          exit animation: a dropped frame would leave an empty button. */}
      <motion.span
        key={current.value}
        initial={{ rotate: -90, scale: 0.7 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={SPRING}
        className="grid place-items-center"
      >
        <Icon className="size-4" />
      </motion.span>
    </Button>
  )
}
