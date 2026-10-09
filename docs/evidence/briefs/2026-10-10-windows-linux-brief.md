# Brief — Fabric Dashboards on Windows and Linux (FD-37), 2026-10-10

**Task.** The operator, 2026-10-10: «Надо сделать адаптацию сборки под Windows, чтобы всё корректно
работало. И под линукс тоже.» Every PassionCode.ai product ships macOS universal, Windows and Linux
(operator decision 2026-10-09, fabric-workspace `knowledge/platforms.md`, PR #86).

**Run:** task-pipeline, Proof of Done · the session's model for the whole run · run mode off ·
the operator delegated every decision except true human gates («сам реши», 2026-10-08/10), so the
grill is answered from the sources below and recorded as decisions, not asked.

## Source ledger

| Source | What it says about this task | Read at |
|---|---|---|
| Code inventory (33 files, read-only agent pass, 2026-10-10) | 22 files call macOS-only facilities; 12 risky seams, ordered below | 2026-10-10 |
| fabric-workspace PR #86 `knowledge/platforms.md` PL-01..PL-08 | packages (NSIS per-user; AppImage + .deb), signing (Authenticode NOT_SIGNED until the Azure profile), updates verified per OS, places, links and processes, native CI runners; supervision open, owners fabric + fabric-dashboards | 2026-10-10 |
| fabric-agent-contract `docs/specification/service.md` @ `623bf61` | services dir defined for macOS and Linux only; supervisor `launchd` or `none`; descriptor paths start with `/` or `~/` | 2026-10-10 |
| `docs/adr/0002`, `0015`, `0017`, `0018`; `AGENTS.md` Lifecycle | launchd is the only supervisor; updates verified then installed at idle; console PTY + runtime discovery; estate probes | 2026-10-10 |
| `docs/evidence/retro.md` standing instructions 1, 2, 5, 7, 8 | merge on the gate's exit; reproduce CI step by step; builds write to the scratchpad; read release rules first; e2e checks the screen lock | 2026-10-10 |
| Peers | fabric-switchboard-93: Switchboard ships NSIS + AppImage/.deb, one feed naming every platform; fabric-90: Fabric's port (CO-238) — supervision seams asked 2026-10-10, answer pending | 2026-10-10 |
| Board `docs/backlog.md` | FD-37 open; 9 open rows in all | 2026-10-10 |

No code graph (`graphify-out/` absent); no verification ledger in this repository.

## Riskiest seams (from the inventory)

1. Uninstall trashes `execPath/../../..` — `%LOCALAPPDATA%` on a Windows per-user install, `/` on Linux (`src/electron/main.ts:360-362`).
2. Process-tree kill is a silent no-op on Windows (`children.ts:35-52`, `consoles.ts:184-188` — node-pty throws on any signal there, `runtimes.ts:105`).
3. Token mode check refuses every token on Windows (`packages/service-host/src/health.ts:135`).
4. POSIX-only path grammar: descriptor `LOCAL_PATH`, settings folders, `':'` PATH joins, `HOME` reads.
5. launchd is part of the descriptor schema (contract change for any other supervisor).
6. The console cannot start off macOS (`ensureSpawnHelper`); no node-pty prebuild for Linux.
7. Updater, MCP stale-watch and launcher share the `.app/Contents` layout.
8. macOS-only Electron APIs without a platform check (`isInApplicationsFolder`, `wasOpenedAtLogin`, `hiddenInset`, `appMenu`, template tray icons).
9. Uninstall purge finds nothing off macOS and spawns `/bin/sh` on Windows.
10. Silent failures: missing `lsof` reads as "no listeners"; `execRunner` drops ENOENT.
11. `npm`/`npx` are `.cmd` shims on Windows.
12. Release and nightly CI are macOS-only.

## Decisions

| id | Decision | By |
|---|---|---|
| D-1 | Follow platforms.md PL-01..PL-08; a deviation is written in `AGENTS.md` with its reason | operator 2026-10-09, PR #86 |
| D-2 | Packages: the app directory stays `@electron/packager`'s; Windows NSIS per-user x64 + arm64, Linux AppImage + .deb x64 + arm64, built from the packaged directory by `electron-builder --prepackaged` on native runners | PL-02, PL-08 |
| D-3 | Windows ships `windows_authenticode: NOT_SIGNED` until the Azure certificate profile exists; Linux packages are unsigned; every file stays covered by GPG-signed `SHA256SUMS` and Sigstore attestations | PL-03 |
| D-4 | Updates: the openpgp `SHA256SUMS` check is the trust on every OS. Windows: the verified NSIS installer runs silently at an idle exit; Linux: the AppImage replaces its own file; a .deb copy never checks and says so. Until module M4 lands, Windows and Linux say `unsupported` honestly | PL-04, ADR-0015 |
| D-5 | Supervision (proposal sent to fabric-90 2026-10-10): Linux `lifecycle.manager: "systemd"` + `unit` (`systemctl --user`), Windows `"task-scheduler"` + `task` (per-user, no admin); services dir Windows `%LOCALAPPDATA%\passioncode-fabric\services`; a contract DEC in fabric-agent-contract before any reader accepts them. Until then a non-macOS host reads every local service as `manager: "none"`-shaped (monitor, dashboards, events, spend; no start/stop) and says why | run; platforms.md open question |
| D-6 | Token files on Windows: no POSIX mode; the reader refuses a symlink/reparse point and a file outside the user's profile; `%LOCALAPPDATA%` inherits a per-user ACL. Writers set the ACL (contract) | run |
| D-7 | Uninstall is per OS: Windows runs the NSIS uninstaller, Linux removes the AppImage file or tells a .deb user `apt remove`; the bundle-trash path is macOS-only | run |
| D-8 | UI per OS: default window frame, `CmdOrCtrl` accelerators, a File/Help menu, colour tray icons, strings that name the right OS facility ("this computer", "system tray", "Task Scheduler"/"systemd"); text goes through `copywriting` | super-ux / copywriting |
| D-9 | Nightly CI runs the gate on macos-latest, windows-latest, windows-11-arm, ubuntu-24.04, ubuntu-24.04-arm (no push/PR suites, rules §3); release builds on the same native runners | PL-08, CI policy 2026-09-25 |

## Modules (walking skeleton first)

| Module | What it delivers | REQ |
|---|---|---|
| M1 skeleton | safety gates (uninstall, macOS-only APIs, console helper), portable paths and token check, Windows services dir, window/menu/tray per OS, a portable unit suite, Windows and Linux packages built in CI, packaged smoke check, nightly OS matrix | REQ-001..008 |
| M2 processes and console | Job Object / `taskkill /T` with identity check, PATHEXT lookup, Windows PATH from the registry, `npm.cmd`, node-pty on Windows (conpty) and Linux (built), terminal open per OS, listeners via `ss`/`netstat` | REQ-009..013 |
| M3 OS integration | login item (Run key / XDG autostart with `--hidden`), `fabric-dashboards://` links, MCP launcher `.cmd`/`sh`, host discovery and `open` per OS, MCP stale watch, notifications identity, uninstall and purge per OS | REQ-014..019 |
| M4 updates | PL-04 per OS; one feed naming every platform; a release missing one is refused | REQ-020..022 |
| M5 supervision | contract DEC with fabric-90; supervisor interface; systemd and Task Scheduler implementations | REQ-023..025 |
| M6 docs | platform claim in AGENTS.md, README, scenarios; lifecycle table per OS; platforms.md answer; knowledge base | REQ-026..027 |

## REQ table

| REQ | Deliverable | Verified by |
|---|---|---|
| REQ-001 | Uninstall never trashes anything but this app's own install: bundle-trash only on darwin; other OS paths per D-7 (stub in M1: refuse with a reason) | unit test of the target resolver on win32/linux layouts |
| REQ-002 | macOS-only Electron APIs called only on darwin (Applications folder, `wasOpenedAtLogin`, `hiddenInset`, `appMenu`/hide roles, template tray images) | unit tests of the platform policy; packaged smoke on each OS |
| REQ-003 | Paths: `path.delimiter`, `os.homedir()`, absolute-path checks via `path.isAbsolute`, `~\` and drive paths in descriptors on win32 | `packages/service-host` + core tests run on all OS in CI |
| REQ-004 | Services dir on Windows per D-5 | `descriptor.test.ts` per platform |
| REQ-005 | Token reader on Windows per D-6 | `health`/remote tests on win32 |
| REQ-006 | The console never throws at load off macOS; it says why it is unavailable until M2 | unit test |
| REQ-007 | Windows NSIS x64/arm64 and Linux AppImage + .deb x64/arm64 built by CI from the packaged app; receipts; smoke check launches the packaged app and its MCP launcher answers `initialize` | release rehearsal run (publish false) |
| REQ-008 | Nightly gate on the five runners; the suite passes on each (platform-specific tests skip with a stated reason) | nightly run per OS |
| REQ-009..013 | M2 per module table | per-OS tests |
| REQ-014..019 | M3 per module table | per-OS tests |
| REQ-020..022 | M4 per module table | feed test; update rehearsal |
| REQ-023..025 | M5 per module table | contract fixtures; supervisor tests |
| REQ-026..027 | M6 per module table | `npm run check` (regions, UX lint), knowledge base check |

Frozen: adding is free; removing a row needs the operator.

## Carry-over ledger

| Item | Home |
|---|---|
| Windows Authenticode (operator's Azure identity validation) | fabric-switchboard `docs/DISTRIBUTION.md`; PL-03 |
| Supervision seam with fabric-90 | D-5; M5 |
