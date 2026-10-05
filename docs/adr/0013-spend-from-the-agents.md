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
