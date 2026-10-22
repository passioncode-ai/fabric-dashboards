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
also works on its own. The current version is 0.7.21 (`package.json`, `CHANGELOG.md`); the README
*Quick start for a new teammate* is the path for a new user. Licence:
`AGPL-3.0-only OR LicenseRef-PassionCode-Commercial` ([ADR-0007](docs/adr/0007-agpl-or-commercial.md)).

## Commands

These come from `CONTRIBUTING.md`:

| What | Command |
|---|---|
| Install | `npm ci` |
| Test (the gate) | `npm run check` — typecheck, unit + integration tests, brand pins, code regions, UX lint (`FD_SKIP_LAUNCHD=1` without a GUI login session) |
| End-to-end | `npm run test:e2e` — refuses at once on a locked screen (`scripts/check-screen.mjs`: macOS sends windows no show/hide events then), builds, installs Electron's binary (Electron 44 fetches it on first use; parallel test files would race for it), then drives the real Electron app against a live sample service |
| Run from source | `npm start` |
| Release | push an annotated `v<version>` tag; `.github/workflows/release.yml` builds, signs, notarizes, attests and publishes once `guard` passes — approval by checks, no click (operator 2026-10-11; only `release-approvers` can push a `v*` tag). Rehearsal: a `v<version>-rc.<n>` tag, then `gh workflow run release.yml --ref <tag> -f publish=false` ([RUNBOOK](docs/RUNBOOK.md#release)) |
| Local build (debug only, never published) | `npm run dist -- --unsigned`, or signed: `npm run dist [-- --identity NAME] [--notary-profile NAME]` |
| Windows and Linux packages (FD-37) | built only in CI on each native runner by `scripts/dist-other.mjs` (`packages.yml`, called by the release); rehearsal from any branch: `gh workflow run validate.yml --ref <branch> -f os=all -f packages=true` ([RUNBOOK](docs/RUNBOOK.md#windows-and-linux-packages)). By hand on Windows or Linux: `node scripts/dist-other.mjs --allow-dirty` (debug, never published) |
| MCP (register + proving call) | `claude mcp add --scope user fabric-dashboards -- "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"`, then `claude -p "Call the fabric-dashboards list_services tool once and reply with only the number of services it returned." --allowedTools mcp__fabric-dashboards__list_services --max-turns 3` |

The integration test drives the real launchd with the fixed label
`ai.passioncode.fabric-dashboards.test.sample`. `.github/workflows/validate.yml` runs `npm ci`
and `npm run check` every night, on manual dispatch and before every release on macOS, Windows x64
and arm64 and Linux x64 and arm64 (PL-08), with `FD_SKIP_LAUNCHD=1`.

## Where things live

- [docs/HANDOFF.md](docs/HANDOFF.md) shows where each module stands, the next task and the checks
  that were run.
- Code: `packages/service-host/` — the npm workspace `@passioncode-ai/fabric-service-host`, the
  reading code built for Fabric to share, which Fabric does not import yet (descriptors, conflicts,
  launchd status, health, state precedence, service links; [its README](packages/service-host/README.md),
  [ADR-0006](docs/adr/0006-shared-service-host-package.md), amended 2026-10-06); `src/core/` (monitor, launchd
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
- Reading a service belongs in `packages/service-host` (built to be shared with Fabric); changing one, a token
  and the events feed stay in the app. A change to the state order updates
  `test-vectors/state-precedence.json` in the same change — it is the shared contract for the day Fabric reads health (ADR-0006).
- A user-facing change updates `docs/ux/scenarios.md` in the same change (`CONTRIBUTING.md`).
- To change a brand file, update the canonical file on the website, copy it and repin
  (`CONTRIBUTING.md`).
- A descriptor token is for reading a service as its host (health, events, well-known, usage) and for
  `POST /fabric/v1/login-code` (a host operation, contract `service.md` §Surfaces). Calling a service's
  capability across the machine boundary or for an outside person (trust tier T2) uses a Fabric delegation token
  (Fabric ADR-0144), never a descriptor token — its own or another service's (FD-44). On the operator's own
  machines (T0, T1) a token is optional and serves attribution only (operator 2026-10-11, ADR-0144 amendment 4,
  fabric-workspace `knowledge/authority.md` "Trust by machine"). Money limits, human gates and never spending
  another agent's key hold on every tier.
- Tokens are read in the main process only. They never reach a page, a URL or a log, and the app
  listens on no port (`SECURITY.md`).
- The repository's visibility decides whether the update feed is reachable (D-8 in
  `docs/evidence/briefs/2026-09-28-brief.md`, and `docs/RUNBOOK.md`).
- A feature, module or special condition is fenced `// #region <slug> — docs: <path>#<anchor>` …
  `// #endregion <slug>`; `scripts/check-regions.mjs` (in `npm run check`) fails an unclosed
  region or a reference that does not open ([org CONTRIBUTING](https://github.com/passioncode-ai/.github/blob/main/CONTRIBUTING.md) §4).
- **Interface language** ([localization](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/localization.md)):
  the system language decides, Settings → Language overrides (`chooseLang`, `src/core/i18n.ts`); every
  string exists in English and Russian (parity test). Declared deviation from L10N-02: keys are dot
  identifiers (`settings.autoUpdate`), not the English text, with English as the source dictionary.
  Russian strings put counts after a label («Сервисов: 3»), so no plural forms are needed (L10N-03).
  Machine reasons are translated by the table in `src/core/machine-ru.ts`; an unknown sentence stays
  in English, and a service's own words stay as the service wrote them.
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
| `Fabric Dashboards` (main process, one instance) | the person (Finder, Dock, `open`), a `fabric-dashboards://` link, or macOS at login — **on by default** (LC-07 as amended 2026-10-16): the first launch of an installed copy registers it once; after that only the person's choice in Settings or System Settings changes it, and every launch checks it, with a notification when macOS holds it for approval | menu-bar icon always; the Dock icon only while the window is shown (FD-05); the monitor starts hidden and stays at the background cadence until a window is actually shown (table below) | tray Quit, ⌘Q (both ask first, naming each running console session and the count of running commands; nothing running, no question), logout, `SIGTERM`: `will-quit` stops every monitor timer, flushes the activity state and ends every command group it started; an automatic update install (window hidden 10 min, no command or console running, the `auto-update` switch on — ADR-0015) quits it the same way and Squirrel relaunches it in the menu bar |
| Electron helpers: GPU, network, the app's renderer | Electron, with the main process | idle | the main process |
| One renderer per opened service dashboard (`WebContentsView`, ~45 MB footprint each) | opening a service page | 5 min after the window is hidden or minimized (`VIEW_RELEASE_GRACE_MS`) all but the two shown last are released (`WARM_VIEWS`, FD-74: they open at once on return), and those two after 60 min hidden (`VIEW_RELEASE_ALL_MS`); showing the window again re-opens the one that was on screen, on its page, without a new login code while the same service process signed it in less than 30 min ago (`WARM_SESSION_MS`) | the grace timers, the service's removal, quit |
| MCP stdio server (`Resources/bin/fabric-dashboards-mcp` → the app binary as Node, `ELECTRON_RUN_AS_NODE=1`; ~15 MB footprint) | Claude Code, one per agent session (`claude mcp add --scope user …`) | nothing between calls except an unref'd 60 s check that the installed bundle is still the one it started from | stdin EOF or `SIGTERM`: exits within 1 s and kills its command groups (SIGTERM, SIGKILL after 300 ms); after an app update it answers the next call `stale` with both versions and exits (LC-10) |
| A descriptor's `doctor` / `update` argv | the person (Health tab) or an agent (MCP) | its own process group, without `ELECTRON_RUN_AS_NODE` / `NODE_OPTIONS`, 120 s deadline (`src/core/children.ts`) | its deadline, quit, or the MCP session ending — the whole group |
| An agent console session (ADR-0017): the chosen runtime's own CLI on a PTY (`node-pty`; `spawn-helper` → the runtime), or `switchboard launch … --in-place` for a folder bound to a Switchboard project | the person, with New session or Continue last in a service's console — only when the Mac can carry it (LC-17, FD-49: ≥ 5 GB free on the folder's disk, swap not exhausted, at most **6** console sessions at once); Claude Code and Codex through `switchboard launch … --mode managed --in-place` whenever Switchboard holds an account for the provider (LC-20, FD-51); or a Switchboard hand-over, taken once with `switchboard handovers run <id>` in the free console of the agent whose folder it is, else in a console of its own (FD-62, SB-108; LC-17 applies, and one not taken goes to Terminal on Switchboard's side after two minutes); or a session Switchboard holds as stopped on a usage limit, once it is ready, continued by the runtime's own CLI with `--resume` in the home that holds its conversation (FD-83, FD-84, SB-115: recorded `resumed` only after 15 s alive; at most two a pass, within a day of the stop, never while a claude or codex process works in its folder; Settings → *Continue them by themselves*) | runs while the person works; nothing reaches a hidden window (its output waits in a 1 MB ring); a running console holds back an automatic update install; **after 30 minutes with no input or output it is saved (when, and the Switchboard account) and closed, and opening the console continues it** (LC-18, FD-50; checked once a minute) | Stop (asks first; SIGHUP, SIGKILL 2 s later), the idle close, the service's removal, quit (`will-quit` waits for every session to end) |
| `npx --yes @passioncode-ai/passioncode@0.2.2 doctor --json` (FD-65, SCN-070: read-only; never `--fix`) | the person, with Check setup in Settings → Setup or on the setup card; or an agent, with MCP `setup_check` (FD-81: the MCP server's PATH, the same pin and parse) | once per press, one at a time (a second press joins it), its own process group, the login shell's PATH, 120 s deadline; never run on its own — the last result is kept until the next press | its deadline, quit (`killOwned`) |
| `launchctl`, `lsof`, `osascript` (JXA, `host_status`; Terminal for Open in Terminal), `/usr/bin/open`, `launchctl list` and, for a ShipIt job left with no request, `launchctl remove ai.passioncode.fabric-dashboards.ShipIt` (once at start, FD-75), `switchboard --json project show` / `accounts list` / `agents list` / `sessions` (every 15 s while a console is on screen, FD-43) / `handovers` (FD-62: every 15 s with the window shown, 60 s hidden, only where Switchboard is installed) / `recovery` (FD-83, on the same tick after the hand-overs) with `lsof -a -d cwd -c claude -c codex` and `ps -axo args=` only when a stop is ready, and `recovery claim` / `recovery finish` once per stop the app continues / `launch --help`, the login shell once (`$SHELL -ilc`, to read its `PATH`; read 3 s after start so the first console opens at once, FD-74) | the monitor, the listener scan, the MCP tools, the agent console | short-lived; never more often than the table below | they exit by themselves |
| Estate probes (FD-30, ADR-0018): `git -C <clone> remote get-url / ls-remote / rev-parse --verify / fetch origin`, `npm view sshlg-skills …`, and with *Update skills by themselves* on `npx --yes sshlg-skills@<version> update` | the estate updater in the main process, while its switch is on | 90 s after start, then every 6 h, one retry within the hour after a failure, and 5 s after the person changes what is watched: at most 8 short processes a check (30 s deadline each; the update 10 min), own process group, the login shell's PATH (`src/electron/estate-updater.ts`); writes `estate-skills.json` in userData | the run's deadline, or `will-quit` (nothing starts after `stop()`) |
| Windows update waiter and installer (FD-37 M4c) | Restart to update, or an automatic install after 10 hidden minutes, on an NSIS install; the app quits once the waiter runs | a hidden `cmd.exe` starts `powershell.exe` with `start "" /b … -EncodedCommand` and exits, so the waiter runs outside the app's job and outlives it (`powerShellAfterExit`, ADR-0019 amendment 2026-10-12); the waiter (`nsisUpdateCommand`) waits for the app's exit (at most 120 s), checks the installer's SHA256 again, then starts the verified `pending-update/Fabric-Dashboards-<v>-windows-<arch>-setup.exe` with `--updated /S --force-run`; it installs in place and starts the app again | themselves |
| Outage alerts to the operator channel (FD-48) | the monitor's changes and a 30 s tick | an HTTP MCP call (initialize, tools/list, tools/call) to the local service offering `<id>.notify`, only when an episode opens (an agent not answering for 15 min) or closes (well again for 15 min), FD-76; event banners stay on the Mac; retried every minute | quit (`alerts.stop()`) |
| Reopen helper (`/bin/sh`, FD-31) | a launch that finds ShipIt installing a newer build (it quits at once and leaves this) | waits while the `ai.passioncode.fabric-dashboards.ShipIt` job runs (at most 10 min), then `open -b ai.passioncode.fabric-dashboards`, ends | itself |
| Uninstall helper (`/bin/sh` detached on macOS and Linux; on Windows a PowerShell grandchild through `cmd.exe`, as above, for the data purge and the uninstaller's waiter) | Settings → Uninstall, after the person confirms; the app quits once the helpers run | waits for the app's pid (at most 30 s), removes the app's data (and on Windows runs the NSIS uninstaller), ends; an app still running after 30 s keeps its data | itself |
| AppImage relaunch (`/bin/sh`, FD-37 M4b) | Restart to update, or an automatic install, on a Linux AppImage whose file was replaced | detached; waits for the app's pid (at most 120 s), then runs the new `$APPIMAGE` with this run's arguments (`appImageRelaunchCommand`; Electron's relauncher ran inside the image's mount and died with it) | itself |

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
| Switchboard hand-overs (`switchboard --json handovers`, FD-62; only where Switchboard is installed) | every 15 s | every 60 s |
| Window visibility check (FD-64: ⌘H fires no window event; one boolean, no spawn, no IPC) | 0.5 s after the app becomes or stops being active, plus every 15 s | same |
| Status push to the window / tray rebuild / Dock badge | only when what a person can see changed | no IPC to a hidden window; tray and badge only when they would differ |
| Activity writes | appended rows when events arrive; state debounced 2 s | same |
| Update check (LC-16 in detail, ADR-0015 amendment: the pinned `update-feed.json` of the latest release, then that release's signed `SHA256SUMS`, its zip and the app's signature verified before Squirrel stages it) | 90 s after start, then every **5 minutes** (operator 2026-10-17), a failed check retried after 5 minutes; a quiet check is logged once per state; the release's static feed, never the GitHub API; nothing automatic while the `auto-update` file says `off`; none outside Applications (`misplaced`); a release with `needsPerson` is verified and held; a ready update whose staged files have gone from disk is downloaded and staged again before it is offered or installed (FD-75) | same; a downloaded update asks once per version «Restart to finish updating» (a notification) and installs after 10 hidden minutes (ADR-0015) |
| Usage reports (`surfaces.usage`, ADR-0013) | read now when Spend opens and on Refresh; every 60 s while Spend or Overview is shown (one read serves both for 30 s, ADR-0014) | none, except a first read when nothing has been read yet — then the main process answers the last sums without reading |

**Idle budget**, hidden, per hour, for *L* local launchd services and *R* online ones — counted on a
fake clock by `test/lifecycle.test.ts` (*LC-08: … a quiet hour stays inside the idle budget*):
probes ≤ 120 *L* + 60 *R*; event reads ≤ 120 *L* + 60 *R*; `launchctl print` ≤ 12 *L* plus one per
missed probe; `print-disabled` ≤ 13; status pushes 0 when nothing changed. CPU and memory targets:
main process ≤ 0.3 % average CPU over 10 hidden minutes; the app with no dashboard open ≤ 400 MB
RSS; each MCP server ≤ 60 MB RSS. Measured 2026-10-13 on the signed 0.7.6 with 13 local and 9 online
services (FD-07, FD-60): RSS ≈ 230 MB for the app and 32–56 MB per MCP server (both inside); main-process
CPU **0.258 % hidden** and 0.386 % shown on Overview (`node --import tsx scripts/measure-idle.ts 180` after
`npm run build`: the built app on the real services in an isolated profile with notifications paused); the
monitor costs about 1.7 ms of CPU per probe or events read. (Before this change, 0.4.1 measured 1.3 % CPU and about
7,200 `launchctl` spawns an hour after a login launch: lifecycle audit 2026-10-03, F-2/F-4.)

**Files it writes** (LC-12): `~/Library/Application Support/Fabric Dashboards/` — `settings.json` (with the panel layout, pinned agents,
the list's sort, hidden agents and the kinds the person chose (FD-78, read by the MCP server without writing), each service's console runtime and folder, ADR-0017, and the previous visit and setup state, ADR-0020),
`consoles/<key>/` (FD-39, ADR-0020: the context pack each console start writes — `context.md`, `task.md` for a Fix/Update, `mcp.json`,
`brief.md` when the brief exceeds one argument and `handoff.json`, the contract's `session-handoff/1` manifest (FD-47, DEC-0042), for Claude Code, Codex and Gemini CLI;
and `setup.md` for the Setup console; 0700 folder, 0600 files, rewritten at each start, never in the agent's repository)
and its last good copy `settings.json.bak` (a damaged `settings.json` is restored from it, ADR-0015),
`auto-update` (the LC-16 switch: written only when the person turns it, kept by every uninstall), `.last-version` (the version that ran last, to log a finished install), `restore.json` (written only by an uninstall that kept the data), `.relaunch-hidden` (seconds-long
marker of an automatic update install), `.resume-route.json` (written by Restart to update: the screen the next copy opens on, read and removed at its start, FD-21 U-18), `activity.jsonl` (appended, compacted to 5,000 rows at 10,000), `activity-state.json`,
`notified.json`, `outage-alerts.json` (FD-48: open outage episodes and each service's start baseline), `pending-update/` (Windows, FD-37 M4c: the verified installer until it runs; removed at every start), the Chromium profile and one `Partitions/svc-<key>` per service ever opened;
`~/Library/Logs/Fabric Dashboards/main.log` (0600, 5 × 5 MB). At start it removes temporary files
left by a killed writer and the partitions of services that are no longer installed; a service
removed while it runs takes its view and its stored session with it.

**Uninstall** (LC-14, ADR-0015): Settings → Uninstall removes the login item and the
`fabric-dashboards` MCP entry from `~/.claude.json` (user and project scopes; a same-named server
that runs something else is kept), removes an update Squirrel has staged (its `ShipItState.plist` and
`update.*` bundle, so ShipIt cannot put the app back as it quits, FD-21 R-20) and moves the app to the Trash. Data goes only on request: by
default, once the app has exited, everything it wrote is removed (`productDataPaths` in
`src/core/uninstall.ts`) **except** `KEPT_FILES` — settings, their copy, the activity history, the
notification ledger, the `auto-update` switch and `restore.json`, which makes the next install put the login item and the
MCP entries back. Ticking «Also delete my settings and activity history» removes those too, except the `auto-update` switch (`ALWAYS_KEPT`, LC-16). Every
packaged launch points an MCP entry of ours whose launcher is gone at the running copy. The
services folder (descriptors and tokens) is never touched, and neither is the «Fabric Dashboards Safe Storage» Keychain item (FD-04, see Fuses). Without the app: `fabric-dashboards-mcp --unregister` removes the
MCP entry alone.

**Fuses** (LC-13, `scripts/fuses.mjs`): `npm run dist` sets them before signing and reads them back
from the finished binary; the release fails on a wrong one. Shipped: `EnableNodeOptionsEnvironmentVariable`
off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on,
`OnlyLoadAppFromAsar` on, `EnableCookieEncryption` on (FD-04, since 0.7.15). One declared exception:

- `RunAsNode` stays **on**: the MCP server runs inside this binary as Node, which is what keeps it
  at ~15 MB with no browser engine, no GUI lock and no profile access.

Cookie encryption keeps the service session cookies encrypted at rest. On macOS the key is the
«Fabric Dashboards Safe Storage» Keychain item, made by the first launch that opens a dashboard and
read by later versions under the same Developer ID signature. On Windows the key is DPAPI-sealed in the
profile's `Local State`. Linux keeps the fuse **off** (`wantedFuses`, `scripts/dist-other.mjs`): the
desktop keyring there may ask the person to unlock it. The Keychain item is not removed by Uninstall:
deleting it from outside the app can ask the person for their password, and with the dashboard
partitions gone it encrypts nothing (Keychain Access removes it by hand).

## Release pipeline (PL-10) — where this product differs, and why

fabric-workspace `knowledge/platforms.md` PL-10 sets one release pipeline for every product. This one
has its stages and receipt keys (`release.yml`: `guard` + `preflight` → `check` → `macos`, `windows`, `linux` → `feed` →
`still-newest` → `publish`; receipts carry `version`, `commit`, `arch`, `macos_notarization`,
`windows_authenticode`, `checks`). It differs in these ways:

- **The feed names every platform; only macOS reads it yet.** Since FD-37 M4a the `feed` job adds a
  `platforms` entry per OS and architecture from the receipts (`scripts/release-feed.mjs`) and refuses a release
  that lacks one (PL-04). Windows and Linux copies do not update themselves yet: the updater says `unsupported`
  An NSIS install on Windows (M4c) and a Linux AppImage (M4b) update themselves (ADR-0019 amendments); a `.deb`
  copy never checks and says that a newer `.deb` updates it.
- **`check`** is the five-runner unit gate (`validate.yml`, `os: all`), a stage the template does not
  name; it runs before any platform job.
- **Windows signs between build stages, not inside electron-builder.** The app is packaged by
  `@electron/packager` and only then installed by electron-builder `--prepackaged`, so it uses
  `windows-signing@v1` twice (the Tauri/native pattern), not `login` + `azureSignOptions` + `verify`.

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
<!-- SSHLG:PROJECT:BEGIN managed by npx sshlg-skills enroll. To opt out, replace the whole block with one SSHLG:PROJECT:OPTOUT comment line. -->
## Family routes in this project

Surface: `internal` (detected).
Signals: none. No website or app-text signal in the tree.

Routes that apply here (the global routing block says what each one owns):

| Router | Answers | Setup here |
|---|---|---|
| `evidence-docs` | what proves it | nothing to seed |
| `task-pipeline` | how the change reaches the repository | DOCMAP: missing (`/task-pipeline setup`) |

Remaining setup:
- `/task-pipeline setup`: DOCMAP for `task-pipeline`, missing `docs/DOCMAP.md`
<!-- SSHLG:PROJECT:END -->
