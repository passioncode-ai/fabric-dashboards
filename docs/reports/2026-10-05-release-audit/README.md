---
report:
  id: fabric-dashboards/2026-10-05-release-audit
  title: "Release audit of 0.5.5: every screen and scenario, code, architecture — the fix list"
  kind: audit
  project: fabric-dashboards
  domains: [security, reliability, ux, i18n, release, documentation]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-11-05
  summary: >-
    The operator asked on 2026-10-05 to check every screen and scenario, the code, the
    architecture and the interface before the release, to fix the list task by task and to say
    what went into the release and what did not. The audit had four read-only reviews (SCN-001…023,
    SCN-024…045, the main process, architecture/MCP/release/docs) and a live walk of every screen
    in an isolated profile. About 110 findings were merged into the tasks below.
  sources:
    - name: "Live walk: every screen of the built app against the kit's sample service (scratchpad screenshots, not kept)"
      url: "scripts/screenshots.ts"
      read_at: 2026-10-05
---

# Release audit of 0.5.5 — the fix list

Commit audited: `b8bdf57` (`main`, version 0.5.5, untagged). The v0.5.4 run (37307011716) was
cancelled before publish: 0.5.5 becomes the release, so that 0.5.4 can never be published after
0.5.5 and pull installed copies back (the version guard runs at the start of a run, not at publish).

How the audit worked:

- **Four read-only reviews.** Scenarios SCN-001…023, scenarios SCN-024…045, a defect hunt in the
  main process, and architecture with MCP, release and docs drift. Each finding came back with
  `file:line` and a concrete trigger. The reviewers confirmed the token findings with a script.
