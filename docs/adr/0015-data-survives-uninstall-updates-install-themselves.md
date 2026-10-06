# ADR-0015 — The person's data survives an uninstall, and updates install themselves

Status: accepted · 2026-10-05

## Context

On 2026-10-05 the operator asked for two guarantees before the final release:

1. Settings and connections must survive deleting and reinstalling the app, and nothing should be
   lost along the way.
2. Every copy a user downloads must keep itself current with no action: automatic updates on by
   default.

What 0.5.3 did, read from its source (`src/electron/main.ts`, `src/core/uninstall.ts`,
`src/electron/updater.ts`, `src/core/settings.ts`):

- **Settings → Uninstall removed all of the app's data** (`productDataPaths`): settings, per-service
  notification choices, quiet hours and the activity history. That is stricter than the lifecycle
  contract: LC-14 says uninstall removes what install added, and *`--purge` removes data* — data
  goes only on request.
- **The MCP entry and the login item were removed and never came back.** A reinstall left the
  agents without the `fabric-dashboards` server until someone ran `claude mcp add` again.
- **An MCP entry pointing at a moved or deleted copy stayed broken.** Dragging the app to the
  Trash and reinstalling it elsewhere (for example `~/Applications`) left Claude Code spawning a
  launcher that no longer existed.
- **A damaged `settings.json` silently became the defaults** (`readJson` fell back to `{}`).
- **Updates downloaded by themselves but installed only on quit or on Restart.** The app lives
  in the menu bar and is rarely quit, so a downloaded update could wait for weeks.
- **A copy run from the disk image or from Downloads could never update.** Squirrel replaces the
  bundle in place, and a translocated or read-only copy cannot be replaced. The failure surfaced
  only as Squirrel's own error text.

What already held, and stays:

- The **connections**, meaning each service's descriptor and token file, live in the services
  folder (`~/Library/Application Support/ai.passioncode.fabric/services`, owned by the services
  and by Fabric). No uninstall path ever touched them (`productDataPaths` does not name them;
  `test/lifecycle.test.ts`, *LC-14: uninstall names every directory…*).
- Dragging the app to the Trash removes nothing in `~/Library`, so a reinstall finds everything.
- `~/Library/Application Support` is in Time Machine's default backup set. `~/Library/Caches` is
  not, and the app keeps nothing there that it cannot rebuild.
- CI signs releases with the same Developer ID team as the copies already installed
  (`KJ35UYYL22`: the installed 0.4.1 and the `v0.4.1-rc.1` CI artefact read by `codesign -dvv` on
  2026-10-05), so Squirrel accepts a CI update over a locally signed copy.

## Decision

<a id="decision"></a>

1. **Uninstall keeps the person's data by default.** The confirmation has an unticked box, «Also
   delete my settings and activity history».
   - **Unticked:** after the app exits, everything in its profile except `KEPT_FILES` is removed:
     the Chromium profile, every service session (re-minted from the service's token on the next
     open), caches and logs. `KEPT_FILES` is `settings.json`, `settings.json.bak`, `activity.jsonl`,
     `activity-state.json`, `notified.json` and `restore.json`.
   - **Ticked:** the full purge of 0.5.3.
   - In both cases the login item and the MCP entries are removed, and the app goes to the Trash.
2. **A reinstall puts back what the uninstall removed.** An uninstall that kept the data writes
   `restore.json`: whether the login item was on, and every MCP entry it removed, with its scope.
   The next packaged launch then:
   - registers the login item once. A refusal is logged and not retried, because LC-07 never
     registers on every launch;
   - restores each MCP entry, pointed at this install's launcher. A scope where the person added
     their own entry keeps theirs, and a project scope that no longer exists is skipped. If
     `~/.claude.json` cannot be edited, the entries are retried on the next launch.
3. **Every packaged launch repairs a broken MCP entry of ours.** An entry whose launcher file is
   gone is pointed at this install's launcher. A development entry (`node …/server.js`) and other
   servers are never changed.
4. **Settings keep their last good copy.** Each save writes `settings.json`, then
   `settings.json.bak`.
   - A `settings.json` that cannot be read is moved aside as `settings.json.unreadable-<ms>`,
     restored from the copy, written back, and the log says so.
   - When both copies are damaged, the defaults are used, and the log says that too.
5. **Updates install themselves, on by default.** The new setting **Install updates
   automatically** (`autoUpdate`) is on in `DEFAULT_SETTINGS`. A file from an earlier version,
   which has no such key, reads as on.
   - **The install:** once an update is downloaded and the window has been hidden for
     `UPDATE_IDLE_MS` (10 min), with no `doctor` or `update` command running, the app installs it
     and relaunches in the menu bar. Before quitting it writes the marker `.relaunch-hidden`; a
     marker younger than 10 min makes the next start hidden.
   - **What never triggers it:** a visible window, or a command in flight. A busy app retries a
     minute later.
   - **With the setting off:** the update installs on quit or on Restart, as in 0.5.3.
   - **Checking and downloading:** these stay always on, at start plus 10 s and every 6 h.
6. **A copy outside Applications says why it cannot update, and offers to move.** The updater
   reports `misplaced` and downloads nothing. The first visible launch asks once (LC-07)
   «Move Fabric Dashboards to Applications?». After that, Settings → Updates and the sidebar
   footer offer **Move to Applications** (`app.moveToApplicationsFolder`).

