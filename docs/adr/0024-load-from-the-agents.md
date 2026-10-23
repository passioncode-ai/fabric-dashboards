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
4. **Limits are per context.** The tab compares a context's counts with the limits: "of N" only when the agent works in
   one context, and a context at its limit marks the sum; a table lists every context when there are two or more.
5. **What a person reads first:** running now and waiting, then done and failed over the last day (the windows that
   started within 24 hours of `generatedAt`), then the limits, the latest measured wait and run times (a time under a
   second in ms), a bar per window (the last 24) and the contexts. A report older than two windows says its counts are
   of then. A time never measured reads "not measured" (FD-86: no bare dash).
6. **Agents read the same thing.** MCP `load {service}` answers the tab's entry: `report` with the declaration and the
   summary, `none`, `invalid` with the errors, or `error` with the reason; a service that does not answer has unknown
   load, an error, never `none` (as `spend`, P-3).
7. **The reader is shared.** `@passioncode-ai/fabric-service-host/load` (0.7.0) holds the declaration check, the report
   check (schema, then FAC-SEM-132 as the contract's `loadRule`) and the sums, pure, run on the contract's 15 load
   fixtures; Fabric can take it as it is.

## Consequences

- No agent on this Mac declares its load yet (2026-10-23: 0 of the 15 local services answer a well-known document with the key, read with `curl` over every descriptor in the services folder), so the tab
  appears with the first node that queues (Fabric CO-376, the adapter's kits FAA-103).
- An organization's view of an agent's load is not decided by the contract; the report never leaves this Mac.
- Not decided here: a load column in Overview or a Needs attention row for a full queue; both wait for a real report
  to show what is worth a person's attention.
