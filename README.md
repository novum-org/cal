# cal

Policy engine for game-server finances. Infra first, then the rest.

Novum hosts a public instance. Anyone can clone and self-host the same binary.
The math lives in Go (`internal/engine`). The React app is a client. The browser
never sees store secrets and never allocates money on its own.

## Run (dev)

Once, to install the frontend deps:

```bash
cd web && bun install
```

Then, from the repo root, one command for both halves:

```bash
bun dev
```

That builds the API to `bin/cal-dev`, waits for it to answer on `:8080`, then
starts Vite. Output from both is prefixed (`api │`, `web │`) and Ctrl-C stops
the pair. If either process dies the other is stopped too, so there is never
half an app left running.

Vite proxies `/api` to `:8080`. Open the URL Vite prints. First visit creates
the admin user (or set `CAL_ADMIN_EMAIL` / `CAL_ADMIN_PASSWORD`).

Go code is compiled when `bun dev` starts, so restart it after touching Go.
The frontend hot reloads on its own. To run one half alone:

```bash
bun run dev:api
```

```bash
bun run dev:web
```

```bash
go test ./...
cd web && bun run typecheck && bunx oxlint .
```

## Run (one binary)

```bash
cd web && bun install && bun run build
go build -o bin/cal ./cmd/cal
./bin/cal serve --web web/dist --db data/cal.db
```

```bash
./bin/cal export --db data/cal.db > dump.json
./bin/cal import --db data/cal.db dump.json
```

## Self-host

Novum runs the public instance. Anyone else clones this repo and runs their own.
No Novum hostname or key is needed to boot: set your own admin in `.env` and go.

```bash
cp .env.example .env
podman compose -f deploy/compose.yml up --build
```

Open `http://localhost:8080`. The first boot creates the admin from
`CAL_ADMIN_EMAIL` / `CAL_ADMIN_PASSWORD`; with those unset, the first visitor
creates it through the UI instead. Set `CAL_SIGNUP=invite` once your accounts
exist to close signup entirely.

Everyone after the first admin joins by invite: open a session, **Equipo**, add
an email, and send the person the link it gives you. They pick a password and
land in that session. Nothing is emailed for you — you pass the link along.

### Backups

All state is the one SQLite file in the `cal-data` volume. Stop the container
and copy it, or take a consistent snapshot while it runs:

```bash
podman exec cal sqlite3 /data/cal.db ".backup '/data/backup.db'"
```

### Moving off the hosted instance

On the hosted app, log in and download **Dump para migrar**: sessions, policy,
months, planned and actual, members, and the ingest configs. Then, on your box:

```bash
./bin/cal import --db data/cal.db dump.json
```

Import is safe to run once on a fresh instance, and running it twice does not
duplicate anything. Passwords come across, so your team logs in unchanged.

### Who is on call

Nobody. Novum maintains the hosted instance only. If you self-host, the box, the
keys, the backups, and the uptime are yours. File bugs here, but do not expect
someone to fix your server at 3am.

## Sources

The month can pull its own numbers. Credentials live on the server, per session,
set from **Equipo > Fuentes**, and never reach the browser or any export.

| source | fills |
| --- | --- |
| Tebex | `cash_in_month` |
| Discord | `discord_members`, `discord_net_growth_month` |
| Métricas del server | `tps_pct_above_19`, `uptime_pct_month`, `unique_players_week`, `concurrent_avg` |

A pull fills only the fields the source actually measured and writes nothing on
its own: the numbers land in the form, marked with where they came from, and a
field you then edit is marked as an override. A source that fails says so and
contributes no number, because a wrong number is worse than a missing one.

Tebex's plugin API does not report its own cut, so the fee percentage is a
setting you fill from your agreement. Leave it at 0 to load gross.

### Métricas del server

There is no agreed exporter for game-server health, so `cal` reads a JSON
document you publish however you like: a cron job writing a file behind nginx, a
plugin endpoint, a Spark scrape. Point the source at its URL (`{month}` in the
URL is replaced with the month being pulled) and serve this:

```json
{
  "month": "2026-09",
  "tps_pct_above_19": 98.4,
  "uptime_pct_month": 99.7,
  "unique_players_week": 42,
  "concurrent_avg": 8.3
}
```

Every field is optional and a missing one stays missing. `month` is optional
too, but if it is there and does not match, the document is refused rather than
used for the wrong month.

## Layout

```
cmd/cal/           serve | export | import
internal/engine/   pure calculate(inputs, policy)
internal/store/    SQLite
internal/httpapi/  auth, sessions, months, preview
internal/sources/  Tebex, Discord, server metrics
web/               React 19 + Vite + Tailwind v4
deploy/            Containerfile + compose
ENGINE.md          behavioral spec (Novum numbers)
```

Engine tests in Go must keep reproducing the Novum preset numbers in `ENGINE.md`.
