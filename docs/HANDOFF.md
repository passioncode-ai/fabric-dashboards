# Handoff — Fabric Dashboards

Updated 2026-10-07 (0.6.2: 0.6.1 withdrawn for audit HIGH-2, audit fixes, signed feed; 0.6.1: LC-16 in detail updater, Russian by choice; 0.6.0 published 2026-10-06 21:35 UTC; release 0.5.6: third review pass, token latch; release 0.5.5 withdrawn: release audit and its second pass, A2A plan, ADR-0016, ADR-0015 data and updates, FD-05, FD-06, FD-13; Spend and DEC-0021; one entry per agent, ADR-0012; lifecycle contract landed from PR #21, unreleased; CI release rehearsal
`v0.4.1-rc.1` green; releases move to CI signing; release 0.4.1, MCP links to online services).

Current release: 0.6.6 (published 2026-10-09 10:08 UTC, run 37864378854; FD-34, FD-35). Before it, 0.6.5 (published 2026-10-08 01:18 UTC, run 37703405621; FD-29, FD-33). Before it, 0.6.4 (published 2026-10-07 01:57 UTC, run 37558793926; carries 0.6.3, superseded before approval). Before it, 0.6.2 (published 2026-10-06 23:41 UTC, run 37541067349; 0.6.1 withdrawn). Before it, 0.6.0 (published 2026-10-06 21:35 UTC, run 37505569449); Before it, 0.5.6 (2026-10-06); the 0.4.1 section below is the previous one. Earlier releases below are preserved as dated evidence.

## Next — start here (2026-10-09, after 0.6.6)

**Released: 0.6.6 on 2026-10-09 10:08 UTC** (run 37864378854, tag `v0.6.6` on `27699db`; Latest; the
operator approved both gates). Receipt: Developer ID (KJ35UYYL22), `accepted and stapled: app, update
zip, image`, fuses `100011011` on every slice, `checks.pty`, `checks.updateVerifier`,
`checks.downgradeGuard`, MCP `initialize` as 0.6.6. Published files checked as the updater checks them
(`src/core/release-verify.ts` on the downloads): `SHA256SUMS` signature ok, `signedFeed` ok, zip hash
matches, `codesign --strict` ok, team `KJ35UYYL22`, stapled, `spctl` accepted (Notarized Developer
ID); attestations of the zip and the image verify with `--signer-repo passioncode-ai/.github`; the
`latest` feed names 0.6.6.
**Field:** this Mac's 0.6.5 installed 0.6.6 by itself at 10:40:36 UTC (`update_install installed
from=0.6.5 to=0.6.6`); its first estate check logged `skills=current latest=1.54.2` (FD-34 reads the
family's runtime). FD-29's local feed: Squirrel took the verified 230 MB zip in 2.8 s after the app's
own 33 s download (backlog FD-29). **Open:** FD-07's CPU/RSS measurement on a build carrying the
lifecycle changes (AGENTS.md *Idle budget*); FD-02 scenario review; FD-04 cookie encryption.
Outside this repository: Switchboard's Windows installer stays unsigned until the operator's Azure
identity validation completes (fabric-switchboard `docs/DISTRIBUTION.md`).

## Earlier — start here (2026-10-09, release 0.6.6)

**Release 0.6.6 — branch `agent/release-066`:** FD-34 (the skills watch only where the family is
installed) and FD-35 (a hidden window always hides its Dock icon). Checks: `npm ci`;
`FD_SKIP_LAUNCHD=1 npm run check` exit 0 (330 tests, 329 pass, 1 launchd skip; brand, regions, UX lint); `npm run test:e2e` three full runs on an
unlocked screen: 7/7, 7/7, 7/7. **Next task:** the operator's approvals of the release run, then the
receipt, the published files checked as the updater checks them (RUNBOOK, with `--signer-repo` for
attestations), the knowledge base row, and this Mac's 0.6.5 → 0.6.6 update — FD-29's field proof:
the first update downloaded by a 0.6.5+ copy goes through the local `file://` feed.
**Before it, on 2026-10-09:** a disk cleanup outside this session removed `node_modules`, `out/`,
`release/` and the tracked `build/` (9 files: tray icons, `icon.icns`, entitlements, the MCP launcher)
from this checkout; `build/` was restored from git and `npm ci` reinstalled. The same sweep left
deleted tracked files in other `~/DATA` repositories (`vendor/`, `third-party/`, `build/`); those are
not this repository's to restore.

## Earlier — 2026-10-09

**Field, 2026-10-08:** the operator's copy installed 0.6.5 at 11:25 UTC (`update_install installed
from=0.6.4 to=0.6.5`); its estate checks since log `estate_check ok` — FD-33's field proof. FD-29's
local feed is proven by the first update a 0.6.5+ copy downloads (0.6.6).
**FD-25 done 2026-10-09:** Switchboard restarted to 0.6.14 (22:10 UTC) and the in-place proof exited 0
(`2.1.295 (Claude Code)` through `switchboard launch … --in-place -- --version`); backlog FD-25 has
the detail. **Next task:** three full `npm run test:e2e` runs on an unlocked screen at a normal load
(on 2026-10-09 00:18 local the screen was unlocked but the load was 262), then bump 0.6.6 (FD-34,
FD-35), release, verify as for 0.6.5. Outside this repository: Switchboard's Windows installer is
unsigned until the operator's Azure identity validation completes (fabric-switchboard
`docs/DISTRIBUTION.md`, PRs #126/#127).

## Earlier — start here (2026-10-08, after 0.6.5)

**Released: 0.6.5 on 2026-10-08 01:18 UTC** (run 37703405621, tag `v0.6.5` on `518cb63`; Latest; the
operator approved). Receipt: Developer ID (KJ35UYYL22), `accepted and stapled: app, update zip,
image`, both Gatekeeper checks `accepted, source=Notarized Developer ID`, fuses `100011011` on every
slice, `checks.pty`, `checks.updateVerifier`, `checks.downgradeGuard`, MCP `initialize` as 0.6.5.
Published files checked as the updater checks them (`src/core/release-verify.ts` run on the
downloads): `SHA256SUMS` signature ok, `signedFeed` ok, zip hash matches, `codesign --strict` ok,
team `KJ35UYYL22`, `spctl` accepted; attestations of the zip and the image verify with
`--signer-repo passioncode-ai/.github` (signer `release-publish.yml@refs/tags/v1`, ref
`refs/tags/v0.6.5`) — the RUNBOOK command lacked that flag and is fixed; the `latest` feed names
0.6.5 (`currentRelease`).

**Unreleased on `main` — FD-34 (PR #48, another session) and FD-35** (branch `agent/fd35-dock`). FD-34:
the skills watch runs only where `~/.sshlg-skills/runtime/package.json` exists and reads the installed
version from it (backlog FD-34, ADR-0018). FD-35: `DockSync` (`src/electron/dock.ts`) — Electron drops a Dock hide within 1 s of a show
(`browser_mac.mm:441-504`, v44.4.5), so the hide is asked again until it takes. Checks:
`FD_SKIP_LAUNCHD=1 npm run check` exit 0 (329 tests, 328 pass, 1 launchd skip; brand, regions, UX lint); `test/dock.test.ts` 6/6.
Full e2e on 2026-10-08 ran on an overloaded machine (load
69–234, swap 16.6/17.4 GB): 7/7, 6/7, 5/7 — the failures were a 30 s timeout in
`app.test.ts:384` (*switching between two loaded dashboards*) and FD-05 once; not accepted as a
release gate. **Next task:** when the load falls (a background check in this session waits for
load < 30 and runs it), three full `npm run test:e2e` runs green, then bump 0.6.6, release, verify
as above. FD-25: the in-place launch was refused because the running Switchboard desktop is still 0.6.8 (it
started before 0.6.10 was installed into its bundle; found by the fabric-switchboard owner session) — one
restart of Switchboard by the operator, then the backlog row's command. **e2e needs an unlocked screen:** `npm run test:e2e` now refuses at once on a locked one
(`scripts/check-screen.mjs`) — three runs at 05:52 UTC failed FD-05 only because the screen was locked.
**Field, 2026-10-08 02:34 UTC:** the installed 0.6.4 downloaded and verified 0.6.5 (`update_download done
version=0.6.5 sha256=4cd7d8e0591a team=KJ35UYYL22 cdhash=dbd629669b7d`, `update_check ready`); it installs
after 10 hidden idle minutes or Restart to Update — then check `main.log` for `update_install installed
from=0.6.4 to=0.6.5` and an `estate_check` without `spawn npm ENOENT`.

**Housekeeping 2026-10-08:** two untracked session transcripts in the checkout root
(`2026-10-06-035607-…txt`, `kimi-export-session_-…md`) moved to
`~/DATA/_archive/session-exports/fabric-dashboards/`, so Observatory's Stop hook stops recording
them as this repository's changes.

## Earlier on 2026-10-08 — release 0.6.5

**Release 0.6.5 — branch `agent/release-065`.** 0.6.5 was bumped by PR #44 (FD-29, the local feed)
but never tagged; FD-33 (PR #45) landed after it under `Unreleased`, so the installed 0.6.4 kept
logging `estate_check failed … spawn npm ENOENT` every 6 h (`main.log`, last 2026-10-07 20:34 UTC).
This branch folds FD-33 into the 0.6.5 section of `CHANGELOG.md` (dated 2026-10-08) so one release
carries both. Checks: `npm ci`; `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (320 tests, 319 pass,
1 launchd skip; brand, regions, UX lint); `npm run test:e2e` on an unlocked screen: first run 6/7 —
*FD-05: a hidden window leaves no Dock icon* (`test/e2e/spend.test.ts:87`) failed — then
`spend.test.ts` alone 2/2 and the full suite again 7/7 (exit 0); the flake is FD-35. **Next task:** merge, tag
`v0.6.5` on the merge commit, the operator's approval of the release run; then read the receipt,
check the published files as the updater does, and watch this Mac's 0.6.4 → 0.6.5 update (the old
download path, once more) and the first `estate_check` after it (expected: no `spawn npm ENOENT`).
FD-34 (two estate decisions) and FD-25 (an account and a project folder; Switchboard here is still
0.6.8 on 2026-10-08) stay with the operator. Housekeeping on 2026-10-08: the merged worktree
`../fabric-dashboards-estate-updater` (`agent/estate-bootstrap-fix-20261007`, 0 commits ahead of
`main`, idle) removed; branches left: `codex/product-presentation` (unmerged FD-10 WIP, its own
worktree) and `docs/remote-projection-cloud-mark` (unmerged proposed ADR-0009).

