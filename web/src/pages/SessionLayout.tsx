import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SessionProvider, useSession } from '../session/SessionContext.tsx'

const TABS = [
  { value: 'mes', path: '', label: 'Mes' },
  { value: 'politica', path: 'politica', label: 'Política' },
  { value: 'reparto', path: 'reparto', label: 'Reparto' },
  { value: 'cierre', path: 'cierre', label: 'Cierre' },
] as const

function tabFromPath(pathname: string): string {
  if (pathname.endsWith('/politica')) return 'politica'
  if (pathname.endsWith('/reparto')) return 'reparto'
  if (pathname.endsWith('/cierre')) return 'cierre'
  return 'mes'
}

function SessionChrome() {
  const { id } = useParams()
  const loc = useLocation()
  const nav = useNavigate()
  const { space, inputs, monthRec, stale } = useSession()
  const monthStatus = monthRec?.status ?? 'draft'
  const tab = tabFromPath(loc.pathname)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <NavLink to="/" className="text-xs text-primary hover:underline">
            Sesiones
          </NavLink>
          <h1 className="font-serif text-2xl text-foreground">{space.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {inputs.month} · {space.policy.name}
          </p>
        </div>
        <Badge variant="secondary">{monthStatus}</Badge>
      </header>
      {stale && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Alguien más guardó esta sesión. Recargá o volvé a guardar.</AlertDescription>
        </Alert>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = TABS.find((item) => item.value === value)
          if (next === undefined || id === undefined) return
          nav(next.path === '' ? `/s/${id}` : `/s/${id}/${next.path}`)
        }}
        className="mb-6"
      >
        <TabsList variant="line" className="w-full justify-start">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="px-3">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Outlet />
      <div className="mt-8">
        <Button variant="ghost" size="sm" asChild>
          <NavLink to="/">Volver a sesiones</NavLink>
        </Button>
      </div>
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
