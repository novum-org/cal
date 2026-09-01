import { motion } from 'motion/react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { itemVariants, listVariants } from '../lib/motion.ts'
import type { Alert as EngineAlert, AlertLevel, Result } from '../lib/types.ts'

const ORDER: Record<AlertLevel, number> = { red: 0, warn: 1, info: 2 }

const byLevel = (a: EngineAlert, b: EngineAlert): number => ORDER[a.level] - ORDER[b.level]

export function AlertList({ result }: { result: Result }) {
  const alerts = [...result.alerts].sort(byLevel)
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">Ninguna regla especial.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-serif text-base">Qué dice el motor</h2>
      <motion.div
        variants={listVariants}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-2"
      >
        {alerts.map((alert, index) => (
          <motion.div key={`${alert.rule}-${index}`} variants={itemVariants}>
            <Alert variant={alert.level === 'red' ? 'destructive' : 'default'}>
              <AlertTitle className="flex items-center gap-2">
                <Badge
                  variant={alert.level === 'red' ? 'destructive' : 'secondary'}
                  className="font-mono"
                >
                  {alert.rule}
                </Badge>
              </AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