## Previous — 2026-10-07

**The installed copy is current: 0.5.6 → 0.6.2 → 0.6.4 on 2026-10-07, by itself.** The staged 0.6.2
installed at 02:31 UTC (ShipIt «Successfully launched application»; `main.log`: `started 0.6.2`,
`auto_update on` — no `update_install installed from=0.5.6` line, because 0.5.6 predates
`.last-version`). 90 s later 0.6.2's updater found 0.6.4: `update_download done version=0.6.4
sha256=7905d6bca5cd team=KJ35UYYL22 cdhash=20e16df0082d` (the published build's CDHash),
`update_check ready version=0.6.4`, `update_restart confirmed consoles=1 commands=0` (the person
confirmed; one running console was named), `update_install installed from=0.6.2 to=0.6.4` at
02:34:06 UTC. FD-27's and FD-31's field proofs are done.

**FD-07 measured on 0.6.4** (main process, window hidden, 10 min, `ps -o time,rss` every 30 s):
1.77 s CPU in total = 0.295 % average (target ≤ 0.3 %), RSS ~167 MB average.

**0.6.5 (unreleased; FD-29 merged 2026-10-07 as PR #44, `d8c6d67`) — the local feed.** Squirrel now
gets the verified zip through a local `file://` feed (`localFeed` in `src/core/release-verify.ts`;
the verified-update cache lifecycle in `src/electron/updater.ts`: emptied at start, before each
verification, and once Squirrel has staged or refused its copy). The code-directory pin on the
staged bundle stays as the second check. Gate green at merge (`FD_SKIP_LAUNCHD=1 npm run check`,
314 tests, 313 pass, 1 launchd skip). **Next task:** tag `v0.6.5` and run the release; the
0.6.4 → 0.6.5 update on this Mac will exercise the old path once more, and the update after it is
the local feed's field proof (a 0.6.5+ copy downloading). The field finding behind it — the estate
updater's skills check failing in the packaged app (`estate_check failed … spawn npm ENOENT`,
`main.log` 02:35, 03:20, 08:34 UTC) — is fixed: FD-33 merged as PR #45 (`9862e53`, unreleased), and
it leaves FD-34 to the operator (watch-by-default, and where the installed skills version is read).
FD-25 waits for the operator to name an account and a project folder (declined 2026-10-07:
«никаких тестовых клауд кодов») and for Switchboard on this Mac to reach 0.6.10 (still 0.6.8, no
projects, at 04:53 local).

**Released: 0.6.4 on 2026-10-07 01:57 UTC** (run 37558793926, tag `v0.6.4` on `77c91f4`; Latest). It
carries 0.6.3 (FD-31, FD-30; superseded before approval) and FD-32. Receipt: Developer ID (KJ35UYYL22),
`accepted and stapled: app, update zip, image`, Gatekeeper accepted, fuses `100011011`, `checks.pty`,
`checks.updateVerifier`, `checks.downgradeGuard`, MCP `initialize` as 0.6.4. Published files checked as
the updater checks them: signature ok, `signedFeed` ok, zip matches, strict codesign, team
`KJ35UYYL22`, CDHash `20e16df0…`; `latest` feed answers 0.6.4. Knowledge base: fabric-workspace PR #64
(`ccd6eaf`).

**0.6.4 — branch `agent/budgets-064`** (FD-32): every limit an agent applies is visible on Spend
(contract DEC-0027, `94b1829`; service-host 0.3.3). 0.6.3 (FD-31 step-aside + FD-30 estate updater) was
tagged on `5683d51` and superseded by 0.6.4 before approval (run 37557707038 cancelled); e2e on its `main`:
7/7. Switchboard 0.6.10 is published, but the installed copy was still 0.6.8 with no projects at
03:30 local, so FD-25 cannot run until it updates and a project folder exists (creating one is the
operator's account decision). **Next task:** the operator's approvals of the 0.6.4 release run; read its receipt; then the installed copy's update.

**0.6.3 — branch `agent/fd30-pending-install`** (FD-31; FD-30 is the estate updater, also in 0.6.3). The field proof of 0.6.2 found that opening
the old app while ShipIt installs aborts the install: on the operator's Mac 0.5.6 → 0.6.2 failed
twice at 02:11–02:13 local (ADR-0015 addendum 0.6.3 has the log lines). 0.6.3 makes a launch step
aside while ShipIt installs a newer build and reopens the app afterwards. **The operator's copy is
still 0.5.6 with 0.6.2 staged** (ShipIt job running, staged CDHash `a8505bbc…` = the published build):
it needs one Restart to Update without reopening, or 10 hidden minutes with nothing running — 0.5.6
logs nothing about updates, so why its own automatic install did not fire after 02:23 is not visible.
**Next task:** gate, merge, tag `v0.6.3`, the operator's approvals; then check the installed version and
`main.log` for `update_install installed`.

**Released: 0.6.2 on 2026-10-06 23:41 UTC** (run 37541067349, tag `v0.6.2` on `2c06fa8`; GitHub
release `v0.6.2`, Latest). The receipt, read from the `release-macos` artifact: revision `2c06fa8`,
Developer ID Application (KJ35UYYL22), `accepted and stapled: app, update zip, image`, both
Gatekeeper checks `accepted, source=Notarized Developer ID`, fuses `100011011` on every slice,
`checks.pty` (node-pty from app.asar), `checks.updateVerifier` (openpgp in app.asar accepts v0.6.0's
signed SHA256SUMS and refuses one changed byte), `checks.downgradeGuard`, the MCP launcher answers
`initialize` as 0.6.2. The published files, checked the way the 0.6.2 updater checks them:
`sumsSignedByRelease` ok, `signedFeed` ok (`needsPerson` null), the zip matches SHA256SUMS,
`codesign --verify --deep --strict` valid, team `KJ35UYYL22`, version 0.6.2, CDHash `a8505bbc…`;
the `latest` feed answers 0.6.2. Knowledge base: fabric-workspace PR #61 (`b5d49f4`) — products.md
0.6.2, roadmap Dashboards row, RM-19 and RM-25.

**First task for the next agent:** the field proof. At 2026-10-07 01:41 local the installed copy was
still 0.5.6; its 6-hourly check (about 04:05 local) downloads 0.6.2, and it installs after 10 hidden
minutes with nothing running (0.5.6 has the automatic install). Never quit it yourself (lifecycle
broker rule). Then on 0.6.2: `grep -E 'update_|auto_update' ~/Library/Logs/Fabric\ Dashboards/main.log`
must show `auto_update on` at start, and `update_install installed from=0.5.6 to=0.6.2`; record the
lines here and close FD-27's field proof for the first hop. Measure FD-07 (`ps -o time,rss` over 10
hidden minutes) on 0.6.2 and record it. Then FD-25 once Switchboard 0.6.10 publishes, and FD-29's
open item (the `file://` feed).

