import {
  STAGES,
  type AddMemberResult,
  type Inputs,
  type Invite,
  type Member,
  type MonthComment,
  type PullResult,
  type SourceOrigin,
  type SourceState,
  type MonthRecord,
  type Policy,
  type Preset,
  type Result,
  type Settings,
  type Space,
  type StageThresholds,
  type User,
} from './types.ts'

const jsonHeaders = { 'Content-Type': 'application/json' }

async function parse<T>(res: Promise<Response>): Promise<T> {
  const response = await res
  const text = await response.text()
  const data: unknown = text === '' ? null : JSON.parse(text)
  if (!response.ok) {
    const err =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : response.statusText
    throw new Error(err)
  }
  return data as T
}

export const api = {
  status: () => parse<{ setup_needed: boolean; signup: string }>(fetch('/api/auth/status')),
  me: () => parse<User>(fetch('/api/auth/me', { credentials: 'include' })),
  setup: (email: string, password: string) =>
    parse<User>(
      fetch('/api/auth/setup', {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ email, password }),
      }),
    ),
  login: (email: string, password: string) =>
    parse<User>(
      fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ email, password }),
      }),
    ),
  logout: () => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }),
  sessions: () => parse<Space[]>(fetch('/api/sessions', { credentials: 'include' })),
  createSession: (name: string, preset: string) =>
    parse<Space>(
      fetch('/api/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ name, preset }),
      }),
    ),
  session: (id: string) => parse<Space>(fetch(`/api/sessions/${id}`, { credentials: 'include' })),
  patchSession: (
    id: string,
    body: { policy?: Policy; name?: string; archived?: boolean; revision?: number },
  ) =>
    parse<Space>(
      fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    ),
  presets: () => parse<Preset[]>(fetch('/api/presets', { credentials: 'include' })),
  applyPreset: (id: string, preset: string, revision: number) =>
    parse<Space>(
      fetch(`/api/sessions/${id}/preset`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ preset, revision }),
      }),
    ),
  members: (id: string) =>
    parse<Member[]>(fetch(`/api/sessions/${id}/members`, { credentials: 'include' })),
  addMember: (id: string, email: string, role: string) =>
    parse<AddMemberResult>(
      fetch(`/api/sessions/${id}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ email, role }),
      }),
    ),
  removeMember: async (id: string, userId: string): Promise<void> => {
    const res = await fetch(`/api/sessions/${id}/members/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('No se pudo sacar a esa persona.')
  },
  invites: (id: string) =>
    parse<Invite[]>(fetch(`/api/sessions/${id}/invites`, { credentials: 'include' })),
  revokeInvite: async (id: string, code: string): Promise<void> => {
    const res = await fetch(`/api/sessions/${id}/invites/${code}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('No se pudo anular la invitación.')
  },
  inviteInfo: (code: string) =>
    parse<{ email: string; space_name: string }>(fetch(`/api/auth/invites/${code}`)),
  redeem: (code: string, password: string) =>
    parse<User>(
      fetch('/api/auth/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ code, password }),
      }),
    ),
  month: (id: string, month: string) =>
    parse<MonthRecord>(fetch(`/api/sessions/${id}/months/${month}`, { credentials: 'include' })),
  saveMonth: (
    id: string,
    month: string,
    inputs: Inputs,
    revision: number,
    sources?: Record<string, SourceOrigin>,
  ) =>
    parse<MonthRecord>(
      fetch(`/api/sessions/${id}/months/${month}`, {
        method: 'PUT',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ inputs, revision, sources }),
      }),
    ),
  preview: (id: string, inputs: Inputs) =>
    parse<Result>(
      fetch(`/api/sessions/${id}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ inputs }),
      }),
    ),
  plan: (id: string, month: string) =>
    parse<MonthRecord>(
      fetch(`/api/sessions/${id}/months/${month}/plan`, {
        method: 'POST',
        credentials: 'include',
      }),
    ),
  close: (id: string, month: string, actuals: Record<string, number>, revision: number) =>
    parse<MonthRecord>(
      fetch(`/api/sessions/${id}/months/${month}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ actuals, revision }),
      }),
    ),
  reopen: (id: string, month: string, revision: number) =>
    parse<MonthRecord>(
      fetch(`/api/sessions/${id}/months/${month}/reopen`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ revision }),
      }),
    ),
  comments: (id: string, month: string) =>
    parse<MonthComment[]>(
      fetch(`/api/sessions/${id}/months/${month}/comments`, { credentials: 'include' }),
    ),
  addComment: (id: string, month: string, body: string) =>
    parse<MonthComment>(
      fetch(`/api/sessions/${id}/months/${month}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ body }),
      }),
    ),
  sourceStates: (id: string) =>
    parse<SourceState[]>(fetch(`/api/sessions/${id}/sources`, { credentials: 'include' })),
  saveSourceConfig: (id: string, sourceId: string, config: Record<string, string>) =>
    parse<{ source: string }>(
      fetch(`/api/sessions/${id}/sources/${sourceId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify(config),
      }),
    ),
  clearSourceConfig: async (id: string, sourceId: string): Promise<void> => {
    const res = await fetch(`/api/sessions/${id}/sources/${sourceId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('No se pudo borrar la configuración.')
  },
  pull: (id: string, month: string) =>
    parse<PullResult>(
      fetch(`/api/sessions/${id}/months/${month}/pull`, {
        method: 'POST',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({}),
      }),
    ),
  exportDump: async (): Promise<Blob> => {
    const res = await fetch('/api/export', { credentials: 'include' })
    if (!res.ok) throw new Error('export failed')
    return res.blob()
  },
}

export function settingsFromPolicy(policy: Policy): Settings {
  const thresholds = {} as StageThresholds
  for (const stage of STAGES) {
    thresholds[stage] = policy.stages[stage] ?? { tps_min: 0, uptime_min: null }
  }
  return {
    thresholds,
    discord_per_player_max: policy.discord_per_player_max,
    concurrent_high: policy.concurrent_high,
    infra_health_uptime_floor: policy.infra_health_uptime_floor,
    min_runway_months: policy.min_runway_months,
  }
}

export function policyWithSettings(policy: Policy, s: Settings): Policy {
  return {
    ...policy,
    stages: s.thresholds,
    discord_per_player_max: s.discord_per_player_max,
    concurrent_high: s.concurrent_high,
    infra_health_uptime_floor: s.infra_health_uptime_floor,
    min_runway_months: s.min_runway_months,
  }
}
