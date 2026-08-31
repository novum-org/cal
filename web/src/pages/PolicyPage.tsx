import { SettingsPanel } from '../components/SettingsPanel.tsx'
import { useSession } from '../session/SessionContext.tsx'

export function PolicyPage() {
  const { settings, patchSettings, space } = useSession()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Bandas, umbrales y reglas de esta sesión. No es el mes: es la política. Preset actual:{' '}
        <span className="font-mono">{space.policy.name}</span>.
      </p>
      <SettingsPanel settings={settings} onChange={patchSettings} />
    </div>
  )
}
