# ADR-0024: How busy an agent is, from its own load report

Status: accepted, 2026-10-23 (FD-93). Asked of Dashboards by the contract: Fabric Agent Contract DEC-0104 (main
`f6b5044`, `docs/specification/agent-network.md` §Who adopts it) names Fabric Dashboards as the host that "draws the
load panels from `service-load/1`".

## Context

DEC-0104 lets a node queue calls to an agent per agentRef and context, with three limits (`concurrency`, `perCaller`,
`queueMax`) and a `queue-full` refusal past them. A node that queues declares the load extension in its well-known
document (`extensions/load/0.1`: `{path, windowSeconds, limits}`) and serves `service-load/1` at `path` under the
descriptor token: windows of `windowSeconds`, each with a row per context of `queued`, `running`, `completed`, `failed`
and the p50/p95 of wait and run time. Nothing showed a person whether an agent keeps up with its calls.

## Decision

1. **The agent's own report, read like the usage report.** Main process only, with the descriptor token, and only for
   the service's own well-known answer (S-1, as ADR-0013). The renderer gets the sums. The token use is a host read
   (ADR-0144 amendment 4: on the operator's machines the descriptor token is for reading a service as its host).
2. **Nothing of a wrong document is shown.** An invalid declaration is not declared and is reported with every reason
   (FAC-SEM-133); the report is not read. A report that fails its schema or FAC-SEM-132, a refused token, an HTTP error
   or a non-JSON answer is "could not be read" with the reason, never a part of it or a zero.
3. **A Load tab, only where there is load.** The tab is on an agent's page when its well-known document carries the
   load key, valid or not. It reads on opening, on Refresh and every 60 s while open; a hidden window gets the last read
   of that agent and nothing is read (LC-08).
4. **Limits are per agent and context; the counts are never set against them.** DEC-0104 sets the limits per
   (agentRef, context), and a service's report sums every agent it hosts in a context, so a count may exceed a limit
   with nothing wrong. The tab states the limits ("Each agent it hosts runs at most N at once in each context …") and
   shows the counts, with no "of N" and no at-limit mark (amended 2026-10-24 by the FD-93 review; 0.7.26 compared a
   context's counts with the limits). Waiting reads as work to watch, a failure as trouble; a table lists every context
   when there are two or more, and with two or more the wait and run times are only in its rows.
5. **What a person reads first:** running now and waiting, then done and failed over the last day (every window any part
   of which lies in the 24 hours before `generatedAt`, so a daily window counts whole), then the limits, the latest measured wait and run times (a time under a
   second in ms), a bar per window (the last 24) and the contexts. A report older than two windows says its counts are
   of then. A time never measured reads "not measured" (FD-86: no bare dash).
6. **Agents read the same thing.** MCP `load {service}` answers the tab's entry: `report` with the declaration and the
   summary, `none`, `invalid` with the errors, or `error` with the reason; a service that does not answer has unknown
   load, an error, never `none` (as `spend`, P-3).
7. **The reader is shared.** `@passioncode-ai/fabric-service-host/load` (0.7.0) holds the declaration check, the report
   check (schema, then FAC-SEM-132 as the contract's `loadRule`) and the sums, pure, run on the contract's 15 load
   fixtures; Fabric can take it as it is.

## Amendment of 2026-10-24: the review (FD-100)

Three blind readings of 0.7.26 found: limits compared per context though the contract sets them per agent and context
(decision 4 above); the tab left an empty pane when the declaration went while it was open (a tab that leaves the list
now falls back to Dashboard or Health); the schema read stricter than the contract's (a space for `T`, an offset
without its colon, a leap second, an integer above 2^53 are admitted as the contract's validator admits them, and
FAC-SEM-132 still compares times strictly); a daily window was dropped from "the last 24 h". Also decided: an invalid
load declaration is a finding of the auditor (Connections page, MCP `audit`), like an invalid connections declaration;
the Connections tab's "offers" stay the protocol's surfaces, and the load report is not listed there (it is an
extension, shown on its own tab). The first read of an agent while the window is hidden stays allowed, as Spend's
(AGENTS.md cadence table). Shared package 0.8.1. Tests: `packages/service-host/test/load.test.ts` *FD-93 review*,
`test/audit.test.ts` *FD-93 review*, `test/e2e/load.test.ts` (the fallback step seen failing without its fix).

## Consequences

- No agent on this Mac declares its load yet (2026-10-23: 0 of the 15 local services answer a well-known document with the key, read with `curl` over every descriptor in the services folder), so the tab
  appears with the first node that queues (Fabric CO-376, the adapter's kits FAA-103).
- An organization's view of an agent's load is not decided by the contract; the report never leaves this Mac.
- Not decided here: a load column in Overview or a Needs attention row for a full queue; both wait for a real report
  to show what is worth a person's attention.
