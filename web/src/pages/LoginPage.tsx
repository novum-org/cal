import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '../lib/api.ts'

export function LoginPage() {
  const nav = useNavigate()
  const [setup, setSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .me()
      .then(() => nav('/', { replace: true }))
      .catch(() => undefined)
    void api.status().then((s) => setSetup(s.setup_needed))
  }, [nav])

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError('')
    try {
      if (setup) await api.setup(email, password)
      else await api.login(email, password)
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar.')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-3xl">cal</CardTitle>
          <CardDescription>
            {setup ? 'Creá el primer usuario de esta instancia.' : 'Entrá a tu instancia.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={setup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>
            {error !== '' && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="h-10">
              {setup ? 'Crear y entrar' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
