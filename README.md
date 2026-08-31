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

```bash
cp .env.example .env
podman compose -f deploy/compose.yml up --build
```

SQLite lives in the `cal-data` volume. Hosted → self-host: download **Dump para
migrar** while logged in, then `cal import dump.json` on the new box.

## Layout

```
cmd/cal/           serve | export | import
internal/engine/   pure calculate(inputs, policy)
internal/store/    SQLite
internal/httpapi/  auth, sessions, months, preview
web/               React 19 + Vite + Tailwind v4
deploy/            Containerfile + compose
ENGINE.md          behavioral spec (Novum numbers)
```

Engine tests in Go must keep reproducing the Novum preset numbers in `ENGINE.md`.
