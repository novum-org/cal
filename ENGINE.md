# ENGINE.md

Audit of `src/lib/engine.ts`. Every id in this file is the id you see on the
alerts in the UI, so an alert can always be traced back to a paragraph here.

## Ground rules

- `calculate(inputs, settings)` is pure. Same inputs, same output, no I/O.
- All money is converted to integer cents on the way in and back to USD only on
  the way out. Shares are floored, never rounded up, and the remainder lands in
  `unallocated`. That is why the table always adds up to `cash_in_month` exactly.
- Order matters. Infra, then the band, then the EF cap, then the Growth
  overrides, then the People guardrail. A rule can only move money that the step
  before it produced.

## Definitions

```
remaining     = max(0, cash_in_month - infra_cost_month)
ef_cap        = infra_cost_month * ef_target_months
ef_room       = max(0, ef_cap - ef_current)
runway_months = (cash_on_hand_start + cash_in_month - infra_cost_month) / infra_cost_month
discord_ratio = discord_members / unique_players_week   (null when there are no players)
```

`runway_months` is null when `infra_cost_month` is 0, because dividing by a cost
that does not exist says nothing.

### Two different notions of health

They are separate on purpose and they are easy to confuse.

**Stage gate** decides whether Growth is allowed to exist at all:

| stage | tps_min | uptime_min |
| --- | ---: | ---: |
| alpha | 95 | not required |
| beta | 97 | 99.0 |
| v1 | 98 | 99.5 |

**Infra health** decides where blocked Growth money goes. Infra is healthy when
all three hold:

```
uptime_pct_month >= infra_health_uptime_floor    (default 99.0)
runway_months is null or >= min_runway_months    (default 2)
not load_pressure                                 (see R5)
```

So alpha can ignore uptime for its stage gate and still be told its infra is
sick, which is the intended behaviour: the stage you claim and the state of the
box are not the same claim.

## B0: band selection

Bands apply to `remaining`, not to `cash_in_month`.

| id | remaining | EF | Product | Growth | People |
| --- | --- | ---: | ---: | ---: | ---: |
| micro | 0 to 99.99 | 100% | 0% | 0% | 0% |
| mid | 100 to 499.99 | 20% | 50% | 30% | 0% |
| large | 500 to 1999.99 | 20% | 40% | 25% | 15% |
| mega | 2000 and up | 20% | 35% | 25% | 20% |

The micro band reads "leftover stays as buffer, but move it to the EF if infra
is fully covered". Inside this branch infra is covered by construction, because
an uncovered month exits at R1 before a band is ever picked. So the micro band
sends the whole leftover to the EF and anything the EF cannot take falls to
`unallocated`. A month that could not pay infra never reaches this code path.

Every other band sums to exactly 100% of `remaining`.

## R1: infra is paid first

```
if cash_in_month < infra_cost_month:
    infra       = cash_in_month
    everything else = 0
    band        = null
    shortfall   = infra_cost_month - cash_in_month
```

Red alert. The function returns here. No band, no EF fill, no Product, no
Growth, no People. Note that the EF is not raided to cover the gap: the tool
reports the hole and leaves the decision to a human, because spending the
emergency fund is exactly the kind of call that should not be automatic.

Example: `cash_in_month = 20`, `infra_cost_month = 35`. Infra gets $20.00, the
shortfall is $15.00, everything else is $0.00.

## R2: the EF cap

```
ef_share = floor(remaining * band.ef)
ef_fill  = min(ef_share, ef_room)
overflow = ef_share - ef_fill
```

The fill stops at the cap and not one cent past it. The overflow is **not**
redistributed to Product, Growth or People. It goes to `unallocated`.

That is a decision, not an oversight. The bands describe what to do with money
when the EF still needs feeding. Once the fund is full the band has nothing to
say about that share, and inventing a rule would quietly change policy. Leaving
it visible in the buffer puts the call back where it belongs. If you ever want
it to flow to Product instead, that is a one line change in `calculate`, and it
should be a deliberate charter change, not a patch.

Example: `remaining = 1145`, band large, `ef_current = 120`, `ef_cap = 330`.
`ef_share = 229.00`, `ef_room = 210.00`, so `ef_fill = 210.00` and $19.00 shows
up as unallocated.

## R3: stage gates cut Growth

If the stage TPS gate fails, or the stage uptime gate fails when the stage has
one, then `growth = 0` and the whole Growth share moves:

- infra healthy: it moves to **Product**
- infra not healthy: it moves to **Reserva de infra** (`infra_buffer`)

The point of the second branch is that a failing box is not a marketing problem.
Money freed by a health failure should be able to buy a bigger VPS, not ads.

Example: beta, `tps_pct_above_19 = 96.5` against a 97 gate, `remaining = 1145`.
Growth's $286.25 moves to Product, which ends at $744.25.

## R4: community ratio cuts Growth

```
if unique_players_week > 0 and discord_members / unique_players_week > discord_per_player_max:
    growth = 0
```

Default ceiling is 8. Same redirect as R3. The reasoning is written into the
alert: a big Discord that does not convert into players is a conversion and
retention problem, and buying more attention on top of a leaky funnel makes the
ratio worse, not better.

When `unique_players_week` is 0 the ratio is null and this rule does not fire,
because a number divided by nothing is not a signal. If Discord has members and
the player count is missing, alert I3 says so instead of silently passing.

## R5: load pressure

```
load_pressure = (stage TPS gate failed) and (concurrent_avg >= concurrent_high)
```

Default `concurrent_high` is 20. This does not cut Growth by itself, R3 already
did that when TPS failed. What it does is force `infra_healthy` to false, which
sends the Growth share to the infra reserve instead of to Product. Do not spend
Growth to add load to a server that is already failing under the load it has.

High concurrency on a healthy server changes nothing.

## R6: People comes out of profit

```
profit_after_ef = max(0, remaining - ef_fill)
people          = min(people, profit_after_ef)
```

People is bonuses and cofounder profit share, so it can only be paid out of what
is left after infra and after the planned EF contribution. With the bands as
they are today this clamp never actually binds, because the EF takes at most 20%
of `remaining` and People at most 20%, so there is always profit left. It is a
guardrail: it exists so that editing a band later cannot silently start paying
People out of emergency fund money. The warning fires only if a band that pays
People ends up paying zero.

## Informational alerts

These never move money. They exist so the screen does not stay quiet about
something the owner should see.

- **I1** runway below `min_runway_months` (default 2). Red, and it also makes
  infra unhealthy through the health check above.
- **I2** uptime below `infra_health_uptime_floor` (default 99.0), independent of
  the stage gate.
- **I3** Discord has members but `unique_players_week` is 0, so R4 could not be
  evaluated.
- **I4** the planned EF fill leaves the fund above the charter reference target,
  which is `min(0.20 * (cash_on_hand_start + cash_in_month), ef_cap)`. The cap in
  R2 is what actually binds. This target is shown as a thin marker on the EF bar
  and never changes an allocation.

## Invariant

For any input:

```
infra + ef_fill + product + growth + people + infra_buffer + unallocated == cash_in_month
```

`tests/engine.test.ts` checks that on a spread of ugly amounts, along with each
rule above. Run it with `bun test`.
