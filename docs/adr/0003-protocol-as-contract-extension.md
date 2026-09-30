# ADR-0003 — `fabric-service/0.1` is an extension of the Fabric Agent Contract

Status: accepted · 2026-09-28

## Context

The Fabric Agent Contract 0.1.0 defines providers, capabilities, profiles, admission
and binding, but nothing about a local process, its health or its dashboard. A second
standard beside it would be a second source of truth for the same agents. The contract
allows extensions under absolute-URI keys without a major version
(`docs/specification/overview.md` → *Extension rule*).

## Decision

The protocol lives in `fabric-agent-contract` as `docs/specification/service.md` plus
schemas, keyed `https://fabric.passioncode.ai/agent-contract/extensions/service/0.1` (corrected 2026-09-30, contract gap G-08: the spelling first written here, `passioncode.ai/fabric/extensions/service/0.1`, was never the schema's key). The skills teach
it; Fabric Dashboards consumes it; the contract's fixtures are the shared test vectors
for all three.

## Consequences

- Discovery through a descriptor grants no Project access, as for every provider.
- A breaking change is `fabric-service/0.2`, versioned independently of the base
  contract.
