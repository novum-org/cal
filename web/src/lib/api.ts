import { STAGES, type Inputs, type MonthRecord, type Policy, type Result, type Settings, type Space, type StageThresholds, type User } from './types.ts'

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
  patchSession: (id: string, body: { policy?: Policy; name?: string; revision?: number }) =>
    parse<Space>(
      fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    ),
  month: (id: string, month: string) =>
    parse<MonthRecord>(fetch(`/api/sessions/${id}/months/${month}`, { credentials: 'include' })),
  saveMonth: (id: string, month: string, inputs: Inputs, revision: number) =>
    parse<MonthRecord>(
      fetch(`/api/sessions/${id}/months/${month}`, {
        method: 'PUT',
        credentials: 'include',
        headers: jsonHeaders,
        body: JSON.stringify({ inputs, revision }),
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
