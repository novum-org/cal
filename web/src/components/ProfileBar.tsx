import { ArrowLeft, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { api } from '../lib/api.ts'
import { ThemeToggle } from './ThemeToggle.tsx'

type Props = {
  /** Rendered on the left. Without it the bar just shows the app mark. */
  back?: { to: string; label: string }
}

/**
 * The account strip that sits above every screen: where you came from on the
 * left, who you are and how to leave on the right. Sticky, because "volver"
 * belongs at the top of the page, not at the bottom of whatever you scrolled.
 */
export function ProfileBar({ back }: Props) {
  const nav = useNavigate()
  const [email, setEmail] = useState('')

  useEffect(() => {
    void api
      .me()
      .then((user) => setEmail(user.email))
      .catch(() => undefined)
  }, [])

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-4">
        {back === undefined ? (
          <span className="font-serif text-lg text-foreground">cal</span>
        ) : (
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2 text-muted-foreground hover:text-foreground">
            <Link to={back.to}>
              <ArrowLeft />
              {back.label}
            </Link>
          </Button>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span aria-hidden className="h-5 w-px bg-border" />
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-secondary font-mono text-xs text-secondary-foreground"
          >
            {(email.slice(0, 1) || '·').toUpperCase()}
          </span>
          <span className="hidden max-w-[18ch] truncate font-mono text-xs text-muted-foreground sm:inline">
            {email}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              void api.logout().then(() => nav('/login'))
            }}
          >
            <LogOut />
            Salir
          </Button>
        </div>
      </div>
    </div>
  )
}
