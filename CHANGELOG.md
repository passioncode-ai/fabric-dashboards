# Changelog

## Unreleased

### Added

- **Estate updates (FD-30, [ADR-0018](docs/adr/0018-estate-updates-from-inside-the-app.md)).** The
  app watches the versions of the Fabric Agent Contract and of the operator's skills, and updates
  them where safe. Settings → Estate updates: name a local contract clone to watch its `main`
  against the sibling consumer pins — the only automatic step is `git fetch`; a pin move stays a
  reviewed decision in each consumer. Skills: a background `npx sshlg-skills update` behind the
  auto-update switch (off by default), after the package's publisher is checked. LC-16 cadence
  (90 s, then every 6 h), activity codes `estate_check` / `estate_update`, status on the Settings
  page. Starts and stops with the app — no port, no launchd job, child `git`/`npm` processes only.

## 0.6.2 - 2026-10-07

The first published release since 0.6.0. It carries everything listed under 0.6.1 below — 0.6.1 was
tagged and built, but a bug audit by the fabric-workspace session found that Restart to Update ended
running agent consoles without asking, so it was withdrawn before approval (run 37539041728
cancelled). This release fixes that and the rest of the audit.

### Fixed

- **Restart to Update and Quit ask before ending work.** With an agent's console session or a
  command running, «Restart to Update», the app menu's Quit and the tray's Quit name what would be
  stopped and wait for a yes. Nothing running, no question. The automatic install never asks: it
  waits until nothing runs, as before.
- **A slow service no longer freezes the monitor.** A health probe now ends at its deadline even
  when the service keeps trickling bytes (`@passioncode-ai/fabric-service-host` 0.3.2).
- **Rewriting a descriptor no longer removes the service.** A writer that deletes and recreates the
  file (no atomic rename) used to end that service's console and wipe its stored session; a service
  now counts as removed only when its descriptor stays absent for 1.5 s across two scans.
- **Uninstall never deletes data from under a running app.** If the app is still running after the
  30-second wait, the helper leaves its data in place.
- **A `~/.claude.json` kept as a symlink stays a symlink** when uninstall or a repair edits it.
- **The login shell read for the console's `PATH`** ends at its deadline together with everything
  its startup files launched, not just the shell itself.
- **Open in Terminal through Switchboard** says it cannot continue the last session instead of
  quietly starting a new one.
- **An update check or download that stops moving fails after 45 minutes** instead of showing
  «Checking…» forever.

### Changed

- **The update's version and its "needs your step" mark are signed.** The app reads the release's
  own `update-feed.json` and requires its hash to match the signed `SHA256SUMS` (the same check as
  Fabric Inbox 95af4f7). A mark added after signing makes the update fail with `signature_failed`.
- Updater errors read in Russian in a Russian interface.

## 0.6.1 - 2026-10-07 (withdrawn — not published)

Updates by the organization's standard, and the interface in Russian by choice.

### New

- **Language in Settings:** As on this Mac, English or Русский. The window, the app menu and the
  tray switch at once. In Russian, machine reasons — a descriptor check, a refused token, a network
  error — read in Russian where the sentence is known; a service's own words stay as it wrote them.
- **A release that needs your step waits for you.** It is downloaded and verified, then held with
  «What to do» (its steps) and «Install».

### Changed

