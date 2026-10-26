# ADR-0002 — launchd is the only supervisor; the app never spawns a service

Status: accepted · 2026-09-28

## Context

Every live service on this Mac is already supervised by launchd. A second supervisor
is how the machine once ran twenty copies of one server (chrome-devtools-mcp,
2026-09-12). Stopping a KeepAlive job with a signal only makes launchd restart it,
and `bootout` alone is undone at the next login.

## Decision

Fabric Dashboards controls services only through `launchctl` on `gui/<uid>/<label>`:
Start = `enable` + `bootstrap`, Stop = `bootout` + `disable` (off survives login),
Restart = `kickstart -k`. It never starts a service process itself and never keeps a
child process alive. Quitting the app changes nothing about any service.

## Consequences

- A service must be installed as a LaunchAgent to be controllable; a descriptor without
  `lifecycle.manager: launchd` is shown read-only.
- Linux (systemd `--user`) is a later adapter behind the same three verbs.
- Amended 2026-10-26 by [ADR-0025](0025-the-console-channel.md): the app's own MCP server may reach the running app
  through a per-user socket (a named pipe on Windows) with a per-start key, for the console's two buttons only. It is
  not a network port, and the app still starts no service and no copy of itself.
