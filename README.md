# cal

Policy engine for game-server finances. Infra first, then the rest.

Novum hosts a public instance. Anyone can clone and self-host the same binary.
The math lives in Go (`internal/engine`). The React app is a client. The browser
never sees store secrets and never allocates money on its own.

## Run (dev)

Two processes.

```bash
go run ./cmd/cal serve --addr :8080 --db data/cal.db
```

```bash
cd web
bun install
bun dev
```

Vite proxies `/api` to `:8080`. Open the URL Vite prints. First visit creates
the admin user (or set `CAL_ADMIN_EMAIL` / `CAL_ADMIN_PASSWORD`).

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