## Consequences

- An uninstall leaves at most six small files under `~/Library/Application Support/Fabric
  Dashboards/`, until the person deletes them with the box ticked or by hand. This trade is the one
  the operator asked for, and it matches LC-14.
- 0.5.3 and earlier copies have no automatic install. They download the update that carries this
  change and install it at their next quit or Restart. From then on, updates install by themselves.
- No end-to-end test of the Squirrel install exists. It needs two signed releases. The decision
  logic is tested pure (`autoInstallNow`, `relaunchHidden` in `test/lifecycle.test.ts`). The first
  release published after this one is the field proof, recorded in `docs/HANDOFF.md` (FD-16).
- Tests: `test/lifecycle.test.ts` (*LC-14/ADR-0015* and *ADR-0015* tests: keep-mode purge, kept
  list against the files the stores write, MCP restore and repair, restore record, auto-install
  rules), `test/parts.test.ts` (settings recovery, `autoUpdate` default), `test/e2e/app.test.ts`
  (Settings → Updates).

## Amendment — 2026-10-07: LC-16 in detail (0.6.1)

<a id="lc-16"></a>

The organization fixed how every product updates itself — the
[lifecycle contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md),
*LC-16 in detail* (fabric-workspace #57). Point 5 above changes to match it; points 1–4 and 6 stand.

- **The switch is a file, not a setting.** `auto-update` in the app's data folder: absent means on,
  only `off` means off. The app writes it only when the person turns the switch; an update, a
  reinstall and an uninstall never write it, and even the full purge keeps it (`ALWAYS_KEPT`,
  `src/core/uninstall.ts`). A 0.6.0 `settings.json` with `autoUpdate: false` is carried over to
  `off` once (`carryOverAutoUpdate`, `src/core/autoupdate.ts`). The label is the organization's:
  **Install updates automatically** / «Устанавливать обновления автоматически».
- **Off stops everything automatic** — no check, no download, no install. «Check for Updates…»
  always works (`mayCheck`, `src/core/version.ts`). This replaces "with the setting off: installs on
  quit or on Restart".
- **Cadence:** the first check 90 s after start (`FIRST_CHECK_MS`), then every 6 h while the process
  runs (`CHECK_EVERY_MS`) — the resident-app reading of LC-16, since a menu-bar app is rarely
  started anew. After a failed check, one retry within the hour (45 min), then the 6-hour rhythm.
- **Nothing reaches Squirrel unverified.** The feed URL is pinned in the code; no environment
  variable overrides it. Before `autoUpdater.checkForUpdates()` the app itself, in the main process
  (`src/electron/updater.ts`, `src/core/release-verify.ts`):
  1. reads the feed, and goes on only for a strictly newer version whose feed names a file of its
     own release and nothing else (`feedNamesOwnRelease`);
  2. downloads that release's `SHA256SUMS` and `SHA256SUMS.asc` and verifies the signature against
     the organization's release key, pinned in the code (ed25519, fingerprint
     `63b30dc324bd697487aa31944fafb8aec803b6a7`, `passioncode-ai/.github` `release-signing/`);
  3. downloads the zip, compares its sha256 with the one the signed `SHA256SUMS` names, unpacks it
     with `ditto`, and requires `codesign --verify --deep --strict`, team `KJ35UYYL22` and the
     announced version (`stagedRefusal`); it records the code-directory hash.
  Squirrel then downloads and stages the update itself. On `update-downloaded` the staged bundle
  (`ShipItState.plist` → `updateBundleURL`) must carry the same code-directory hash and version;
  otherwise the state file and the bundle are removed before any quit, and the check reports
  `signature_failed`. Squirrel's own downgrade guard is on too (`ElectronSquirrelPreventDowngrades`
  in `Info.plist`, read back by the release build).
- **A release that needs a person** (`needsPerson` in the feed, an `https` address of its steps) is
  downloaded and verified but held: the window shows «Update X is verified and waits for you», a
  «What to do» button that opens those steps (the address comes from the verified feed in the main
  process, never from a page), and «Install». The timer does not download a held release again.
- **Activation only at a safe point**, as before: quit, Restart to Update, or the window hidden
  10 minutes with no command or console session running.
- **Log events, by the organization's codes** (`main.log`): `update_check` (`current`, `ready`,
  `check_failed`, `download_failed`, `signature_failed`, `needs_migration`), `update_download`
  (`started`, `done`), `update_install` (`started`, and `installed` on the first start of the new
  version, from `.last-version`), `update_restart` (`requested`, `refused`), `auto_update` (`on`,
  `off`, at start and on every change).
- **Tests:** `test/parts.test.ts` — *LC-16* cases: the switch stops automatic checks and a held
  release, a manual check always runs; a tampered `SHA256SUMS`, one signed by another key, another
  team, an unsigned bundle, an older or a different version are refused, the announced newer one
  passes; the real v0.6.0 `SHA256SUMS` verifies (`test/fixtures/release-0.6.0/`); the switch file,
  its carry-over and its place on both kept lists. `test/dist.test.ts` — openpgp staged; the release
  build's `checks.updateVerifier` proves the finished bundle verifies v0.6.0's signature and refuses
  one changed byte. No end-to-end Squirrel install runs in CI (two signed releases needed): 0.6.0 →
  0.6.1 is the field proof, recorded in `docs/HANDOFF.md`.
