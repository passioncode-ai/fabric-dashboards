<p align="center"><img src="src/renderer/brand/dashboards-mark.svg" width="96" height="96" alt="Fabric Dashboards mark"></p>

# Fabric Dashboards

> **PassionCode.ai — The agent-agnostic operating system for AI-native teams.**

One window for every local agent service on your Mac. Fabric Dashboards finds each
service that speaks `fabric-service/0.1`, shows whether it is alive and what it did
last, starts, stops and restarts it through launchd, and opens its dashboard inside the
app — signed in, one live view per service — instead of a browser tab per port.

**Status (2026-09-28): 0.1.0, built and tested on this Mac.** See [HANDOFF](docs/HANDOFF.md)
for what is released and what is next.

## What it does

| | |
|---|---|
| **Overview** | a card per service — state, version and commit, uptime, the service's own tiles, its latest event — and *Needs attention* first |
| **Service view** | Restart · Stop/Start · Update · Doctor · Logs, with the service's dashboard embedded below |
| **Activity** | every service's events and the app's own observations in one feed, filterable, each row opening the exact item |
| **Notifications** | not answering (after 30 s), back, two copies, another program on the port, events a service marks for you — with quiet hours and per-service levels |
| **Menu bar** | the aggregate state as a shape, problems first |

States it tells apart: Ready, Degraded, Not answering, Off, Starting/Stopping, Two copies
(the answering pid is not launchd's), Wrong program on port (another id answers),
Port conflict (two descriptors claim one port), Invalid descriptor.

It never starts a service process itself — launchd is the only supervisor
([ADR-0002](docs/adr/0002-launchd-is-the-only-supervisor.md)) — and quitting it stops nothing.

## How a service joins

Build or migrate it with the `building-fabric-services` skill of
[fabric-agent-adapter](https://github.com/passioncode-ai/fabric-agent-adapter). Its
installer writes a descriptor into
`~/Library/Application Support/ai.passioncode.fabric/services/`; the app picks it up
within five seconds. The protocol is the `fabric-service/0.1` extension of the
[Fabric Agent Contract](https://github.com/passioncode-ai/fabric-agent-contract)
(`docs/specification/service.md`, DEC-0015).

## Install

Download the DMG from the [releases](https://github.com/passioncode-ai/fabric-dashboards/releases),
drag the app to Applications. It opens at login by default and updates itself.

## Develop

See [CONTRIBUTING](CONTRIBUTING.md). Runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md).

- Design: [docs/design/2026-09-28-fabric-dashboards-design.md](docs/design/2026-09-28-fabric-dashboards-design.md)
- UX: [scenarios](docs/ux/scenarios.md), [screens](docs/ux/screens.md), [foundation](docs/ux/foundation.md)
- Decisions: [docs/adr/](docs/adr/) · glossary: [CONTEXT.md](CONTEXT.md)
