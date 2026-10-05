<p align="center"><img src="src/renderer/brand/dashboards-mark.svg" width="96" height="96" alt="Fabric Dashboards mark"></p>

# Fabric Dashboards

Fabric Dashboards is one window for every local agent service on your Mac. It finds each
service that speaks `fabric-service/0.1`, shows whether it is alive and what it did last,
starts, stops and restarts it through launchd, and opens its dashboard inside the app — signed
in, one live view per service — instead of a browser tab per port. It is the monitoring tool of
[Fabric](https://passioncode.ai/), PassionCode.ai's CEO AI agent, and it also works on its own:
agents drive it over MCP, people use the window.

**Version 0.4.1** — [download](https://github.com/passioncode-ai/fabric-dashboards/releases/latest). See [HANDOFF](docs/HANDOFF.md)
for what is released and what is next.

## What it does

| | |
|---|---|
| **Overview** | a status strip (agents ready, not answering, needing attention, spend today and in 30 days), compact *Needs attention* rows, then a card per agent — its instances (main, projection, read-only) inside one card ([ADR-0012](docs/adr/0012-one-entry-per-product.md)), state, version and commit, uptime, the service's own tiles, its latest event — and *Needs attention* first, per instance; services without a dashboard under *Background* |
| **Service view** | Restart · Stop/Start · Update · Doctor · Logs, with the service's dashboard embedded below and a toolbar over it: Back, Forward, Reload, Home, the page's address, Copy address and Copy app link ([ADR-0014](docs/adr/0014-dashboard-toolbar.md)) |
| **Activity** | every service's events and the app's own observations in one feed, filterable, each row opening the exact item |
| **Spend** | what every agent spent today, in 7 and 30 days, on which models and against its own budget — from each agent's own usage report (contract DEC-0021); an unknown cost reads unknown, never $0 |
| **Notifications** | not answering (three missed probes in a row and 60 s of silence — a slow answer under load is not an outage, [ADR-0008](docs/adr/0008-a-missed-probe-is-not-an-outage.md)), back, two copies, another program on the port, and, from the events a service marks for you, only a decision it waits for, a failure or a warning — once per subject, titled with the agent and what it wants ([ADR-0010](docs/adr/0010-notifications-only-when-it-matters.md)); quiet hours and per-service levels |
| **Menu bar** | the aggregate state as a shape, problems first |
| **Links from agents and Fabric** | `fabric-dashboards://service/<id.instance>?path=/…` opens that service, or that page of it, here, signed in — the link Fabric's "Open dashboard" opens |
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

The protocol's specification is
[`docs/specification/service.md`](https://github.com/passioncode-ai/fabric-agent-contract/blob/main/docs/specification/service.md)
in the [Fabric Agent Contract](https://github.com/passioncode-ai/fabric-agent-contract); the
[Fabric Agent Adapter](https://github.com/passioncode-ai/fabric-agent-adapter), whose
`building-fabric-services` skill builds or migrates a service, is the kit. Both are public.

## Quick start for a new teammate

### Install

Download `Fabric-Dashboards-<version>.dmg` from the
[latest release](https://github.com/passioncode-ai/fabric-dashboards/releases/latest), open it and
drag **Fabric Dashboards** to Applications. It is signed with a Developer ID and notarized, so it
opens without a Gatekeeper warning (`spctl -a -vv -t exec "/Applications/Fabric Dashboards.app"`
prints `accepted`, `source=Notarized Developer ID`). macOS 13 or later. Releases after 0.4.1 are
built and signed by GitHub Actions, and each carries `SHA256SUMS`, its GPG signature and a build
attestation ([how to verify](docs/RUNBOOK.md#release)).

Open it from Applications. It lives in the menu bar and opens its window; with no service
installed the overview says *No services yet* and **Show folder** opens the services folder. A
service appears within five seconds of its installer writing a descriptor there. The first
window asks once whether to open it at login (off until you choose; Settings changes it later),
and it updates itself from GitHub releases.

To remove it: **Settings → Uninstall Fabric Dashboards…** removes the login item, its entry in
Claude Code's MCP servers and its data, and moves the app to the Trash; your services and their
data stay. `fabric-dashboards-mcp --unregister` removes only the MCP entry; once the app is
already in the Trash, `claude mcp remove --scope user fabric-dashboards` does the same.

### Configure

No keys. Each service's token is read from that service's own descriptor, in the main process
only ([SECURITY](SECURITY.md)). Optional environment variables: `FABRIC_DASHBOARDS_USER_DATA`
(a separate profile and log folder, for a checkout build or tests) and `FD_SKIP_LAUNCHD`
(tests without a GUI login session).

### MCP

Register the stdio server that ships inside the app, once, for every project (`--scope user`;
without it Claude Code registers it for the current directory only):

```bash
claude mcp add --scope user fabric-dashboards -- "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"
claude mcp get fabric-dashboards        # Status: ✔ Connected
```

One call that proves it works, from a real client:

```bash
claude -p "Call the fabric-dashboards list_services tool once and reply with only the number of services it returned." \
  --allowedTools mcp__fabric-dashboards__list_services --max-turns 3
```

The answer is the number of installed services (`0` until one is installed). Any other MCP
client runs the same file as a stdio server with no arguments; without a client, two JSON-RPC
lines prove the server answers:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_services","arguments":{}}}' \
  | "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"; echo "exit $?"
```

Two JSON lines come back — `serverInfo` with the app's version, then `services` and
`services_dir` — and `exit 0`. The server exits by itself when stdin closes, and after an app
update an old server answers its next call `stale` and exits: restart the agent session to load
the new version (`AGENTS.md` → *Lifecycle*). Release 0.2.0 hands out links as `open?service=…`; later releases
as `service/…` (below). Both open.

### Develop

Node 20 or later, macOS:

```bash
git clone https://github.com/passioncode-ai/fabric-dashboards && cd fabric-dashboards
npm ci
npm start            # run from source
npm run check        # the gate: typecheck, tests, brand pins, code regions, UX lint
npm run test:e2e     # drives the real Electron app against a live sample service
```

The MCP server from a checkout is `node out/main/mcp/server.js` after `npm run build`. A checkout
build does not register the `fabric-dashboards://` scheme; links open only in the installed app.
While the installed app runs, a checkout build shares its profile and only brings the installed
window forward: quit the installed app first, or give the checkout its own profile with
`FABRIC_DASHBOARDS_USER_DATA=/tmp/fd-dev npm start`. More in [CONTRIBUTING](CONTRIBUTING.md).

## For agents

Tools: `host_status`, `list_services`, `service_status`, `link`, `open`, `control`, `doctor`, `update`,
`activity`, `spend`. An agent that starts work on a service hands the operator the `open_link` from
`link` — `fabric-dashboards://service/<id.instance>?path=/…`, which opens that page inside the
app. Keep `http_url` for diagnostics or confirmed-absent fallback. `open` opens it now;
`fallback=never` forbids the browser, and installed-host failure never falls back. [ADR-0004](docs/adr/0004-deep-links-and-mcp.md) and
[ADR-0005](docs/adr/0005-service-links.md) have the rules.

## Design and decisions

See [CONTRIBUTING](CONTRIBUTING.md). Runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md).
Contributions are accepted under the [Contributor License Agreement](CLA.md).

- Design: [docs/design/2026-09-28-fabric-dashboards-design.md](docs/design/2026-09-28-fabric-dashboards-design.md)
- UX: [scenarios](docs/ux/scenarios.md), [screens](docs/ux/screens.md), [foundation](docs/ux/foundation.md)
- Decisions: [docs/adr/](docs/adr/) · glossary: [CONTEXT.md](CONTEXT.md)
- Shared with Fabric: [`packages/service-host`](packages/service-host/README.md) — the code that
  reads `services/` (descriptors, health, state, service links)

## License

Open source under the [GNU AGPL-3.0](LICENSE). A [commercial license](COMMERCIAL-LICENSE.md) is
available for use that does not meet the AGPL's terms — contact@passioncode.ai.
Versions up to and including v0.3.0 were released under PolyForm Noncommercial or Internal Use (v0.2.0–v0.3.0) and the MIT License (v0.1.0 and earlier); those releases keep their licence.

## Dashboard handoff and strict opening

For a registered dashboard, consumers return `link.open_link` as the primary
action; `http_url` remains diagnostic data. `host_status` reads installation,
version and the registered handler without launching anything. `open` accepts
`fallback=if_absent` (default) or `never`: an installed host failure never opens
a browser. Its `accepted_by_os` receipt is not proof of page readiness. See the
[implementation and checks](docs/runs/2026-10-01-dashboard-links/README.md#host-routing).
These additions require Fabric Dashboards 0.3.2 or later.

Version 0.3.3 also clears the MCP-only Electron RunAsNode flag when dispatching a
dashboard link, so a closed host starts as a graphical application.
