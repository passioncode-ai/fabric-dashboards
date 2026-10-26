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
| `…/connections` | `connectionsOf` and the declared-connections shapes (FD-78) | none, safe in a renderer |
| `…/load` | `loadOf`, `loadReportProblems`, `summarizeLoad` and the load shapes (FD-93) | none, safe in a renderer |
| `…/actions` | `actionsOf`, `actionDeclarationErrors` and the declared-action shapes (FD-110) | none, safe in a renderer |
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

## Embedded dashboard profile

`src/protocol.ts` (0.5.0, FD-41). Fabric Agent Contract DEC-0036, profile `fabric-dashboard/0.1`
([PR passioncode-ai/fabric-agent-contract#27](https://github.com/passioncode-ai/fabric-agent-contract/pull/27),
`docs/specification/embedded-dashboard.md`), ED-9: a service declares its dashboard's floor in the
well-known document under `extensions[DASHBOARD_EXTENSION].minWidth`, an integer 360…1280
(`DASHBOARD_MIN_WIDTH`). `dashboardMinWidth(doc)` returns that number, or `null` for a legacy
dashboard: no `extensions`, no key, or a `minWidth` that is not an integer in range. `WellKnown.extensions`
carries every extension as the service sent it. A host turns the declaration into its floor with
`max(480, minWidth)` (ED-7; Fabric Dashboards: `src/core/layout.ts`).

## Discovery

`src/descriptor.ts`.

- `servicesDir(env?, platform?, home?)` — `FABRIC_SERVICES_DIR` (a leading `~/`, on Windows also `~\`,
  expanded), else `~/Library/Application Support/ai.passioncode.fabric/services` on macOS,
  `%LOCALAPPDATA%\passioncode-fabric\services` on Windows (0.4.0, FD-37 — proposed to the contract with
  Fabric's port), else `$XDG_DATA_HOME/passioncode-fabric/services`.
- `readDirectory(dir)` → `DescriptorEntry[]` (`path`, `key` = `id.instance` or the file stem,
  `descriptor` or `null`, `problems`). A half-written, unreadable or misnamed file is an entry
  with its problem; an absent directory is `[]`; a directory that cannot be read at all throws.
- `validateDescriptor(raw, platform?)` → every problem as one sentence (FAC-SEM-012, FAC-SEM-024 and the schema),
  placement-aware: a `remote` descriptor (DEC-0019) needs an `https://<dns-name>` origin, `lifecycle.manager:
  "none"`, no launchd fields and no `update`; `paths` is optional for it.
- `placementOf(d)`, `remoteOriginProblem(origin)`.
- `claimConflicts(entries)` → `Map<key, ClaimConflict>` — two local descriptors on one port, or one
  `id.instance` claimed twice (FAC-SEM-010); a remote origin claims no port.
- `portOf(origin)`, `expand(path, home?, platform?)` (`~/`, and `~\` on Windows), `isLocalPath(p, platform?)` —
  the path grammar of the OS the descriptor was written on: `/` or `~/` on macOS and Linux; on Windows a
  drive-absolute path (`C:\` or `C:/`) or `~\`/`~/`, never a network share (0.4.0).

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
its 0.1.0 shape. `readToken(tokenFile)` refuses what `tokenFileProblem(file, info, { platform, uid, home })`
names — main process only: on macOS and Linux a symlink, another owner and any mode wider than 0600; on
Windows (0.4.0), which reports no POSIX owner or mode, a link and a file whose real path lies outside the
user's profile, since the profile's ACL is what keeps it private.

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


`src/systemd.ts` (FD-55, contract DEC-0057): `SystemdReader.status(unit)` reads `systemctl --user show`
(`LoadState`, `ActiveState`, `MainPID`, `UnitFileState`) into the same `JobStatus`, so a copy waiting on the
lock reads `duplicate` under systemd as it does under launchd. The Task Scheduler has no supervisor pid: a
waiting copy there is not shown and is never an outage. Read only — systemd is controlled by the node.
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

`src/look.ts`. `lookAtServices({ servicesDir?, wellKnown?, launchd?, now?, only?, token?, latch?, platform? })` →
`{ servicesDir, error, services: ServiceLook[] }` — read the descriptors, find conflicts, read
launchd once (on macOS only: elsewhere a launchd descriptor is unmanaged and no `launchctl` runs, 0.4.0), probe each usable service once, derive each state. A reader with no history (a
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
note). `productIdOf(key)` and `instanceOf(key)` split a key into its product `id` and its
`instance` (`default` when absent) — the grouping of [ADR-0012](../../docs/adr/0012-one-entry-per-product.md),
so Fabric groups services into products exactly as Dashboards does (audit M-4).

## Usage

`src/usage.ts`, Fabric Agent Contract DEC-0021. A service that declares `surfaces.usage.path`
answers there, behind its token, with a report of its own spend: up to 31 UTC days of calls,
tokens and USD cost per provider and model, and an optional day or month budget.
`checkUsage(value, {id, instance})` returns the first problem a host relies on, or null. It
checks identity, currency, dates running forward, counts, an all-unpriced row that claims a
price, and the budget shape. `summarizeUsage(report, now)` returns `today`, `week` (7 days),
`month` (30 days) and `models` over the same 30 days (FD-113: a report may hold a 31st day, which no sum shows), ranked by cost. **An unknown cost stays unknown**: a window
with calls and no priced call has `costUsd: null`, a window with some unpriced calls is
`partial` (a lower bound), and only a window with no calls is `0`. **Unknown tokens stay a lower
bound too** (DEC-0091): a row's optional `unmeasuredCalls` counts calls whose tokens the service did
not measure in full; `checkUsage` refuses one that is not a count or exceeds `calls`, and every sum
holding such a call has `tokensPartial: true`. **A subscription spends no money** (0.6.0, FD-88):
a row with `route: subscription` (DEC-0046: the operator's own login in its vendor's runner, not
metered) adds its calls and tokens but never its `costUsd`; that list-price value is summed apart as
`estimateUsd`, with `subscriptionCalls`, so `costUsd` is money only and a window whose calls were all
on a subscription is `0`. The estimate reads like the money (0.8.0, FD-97, DEC-0110): `estimateUsd` is `null` when the
window's subscription calls carry no price, and `estimatePartial` marks a lower bound. Every sum also carries its `sides`
(0.9.0, FD-101): for the money and for the estimate, the calls, the priced calls, whether any is unpriced and the known
costs, so a host summing several reports applies DEC-0110's `usageSpend` over all their rows (`sideTotal`, `settleSum`)
instead of adding answers; a sum with calls none of which is priced is unknown even beside a row with no calls and a
cost. Windows are summed row by row; `models` keeps one entry per provider, model
and route; `checkUsage` refuses a `route` outside `subscription`, `key`, `platform-metered`, and a row
without one counts as money, as before DEC-0046. The token-gated read itself
stays in the host (`fetchUsage` in the app's `src/core/probe.ts`), like the events feed.

**Limits (DEC-0027, 0.3.3).** A report may list every spending limit in `budgets` (at most 64:
`id`, `scope`, `subject`, `kind`, one window, `limitUsd`, `spentUsd`, `enforced`, `tripped`).
`checkUsage` refuses a list a host cannot read — `limitsProblem`: an unknown field, a repeated id,
a scope outside `machine`/`project`/`pool`/`job`, a subject missing or present against its scope,
two windows, a non-positive amount, a per-order limit with a window or a spend, a known kind whose
window disagrees (FAC-SEM-031) — and accepts an unknown `kind` and a breach. `summarizeUsage`
returns `limits`, ranked by `rankLimits`: `tripped`, `breach` (an enforced ceiling spent past its
line), `near` (80 % or more), `ok`, `unknown` (spend not counted), `cap` (per order), `threshold`
(approval — never a breach), `off` (not enforced, still listed).

## Connections

`src/connections.ts`, FD-78, entry point `@passioncode-ai/fabric-service-host/connections`. A service may declare
what it uses in its well-known document under `extensions`, key
`https://fabric.passioncode.ai/agent-contract/extensions/connections/0.1` (Fabric Agent Contract DEC-0096, beside
DEC-0036 ED-9's dashboard extension; a reader that does not know an `extensions` key ignores it):

```json
{ "connections": [
  { "id": "notify", "kind": "service", "target": "example-notifier.default", "capability": "notifier.notify", "state": "ok", "lastAt": "2026-10-20T09:00:00Z" },
  { "id": "telegram", "kind": "connector", "target": "telegram", "purpose": "reads the operator chat", "state": "degraded", "reason": "flood wait 30 s" }
] }
```

At most 64 connections. `kind` is `service` (another Fabric service, by `id.instance` key or product `id`, with the
`capability` it calls), `model`, `connector`, `store` or `channel`; `state` is `ok`, `degraded`, `down` or `unknown`;
`label`, `purpose`, `reason` (each at most 300 characters) and `lastAt` (RFC 3339) are optional. A `degraded[].source`
with a connection's `id` is that connection failing. No string member may carry a credential (a key's shape, a
bearer token, a JWT, a long mixed run, or a URL with one). `connectionsOf(wellKnown)` is a port of the contract's
`connectionsView` and returns `{declared, reported, connections, errors}`, each connection with `failing`: an invalid
value declares nothing, is `reported` and lists every reason, so a host shows the error rather than a guess. It runs
the contract's 127 vectors (`test/fixtures/contract/vectors_connections.json`).

## Load

`src/load.ts`, FD-93, entry point `@passioncode-ai/fabric-service-host/load`. A service that queues its calls declares
in its well-known document, under `extensions`, key `https://fabric.passioncode.ai/agent-contract/extensions/load/0.1`
(Fabric Agent Contract DEC-0104, protocol `fabric-load/0.1`), where its load report is served and the queue's limits:

```json
{ "path": "/fabric/v1/load", "windowSeconds": 3600, "limits": { "concurrency": 4, "perCaller": 2, "queueMax": 50 } }
```

`loadOf(wellKnown)` returns `{declared, reported, declaration, errors}`: an invalid value declares nothing, is
`reported` and lists every reason (FAC-SEM-133). The report at `path` is `service-load/1`, read with the descriptor token
like the usage report: windows of `windowSeconds`, each with a row per context (`queued`, `running`, `completed`,
`failed`, `waitMs` and `runMs` as `{p50, p95}`). Counts and durations only, never a caller or a job id.
`loadReportProblems(report)` checks its schema and then FAC-SEM-132 (windows in order one `windowSeconds` apart, none
after `generatedAt`, a context once per window, `p50` at most `p95`, a run time only where a job ended); a host shows a
report only when it answers no problem. `summarizeLoad(report, now)` gives what a host shows: running and queued at the
end of the latest window, done and failed in the windows any part of which lies in the last day, the latest wait and run times per context,
the last 24 windows summed for a chart, and `stale` when the report is older than two windows. The limits apply per agent
and context while the report sums every agent a service hosts in a context, so a host states them and never sets a
count against them. `loadReportProblems` reads times and integers as the schema does (`schemaDateTime`) and compares
times for FAC-SEM-132 strictly (`strictTime`), as the contract's `loadRule`. It runs the contract's 15 load
fixtures (`test/fixtures/contract/*service-load*`, `*service-well-known-load*`).

## Actions

`src/actions.ts`, FD-110, entry point `@passioncode-ai/fabric-service-host/actions`. A service declares every action its
pages let a person take, and the agent tool that takes it, in its well-known document under `extensions`, key
`https://fabric.passioncode.ai/agent-contract/extensions/actions/0.1` (Fabric Agent Contract DEC-0121, protocol
`fabric-actions/0.1`, AP-1):

```json
{ "actions": [{ "id": "approve-reply", "title": "Approve the reply", "tool": "replies.approve", "gate": "relayed" }] }
```

`gate` is `none` (the caller's own act), `relayed` (the operator decides; a T0 or T1 caller carries the decision) or
`human` (a step only the person takes, named by `humanStep`). `actionsOf(wellKnown)` returns `{declared, reported,
actions, errors, findings}`: an invalid value declares nothing, is `reported` and lists every reason; `findings` are
FAC-SEM-142's, each with its `instancePath`: the invalid value, an id named twice, a `humanStep` that disagrees with
`gate`, and a `tool` that a present `surfaces.mcp.capabilities` does not list (a button without an agent twin). It is a
port of the contract's `actionsView` and `actionsExtensionRules`, run on the contract's actions fixtures and the
`declarations` of its `vectors/actions.json` (`test/fixtures/contract/*actions*`, at `52c7d798`).

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
