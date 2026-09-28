# ADR-0001 — Fabric Dashboards is a separate toolkit product, not a kernel feature

Status: accepted · 2026-09-28

## Context

The operator asked for "Fabric Boards / Fabric Dashboards": one app that watches every
local agent dashboard. In Fabric, "the Board" already names the operator's decision
queue (Fabric ADR-0035), and "custom dashboard" is a banned synonym for Role workspace
(`fabric/docs/brand/terminology.md`). The kernel has no always-on process by design
(Fabric ADR-0037, ADR-0052), and toolkit products ship separately with their own
readiness (Fabric ADR-0070).

## Decision

The product is **Fabric Dashboards** (short form **Dashboards**), a separate
PassionCode.ai toolkit product in `passioncode-ai/fabric-dashboards`. It monitors and
controls local services; it does not assemble a Role workspace and it is not part of
the Fabric kernel.

## Consequences

- No kernel ADR changes. Fabric may later embed the same protocol reader; that is a
  kernel decision, not this one.
- The word "Board" is not used for this product in UI or docs.
