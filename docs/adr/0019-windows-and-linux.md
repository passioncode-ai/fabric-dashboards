# ADR-0019 — Fabric Dashboards on Windows and Linux

Status: accepted · 2026-10-10 (operator: «Надо сделать адаптацию сборки под Windows, чтобы всё корректно
работало. И под линукс тоже.») ([brief](../evidence/briefs/2026-10-10-windows-linux-brief.md))

## Context

Up to 0.6.7 the app is macOS-only: launchd supervision (ADR-0002), `~/Library` places, POSIX process
groups, Squirrel.Mac updates (ADR-0015), a `spawn-helper` console (ADR-0017), the Dock and template tray
icons, and a release built only on macOS. The operator decided on 2026-10-09 that every PassionCode.ai
product ships macOS universal, Windows and Linux; the shared rules are fabric-workspace
`knowledge/platforms.md` PL-01..PL-08. A read-only inventory of 33 files (2026-10-10) found where the
app would crash or do harm off macOS — worst, uninstall trashed `execPath/../../..`, which is
`%LOCALAPPDATA%` on a Windows per-user install and can be `/` on Linux.

## Decision

<a id="decision"></a>

1. **One pure policy module** (`src/core/platform.ts`) decides what differs by OS, so every branch is
   tested on any machine: what uninstall removes, which folder paths settings keep, window chrome, tray
   icons, menu keys, a hidden start, where notification settings open. The main process asks it rather
   than branching on `process.platform` where a decision lives there.
2. **Uninstall removes only this install:** the `.app` bundle on macOS; on Windows this install's own
   NSIS uninstaller beside the executable, run silently after the person confirmed in the app; on Linux
   the AppImage named by `APPIMAGE`, or for a .deb the app says `sudo apt remove fabric-dashboards`.
   Anything else removes nothing and says what the person does instead.
