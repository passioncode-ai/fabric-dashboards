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