- **Updates follow LC-16 in detail** ([ADR-0015 amendment](docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#lc-16)):
  - nothing reaches Squirrel unverified: the release's `SHA256SUMS` must be signed by the
    organization's key, the zip must match it, and the app inside must be signed by team
    `KJ35UYYL22` with the announced, newer version; the bundle Squirrel stages must be that same
    build (code-directory hash), or it is removed before any quit;
  - the first check runs 90 s after start, then every 6 hours, with one retry within the hour after
    a failure;
  - **Install updates automatically** off now stops every automatic check and download («Check for
    Updates…» still works). The choice lives in the `auto-update` file, which no update, reinstall
    or uninstall rewrites; a 0.6.0 choice of off is carried over;
  - the update feed can no longer be replaced by an environment variable; Squirrel's own downgrade
    guard is on;
  - `main.log` records every step with the organization's codes (`update_check`,
    `update_download`, `update_install`, `update_restart`, `auto_update`).
- Russian follows the organization's glossary: «Устанавливать обновления автоматически»,
  «Перезапустить для обновления», «Завершить», «Открыть в Терминале».

### Fixed

- With the console open, the compact service bar lost the service's name and hid the last tab: a
  padding rule after the narrow-bar rules overrode them. The name and every tab now fit; labels fold
  into icons first.
- The collapsed sidebar's «Свернуть панель» / «Развернуть панель» no longer truncate.
- A full disk during an update download fails the check instead of hanging it.

### Build

- The release build ships `openpgp` (its one CommonJS file) and proves the finished bundle verifies a
  real release's signature and refuses one changed byte (`checks.updateVerifier`).

## 0.6.0 - 2026-10-06

The dashboard gets the screen, and the agent's own runtime sits beside it
([ADR-0017](docs/adr/0017-focus-layout-and-agent-console.md)).

### New

- **The header steps aside.** A service page opens with a one-line bar: the state, the name, the
  tabs, and «Show details» for the full card with the controls. A problem is never hidden: a
  state that is not ready, or a failed action, shows as a chip in the bar that opens the card. The
  name's hover text is the agent's summary. View → Show or Hide Service Details (⌃⌘D).
- **The sidebar folds into a rail** of icons and agents' initials with their state marks and
  badges, each named on hover. View → Show or Hide Sidebar (⌃⌘S).
- **An agent console beside the dashboard.** «Console» opens a panel with a real terminal running
  the runtime you choose — Claude Code, Codex, or another one installed and found on your login
  `PATH` — in the agent's repository: the folder whose git `origin` is the descriptor's
  `source.repository`, or one you choose. It is the runtime's own interface, with your settings and
  skills; its permission questions appear in it. New session, Continue last (`claude --continue`,
  `codex resume --last`), Stop (asks first), Open in Terminal. One console per agent; it keeps
  running while folded, hidden or on another agent's page, and ends when the app quits. View →
  Show or Hide Console (⌃⌘T).
- **The right account.** A folder that Fabric Switchboard binds to a project never runs on the
  ordinary sign-in: the session starts through Switchboard on the project's account — in the
  console once Switchboard can launch in place (its SB-75), in Terminal until then. When
  Switchboard cannot say, the session is not started.
- Panel states, the console's width and each agent's runtime and folder are remembered.

### Changed

- An automatic update does not install while a console session runs (ADR-0015 treats it like a
  running command).
- The window's style policy allows inline styles, which the terminal view needs; scripts and
  connections stay as strict as before (`SECURITY.md`).
- The release build ships `node-pty` (N-API prebuilds for both architectures, unpacked from the
  asar, `spawn-helper` made executable before signing) and proves a PTY runs from the finished
  bundle (`checks.pty`).

## 0.5.6 - 2026-10-06

The first published release since 0.4.1. It carries everything listed under 0.5.5, 0.5.4, 0.5.3
and 0.5.2 below — none of them was published on its own. 0.5.5 was tagged and built, but a third
review of the release found that a service's token could still reach an address that is not the
service, so it was withdrawn before approval. This release fixes that and everything else the
review found ([audit report, third pass](docs/reports/2026-10-05-release-audit/README.md#third-pass--2026-10-06-fix-list-for-056)).

### Security

- **An online address that is not the service gets no token again.** An online service's address
  that answers without the Fabric protocol (an error page, a parked domain) used to receive the
  token with every health check, once a minute, while the page said nothing was sent. Now only the
  check that found out carries it; later checks go without the token until the address asks for one
  again. The MCP server keeps the same rule for its whole session, where before every call sent the
  token again to an address that had answered as another service.
- **Another program on a service's port never gets its token.** The MCP `activity` tool read the
  events feed of whatever answered on the port, with the service's token, and `link`/`open` could
  build the browser address from that program's dashboard path. Both now refuse it.
- **Signing in again checks who answers now.** A dashboard whose session ended signs in again with
  the service as the app sees it at that moment, so a program that took the port after the service
  stopped never receives the token.

### Fixed

- **A page that crashes right after every load stops at "The page stopped".** It used to reload
  itself forever, starting a new page process each time. One automatic reload per crash streak
  stays; a page that ran for a minute earns it back.
- **The page you moved to in a dashboard stays when you switch tabs.** Switching to Health and back,
  or a short outage, no longer sends you back to the page a notification opened.
- **Showing a dashboard again after an error or a crash loads it again.** It no longer puts the dead
  page back on screen; a sign-in that fails while the window comes back says so with Retry.
- **The Stop dialog.** While it is open, Tab stays on its two buttons and nothing behind it can be
  reached; Escape closes it wherever focus is; closing it puts focus back on Stop, and confirming
  puts it on the service's name. A service that disappears while the dialog is open closes it,
  instead of leaving its dashboard hidden and the dialog popping up later (U-14).
- **A failed action leaves Needs attention after half an hour** even when nothing else changes on
  screen. An online service no longer offers Logs it does not have.
- **Spend.** When no agent has reported, the strip says the sum is unknown instead of «≥ $0.00». A
  report that cannot be read for a network or token-file reason is worded in the app's language.
- **Commands.** A doctor or update ended by a signal says so and keeps its output; only a command
  that never started reads «could not run». What a finished command left running counts as owned
  until it is gone, so quitting right after it ends it too.
- **An update a notification started runs once,** also when its page is opened again.
- **Small things:** the update output keeps its heading; the Activity filter forgets a service that
  is gone; notifications no longer pile up in memory over weeks; an uninstall that stopped halfway
  says what it already removed; a hidden window gets no page-load events; an online service that
  answers from several replicas no longer reads as restarted every minute; a Russian Spend reason
  reads correctly.

### MCP

- `spend` reports a stopped agent's spend as unknown, never as not reporting.
- An argument of the wrong type — a numeric path, a string limit, an empty service — is refused
  instead of silently replaced by its default.
- `fabric-dashboards://open/<anything>?…` and `open?service=…&url=` are refused like the other
  malformed links.

### Shared package and release

- `@passioncode-ai/fabric-service-host` 0.3.1: `RemoteTokenLatch`, and `lookAtServices` takes a
  `latch`. It also carries the three remote-5xx state vectors of 0.5.5. Fabric does not import the
  package today (its registry reads `services/` itself and probes nothing), so nothing changes there.
- `npm run test:e2e` installs Electron's binary before its tests, so it no longer fails right after
  `npm ci`. The release workflow's publish step uses `!cancelled()`, and a rehearsal's signed set is
  kept 14 days.

## 0.5.5 - 2026-10-06

Tagged, never published: its run was cancelled before approval, superseded by 0.5.6 after a third
review found token leaks. It carries everything listed under 0.5.4, 0.5.3 and 0.5.2
below — none of them was published on its own. In short: one entry per agent, Spend, a toolbar
over every dashboard and an at-a-glance Overview, updates that install themselves, settings that
survive an uninstall, and the lifecycle contract. On top of that, this release closes the
[release audit of 2026-10-05](docs/reports/2026-10-05-release-audit/README.md): every screen and
scenario, the code and the architecture were checked, and its findings are fixed below.

### New

- **Each agent says what it is for.** The descriptor's one-line summary shows under the name on
  its Overview card and on its page. Until now only the summary tiles were drawn.
- **An agent's page lists its tools.** These are the MCP capabilities from its well-known document,
  eight shown and «+N more».
- **One agent's dashboard can hand you to another.** A `fabric-dashboards://service/<id.instance>?path=…`
  link, or another installed agent's own address, clicked or opened in a new window inside an
  embedded dashboard, now opens that agent here at that page, signed in with its own session.
  Before, the first was refused and the second went to the browser without a session. Links to
  other sites still ask before opening the browser. A new window on the dashboard's own site opens
  in place instead of being dropped. ([ADR-0016](docs/adr/0016-agent-summary-tools-and-cross-links.md))

### Security

- **A service's token never goes to another program.** When something else answers on a service's
  port, the app no longer reads its usage report with the service's token, and no longer shows its
  version, tiles, tools or update offer as the service's own. An online service whose address
  answered as another service gets no token again until its descriptor changes.
- **A one-time sign-in code never appears in an error.** A failed page load shows the error's name,
  not the address it was loading.
- **A dashboard can only load its own site.** Links from events and notifications, and the
  dashboard path a service declares, are checked so that `/\host` or `@host` cannot open another
  site in the service's signed-in view.

### Fixed

- **Spend never turns unknown into $0.** An agent that reported spend and then stopped answering is
  listed under "could not read", and the totals read «≥». A row with calls but no cost is a lower
  bound. The Overview strip uses Spend's format (<$0.01), refreshes every minute, and leads to
  Spend when an agent failed. Opening Spend or pressing Refresh reads now, and "read at" is the
  time of that read.
- **A dashboard that failed recovers.** Retry and Reload sign in again and show the page again,
  instead of an empty pane. A page that cannot load says so, separately from a sign-in failure.
  The "service restarted — Reload" bar is visible above the page. A link from a notification or
  another agent is applied once, so switching tabs keeps your place.
- **A full disk no longer silences outage alerts or freezes the app at start.** Activity and
  settings are kept in memory until a write succeeds.
- **Quitting, updating and moving the app behave.** After a failed update or move, closing the
  window hides it again instead of quitting. Quit waits for a stubborn doctor/update command to
  end. What such a command leaves running ends with it.
- **One action at a time.** A double click no longer starts two restarts. A restart is noticed
  even when the state did not change. Restarting a duplicate whose stray copy keeps the port names
  that process.
- **A service not yet checked reads "Starting"**, not "Off" with a Start button.
- Needs attention keeps a row while its action runs, and shows a failure with a Logs button.
  Doctor and Update show a running line, end on failure, and put their output on Health. That
  includes an Update started from Needs attention.
- An unreadable services folder has Retry. The empty state links to how a service joins.
- A port conflict shows the other service's file. `fabric-dashboards://` opens the Overview.
- The menu-bar icon says "Ready: n of m" when not everything is ready, names instances, and updates
  when a notification pause ends.
- Activity keeps its filter, shows new app events while open, and a notification about several
  events of one service opens Activity filtered to it.
- Settings no longer claims notifications are off in macOS (the app cannot know). It links to
  System Settings → Notifications instead.
- Russian: Health labels, listener table, command names, menu item and dates.
- Accessibility: service tabs work with arrow keys, and buttons and cards name their service.
- The `open?…` link forms refuse unknown or repeated parameters.
- "Show data folder" reveals an app bundle instead of launching it. No listeners is "none", not an
  error.
- The uninstall removes the MCP entry before the login item, and puts it back if macOS refuses.

### Second pass (2026-10-06)

A second walk of every scenario, the interface in English and Russian, and every MCP tool against
live sample services:
- **An online service whose platform answers 5xx** (a deploy, an outage) reads "not up", then
  Not answering — never "Wrong program on port". An origin answering without the protocol is named
  by its address, not "port 0".
- Activity rows and action results name the instance ("Growth · projection"). A doctor/update
  that cannot start says "could not run: <reason>". An undeclared command or a busy service says
  so.
- The service page's Activity tab shows new rows while open. Show data folder and Show file say
  when they cannot open a path. Needs attention offers an update for a degraded service too.
  An online service's down notification says its platform runs it.
- Russian: the app's own Spend reasons, the login-item approval, command results and Overview
  strip labels (they wrap to two lines).
- MCP: instances are named apart, `spend` treats a service that does not answer as unknown, and a
  command that cannot start is a refusal.
- The update check times out instead of sticking at "Checking…".

### MCP

- `doctor` is no longer marked read-only (it runs the service's program).
- An unknown tool is a protocol error. Undeclared arguments are refused.
- An unreadable events feed is a clear refusal.
- `control` refuses a missing launchd plist, as the app does.

### Updates and releases

- **An installed copy only ever moves forward.** The app reads the update feed's version and
  installs only a newer one, so a release published out of order can never pull it back. Releases
  run one at a time, and the newer-than-published check runs again right before publishing.

## 0.5.4 - 2026-10-05

Tagged, never published: its run was cancelled before publish, superseded by 0.5.5. What it
added over 0.5.3:

- **Updates install themselves.** A downloaded version installs once the window has been closed
  for ten minutes and nothing the app started is running, and the app reopens in the menu bar.
  **Settings → Updates** has **Install updates automatically** (on by default, also for settings
  saved by an earlier version), the update state and **Check now**. Before this, an update waited
  for a quit, which a menu-bar app rarely gets.
- **A copy outside Applications says why it cannot update and moves itself.** Opened from the disk
  image or Downloads, the app asks once to move to Applications; afterwards the footer and
  Settings → Updates offer **Move to Applications**. Squirrel cannot replace a copy there, and it
  used to fail with its own error text.
- **Uninstall keeps your settings and history.** Settings → Uninstall still removes the login
  item and the MCP entry and moves the app to the Trash. Caches, logs and dashboard sessions are
  removed, but the settings and activity history stay unless you tick **Also delete my settings
  and activity history** (lifecycle LC-14: data goes only on request).
- **A reinstall puts back what the uninstall removed:** the login item and the `fabric-dashboards`
  MCP entries, pointed at the new copy. An MCP entry that points at a moved or deleted copy is
  repaired at every launch.
- **A damaged `settings.json` is restored from its last good copy** (`settings.json.bak`). It no
  longer resets to the defaults without a word, and the damaged file is kept beside it.

## 0.5.3 - 2026-10-05

Tagged, never published: its release run was superseded by 0.5.4. It carries everything listed
under 0.5.2 — one entry per agent, Spend, the dashboard toolbar and the at-a-glance Overview, the
lifecycle contract — plus the items below.

- **A dashboard whose session ended signs in again by itself.** When the page answers 401, the app
  runs the login code again and reopens the same page, at most once a minute per view. Reload page
  covers the same case. Before this, the operator was left on the service's 401 text, and the only
  way back was Restart, then Reload. Reported by the Copylot owner session.
- Embedded dashboards follow the app's light or dark theme (`nativeTheme`), not only the theme of
  macOS.
- **No Dock icon while the window is hidden.** Closing the window leaves the app in the menu bar
  only; opening it from the menu bar, a link or Finder brings the Dock icon back (FD-05,
  `test/e2e/spend.test.ts`).
- **The app no longer ships Electron's camera, microphone and Bluetooth purpose strings.** It asks
  for none of these (every permission request is refused), and the release build now removes them
  from the app's and every helper's `Info.plist` and fails if one remains (FD-06,
  `checks.usageDescriptions`).

## 0.5.2 - 2026-10-05

Tagged, never published: its run was cancelled before approval, superseded by 0.5.3. The `v0.5.0`
and `v0.5.1` tags were never released either: their CI check failed on lifecycle tests (LC-02, then
LC-14). This version carries both fixes.

### Fixed

- **A command that exited is done, even when a descendant holds its output open.** A `doctor` or
  `update` command whose child left the process group (`setsid`) and kept stdout open used to
  count as running until that child let go. Measured: 5054 ms against 1 s now
  (`test/lifecycle.test.ts`, *LC-02: a command that exited is done…*). The command's streams get
  one second after its exit, and then the command counts as finished.
- **A kill in progress is never abandoned.** The SIGKILL fallback for a group that ignores SIGTERM
  no longer rides an unreferenced timer, so an exiting MCP server or app still sends it. The LC-02
  test had failed in CI since the lifecycle contract landed.
- The LC-14 test holds the purge helper it waits for. The app lets that helper go on purpose so it
  can quit, and in CI the test's own process ended first.

## 0.5.0 - 2026-10-05 (tagged, not released)

- **A toolbar over every embedded dashboard ([ADR-0014](docs/adr/0014-dashboard-toolbar.md)).**
  It has Back, Forward, Reload page and Dashboard home, shows the page's address, and offers two
  copies: **Copy address** (the page's own URL) and **Copy app link** (a `fabric-dashboards://`
  link that opens the same page here, signed in). A one-time login code is never shown or copied
  (SCN-039, SCN-040).
- **Overview reads at a glance.** A status strip shows agents ready, not answering, needing
  attention, and spend today and in 30 days. Needs attention takes one line per row, shows three
  rows and folds the rest behind "Show all". The cards are denser: four across a wide window,
  equal height in a row, one-line values and events (SCN-041, SCN-042).

- **Spend ([ADR-0013](docs/adr/0013-spend-from-the-agents.md)).** A new page shows what every
  agent spent today, in 7 and in 30 days, its own budget, and a per-model breakdown. The numbers
  come from each agent's own usage report (Fabric Agent Contract DEC-0021, `surfaces.usage`). A sum
  that includes unpriced calls reads «≥ $x», and a cost nobody knows reads «unknown», never $0.
  Agents that cannot be read are named with the reason, and agents that do not report are named
  too. Nothing is read while the page is closed or the window is hidden. Agents get the same sums through the new MCP tool
  `spend` (SCN-036…038).
- `@passioncode-ai/fabric-service-host` 0.3.0: `…/usage` (`checkUsage`, `summarizeUsage`), and
  `WellKnown.surfaces` carries `mcp.capabilities` and `usage`.

- **One entry per agent ([ADR-0012](docs/adr/0012-one-entry-per-product.md)).** Every instance of
  one service id — the main endpoint, a local projection, a read-only access point — is one entry in
  the sidebar and one card on Overview; the service page switches between the instances, each with
  its own state, session and controls. The `default` instance is the one a click opens, and a down
  default is never replaced by another instance. Services that answer without a dashboard are listed
  under **Background**. Attention, Activity, notifications, the tray, deep links and start/stop/restart
  still act on the exact instance; MCP `list_services` names each service's `product`
  (SCN-033…035).
- The online-service end-to-end test waits one full online probe interval (60 s, LC-08) for a
  refused token; it had been failing on `main` since the lifecycle contract landed.

- **Releases are signed only in GitHub Actions.** `.github/workflows/release.yml` runs on a
  `vX.Y.Z` tag in the protected `release` environment, after a person from `release-approvers`
  approves (whoever pushed the tag may; an agent never does). It signs with the organization's CI Developer ID, notarizes and staples
  the app and then the image with the shared `notarize` action, attests every file (Sigstore), and
  publishes them with `SHA256SUMS` and its GPG signature. A `-rc` tag with `publish=false` rehearses
  the whole path without creating a release. A locally signed build is for debugging and is never
  published ([RUNBOOK](docs/RUNBOOK.md#release)).
- `scripts/dist-mac.mjs` runs in stages (`--stage app|package|seal`), so the update zip and the
  image are made from the stapled app. The identity is named with `--identity` and never picked
  from a keychain in CI. The seal stage fails unless the app, the app inside the update zip and the
  image are all stapled and Gatekeeper accepts the app as well as the image. The local
  `--notary-profile` path now reads Apple's status (`Accepted`) instead of trusting the exit code.
- `validate.yml` pins its actions by commit and runs before every release.

The organization's [lifecycle contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md)
(LC-07…LC-15), from the 2026-10-03 lifecycle audit. `AGENTS.md` → *Lifecycle* is the inventory and
idle budget; `test/lifecycle.test.ts` holds each rule.

- **Idle means idle (LC-08).** The monitor starts hidden — a launch at login shows no window, so it
  now runs at the background cadence instead of the 5-second one forever — and wakes only when a
  probe or a rescan is due instead of every second. Status reaches the window, the tray and the
  Dock only when something a person can see changed; a hidden window gets no IPC. Hidden, the
  events feed is read every 30 s, an online service at most once a minute, and `launchctl print`
  runs only after a missed probe, a changed pid or every 5 minutes. Embedded dashboards are released
  5 minutes after the window hides and come back on their page when it shows.
- **Bounded files (LC-12).** The activity feed is appended, compacted at twice its 5,000-row cap,
  and its state written on a 2-second debounce, not rewritten and fsynced on every event.
  Start-up removes temporary files left by a killed writer and the stored sessions of services that
  are no longer installed; a service removed while the app runs takes its view and session with it.
  `main.log` is 0600 and rotates at 5 × 5 MB.
- **The MCP server leaves with its session and its code (LC-10).** It exits within a second of
  stdin closing or `SIGTERM`, ending every command it started with its whole process group. After an
  app update it answers the next call `stale` with both versions and exits, instead of serving the
  old code until the session restarts. A descriptor's `doctor`/`update` no longer inherits
  `ELECTRON_RUN_AS_NODE` or `NODE_OPTIONS`, and runs in its own process group with a deadline, in the
  app as well.
- **Asked once (LC-07).** Launch at login is off until the person answers a one-time question on
  Overview or sets it in Settings; a launch or an update never registers it, and a login item turned
  off in System Settings stays off. Tray Quit no longer opens a dialog the first time; the menu says
  that quitting stops no service.
- **Uninstall (LC-14).** Settings → Uninstall removes the login item, the `fabric-dashboards` entry
  in Claude Code's `~/.claude.json`, and the app's data once it has exited, then moves the app to
  the Trash. `fabric-dashboards-mcp --unregister` removes the MCP entry alone.
- **Hardened fuses (LC-13).** `npm run dist` (`--stage app`, before signing) turns off
  `NODE_OPTIONS` and the inspector arguments and turns on ASAR integrity validation and
  `OnlyLoadAppFromAsar`, then reads the fuses back from the built binary and fails on a wrong one. `RunAsNode` stays on (the MCP server runs in this binary)
  and cookie encryption stays off (no Keychain item without a signed upgrade test); both are
  declared in `AGENTS.md`.
- **Builds clean up (LC-15).** `npm run dist` keeps the current and previous release in `release/`
  (`--stage seal` prunes the rest and names them in the receipt's `pruned`) and unregisters every
  bundle it deletes from LaunchServices; `npm run clean` removes regenerated output, including a
  `release/stage/` left by a build stopped between stages.

## 0.4.1 - 2026-10-03

- **MCP `link` and `open` without a path point `http_url` at the service's dashboard**, read from
  its well-known document, instead of the origin root. An online service often serves its panel
  under a path and answers 404 at `/`, so the diagnostic URL and the browser fallback led nowhere.
  `open_link` is unchanged — the app already opened the dashboard. A service that does not answer
  keeps the root. Found on the first real online service.
- **MCP tool descriptions name online services**: the instructions, `list_services`, the `url`
  argument and `control` (which refuses an online service) no longer say "local" and
  `http://127.0.0.1` only.

## 0.4.0 — 2026-10-02

- **Online services.** An agent or dashboard that runs online — an `https` origin on a platform —
  appears beside the local ones, under **Online**, read directly over verified TLS
  ([ADR-0011](docs/adr/0011-online-services.md); Fabric Agent Contract DEC-0019, `placement: "remote"`).
  The well-known document, events and the one-time login code are the same; the token goes only to
  the descriptor's own https origin; no redirect is followed; the dashboard opens signed in inside
  the app (SCN-030, SCN-031). A refused token, a certificate that does not verify, a redirect and a
  minute of silence are each `down` with their own reason (SCN-032); a token file that cannot be read
  is `invalid` and the service is never contacted. No start, stop, restart or update is offered for
  an online service — its platform supervises it.
- **MCP:** `list_services` carries `placement`; `control` refuses an online service; `activity` and
  the status read it with its token; `open?url=` accepts exactly a registered online origin.
- **`@passioncode-ai/fabric-service-host` 0.2.0:** placement-aware descriptors, https requests,
  `readToken`/`authHeaders` (moved from the app), `refused`, the remote state precedence and nine new
  shared vectors.
- Tests reach an online service through `FD_TEST_REMOTE`, honoured only in an unpackaged build.

## 0.3.4 — 2026-10-01

- **Fixed: a blank Dashboard tab.** Switching between two services whose dashboards were both open
  left the tab empty: the old dashboard's hide arrived after the new one's show and removed it. A
  hide now withdraws only the view its own dashboard asked for, and a page that finishes loading
  after a newer choice never covers it (`ViewSlot`, SCN-015; reproduced by a new end-to-end test,
  which fails without the fix).
- **Notifications only when it matters** ([ADR-0010](docs/adr/0010-notifications-only-when-it-matters.md)).
  A service event that asks to notify becomes a banner only when the agent needs a decision, failed,
  or warns — once per subject and cool-down (question 24 h, warning 12 h, failure 6 h), remembered
  across restarts; one warning from two instances of an agent is one banner. Deliveries, recoveries
  and plain notices go to Activity only. The banner names the agent and its instance, says what it
  wants in the subtitle, and opens the item on click.
- **Two instances read apart:** the sidebar, cards and banners name a non-default instance
  ("Example Agent · preview").
- **Less disk work:** a poll that brings no new event no longer rewrites the activity file (about
  1 MB, every 15 s per service); a failed write leaves no temporary file behind.

## 0.3.3 — 2026-10-01

- **Cold launch from MCP:** remove the MCP launcher’s `ELECTRON_RUN_AS_NODE` flag from the child that opens a dashboard. Previously macOS could accept a link while the closed app exited without a window. Existing-host routing, strict fallback and the MCP process environment are preserved.
- A process-boundary regression test reproduces the inherited flag before the fix and verifies its removal only in the dispatch child. [Release verification](docs/runs/2026-10-01-dashboard-links/README.md#cold-launch-correction--033).

## 0.3.2 — 2026-10-01

- **Dashboard routing:** MCP `host_status` checks the installed app, its version and the URL handler without opening a window. `open` targets that verified app; an installed-host failure returns an error instead of opening the dashboard in a browser.
- **Explicit fallback:** `fallback=never` prohibits browser opening. The default `if_absent` permits it only after confirmed app absence. Success means the OS accepted the request, not that the page has loaded.
- **Agent handoff:** MCP instructions identify `open_link` as the primary dashboard link. [SCN-028](docs/ux/scenarios.md) and [verification](docs/runs/2026-10-01-dashboard-links/README.md) cover host discovery, failure handling and repeated-link view reuse.

## 0.3.1 — 2026-10-01

- **Fixed: "not answering" no longer flaps under load.** A probe waits 5 s instead of 2 s. A
  service counts as not answering only after three probes in a row fail; a missed probe is
  re-checked after 5 s, and until then the last answer stands. The notification needs a probe
  that still fails after 60 s of silence (was 30 s), so a service that answers again before
  that sends neither "not answering" nor "is back". Activity still records each outage
  ([ADR-0008](docs/adr/0008-a-missed-probe-is-not-an-outage.md)).
- **License.** This is the first release under the GNU AGPL-3.0, with a commercial license
  from PassionCode.ai for use the AGPL does not cover (`AGPL-3.0-only OR
  LicenseRef-PassionCode-Commercial`, [ADR-0007](docs/adr/0007-agpl-or-commercial.md)).
  v0.2.0 and v0.3.0 stay PolyForm Noncommercial or Internal Use, and v0.1.0 stays MIT.

## 0.3.0 — 2026-09-30

- **Service links.** `fabric-dashboards://service/<id>.<instance>` opens that service in the app,
  and `?path=/…` one page of it — the link Fabric's "Open dashboard" opens. The MCP tools hand
  links out in this form; the 0.2.0 forms `open?service=…` and `open?url=…` still open. A
  malformed link, one that names a service not installed, carries extra parameters, a user,
  password or port, or points off the service's origin is refused with the reason
  ([ADR-0005](docs/adr/0005-service-links.md)).
- **MCP:** `open_link` is `null` for a descriptor that cannot be read, and an event whose link is
  not a path on the service gets no deep link instead of failing the whole `activity` call.
- **Shared with Fabric:** the code that reads services — descriptors, claim conflicts, launchd
  status, the health probe, the state precedence, one look at every service, the service link —
  is the workspace package `@passioncode-ai/fabric-service-host` (`packages/service-host`), with
  state-precedence test vectors every host runs. The app and its MCP server read through it;
  nothing a user sees changes ([ADR-0006](docs/adr/0006-shared-service-host-package.md)).
- **README:** a quick start a newcomer can follow — download, first run, `claude mcp add --scope
  user`, one tool call that proves the server answers.

## 0.2.0 - 2026-09-29

- **Links from agents open here.** `fabric-dashboards://open?service=<id.instance>&path=/…`
  (or `?url=http://127.0.0.1:<port>/…`) opens that page of an installed service inside the
  app, signed in, whether the app was running or not. A link to anything else is refused with
  the reason.
- **MCP server for agents.** `Contents/Resources/bin/fabric-dashboards-mcp` (stdio): list
  services with their state and links, open a page, start, stop or restart through launchd,
  run a service's doctor or update, read its recent activity. Tokens are never returned.
- **Fixed:** a notification clicked while the window was still loading could land on the
  overview instead of the item; the window now picks the waiting navigation up once it listens.

- **License.** From this release, Fabric Dashboards is source-available under
  `PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0`, with a
  commercial license on request (contact@passioncode.ai). Release 0.1.0 and every earlier
  commit, and the later commits up to and including `7fb699d`, stay available under MIT.
  Contributions are accepted under [CLA.md](CLA.md).

## 0.1.0 - 2026-09-28

First release of Fabric Dashboards: one window for every local agent service on the Mac
that speaks `fabric-service/0.1`.

- Finds services from the descriptors in the services folder, live, with no setup.
- Shows each service's real state: ready, degraded, not answering, off, two copies,
  another program on its port, a port conflict or an invalid descriptor.
- Starts, stops and restarts services through launchd only; Stop stays off after a
  restart of the Mac.
- Opens each service's dashboard inside the app, signed in with a one-time code, one
  live view per service.
- Activity: every service's events and the app's own observations in one feed.
- Notifications for outages, recoveries, duplicates and events a service marks for
  you, with per-service settings, quiet hours and a one-hour pause.
- Menu bar status, open at login, English and Russian, dark and light themes.
- Updates itself from signed releases.
