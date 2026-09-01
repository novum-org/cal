import { Check, CircleCheckBig } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { buildChecklist, checklistProgress } from '../lib/checklist.ts'
import { SPRING, SWAP } from '../lib/motion.ts'
import type { Inputs } from '../lib/types.ts'

type Props = {
  inputs: Inputs
  touched: ReadonlySet<keyof Inputs>
  dirty: boolean
  onSave: () => void
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        'mt-px grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-200 ease-hermite',
        done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent',
      )}
    >
      <AnimatePresence initial={false}>
        {done && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING}
          >
            <Check className="size-3" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Side panel for the month form: what is filled in, what is still missing. */
export function SaveChecklist({ inputs, touched, dirty, onSave }: Props) {
  const sections = buildChecklist(inputs, touched)
  const { done, total, pct } = checklistProgress(sections)
  const complete = done === total

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-serif text-base text-foreground">Progreso del mes</h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {complete
              ? 'Todo cargado. Guardá cuando quieras.'
              : `Faltan ${total - done} campos para tener el mes completo.`}
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {sections.map((section) => (
            <li key={section.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-medium tracking-widest uppercase transition-colors duration-200 ease-hermite',
                    section.done ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {section.title}
                </span>
                <AnimatePresence initial={false}>
                  {section.done && (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={SPRING}
                      className="text-primary"
                    >
                      <CircleCheckBig className="size-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-2 text-xs leading-snug">
                    <Tick done={item.done} />
                    <span
                      className={cn(
                        'transition-colors duration-200 ease-hermite',
                        item.done ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {item.label}
                      {item.optional === true && (
                        <span className="ml-1 text-muted-foreground/70">(opcional)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onSave} className="w-full">
            {dirty ? 'Guardar cambios' : 'Guardar mes'}
          </Button>
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={dirty ? 'dirty' : 'clean'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={SWAP}
              className="text-center text-xs text-muted-foreground"
            >
              {dirty ? 'Hay cambios sin guardar.' : 'Todo lo cargado está guardado.'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  )
}
