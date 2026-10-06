# Working in fabric-dashboards

## Read first

1. The organization's
   [roadmap](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/roadmap.md) —
   every major feature and release across PassionCode.ai as `RM-*` tracks with owner, phase and
   state. It is the entry point: a task here that serves a track names it, and the track's status
   is edited only in the roadmap.
2. The PassionCode.ai knowledge base — `fabric-workspace/knowledge/` in your clone (org-index
   `scripts/clone_all.sh` makes it) or https://wiki.passioncode.ai/knowledge — at least its
   [README](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/README.md),
   vision, principles and how-to-work.
3. This file, then the organization's
   [CONTRIBUTING.md](https://github.com/passioncode-ai/.github/blob/main/CONTRIBUTING.md).

## What this repository is

Fabric Dashboards: a macOS desktop app (Electron) that finds every local agent service speaking
`fabric-service/0.1`, shows whether it is alive and what it did last, starts, stops and restarts
it through launchd and opens each service's dashboard inside the app. Fabric's monitoring tool;
also works on its own. The current version is 0.5.6 (`package.json`, `CHANGELOG.md`); the README
*Quick start for a new teammate* is the path for a new user. Licence:
`AGPL-3.0-only OR LicenseRef-PassionCode-Commercial` ([ADR-0007](docs/adr/0007-agpl-or-commercial.md)).

## Commands

These come from `CONTRIBUTING.md`:

| What | Command |
|---|---|
| Install | `npm ci` |
| Test (the gate) | `npm run check` — typecheck, unit + integration tests, brand pins, code regions, UX lint (`FD_SKIP_LAUNCHD=1` without a GUI login session) |
| End-to-end | `npm run test:e2e` — builds, installs Electron's binary (Electron 44 fetches it on first use; parallel test files would race for it), then drives the real Electron app against a live sample service |
| Run from source | `npm start` |
| Release | push an annotated `v<version>` tag; `.github/workflows/release.yml` builds, signs, notarizes, attests and publishes after a `release-approvers` approval. Rehearsal: a `v<version>-rc.<n>` tag, then `gh workflow run release.yml --ref <tag> -f publish=false` ([RUNBOOK](docs/RUNBOOK.md#release)) |
| Local build (debug only, never published) | `npm run dist -- --unsigned`, or signed: `npm run dist [-- --identity NAME] [--notary-profile NAME]` |
| MCP (register + proving call) | `claude mcp add --scope user fabric-dashboards -- "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"`, then `claude -p "Call the fabric-dashboards list_services tool once and reply with only the number of services it returned." --allowedTools mcp__fabric-dashboards__list_services --max-turns 3` |

The integration test drives the real launchd with the fixed label
`ai.passioncode.fabric-dashboards.test.sample`. `.github/workflows/validate.yml` runs `npm ci`
and `npm run check` on macOS every night, on manual dispatch and before every release, with
`FD_SKIP_LAUNCHD=1`.

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
  `docs/evidence/briefs/2026-09-28-brief.md`, and `docs/RUNBOOK.md`).
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

## Lifecycle

What runs, who starts it, what keeps running with no window and who stops it — the
[lifecycle contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md)
LC-09 inventory for this product. The tests that hold each rule are in `test/lifecycle.test.ts`
(the rule id is in each test name).

| Process | Started by | Cadence and what runs with no window | Stopped by |
|---|---|---|---|
| `Fabric Dashboards` (main process, one instance) | the person (Finder, Dock, `open`), a `fabric-dashboards://` link, or macOS at login **only if the person chose it** — asked once on the first-run card or in Settings, off until then; a launch never registers it (LC-07) | menu-bar icon always; the Dock icon only while the window is shown (FD-05); the monitor starts hidden and stays at the background cadence until a window is actually shown (table below) | tray Quit, ⌘Q, logout, `SIGTERM`: `will-quit` stops every monitor timer, flushes the activity state and ends every command group it started; an automatic update install (window hidden 10 min, no command running, `autoUpdate` on — ADR-0015) quits it the same way and Squirrel relaunches it in the menu bar |
| Electron helpers: GPU, network, the app's renderer | Electron, with the main process | idle | the main process |
| One renderer per opened service dashboard (`WebContentsView`, ~45 MB footprint each) | opening a service page | released 5 min after the window is hidden or minimized (`VIEW_RELEASE_GRACE_MS`); showing the window again re-opens the one that was on screen, on its page | the grace timer, the service's removal, quit |
| MCP stdio server (`Resources/bin/fabric-dashboards-mcp` → the app binary as Node, `ELECTRON_RUN_AS_NODE=1`; ~15 MB footprint) | Claude Code, one per agent session (`claude mcp add --scope user …`) | nothing between calls except an unref'd 60 s check that the installed bundle is still the one it started from | stdin EOF or `SIGTERM`: exits within 1 s and kills its command groups (SIGTERM, SIGKILL after 300 ms); after an app update it answers the next call `stale` with both versions and exits (LC-10) |
| A descriptor's `doctor` / `update` argv | the person (Health tab) or an agent (MCP) | its own process group, without `ELECTRON_RUN_AS_NODE` / `NODE_OPTIONS`, 120 s deadline (`src/core/children.ts`) | its deadline, quit, or the MCP session ending — the whole group |
| `launchctl`, `lsof`, `osascript` (JXA, `host_status`), `/usr/bin/open` | the monitor, the listener scan, the MCP tools | short-lived; never more often than the table below | they exit by themselves |
| Uninstall helper (`/bin/sh`) | Settings → Uninstall, after the person confirms | waits for the app's pid (at most 30 s), removes the app's data, ends | itself |

The app **owns no launchd job and listens on no port** (ADR-0002, `SECURITY.md`). The only
launchd label it ever touches as its own is the integration test's
`ai.passioncode.fabric-dashboards.test.sample`, booted out and re-enabled by the test itself. The
login item, when chosen, is the app's own Background Task Management record (`2.ai.passioncode.fabric-dashboards`).

**Monitor cadence** (`src/core/monitor.ts`, `DEFAULT_INTERVALS`). One timer armed for the earliest
due probe or rescan — no fixed 1-second poll — and one for the events feed:

| What | Window visible | Hidden, or never shown (login launch) |
|---|---|---|
| Health probe, local service | 5 s | 30 s |
| Health probe and events feed, online service | 60 s | 60 s |
| Events feed, local service | 15 s | 30 s |
| `launchctl print` per launchd service | with every probe | only after a missed probe, a changed pid, or 5 min |
| `launchctl print-disabled` | at most once a minute, and only when a `print` runs | same |
| Directory rescan (reads small JSON files, no spawn) | on `fs.watch`, plus every 5 s | on `fs.watch`, plus every 60 s (30 s if the watcher failed) |
| Status push to the window / tray rebuild / Dock badge | only when what a person can see changed | no IPC to a hidden window; tray and badge only when they would differ |
| Activity writes | appended rows when events arrive; state debounced 2 s | same |
| Update check (Squirrel, `update-feed.json` of the latest release) | 10 s after start, then every 6 h; downloads by itself; none outside Applications (`misplaced`) | same; a downloaded update installs after 10 hidden minutes (ADR-0015) |
| Usage reports (`surfaces.usage`, ADR-0013) | read now when Spend opens and on Refresh; every 60 s while Spend or Overview is shown (one read serves both for 30 s, ADR-0014) | none, except a first read when nothing has been read yet — then the main process answers the last sums without reading |

**Idle budget**, hidden, per hour, for *L* local launchd services and *R* online ones — counted on a
fake clock by `test/lifecycle.test.ts` (*LC-08: … a quiet hour stays inside the idle budget*):
probes ≤ 120 *L* + 60 *R*; event reads ≤ 120 *L* + 60 *R*; `launchctl print` ≤ 12 *L* plus one per
missed probe; `print-disabled` ≤ 13; status pushes 0 when nothing changed. CPU and memory targets:
main process ≤ 0.3 % average CPU over 10 hidden minutes; the app with no dashboard open ≤ 400 MB
RSS; each MCP server ≤ 60 MB RSS. The CPU and RSS targets are not yet measured on a build that
carries these changes — measure with `ps -o time,rss` over 10 hidden minutes on the next release
and record the numbers in `docs/HANDOFF.md`. (Before this change, 0.4.1 measured 1.3 % CPU and about
7,200 `launchctl` spawns an hour after a login launch: lifecycle audit 2026-10-03, F-2/F-4.)

**Files it writes** (LC-12): `~/Library/Application Support/Fabric Dashboards/` — `settings.json`
and its last good copy `settings.json.bak` (a damaged `settings.json` is restored from it, ADR-0015),
`restore.json` (written only by an uninstall that kept the data), `.relaunch-hidden` (seconds-long
marker of an automatic update install), `activity.jsonl` (appended, compacted to 5,000 rows at 10,000), `activity-state.json`,
`notified.json`, the Chromium profile and one `Partitions/svc-<key>` per service ever opened;
`~/Library/Logs/Fabric Dashboards/main.log` (0600, 5 × 5 MB). At start it removes temporary files
left by a killed writer and the partitions of services that are no longer installed; a service
removed while it runs takes its view and its stored session with it.

**Uninstall** (LC-14, ADR-0015): Settings → Uninstall removes the login item and the
`fabric-dashboards` MCP entry from `~/.claude.json` (user and project scopes; a same-named server
that runs something else is kept) and moves the app to the Trash. Data goes only on request: by
default, once the app has exited, everything it wrote is removed (`productDataPaths` in
`src/core/uninstall.ts`) **except** `KEPT_FILES` — settings, their copy, the activity history, the
notification ledger and `restore.json`, which makes the next install put the login item and the
MCP entries back. Ticking «Also delete my settings and activity history» removes those too. Every
packaged launch points an MCP entry of ours whose launcher is gone at the running copy. The
services folder (descriptors and tokens) is never touched. Without the app: `fabric-dashboards-mcp --unregister` removes the
MCP entry alone.

**Fuses** (LC-13, `scripts/fuses.mjs`): `npm run dist` sets them before signing and reads them back
from the finished binary; the release fails on a wrong one. Shipped: `EnableNodeOptionsEnvironmentVariable`
off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on,
`OnlyLoadAppFromAsar` on. Two declared exceptions:

- `RunAsNode` stays **on**: the MCP server runs inside this binary as Node, which is what keeps it
  at ~15 MB with no browser engine, no GUI lock and no profile access.
- `EnableCookieEncryption` stays **off**: turning it on creates a «Fabric Dashboards Safe Storage»
  Keychain item, and an upgrade with zero SecurityAgent prompts can only be shown on a signed
  build. Service session cookies stay plaintext in 0600 files, the same trust level as the service
  token files they are minted from (audit F-8).

## Build output and retention

LC-15. A build leaves at most the current and the previous release:

| Output | Made by | Kept | Cap |
|---|---|---|---|
| `release/Fabric-Dashboards-<v>.dmg`, `…-mac.zip` | `npm run dist` | current + previous version; `dist-mac.mjs` prunes older ones itself (`pruneReleases`) | 2 releases |
| `release/*.receipt.json`, `release/update-feed.json` | `npm run dist` | kept (small JSON) | — |
| `$TMPDIR/fd-dist-*` (stage, unpacked `*-darwin-universal` bundle) | `npm run dist` | removed by the script, the bundle unregistered from LaunchServices first | 0 |
| `release/stage/` (`Fabric Dashboards.app`, `build.json`) | `--stage app` | until `--stage seal`, which removes it, the bundle unregistered from LaunchServices first; a build stopped between stages leaves it for the next `--stage app` or `npm run clean` | 1 staged app |
| `out/`, `packages/service-host/dist/` | `npm run build`, `npm test` | regenerated | 50 MB |
| `node_modules/.cache`, `test-results/`, `test/.debug/` | vite, Playwright e2e | regenerated | 200 MB |

`npm run clean` brings a checkout back under the caps (`scripts/clean.mjs`: removes `out/`,
`test-results/`, `test/.debug/`, `node_modules/.cache` and `release/stage/`, and prunes `release/`). An agent that built
runs it before ending its run.

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