3. **Places and paths** follow PL-06 and the descriptor grammar of the OS that wrote it. The services
   folder on Windows is `%LOCALAPPDATA%\passioncode-fabric\services` (proposed to the contract with
   Fabric's port: token files must not roam); Linux keeps the contract's XDG folder. A Windows
   descriptor path is drive-absolute or `~\`, never a network share. `PATH` lists join with the OS
   delimiter; `~` resolves against `os.homedir()` (Windows has no `HOME`).
4. **Token files on Windows** are refused if they are links or lie outside the user's profile; the
   profile's ACL is what keeps them private, since Windows reports no POSIX owner or mode.
5. **Interface per OS:** the system window frame (the inset title bar is macOS's), a File menu with
   updates and Quit and a Help menu where there is no app menu, `Ctrl` shortcuts instead of `Command`,
   colour tray icons on Windows and Linux (a black template is invisible on a dark panel, and the tray
   is the way back to a hidden window), and the login item with `--hidden` on Windows.
6. **Packages and updates** follow PL-02..PL-04: NSIS per-user x64 + arm64, AppImage + .deb x64 +
   arm64, built on native runners; Windows ships `windows_authenticode: NOT_SIGNED` until the Azure
   certificate profile exists; every update is checked against the release's GPG-signed `SHA256SUMS`
   before it runs. Until the per-OS updater lands, Windows and Linux report updates as unsupported.
7. **Supervision off macOS** waits for a contract decision with Fabric's port: proposed
   `lifecycle.manager: "systemd"` (Linux, `systemctl --user`) and `"task-scheduler"` (Windows, a
   per-user task). Until it exists, Windows and Linux show local services read-only — health,
   dashboards, events, spend — and say why start and stop are not offered.

The work lands in modules (brief): M1 skeleton, M2 processes and console, M3 OS integration, M4 updates,
M5 supervision, M6 documentation. Each module updates this record's status line when it ships.

## Consequences

- **One macOS change:** a copy that does not run from an `.app` bundle (a development or hand-copied
  binary) is no longer trashed on uninstall — the old rule trashed whatever folder sat three levels up.
  It now removes nothing and says how to remove it.
- A copy built for Windows or Linux never runs macOS-only code paths: they are gated by the platform
  module or by `process.platform` beside the Electron call that exists only on macOS.
- The shared service-host package grows a platform argument (`servicesDir`, `expand`,
  `validateDescriptor`, `tokenFileProblem`); macOS behaviour is unchanged and its tests stay as they were.
- Supervision on Windows and Linux is a cross-repository decision, not this app's alone; until the
  contract records it, the app claims no start/stop there.

## Amendment 2026-10-11 — updates on Linux (FD-37 M4b)

PL-04 on Linux, after M4a made every release's feed name each platform (`platforms`, `scripts/release-feed.mjs`).

- **How the copy was installed decides** (`src/core/self-update.ts` `updateChannel`). An AppImage updates itself:
  `$APPIMAGE` is absolute and a regular file, and this process runs from inside `$APPDIR`. Both variables are
  inherited by children, so a `.deb` copy started from an AppImage's shell is a `package` copy and never overwrites
  that file. A `.deb` copy never checks: Settings says that a newer `.deb` from the releases
  page updates it. Windows says it does not update itself yet, until M4c. A development run still says updates
  come with the installed app (0.7.1–0.7.3 showed that sentence on installed Windows and Linux copies too, which
  was wrong).
- **The trust is macOS's.** The AppImage follows the same checks, in order:
  1. the release's `SHA256SUMS` is signed by the pinned organization key;
  2. its `update-feed.json` is the one `SHA256SUMS` names;
  3. that feed's `platforms.linux-<arch>` names exactly `Fabric-Dashboards-<v>-linux-<arch>.AppImage`, with the
     hash `SHA256SUMS` gives;
  4. the downloaded file has that hash.

  A release whose feed says `needsPerson` is verified and held, as on macOS.
- **Replacing the file.** The new AppImage is written beside this one (`.<name>.<version>.part`, so the rename stays
  on one file system), made executable, flushed to disk, and renamed over `$APPIMAGE` in one step; the folder is
  flushed after the rename. A folder this user cannot write fails before any download. The running copy keeps its old
  mount and runs on. *Restart to update*, or the ten hidden minutes of ADR-0015, starts `$APPIMAGE` again. A
  `.part` left by a killed download is removed at the next start. A folder this user cannot write fails the update
  and says so; the old AppImage is untouched.
- **Proof.** The pure parts are tested on the published 0.7.3 receipts (`test/self-update.test.ts`). The network
  path runs through Electron's `net` and the pinned feed address, which no test may redirect. The end-to-end proof
  is therefore the first real update: an AppImage of the first release that carries M4a and M4b updating to the
  release after it, on `ubuntu-24.04` and `ubuntu-24.04-arm` (board row FD-37). That run also confirms that
  Electron's relaunch starts the new copy only after this one has exited (otherwise the single-instance lock would
  end it), and that this run's arguments come back.

## Amendment 2026-10-11 — updates on Windows (FD-37 M4c)

PL-04 on Windows, on the same feed and checks as M4b.

- **An NSIS install updates itself** (`updateChannel` → `nsis`): the installer's `Uninstall Fabric Dashboards.exe`
  sits beside the app, which is the same test `uninstallTarget` uses. Any other Windows copy says it was not set up
  by the installer and does not update itself.
- **The installer is verified, then waits.** It goes through the same checks as Linux: the signed SHA256SUMS, the
  signed feed's `platforms.win32-<arch>` (exactly `Fabric-Dashboards-<v>-windows-<arch>-setup.exe`), and the file's
  hash. It is then kept in the app's data (`pending-update/`, removed at every start and by uninstall).
  Authenticode is not checked again here: the release pipeline signs and verifies it (`windows_authenticode:
  SIGNED`), and the GPG-signed SHA256SUMS is the trust on every OS (PL-04).
- **It runs as an update.** *Restart to update*, or the ten hidden minutes of ADR-0015, starts the installer
  detached with electron-builder's own update flags (`--updated /S --force-run`, as electron-updater's NsisUpdater
  passes them), then quits. The installer installs over the copy in place and starts the app again. It never
  uninstalls and never touches the app's data. The hidden-relaunch marker keeps an automatic install in the tray.
- **Proof.** `scripts/nsis-smoke.mjs` (packages.yml, both Windows runners) installs the app and starts it. It then
  runs the same installer with those flags over the running copy and requires that every old process has gone and
  a new one runs, with the app and its uninstaller still in place. The download path has the same limit as M4b: its
  end-to-end proof is the first real update from a release that carries M4c.

