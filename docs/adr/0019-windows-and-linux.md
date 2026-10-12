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
- **It runs as an update, after the app exits.** *Restart to update*, or the ten hidden minutes of ADR-0015,
  checks the installer's hash again and starts a hidden PowerShell waiter (`nsisUpdateCommand`, the uninstall
  waiter's pattern). The app quits only once the waiter has started. The waiter waits for the app's process to exit
  (at most 120 s) and refuses if it is still running. It checks the hash once more, so nothing can swap the file
  between the app's check and the install; only a few milliseconds remain before the installer opens it. It then
  runs the installer with electron-builder's update flags (`--updated /S --force-run`, as electron-updater's
  NsisUpdater passes them). The installer installs in place and starts the app again. It never uninstalls and never
  touches the app's data. The hidden-relaunch marker keeps an automatic install in the tray.
- **Only where the installer puts it.** `nsis` also requires the app to sit in `%LOCALAPPDATA%\Programs\<name>`
  (`nsisInstalledAt`). An `--updated` install writes there, so a copy anywhere else would never change.
- **Proof.** `scripts/nsis-smoke.mjs` (packages.yml, both Windows runners) installs the app and starts it. It
  builds the app's own waiter (`nsisUpdateCommand` from the compiled `out/`) for the app's main process, ends that
  process the way a quit does, and requires three things: the waiter exits 0, every old process is gone and a new
  one runs, and the app and its uninstaller are still in place. Only that run's processes are stopped, and a
  survivor fails the check. It installs the same version over itself, so a version change is part of the owed
  end-to-end proof.
  Measured in run 38166001899: the update took 12 s on `windows-latest` and 486 s on `windows-11-arm`, where the
  installer's 7-Zip decoding is slow. On an arm64 PC the app comes back by itself, minutes later. The download path has the same limit as M4b: its
  end-to-end proof is the first real update from a release that carries M4c.

## Amendment 2026-10-12 — helpers that outlive the app

**Found** by the first end-to-end update proof (0.7.4 → 0.7.5, `update-proof.yml` run 38183686112):
- On both Windows runners the app logged `update_install started … waiter=<pid>`, quit, and no installer ran.
- On both Linux runners the AppImage replaced its own file, logged `update_install started`, and no new copy started.

**Causes, measured.**
- **Windows, not detached.** libuv puts every child that is not `detached` into one job object created with
  `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. The waiter was killed the moment the app exited, which is the moment it waits
  for. The same defect broke two more helpers: the uninstaller's waiter (Settings → Uninstall) and the data purge
  after an uninstall. The earlier comment in `uninstall.ts` ("Windows lets a child outlive its parent anyway") was
  wrong.
- **Windows, detached.** A `DETACHED_PROCESS` PowerShell has no console and exits at once without running its
  script (run 38190266069: the purge test then found the data untouched).
- **Linux AppImage.** Electron's `app.relaunch` starts its relauncher from this executable, inside the image's FUSE
  mount. The AppImage runtime serves that mount and stops with the app, so the relauncher died, and process
  listings around the restart showed nothing running (run 38186311237).

**Decision** (`src/core/after-exit.ts`).
- **Windows.** The helper is a grandchild. libuv's job also sets `SILENT_BREAKAWAY_OK`, so a process the child starts
  is not in the job. A hidden `cmd.exe` starts PowerShell with `start "" /b … -EncodedCommand <script>`; PowerShell
  shares cmd's hidden console and runs outside the job. The app quits only once `cmd.exe` exited 0
  (`powerShellAfterExit`), so the helper is running by then. The update waiter, the uninstaller's waiter and the
  purge all go this way.
- **POSIX.** The helper is a detached child (`spawnAfterExit`). A replaced AppImage is started again by a system
  `/bin/sh` that waits for the app's pid and then runs the new `$APPIMAGE` with this run's arguments
  (`appImageRelaunchCommand`), not by `app.relaunch`.

**Proof.**
- `test/after-exit.test.ts`: a parent starts the helper through the real function and exits, and the helper must do
  its work after the parent is gone. On Windows that is a PowerShell through `powerShellAfterExit`; on POSIX a
  detached child and the AppImage shell.
- `test/uninstall-platforms.test.ts` waits for the Windows purge to happen, not for a process to exit.
- `update-proof.yml` with `build: true` builds the fixed code numbered as 0.7.4 and lets it update itself to the
  published 0.7.5. On both Linux runners: `update_install installed from=0.7.4 to=0.7.5` (run 38190268316).

A first attempt claimed that a planted `detached: false` was caught on Windows. It was not: that run failed on an
import path (`ERR_UNSUPPORTED_ESM_URL_SCHEME`) before reaching the point, and this record corrects it.

