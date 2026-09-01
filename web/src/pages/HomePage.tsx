import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProfileBar } from '../components/ProfileBar.tsx'
import { api } from '../lib/api.ts'
import { itemVariants, listVariants, pageVariants } from '../lib/motion.ts'
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
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <ProfileBar />
      <motion.main variants={pageVariants} initial="initial" animate="animate">
        <header className="py-8">
          <h1 className="font-serif text-3xl text-foreground">Sesiones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Un servidor, una política.</p>
        </header>
        {spaces.length === 0 ? (
          <p className="mb-6 text-sm text-muted-foreground">
            Todavía no hay servidores. Creá el primero.
          </p>
        ) : (
          <motion.ul
            variants={listVariants}
            initial="initial"
            animate="animate"
            className="mb-8 flex flex-col gap-2"
          >
            {spaces.map((sp) => (
              <motion.li key={sp.id} variants={itemVariants}>
                <Link
                  to={`/s/${sp.id}`}
                  className="group flex items-center justify-between gap-4 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-[box-shadow,transform,background-color] duration-200 ease-hermite outline-none hover:bg-accent/40 hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-serif text-lg text-foreground">
                      {sp.name}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {sp.policy.name}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-hermite group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Nueva sesión</CardTitle>
            <CardDescription>Un servidor, una política.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => void onCreate(e)}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="grid min-w-0 flex-1 gap-2">
                <Label htmlFor="session-name">Nombre</Label>
                <Input
                  id="session-name"
                  required
                  placeholder="Novum, DiplomaticaMC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preset">Preset</Label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger id="preset" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novum">Novum</SelectItem>
                    <SelectItem value="generic">Genérico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Crear</Button>
            </form>
            {error !== '' && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </motion.main>
    </div>
  )
}
