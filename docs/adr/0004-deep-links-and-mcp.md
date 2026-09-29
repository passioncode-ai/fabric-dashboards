# ADR-0004 — Deep links and an MCP server: agents hand the operator the page and use the app's rules

Status: accepted · 2026-09-29

## Context

An agent that starts work on a local service (a generation job, a publish run) can only
hand the operator a plain `http://127.0.0.1:<port>/…` address. It opens in the default
browser, outside the app, without the operator login (SCN-014), and next to the app's own
live view of the same service. Agents that want to check, restart or update a service run
`launchctl` or the service's CLI by hand, which is how a second supervisor appears
(ADR-0002).

## Decision

1. **A URL scheme, `fabric-dashboards://`,** registered by the packaged app
   (`CFBundleURLTypes`, from `scripts/dist-mac.mjs`, and `setAsDefaultProtocolClient`):
   - `open?service=<id.instance>[&path=/…]` — the service view, its dashboard at the path;
   - `open?url=http://127.0.0.1:<port>/…` — the same, the service found by its origin's port;
   - `activity`, and the bare scheme for the overview.

   Parsing is pure (`src/core/deeplink.ts`) and checked against the descriptors the app
   already trusts: a link can name only an installed service, and only a path on that
   service's own origin (`/…`, never `//host`, a full URL, a backslash or a control
   character). A refused link says why and opens nothing (SCN-027). A link that arrives
   with the launch waits for the first scan instead of being refused as unknown.

2. **An MCP server, `fabric-dashboards-mcp`,** over stdio, shipped inside the app at
   `Contents/Resources/bin/fabric-dashboards-mcp`. It runs the app's own binary with
   `ELECTRON_RUN_AS_NODE=1` (the RunAsNode fuse), so nothing beyond the app is installed,
   and reads `app.asar` directly. Tools: `list_services`, `service_status`, `link`, `open`,
   `control` (start/stop/restart), `doctor`, `update`, `activity`. It reuses `src/core`:
   the same descriptor reading, state derivation, launchd verbs and descriptor argv as the
   app. It does not need the app to be running.

## Consequences

- The app still listens on no port; the MCP server is spawned by an agent and speaks only
  on its stdin/stdout.
- A token is read by the MCP process (for `activity`) exactly as by the app's main
  process, and is never returned in a tool result, a link or a log.
- `control` waits for the answer it expects (a new pid after a restart, silence after a
  stop) for 40 s and reports a timeout as not done, the same bar as ST-003.
- `open` without the app installed opens the plain address in the default browser and
  says so; off macOS it opens nothing and returns the links.
- A service that wants its links to open here can hand out `open?service=…&path=…` itself;
  the scheme needs no change to `fabric-service/0.1`.
- `status` of a service is one look, not a watch: an unanswered service is `down`, never
  «starting» (the app's grace window needs a history the MCP process does not have).
