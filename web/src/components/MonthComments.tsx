import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '../lib/api.ts'
import { itemVariants, listVariants } from '../lib/motion.ts'
import type { MonthComment } from '../lib/types.ts'

const when = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('es-UY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Comments live beside the month, not inside it, so leaving one never touches
 * the closed snapshot or bumps the month revision.
 */
export function MonthComments({ id, month }: { id: string; month: string }) {
  const [list, setList] = useState<MonthComment[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api
      .comments(id, month)
      .then((rows) => {
        if (!cancelled) setList(rows)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id, month])

  const submit = (): void => {
    const body = draft.trim()
    if (body === '' || sending) return
    setSending(true)
    void api
      .addComment(id, month, body)
      .then((c) => {
        setList((prev) => [...prev, c])
        setDraft('')
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'comentario'))
      .finally(() => setSending(false))
  }

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay comentarios en este mes.
        </p>
      ) : (
        <motion.ul
          variants={listVariants}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-3"
        >
          {list.map((c) => (
            <motion.li key={c.id} variants={itemVariants} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{c.email}</span>
                <span>{when(c.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </motion.li>
          ))}
        </motion.ul>
      )}
      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Qué pasó este mes que los números no cuentan"
          rows={2}
        />
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={draft.trim() === '' || sending}
          onClick={submit}
        >
          Comentar
        </Button>
      </div>
    </div>
  )
}
