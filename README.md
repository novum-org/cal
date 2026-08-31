# novum-cal

Internal finance calculator for Novum / WeFaber. One screen, no auth, no backend.
You type what came in this month and what the server did, and it tells you where
the money goes and which rule decided that.

This tool is internal. It is not part of the public charter and it does not
publish anything. The charter it has to respect is short:

- infra is paid first
- the emergency fund target is 20% of accumulated cash, capped at about six
  months of infra cost
- growth spend only exists once infra and the emergency fund for the month are
  covered
- nothing pay to win is ever sold: no combat power, gems, skills, extra claims
  or lower upkeep. The calculator has no storefront and no revenue simulation
  for exactly that reason
- the server is 15+. That is a community rule and it does not touch the math

## Run it

Bun only. No npm, no npx.

```bash
bun install
```

```bash
bun dev
```

Then open the URL Vite prints. Everything else:

```bash
bun run typecheck
```

```bash
bunx oxlint .
```

```bash
bun test
```

```bash
bun run build
```

## What it does with your numbers

1. Infra is subtracted from `cash_in_month` before anything else exists.
2. What is left picks an allocation band.
3. Six override rules can move money out of a bucket, mostly out of Growth.
4. Every rule that fires shows up as an alert with its id, in plain Spanish.

The full audit of each rule, with formulas and worked examples, is in
[ENGINE.md](ENGINE.md). If the numbers on screen ever look wrong, that file is
the source of truth for what the code is supposed to do.

### Bands

Applied to `remaining = cash_in_month - infra_cost_month`.

| remaining | EF | Product | Growth | People |
| --- | ---: | ---: | ---: | ---: |
| $0 to $99 | 100% until cap | 0% | 0% | 0% |
| $100 to $499 | 20% until cap | 50% | 30% | 0% |
| $500 to $1999 | 20% until cap | 40% | 25% | 15% |
| $2000 and up | 20% until cap | 35% | 25% | 20% |

The EF share stops at the cap, which is `infra_cost_month * ef_target_months`
(six months by default). Whatever the EF cannot take stays in the unallocated
buffer instead of being reassigned, so the choice is yours and not the tool's.

### Stage gates

| stage | TPS at 19 or above | uptime |
| --- | ---: | ---: |
| alpha | 95% | not required |
| beta | 97% | 99.0% |
| v1 | 98% | 99.5% |

All of them are editable on screen under "Umbrales y reglas", along with the
Discord per player ceiling, the concurrency level that counts as high load, the
uptime floor for infra health and the runway floor.

## Saving and moving a month around

There is no API yet, so persistence is `localStorage` plus JSON.

- the form saves itself as a draft on every keystroke
- "Guardar mes" stores the month under its own key
- "Exportar JSON" downloads `novum-cal-YYYY-MM.json`
- "Importar JSON" restores a month from a file. Missing or broken fields fall
  back to defaults instead of throwing, so a hand edited file still loads
- "Copiar markdown" puts a summary table on the clipboard

The exported shape is the `Snapshot` type: `{ version, saved_at, inputs, settings }`.

## Wiring a real data source later

Every source implements one interface, in `src/lib/sources.ts`:

```ts
type NovumFinanceSource = {
  readonly id: string
  readonly label: string
  fetchMonth(month: string): Promise<Partial<Inputs>>
}
```

It returns a `Partial<Inputs>`: only the fields it actually knows. The app
merges that patch into the form, so a source that only knows revenue does not
have to invent server metrics.

Shipped today:

- `LocalJsonSource` (default): reads a month already saved in this browser
- `ManualFormSource`: returns nothing, the form is the source

Planned, and deliberately not implemented: `TebexSource`, `CraftingStoreSource`,
`StripeSource` for `cash_in_month`, `ServerMetricsSource` for TPS, uptime and
players, `DiscordSource` for member counts. There are TODO comments at the
bottom of `src/lib/sources.ts` describing each one. No endpoints or keys are
guessed anywhere in this repo, because a fake number in a real allocation
decision is worse than a missing one.

To add one:

1. create `src/lib/sources/<name>.ts` implementing `NovumFinanceSource`
2. keep the call server side if it needs a secret. This app ships as static
   files and anything in the bundle is public
3. push it into `SOURCES`. The UI picks it up from there and nothing else changes

Revenue sources should report money net of fees and chargebacks, never gross.

## Layout

```
src/lib/       engine, types, storage, sources, formatting. No React in here
src/components/ one screen worth of presentational components
tests/         engine tests, run with bun test
ENGINE.md      per rule audit of the math
```

The engine is pure: `calculate(inputs, settings)` returns a `Result` and touches
nothing else. All money math runs in integer cents, so the rows of the table
always add up to the cash that came in.

## Out of scope

No monetization storefront, no user accounts, no pay to win simulation, and no
projections. This is a calculator for one month at a time.
