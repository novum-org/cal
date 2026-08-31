.PHONY: dev test serve web build

dev:
	bun run scripts/dev.ts

test:
	go test ./...
	cd web && bun run typecheck
	cd web && bunx oxlint .

serve:
	go run ./cmd/cal serve --addr :8080 --db data/cal.db

web:
	cd web && bun dev

build:
	cd web && bun run build
	go build -o bin/cal ./cmd/cal
