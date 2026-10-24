# Contributing

Contributions are accepted under the [Contributor License Agreement](CLA.md): opening a pull
request is how you agree to it, with no checkbox to tick. It lets PassionCode.ai offer Fabric Dashboards both under the
[GNU AGPL-3.0](LICENSE) and under a [commercial license](COMMERCIAL-LICENSE.md).

```bash
npm ci
npm run check        # typecheck, unit + integration tests, brand pins, code regions, UX lint
npm run test:e2e     # builds, then drives the real Electron app against a live sample service (one file at a time)
npm start            # run from source
npm run icon         # re-render build/icon.icns and the menu bar templates from the vendored mark
npm run dist -- --unsigned                       # a local test build of the DMG + update zip (debug only)
```

- Releases are built, signed, notarized and published only by `.github/workflows/release.yml`,
  after a `v<version>` tag, which only team `release-approvers` can push, and the `guard` check (approval by checks)
  ([RUNBOOK](docs/RUNBOOK.md#release)). A build signed on a laptop is a debug build and is never
  published.

- `packages/service-host` is an npm workspace (`@passioncode-ai/fabric-service-host`, shared with
  Fabric, not published). `npm ci` at the root links it; `npm test`, `typecheck` and `build` build
  it first. A change to the state order updates its `test-vectors/state-precedence.json`.
- The integration test drives real launchd with the fixed label
  `ai.passioncode.fabric-dashboards.test.sample`; set `FD_SKIP_LAUNCHD=1` where there is no
  GUI login session (CI).
- Brand files under `src/renderer/brand/` are vendored from `passioncode-ai.github.io` and
  pinned in `docs/brand-source.json`; `scripts/check-brand.mjs` rejects an edit. Update the
  canonical file there, copy it, repin.
- Protocol fixtures under `test/fixtures/contract/` and the sample service under
  `test/fixtures/sample-service/` are copies with a `SOURCE.txt`; never edit them here.
- A user-facing change updates `docs/ux/scenarios.md` in the same change.

## End-to-end tests

`npm run test:e2e` starts its own Electron for every test file, so it guards the machine before it builds anything:

- It refuses at once on a locked screen (`scripts/check-screen.mjs`): macOS then sends windows no show/hide events.
- It refuses at once when the 1-minute load average is above 150 or free disk is under 5 GB
  (`scripts/check-machine.mjs`, HV-02), with the figure it read. `FD_E2E_MAX_LOAD` and `FD_E2E_MIN_FREE_GB` move the
  floors when you mean to run anyway.
- It runs the files one at a time (`scripts/run-e2e.mjs`). `npm run test:e2e -- --parallel` runs them side by side,
  `FD_E2E_CONCURRENCY=<n>` sets how many; `npm run test:e2e -- test/e2e/spend.test.ts` runs only the files named.

## Leases

Shared registers (`.claude/agent-sync.json` `guardedFiles`: the ADRs, `docs/HANDOFF.md`,
`CHANGELOG.md`, `docs/backlog.md`, `docs/backlog-sources.json`) are edited under an agent-sync
lease ([docs/AGENT_SYNC.md](docs/AGENT_SYNC.md)). `npm ci` installs a `pre-commit` hook
(`scripts/install-hooks.mjs`, FD-26) that runs `scripts/lease-guard.mjs`: a commit staging a
guarded path is refused unless `agent_sync.py guard <path>` allows it, and refused with the
install command where agent-sync is absent. Take the lease first (`agent_sync.py acquire <file>`),
release it after. A pre-commit hook another tool installed is left alone and named.

## Private data

This repository is public. The same `pre-commit` hook then runs `scripts/private-guard.mjs` (FD-63). It finds org-index
`scripts/check_private.py` (Fabric ADR-0092): `$CHECK_PRIVATE_PY` first, then an `org-index` clone beside this checkout,
then `~/DATA/org-index`. With it, the hook refuses a commit while any tracked file holds one of these:
- a private name from the local denylist (P1);
- an address outside the allowed set (P2);
- a home path (P3);
- an account id (P4).

The findings are printed. Replace the value. A reviewed synthetic P2–P4 finding, such as a made-up test home folder, goes into
`.check-private-allow` by the fingerprint the checker prints; a P1 term never does.

The denylist is private and lives only on the operator's machines, so CI cannot run this check:
- With no denylist (the checker's exit 2) or no checker, the commit goes on silently.
- A checker that cannot run is named, and the commit goes on.
- `CHECK_PRIVATE_PY=none` turns the check off.