**How 0.6.2 came about — branch `agent/fixes-062`, PR #35.** 0.6.1 (PR #34, `4f5cc11`, tag `v0.6.1`) was withdrawn before
approval — run 37539041728 force-cancelled — because a read-only bug audit by the fabric-workspace
session found that Restart to Update ended running agent consoles without asking (HIGH-2). 0.6.2
carries all of 0.6.1 — FD-27 (updates by
[LC-16 in detail](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md),
[ADR-0015 amendment](adr/0015-data-survives-uninstall-updates-install-themselves.md#lc-16)), FD-28
(Settings → Language, glossary), FD-19 (machine reasons in Russian), the compact-bar fix — plus FD-29:
the audit's fixes (Restart/Quit ask and name the work, the probe deadline in
`@passioncode-ai/fabric-service-host` 0.3.2, removal debounce, uninstall never purges under a live
app, `~/.claude.json` symlink kept, login-shell group killed, Switchboard Terminal refuses Continue,
45-min update watchdog, flaky test margins) and the signed feed (`signedFeed`, from Fabric Inbox's
design). Checks run: `FD_SKIP_LAUNCHD=1 npm run check` — 286 tests, 285 pass, 1 skipped (launchd);
`npm run test:e2e` 7/7 on an unlocked screen; the trickle test watched failing without its fix;
openpgp verified from a packed `app.asar` under Electron's Node (0.6.1). **Next task:** reproduce CI
on a clean checkout, merge on a green gate, tag `v0.6.2`, give the operator the `macos` and `publish`
approval links, read the receipt (`checks.pty`, `checks.updateVerifier`, `checks.downgradeGuard`).
Then: tell Fabric (fabric-a6) that service-host 0.3.2 bounds the whole probe; field proof — the
installed copy 0.5.6 → 0.6.0 → 0.6.2 by itself (still 0.5.6 at 2026-10-07 00:08 local), and on 0.6.2
`grep -E 'update_|auto_update' main.log` shows `auto_update on`. FD-29 open item: the `file://` feed. Switchboard 0.6.9 will not be published (Windows job failed); SB-75 ships in 0.6.10 — FD-25 waits for it, and nothing in Switchboard needs the operator's approval until then.
The LC-16 matrix went to Inbox (already compliant on its 0.12.0 branch, 95af4f7), Switchboard,
Observatory and Fabric (fabric-a6, also for fabric-vr). Ops: about 20 MCP servers from 0.4.1 stay
alive, held by open agent sessions (0.4.1 predates the stale exit, d604b07); they end with those
sessions — not killed from here.

## Estate updater (FD-30, 2026-10-07)

**Branch `agent/estate-updater-20261007`.** The operator asked for version watching and auto-update
for the Fabric Agent Contract and the skills, inside this app, started with it. Landed as an
in-process component next to the Updater ([ADR-0018](adr/0018-estate-updates-from-inside-the-app.md),
[brief](evidence/briefs/2026-10-07-estate-updater-brief.md), scenario SCN-051): contract watch is
opt-in (Settings → Estate updates names a local clone; `git ls-remote` vs local `main`; sibling pins
read from fabric-agent-adapter/fabric-dashboards/fabric checkouts; the only automatic mutation is
`git fetch`), skills update behind a switch (default off) with a publisher check before
`npx --yes sshlg-skills update`. LC-16 cadence; activity codes `estate_check` / `estate_update`.
Checks: `FD_SKIP_LAUNCHD=1 npm run check` — 307 tests, 306 pass, 1 launchd skip; `npm run
test:e2e` not run (needs an unlocked screen). Merged (PR #38, #39) and released in 0.6.3/0.6.4.

**Review and fixes — branch `agent/fd30-estate-fixes-20261007` (FD-33).** A read-only review of
`d8c6d67` found 17 defects; the first was in the field log on every check (`spawn npm ENOENT`). All
fixed except two operator decisions (FD-34); see the [ADR-0018 amendment](adr/0018-estate-updates-from-inside-the-app.md).
**Next task:** merge on the green gate and ship with the next release; then the operator names the
contract clone (`~/DATA/fabric-agent-contract` works now); FD-34 is decided (2026-10-08: the skills watch runs only where the family is installed, reads its runtime and the launcher's own check); an estate e2e test is still to write.

## Previous — 0.6.0 (2026-10-06)

**0.6.0 — merged (PR #33, `main` `36bf759`), tagged `v0.6.0`, release run 37505569449 waits for the operator's `macos` and `publish` approvals** (task-pipeline run; operator-approved design
[ADR-0017](adr/0017-focus-layout-and-agent-console.md), scenarios SCN-046…050 validated; FD-24). Entry:
the [brief](evidence/briefs/2026-10-06-focus-and-console-brief.md) and its
[plan](evidence/briefs/2026-10-06-focus-and-console-plan.md). T1…T13 done: a one-line service header
with a problem chip, a sidebar rail, and a per-service agent console (node-pty + xterm.js) running
the chosen runtime in the agent's repository, Switchboard deciding the account. Checks:
`FD_SKIP_LAUNCHD=1 npm run check` green; `test/e2e/focus-console.test.ts` passes; `npm run test:e2e`
green except FD-05's Dock assertion in `test/e2e/spend.test.ts`, which cannot pass while the screen
is locked (macOS sends windows no show/hide events then — measured 2026-10-06 with a bare Electron
window, `CGSSessionScreenIsLocked = Yes`; the same assertion fails on `origin/main`); an unsigned
universal build passed `checks.pty`, and both slices ran a PTY. An independent review found 11
defects (login `PATH`, account pool, group stop, replay, …), all fixed in `6e54d2b`; CI reproduced
locally from a clean `npm ci` (269 tests). **Next task:** after the operator approves `macos`, read
the receipt (`checks.pty` on the signed build) and approve nothing yourself; once published, check
Open in Terminal on the installed signed app (a `.command` through LaunchServices — never tried on a
signed build) and re-run `npm run test:e2e` on an unlocked screen. Open seams: Switchboard SB-75 (FD-25); Fabric ADR-0123 makes
this console a session its harness will launch later.

**Released: 0.5.6 on 2026-10-06 11:00 UTC** (run 37407706842, tag on `2909565`; GitHub release
`v0.5.6`, marked Latest — the organization's publish workflow titles it by its tag, where earlier
releases read "Fabric Dashboards 0.4.1"). `v0.5.5` was withdrawn before approval (run 37398766044
cancelled) because a third review found two token leaks after its tag (T-1…T-4). The receipt, read
from the `release-macos` artifact: revision `2909565`, Developer ID Application (KJ35UYYL22),
`accepted and stapled: app, update zip, image`, both Gatekeeper checks `accepted, source=Notarized
Developer ID`, `checks.usageDescriptions` none in 5 Info.plist files, fuses `100011011` on every
slice, the MCP launcher answers `initialize` as 0.5.6; locally `xcrun stapler validate` and
`spctl -a -t open --context context:primary-signature` accept the image. Knowledge base updated:
fabric-workspace `4ad4d5f` (products.md 0.5.6, roadmap row released).

**First task for the next agent:** confirm the operator's installed copy moved to 0.5.6. At
2026-10-06 13:20 local it was still 0.4.1, started 03:35, with an empty ShipIt cache: its last
6-hourly check ran before the publish. It downloads at its next check (about 15:35 local) or on
*Fabric Dashboards → Check for Updates…*, and installs at its next quit or Restart (0.4.1 has no
automatic install). Never quit it yourself (lifecycle broker rule: the person started it). Observed 15:52 local: the
expected 15:35 check left no trace (ShipIt cache empty, Squirrel's `Cache.db-wal` last written 09:35)
while the machine ran at load average 241; 0.4.1 logs nothing about updates, so the cause is not
visible. The public feed answers 0.5.6 and its zip downloads (HTTP 200, 229,900,003 bytes). The
dependable path is the person's: *Fabric Dashboards → Check for Updates…*, then Restart. Then
walk SCN-001…045 on the installed 0.5.6 (FD-02) and measure FD-07 (`ps -o time,rss` over 10 hidden
minutes; record the numbers here). Tell the growth/analytics owner session that 0.5.6 is out (cross-
agent links, Spend): it had ended when the release published.

**Organization backlog publication is blocked, not by this repository.** The scheduled workspace
sync (`ai.passioncode.fabric-workspace-sync`) failed every run since 2026-10-05 11:17 UTC. Fixed
here: the website's malformed SITE-011 row (passioncode-ai.github.io PR #58); another session fixed
its duplicate SITE-012 (PR #60). Last error: `passioncode-platform` is in org-index `repositories.json` but was no workspace
source. Fabric carries the fix — the source line (`9372880b`, from fabric-workspace's #14) and a
sync that drops a rejected export from its own checkout (`bea40bc3`) — on `agent/release-032-work`,
landing with Fabric's 0.3.2 release PR (Fabric owner session, 2026-10-06). Until then each run fails
on that error; nothing to do here. A duplicate fabric PR #15 was closed.

**What 0.5.6 adds over 0.5.5** — the [third review pass](reports/2026-10-05-release-audit/README.md#third-pass--2026-10-06-fix-list-for-056)
(FD-23): four read-only reviews of `b8bdf57..eedb0e6`, T-1…T-30 fixed. The token now goes only to
the service itself — never to another program on its port through MCP `activity`, never again to
an online address that answered without the protocol, never in a re-sign-in to whatever holds the
port now (`RemoteTokenLatch` in the shared package, held by the monitor and once per MCP process).
Plus a crash-reload loop, R-7/R-6 finished, the Stop dialog finished, signal-ended commands, MCP
argument types, `npm run test:e2e` right after `npm ci`, and the documentation drift. Checks:
`FD_SKIP_LAUNCHD=1 npm run check` exit 0 (246 tests, 245 pass, 1 skipped), `npm run test:e2e` 6/6.
Known flake: LC-10's 1000 ms session-exit bound failed once at 1288 ms with the machine 6.5 GB
into swap; alone it passes 4/4.

**What 0.5.5 carried** (all of it ships in 0.5.6, the first published release since 0.4.1):
- one entry per agent (ADR-0012); Spend (ADR-0013); the dashboard toolbar and the at-a-glance
  Overview (ADR-0014); updates that install themselves and data that survives an uninstall
  (ADR-0015); agent summaries, tools and cross-agent links (ADR-0016); the lifecycle contract;
- the **release audit of 2026-10-05** ([report](reports/2026-10-05-release-audit/README.md)): four
  read-only reviews plus a live walk of every screen; 49 audit IDs fixed in `d408450`, `7048ef2`,
  `37dadc8` and `eedb0e6`; 7 items moved to the backlog with reasons (FD-19…FD-21);
- its **second pass of 2026-10-06** (same report): a Russian walk of every screen, a live walk of
  every MCP tool, the scenario/screen review applied; fixes in `11cec37`, `0159af9`, `812950a`, docs
  in `4cf8863`, `9567a74`. Three new shared state vectors (remote HTTP 5xx); Fabric does not run
  them yet (ADR-0006 amendment).

Superseded runs, all cancelled before publish: `v0.5.5` (37398766044, after its `macos` build — T-1…T-4), `v0.5.2` (37256336416), `v0.5.3` (37291654717),
`v0.5.4` (37307011716 — cancelled after its `macos` approval because 0.5.5 carries the audit; an
older run published after a newer one would have pulled installed copies back). Since this
release, release.yml runs one release at a time and checks again right before publish, and the
app installs only a feed version newer than its own (`src/core/version.ts`).

**Open after the release:** FD-16's field proof (the next release installing itself on a 0.5.6
copy with the window closed); FD-19 (reason codes, with Fabric); FD-20 (one control module);
FD-21 (small leftovers); FD-22 (show an agent's A2A surface — roadmap RM-17, adapter FAA-10
[PR #39](https://github.com/passioncode-ai/fabric-agent-adapter/pull/39), waits for the contract's
`surfaces.a2a` decision).

**Decided by the operator on 2026-10-05:**
- COM-01 C1–C9 accepted: DEC-0022 on fabric-agent-contract `main` `d4c8831`.
- D1–D5 answered: fabric-workspace `knowledge/plans.md` and the estate report.
- Releases and tags approved. Adapter `v0.8.0` is published on npm.
- The operator's personal agents may be named in these repositories; history stays as it is.

**Spend is live with real numbers.** Three of the operator's own agents (private repositories,
not named here) publish the DEC-0021 report, verified through this app's `spend` code on
2026-10-04/05. One reports an `unknown` provider outcome as unpriced, never $0. One online agent
states a monthly budget its guard enforces. The detailed receipts live in those private
repositories and in the operator's projects wiki. The installed Dashboards 0.4.1 has no Spend
page yet; it ships with FD-09.

**Protocol sweep, 2026-10-05.** The adapter probe (`main` `d14c147`) was run against all 16
services installed on the operator's Mac.
- **0 FAIL** apart from two local projections that are scheduled to retire. They relay a newer
  schema than the manifest they register, and their owner accepts this until removal.
- **DEC-0024 came out of the sweep.** Two services refused the host token on `/mcp` on purpose,
  and the contract now allows that as `surfaces.mcp.auth: "own"`. Both declare it, and the probe
  reports `interop.mcp-own-auth` PASS.
- **Gaps still open across agents:**
  - not every agent that calls paid models publishes `surfaces.usage` yet. Measured
    2026-10-05: Project Observatory (assistant and embeddings) and two personal agents, one of
    them mid-milestone on a work-in-progress branch, call models without the report. The
    Observatory owner session had ended before the offer could be sent; offer it again at
    its next session;
  - several agents link no `fabricManifest`, so the probe's manifest rules stay NOT_RUN.

**Probe bug found on the way:** the adapter probe sent no `Mcp-Method`/`Mcp-Name` headers (MCP
2026-07-28 requires them), so servers on the official SDK answered HTTP 400. The fix is in
fabric-agent-adapter [PR #35](https://github.com/passioncode-ai/fabric-agent-adapter/pull/35),
FAA-08.

State of the work streams from this session, with receipts:

| Stream | Where | State |
|---|---|---|
| FD-10 one entry per agent | ADR-0012, `main` `f294285`, issue #27 closed | done, unreleased |
| FD-11 Spend | ADR-0013, `main` `818fe7c`; contract DEC-0021 `9091d3d` | done, ships in 0.5.6; three agents report real numbers (see *Spend is live*) |
| Kits publish usage (G7) | adapter PR #34 on `main`, `v0.8.0` published on npm (FAA-06, FAA-07) | done; agents adopt it |
| FD-12 / COM-11 (#26) | backlog FD-12 | COM-01 accepted (DEC-0022); waits for a service that answers `com.status` — Fabric's board (COM-02/03) |
| Enterprise workplace, admin channel, agent chat | [estate report](reports/2026-10-04-agent-estate-architecture/README.md); fabric-workspace `knowledge/plans.md` (gaps G1…G8) | D1…D5 answered 2026-10-05 |
| FD-09 first CI release | backlog FD-09 | released as `v0.5.6` on 2026-10-06 (run 37407706842); `v0.5.5` withdrawn |

**The Codex session recovered here.** Codex thread `01a10620` (working on the operator's analytics
agent in its own private repository) stopped at its weekly rate limit at 2026-10-04 15:42 UTC
in the middle of a turn. Its work here sat uncommitted in
`~/DATA/.worktrees/fabric-dashboards-product-presentation`. It is now committed and pushed as
`codex/product-presentation` `9e33f64`, kept as a record and superseded by ADR-0012. Its last
commit in the analytics agent's private repository was local only and is now pushed. Its other
worktrees were already pushed. The owner session of that agent records ADR-0012 as the FD-10
authority.

## Spend and the agent-estate architecture, 2026-10-04 (FD-11, ADR-0013, branch `feat/spend-view`)

Objective: the operator asked for spend that the agents themselves report at the protocol level,
shown in one place, and for the enterprise picture (employee workplaces, admin channel, agent
chat, agent exchange) worked into the plan with owners. Entry points:

- **Contract:** DEC-0021 `surfaces.usage` + `service-usage.schema.json` + `FAC-SEM-025`,
  fabric-agent-contract [PR #10](https://github.com/passioncode-ai/fabric-agent-contract/pull/10),
  merged to `main` as `9091d3d` after review (a day without model rows can only be empty), `pnpm run check` exit 0 (272 tests).
- **Here:** `packages/service-host/src/usage.ts` (`checkUsage`, `summarizeUsage`, package 0.3.0),
  `src/core/probe.ts` (`fetchUsage`), `src/core/spend.ts` (`readSpend`), `src/renderer/components/Spend.tsx`,
  MCP `spend`; [ADR-0013](adr/0013-spend-from-the-agents.md); ST-015, SCN-036…038.
- **Architecture:** [report](reports/2026-10-04-agent-estate-architecture/README.md). It maps the asks
  onto the fleet tunnel CE-0…14, the ADR-0088 relay and the COM board, lists gaps G1…G8 and
  decisions D1…D5.

Checks run: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (195 tests, 194 pass, 1 skipped = launchd);
`npm run test:e2e` 6/6, including the new `test/e2e/spend.test.ts` against a loopback agent. Review fix: a total whose calls are all unpriced reads unknown, not «≥ $0.00» (`sumSpend`, test/spend.test.ts); 196 tests.

Fixtures pinned to `9091d3d`. Open: agents adopt `surfaces.usage` (G7, kits first); FD-12 / COM-11 is blocked by COM-01.

## One entry per agent, 2026-10-04 (FD-10, ADR-0012, branch `feat/product-grouping`, unreleased)

Objective: the operator saw five sidebar entries for two products (Growth ×3, Analytics ×2) and
asked for one agent with its sections inside, with dashboard-less services apart. Entry point:
[ADR-0012](adr/0012-one-entry-per-product.md); code `src/core/products.ts` (`groupProducts`),
`src/renderer/App.tsx` (`ProductItem`), `ServiceView.tsx` (`InstanceSwitch`), `Overview.tsx`
(product cards); scenarios SCN-033…035; MCP `list_services.product`.

Recovered from a stopped Codex session: Codex (thread `01a10620`, working from another repository) drafted
an explicit operator presentation map for this in worktree
`~/DATA/.worktrees/fabric-dashboards-product-presentation` and stopped at its weekly rate limit
(2026-10-04 15:42 UTC) with the work uncommitted. It is committed as found and pushed as
`codex/product-presentation` `9e33f64` — a record, not for merge: grouping by id needs no map
(the contract already says a second copy of a service is a second instance).

Checks run: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (181 tests: 180 pass, 1 skipped = launchd);
`npm run test:e2e` 5/5 (the switch test now opens Beta through the instance switch; the remote test
was failing on `origin/main` too — its 40 s wait was shorter than the 60 s online probe of LC-08 —
and passes with 75 s). Not run: the installed app; the change ships with the next CI release (FD-09).

Next: merge the PR after review; then FD-02 covers walking SCN-033…035 on the running app.

## Lifecycle contract, 2026-10-03 (PR #21, `56eccde`; landed on `main` 2026-10-04, unreleased)

Objective: meet the organization's lifecycle contract (fabric-workspace `knowledge/lifecycle.md`,
LC-07…LC-15) for the findings of the 2026-10-03 lifecycle audit (fabric-workspace
`docs/reports/2026-10-03-lifecycle-audit/raw/fabric-dashboards.md`, F-1…F-12). Entry point:
`AGENTS.md` → *Lifecycle* and *Build output and retention*; the tests are `test/lifecycle.test.ts`,
one per rule, rule id in the name.

Done: idle cadence and change-only pushes (F-2, F-4), dashboard views released after 5 min hidden
(F-3), append-only activity store (F-5), launch at login asked once (F-6), no quit modal (F-7, the
tray line), start-up sweeps and partition removal (F-9), MCP exit on EOF/SIGTERM with group kill,
stale after update, clean command env (F-1, F-10), uninstall (F-11), fuses set and read back by
`dist` (F-12), release pruning and `npm run clean` (LC-15), rotated 0600 `main.log`.

Not done, with reasons: F-8 cookie encryption stays off (needs a signed upgrade test showing zero
Keychain prompts); Dock icon while hidden (F-7 second half) unchanged — a behaviour choice for the
operator; `NS*UsageDescription` boilerplate in Info.plist not stripped (LC-07 release gate, not in
this packet). No signed build was made: the fuses with ASAR integrity and `OnlyLoadAppFromAsar` are
proven only on a synthetic wire; `dist` fails the release if the packaged MCP launcher cannot answer
`initialize` under them, which is the first real proof.

Checks run: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (166 tests, 1 skipped = the launchd test, run
separately without the skip: pass); `npm run build` exit 0. `npm run test:e2e` was not run (the
worktree has no Electron binary).

Landing, 2026-10-04 (merge commit `56eccde`, `main` fast-forwarded to it; board row FD-03 closed): `origin/main` (the CI-signing change, #22 `ec2a29f`, and the board sweep) was
merged into the branch — no rebase. `scripts/dist-mac.mjs` had been split into stages on `main`, so
the lifecycle steps moved into them: the fuses are set in `--stage app` before signing (ad hoc
re-seal of the framework when unsigned) and read back into `checks.fuses`; the packager's
temporary bundle is unregistered from LaunchServices before its directory is removed, and so is the
staged app before `--stage app` replaces it and before `--stage seal` removes it; `--stage seal`
prunes `release/` and records `pruned` in the receipt. `docs/RUNBOOK.md#release` says where each
check is read. `npm run clean` also removes a `release/stage/` left by a build stopped between
stages (LC-15 test extended and watched red first). Gate on the merged tree:
`FD_SKIP_LAUNCHD=1 npm run check` exit 0 — 173 tests, 172 pass, 1 skipped (the launchd test,
`node --import tsx --test test/monitor.test.ts` unskipped: 7/7, label unloaded afterwards); brand
pins, 32 code regions, UX lint pass. Deferred items stay open as board rows FD-04…FD-07 in
[backlog.md](backlog.md); no version was bumped, so 0.4.1 remains current and this ships with FD-09.

Next task: the first CI release that carries these changes (FD-09) is the first real proof of the
fuses (FD-07): read `checks.fuses` and `checks.mcpLauncher` in its receipt, launch the signed app
once with the window and once with `--hidden`, measure the idle budget in `AGENTS.md`
(`ps -o time,rss` over 10 hidden minutes) and record the numbers here.

## Releases signed only in CI, 2026-10-03 (PR #22, `ec2a29f`)

Objective: the operator's organization rule of 2026-10-03. Every PassionCode.ai product signs its
published builds only in GitHub Actions, in the protected `release` environment, approved by
`release-approvers` (passioncode-ai/.github `release-signing/`, shared actions `@v1`).

- `.github/workflows/release.yml`: the jobs are `version` (the tag names `package.json`'s version,
  the CHANGELOG has its section), `check` (`validate.yml`, i.e. `npm run check`), `macos` (in the
  `release` environment) and `publish` (`release-publish.yml@v1`). In `macos`:
  - `apple-signing` → `dist-mac.mjs --stage app --identity …` → `notarize` (app);
  - `--stage package` makes the zip and the image from the stapled app → `notarize` (image);
  - `--stage seal` measures and writes the feed and the receipt → upload `release-macos`.
- `scripts/dist-mac.mjs` gained the stages and dropped the gaps the inventory found. Gatekeeper
  now assesses the app as well as the image. Every notarization's status is read: the action
  requires `Accepted`, and the local `--notary-profile` path parses `--output-format json`. The
  seal also requires the app inside the update zip to be stapled. No team id or identity is
  written in the repository; it comes from `vars.APPLE_TEAM_ID` and the action's `identity`
  output.
- The release is described in `docs/RUNBOOK.md#release`. The local `npm run dist` is debug only.

Checks run: `npm run check` (green, see the PR); `actionlint` clean on both workflows. Seven new
tests are in `test/dist.test.ts`; they were watched failing before the change, and the workflow
order test was watched failing against a mutation that packages before the app is notarized. An
unsigned `npm run dist -- --unsigned --allow-dirty` ran all three stages and produced a DMG, the
update zip, the feed and the receipt. No signed build was made locally.

**Rehearsal started.** The annotated tag `v0.4.1-rc.1` points at `ec2a29f`. Run
[37128282549](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/37128282549)
(`gh workflow run release.yml --ref v0.4.1-rc.1 -f publish=false`) stood like this:
- `version` passed: the tag names 0.4.1 and the CHANGELOG has its section.
- `check / check` passed: `npm run check` on `macos-latest`.
- `macos` is waiting for the `release` environment (reviewers `release-approvers`). Since the
  operator's amendment of 2026-10-03 any member may approve it, the one who dispatched it
  included; an agent never does.
- `publish` has not started; it needs `macos`.

**Next task:** a member of `release-approvers` approves `macos`, then `publish`, on that run.
With `publish=false` no release is created, and the signed set is kept as the artifact
`signed-release-v0.4.1-rc.1` for 14 days. Read its receipt:
- `signing` names the CI Developer ID;
- `notarization` reads `accepted and stapled: app, update zip, image (the release workflow's
  notarize action)`;
- `gatekeeper` reads `accepted`.

Record the outcome here. If a step fails, the fix is a new `-rc.N` tag; an existing tag is never
moved. The next real release (0.4.2 or later) is the operator's tag.

**Rehearsal outcome, 2026-10-03: green.** A `release-approvers` member approved the `release`
environment for `macos` and for `publish` on the operator's explicit instruction
(`gh api repos/passioncode-ai/fabric-dashboards/actions/runs/37128282549/approvals`). All four
jobs of run 37128282549 concluded `success`: `macos` 18:50–18:56 UTC, `publish / publish`
18:56–18:57 UTC. The receipt the `seal` stage printed in the `macos` log names version 0.4.1 at
revision `ec2a29f`, `signing` the CI Developer ID, `notarization` `accepted and stapled: app, update
zip, image (the release workflow's notarize action)`, `gatekeeper` `accepted` (app and image both
`source=Notarized Developer ID`), staples on all three, and the packaged MCP launcher answering
`initialize` as 0.4.1; DMG sha256 `7f016bb3…b290fa`. With `publish=false` no GitHub release was
created (the latest release is still `v0.4.1` of 08:25 UTC). The signed set is the artifact
`signed-release-v0.4.1-rc.1`, kept until 2026-10-17.

**Next task:** the first real release through CI, tracked as FD-09 in [backlog.md](backlog.md). It
is the operator's annotated tag (0.4.2 or later), and an agent never approves the `release`
environment.

## Release 0.4.1, 2026-10-03 (PR #19, `75eba78`)

The first real online service exposed two MCP defects. First, `link` and `open` without a path
returned the origin root as `http_url`, where that service answers 404 (its panel lives under a
path). Now `http_url` follows the dashboard surface from the well-known document; if the service
does not answer, `/` is kept, and `open_link` is unchanged. Second, the tool descriptions said
"local" and `http://127.0.0.1` only; they now name online services, and `control` says it refuses
them.

Checks run: `npm run check` 137/137; `npm run test:e2e` 5/5; a new test in `test/remote.test.ts`
catches a mutation that reverts the fix. `dist` from `75eba78`: Developer ID, `accepted and
stapled`, Gatekeeper `accepted`, DMG sha256 `0688b1f3…4dca4`. Published as
[v0.4.1](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.4.1) and installed in
`/Applications`. A fresh installed MCP answers 0.4.1 and links the online service to its dashboard
path. Receipt: [runs/2026-10-03-link-defaults/release.json](runs/2026-10-03-link-defaults/release.json).

## Release 0.4.0, 2026-10-02 (PR #17, `f6cde69`)

Objective: an agent or dashboard that runs online, not on this Mac, appears and opens in the
app the way a local one does. The operator chose a remote placement in the contract, not a
local bridge (Fabric Agent Contract DEC-0019, `2ce3922`); [ADR-0011](adr/0011-online-services.md)
records the app's side and supersedes the never-merged ADR-0009.

- The app reads an online service over verified TLS from the main process. The token goes only
  to the descriptor's own https origin, no redirect is followed, and the login code opens the
  dashboard signed in (SCN-030, SCN-031). Online services sit in an **Online** group with the
  host on the card. The app offers no lifecycle control for them.
- Each failure is `down` with its own reason: a refused token, a certificate that does not
  verify, a redirect, or 60 s of silence (SCN-032). An unreadable token file is `invalid`, and
  the service is never contacted.
- MCP: `list_services.placement`, `control` refuses online services, `open?url=` accepts exactly
  a registered online origin.
- `@passioncode-ai/fabric-service-host` 0.2.0 carries the descriptor, request and precedence
  rules, plus nine shared vectors (`test-vectors/state-precedence.json`).

Checks run: `npm run check` 136/136 (in the worktree, on a fresh clone of the branch after
`npm ci`, and on `f6cde69` before `dist`). `npm run test:e2e` 5/5, including
`test/e2e/remote.test.ts`: a real Electron app against a TLS server. Mutations M1–M5 in
service-host are killed. `npm run dist -- --notary-profile fabric-notary` from `f6cde69`
produced: Developer ID, `accepted and stapled`, Gatekeeper `accepted`, DMG sha256 `ef088ca4…0439b`.
It is published as [v0.4.0](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.4.0)
and installed in `/Applications` (`spctl`: Notarized Developer ID). A fresh MCP process from the
bundle answers as 0.4.0 and lists the seven local services `ready`. Receipt:
[runs/2026-10-02-online-services/release.json](runs/2026-10-02-online-services/release.json).

Where each part landed (all on `main`):

| Repository | Commit | What |
|---|---|---|
| fabric-agent-contract | `2ce3922` | DEC-0019, schema, FAC-SEM-024, remote fixtures |
| fabric-agent-adapter | `447b558` (v0.6.0, npm) | kit `registerRemote`, request guards, sample online service, probe |
| passioncode | v0.1.20 (npm) | pins adapter v0.6.0 |
| fabric-dashboards | `f6cde69` (v0.4.0) | the app and service-host 0.2.0 |

Open work:

- The first real online service is the operator's own panel, which is private. It is delivered
  and verified in its own repository, not named here.
- Sessions that were already open keep the 0.3.4 MCP server until they restart.


## Release 0.3.4, 2026-10-01 (branch `agent/view-race-stability`)

Objective: the operator saw an empty Dashboard tab, two sidebar rows with one name, services
"restarting" all day and a flood of banners. What was found and done:

- **Blank Dashboard tab — fixed in the app.** Reproduced in the installed 0.3.1: open service A,
  open service B, back to A → empty tab. Cause: the renderer sends the new host's `showView`
  before the old host's cleanup `hideView()`, and that hide removed the view just shown.
  `ViewSlot` (`src/electron/policy.ts`) keys show and hide by the dashboard host that asked;
  a show overtaken while loading never attaches. Evidence: `test/viewslot.test.ts`; the new e2e
  *switching between two loaded dashboards…* fails on the old code («back to Alpha: … not a
  blank tab») and passes on the new.
- **Notifications — ADR-0010.** Measured 405 `notify: true` events in one day, 302 of them one
  flapping low-disk warning from two instances of one agent. A banner now needs intent ask,
  failed or attention, once per episode and cool-down, remembered in `notified.json`; title =
  agent and instance, subtitle = what it wants. `test/notify.test.ts` holds the day's cases.
- **Two instances read apart:** `displayName` (`src/core/names.ts`) in the sidebar and banners.
- **Disk work:** `ActivityStore` no longer rewrites ~1 MB per service every 15 s when nothing is
  new; `atomicWrite` removes its temporary file on a failed write (zero-byte leftovers had been
  found in the operator's app data after a full disk).
- **"Restarting all day" was not restarts.** Two services the host flapped on ran with
  `launchctl print` → `runs = 1` for 19 h. Both had `ProcessType Background` (one also `Nice 5`,
  `LowPriorityIO`), copied from the adapter kit's lifecycle table; under a load average of 192
  macOS starved them. Fixed upstream: `fabric-agent-adapter` 0.5.7 (PR #23, tag `v0.5.7`, on npm)
  writes `Standard` and its probe fails `Background` (`lifecycle.priority`);
  `project-observatory-dashboard` PR #110 does the same for its server and stops its own
  `osascript` banners when this host is present; `passioncode` 0.1.18 pins adapter 0.5.7.
- **Copies:** the extra services were second instances left running beside `default`; they were
  uninstalled on the operator's Mac and their runbooks now say an instance is temporary
  (private repositories, not named here).

Checks run: `npm run check` (119 tests, regions, UX lint), `npm run test:e2e` (4 tests; the
switching test also goes back by service link and asserts the page is visible),
`npm run dist -- --notary-profile fabric-notary` from `e8e516c`: Developer ID, notarization
`accepted and stapled`, Gatekeeper `accepted`, MCP launcher answers as 0.3.4, DMG sha256
`1f945627…7610a`. Published as [v0.3.4](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.3.4)
and installed in `/Applications` (`main.log`: `started 0.3.4`). The installed binary, driven
through the same switch on the operator's real services with its window on screen, showed the
dashboard; the operator's own window was off-screen at the time, so its pixels were not checked.

Where each part landed (all on `main`):

| Repository | Commit | What |
|---|---|---|
| fabric-dashboards | `e8e516c` (v0.3.4), `25f91c7` | the app |
| fabric-agent-adapter | `de21d95` (v0.5.7, npm) | kit: `Standard`, `lifecycle.priority`, notification rules |
| passioncode | `7bc7797` (v0.1.18, npm) | pins adapter v0.5.7; this Mac updated |
| project-observatory-dashboard | `d6ea9c8` (v0.10.1) | server `Standard`; no own banners beside this host |
| fabric-workspace | `0d0c499` | `knowledge/products.md` |

Project Observatory 0.10.1 is installed on the operator's Mac and its server plist says
`ProcessType Standard` (after a manual `serverd.py --install`: `full update` does not rewrite the
plist — recorded in that repository's `docs/runs/2026-10-02-release-0.10.1/`).

Next task: move SCN-001/015/020 out of `draft` once the operator has used 0.3.4.

## Objective

One protocol (`fabric-service/0.1`), one Fabric skill set, one desktop app (Fabric
Dashboards) and one self-updating PassionCode.ai skill launcher — see the
[design](design/2026-09-28-fabric-dashboards-design.md) and the
[brief](evidence/briefs/2026-09-28-brief.md) (REQ-01…24, decisions, carry-over ledger).
Cross-repository index: `passioncode-ai/org-index` → `docs/runs/2026-09-28-fabric-dashboards/`.

## State

| Piece | Where | State | Evidence |
|---|---|---|---|
| Protocol `fabric-service/0.1` | `fabric-agent-contract` PR #6 | merged (`a5a2709`) | `pnpm run check` exit 0 on the merged main |
| Skill `building-fabric-services` | `fabric-agent-adapter` PR #2 (`v0.4.0`), PR #4 (`v0.4.2`, `e09551f`) | merged, tagged; the kit's `LoopbackHTTPServer` binds without a resolver (0.4.2); **on npm** as `@passioncode-ai/fabric-agent-adapter@0.4.2` | `npm test`, both `claude plugin validate --strict` |
| Cross-repository ADR | `fabric` ADR-0083 (PR #2) | merged | `scripts/check-docs.sh`, `check-registers.mjs` |
| Product mark | `passioncode-ai.github.io` PR #6 | merged | site `npm run check` |
| **Fabric Dashboards 0.1.0** | this repository, tag `v0.1.0` | **released** — [GitHub release](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.1.0), installed in `/Applications` on the operator's Mac, login item registered | receipt: Developer ID, notarization `accepted and stapled`, Gatekeeper `accepted`; `update-feed.json` and the zip download anonymously (HTTP 200) |
| **Fabric Dashboards 0.2.0** | tag `v0.2.0` (`92b4c07`) | **released** — [GitHub release](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.2.0), installed in `/Applications` on the operator's Mac, `fabric-dashboards-mcp` registered in Claude Code (user scope, `✔ Connected`) | receipt: Developer ID, notarization `accepted and stapled`, Gatekeeper `accepted`, `checks.mcpLauncher` answers `initialize` as 0.2.0; `update-feed.json` → `currentRelease: 0.2.0` and the zip download anonymously (HTTP 200); live: a deep link opened a service's dashboard signed in, a link to an unknown service showed the refusal |
| Launcher `@passioncode-ai/passioncode` 0.1.4 | `passioncode` tag `v0.1.4` (`df38fd3`) | **on npm**; this Mac updated from npm; the self-update sees 0.1.4 by `ssheleg`, a trusted publisher | `npx @passioncode-ai/passioncode@latest status`: 3 plugins, hubs 3/3, no shadows |
| Project Observatory server | `project-observatory-dashboard` PR #75 → 0.8.0 (`d454fb4`, tag `v0.8.0`) | merged through all three required checks, released, installed on the operator's Mac with its descriptor | live `check_service.py`: 20 rules, 0 FAIL, 1 NOT_RUN (no login declared) |
| The operator's own services | their private repositories | merged and reinstalled locally only; not published, not named here | each probed live; the only FAIL left is one data directory the operator chose to keep inside its checkout |

This repository was recreated from a clean tree on 2026-09-29 so that nothing about the
operator's personal agents is public; the development history is kept privately in
`passioncode-ai/fabric-dashboards-archive`.

## Release 0.3.1, 2026-10-01 (branch `agent/release-0.3.1`)

Objective: the probe-confirmation fix ([ADR-0008](adr/0008-a-missed-probe-is-not-an-outage.md),
`1b00ce4`, PR #10) reaches the operator, whose installed 0.3.0 sends false "not answering"
notifications. First release under AGPL-3.0 or commercial ([ADR-0007](adr/0007-agpl-or-commercial.md)).

- Version 0.3.1 (a fix, semver patch): `package.json`, both root entries of `package-lock.json`,
  AGENTS.md; `CHANGELOG.md` `Unreleased` became `0.3.1 — 2026-10-01` with the *License* line.
  `packages/service-host` stays 0.1.0 — nothing in it changed since v0.3.0.
- Checks before the PR: fresh clone, `npm ci`, `npm run check` exit 0.
- Then, from `main` after the squash-merge: `npm run dist -- --notary-profile fabric-notary`, tag
  `v0.3.1`, `gh release create` with the DMG, update zip, feed, `.sha256` files and the receipt;
  the site names 0.3.1; the operator's `/Applications` copy is replaced. The receipts (notarization
  ids, SHA-256, release URL, site deploy, installed version) land in a follow-up section here.

## Release 0.3.1 — receipts, 2026-10-01 (branch `agent/release-0.3.1-receipts`)

- **Merged:** [PR #12](https://github.com/passioncode-ai/fabric-dashboards/pull/12), squash `51a7a80`, after the
  `validate` workflow ran once on the branch head `31d84cb` (run 36842633838, `success`). Tag `v0.3.1` (annotated)
  points at `51a7a80`.
- **Built** from `main` at `51a7a80` with `npm run dist -- --notary-profile fabric-notary`: universal (arm64 + x86_64),
  Electron 44.4.5; receipt: Developer ID signed, hardened runtime, `codesign --verify --deep --strict` valid,
  notarization `accepted and stapled`, Gatekeeper `accepted`, the packaged MCP launcher answers `initialize` as
  0.3.1. Notarization submissions, both `Accepted`: app `1368abd7-09d6-46d0-ad5d-e1b9e5fa0196`, disk image
  `6801d6b2-a282-42e7-94a0-15feb3455fc4`. Independently: `spctl -a -vv` on the DMG and on the app inside it →
  `source=Notarized Developer ID`; `stapler validate` passes on both.
- **Published:** [release v0.3.1](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.3.1) (Latest),
  six assets; SHA-256 equal to GitHub's asset digests:

  | Asset | SHA-256 |
  |---|---|
  | `Fabric-Dashboards-0.3.1.dmg` | `4ef44362566c3c05e6603266f52ba018f70b384ab7f4487c2fc4b305afe8f3d1` |
  | `Fabric-Dashboards-0.3.1-mac.zip` | `ae18b7ba6d195463c62981e6c9f753c9f2607614935620110685e33ae38b097a` |
  | `update-feed.json` | `b75ea641292957124a2f2b1303e41286867657adf4e725b783a78d3d94166741` |
  | `Fabric-Dashboards-0.3.1.receipt.json` | `8b6c2062d7df82f3fab3ce149707d06498412881420acd6abfdef518da0a9300` |
  | `Fabric-Dashboards-0.3.1.dmg.sha256` | `6e283dc730e9f77db3e466e07e89e427d77c9aa26a03f5ca9d473239dd7397ea` |
  | `Fabric-Dashboards-0.3.1-mac.zip.sha256` | `53ad2dfcbd7db1feeff229aee91bccf804e6ebeb9b442b97781e5f603e96b332` |

  `releases/latest/download/update-feed.json` → `currentRelease: 0.3.1`; the zip downloads anonymously (HTTP 200);
  the anonymous DMG download hashes to the value above.
- **Website:** passioncode-ai.github.io [PR #24](https://github.com/passioncode-ai/passioncode-ai.github.io/pull/24),
  squash `d7d1bdd`, deployed from `main` with `npm run deploy` (`CLOUDFLARE_ACCOUNT_ID` through Project Observatory):
  Worker version `d2891821-703d-4d62-9d9c-8c397bb60839`; live: the homepage row says "Release 0.3.1" and links
  `v0.3.1`, 29 of 29 live files equal the build, `www` 301 to the apex. Knowledge base: fabric-workspace
  PR #10 (`24c8fba`), `knowledge/products.md` names 0.3.1; its publication is left to the scheduled sync.
- **Installed on the operator's Mac:** 0.3.0 quit through `osascript` (bundle id `ai.passioncode.fabric-dashboards`),
  `/Applications/Fabric Dashboards.app` replaced by the app from the notarized DMG (`spctl` accepted before and after
  the copy; no quarantine attribute present, so none was removed), relaunched: `CFBundleShortVersionString` 0.3.1,
  `main.log` → `started 0.3.1`. The installed `fabric-dashboards-mcp` answers `initialize` as 0.3.1 and
  `list_services` with all 6 installed services. The `server.js` MCP children of Claude sessions started before the
  swap keep running the 0.3.0 code until their session restarts; they were left alone.
- Not run: `npm run test:e2e` (RUNBOOK step 2). It launches Electron from the checkout, and the run's rule was that no
  app runs from a build directory that is deleted afterwards; `npm run check` and the hosted `validate` were the
  gate, and the dist script's own packaged-launcher check ran.
- **Next task:** watch the operator's notifications under load. A service that stays silent for 60 s or more
  should still be reported, and a slow Mac should not be. Then move UX scenarios from `draft` once the operator
  approves them from the running app.

## Probe confirmation, 2026-10-01 (branch `agent/probe-flap`, ADR-0008)

Objective: the installed 0.3.0 flapped "not answering" / "is back" for running services under a
load average of 192, where one 2 s probe timeout decided the state.

- Done: `PROBE_TIMEOUT_MS` 5 s (`src/core/probe.ts`, used by the monitor and the MCP server);
  `DOWN_AFTER_MISSES` 3 and `Monitor#evidence` (the last answer stands until then, except a job
  launchd reports off or a new pid) in `src/core/monitor.ts`; a miss is re-checked after 5 s;
  `DOWN_NOTIFY_AFTER_MS` 60 s, decided only by a failed probe (`Monitor#checkDown`). The shared
  `deriveState` and its vectors are unchanged.
- Checks: `test/flap.test.ts` (6 tests, scripted clock and probes); planting
  `DOWN_AFTER_MISSES = 1` fails three of them, planting a 2 s timeout fails the slow-probe test;
  `npm run check` exit 0.
- Not released: the fix is on `main` only. **Next task:** cut the next release through the RUNBOOK
  (`npm run dist -- --notary-profile fabric-notary`, notarized DMG, update feed). It is the first
  release under AGPL-3.0 or commercial, so its `CHANGELOG.md` section carries the *License* line.

## Final check, 2026-10-01 (branch `agent/final-check-2026-10-01`)

Objective: one pass over the description, licence wording, versions, links, manifests, the gate,
private data and open issues on a fresh clone; fix what is found.

- Fixed: README said the Fabric Agent Contract is private — it is public now; the README links its
  `docs/specification/service.md`. `package.json` gains `repository`. `scripts/make-icon.mjs`
  builds the `@2x` suffix from a constant, so org-index `check_private.py` no longer reads the
  file name as an e-mail address (outputs byte-identical after `npm run icon`). `.gitleaksignore`
  names the synthetic token in `test/mcp.test.ts`. The workflow moves to `actions/checkout@v5`
  and `actions/setup-node@v5` (the Node 20 deprecation annotation).
- Checks run: fresh clone, `npm ci`, `FD_SKIP_LAUNCHD=1 npm run check` exit 0; `check_private.py`
  exit 0; `gitleaks detect --no-git` no leaks; the README's stdio proof against the installed
  0.3.0 (`serverInfo` 0.3.0, `services` + `services_dir`, exit 0); the README's `claude -p` call
  through a throwaway `--strict-mcp-config` answered with the number of installed services, exit 0.
- Unchanged: v0.3.0 stays PolyForm (history). **Next task:** the next release (RUNBOOK) is the
  first under AGPL-3.0 or commercial.

## Repository standard and AGPL-3.0, 2026-09-30 (branch `agent/standard-agpl`)

Objective: this repository meets the PassionCode.ai repository standard (fabric-workspace
`knowledge/repository-standard.md`, org-index `scripts/check_format.py` F1–F11) and the licence of
Fabric ADR-0092 ([ADR-0007](adr/0007-agpl-or-commercial.md)).

- `LICENSE` is the AGPL-3.0 template, `COMMERCIAL-LICENSE.md` added, `CLA.md` already matched the
  template; `package.json`, `packages/service-host/package.json` and `package-lock.json` declare
  `AGPL-3.0-only OR LicenseRef-PassionCode-Commercial`.
- README: first paragraph names Fabric's role and that the app works on its own;
  `## Quick start for a new teammate` with Install / Configure / MCP / Develop; `## License` in
  the knowledge base wording (v0.1.0 MIT; v0.2.0–v0.3.0 PolyForm). AGENTS.md opens with the
  knowledge base *Read first* block, has a Commands table, and ends with *After work*.
  CONTRIBUTING and the service-host README no longer say "source-available".
- MCP proof with a real client, in a temporary directory with a temporary config (no user config
  touched): `claude -p "Call the fabric-dashboards list_services tool once and reply with only the
  number of services it returned." --strict-mcp-config --mcp-config <temp>.json --allowedTools
  mcp__fabric-dashboards__list_services --output-format stream-json --verbose --max-turns 3`
  against the installed 0.3.0 app → init `fabric-dashboards` `connected`, one `list_services`
  call, result `success`, answer `4` (the services installed on the operator's Mac), exit 0.
- Not released: v0.3.0 stays PolyForm. **Next task:** the next release (RUNBOOK) is the first
  under AGPL-3.0 or commercial; its `CHANGELOG.md` section carries a *License* line saying so.

## License change, 2026-09-29

Relicensed from MIT to `PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0`
(operator decision; commercial license on request). `LICENSE` carries both verbatim PolyForm
texts and names what stays MIT (v0.1.0 and commits up to `7fb699d`); `package.json` and the
lockfile root carry the SPDX expression; `CLA.md`, the PR template checkbox and CONTRIBUTING
say contributions are accepted under it. README no longer links the private contract and
adapter repositories. Repository homepage and topics set. Nothing released yet under the new
license: the next tag is the first.

## Deep links and the MCP server, 2026-09-29 (0.2.0, branch `agent/deep-links-mcp`)

Objective: an agent that starts work on a local service hands the operator a link that opens
that exact page inside the app, and agents use the app's own rules for administration
([ADR-0004](adr/0004-deep-links-and-mcp.md), ST-011, ST-012, SCN-026…SCN-028).

- `src/core/deeplink.ts` — `fabric-dashboards://open?service=&path=` / `?url=`, `activity`,
  overview; only installed services and paths on their own origin; `linkFor()`.
- `src/electron/main.ts` — `open-url` queued from `will-finish-launching`, argv links
  (launch and second instance), the first scan awaited, a refused link explained in a
  dialog; `setAsDefaultProtocolClient` when packaged; the renderer now pulls a navigation
  that arrived before it listened (`CHANNELS.navigateTake`) — this also fixes notification
  clicks during window load.
- `src/mcp/{tools,server}.ts` — stdio MCP server; `build/bin/fabric-dashboards-mcp` runs the
  app binary with `ELECTRON_RUN_AS_NODE=1` against `app.asar`; `scripts/dist-mac.mjs`
  registers the scheme, ships the launcher and asserts it answers `initialize` with the
  release version (receipt `checks.mcpLauncher`).
- Checks run: `npm run check` (tsc ×2, 40 unit tests incl. `test/mcp.test.ts` and
  `test/deeplink.test.ts`, brand, UX lint), `npm run test:e2e` (2 tests: the existing one,
  and a link at launch opening the signed-in page at its path + the built MCP server listing
  the live sample service, handing out the same link, reading activity, never the token).

Released as 0.2.0 (row above). Next task: move scenarios SCN-026…SCN-028 from `draft` once the
operator has used a link and the MCP server from a real session.

## Service links, 2026-09-30 (Fabric plan AR-2.5, branch `agent/service-links`)

Objective: Fabric's agent registry opens a service's dashboard here through
`fabric-dashboards://service/<id>.<instance>` (Fabric SCN-101); this app accepts that form,
keeps the 0.2.0 links working and refuses malformed or foreign targets
([ADR-0005](adr/0005-service-links.md), SCN-029, SCN-026/027 updated).

- `src/core/deeplink.ts#parseDeepLink` — the `service/` verb (region `service-link-form`),
  a global refusal of user/password/port; `linkFor()` now builds the service form and refuses a
  key or path the app would refuse. `src/mcp/tools.ts` — `open_link` null for an unreadable
  descriptor; an event link off the service's origin is dropped, not thrown.
- `scripts/check-regions.mjs` (copied from Fabric, see its header) is part of `npm run check`.
- README quick start rewritten for a newcomer; the newcomer path was checked against the
  released 0.2.0 DMG (anonymous download HTTP 200, `spctl` accepted as Notarized Developer ID,
  `codesign --verify --deep --strict` exit 0, the bundled MCP launcher answered `initialize` and
  `list_services` with exit 0).
- Checks run: `npm run check`, `npm run test:e2e` (3 tests; the third is new: the service form at
  launch and forwarded by a second process to the running app, a stopped service opening on
  Start, three refusals shown and logged without the link).
- Not released: 0.2.0 refuses `service/…` as an unknown verb. Fabric's "Open dashboard" needs the
  next release of this app installed.

Landed on `main` by fast-forward as `f338852` ([PR #3](https://github.com/passioncode-ai/fabric-dashboards/pull/3)).

## The shared service-host package, 2026-09-30 (Fabric plan AR-2.2, Dashboards half; branch `agent/service-host`)

Objective: Fabric's registry reads `services/` with the same code and the same state order as
this app, shared rather than copied ([ADR-0006](adr/0006-shared-service-host-package.md)).

- `packages/service-host` — npm workspace `@passioncode-ai/fabric-service-host` 0.1.0, private,
  not published; API in [its README](../packages/service-host/README.md). `src/core/descriptor.ts`
  and `src/core/state.ts` moved into it (git sees the renames); `probe.ts` keeps the token,
  events and login; `Launchd extends LaunchdReader` keeps the verbs; the MCP server reads through
  `lookAtServices`.
- `test-vectors/state-precedence.json` — the shared cases; run by the package
  (`test/state.test.ts`) and by the app through its own import (`test/core.test.ts`).
- `scripts/dist-mac.mjs#stageWorkspacePackages` puts the built package into the app's
  `node_modules` (`test/dist.test.ts` resolves it from a stage alone).
- Checks run: `npm run check`, `npm run test:e2e`, an unsigned `npm run dist` whose packaged MCP
  launcher answered `initialize`, and a pnpm 11 consumer installing the package from a pinned
  commit with `path:` — results in the PR.

For Fabric (not done here — Fabric is edited in its own run): add the dependency pinned to the
landed commit, allow its build in `pnpm-workspace.yaml` (the exact key is in the package README), read `services/` with
`lookAtServices`, run the vectors in Fabric's tests, and decide how the ten states map onto the
registry's six health values. `org-index/repositories.json` needs this repository's row to name
the package it now provides.

## Open

- UX scenarios are `draft` until the operator approves them from the running app.
- **Releases come from GitHub.** `fabric-agent-adapter` and `passioncode` are public since
  2026-09-29 (full-history gitleaks: 0 findings). A `v*` tag runs `release.yml`, which publishes
  through npm trusted publishing with provenance: `@passioncode-ai/passioncode@0.1.6` and
  `@passioncode-ai/fabric-agent-adapter@0.4.3` were published by `GitHub Actions
  <npm-oidc-no-reply@github.com>` with no human step; the launcher's self-update trusts that
  identity (`github-actions-oidc`).
- `http.server` asks the resolver for its FQDN between `bind()` and `listen()`; on the macOS
  runner the port stayed bound but silent. Fixed in the adapter kit (`LoopbackHTTPServer`,
  0.4.2) and in every server that used the stdlib class.
- An e2e run wrote into the operator's `~/Library/Logs/Fabric Dashboards/main.log`:
  `FABRIC_DASHBOARDS_USER_DATA` now moves `logs` too (`10948f5`, e2e asserts it).

## Known residue

- Two `enabled` launchd overrides from the first test runs remain in the operator's
  launchd database for labels `ai.passioncode.fabric-dashboards.test.<pid>.<port>`. They do
  nothing; launchctl cannot delete an override. Later runs use one fixed label.

## Checks run

`npm run check` (exit 0, 23 tests incl. a real launchd job), `npm run test:e2e` (pass),
`npm run dist -- --notary-profile fabric-notary` from `v0.1.0` (receipt above), and a real
Electron capture of an embedded dashboard at the bounds of the dashboard area.
