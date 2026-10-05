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