- **A live walk** of every screen in a throwaway profile, against the kit's sample service. The
  services covered every state: ready, degraded, not answering, port conflict, invalid. The walk
  covered the empty state with the first-run card, Overview, Activity, Spend (collapsed and
  expanded), and Settings. Its findings are D-1 (a down agent reads as reporting or as not
  reporting) and U-11 (the Updates section's spacing).
- One reviewer point was **checked and rejected**: `wasOpenedAtLogin` is documented for macOS in
  Electron 44 (`electron.d.ts:1261`), so a login launch stays hidden.

Status: **fix** — fixed in 0.5.5, with its commit in the *Done* column; **later** — moved to
the backlog with a reason.

## Security — a token or a login code where it does not belong

| ID | Finding | Evidence | Plan |
|---|---|---|---|
| S-1 | Spend sends a service's token to whatever answers on its port. The snapshot of a `foreign` service keeps the squatter's well-known document, and `readSpend` reads any `surfaces.usage` it declares. MCP `spend` does the same. | `src/core/spend.ts:23-28`, `src/mcp/tools.ts:300`, `src/core/monitor.ts:582`; confirmed by script | fix |
| S-2 | An online origin that answered as another service still gets the token on every probe. `reason.remote.foreign` promises it does not. | `src/core/monitor.ts:302-304` | fix |
| S-3 | A failed login load returns Electron's message `… loading '<url>'`. That URL carries the one-time `?code=`, and it is shown in the sign-in error. | `src/electron/views.ts:149-151`; format string confirmed in the Electron 44.4.5 binary | fix |
| S-4 | A dashboard can be loaded off its origin. `resolveLink` accepts `/\host/x`, `navigate('home')` concatenates `origin + dashboard.path` (`@evil/`, `.evil/`), and MCP `dashboard` builds the same string. | `src/electron/policy.ts:54-57`, `views.ts:251`, `src/mcp/tools.ts:110`; node checks | fix |
| S-5 | A `foreign` snapshot shows the squatter's version, tiles, Tools, summary and update offer as the service's own. Update then runs the service's own update command on the squatter's claim. | `monitor.ts:582`, `Overview.tsx`, `ServiceView.tsx`, `tools.ts:96-117` | fix |

## Data — a number that is not true

| ID | Finding | Evidence | Plan |
|---|---|---|---|
| D-1 | An agent that reported spend and then went down, stopped or refused the token drops to "Not reporting spend yet". The totals lose their «≥»: unknown spend reads as zero. | `spend.ts:25`, `monitor.ts:364` | fix |
| D-2 | A usage row with `calls > 0`, `unpricedCalls: 0`, `costUsd: null` is accepted and not marked partial. A row with `calls: 0`, `costUsd > 0` is accepted and then zeroed. | `packages/service-host/src/usage.ts:69,109-115,141` | fix |
| D-3 | The strip prints `toFixed(2)`, so $0.004 reads $0.00 (Spend says <$0.01). Its spend cells are disabled when every agent failed, and it is read once per visit. | `Overview.tsx:188-200` | fix |
| D-4 | Refresh on Spend within 30 s returns the cached sums, and "read at" is the renderer's clock. | `main.ts:362-372`, `Spend.tsx:18-25` | fix |

## Reliability — a feature that silently stops

| ID | Finding | Evidence | Plan |
|---|---|---|---|
| R-1 | A full disk switches off outage alerts. `ActivityStore.append` throws ENOSPC into the monitor, which leaves `downNotified` stuck and skips notifications, cursors and removals. Short writes leave torn lines. | `activity.ts:71-82`, `monitor.ts:379-421,464,500,556` | fix |
| R-2 | On a full disk the app can start as a zombie. The store constructors and `settings.update` throw before the crash handlers are installed, after the single-instance lock is taken. | `main.ts:76,80,292,525,540` | fix |
| R-3 | `quitting = true` is set before calls that may not quit (`updater.restart` when nothing is ready, a failed `quitAndInstall`, a false `moveToApplicationsFolder`). Closing the window then quits the app, and a stale relaunch marker opens the next launch hidden. | `main.ts:128,313-316,422` | fix |
| R-4 | `will-quit` fires `killOwned` without waiting, so a command that ignores SIGTERM survives Quit (LC-01/LC-02). | `main.ts:455-461` | fix |
| R-5 | Opening a link on an already loaded view awaits `loadURL` without a catch. The IPC call rejects, "Opening…" spins forever, and the previous service's page can stay on screen. | `views.ts:171-173`, `ServiceView.tsx:112` | fix |
| R-6 | After a sign-in error or a crash, Retry/Reload never re-attaches the view: a blank pane. Every failed load reads "Cannot sign in". The overlay and the "service restarted" bar are drawn under the attached page, so they are invisible. | `views.ts:99-101,226-232`, `ServiceView.tsx:115-158` | fix |
| R-7 | A route's `link` is reapplied on every remount (tab switch, Stop dialog, flapping state), which throws away where the person navigated. | `ServiceView.tsx:108-118` | fix |
| R-8 | `control()` and `command()` have no busy guard, so a double click runs two kickstarts. A Restart from the app never emits `restarted`, and a pid change between probes is missed. | `monitor.ts:377-397,489,535,543` | fix |
| R-9 | `resumePath` does not exclude `/fabric/v1/login`, so a re-sign-in can reload an already used code URL. | `policy.ts:136-145` | fix |
| R-10 | The auto-install's busy retry bypasses the 10-minute grace and can stack. | `main.ts:123` | fix |
| R-11 | The uninstall removes the login item before the MCP entry. A failure then reports "Nothing was removed" with the login item already gone. | `main.ts:235-249` | fix |
| R-12 | Notification objects are not kept, so a click can be lost after garbage collection (long-standing Electron behaviour). | `main.ts:207-212` | fix |
| R-13 | View events go to a hidden window (LC-08). | `main.ts:175`, `views.ts:94-98` | fix |
| R-14 | A link from a second launch that arrives before the first scan is dropped. | `main.ts:448-451` | fix |
| R-15 | `showPath` opens a `.app` data path instead of revealing it. | `main.ts:404` | fix |
| R-16 | `lsof` exits 1 when nothing listens, which reads "Cannot list listeners". | `listeners.ts:28` | fix |
| R-17 | The descendants of an exited command outlive the deadline and Quit (LC-02). | `children.ts:84-91` | fix |
| R-18 | A never-probed launchd service reads "Off — not loaded" with Start for up to 5 s, including on a cold-start deep link. | `monitor.ts:276`, `state.ts:54-55` | fix |
| R-19 | An online TLS or redirect refusal waits three misses instead of being down at once. | `monitor.ts:342-347,364` | later — ADR-0008's grace is shared with local probes; changing it needs the state vectors Fabric runs (ADR-0006) |
| R-20 | Uninstalling while an update is downloaded may let Squirrel put the trashed bundle back. | `main.ts:252-273` | later — unverified; needs a signed two-release test (FD-16) |

## Interface — what a person sees

| ID | Finding | Evidence | Plan |
|---|---|---|---|
| U-1 | Needs attention drops a row while it restarts (no "Restarting…"). After a failure it shows neither the failure sentence nor Logs. The header failure has no Logs button. | `Overview.tsx:42-76`, `ServiceView.tsx:63-65` | fix |
| U-2 | doctor/update: no catch, the spinner never stops; Update reads "Running doctor…"; update output stays hidden because only doctor switches to Health; the attention row throws output away. | `ServiceView.tsx:36-42,220`, `App.tsx:62` | fix |
| U-3 | Unreadable services folder: no Retry. A `showPath` failure is an unhandled rejection with no inline message. | `Overview.tsx:47-64`, `main.ts:398-406` | fix |
| U-4 | A conflict view shows only its own descriptor path. | `ServiceView.tsx:78` | fix |
| U-5 | `fabric-dashboards://` (overview) only brings the window forward. | `main.ts:513`, `App.tsx:28-31` | fix |
| U-6 | "Move to Applications" ignores failures. | `App.tsx:158`, `Settings.tsx:142`, `main.ts:310-322` | fix (with R-3) |
| U-7 | Tray: "All services ready" while one is degraded or off; items use the descriptor name; a pause set in Settings never rebuilds the tray. | `tray.ts:57-76` | fix |
| U-8 | Activity: the filter resets on every visit, new app events do not appear while open, unread grows while you read. | `Activity.tsx:9-14` | fix |
| U-9 | The feed error stays stale when the feed is skipped (down, foreign). | `monitor.ts:448` | fix |
| U-10 | The notification-permission notice can never show: `Notification.isSupported()` is not a permission. | `main.ts:425` | fix — replace it with a plain "macOS notification settings" button; Electron has no permission query on macOS |
| U-11 | Settings → Updates: the explanation and the state line sit far apart (two paragraphs with margins). `update.ready` with no version reads "Update  ready". | live walk 04-settings; `App.tsx:157` | fix |
| U-12 | Russian UI: English literals (Health `origin`/`launchd`/`disabled`, listener table headers, `doctor`/`update` in result lines, a menu label), dates without the app language, wording (ru «За последние 31 день», «Читаю…», `tray.problems` "1 need", ru "Копировать ссылку"). | `ServiceView.tsx:39,213-215`, `Settings.tsx:127`, `main.ts:437`, `i18n.ts` | fix |
| U-13 | Machine-written reasons (descriptor problems, token refusals, feed/usage/link errors) are English in the Russian UI. | `descriptor.ts:55-109`, `health.ts`, `probe.ts`, `deeplink.ts` | later — needs reason codes in `@passioncode-ai/fabric-service-host`, shared with Fabric (ADR-0006) |
| U-14 | Accessibility: tabs without tabpanel or arrow keys; the card's `aria-label` hides its content; attention buttons do not name their service; spinners without text; no `role="alert"` on overlays; the Stop dialog does not hold focus. | `ServiceView.tsx:81-85`, `Overview.tsx:70-75,133`, `App.tsx:122-133` | fix (all but the dialog focus trap: later, needs a dialog component) |
| U-15 | Duplicate restart always ends with "did not come back within 40 s" and never names the stray pid. | `monitor.ts:509-540` | fix |
| U-16 | A misnamed descriptor collides with the real one's key; a half-written file flashes Invalid and logs "installed". | `descriptor.ts:136-146`, `monitor.ts:267-281` | later — low impact; the installers write atomically |
| U-17 | `open?service=`/`open?url=` accept extra parameters and ignore a fragment. | `deeplink.ts:51-57` | fix — the scenario is narrowed to the forms; extra parameters refused like the `service/` form |
| U-18 | Restart-to-update does not reopen on the same screen. | `main.ts:422` | later — Overview is a sane landing; needs route persistence |
| U-19 | Several-events notification opens Activity unfiltered (SCN-020 says filtered). | `main.ts:210` | fix |

## MCP, architecture, release

| ID | Finding | Evidence | Plan |
|---|---|---|---|
| M-1 | `doctor` is marked `readOnlyHint: true` but runs an executable. | `src/mcp/server.ts:92` | fix |
| M-2 | `activity` errors surface as "internal error". `update` describes a restart it does not check. Extra arguments are accepted. | `tools.ts:293`, `server.ts:96,140` | fix |
| M-3 | The control and command loop exists twice (app and MCP) and has diverged: MCP lacks the missing-plist check. | `tools.ts:245-280` vs `monitor.ts:489-561` | fix the plist check; the shared module is later (a refactor of both callers with their own tests) |
| M-4 | `productIdOf` (ADR-0012 grouping) lives in the app, not the shared package. | `src/core/products.ts:25` | later — Fabric has not asked for it |
| F-1 | The version guard runs at the start of a run, publish happens hours later, and the concurrency group is per tag. An older run's publish can overtake a newer release and pull installed copies back. | `release.yml:30-64`; org `release-publish.yml:153` | fix — one global concurrency group and the guard repeated right before publish |
| F-2 | The guard treats a failed `gh api` call's output as a tag. | `release.yml:59` | fix |

## Documentation drift

The README version line, CHANGELOG ("first published" for unpublished versions), HANDOFF and
backlog (FD-09, FD-11, FD-13/14 "ships in 0.5.3"), scenario coverage paths (`src/core/descriptor.ts`,
`src/core/state.ts`, `test/remote-e2e.test.ts`), `docs/ux/screens.md` (no Spend screen, no
SCN-033…045 elements, Uninstall "removes data"), `SECURITY.md` (talks only to 127.0.0.1),
ADR-0006/package README/AGENTS ("reads no token"), ADR-0004 (tool list), `CONTEXT.md`
(local-only service), SCN-028 (spend, online refusal) and the "nothing is read while Spend is
closed" claims (ST-015, AGENTS lifecycle row) — all fixed in the final documentation pass.

## Done

| Commit | IDs |
|---|---|
| `d408450` | S-1, S-2, S-3, S-4, S-5, D-1, D-2, R-5, R-6, R-7, R-13 |
| `7048ef2` | R-1, R-2, R-3, R-4, R-8, R-9, R-10, R-11, R-12, R-14, R-15, R-16, R-17, R-18, U-1, U-2, U-3, U-4, U-5, U-6, U-7, U-8, U-9, U-10, U-11, U-12, U-14 (except the dialog focus trap), U-15, U-17, U-19, D-3, D-4, M-1, M-2, M-3 (the plist check), F-1, F-2 |
| `37dadc8` | live walk after the fixes: opening Spend reads now (the strip's 30-second cache showed a stopped agent as reported); Health labels share one case |
| docs commit (this pass) | the documentation drift list above |

Moved to the backlog with their reason: R-19, R-20, U-13 (FD-19), U-16, U-18, the U-14 focus
trap, M-3's shared module (FD-20), M-4 (FD-21).

Checks after the fixes: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (226 tests pass, 1 skipped = the
launchd test, 7/7 when run unskipped); `npm run test:e2e` 6/6; a second live walk of every screen
(the 17 screenshots were checked one by one; not kept in the repository).

## Second pass — 2026-10-06

The operator asked for a second walk of every scenario, the whole interface and MCP, with
documentation mismatches. Of the planned reviews, only the scenario/screen/story review finished;
three hit the subagent spend limit. Their work was done directly instead: a live walk of every MCP
tool against sample services, a Russian walk of every screen (`FD_TEST_LANG=ru`), and a review of
the riskiest audit fixes.

| ID | Finding | Done |
|---|---|---|
| W-1 | The app's own Spend reasons were English in the Russian UI | `11cec37` |
| W-4 | Russian strip labels were cut | `11cec37` |
| P-1 | An online HTTP 5xx read as "Wrong program on port" ("port 0") | `0159af9` (+3 shared state vectors) |
| P-2 | Activity rows and action results did not name the instance | `0159af9` |
| P-3 | MCP `spend` called a silent service "not reporting" | `0159af9` |
| P-4 | A command that could not start read "exit code —" | `0159af9` |
| P-5…P-16 | sign-in stage, path errors, service Activity refresh, online down notification, update when degraded, login approval wording, Russian grammar, token reason, a11y labels, crash counter reset, header result expiry, a dead key | `0159af9` |
| M2-1…M2-3 | MCP: instance names, link wording, a command that cannot start | `812950a` |
| — | The update check could stick at "Checking…" on a feed that never answers | `812950a` |
| docs | scenarios.md (all 45, Last audit 2026-10-06), screens.md (Spend, Sidebar, System dialogs), foundation, ADR-0004/0006/0011 amendments, package README, CONTEXT.md, README MCP | `4cf8863`, `9567a74`, this change |

Still later: FD-19 (machine reasons translated, with Fabric), FD-20 (one control module), FD-21
(small leftovers), FD-22 (A2A surface, after the contract decision; roadmap RM-17).

## Third pass — 2026-10-06, open (fix list for 0.5.6)

Four read-only reviews of `b8bdf57..eedb0e6` (main process; monitor/spend/MCP; renderer/i18n;
docs and release.yml). Gate at `eedb0e6`: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (234 tests,
233 pass, 1 skipped); `npm run test:e2e` 6/6 once the Electron binary is installed. Started:
`RemoteTokenLatch` in the shared package (`packages/service-host/src/latch.ts`, tested, **not yet
wired**). Everything else below is open.

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| T-1 | MCP `activity` sends the token to whatever answers on the port; `withDashboard` builds `http_url` from a squatter's dashboard path | `src/mcp/tools.ts:186-197,291-304` | refuse when `doc.service.id/instance` differ |
| T-2 | A remote origin answering non-protocol (404, HTML) gets the token every probe; `reason.remote.protocol` says "Nothing is sent to it" | `monitor.ts:349-353`, `i18n.ts:41,332` | wire `RemoteTokenLatch` into the monitor (replaces `remoteForeignFor`), `lookAtServices` (option) and MCP `probe()` |
| T-3 | Re-sign-in on a 401 uses the view's creation-time snapshot and POSTs the token to whatever now holds the port | `src/electron/views.ts:56-67,115-122,137-146` | read the current snapshot by key; refuse when `foreign` or no well-known |
| T-4 | The MCP server has no S-2 latch: every call re-sends the token to a foreign remote | `look.ts:73-82`, `tools.ts:239-248` | T-2's latch, one per MCP process |
| T-5 | Remote pid change reports `restarted` on every replica switch (R-8 regression) | `monitor.ts:395-398` | detect pid change only for local placements |
| T-6 | A command killed by a signal reads "could not run" (P-4/M2-3) and MCP drops its output | `children.ts:83`, `monitor.ts:591`, `tools.ts:287` | record `spawn` and `signal` in `runOwned` |
| T-7 | MCP `spend` treats `stopped` as not reporting ($0) | `tools.ts:320` | drop `stopped` from the exclusion |
| T-8 | `open/anything?service=` and an empty `url=` are accepted (U-17) | `deeplink.ts:46-64` | refuse a path; use `has('url')` |
| T-9 | MCP arguments of the wrong type are ignored silently | `server.ts:124-140` | refuse a present argument of the wrong type |
| T-10 | A page crashing after each load reloads forever (P-14 resets `crashes` on load) | `views.ts:96,106-110` | reset only on a fresh show |
| T-11 | `resume()` drops a failed `show()`: blank pane, no Retry | `views.ts:230-236`, `main.ts:160` | emit `error` when `!r.ok` |
| T-12 | Leftover group kills are not counted: a child can outlive Quit within 2 s | `children.ts:74-77`, `main.ts:519` | keep the group in `owned` until `killGroup` resolves |
| T-13 | `shownNotices` grows for the life of the app (`close` not guaranteed) | `main.ts:242-251` | cap ~50 |
| T-14 | `loaded` view events still reach a hidden window (R-13) | `main.ts:200` | filter like `navigated` |
| T-15 | Uninstall says "Nothing was removed" after the MCP entries were removed | `main.ts:283-292` | a message naming what was removed |
| T-16 | R-7 not fixed: the applied-link ref lives in `DashboardHost`, which unmounts on a tab switch | `ServiceView.tsx:41,129,148,160-161` | keep it in `ServiceView`/`Shell` or drop `link` from the route after a good show |
| T-17 | R-6 partial: showing again after error/crash re-attaches the dead page | `ServiceView.tsx:156-173`, `views.ts:186-196` | reset `loadedOnce` on fail/crash |
| T-18 | `stopKey` not cleared when its service disappears; dashboards stay hidden, the dialog pops up later | `App.tsx:74,126,141` | `overlayOpen={stopOpen}`; clear a dangling key |
| T-19 | The 30-minute expiry of a failed action never re-renders | `Overview.tsx:48`, `ServiceView.tsx:91` | a timer to the earliest expiry |
| T-20 | Logs offered for remote services that have no Logs tab | `Overview.tsx:87-89`, `ServiceView.tsx:94` | gate on `placement !== 'remote'` |
| T-21 | U-14: after a confirmed Stop focus drops to `body`; Escape dead once focus is on `body` | `App.tsx:81-86,142,148` | focus a stable target; document keydown while open |
| T-22 | Strip shows "≥ $0.00" when every agent failed | `Overview.tsx:221-222` | show unknown when no report |
| T-23 | The update can run again after a remount (ref in `ServiceView`) | `App.tsx:126`, `ServiceView.tsx:44-47` | consume the request in the route |
| T-24 | `<h3 role="status">` loses its heading role | `ServiceView.tsx:277` | role on an inner span |
| T-25 | Network/token Spend errors stay English in the Russian UI | `spend.ts:39-43`, `probe.ts:51` | `spend.err.unreachable` |
| T-26 | ru wording «…её отчёт не читается» | `i18n.ts:360` | «…поэтому отчёт о расходах сервиса не читается» |
| T-27 | Activity filter keeps a removed service's key | `Activity.tsx:187,207` | reset when absent |
| T-28 | `npm ci && npm run check && npm run test:e2e` fails: Electron 44 downloads its binary lazily and the e2e files race to unpack it | `package.json` `test:e2e` | run `install-electron` before the tests |
| T-29 | release.yml `publish` uses `always()`; rehearsal artifact has no `retention-days` though RUNBOOK says 14 | `release.yml:124-132,160` | `!cancelled()`; `retention-days: 14` |
| T-30 | Docs: report/handoff/backlog still say U-14 trap is later; "53 fixes"/"8 items" counts; FD-16 "0.5.4 copy"; HANDOFF stream rows (Spend, adapter, v0.5.5); AGENTS "D-8 in HANDOFF" (it is in `docs/evidence/briefs/2026-09-28-brief.md:67`); shared package still 0.3.0 after state/usage changes; SCN-009 lacks the focus behaviour; RUNBOOK lacks the global `release` queue and `still-newest`; SECURITY.md omits Finder opens; README tool count without "`spend` from 0.5.5" | docs review | correct in the release change |
