import { Check, Copy, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '../lib/api.ts'
import { copyText } from '../lib/browser.ts'
import { itemVariants, listVariants } from '../lib/motion.ts'
import type { Invite, Member } from '../lib/types.ts'
import { SourcesPanel } from '../components/SourcesPanel.tsx'
import { useSession } from '../session/SessionContext.tsx'

const inviteUrl = (code: string): string => `${window.location.origin}/invitacion/${code}`

function InviteRow({ invite, onRevoke }: { invite: Invite; onRevoke: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-sm">{invite.email}</div>
        <div className="text-xs text-muted-foreground">Invitación pendiente · {invite.role}</div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            void copyText(inviteUrl(invite.code)).then((ok) => {
              if (!ok) {
                toast.error('No se pudo copiar el link.')
                return
              }
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
              toast.success('Link copiado. Mandáselo por donde quieras.')
            })
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Anular la invitación de ${invite.email}`}
          onClick={onRevoke}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

export function TeamPage() {
  const { id, space, renameSpace, archiveSpace } = useSession()
  const nav = useNavigate()
  const isOwner = space.role === 'owner'

  const [name, setName] = useState(space.name)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')

  const refresh = useCallback((): void => {
    void api
      .members(id)
      .then(setMembers)
      .catch(() => undefined)
    if (isOwner) {
      void api
        .invites(id)
        .then(setInvites)
        .catch(() => undefined)
    }
  }, [id, isOwner])

  useEffect(refresh, [refresh])

  const fail = (err: unknown, fallback: string): void => {
    toast.error(err instanceof Error ? err.message : fallback)
  }

  const onAdd = (event: FormEvent): void => {
    event.preventDefault()
    void api
      .addMember(id, email.trim(), role)
      .then((res) => {
        setEmail('')
        refresh()
        if (res.member !== undefined) toast.success(`${res.member.email} ya está en la sesión.`)
        else toast.success('Invitación creada. Copiá el link y mandáselo.')
      })
      .catch((err: unknown) => fail(err, 'No se pudo agregar.'))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Quién entra a esta sesión y cómo se llama. La política y los meses no se tocan desde acá.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Nombre</CardTitle>
          <CardDescription>Es lo que ves en el header y en la lista de sesiones.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              renameSpace(name.trim())
            }}
          >
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor="space-name">Nombre de la sesión</Label>
              <Input
                id="space-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!isOwner}
              />
            </div>
            <Button type="submit" disabled={!isOwner || name.trim() === '' || name === space.name}>
              Guardar nombre
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Equipo</CardTitle>
          <CardDescription>
            {isOwner
              ? 'Agregá gente por email. Si todavía no tiene cuenta, sale una invitación con link.'
              : 'Solo quien creó la sesión puede cambiar el equipo.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <motion.ul
            variants={listVariants}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-2"
          >
            {members.map((member) => (
              <motion.li
                key={member.user_id}
                variants={itemVariants}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm">{member.email}</div>
                  <div className="text-xs text-muted-foreground">{member.role}</div>
                </div>
                {isOwner && member.role !== 'owner' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Sacar a ${member.email}`}
                    onClick={() => {
                      void api
                        .removeMember(id, member.user_id)
                        .then(() => {
                          refresh()
                          toast.success(`${member.email} ya no está en la sesión.`)
                        })
                        .catch((err: unknown) => fail(err, 'No se pudo sacar.'))
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </motion.li>
            ))}
          </motion.ul>

          {invites.length > 0 && (
            <ul className="flex flex-col gap-2">
              {invites.map((invite) => (
                <InviteRow
                  key={invite.code}
                  invite={invite}
                  onRevoke={() => {
                    void api
                      .revokeInvite(id, invite.code)
                      .then(() => {
                        refresh()
                        toast.success('Invitación anulada.')
                      })
                      .catch((err: unknown) => fail(err, 'No se pudo anular.'))
                  }}
                />
              ))}
            </ul>
          )}

          {isOwner && (
            <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onAdd}>
              <div className="grid min-w-0 flex-1 gap-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  required
                  placeholder="alguien@tuserver.gg"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-role">Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="member-role" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Agregar</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Fuentes</CardTitle>
          <CardDescription>
            De dónde salen los números del mes. Las credenciales quedan en el servidor, por
            sesión, y nunca vuelven al navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SourcesPanel id={id} isOwner={isOwner} />
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Archivar</CardTitle>
            <CardDescription>
              Sale de la lista de sesiones. No se borra nada: los meses y la política quedan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!window.confirm(`¿Archivar "${space.name}"? Sale de la lista de sesiones.`)) {
                  return
                }
                archiveSpace()
                nav('/')
              }}
            >
              Archivar sesión
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
