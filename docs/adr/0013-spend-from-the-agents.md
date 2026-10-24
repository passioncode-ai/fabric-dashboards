# ADR-0013 — Spend comes from the agents: each service reports its own, the app sums it

Status: accepted · 2026-10-04 · depends on Fabric Agent Contract DEC-0021
([PR #10](https://github.com/passioncode-ai/fabric-agent-contract/pull/10), merged to `main` as
`9091d3d`)

## Context

On 2026-10-04 the operator asked for one place that shows which agents run, what each one spent
and on what. The agents themselves should collect it, at the protocol level. Until then:

- usage existed only per job, in the contract's interop `usage` block;
- some agents put spend in a summary tile («Spend today, $»), which a host can
  neither add up nor compare;
- Fabric Switchboard reports provider quota percentages, not money.

The contract now carries a usage report (DEC-0021): `surfaces.usage.path` in the well-known
document, a token-gated `service-usage.schema.json` answer covering up to 31 UTC days per
provider and model, and **unknown cost as `null`, never `0`**.

## Decision

<a id="decision"></a>

1. **A Spend page** (sidebar, after Activity) shows totals for today, 7 days and 30 days across
   every agent that reports. Below them is one row per reporting service: today, 7 days, 30 days
   and its own budget. A row expands to the per-model breakdown over the report.
2. **Read on demand, in the main process.** The report is read when Spend opens, every 60 s while
   it stays open, and when an agent calls the MCP `spend` tool. It is never read in the
   background: while the window is hidden, the main process answers the last sums without
   reading any service, because the renderer gets no visibility change when the window hides
   (`test/e2e/spend.test.ts`). The idle budget of LC-08 is unchanged. The token is read in the main process like
   the events feed. The renderer receives only sums (`SpendEntry`).
3. **Unknown is never $0.** A sum that includes unpriced calls reads «≥ $x». A window whose calls
   all lack a price reads «unknown». A service that could not be read is listed with its reason,
   and the totals become lower bounds.
4. **Services that do not report are named, not hidden.** «Not reporting spend yet: …» lists them,
   so a missing number is never mistaken for a zero.
5. **Shared reading code.** `checkUsage` and `summarizeUsage` live in
   `@passioncode-ai/fabric-service-host/usage` (0.3.0), so Fabric can sum the same reports the
   same way. The token-gated `fetchUsage` stays in the app, as the events feed does (ADR-0006).

## Consequences

- An agent appears on Spend once it ships `surfaces.usage`. The kits
  (`building-fabric-services`) and each agent adopt it on their own schedule; until then the page
  names them as not reporting.
- The contract fixtures are vendored from contract `main` `9091d3d`
  (`test/fixtures/contract/SOURCE.txt`).
- The kit's sample service is vendored from `fabric-agent-adapter` `v0.8.0`, which reports its own
  spend; the main end-to-end test reads that report on Spend (FD-13,
  `test/fixtures/sample-service/SOURCE.txt`).
- Organisation-wide spend across machines (an employee's agents seen by an administrator) is
  Fabric's aggregation over these same reports. It is not this app's job (see the agent-estate
  architecture report, `docs/reports/2026-10-04-agent-estate-architecture/`).

## Amendment — 2026-10-07: every limit, not one budget (DEC-0027)

The operator, 2026-10-07: «надо чтобы всегда лимиты все были видны в коста агентов» — every limit an
agent applies must always be visible on Spend. An agent that orders paid work applies many (per order,
approval, daily, monthly, velocity, pools, emergency stops, each enforced or skipped); DEC-0021's one
`budget` could not carry them. Shape proposed here and agreed with that agent's owner, merged in the
contract as DEC-0027 (fabric-agent-contract `94b1829`, rule FAC-SEM-031). Dashboards 0.6.4:

- `@passioncode-ai/fabric-service-host` 0.3.3 reads `budgets[]` (`limitsProblem`, `rankLimits`); the
  contract fixtures are re-copied at `94b1829` (29 files, four of them DEC-0027's).
- Spend's last column is **Limits**: the limit that most needs a person — red when it stopped work or
  is breached, amber at 80 % — with how many more; an agent with only the older `budget` keeps that
  line. Expanding an agent lists every limit (which one and for whom, its window, spent of limit, its
  state) above the models. A limit that is not enforced is muted, never hidden; an approval threshold
  is never a breach; an unknown kind shows by the agent's own name (`src/core/limits.ts`).
- MCP `spend` returns the ranked `limits` with each agent's summary.
- Tests: `packages/service-host/test/usage.test.ts` *DEC-0027* (the contract's positive and three
  negative fixtures, the ranking), `test/spend.test.ts` *DEC-0027* (wording in English and Russian),
  `test/e2e/spend.test.ts` (a breached limit leads the row; all eight listed in the running app).

## Amendment — 2026-10-22: a subscription's value is an estimate, not money (FD-88)

An agent's owner reported (board thread `ea2e4f3d`) that Spend read $147.26 for a month in which the
agent spent $6.80: $140.47 was its `claude-opus-5-5` calls on the operator's own subscription, priced
at list price. The contract says a `route: subscription` row is "not metered" (DEC-0046,
`service.md` *Usage report*) but no host rule said what to sum. Decided here, by that wording:

- **Money is every row not paid by a subscription**: `key`, `platform-metered`, and a row with no
  `route` (a report written before DEC-0046 keeps its meaning).
- A subscription row's `costUsd` is kept apart as `estimateUsd` (with `subscriptionCalls`) and shown
  beside the money as "+ ~$140.47 on subscriptions", never added to it; its calls and tokens still
  count. A window whose calls were all on a subscription spent $0, never "unknown".
- `@passioncode-ai/fabric-service-host` 0.6.0 sums windows row by row and keeps one model entry per
  route; MCP `spend` returns both fields; the Overview strip shows money only.
- Proposed to the contract owner on the same thread as a host rule, so every host sums alike.
- Tests: `packages/service-host/test/usage.test.ts` *FD-88*, `test/spend.test.ts` *sumSpend*.

## Amendment of 2026-10-23: an unpriced subscription is unknown, not ~$0 (FD-97, DEC-0110)

The contract wrote FD-88's rule as DEC-0110 (`usageSpend`, CT-115) and asked one thing more of Dashboards: the estimate
side reads like the money side. Subscription calls none of which is priced have an unknown estimate (`estimateUsd:
null`, shown "+ subscription calls not priced", a model "subscription, not priced"); some unpriced make it a lower bound
(`estimatePartial`, "+ at least ~$x"). Across agents, one agent with an unpriced subscription makes the sum a lower bound;
when no agent's subscription calls are priced, it is unknown. Before this an unpriced subscription row added 0 and read
"~$0". `@passioncode-ai/fabric-service-host` 0.8.0 (`estimateUsd: number | null`, `estimatePartial`). Tests:
`packages/service-host/test/usage.test.ts` *FD-97* (the contract's `usageSpend` cases through the host's sums, red
before the change), `test/spend.test.ts` *sumSpend*, `test/e2e/spend.test.ts`.

Reviewed 2026-10-24 (FD-100): an agent whose report could not be read makes a priced estimate a lower bound, as it makes
the money one; a $0 estimate with unpriced subscription calls reads "+ at least ~$0.00" instead of nothing; the agent's
Health tab formats a subscription model with Spend's own formatter; the note under the table shows only when a "~"
amount is drawn. A subscription row with no calls and a cost, beside an agent whose estimate is unknown, can make the
sum across agents smaller than the contract's `usageSpend` over all rows (still a lower bound; FD-101).
