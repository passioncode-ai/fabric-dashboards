# @passioncode-ai/fabric-service-host

The reading half of hosting local agent services that speak `fabric-service/0.1`: find their
descriptors in `services/`, find claim conflicts, read launchd, probe health, derive the one
state each service is in, and build the `fabric-dashboards://service/<id>.<instance>` link that
opens one in Fabric Dashboards. Fabric Dashboards runs on it; Fabric's agent registry reads
`services/` with it (Fabric plan row AR-2.2), so both apps show a service in the same state.

It never starts, stops or changes a service, never reads a token and never opens a network
port. Controlling a service (launchd verbs), reading its events feed and signing in to its
dashboard stay in Fabric Dashboards ([ADR-0002](../../docs/adr/0002-launchd-is-the-only-supervisor.md),
[ADR-0006](../../docs/adr/0006-shared-service-host-package.md)).

Private to this repository's workspace and not published to npm; see
[Consuming it from Fabric](#consuming-it-from-fabric). License: the repository's
`PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0` ([LICENSE](../../LICENSE)).

## Entry points

| Import | What | Node built-ins |
|---|---|---|
| `@passioncode-ai/fabric-service-host` | everything below | yes (`fs`, `http`, `child_process`) |
| `…/protocol` | the shapes and constants only | none — safe in a renderer |
| `…/state` | `deriveState`, `attentionRank`, `DOWN_AFTER_MS` | none — safe in a renderer |
| `…/links` | the link builder and the key syntax | none — safe in a renderer |
| `…/test-vectors/state-precedence.json` | the shared state-precedence vectors | — |

CommonJS with `.d.ts` types, built by `tsc` into `dist/` (`npm run build:host` from the
repository root). Node 20 or later.

## Protocol

`src/protocol.ts`. `PROTOCOL` (`'fabric-service/0.1'`); `Descriptor`, `WellKnown`,
`WellKnownResult` (`answer` | `not-protocol` | `no-answer`), `ServiceEvent`, `ServiceState` and
`SERVICE_STATES` (`invalid`, `stopped`, `conflict`, `foreign`, `duplicate`, `down`, `starting`,
`stopping`, `degraded`, `ready`), `Reason` and `REASON_CODES` — every code `deriveState` can
return, so a host's message catalogue can be checked against it — `Busy`, `LaunchdStatus`,
`ClaimConflict`, `ID_PATTERN`, `INSTANCE_PATTERN`. The Fabric Agent Contract's
`schemas/service-*.schema.json` stay normative; these shapes follow them.

## Discovery

`src/descriptor.ts`.

- `servicesDir(env?, platform?, home?)` — `FABRIC_SERVICES_DIR` (a leading `~/` expanded), else
  `~/Library/Application Support/ai.passioncode.fabric/services` on macOS, else
  `$XDG_DATA_HOME/passioncode-fabric/services`.
- `readDirectory(dir)` → `DescriptorEntry[]` (`path`, `key` = `id.instance` or the file stem,
  `descriptor` or `null`, `problems`). A half-written, unreadable or misnamed file is an entry
  with its problem; an absent directory is `[]`; a directory that cannot be read at all throws.
- `validateDescriptor(raw)` → every problem as one sentence (FAC-SEM-012 and the schema).
- `claimConflicts(entries)` → `Map<key, ClaimConflict>` — two descriptors on one port, or one
  `id.instance` claimed twice (FAC-SEM-010).
- `portOf(origin)`, `expand(path)`.

## Health

`src/health.ts`. `fetchWellKnown(origin, timeoutMs = 2000)` → `WellKnownResult`; it never throws:
silence (refused, timed out) is `no-answer`, any other answer that is not a valid well-known
document is `not-protocol` with the reason (`checkWellKnown`). `request()` talks only to
`http://127.0.0.1:<port>` and caps an answer at 2 MB.

## Launchd

`src/launchd.ts`. `LaunchdReader(run?, uid?)` with `disabledTable()` (one `launchctl
print-disabled` per look) and `status(label, table?)` → `{ loaded, pid, disabled }`; a
`launchctl` that fails reads as not loaded. `parsePrint`, `parseDisabled`, `execRunner` (no
shell), `UNMANAGED`. Reading only: the verbs that change a job are Fabric Dashboards' own.

## State precedence

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

`src/look.ts`. `lookAtServices({ servicesDir?, wellKnown?, launchd?, now?, only? })` →
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

Pin a commit of this repository and take the package from its folder. With pnpm (Fabric uses
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
