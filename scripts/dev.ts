#!/usr/bin/env bun
/**
 * `bun dev` for the whole app: the Go API and the Vite frontend in one terminal.
 *
 * Vite proxies `/api` to the API (web/vite.config.ts), so the API has to be
 * listening before the frontend is worth opening. The API is built to a binary
 * first instead of `go run`, because killing `go run` can leave the compiled
 * child holding the port.
 *
 * Either process dying takes the other one down, so there is never half an app
 * running in the background.
 */

import { spawn, type Subprocess } from 'bun'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not URL.pathname: on Windows the latter yields "/E:/...", which
// is not a directory any process can be spawned in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Windows will not spawn an extensionless file, and `go build -o` writes exactly
// the name it is given, so the suffix has to be part of both.
const API_BIN = join(ROOT, 'bin', process.platform === 'win32' ? 'cal-dev.exe' : 'cal-dev')

/** CAL_ADDR is ":8080" or "host:8080"; the health check only needs the port. */
const apiPort = (process.env['CAL_ADDR'] ?? ':8080').split(':').pop() || '8080'
const healthUrl = `http://127.0.0.1:${apiPort}/api/health`

const children: Subprocess[] = []
let stopping = false

const paint = (code: number, text: string): string => `\x1b[${code}m${text}\x1b[0m`

function stop(exitCode: number): void {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  // Give the pipes a tick to flush what the children printed on their way out.
  setTimeout(() => process.exit(exitCode), 120)
}

/** Prefixes every line so two processes in one terminal stay readable. */
async function relay(stream: ReadableStream<Uint8Array>, label: string, color: number) {
  const prefix = `${paint(color, label.padEnd(3))} ${paint(90, '│')} `
  const decoder = new TextDecoder()
  let rest = ''
  for await (const chunk of stream) {
    const lines = (rest + decoder.decode(chunk, { stream: true })).split('\n')
    rest = lines.pop() ?? ''
    for (const line of lines) console.log(prefix + line)
  }
  if (rest !== '') console.log(prefix + rest)
}

function start(label: string, color: number, cmd: string[], cwd: string): Subprocess {
  const child = spawn({ cmd, cwd, stdin: 'inherit', stdout: 'pipe', stderr: 'pipe' })
  children.push(child)
  void relay(child.stdout as ReadableStream<Uint8Array>, label, color)
  void relay(child.stderr as ReadableStream<Uint8Array>, label, color)
  void child.exited.then((code) => {
    if (stopping) return
    console.log(paint(90, `\n${label} exited (${code}). Stopping the other process.`))
    stop(code ?? 0)
  })
  return child
}

/** Compiles up front so a Go syntax error is one clear message, not log noise. */
async function buildApi(): Promise<void> {
  console.log(paint(90, 'building the api…'))
  const build = spawn({
    cmd: ['go', 'build', '-o', API_BIN, './cmd/cal'],
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await build.exited
  if (code !== 0) {
    console.error(paint(31, 'go build failed. Nothing started.'))
    process.exit(code)
  }
}

/** Resolves once the API answers, false if it never does. */
async function waitForApi(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && !stopping) {
    try {
      await fetch(healthUrl, { signal: AbortSignal.timeout(1000) })
      return true
    } catch {
      await Bun.sleep(200)
    }
  }
  return false
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

await buildApi()

// `--web ''` keeps the API from serving a stale web/dist next to the Vite one.
start('api', 36, [API_BIN, 'serve', '--web', ''], ROOT)

if (await waitForApi()) {
  console.log(paint(90, `api up on :${apiPort}, starting the frontend…`))
} else if (!stopping) {
  console.log(paint(33, `api did not answer on :${apiPort} yet, starting the frontend anyway.`))
}

if (!stopping) start('web', 35, ['bun', 'run', 'dev'], join(ROOT, 'web'))
