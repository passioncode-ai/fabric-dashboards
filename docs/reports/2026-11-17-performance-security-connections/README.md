---
report: fabric-dashboards-2026-11-17-performance-security-connections
project: fabric-dashboards
date: 2026-11-17
asked: the operator, 2026-11-17: «потом отрефакторим это все, проведем исследование производительности, безопасности, коннектов и так далее»
base: origin/main 0d027077 (0.8.183) and the installed 0.8.178
---

# Performance, security and connections, 2026-11-17

Three read-only audits run after refactor waves 1 to 5 (`docs/plans/2026-11-17-refactor-waves/`). Each finding carries
file:line or measured evidence in the audit's own run; the fixed ones point at their test. Measured on this Mac with 61
descriptors (28 under launchd) at load average 83 to 129 and, at times, under 1 GB of free disk.

## Connections (C2)

Every outside call has a deadline (`execRunner`, 30 s by default; HTTP 5 s and 2 s). Under load the Switchboard reads
ran to their deadline (50 hand-over and 84 limit-stop timeouts in a day) while each answers in 0.1 to 0.5 s idle.

| Id | Sev. | Finding | State |
|---|---|---|---|
| C2-01 | high | a `capacity` read that timed out read as "no machine session limit" | fixed 0.8.186: the last answer of the last 10 minutes stands, deadline 15 s (FD-311) |
| C2-02 | high | a `--help` probe that timed out was cached as "feature absent" until Switchboard updated | fixed 0.8.186: `noAnswer`, `settled`; no timed-out answer is kept (FD-311, `test/switchboard-answers.test.ts`) |
| C2-03 | medium | `handovers` read with 10 s, flapping under load | fixed 0.8.186: 20 s (FD-311) |
| C2-04 | medium | a Switchboard health read that timed out opens a `blind` episode to the operator | FD-314 |
| C2-05 | medium | an `attention`, `org list` or `agents list` failure is silent or drops known data | FD-315 |
| C2-06 | low | a timed-out read kills the direct child only, so ssh under `sessions --target` may stay | FD-314 |
| C2-07 | low | fallbacks for Switchboard before 0.7.111 still run; no version floor | FD-319 |
| C2-08 | low | the update download and `outage-alerts.json` failed with ENOSPC | FD-320 |
| C2-09 | resolved | the operator channel's refusals stopped after 0.8.159 | none |

## Performance (P2)

Main process 3.55 % CPU over 60 s with the window covered, 242 MB resident (peak footprint 456 MB, above the 400 MB
target); 27 MCP servers at 52 to 58 MB each.

| Id | Sev. | Finding | State |
|---|---|---|---|
| P2-01 | high | a window macOS reports covered kept the on-screen cadence: the monitor read Chromium's page visibility alone | fixed 0.8.186: the window list, read once a minute while shown, wins when it says covered (FD-312, `test/lifecycle.test.ts` *FD-276*) |
| P2-02 | medium | each recovery pass parses about 1 MB of Switchboard JSON (`recovery`, `sessions --history`) | FD-316 |
| P2-03 | low | no backoff after a Switchboard timeout | FD-314 |
| P2-04 | low | quadratic work building the service list (conflict and row maps per service) | FD-317 |
| P2-05 | low | `outage-alerts.json` rewritten synchronously 13 times in 150 s | FD-317 |
| P2-06 | low | `actedStops` only grew | fixed 0.8.186: pruned a day after Switchboard drops the stop (FD-312, `test/recovery.test.ts` *P2-06*) |
| P2-07 | low-med | every status push re-renders all of Overview | FD-317 |
| P2-08 | low | the health poller reads agents one after another, each with its own owner check | FD-317 |

## Security (S2)

No critical or high finding. The refactor moves were compared with the old code: `channel-answers.ts` and
`uninstall-flow.ts` match it apart from their explicit dependencies; `schema.ts` holds the tool table only.

| Id | Sev. | Finding | State |
|---|---|---|---|
| S2-01 | low | Uninstall in a second profile (`FABRIC_DASHBOARDS_USER_DATA`) removed the default profile's data too | fixed 0.8.186: a second profile removes only its own folders (FD-313); the macOS `isProductPath` breadth is FD-318 |
| S2-02 | low | a held conversation does not follow a console of an agent placed on another machine | FD-318 |
| S2-03 | low | deep links sign in and open a service's deeper path with nobody confirming; refusal dialogs are not rate-limited | FD-318 |
| S2-04 | low | the console channel's `session.new` skipped the second field check ADR-0025 promises | fixed 0.8.186: `newSessionChoiceOf` before `startNew` (FD-313) |
| S2-05 | low | MCP checked type, range and enum, not the advertised length, boolean and list limits | fixed 0.8.186: `wrongArgument` (FD-313, `test/mcp.test.ts` *T-9*) |
| S2-06 | info | a wrong console-channel key is logged on every try | FD-318 |
| S2-07 | info | a remote folder goes to Switchboard as argv with only a leading `/` checked | FD-318 |

Found sound: tokens stay in the main process and every token request checks the port's and the connection's owner;
the console channel (0600 socket in a 0700 folder, constant-time key, size and rate limits, strict `parseRequest`);
every IPC handler behind `guardIpc`; sandboxed, context-isolated views with navigation held to their origin; deep links
strict; no shell built from service text.
