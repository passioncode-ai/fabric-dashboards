<p align="center"><img src="src/renderer/brand/dashboards-mark.svg" width="96" height="96" alt="Fabric Dashboards mark"></p>

# Fabric Dashboards

> **PassionCode.ai — The agent-agnostic operating system for AI-native teams.**

One window for every local agent service on your Mac. Fabric Dashboards finds each
service that speaks `fabric-service/0.1`, shows whether it is alive and what it did
last, starts, stops and restarts it through launchd, and opens its dashboard inside the
app — signed in, one live view per service — instead of a browser tab per port. It is
Fabric's monitoring tool and works on its own.

**Status (2026-09-29): 0.2.0 released** — [download](https://github.com/passioncode-ai/fabric-dashboards/releases/latest). See [HANDOFF](docs/HANDOFF.md)
for what is released and what is next.

## What it does

| | |
|---|---|
| **Overview** | a card per service — state, version and commit, uptime, the service's own tiles, its latest event — and *Needs attention* first |
| **Service view** | Restart · Stop/Start · Update · Doctor · Logs, with the service's dashboard embedded below |
| **Activity** | every service's events and the app's own observations in one feed, filterable, each row opening the exact item |
| **Notifications** | not answering (after 30 s), back, two copies, another program on the port, events a service marks for you — with quiet hours and per-service levels |
| **Menu bar** | the aggregate state as a shape, problems first |
| **Links from agents** | `fabric-dashboards://open?service=<id.instance>&path=/…` opens that page here, signed in |
| **MCP for agents** | list services, hand out links, open a page, restart or update — through the app's own rules |

States it tells apart: Ready, Degraded, Not answering, Off, Starting/Stopping, Two copies
(the answering pid is not launchd's), Wrong program on port (another id answers),
Port conflict (two descriptors claim one port), Invalid descriptor.

It never starts a service process itself — launchd is the only supervisor
([ADR-0002](docs/adr/0002-launchd-is-the-only-supervisor.md)) — and quitting it stops nothing.

## How a service joins

A service writes a descriptor into
`~/Library/Application Support/ai.passioncode.fabric/services/`; the app picks it up
within five seconds. The protocol is `fabric-service/0.1`, an extension of the Fabric
Agent Contract. Its public description is section 2 of the
[design](docs/design/2026-09-28-fabric-dashboards-design.md#2-fabric-service01--the-protocol),
and the contract's fixtures are copied under [`test/fixtures/contract/`](test/fixtures/contract/).
[Project Observatory](https://github.com/passioncode-ai/project-observatory-dashboard)
has spoken it since 0.8.0 and is a public example
([its design note](https://github.com/passioncode-ai/project-observatory-dashboard/blob/main/docs/design/FABRIC-SERVICE.md)).

The [Fabric Agent Adapter](https://github.com/passioncode-ai/fabric-agent-adapter), whose
`building-fabric-services` skill builds or migrates a service, is public; the Fabric Agent
Contract is a private repository for now.

## Install

Download the DMG from the [releases](https://github.com/passioncode-ai/fabric-dashboards/releases),
drag the app to Applications. It opens at login by default and updates itself.

## For agents

Register the MCP server that ships inside the app once:

```bash
claude mcp add fabric-dashboards -- "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"
```

Tools: `list_services`, `service_status`, `link`, `open`, `control`, `doctor`, `update`,
`activity`. An agent that starts work on a service hands the operator the `open_link` from
`link` — it opens that page inside the app — and the plain `http_url` as a fallback.
[ADR-0004](docs/adr/0004-deep-links-and-mcp.md) has the rules.

## Develop

See [CONTRIBUTING](CONTRIBUTING.md). Runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md).
Contributions are accepted under the [Contributor License Agreement](CLA.md).

- Design: [docs/design/2026-09-28-fabric-dashboards-design.md](docs/design/2026-09-28-fabric-dashboards-design.md)
- UX: [scenarios](docs/ux/scenarios.md), [screens](docs/ux/screens.md), [foundation](docs/ux/foundation.md)
- Decisions: [docs/adr/](docs/adr/) · glossary: [CONTEXT.md](CONTEXT.md)

## License

Source-available under PolyForm Noncommercial or Internal Use; commercial license on request
(contact@passioncode.ai). SPDX: `PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0`.
Release v0.1.0 and earlier commits were released under the MIT License and remain available
under MIT. Full terms: [LICENSE](LICENSE).
