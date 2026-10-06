# @passioncode-ai/fabric-service-host

The reading half of hosting local agent services that speak `fabric-service/0.1`: find their
descriptors in `services/`, find claim conflicts, read launchd, probe health, derive the one
state each service is in, and build the `fabric-dashboards://service/<id>.<instance>` link that
opens one in Fabric Dashboards. Fabric Dashboards and its MCP server run on it. It was built for
Fabric's agent registry to share (Fabric plan row AR-2.2), but Fabric does not import it today: its
registry reads `services/` with its own reader and probes nothing ([ADR-0006](../../docs/adr/0006-shared-service-host-package.md),
amended 2026-10-06).

It never starts, stops or changes a service and never opens a network port. It reads a token
only to probe a remote placement's health (DEC-0019, `readToken`), and withholds it from an origin
that is not the service ([Remote token latch](#remote-token-latch)). Controlling a service (launchd verbs), reading its events feed and signing in to its
dashboard stay in Fabric Dashboards ([ADR-0002](../../docs/adr/0002-launchd-is-the-only-supervisor.md),
[ADR-0006](../../docs/adr/0006-shared-service-host-package.md)).

Private to this repository's workspace and not published to npm; see
[Consuming it from Fabric](#consuming-it-from-fabric). License: the repository's
`AGPL-3.0-only OR LicenseRef-PassionCode-Commercial` ([LICENSE](../../LICENSE),
[commercial](../../COMMERCIAL-LICENSE.md)).

## Entry points

| Import | What | Node built-ins |
|---|---|---|
| `@passioncode-ai/fabric-service-host` | everything below | yes (`fs`, `http`, `child_process`) |
| `…/protocol` | the shapes and constants only | none — safe in a renderer |
| `…/state` | `deriveState`, `attentionRank`, `DOWN_AFTER_MS` | none — safe in a renderer |
| `…/links` | the link builder and the key syntax | none — safe in a renderer |
| `…/usage` | `checkUsage`, `summarizeUsage` and the usage-report shapes | none — safe in a renderer |
| `…/test-vectors/state-precedence.json` | the shared state-precedence vectors | — |

CommonJS with `.d.ts` types, built by `tsc` into `dist/` (`npm run build:host` from the
repository root). Node 20 or later.

## Protocol

`src/protocol.ts`. `PROTOCOL` (`'fabric-service/0.1'`); `Descriptor`, `WellKnown`,
`WellKnownResult` (`answer` | `not-protocol` | `no-answer`), `ServiceEvent`, `ServiceState` and
`SERVICE_STATES` (`invalid`, `stopped`, `conflict`, `foreign`, `duplicate`, `down`, `starting`,
`stopping`, `degraded`, `ready`), `Reason` and `REASON_CODES` — every code `deriveState` can
return, so a host's message catalogue can be checked against it — `Busy`, `LaunchdStatus`,
`ClaimConflict`, `ID_PATTERN`, `INSTANCE_PATTERN`. `WellKnown.surfaces` carries `mcp.capabilities` and `usage` (DEC-0021). The Fabric Agent Contract's
`schemas/service-*.schema.json` stay normative; these shapes follow them.

## Discovery

`src/descriptor.ts`.

- `servicesDir(env?, platform?, home?)` — `FABRIC_SERVICES_DIR` (a leading `~/` expanded), else
  `~/Library/Application Support/ai.passioncode.fabric/services` on macOS, else
  `$XDG_DATA_HOME/passioncode-fabric/services`.
- `readDirectory(dir)` → `DescriptorEntry[]` (`path`, `key` = `id.instance` or the file stem,
  `descriptor` or `null`, `problems`). A half-written, unreadable or misnamed file is an entry
  with its problem; an absent directory is `[]`; a directory that cannot be read at all throws.
- `validateDescriptor(raw)` → every problem as one sentence (FAC-SEM-012, FAC-SEM-024 and the schema),
  placement-aware: a `remote` descriptor (DEC-0019) needs an `https://<dns-name>` origin, `lifecycle.manager:
  "none"`, no launchd fields and no `update`; `paths` is optional for it.
- `placementOf(d)`, `remoteOriginProblem(origin)`.
- `claimConflicts(entries)` → `Map<key, ClaimConflict>` — two local descriptors on one port, or one
  `id.instance` claimed twice (FAC-SEM-010); a remote origin claims no port.
- `portOf(origin)`, `expand(path)`.

## Health

`src/health.ts`. `fetchWellKnown(origin, timeoutMs = 2000, options?)` → `WellKnownResult`; it never
throws: silence (refused, timed out) is `no-answer`, any other answer that is not a valid well-known
document is `not-protocol` with the reason (`checkWellKnown`). The kinds are `answer`,
`no-answer`, `not-protocol` and, for a remote origin only, `refused`. `request()` caps an answer at 2 MB,
follows no redirect, and ends at `timeoutMs` for the whole request — answer included — so a service that
trickles bytes cannot hold a host's monitor (0.3.2; before, only the socket's idle time was bounded).

A **remote origin** (DEC-0019) goes over https with the certificate verified against the system
store; pass the token header in `options.headers` (`authHeaders(d, readToken(d.auth.tokenFile))`) and
`REMOTE_TIMEOUT_MS`. A `401` is `refused`; a redirect, a TLS failure, a timeout, a network error or an
HTTP 5xx (cause `http`: a deploy or an outage, not another program) is `no-answer` with its `cause`. `TlsOptions` (`ca`, `connect`) exist for tests only. A local result keeps
its 0.1.0 shape. `readToken(tokenFile)` refuses a symlink, another owner and any mode wider than
0600 — main process only.

## Remote token latch

`src/latch.ts`. `new RemoteTokenLatch()`, then `latch.probe(d, send)` for every health probe of a
remote placement, where `send(true)` probes with the token and `send(false)` without it; a local
placement is probed as is. `latch.withheld(d)` says why the token is withheld now (`foreign`,
`not-protocol`) or `null`.

- An origin that answers as **another service** keeps that answer as its verdict until the
  descriptor changes; nothing is requested again (`reason.remote.foreign`).
- An origin that answers **without the protocol** (a 404, an HTML page: a parked domain or a
  taken-over subdomain) is probed again without the token. When it answers 401 (it asks for a token
  again) or as this service, the latch opens and the same probe repeats with the token; anything
  else keeps it withheld (`reason.remote.protocol`).
- A changed descriptor is a new claim and starts clear.

Only the first answer that reveals the origin is not the service ever carried the token. Keep one
latch for as long as the reader lives: the app's monitor holds one, the MCP server one per process,
and `lookAtServices` takes one as `latch` (third review pass T-2, T-4).

## Launchd

`src/launchd.ts`. `LaunchdReader(run?, uid?)` with `disabledTable()` (one `launchctl
print-disabled` per look) and `status(label, table?)` → `{ loaded, pid, disabled }`; a
`launchctl` that fails reads as not loaded. `parsePrint`, `parseDisabled`, `execRunner` (no
shell), `UNMANAGED`. Reading only: the verbs that change a job are Fabric Dashboards' own.

## State precedence

A remote placement (DEC-0019) has no launchd and no `duplicate`: `refused`, TLS and a redirect are
`down` at once with `reason.remote.*`; silence waits `REMOTE_DOWN_AFTER_MS` (60 s).

`src/state.ts`. `deriveState(input)` → `{ state, reasons }`. The order, first match wins:

1. `invalid` — no usable descriptor (`reason.invalid`, its first problem);
2. `conflict` — a claim conflict (`reason.conflict.port` / `reason.conflict.key`);
3. the host's own action: `stopping`, or `starting` while starting or restarting;
4. an answer from another `id.instance` → `foreign` (`reason.foreign.other`); an answering pid
   that is not launchd's → `duplicate` (`reason.duplicate`); otherwise the service's own status:
   `starting` / `stopping`, `degraded` (one `reason.degraded` per source), `ready`;
5. something that is not a fabric service answers → `foreign` (`reason.foreign.protocol`);
6. silence and launchd disabled or not loaded → `stopped` (`reason.stopped` / `reason.not-loaded`);
7. silence shorter than `DOWN_AFTER_MS` (15 s) → `starting` (`reason.waiting`), else `down`
   (`reason.down`, since when).

`attentionRank(state, wellKnown)` sorts what needs a person first (`down` first; `null` for
nothing to show).

## One look

`src/look.ts`. `lookAtServices({ servicesDir?, wellKnown?, launchd?, now?, only?, token?, latch? })` →
`{ servicesDir, error, services: ServiceLook[] }` — read the descriptors, find conflicts, read
launchd once, probe each usable service once, derive each state. A reader with no history (a
registry scan, an MCP call) has no earlier answer to measure silence from, so a service that
does not answer now is `down`, never «starting». An invalid or conflicting descriptor is never
probed; a probe that throws counts as silence; an unreadable directory is `error`, not a throw.
`only` limits the look to some keys while conflicts are still found across every descriptor.

## Links

`src/links.ts`. `serviceLink(key, path?)` → `fabric-dashboards://service/<id>.<instance>`, and
`?path=…` for one page; it throws `TypeError` for a key that is not `id.instance` or a path that
is not on the service's own origin — exactly what the app would refuse
([ADR-0005](../../docs/adr/0005-service-links.md)). `isServiceKey`, `safePath`, `SCHEME`,
`APP_NAME` (`Fabric Dashboards`), `DOWNLOAD_URL` (the latest release, for a "not installed"
note).

## Usage

`src/usage.ts`, Fabric Agent Contract DEC-0021. A service that declares `surfaces.usage.path`
answers there, behind its token, with a report of its own spend: up to 31 UTC days of calls,
tokens and USD cost per provider and model, and an optional day or month budget.
`checkUsage(value, {id, instance})` returns the first problem a host relies on, or null. It
checks identity, currency, dates running forward, counts, an all-unpriced row that claims a
price, and the budget shape. `summarizeUsage(report, now)` returns `today`, `week` (7 days),
`month` (30 days) and `models`, ranked by cost. **An unknown cost stays unknown**: a window
with calls and no priced call has `costUsd: null`, a window with some unpriced calls is
`partial` (a lower bound), and only a window with no calls is `0`. The token-gated read itself
stays in the host (`fetchUsage` in the app's `src/core/probe.ts`), like the events feed.

## Shared test vectors

`test-vectors/state-precedence.json` (`fabric-service-host/state-precedence@1`): a `base` input
and its cases, each a shallow override of `base` with the expected state and, where it matters,
the exact reasons. `loadStateVectors()` reads it from the installed package. The package runs
them (`test/state.test.ts`), Fabric Dashboards runs them through its own import
(`test/core.test.ts`), and a consumer runs the same file against its own use of `deriveState`:

```ts
import { deriveState, loadStateVectors, type StateInput } from '@passioncode-ai/fabric-service-host';

for (const c of loadStateVectors().cases) {
  const out = deriveState({ ...loadStateVectors().base, ...c.input } as StateInput);
  // expect out.state === c.expect.state, and out.reasons === c.expect.reasons when given
}
```

## Inside the app

Fabric Dashboards ships no registry dependency; this package is its one runtime package.
`scripts/dist-mac.mjs#stageWorkspacePackages` copies its `package.json`, `dist/` and
`test-vectors/` into the staged app's `node_modules`, so `require` inside `app.asar` — the app
and its bundled MCP server — finds it the way a checkout does.

## Consuming it from Fabric

Not in use as of 2026-10-06 (Fabric reads `services/` itself; see the top of this file). When Fabric
adopts it: pin a commit of this repository and take the package from its folder. With pnpm (Fabric uses
pnpm 11), in the consuming package's `package.json`:

```json
"@passioncode-ai/fabric-service-host": "github:passioncode-ai/fabric-dashboards#<full commit sha>&path:/packages/service-host"
```

pnpm fetches that folder at the pinned commit and runs its `prepare` script, which builds
`dist/` with the package's own `typescript` dev dependency. pnpm 11 runs it only when the
workspace allows that exact fetch — the package name alone is refused with
`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` — so `pnpm-workspace.yaml` names the resolved tarball:

```yaml
allowBuilds:
  "@passioncode-ai/fabric-service-host@https://codeload.github.com/passioncode-ai/fabric-dashboards/tar.gz/<full commit sha>#path:/packages/service-host": true
```

Checked with pnpm 11.21.0 on a scratch consumer: `pnpm install` exit 0, `dist/` built, every
state vector passing through `require`, and the four entry points typechecking under both
`moduleResolution: bundler` and `nodenext`. Moving the pin is a reviewed change in Fabric, like
any dependency bump, and moves the `allowBuilds` key with it; the state vectors travel with the
pin, so Fabric's run of them tests the exact code it ships.

## Develop

```bash
npm run build:host                                   # tsc → packages/service-host/dist
npm test                                             # the app's tests and this package's
node --import tsx --test packages/service-host/test/*.test.ts
```
