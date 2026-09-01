import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ProfileBar } from '../components/ProfileBar.tsx'
import { SessionNav } from '../components/SessionNav.tsx'
import { pageVariants } from '../lib/motion.ts'
import { SessionProvider, useSession } from '../session/SessionContext.tsx'

function SessionChrome() {
  const loc = useLocation()
  const outlet = useOutlet()
  const { space, inputs, monthRec, stale, dirty } = useSession()
  const monthStatus = monthRec?.status ?? 'draft'

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <ProfileBar back={{ to: '/', label: 'Sesiones' }} />
      <header className="flex flex-wrap items-end justify-between gap-4 py-6">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl text-foreground">{space.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {inputs.month} · {space.policy.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="outline" className="font-mono">
              sin guardar
            </Badge>
          )}
          <Badge variant="secondary" className="font-mono">
            {monthStatus}
          </Badge>
        </div>
      </header>
      <AnimatePresence>
        {stale && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Alguien más guardó esta sesión. Recargá o volvé a guardar.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      <SessionNav />
      {/* Keyed on the path so each section animates itself in. No exit
          animation on purpose: `mode="wait"` would hold the incoming page
          hostage to the outgoing one finishing, and a dropped frame there
          leaves the user staring at the section they just left. */}
      <motion.main
        key={loc.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="pt-6"
      >
        {outlet}
      </motion.main>
    </div>
  )
}

export function SessionLayout() {
  return (
    <SessionProvider>
      <SessionChrome />
    </SessionProvider>
  )
}
