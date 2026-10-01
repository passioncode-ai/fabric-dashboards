# Working in fabric-dashboards

## Read first

1. The PassionCode.ai knowledge base — `fabric-workspace/knowledge/` in your clone (org-index
   `scripts/clone_all.sh` makes it) or https://wiki.passioncode.ai/knowledge — at least its
   [README](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/README.md),
   vision, principles and how-to-work.
2. This file, then the organization's
   [CONTRIBUTING.md](https://github.com/passioncode-ai/.github/blob/main/CONTRIBUTING.md).

## What this repository is

Fabric Dashboards: a macOS desktop app (Electron) that finds every local agent service speaking
`fabric-service/0.1`, shows whether it is alive and what it did last, starts, stops and restarts
it through launchd and opens each service's dashboard inside the app. Fabric's monitoring tool;
also works on its own. The current version is 0.3.4 (`package.json`, `CHANGELOG.md`); the README
*Quick start for a new teammate* is the path for a new user. Licence:
`AGPL-3.0-only OR LicenseRef-PassionCode-Commercial` ([ADR-0007](docs/adr/0007-agpl-or-commercial.md)).

## Commands

These come from `CONTRIBUTING.md`:

| What | Command |
|---|---|
| Install | `npm ci` |
| Test (the gate) | `npm run check` — typecheck, unit + integration tests, brand pins, code regions, UX lint (`FD_SKIP_LAUNCHD=1` without a GUI login session) |
| End-to-end | `npm run test:e2e` — builds, then drives the real Electron app against a live sample service |
| Run from source | `npm start` |
| Build a release | `npm run dist -- --notary-profile fabric-notary` — signed, notarized DMG + update zip + feed ([RUNBOOK](docs/RUNBOOK.md)) |
| MCP (register + proving call) | `claude mcp add --scope user fabric-dashboards -- "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"`, then `claude -p "Call the fabric-dashboards list_services tool once and reply with only the number of services it returned." --allowedTools mcp__fabric-dashboards__list_services --max-turns 3` |

The integration test drives the real launchd with the fixed label
`ai.passioncode.fabric-dashboards.test.sample`. `.github/workflows/validate.yml` runs `npm ci`
and `npm run check` on macOS every night and on manual dispatch, with `FD_SKIP_LAUNCHD=1`.

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

## Local rules

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
- **Shared registers are edited under a lease.** [docs/AGENT_SYNC.md](docs/AGENT_SYNC.md)
  (generated from `.claude/agent-sync.json` by `agent_sync.py setup`; never edited by hand) lists
  the guarded files and the gate. Run `agent_sync.py acquire <file>` before editing one and
  `agent_sync.py release <file>` after, on every path including failure. The lease is a ref under
  `refs/agent-sync/leases/` on `origin`, so another contributor's agent sees it
  (`git ls-remote origin 'refs/agent-sync/leases/*'`); the record plane is local (`fs`), and
  `.agent-sync/` is git-ignored. No register here carries a "Next free ID" line, so nothing is
  reserved yet; a register that gains one is declared under `idRegisters` and taken with
  `agent_sync.py reserve <REG>`.

## Organisation

This repository is one of the `passioncode-ai` repositories. **The org map and onboarding live in [passioncode-ai/org-index](https://github.com/passioncode-ai/org-index)**
(private; readable by every org member):

- [README](https://github.com/passioncode-ai/org-index#repositories): which repository owns what, and how they connect
- [rules](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/rules.md) (in the knowledge base since 2026-09-30; org-index `RULES.md` points there): branches, commits, CI, leases, secrets, handoffs
- [ONBOARDING.md](https://github.com/passioncode-ai/org-index/blob/main/ONBOARDING.md): setting up a new contributor's machine

Where this file is stricter than those rules, this file wins. A change to this repository's
role, dependencies or test command updates its row in `org-index/repositories.json` in the same change.

## Shared backlog

[docs/backlog-sources.json](docs/backlog-sources.json) declares this repository's canonical
local task sources and their vision goals. The [common backlog contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/backlog.md)
owns aggregation; [the workspace backlog](https://wiki.passioncode.ai/backlog) is a derived view.
Edit a task only in its canonical source under an agent-sync lease, retain stable IDs and
closure receipts, and declare any new source in the manifest. Do not edit generated task
status in the workspace or copy another repository's task into a second editable row.
Land the source change, then run `node scripts/workspace.mjs sync` from a Fabric checkout
(or use the scheduled sync); check the published source commit before calling it current.

## After work

In the same run: update this repository's docs with the change; if a cross-repository fact changed
(a product, a version, a plan row, a principle), update the page in `fabric-workspace/knowledge/`
that owns it; land both; publish (`node scripts/workspace.mjs sync` from a Fabric checkout) or
leave it to the scheduled sync. Leave a handoff with the exact next task.
