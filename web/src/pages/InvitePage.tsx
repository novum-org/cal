import { motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '../lib/api.ts'
import { pageVariants } from '../lib/motion.ts'

type InviteInfo = { email: string; space_name: string }

/** Where an invite link lands: shows who it is for, then takes a password. */
export function InvitePage() {
  const { code } = useParams()
  const nav = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (code === undefined) return
    void api
      .inviteInfo(code)
      .then(setInfo)
      .catch(() => setError('Esta invitación no existe, ya se usó o venció.'))
      .finally(() => setChecking(false))
  }, [code])

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (code === undefined) return
    setError('')
    try {
      await api.redeem(code, password)
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
    }
  }

  return (
    <motion.main
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-3xl">cal</CardTitle>
          <CardDescription>
            {info === null
              ? 'Invitación'
              : `Te invitaron a ${info.space_name}. Elegí una contraseña y entrás.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <p className="text-sm text-muted-foreground">Revisando la invitación…</p>
          ) : info === null ? (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button type="button" variant="outline" onClick={() => nav('/login')}>
                Ir a entrar
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" value={info.email} readOnly disabled className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-password">Contraseña</Label>
                <Input
                  id="invite-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error !== '' && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit">Crear cuenta y entrar</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.main>
  )
}
