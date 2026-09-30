# fabric-dashboards — working in this repository

## Role

Fabric Dashboards is a macOS desktop app (Electron) that finds every local agent service speaking
`fabric-service/0.1` and shows whether it is alive and what it did last. It starts, stops and
restarts services through launchd and opens each service's dashboard inside the app. The current
version is 0.2.0 (`package.json`, `CHANGELOG.md`); the README quick start is the path for a new user.

## Build and test

These come from `CONTRIBUTING.md`:

```bash
npm ci
npm run check        # typecheck, unit + integration tests, brand pins, code regions, UX lint
npm run test:e2e     # builds, then drives the real Electron app against a live sample service
npm start            # run from source
npm run dist -- --notary-profile fabric-notary   # signed, notarized DMG + update zip + feed
```

The integration test drives the real launchd with the fixed label
`ai.passioncode.fabric-dashboards.test.sample`. Set `FD_SKIP_LAUNCHD=1` where there is no GUI login
session. `.github/workflows/validate.yml` runs `npm ci` and `npm run check` on macOS every night
and on manual dispatch, with `FD_SKIP_LAUNCHD=1`. The release steps are in
[docs/RUNBOOK.md](docs/RUNBOOK.md).

## Where things live

- [docs/HANDOFF.md](docs/HANDOFF.md) shows where each module stands, the next task and the checks
  that were run.
- Code: `packages/service-host/` — the npm workspace `@passioncode-ai/fabric-service-host`, the
  reading code Fabric also uses (descriptors, conflicts, launchd status, health, state
  precedence, service links; [its README](packages/service-host/README.md),
  [ADR-0006](docs/adr/0006-shared-service-host-package.md)); `src/core/` (monitor, launchd
  verbs, token-gated probes, links, activity, settings), `src/electron/` (main process, tray,
  updater) and `src/renderer/` (UI). Tests are in `test/` and `packages/service-host/test/`.
- The design is
  [docs/design/2026-09-28-fabric-dashboards-design.md](docs/design/2026-09-28-fabric-dashboards-design.md).
  Decisions are ADRs in [docs/adr/](docs/adr/), and [CONTEXT.md](CONTEXT.md) is the glossary.
- UX scenarios, screens and foundation are in [docs/ux/](docs/ux/scenarios.md).
- Copies you must never edit here: the brand files in `src/renderer/brand/` (vendored from
  `passioncode-ai.github.io`, pinned in `docs/brand-source.json`, checked by
  `scripts/check-brand.mjs`), and `test/fixtures/contract/` and `test/fixtures/sample-service/`
  (each has a `SOURCE.txt`).

## Rules in this repository

- launchd is the only supervisor. The app never starts a service process itself
  ([ADR-0002](docs/adr/0002-launchd-is-the-only-supervisor.md)).
- Reading a service belongs in `packages/service-host` (Fabric shares it); changing one, a token
  and the events feed stay in the app. A change to the state order updates
  `test-vectors/state-precedence.json` in the same change — Fabric runs that file too (ADR-0006).
- A user-facing change updates `docs/ux/scenarios.md` in the same change (`CONTRIBUTING.md`).
- To change a brand file, update the canonical file on the website, copy it and repin
  (`CONTRIBUTING.md`).
- Tokens are read in the main process only. They never reach a page, a URL or a log, and the app
  listens on no port (`SECURITY.md`).
- The repository's visibility decides whether the update feed is reachable (D-8 in
  `docs/HANDOFF.md`, and `docs/RUNBOOK.md`).
- A feature, module or special condition is fenced `// #region <slug> — docs: <path>#<anchor>` …
  `// #endregion <slug>`; `scripts/check-regions.mjs` (in `npm run check`) fails an unclosed
  region or a reference that does not open ([org CONTRIBUTING](https://github.com/passioncode-ai/.github/blob/main/CONTRIBUTING.md) §4).

## Organisation

This repository is one of the `passioncode-ai` repositories. **The org map, the shared
rules and onboarding live in [passioncode-ai/org-index](https://github.com/passioncode-ai/org-index)**
(private; readable by every org member):

- [README](https://github.com/passioncode-ai/org-index#repositories): which repository owns what, and how they connect
- [RULES.md](https://github.com/passioncode-ai/org-index/blob/main/RULES.md): branches, commits, CI, leases, secrets, handoffs
- [ONBOARDING.md](https://github.com/passioncode-ai/org-index/blob/main/ONBOARDING.md): setting up a new contributor's machine

Where this file is stricter than RULES.md, this file wins. A change to this repository's
role, dependencies or test command updates its row in `org-index/repositories.json` in the same change.
