# ADR-0006 — The service-host reading code is a package Fabric shares

Status: accepted · 2026-09-30

## Context

Fabric's agent registry (Fabric plan row AR-2.2, its design §3) lists the operator's agents that
run as services. It must read `services/` descriptors, probe `/.well-known/fabric-service` and
show health "in the fabric-dashboards precedence, shared rather than copied". That reading code
lived in this app's `src/core/` (descriptor, state, the well-known half of probe, launchd
status), mixed with what only this app does: launchd verbs, the events feed with a token, the
dashboard login. A copy in Fabric would drift the first time either side changed the order of
two states.

## Decision

1. **`packages/service-host` is an npm workspace of this repository,
   `@passioncode-ai/fabric-service-host`**, and holds the reading half: the protocol shapes,
   descriptor discovery and claim conflicts, the health probe, launchd *status*, the state
   precedence, one look at every service (`lookAtServices`), and the service link builder
   (ADR-0005). The app imports it; `src/core/descriptor.ts` and `src/core/state.ts` moved into
   it with their history.
2. **What changes or authenticates stays in the app**: the launchd verbs (`Launchd extends
   LaunchdReader`, ADR-0002), the token, the events feed, the login code, the monitor's history.
   The package never starts or stops anything, reads no token and opens no port. (Amended
   2026-10-06: it reads an online service's token for that service's health probe — see the
   amendment below.)
3. **The state precedence has shared test vectors** (`test-vectors/state-precedence.json`). The
   package, this app and Fabric each run the same file against their own use of `deriveState`.
4. **Not published to npm.** Fabric pins a commit and takes the package from its folder
   (a pnpm git dependency with `path:`); the package's `prepare` builds `dist/`. The repository's
   license applies.
5. **The app still ships no registry dependency.** `scripts/dist-mac.mjs` stages the package's
   `dist/`, `test-vectors/` and manifest into the app's `node_modules`.

## Consequences

- One order of states for both apps; a change to it is one change here, tested by vectors Fabric
  also runs, and reaches Fabric when Fabric moves its pin.
- `npm test`, `npm run typecheck` and `npm run build` build the package first
  (`npm run build:host`); a checkout needs `npm ci` at the root, which links the workspace.
- The MCP server reads through `lookAtServices`, so it and Fabric's registry see a service the
  same way; `service_status` looks at one service (`only`) while still finding conflicts.
- Fabric's registry names six health values (`ready | degraded | stopped | down | foreign |
  unreadable`); the package derives ten states. The mapping (where `starting`, `stopping`,
  `duplicate`, `conflict` go) is Fabric's to decide; the package does not guess it.

## Amendment — 2026-10-06

- **Tokens.** Since ADR-0011 (online services, DEC-0019) the package does read a token, for one
  purpose: the health probe of an online service, whose well-known document is behind the
  token. `readToken` (0600, owner, no symlink) and `authHeaders` live in `src/health.ts`, and
  `lookAtServices` reads an online service's token for its probe unless the caller passes its
  own `token`. It still starts and stops nothing, opens no port, and never hands a token to a
  page; reading a local service's events feed or usage report stays in the app.
- **State vectors.** Three cases were added on 2026-10-06 (release audit P-1): a remote HTTP 5xx
  is silence with cause `http` — waiting, then down with `reason.remote.http` — and a remote answer
  without the protocol is `foreign` with `reason.remote.protocol`, naming the origin rather than a
  port. Fabric runs the same file.
- **Remote token latch** (amended 2026-10-06, third review pass T-2/T-4; package 0.3.1).
  `RemoteTokenLatch` (`src/latch.ts`) withholds an online service's token from an origin that
  answered as another service (kept until the descriptor changes) or without the protocol (checked
  again without the token until it answers 401 or as this service). The app's monitor holds one,
  the MCP server one per process, and `lookAtServices` accepts one as `latch`. Fabric should hold
  one per registry for the same reason; it changes no state and no vector.
