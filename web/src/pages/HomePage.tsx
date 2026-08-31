import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '../lib/api.ts'
import type { Space } from '../lib/types.ts'

export function HomePage() {
  const nav = useNavigate()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('novum')
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .sessions()
      .then(setSpaces)
      .catch(() => nav('/login', { replace: true }))
  }, [nav])

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError('')
    try {
      const sp = await api.createSession(name.trim(), preset)
      nav(`/s/${sp.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear.')
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground">Sesiones</h1>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void api.logout().then(() => nav('/login'))
          }}
        >
          Salir
        </Button>
      </header>
      {spaces.length === 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">Todavía no hay servidores. Creá el primero.</p>
      ) : (
        <ul className="mb-8 flex flex-col gap-2">
          {spaces.map((sp) => (
            <li key={sp.id}>
              <Link
                to={`/s/${sp.id}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 ring-1 ring-foreground/5 hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="font-serif text-lg text-foreground">{sp.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{sp.policy.name}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Nueva sesión</CardTitle>
          <CardDescription>Un servidor, una política.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onCreate(e)} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor="session-name">Nombre</Label>
              <Input
                id="session-name"
                required
                placeholder="Novum, DiplomaticaMC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preset">Preset</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger id="preset" className="h-10 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novum">Novum</SelectItem>
                  <SelectItem value="generic">Genérico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="h-10">
              Crear
            </Button>
          </form>
          {error !== '' && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
