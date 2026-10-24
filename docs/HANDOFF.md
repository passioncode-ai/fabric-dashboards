# Handoff — Fabric Dashboards

Updated 2026-10-24 (0.7.28, see *Current release*). Earlier header: updated 2026-10-07 (0.6.2: 0.6.1 withdrawn for audit HIGH-2, audit fixes, signed feed; 0.6.1: LC-16 in detail updater, Russian by choice; 0.6.0 published 2026-10-06 21:35 UTC; release 0.5.6: third review pass, token latch; release 0.5.5 withdrawn: release audit and its second pass, A2A plan, ADR-0016, ADR-0015 data and updates, FD-05, FD-06, FD-13; Spend and DEC-0021; one entry per agent, ADR-0012; lifecycle contract landed from PR #21, unreleased; CI release rehearsal
`v0.4.1-rc.1` green; releases move to CI signing; release 0.4.1, MCP links to online services).

Current release: **0.7.28** (published 2026-10-24 11:33:56 UTC, release run 40088357869 (first attempt), tag on `34937db`, 16 assets, feed 0.7.28 for all five platforms; FD-100 the review of 0.7.26 and 0.7.27, FD-102 the console drawer race, FD-99 DOCMAP; validate run 40087732486 (five runners); the whole e2e suite 25 of 25 serially on an unlocked screen; update-proof 0.7.27 → 0.7.28 green on Windows x64/arm64 and Linux x64/arm64, run 40090469079; the installed copy had 0.7.28 verified and ready at 11:39:40 UTC). Before it **0.7.27** (published 2026-10-23 15:42:59 UTC, release run 39976504101 (first attempt), tag on `3c33e2d`, 16 assets, feed 0.7.27 for all five platforms; FD-97 the contract's CT-115; validate run 39975607810 (five runners); update-proof 0.7.26 → 0.7.27 green on Windows x64/arm64 and Linux x64/arm64, run 39980753654). The installed copy on this Mac installed 0.7.26 at 21:14:50 UTC and 0.7.27 at 21:22:39 UTC (`main.log`, FD-98). Before it **0.7.26** (published 2026-10-23 13:28:36 UTC, release run 39955756486 (attempt 3), tag on `a849b72`, 16 assets, feed 0.7.26 for all five platforms; FD-93 the Load tab; validate run 39954852975 (five runners); update-proof 0.7.25 → 0.7.26 green on Windows x64/arm64 and Linux x64/arm64, run 39961602018; the installed copy had 0.7.26 verified and ready at 13:33:35 UTC and installs it after 10 hidden minutes). Attempt 1 failed at the Windows x64 NSIS smoke (FD-95, a flake), attempt 2 at Windows signing from a stale module cache (FD-96, cache deleted). Before it **0.7.25** (published 2026-10-23 01:26 UTC, release run 39881071771, tag on `8ff35de`, 16 assets, feed 0.7.25 for all five platforms; FD-92 the console drops down over the dashboard; validate run 39878373685 (five runners, four packages); update-proof 0.7.24 → 0.7.25 green on Windows x64/arm64 and Linux x64/arm64, run 39884146164; the installed copy had 0.7.25 verified and ready at 01:27:35 UTC and installs it after 10 hidden minutes; fabric-workspace status and cells at `0ca126ef`). Before it **0.7.24** (published 2026-10-22 17:59 UTC, release run 39822528190, tag on `1a4f255`, 16 assets, feed 0.7.24 for all five platforms; FD-86; validate run 39815526828; update-proof 0.7.23 → 0.7.24 green on Windows x64/arm64 and Linux x64/arm64, run 39830229014; the installed copy updated itself at 18:11:22 UTC). Before it **0.7.23** (published 17:24 UTC, release run 39815515224, tag on `86d986a`; FD-88; validate run 39796015425; update-proof 39822565104: Windows x64/arm64 and Linux arm64 green, Linux x64 hung on its FUSE install step and was cancelled, superseded by the 0.7.24 proof). Before it **0.7.22** (published 2026-10-22 12:05 UTC, release run 39771794219, tag on `1c6a463`, 16 assets, feed 0.7.22 for all five platforms; FD-85; validate run 39768428219 (five runners, four packages); update-proof 0.7.21 → 0.7.22 green on Windows x64/arm64 and Linux x64/arm64, run 39775657986; the installed copy had 0.7.22 verified and ready at 12:06:51 UTC and installs it after 10 hidden minutes). Before it **0.7.21** (published 2026-10-22 01:51 UTC, release run 39705355851, tag on `eee6499`, 16 assets, feed 0.7.21 for all five platforms; FD-84; validate run 39702742683; update-proof 0.7.20 → 0.7.21 green on Windows x64/arm64 and Linux x64/arm64, run 39708104854; the installed copy updated itself at 02:05:55 UTC). Before it **0.7.20** (published 2026-10-21 23:21 UTC, release run 39689533974, tag on `dff0396`, 16 assets, feed names all five platforms; FD-83 sessions stopped on a limit continue by themselves, FD-82; five-runner validate with packages run 39686310437; update-proof 39693581937). Before it **0.7.19** (published 2026-10-21 16:39 UTC, release run 39631756000, tag on `7d59d46`, 16 assets; FD-81 the auditor and the Connections page, CT-70 DEC-0096, FD-80, the design pass; update-proof run 39636863363; the installed copy updated itself at 16:58:37 UTC). Before it **0.7.18** (published 2026-10-21 06:53 UTC, release run 39554944418, tag on `b89b4d0`, 16 assets; review fixes, MCP `connections`, pre-encryption cookies, FD-79; five-runner validate with packages run 39528982778; update-proof 0.7.17 → 0.7.18 green on Windows x64/arm64 and Linux x64/arm64, run 39558333159; the installed copy has it ready since 06:54 UTC, held by FD-80). Before it **0.7.17** (published 2026-10-20 15:27 UTC, release run 39444198417, tag on `13c7954`, 16 assets, feed names all five platforms; FD-78; five-runner validate with packages run 39421552370; update-proof 0.7.16 → 0.7.17 green on Windows x64/arm64 and Linux x64/arm64, run 39448605547; the installed copy on this Mac had 0.7.17 verified and ready at 15:33:58 UTC after two unpack failures on a nearly full disk, FD-79). Before it **0.7.16** (published 2026-10-20 04:23 UTC, release run 39365807902, tag on `8554563`, 16 assets, feed `currentRelease` 0.7.16 for all five platforms; FD-77 CT-62 adopted, FD-76 false pairs fixed; five-runner validate with packages run 39363151206; update-proof 0.7.15 → 0.7.16 green on Windows x64/arm64 and Linux x64/arm64, run 39369495692; the installed copy on this Mac downloaded and verified 0.7.16 at 04:26 UTC and installs it after 10 hidden minutes). Board: announced on thread `eece7d67` (message `d6607885`), replies sent on threads `16e6c000`, `c0c81043`, `c764dc65`, `35ae94b5`, `2074dafc`. Before it **0.7.15** (published 2026-10-19 19:48 UTC, release run 39308999139, tag on `ba7b192`; FD-04 cookie encryption on macOS and Windows, FD-76 the operator's Telegram rule; five-runner validate with packages run 39282535662; the macOS signing step first failed on Apple's timestamp server and passed on rerun; receipts read fuses `110011011` on macOS and Windows, `100001011` on Linux; update-proof 0.7.14 → 0.7.15 green on Windows x64/arm64 and Linux x64/arm64, run 39314173631; the installed copy on this Mac updated itself at 20:10:02 UTC). Before it **0.7.14** (published 2026-10-19 10:48 UTC, release run 39236764321, tag on `b81fa4f`; FD-75; five-runner validate run 39236141683; update-proof 0.7.13 → 0.7.14 green on Windows x64/arm64 and Linux x64/arm64, run 39240157928; the installed copy on this Mac had 0.7.14 verified and ready at 10:52 UTC and installed it by itself at 13:25:26 UTC, `main.log` `update_install installed from=0.7.13 to=0.7.14`). Before it **0.7.13** (published 2026-10-19 04:47 UTC, release run 39198859807, tag on `5c94309`; FD-74 and FD-73; five-runner validate run 39198344093 green before the merge; update-proof 0.7.12 → 0.7.13 green on Windows x64/arm64 and Linux x64/arm64, run 39201311219; the installed copy on this Mac downloaded and verified 0.7.13 at 04:50 UTC and installs it once its window has been hidden 10 minutes or at quit). Before it **0.7.12** (published 2026-10-18, release run 39074381369, tag on `08d64c6`; FD-72, the organization's lifecycle rule: opens at login by default and checks it every launch, update check every 5 minutes with a quiet check logged once, a «Restart to finish updating» notification; its publish step first failed on a sigstore network timeout and passed on rerun; update-proof 0.7.11 → 0.7.12 green on Windows x64/arm64 and Linux x64/arm64, run 39090644803). Unreleased on main: FD-73 (no em dash in the interface, a test guards it). FD-71 closed: Switchboard 0.6.37 removed the stall. Before it **0.7.11** (published 2026-10-17, release run 39024882762, tag on `956186f`; FD-70 — a failed read names its cause; update-proof 0.7.10 → 0.7.11 green on Windows x64/arm64 and Linux x64/arm64, run 39026714341). Its first five-runner validate (run 39023536342) failed on both Windows runners: the FD-70 test ran `/bin/sh`; fixed by skipping that case on Windows (the cause words are checked on every OS). Lesson: a test that spawns a POSIX path carries a win32 skip — #147 had landed after a local macOS check only. Before it **0.7.10** (published 2026-10-14 17:56 UTC, run 38606788342, tag on `3cf8ea1`; FD-65 Check setup, FD-66, FD-69). Before it 0.7.9 (FD-62), 0.7.8 (FD-64, FD-63), 0.7.7 (the board waves). Before them, 0.7.6 (published 2026-10-12 04:12 UTC, run 38200511483, tag on `5f2fcbe`; the bug wave: Windows helpers outlive the app, the AppImage restarts itself; DEC-0044 setup flag). Before it, 0.7.5 (FD-48 outage alerts, Reload signs in). Before it, 0.7.4 (published 2026-10-11 20:01 UTC, run 38168481474; FD-37 M4a–M4c). Before it, 0.7.3 (published 2026-10-11 16:59 UTC, run 38156472858; FD-45, FD-47; carries 0.7.2, tagged and not published). Before it, 0.7.1 (published 2026-10-11 11:34 UTC, run 38106066248; FD-37 M1–M3, FD-39, FD-41; carries 0.7.0, tagged and not published). Before it, 0.6.7 (published 2026-10-09 17:07 UTC, run 37955575384; FD-36, FD-35, FD-38). Before it, 0.6.6 (published 2026-10-09 10:08 UTC, run 37864378854; FD-34, FD-35). Before it, 0.6.5 (published 2026-10-08 01:18 UTC, run 37703405621; FD-29, FD-33). Before it, 0.6.4 (published 2026-10-07 01:57 UTC, run 37558793926; carries 0.6.3, superseded before approval). Before it, 0.6.2 (published 2026-10-06 23:41 UTC, run 37541067349; 0.6.1 withdrawn). Before it, 0.6.0 (published 2026-10-06 21:35 UTC, run 37505569449); Before it, 0.5.6 (2026-10-06); the 0.4.1 section below is the previous one. Earlier releases below are preserved as dated evidence.

## 0.8.0 iteration: start here (2026-10-24, FD-104 the UI and UX iteration, FD-103 the Sessions mode)

**Objective:** the UI and UX iteration 0.8.0 ([iteration](reports/2026-10-24-ui-ux-iteration/README.md), 126 findings)
plus the operator's review of 2026-10-24: coding sessions get a mode of their own beside the agents
([dossier](reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md)). Integration branch `feat/ui-ux-0.8.0`; no
release yet (the Unreleased section of [CHANGELOG](../CHANGELOG.md) says what 0.8.0 changes for a user).

**Landed on `feat/ui-ux-0.8.0`:** W1a theme and accessibility (`fecb128`), W1b words and brand pack (`b0d90c2`), S1 the
Sessions mode's scenarios (`8c95337`), S2 its data layer (`6564e11`), W2 one count of what needs attention (`becc491`),
W4a FD-101 spend sums and a safe e2e (`f1b62ef`), S3 the Sessions mode's window (`64c54ce`), review round 1's packet
(`48a1313`, [review-round1.md](reports/2026-10-24-ui-ux-iteration/review-round1.md)).

**In progress, round 1 fixes:** FIX-1 (the code rows R1-U1 to R1-E1) on its own branch; DOCS-1 (rows R1-P2 to R1-P12
and the rest of W4) on `feat/ui-ux-docs1`: scenarios and screens quote the strings `src/core/i18n.ts` has, one count of
what needs attention (SCN-006, SCN-023), SCN-022's 5-minute check, the default-on login item (SCN-001, SCN-024,
SCR-01, SCR-04), SCR-10 as the drawer, SCN-052 on Windows and Linux, SCN-019, SCN-020 and SCN-043 promoted with their
tests (SCN-044 stays draft: no test moves a copy), the brand pack in DOCMAP and AGENTS.md, CHANGELOG Unreleased rewritten
for a user, and one string, `audit.limit.tripped`, now "Its spending limit stopped work ({limit})." in both languages
(voice rule 4).

**Open (FD-104 lists them):** the Sessions strings say "Terminal" on Windows and Linux too, the hand-over busy sentence
does not name Linux's swap refusal, and an idle-closed agent console continued from its own console leaves its ended
row in Sessions beside the running one (SCN-066); all three are recorded in the scenarios and wait for round 2.

**Checks run (DOCS-1):** `python3 docs/ux/lint.py` exit 0; `nice -n 10 env FD_SKIP_LAUNCHD=1 npm run check` exit 0
(697 tests, 691 passed, 6 skipped, 0 failed; brand pins, 154 code regions, UX lint).

**Next task, in order:** merge FIX-1 and DOCS-1 into `feat/ui-ux-0.8.0` and run `npm run check` on the merge; review
round 2 over the merged branch, with a visual tier (the contact sheet of the Sessions mode and the changed agent screens,
both themes) and an adversarial round on the Sessions mode (hand-overs, limit stops, Remove and Clear, a restart in the
middle); fix what it finds; then the whole e2e suite serially on an unlocked screen, validate on five runners, and
release 0.8.0 by RUNBOOK §Release.

## 0.7.28: start here (2026-10-24, FD-100 the review, FD-99 DOCMAP)

**Objective:** the operator asked to finish, check for errors and bugs, fix what is unfinished and update the docs. Run
through task-pipeline (brief: REQ-1 and REQ-2 blind readings of FD-93 and FD-97, REQ-3 fixes with tests seen failing,
REQ-4 DOCMAP, REQ-5 docs and release).

**Done:** three blind readings (unit, seam, product); three blocking findings and the risks worth fixing are fixed (the
FD-100 row lists them), each with a test red on the old code; `docs/DOCMAP.md` (FD-99); ADR-0024 and ADR-0013 amended;
screens.md, SCN-037, SCN-076, SECURITY.md, README, CHANGELOG brought in line.

**Checks run:** `npm run check` 627 tests, 0 failures; the new tests red on the old code; `test/e2e/load.test.ts` green
and its fallback step red without its fix; validate run 40054746805 green on all five runners at `0a4ea42`.
**Update 2026-10-24 10:25 to 11:30 UTC:** the whole suite ran serially on an unlocked screen: 24 of 25; the one failure was FD-102 (a pre-existing race in the console drawer, fixed in the same release); with the fix 25 of 25, then tagged and released. **Earlier, why the tag waited:** the whole e2e suite (a change to the shared service page). It was stopped after
4 of 25 files passed (none failed) because the Mac ran out of disk and swap (130 MB free, swap 14.9 of 15.1 GB used):
the suite runs files in parallel, each with its own Electron. **First task:** once there is room (several GB free and
swap not full, which only closing idle sessions or a reboot gives back), `npm ci && npm run build && node --import tsx
--test --test-concurrency=1 test/e2e/*.test.ts`, then tag `v0.7.28` on the merge commit and follow RUNBOOK §Release.

**Next, in order:** FD-101; FD-98 (deferred until a test can prove it); FD-96 waits on thread `f10db6ee`; FD-58's next
step (read Observatory 0.29.0's `node.lifecycle` schemas); FD-95 at its next miss.

## 0.7.27: start here (2026-10-23, FD-97 an unpriced subscription is unknown)

**Objective:** the contract's first release (`v0.1.0+2026-10-23`, board thread `147a5538`) asked each project to answer;
its CT-115 asked Dashboards to read an unpriced subscription row as `null` or a lower bound, as DEC-0110's `usageSpend`.

**Done:** the estimate reads like the money (ADR-0013 amendment): null when no subscription call is priced, a lower
bound when some are not; shared package 0.8.0. `test/e2e/spend.test.ts` passed whole on an unlocked screen
(2026-10-23 22:4x UTC).

**Next, in order:** thread `147a5538` answered (FD-97 done, DEC-0109 not affected); FD-98 deferred until a test can prove it (its row says which; seen on this Mac as predicted, two restarts at 21:14 and 21:22 UTC); `test/e2e/spend.test.ts` passed whole on an unlocked screen; FD-58 is closer (Observatory 0.29.0 serves `node.lifecycle`); FD-96 waits on thread `f10db6ee`; FD-95 at its next miss;
FD-80's other half; FD-87 (b) after Fabric CO-321.

## 0.7.26: start here (2026-10-23, FD-93 how busy an agent is)

**Objective:** the operator asked to finish everything autonomously and release. The board and the backlog had no open
task that was not blocked on another system; the contract's DEC-0104 (merged 2026-10-23) names Fabric Dashboards as
the host that draws an agent's load, so that is this release.

**Done:** `@passioncode-ai/fabric-service-host/load` 0.7.0 (declaration check FAC-SEM-133, report check: schema then
FAC-SEM-132, the sums), the main-process read with the descriptor token (S-1, LC-08), the Load tab, MCP `load`,
SCN-076, ADR-0024, the 15 contract fixtures copied byte-identical at `87d384ff`. One defect caught by the e2e before it
shipped: the strip compared a sum across contexts with a per-context limit ("5 of 4"); now "of N" only for one context,
and a context at its limit marks the sum.

**Release lessons (FD-94 to FD-96):** windows-11-arm's PowerShell 5.1 starts in about a minute, so `validate.yml`
starts it once before the gate; a clean `main` showed the same two failures, which is how it was told apart from a
regression. A re-run of a Windows package job reads the signing module from a cache that does not load: delete the
tag's `ArtifactSigning-0.1.8` cache before re-running.

**Next, in order:** FD-96 (the signing action's owner was told on thread `f10db6ee`; the workaround is in RUNBOOK §Release); FD-95 at its next miss;
FD-80's other half (a window on another Space) when Electron exposes it; FD-87 (b) after Fabric CO-321; the first real
load report when a node queues (Fabric CO-376, adapter FAA-103): decide then whether a full
queue belongs in Needs attention (ADR-0024 "Not decided here"); thread `e99aa05f` for the contract's answer (FD-88).

## 0.7.25: start here (2026-10-23, FD-92 the console drops down over the dashboard)

**Objective:** the operator asked that the console stop moving the screen: it opens over the dashboard like a tab
from the top, the same button folds it (nothing stops), and a separate red cross closes it.

**Done:** ADR-0017 amendment; the console is a drawer in its own `WebContentsView` above the dashboard (a page
drawn in the window would lie under the dashboard's native view); the dashboard keeps its bounds; height by the
bottom edge, remembered; fold and close are two controls; Setup and hand-over consoles the same. SCN-048 rewritten,
SCN-060 retired. One defect found by the e2e on the way: IPC senders compared by object never matched a view's
webContents; compared by id now.

**Next, in order:** FD-90 (read the diagnostics at the next miss); FD-82; FD-80's other half; FD-87 (b) after Fabric
CO-321; thread `e99aa05f` for the contract's answer (FD-88).

## After 0.7.24: start here (2026-10-23, FD-91, and the scenarios on an unlocked screen)

The screen was unlocked after midnight, so the e2e ran on the running app: SCN-071 to SCN-075 validated (PR #185;
SCN-075 passed 8 of 10, FD-90), `test/e2e/spend.test.ts` passed whole twice at load 9 to 18 (FD-88's assertions and the
FD-05 Dock check), and the full suite (24 tests) found one regression of 0.7.24: FD-91, the SCN-042 fold after FD-86's
grouping: the app was right (it counts lines), the test's expectation was stale; fixed in PR #186 after its e2e ran on the running app (22:57 UTC unlock: SCN-042 2/2, full suite 22/24 with two load misses that pass alone). No release needed. **Lesson:** a change to a shared screen runs the whole e2e suite before its release.

**Next, in order:** FD-90 (read the diagnostics at the next miss); FD-82 (Dock check above load about 60); FD-80's other
half when Electron exposes it; FD-87 (b) after Fabric CO-321; thread `e99aa05f` for the contract's answer (FD-88).

## 0.7.24: start here (2026-10-22, FD-86 the dashboard perception review)

**Done:** the app reviewed against the eight principles of board thread `89bbc415` (result per principle in the FD-86
row). Two changes: agents in one state for one reason fold into one line in Needs attention (`src/core/attention.ts`,
SCN-006), and no value is shown as a bare dash. Principle 7 holds by design (MCP-run commands never reach the queue).

**Later the same evening:** FD-89 done (PR #183: `npm test` installs Electron's binary first; a fresh checkout's
first `npm run check` passes); SCN-066 marked validated in the scenarios index too (PR #182); the release announcement
for 0.7.22 to 0.7.24 posted on thread `eece7d67`; the contract asked for a host rule on subscription rows (thread
`e99aa05f`, FD-88).

**Next, in order:**
1. FD-02: run `test/e2e/focus-console.test.ts` and `test/e2e/connections.test.ts` on an unlocked screen and mark
   SCN-071 to SCN-075 validated (the screen was locked at 19:0x UTC; e2e refuses then, `scripts/check-screen.mjs`).
2. FD-82: the Spend e2e Dock check under load above about 60 (also needs an unlocked screen).
3. FD-80's other half when Electron exposes it; FD-87 (b) after Fabric CO-321.
4. Read thread `e99aa05f` for the contract's answer on FD-88.

## 0.7.23: start here (2026-10-22, FD-88 Spend shows money, not a subscription's list price)

**Found on the board** (thread `ea2e4f3d`, 13:45 UTC): an agent's usage report marks its calls on the operator's own
subscription `route: subscription`, and Spend summed their list-price `costUsd` as money ($147.26 read, $6.80 spent).
**Decided (ADR-0013 amendment, by DEC-0046's "not metered"):** money excludes subscription rows; their value is shown
apart as an estimate; a row with no route stays money. Shared package `@passioncode-ai/fabric-service-host` 0.6.0.
Also on 2026-10-22: 0.7.22 installed itself on this Mac at 12:48:38 UTC, and Switchboard 0.6.64 (SB-166) answered our
`recovery` finding (`1cf4538e`); no failed limit-stop read since 0.7.22 started.

**Next, in order:** FD-86 (due 2026-10-29); FD-02; FD-80's other half; FD-87 (b) after Fabric CO-321.

## 0.7.22: start here (2026-10-22, status sweep, FD-85 to FD-87)

**Objective:** the operator asked (2026-10-22) to check what earlier sessions did and left, finish what is unfinished,
fold it into this plan and report the product's status into fabric-workspace (`docs/reports/2026-10-22-passioncode-status/fabric-dashboards.md`,
board thread `e204b5b5`), the single place every PassionCode agent now reports to.

**State found:** installed copy 0.7.21 (since 02:05:55 UTC, updated by itself), no open pull requests, no leases, the
three continued stops from FD-84 as recorded in the 0.7.21 section. Two defects (FD-85): the nightly validate of
2026-10-21 (run 39696581052) failed on `ubuntu-24.04-arm` in `LC-10: after an update replaces the bundle …` ("no
reply 2"): a real race where a server leaving for an update dropped the next call instead of answering `stale`; and
the limit-stop read logged its failures (17 on 2026-10-22, from 00:17 to 10:58 UTC) but never its recovery. Four board
asks had no answer from Dashboards: `89bbc415` (dashboard perception principles, now FD-86), `b2511678` / `c938af7d`
(Mac Studio readiness, now FD-87), `7bd4dfac` (cross-session messages, not affected: `setup_check` and Check setup
already run the launcher's doctor) and `e204b5b5` (the status file).

**Done:** FD-85 fixed with two tests, both red on `main` and green with the fix (PR #177, merge `1c6a463`); FD-86 and FD-87
filed with what already holds; 0.7.22 released and proven (see *Current release*). Board replies sent 2026-10-22 11:37
UTC on `7bd4dfac`, `89bbc415`, `b2511678` (Fabric's hub had answered `stack-unavailable` for a few minutes before).
Status file in fabric-workspace `docs/reports/2026-10-22-passioncode-status/fabric-dashboards.md`, with the 0.7.22
cells in `knowledge/products.md` and `knowledge/roadmap.md`.

**Next, in order:**
1. FD-86 by 2026-10-29: review Overview, the agent page, Spend and the channel against principles 1, 2, 3, 4 and 7,
   scenarios first.
2. FD-02: validate the remaining scenario drafts on the running app (SCN-071 to SCN-075 first).
3. FD-80's other half (a window on another Space), when Electron exposes it; FD-87 (b) once Fabric CO-321 lands.
4. Switchboard's `recovery` read still exceeds 30 s under load (finding on thread `1cf4538e`, unanswered).

## 0.7.21: start here (2026-10-22, FD-84 a continued session must run in its own home)

**Found on the installed 0.7.20 (23:43 UTC):** it took three ready stops and recorded all three `resumed`, but two exited
with 1 at once (Switchboard allows one managed session per provider and pool: "Close the existing session before
changing its home.") and the third ran without its conversation (a managed launch sets `CLAUDE_CONFIG_DIR` to
`runtimes/claude-<pool>`, where the transcript is not; its transcript in `~/.claude/projects` was not written after).

**Fixed (branch `fix/fd84-resume-own-home`):** the runtime's own CLI in the stop's folder (`claude --resume <id>
<brief>`), which reads the person's own home and, in a bound folder, goes through Switchboard by the folder's settings;
only a stop whose transcript is in that home is taken (`no-transcript` otherwise); `resumed` only after 15 s alive,
else `cancelled`. Then made systemic: `resumed` is recorded only on the effect, the session running AND its own
transcript written since the start (30 s), checked on the real Claude Code (written 1.5 s after the start on a PTY);
the unit and e2e fakes write their transcript like the real CLI; the read of `switchboard --json recovery` waits
30 s (it took 12 to 15 s in 2 of 5 reads; 4 "cannot be read" lines in 0.7.20's first hour).

**Root cause, and the lesson:** the continuation rested on an assumption about another tool's environment (that
Switchboard's managed launch reads the person's Claude home) that no test exercised: the e2e fake answered the command
and modelled nothing behind it, and success was recorded at start rather than on an observed effect. Rule kept here:
an outcome reported to another system is recorded on its observed effect, and a fake of an external CLI reproduces
the effect the code depends on. Decision: never the managed launch for a continuation.

**Proven on this Mac:** the three stops 0.7.20 marked `resumed` were registered again at 02:06 UTC
(`switchboard recovery register`, events `fd84-<session>-<unix>`). At 02:07:12 UTC 0.7.21 continued `3e6d811f` in its
agent's console: `claude --resume` pid 77821 alive, its transcript in `~/.claude/projects` written at 02:07:21 UTC.
`a85f325d` is listed open (another live Claude works in its folder), `436e7b56` waits for an account with capacity.
Board: findings to Switchboard on thread `1cf4538e` (slow `recovery` reads, managed launch unfit for a continuation).
Cleanup: merged branches deleted on the remote (`chore/enroll-family-routes`, `feat/fd83-limit-recovery`,
`fix/fd84-resume-own-home`), the worktree removed, three expired leases of other runs (9 to 10 days old) taken over and
released; no lease left.

**Next, in order:**
1. FD-80's other half (a window on another Space), when Electron exposes it.
2. FD-02: validate the scenario drafts on the running app, SCN-071 to SCN-075 first.
3. The knowledge-base rows for 0.7.19 to 0.7.21 wait on fabric-workspace (request `638b8620`).

## 0.7.20: start here (2026-10-22, FD-83 sessions stopped on a limit continue by themselves)

**Objective:** the operator asked (2026-10-21) that agents stopped on a usage limit come back by themselves. Switchboard
registers each stop (SB-115) and names this app's console the host that acts on `ready` rows; nothing acted on them.

**Done (PR #174, branch `feat/fd83-limit-recovery`):** `src/core/recovery.ts`; `ConsoleHost.pollRecovery` on the
hand-overs' tick claims a ready stop once, continues it with `switchboard launch … --in-place -- --resume <session>
<brief>` and records `finish resumed` (`cancelled` when the console cannot start). Guards: no claude or codex process
works in its folder (`lsof` cwd) and none names its session (`ps`), unknown live state counts as open; at most two a
pass; within 24 h of the stop; LC-17 admission. Settings switch `resumeAfterLimit` (on); Connections lists every stop
with why; MCP `audit` answers `limitStops`. SCN-075. Also removed `.sb-orgs-check.mjs`, another project's script
committed by mistake in #173.

**Decisions made (mine, recorded here):** default on (the operator's ask); 24 h cap (an older stop's task may be done);
two a pass (a reset never opens every console at once); a folder with any live agent counts as open (two writers on one
transcript is what SB-115 forbids; a false "open" costs a typed "continue", a false "closed" costs a broken transcript);
the claim takes Switchboard's first candidate, the session runs managed so the pool keeps rotating.

**Found on the way:** `lsof` exits 1 while listing when some process is unreadable; treating that as failure made every
stop look open. Fixed and tested.

**Checks run:** `npm run check` exit 0 (605 tests); `test/e2e/connections.test.ts` 2/2, the FD-83 test 4 more times
alone (one timeout under load at the 40 s heading wait, raised to 60 s); dry run on this Mac 2026-10-22: 31 waiting
stops = 22 waiting for capacity, 6 open (their agents run now), 3 older than a day, so none would be resumed now.

**Next, in order:**
1. **Released:** #174 merged (`dff0396`) after validate run 39686310437 (five runners and packages) was green; tag
   `v0.7.20`, release run 39689533974 green, published 2026-10-21 23:21 UTC (16 assets, feed 0.7.20 for all five
   platforms); update-proof 0.7.19 → 0.7.20 run 39693581937; the installed copy started downloading 0.7.20 at 23:22 UTC.
   Installed on this Mac at 23:43:01 UTC (`update_install installed from=0.7.19 to=0.7.20`); update-proof 39693581937
   green on Windows x64/arm64 and Linux x64/arm64. Its first real run found FD-84 (next section).
2. **FD-82 done** in the same release: the Spend e2e waits up to 30 s for the Dock (4 runs green at load 46 to 52).
   Backlog statuses now follow the releases (FD-04 done by 0.7.18 at 09:20:19 UTC, FD-76 to FD-81 released).
3. Next open rows: FD-80's other half (a window on another Space, waits on an Electron API); FD-02 (validate the
   remaining scenario drafts on the running app, SCN-071 to SCN-075 among them).
4. The knowledge-base rows for 0.7.19 and 0.7.20 wait on fabric-workspace (request `638b8620`). The direct message
   to its session expired unapproved (2026-10-21); the board roll-call thread carries the same ask.
5. Agents pushed on 2026-10-21 at 23:10 UTC: 9 idle sessions messaged (4 delivered at once, 4 after the operator's
   approval, fabric-workspace expired), and the operator's call posted on roll-call thread `1316a045` (`09c46611`).

## 0.7.19: start here (2026-10-21, FD-81 the auditor and the Connections map, FD-80)

**What it carries:** the auditor (every problem across the estate, worst first, by the agent to fix), *Fix with agent*
in the runtime the person picks (Claude Code by default; task kind `audit`), the Connections page with the estate map,
MCP `audit` and `setup_check`, README's app-to-MCP table, a design pass (workbench discipline on the PassionCode tokens:
switches for on/off, one strip atom on Overview and Spend, a quiet setup line, aligned selects), and FD-80 (a window of a
hidden app counts as not shown; a held update logs why). ADR-0023, SCN-074.

**Decisions made:** a chain finding sits on the caller but offers no session there (the fix goes where the cause is);
pin, kind and hide stay the person's (MCP reads them); starting a console stays the person's (it spends their
subscription); the vendored brand tokens stay, the workbench pack lends only its discipline (no second palette).
Also found and fixed: the Updates setting said "every 6 hours" (it is 5 minutes since 2026-10-17).

**Checks run:** `npm run check` and the full e2e suite (see the PR); screenshots of Overview, Settings, Spend and the
Connections page looked at.

**Next, in order:**
1. **Released and proven** 0.7.19 (published 2026-10-21 16:39 UTC, tag on `7d59d46`, release run 39631756000;
   validate run 39622817738; update-proof 0.7.18 → 0.7.19 green on four runners, run 39636863363); the installed copy
   updated itself at 16:58:37 UTC. Announced on `eece7d67` (`e09077eb`); CT-70 answered on `131648c0` (`d8904a3f`);
   the knowledge-base rows asked of fabric-workspace (request `638b8620`), which holds their leases. FD-04 is done
   (20 cookies rewritten, 0 plaintext left).
2. **FD-83** next: the console as the host that resumes sessions stopped on a limit (21 were ready on 2026-10-21, none
   resumed: Dashboards reads hand-overs, not recovery rows). Five idle peer sessions were told to continue by message.
2. FD-80's other half (a window on another Space), when Electron exposes it; FD-04's close (the installed copy's cookie
   rewrite log) once it runs 0.7.18 or later.
3. **Done:** the contract decided `connections` as DEC-0096; 0.7.19 runs its 127 vectors (CT-70). Answer CT-70 on
   thread `131648c0` with the release.

## 0.7.18: start here (2026-10-21, review of FD-76, FD-77, FD-78)

The operator asked to check everything done on 2026-10-20, find mistakes, drift and gaps, fix them and release.

**Found and fixed:**
- **FD-78 gaps.** Agents could not read the new list or graph: MCP `connections` added, `list_services` and
  `service_status` carry `category` and `hidden` (read from the app's settings, never written). "Used by" listed an
  agent once per declared call (duplicate React keys): one row per agent now. The row menu sat inside the scrolling
  list and was cut off at its bottom: it is placed against the window and opens upward near the bottom. In the narrow
  rail the Hidden fold was hidden with the section headers: it is an entry of its own there.
- **Documentation drift.** README, SCN-033 and SCN-057 still named the removed *Background* section; ADR-0012 §5 said
  so too (amended); the decision itself had no ADR (ADR-0022 now); two unused interface strings removed.
- **FD-79.** An update that cannot be unpacked now names the free and needed space, or the tool's own words.
- **FD-04 step 2 held, and a gap behind it.** On the installed 0.7.17 a dashboard was opened through MCP `open`
  (01:26 UTC): 0 SecurityAgent events, no right asked by Dashboards, the Keychain item read and not recreated (`mdat`
  2026-10-19 20:10:03 UTC), new cookies `v10`. But 16 cookies stored before 0.7.15 were still plaintext in 12
  partitions: 0.7.18 writes them back once at start (`cookieRewrite`, `.cookies-reencrypted`, SECURITY.md).
- **The row menu was off screen in the first build of this fix**: `position: fixed` inside the row's transformed box
  took that box as its frame. Found by the full e2e run, fixed by dropping the transform; the e2e now checks that
  the menu opens on screen (`23a-row-menu`).
- **The full e2e suite** (23 tests) was not run for 0.7.17, only two files of it. Run now: green after the fix above.
  `LC-10: a session that ends mid-command…` and the Spend test's Dock check fail under a load average above 300 and
  pass alone; on `main` they fail the same way, so they are load, not this change.
- **Not changed, checked:** FD-76's alert timing (the 0.7.16 fix holds: `alerts: sent` from the install at 09:57 UTC
  to 01:00 UTC is 6 messages, three real outages each told once with "back" 16 to 28 minutes later, no false pair); CT-62's fixture still byte-identical at the contract's `c55f2d5`.

**Next, in order:**
1. **Released** 2026-10-21 06:53 UTC (run 39554944418, tag on `b89b4d0`, 16 assets); five-runner validate run
   39528982778; update-proof 0.7.17 → 0.7.18 green on Windows x64/arm64 and Linux x64/arm64 (run 39558333159);
   fabric-workspace products and release-train rows (PR #326); wiki page updated; announced on `eece7d67` (`139dc1ea`).
   The installed copy has 0.7.18 verified and ready since 06:54 UTC and has not installed it: FD-80.
2. **FD-80** next: a window that is not on screen holds the automatic install, silently.
   Also fixed now: a private agent's name had reached the public tree in FD-78's package README and test (merged in
   #168); replaced by `example-notifier`. The pre-commit private guard caught it on the next commit, not on #168:
   the name joined the operator's local denylist only on 2026-10-21 06:55 UTC (the file's modification time).
3. After the installed copy runs 0.7.18: `main.log` has `dashboard cookies written back for encryption: N rewritten, 0
   failed`, and a count over `Partitions/*/Cookies` finds no plaintext cookie; then close FD-04.
3. Re-pin `connections` when the contract decides (thread `131648c0`).

## 0.7.17: start here (2026-10-20, FD-78)

**What 0.7.17 carries (FD-78, operator 2026-10-20):** the list split into On this Mac, Online and Services, a row
menu (pin, agent or service, hide), hidden agents folded at the bottom (still watched and alerting), and a Connections
tab on every agent with the chain through the agents it reaches. Scenarios SCN-071 to SCN-073 (draft).

**Decisions made:** connections travel under `extensions` (as the dashboard profile, DEC-0036 ED-9), key
`extensions/connections/0.1`, so a reader that does not know it ignores it; Dashboards reads it now and re-pins when the
contract decides (proposal on board thread `131648c0`). A product with no dashboard is a service unless the person says
otherwise. Hidden agents keep their alerts (a person hides for room, not to silence).

**Checks run:** `npm run check` exit 0 (587 tests); `test/e2e/connections.test.ts` and `test/e2e/focus-console.test.ts`
green on the built app; screenshots looked at (the summary counts the agent's own state; tabs keep their room).

**Next, in order:**
1. **Released** (see the line above). Board: iteration closed on thread `0abdfd6f` (message `d1f9a5f1`), announced on `eece7d67` (`ce2d34c3`).
2. When the contract decides `connections`: pin its schema and fixtures, adjust `connectionsErrors`, promote SCN-073.
3. MCP: a `connections` tool and the kind and hidden state in `list_services` (FD-78 next).
4. **FD-04 step 2, not yet proven.** The installed copy went 0.7.15 → 0.7.16 at 09:57 UTC with the Keychain item unchanged
   (`cdat` = `mdat` = 2026-10-19 20:10:03 UTC) and no authorization right asked by Dashboards (`authd` 06:00 to 17:40
   local: screensaver unlocks, mdmclient, Safari, InternetSharing only). But no dashboard was opened after the install,
   so the item was not read yet. Proof: open any dashboard on the installed copy, then the same `authd` and `mdat` read.
   Note: `log show` takes local time (UTC+2 now).
5. **FD-79**: an update that cannot be unpacked must name why (the disk was nearly full).

## 0.7.16: start here (2026-10-20)

**What 0.7.16 carries:**
- **FD-77, contract CT-62** (DEC-0091, fabric-agent-contract PR #127, merged 2026-10-20 02:10 UTC). A usage report's
  optional `unmeasuredCalls` is checked (a count, at most `calls`), every sum carries `tokensPartial`, and Spend reads
  «≥» before a model's tokens with a note in English and Russian. The MCP `spend` tool returns `tokensPartial`. The
  contract fixture is pinned at `0de7640`. SCN-037.
- **FD-76 fix.** The live count on the installed 0.7.15 (`main.log`, 20:10 to 03:10 UTC) was 12 messages, against
  105 to 195 a day before. But two of its four outages were false pairs: an agent down for about 20 s got "down" and
  "back" 18 s apart, fifteen minutes later. `owed` now owes the failure only while `clearSince === null`. ADR-0010
  correction 2026-10-20, SCN-062, regression test *FD-76: a short outage looked at every minute through its calm sends
  nothing*.

**Checks run:** `npm run check` exit 0 (578 tests, 0 failed, 5 skipped for Windows only); `test/e2e/spend.test.ts`
green on the built app.

**Owed, in order:**
1. **Released and proven** (see the line above). Left: see the installed copy finish the install
   (`main.log` `update_install installed from=0.7.15 to=0.7.16`).
2. **FD-04 step 2.** Once the installed copy runs 0.7.16 and a dashboard has opened: the Keychain item still has its
   `cdat` of 2026-10-19 20:10:03 UTC (attributes only), and `/usr/bin/log show --predicate 'process ==
   "SecurityAgent"'` from the install on has 0 events. Then close FD-04. A prompt instead turns the fuse off again in
   the next release.
3. **FD-76** closes with a day's count on the installed 0.7.16 (`alerts: sent` in `main.log`), without false pairs.
4. **Observatory lessons: done** 2026-10-20 03:20 UTC through a fresh Observatory MCP process: `mem:827bb09968964ba8`
   (`update-staging-can-vanish`), `mem:9f3e67e8399b42ba` (`posix-path-test-needs-windows-skip`), `mem:c1a8b50418a14b8e`
   (`count-what-a-notifier-sends`), all `proposed`. fabric-workspace `knowledge/products.md` names 0.7.16 (PR #311);
   the roadmap row was held by another run (r-a1942fc94ef2), so the version line went to the board.
5. **Board: done** at 04:50 UTC (see the line above). Read the replies to the 0.7.16 announcement next.

## After 0.7.15: start here (2026-10-19 evening)

**Released 0.7.15** (see the release line above) with two rows:
- **FD-76**, the operator's Telegram rule of 2026-10-19 (board thread `a28f6852`): only an agent that does not
  answer for 15 minutes reaches the channel, "back" after 15 minutes well, a fall within the calm is the same case,
  event banners and degraded parts stay on the Mac. ADR-0010 amendment 2026-10-19, SCN-062.
- **FD-04**, cookie encryption on macOS (Keychain item «Fabric Dashboards Safe Storage») and Windows (DPAPI); Linux
  keeps it off.

**Owed, in order:**
1. **FD-04 proof, step 1: held.** The installed copy updated itself to 0.7.15 at 20:10:02 UTC. The Keychain item
   «Fabric Dashboards Safe Storage» was created at 20:10:03 UTC (`cdat`, read from attributes only). `/usr/bin/log`
   shows 0 SecurityAgent events from 20:00 UTC on. One earlier SecurityAgent launch, at 19:49 UTC, came before the
   install; 0.7.14 used no Keychain. In zsh `log` is a builtin, so call `/usr/bin/log`: the "0 events" baseline above
   was read with the builtin and is not evidence.
2. **FD-76 live count** a day after the install: `grep -c "alerts: sent" main.log` per day, against about 100 a day
   before.
3. **CT-62** (`unmeasuredCalls` in usage reports, contract target 2026-10-20, thread `16e6c000`). Pin the contract
   and show a day's tokens as a lower bound while it is above 0. Release that as **0.7.16**: that release is also
   FD-04's step 2 (the item read across an upgrade, same empty SecurityAgent log). FD-04 closes when both steps hold.
   A prompt instead turns the fuse off in the next release.
4. **Observatory lessons.** Record three as lessons, with origin `p-706cd3754c7e`:
   - `update-staging-can-vanish`, commit `b81fa4f`;
   - `posix-path-test-needs-windows-skip`, commit `956186f`;
   - `count-what-a-notifier-sends`, commit `ba7b192`.
   This session's Observatory MCP answered `stale-server` (0.24.5 against the installed 0.25.0). The same three
   practices are on fabric-workspace `knowledge/agent-practices.md` (PR #289, `472fe94`).
5. **Board.** 0.7.15 was announced on thread `eece7d67` (message `c70d134e`), after a new thread answered
   `not_available` three times. Read the replies (adapted, row, not affected).

**Board answers of the final pass** (thread `eece7d67`):
- fabric-workspace: nothing.
- Observatory: owns FD-58/59/40/61; dates are in the backlog rows.
- Fabric: nothing blocks; a Fabric descriptor would unblock FD-12 and FD-68.
- Contract: nothing blocks; CT-62 comes from our finding.
- Switchboard: its `handovers` stall is gone since 0.6.42.

Polls from the adapter, Inbox, Switchboard, workspace and contract were answered "nothing needed".

## Final pass: start here (2026-10-19 afternoon: the operator asked to close everything critical so the estate can be used day to day)

**Checked on the installed copy (0.7.14):**
- Installed by itself at 13:25:26 UTC (`main.log`: `update_install installed from=0.7.13 to=0.7.14`); the FD-75 path was not needed.
- Its View menu (Russian UI: «Вид») has «Обновить страницу» ⌘R and «Обновить страницу без кеша» ⇧⌘R, read through Accessibility (`osascript` System Events, menu bar item 4). The keys were not pressed on the person's screen; the e2e run clicks both items.
- Its MCP `list_services`, called on the new binary, answered 21 ready and 4 degraded. All 4 report low disk on this Mac (7.3 to 8.5 GB free): frame and research agents refuse new work, and Observatory's collectors are partial. Dashboards shows them as they report.
- Outage alerts: 798 sent since 2026-10-12. 3 were refused by the operator channel with `question_expired`, a refusal of that channel (Dashboards sends no question). 2 of them went through on the next retry; the third episode had ended first. No change.

**Asked every related project** on board thread `eece7d67` what Dashboards must still do. Answers so far:
- fabric-workspace: nothing.
- Observatory (a peer session): asked what blocks; answered nothing blocks daily use; FD-58/59/61/40 wait for its node and budget read.
- Fabric (a peer session; its board door is rate limited on 0.3.6): answered nothing blocks; asked for a Fabric descriptor in 0.3.7, which unblocks FD-12 and FD-68.

**DEC-0087** (thread `16e6c000`): nothing to adopt. Dashboards reads no job `usage`. The service usage report gives a host no signal for a lower-bound token total, so the contract was told and given a suggestion (`unmeasuredCalls`), reply `3ba380ab`.

**FD-02:** SCN-066 is validated from the live log (idle close at 16:29 UTC on 2026-10-14, continued through Switchboard at 16:39). 7 drafts are left: 019 and 020 (only the person sees a macOS notification; its store is protected), 043 and 044 (signed reinstall, move to Applications), 052 (a Windows or Linux desktop), 064 and 065 (a live Switchboard session list and a real provider limit).

**Tidied:** the worktree `fabric-dashboards-rel` (branch `release/0.7.10`, merged) and the local branch `agent/check-setup-row` (its row is on main) are removed.

**Next task:** read thread `eece7d67` for further replies and act on each the same day; then FD-04's proof when the operator is at the Mac (procedure in its row).

## Status report (2026-10-19, the operator's instruction on the board, thread bd1c9611)

Measured on `origin/main` `5e5cb57`; no other branch, no open pull request before FD-75's.

- **Status:** 0.7.13 released and proven; 0.7.14 with FD-75 (an update fix found today) in its gates.
- **What we worked on:** FD-73 (no em dash in the interface), FD-74 (the operator's request: ⌘R, faster dashboards,
  self-reloading agents, the console opening at once, tidier buttons), FD-75 (below).
- **Done:** PR #154 (`5c94309`), release v0.7.13 (run 39198859807, 16 assets), update-proof 0.7.12 → 0.7.13 green on
  Windows x64/arm64 and Linux x64/arm64 (run 39201311219), handoff PR #155, knowledge base fabric-workspace #255.
  The installed copy on this Mac runs 0.7.13 since 10:11:35 UTC (main.log `update_install installed from=0.7.12 to=0.7.13`).
- **Left, by priority:** FD-75 release (0.7.14); the full `npm run test:e2e` on an unlocked screen (its preflight refused
  at 03:05 UTC: the screen was locked); FD-02's 8 drafts (a person's notifications, a signed reinstall, a Windows or
  Linux desktop, a live Switchboard session); the blocked rows below.
- **Blocked by:** the Observatory node (FD-58, FD-59, FD-61: no `channels.local`, no `node.lifecycle` yet); Fabric's
  journal and board (FD-12, FD-68); the contract's A2A surface (FD-22); Observatory's budget read (FD-40); the
  organization server (FD-52, FD-53; RM-28, board thread `6a2c665a`); a human gate for FD-04 (a Keychain prompt on a
  signed upgrade). Not blocking: Switchboard's `handovers` read still times out at 10 s at times under 0.6.41.
- **When it can ship:** 0.7.14 today, after the five-runner `validate`, the release run and update-proof.
- **Next action now:** FD-75 to release. Posted on the board thread bd1c9611 at 10:21 UTC (message `95c02646`) once
  the board tools came back; Switchboard's stalls posted to it as a finding (thread `9cf3cd50`).
- **After the report (10:48 UTC):** 0.7.14 released (run 39236764321) and proven (update-proof 0.7.13 → 0.7.14,
  run 39240157928, green on all four runners). Likely cause of FD-75: Fabric's report on the same thread measured
  2.4 GB free on this Mac's disk this morning (14 GB at 10:40 UTC); macOS purges ~/Library/Caches under storage
  pressure, which is where Squirrel stages an update.
- **Full e2e (11:15 UTC, unlocked screen, load average 34):** 21/22; SCN-011 failed 3 of 3 because the test's
  launchd plist lacked `FABRIC_SERVICE_SUPERVISOR=launchd`, so the sample's launchd copy exited 75 at once instead of
  waiting on the lock (DEC-0057). Fixed in PR #158 (`d8e62fb`); `test/e2e/launchd-control.test.ts` 2/2.
- **Next task:** confirm on the installed copy that 0.7.14 installs (main.log `update_install installed from=0.7.13
  to=0.7.14`; it was ready at 10:52 UTC and installs once the window is hidden 10 minutes or at quit) and that ⌘R
  reloads the dashboard on screen (`dashboard: <key> reload (menu)`). Then the board: FD-02's drafts as conditions allow.

**FD-75 (found 2026-10-19):** at 10:05:56 UTC Restart to update on the installed 0.7.12 logged `Could not read update
request`: Squirrel's ShipItState.plist and the 0.7.13 bundle staged at 04:50 UTC were gone from ~/Library/Caches
(Observatory's cleanup is off and its journal does not name the folder). ShipIt then failed every 2 s (134 times) until
a later check staged 0.7.13 again and it installed at 10:11:35. Fixed on `agent/fd75-staging-lost`: the staging is
checked on every check and before an install, staged again when gone, and installed once ready; a ShipIt job with no
request is removed at start.

## Next — start here (2026-10-19, FD-74: speed, ⌘R and the console's buttons → 0.7.13)

**Asked by the operator (chat, 2026-10-19):** the console and its buttons look clumsy, ⌘R does nothing, and agents'
dashboards load slowly and show an old version. Branch `agent/console-reload-speed`, row FD-74 in [backlog.md](backlog.md).

**Measured first** (this Mac, 12 local dashboards): a login code took 35 to 541 ms per open, plus one navigation through
the login URL; every page answers `Cache-Control: no-store`, so only its files can be cached; the console's first open
read the login shell's PATH (1.7 s) and asked Switchboard about the folder (up to its 10 s deadline when it stalls:
33 stalls on 2026-10-18 and 14 by 03:18 UTC on 2026-10-19 in the installed 0.7.12's log, under Switchboard 0.6.41).

**Done:** ⌘R / ⇧⌘R (F5 / Shift+F5 elsewhere) in View; a warm session skips the login code (same service pid, under
30 min; any 401 signs in once); two dashboards stay loaded for an hour of hidden window; a restart reloads the page by
itself; the console reads runtimes 3 s after start and shows Switchboard's last answer while asking again; console
actions in one row, the toolbar in icons with one Copy menu, the setup card in one row. Scenarios SCN-015/039/040/048/049,
screens.md and the AGENTS.md lifecycle table updated in the same change.

**Checks run:** `npm run check` exit 0 (568 pass, 0 fail); `test/e2e/app.test.ts` 4/4 and `test/e2e/focus-console.test.ts`
3/3 with screenshots (console idle, setup card).

**Released 0.7.13** (PR #154 as `5c94309`, run 39198859807, 16 assets; update-proof run 39201311219 green). The full
`npm run test:e2e` was not run: the screen was locked and its preflight refuses then; `app.test.ts` and
`focus-console.test.ts` ran green on the branch.

**Next task:** once the installed copy runs 0.7.13, confirm on it that ⌘R reloads the dashboard on screen
(main.log: `dashboard: <key> reload (menu)`) and that a dashboard reopened after a hidden window opens without a login
code; then run the full `npm run test:e2e` on an unlocked screen. Switchboard's 10 s stalls continue under 0.6.41
(numbers in FD-74): post them to Switchboard on the project board, which was not reachable from this session.

## Next — start here (2026-10-14, one closing iteration → 0.7.10, released)

**Where this product stands.** Fabric Dashboards is the machine view of the PassionCode estate (vision: Fabric is the
CEO agent; Dashboards is its monitor and console, and works alone): it finds every `fabric-service/0.1` agent on the
Mac, shows its health, events and spend, starts/stops it through launchd, embeds its dashboard signed in, and gives
each agent a console where the person's coding agent works with its context. Since 0.7.x it also runs on Windows and
Linux, updates itself on every OS (proven end to end each release), takes Switchboard's hand-overs into the console,
and checks the whole PassionCode setup with the launcher's `doctor`. Roadmap phase: **operating and hardening** —
every buildable row is built; what is left waits on other products (the Observatory node, Fabric's journal, the
organization server) or on the operator.

**Released 0.7.10** — PR #141 merged as `3cf8ea1` after five-runner `validate.yml` (run 38605704198), local
`npm run check` 549 pass / 0 fail, `npm run test:e2e` 21/21, `check_private.py` 0; tag `v0.7.10`, release run
[38606788342](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38606788342) green in every stage,
16 assets; `update-proof -f from=0.7.9 -f to=0.7.10` run 38640607413 green on Windows x64/arm64 and Linux x64/arm64.
Knowledge base: fabric-workspace #230.

**Done in this iteration:**
- FD-66 (`service_context` visible to Claude Code): took over the abandoned PR #137 as #140 (same commit, rebased);
  its schema guard fails on the old top-level `anyOf`.
- FD-65 Check setup (SCN-070): the pinned launcher's read-only `doctor --json`, lines by area with their fixes,
  Repair with my coding agent → the Setup console's brief starts from them. Deviation, recorded in the row: the setup
  card's automatic signal stays the cheap `readSetupState()`; the doctor runs only on a press (LC-08).
- FD-69: the installed 0.7.9 logged a bare `exit 1` for a hand-over read — the shared runner dropped a killed
  command's reason; fixed, and a recovery is now logged.
- FD-62 proven live: the installed 0.7.9 took two Switchboard hand-overs, each once, in consoles of their own, within
  the 15 s poll (main.log 19:28:32Z and 20:29:35Z); no Terminal opened (Switchboard's side confirmed). SCN-069
  validated. Those two hand-overs came from a Switchboard bug (SB-129) and their agents did not finish (SB-130) —
  both Switchboard's.
- FD-02: SCN-051 (estate watcher on a real contract clone; the e2e fails when the fetch is replaced by a pull),
  SCN-069 and SCN-070 validated — 62 of 70 scenarios validated, 8 drafts left (below).
- Board hygiene: FD-67 closed (not reproduced in 16 runs), FD-08 closed (PR #11 closed), FD-61 decided (the app keeps
  no port; the node serves a shared MCP — waits on it), FD-52 notes the contract's context field (DEC-0082).
- Fixed a race in `test/after-exit.test.ts` (it read the helper's file before it was written, under load 66–103).
- Cleanup: an abandoned worktree, 14 merged remote branches and stale local branches removed; only `main` remains.

**Still open, and why (nothing buildable now):**
- FD-02's 8 drafts: SCN-019/020 (macOS notifications — the person sees them), SCN-043/044 (a reinstall and the move
  to Applications on a signed copy), SCN-052 (a Windows or Linux desktop), SCN-064–066 (a live Switchboard session
  in a console folder — a person starts it on their subscription).
- FD-04: a keychain prompt only the operator can answer (procedure in its row).
- FD-12, FD-22, FD-40, FD-52, FD-53, FD-58, FD-59, FD-61, FD-68: wait on Fabric's journal and board, the contract's
  A2A surface, Observatory's budget read and node, and the organization server (each row names its blocker).

**Next task:** when the Observatory node publishes its descriptor with `channels.local` (FD-59) or its
`node.lifecycle` (FD-58, then FD-61), build those rows; until then, walk SCN-064–066 when the operator runs a
Switchboard-managed session in an agent's console folder.

## Next — start here (2026-10-13, board waves → 0.7.7, released)

**Released 0.7.7** — PR #118 merged as `ac6bba4` after the five-runner `validate.yml` (run 38317374705; two
Windows-only test defects found and fixed first: a POSIX fake runtime, a cold PowerShell ACL read), tag `v0.7.7`,
release run [38317895958](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38317895958) green in
every stage, 16 assets; `update-proof.yml -f from=0.7.6 -f to=0.7.7` run 38320573434 green on Windows x64/arm64 and
Linux x64/arm64. Knowledge base: fabric-workspace #189 (products.md 0.7.7). The operator asked to close every
backlog row (2026-10-12); plan in [docs/evidence/specs/2026-10-12-board-waves-plan.md](evidence/specs/2026-10-12-board-waves-plan.md).

**Closed with receipts** (see [backlog.md](backlog.md)): FD-01, FD-07, FD-20, FD-21, FD-26, FD-37, FD-42, FD-43, FD-46,
FD-49, FD-50, FD-51, FD-55, FD-56, FD-57, FD-60. **FD-02:** 51 of the 63 draft scenarios validated on the running
app (PR #119, `3a4eae1`: eight new e2e files, the real launchd among them).

**Still open, and why:** FD-02's last 12 drafts each need a condition this Mac or CI cannot give now (macOS
notifications, a signed reinstall, a Windows/Linux desktop, ≥ 5 GB free, a live Switchboard session — listed in its
row); FD-04 needs the operator (a keychain prompt; procedure in its row); FD-61 needs a decision (the app's no-port
rule vs a broker-served MCP); FD-62 waits for Switchboard 0.6.26; FD-12, FD-22, FD-40, FD-52, FD-53, FD-58, FD-59
wait for other products (each re-verified 2026-10-12).

**Next task:** when Switchboard 0.6.26 publishes `handovers`, build FD-62 as its row says; when the disk has ≥ 5 GB
free, run `node --import tsx --test test/e2e/update.test.ts` (it then walks SCN-055's agent start) and validate
SCN-055. The installed copy picks 0.7.7 up by itself (6-hourly check, then 10 hidden minutes).

2026-10-13 00:56 UTC: tried. The disk had 5.52 GB free before the build, 3.80 GB once the test started (swap 9.1 of
10 GB in use; this checkout's own temp files total under 1 MB), so `update.test.ts` passed on its SCN-063 branch
(start deferred, nothing spawned) and SCN-055 stays a draft. Rerun when `df` shows ≥ 5 GB right before the test.

2026-10-13, later: FD-63 (#124: the pre-commit hook runs org-index `check_private.py`; #123 removed the 12 real
findings from this public tree; earlier commits in its history still hold them; a history rewrite is the operator's call)
and FD-64 (#125, unreleased, in `CHANGELOG.md` *Unreleased*: ⌘H fires no window event, so a ready update never
started its grace). The installed 0.7.6 has had 0.7.7 verified and ready since 04:29 UTC. It installs when the window is
shown and then closed, or at quit (Squirrel), or by itself once a build with FD-64 runs.
**0.7.8 released 2026-10-13** (tag on `e55e383`, release run 38423010876, all stages green, 16 assets): FD-64 and FD-63.
Before the tag: five-runner `validate.yml` green (run 38386152677); local `npm run check` 534 pass / 0 fail and
`npm run test:e2e` 19/19. `test/e2e/focus-console.test.ts` now proves the LC-17 deferral where the disk has under 5 GB free
(it had 1.8 GB: the three console tests timed out waiting for a runtime that admission had refused). The full console
runtime path was not walked on this Mac. After the release: update-proof 0.7.7 → 0.7.8 green on Windows x64/arm64 and
Linux x64/arm64 (run 38427268115). On this Mac, the installed 0.7.7 had 0.7.8 verified and ready at 16:16 UTC. 0.7.7
still has the ⌘H defect, so it installs after a window close or a quit if the window was hidden with ⌘H.
fabric-workspace `knowledge/roadmap.md` and `products.md` name 0.7.8 (#201).
**0.7.9 released 2026-10-13/14** (tag on `bd9e90e`, release run 38470000938, all stages green, 16 assets): FD-62, hand-overs
from Switchboard (SB-108, Switchboard 0.6.28 carries `handovers`) open in the console, not in Terminal (PR #130; SCN-069
draft; `test/handovers.test.ts` 7/7, and it fails against a planted re-take defect). Before the tag: five-runner `validate.yml`
green (run 38469141900); `npm run check` 541 pass / 0 fail. e2e on the FD-62 code: first full run 18/19 (Spend timed out once
with swap at 21 of 22.5 GB), then Spend alone and a second full run 19/19. After the release: update-proof 0.7.8 → 0.7.9
green on Windows x64/arm64 and Linux x64/arm64 (run 38473748939). The installed copy on this Mac reached 0.7.8 and takes
0.7.9 by itself.

RM-28 pilot (operator 2026-10-13): Dashboards answered the pilot packet §4 (fabric-workspace #205). Its answer changes the
proposed part: it shows and embeds the organization server's admin agents and pages, and installs nothing. FD-52 and
FD-53 are marked `RM-28 pilot`.

2026-10-14: SCN-055, SCN-032 and SCN-060 validated on the running app (#133–#135; FD-02 at 56 of 69). FD-68 (route events,
DEC-0076; blocked on Fabric's journal) filed: first as FD-65 in #136, renumbered in #138 because #129 had already taken FD-65.
The installed copy runs 0.7.9 since 12:33 UTC. `switchboard --json handovers` answers `enabled: false`, so no hand-over has reached
the console yet. FD-67 (a `test/handovers.test.ts` flake, filed in open PR #137) did not reproduce: 12 parallel runs passed, and
3 parallel full suites failed only in the launchd integration test, which shares one fixed label across runs.

**Next task:** the live FD-62 check. The fabric-switchboard session turns `switchboard handovers set on` once its app runs 0.6.28
(held by a visible window) and Dashboards runs 0.7.9. It then runs one hand-over end to end: the console takes it exactly once,
and no Terminal opens. Validate SCN-069 from that run. Then walk the console's runtime path (`test/e2e/focus-console.test.ts`,
`update.test.ts` for SCN-055) on a disk with ≥ 5 GB free, then the items above.

## Next — start here (2026-10-12, CT-21 from the contract)

**Branch `agent/ct21-windows-token-acl`.** The contract session closed wave 4 (fabric-agent-contract `7688304`) and
asked for three things. **FD-54 (security) is done here:** the Windows token-file ACL reader read the access mask
signed, so GENERIC_READ for Everyone passed; `windowsAclRefusal` (`packages/service-host/src/health.ts`) now follows
DEC-0057 and the contract's `windows-token.json` vectors run in `packages/service-host/test/health.test.ts`.
`npm run check` exit 0 (480 pass) on macOS; the PowerShell expression (`([int64][int]$_.FileSystemRights) -band
4294967295`) runs only on Windows — prove it with `gh workflow run validate.yml --ref <branch> -f os=all` before the
next release. **Open:** FD-55 (DEC-0057 `duplicate` per supervisor: systemd `MainPID`, Task Scheduler not an outage)
and FD-56 (DEC-0059 ED-9 `appearance`, with FD-42).

**Next task:** the five-runner `validate.yml` run on this change, then FD-55.

## Next — start here (2026-10-12, release 0.7.6)

**Branch `agent/release-076`.** 0.7.6 carries the bug wave (PR #110: Windows helpers outlive the app; the AppImage
restarts through `/bin/sh`; the relaunch marker; the Settings line) and FD-48's DEC-0044 setup flag (PR #109). Per
RUNBOOK step 1 the branch runs `validate.yml -f os=all` before merging.

**Released 2026-10-12 04:12 UTC.** PR #111 merged as `5f2fcbe`; five-runner rehearsal run 38199579272 green; tag
`v0.7.6` pushed by the agent; release run [38200511483](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38200511483)
green in every stage (guard, preflight, check ×5, macos, windows ×2, linux ×2, feed, still-newest, publish), 16 files.
Checked after publish: `SHA256SUMS.asc` good signature (key 63B3…B6A7); five receipts at `5f2fcbe` — macOS notarized
and stapled, both Windows `SIGNED`; `update-feed.json` names darwin-universal, win32-x64, win32-arm64, linux-x64 and
linux-arm64, each with its SHA-256; `releases/latest` is `v0.7.6`. The Windows proof with the fixed code is complete:
run 38199490293, win32-x64 and win32-arm64 updated themselves 0.7.4 → 0.7.5 and started again.

**On main, unreleased:** B-163 (sshlg-skills 1.56.0's update lock) — a skills update refused with exit 75 is
`estate_update busy`, not a failure, and is retried within the hour (PR #113, `be8b2cf`, ADR-0018 amendment
2026-10-12). It ships with the next release.

**On main, unreleased:** the Russian copy pass (operator 2026-10-12, [PR #115](https://github.com/passioncode-ai/fabric-dashboards/pull/115)):
164 of 471 Russian strings in `src/core/i18n.ts` and 16 machine reasons in `src/core/machine-ru.ts` rewritten against
Fabric's `docs/brand/` and the org localization glossary (this repo has no brand pack); the since-last-visit date
follows the interface language. `npm run check` exit 0. Only Overview was seen rendered in Russian (the disk was full);
walk Settings, Spend, Health and the console in Russian on the next release candidate. The decisions a Dashboards
brand pack should own are listed in the PR.

**Next task:** when the release after 0.7.6 exists, run `gh workflow run update-proof.yml -f from=0.7.6 -f to=<next>
-f os=all` (no build: 0.7.6 carries the fix) — the first proof on released code end to end. Then FD-42 (theme picker)
and FD-49 (LC-17 admission; this Mac had 0.5 GB free during this release, so measure before choosing the floor).

## Earlier — start here (2026-10-12, bug wave: updates on Windows and Linux)

**Branch `agent/bugwave`.** The operator asked for a bug wave: find, design, fix, validate and release.
- **Found.** The first end-to-end update proof (`update-proof.yml` run 38183686112, 0.7.4 → 0.7.5) failed on all four
  Windows and Linux runners.
  - Windows: the update waiter died with the app (libuv job object). The same defect hit the uninstaller's waiter
    and the data purge. A detached PowerShell does not run at all.
  - Linux: Electron's relauncher ran inside the AppImage mount and died with it.
- **Fixed** (`src/core/after-exit.ts`, ADR-0019 amendment 2026-10-12).
  - Windows helpers run as a grandchild through `cmd.exe` `start "" /b`, outside the job (`powerShellAfterExit`).
  - The AppImage restarts through a detached `/bin/sh` (`appImageRelaunchCommand`).
  - The hidden-relaunch marker lasts 30 min and is cleared on any failed install.
  - Settings shows "no channel installed" as a plain line.
- **Proof.**
  - `test/after-exit.test.ts`: with the helper planted as a direct child, it fails on both Windows runners and passes
    on POSIX (run 38193798324).
  - Five runners green (run 38193790867).
  - `update-proof.yml` with `build: true` (the fixed code numbered 0.7.4) updated itself to the published 0.7.5 on
    Linux x64 and arm64 (run 38190268316) and on Windows arm64 (run 38193793066). Windows x64 installed 0.7.5 (runs 38193793066, 38196625136); its restart signal is re-checked in run 38199490293 (the copy restarted by the installer runs in a fresh default profile).
- **For people on 0.7.4/0.7.5.** A Windows copy must install 0.7.6 by hand once (CHANGELOG). An AppImage has
  already replaced its file and runs 0.7.6 at its next start.
- **Correction.** An earlier note said a planted `detached: false` was caught on Windows; that run failed on an
  import path. The ADR records it.

**Next task:** release 0.7.6, then `update-proof.yml -f from=0.7.6 -f to=<next>` after the next release (no build
needed then).

## Earlier — start here (2026-10-12, FD-48: DEC-0044 setup flag)

**Branch `agent/fd48-setup-flag`.** Contract DEC-0044 (`c6c5af1`). A `degraded[]` entry with `setup: true` never opens
an outage episode, nor enters the start baseline (`src/core/outage-alerts.ts`). `service-host` says it as
`reason.setup` ("<source> waits for you to set it up: …"), and the shared state vectors carry the case. The start
baseline stays the fallback for services that do not send the flag. `checkWellKnown` accepts unknown fields
(structural only), so a service may send the flag now. Tests: `test/outage-alerts.test.ts` 8/8,
`packages/service-host/test/state.test.ts` 43/43, `npm run check` 0 (473).

## Earlier — start here (2026-10-11, release 0.7.5: FD-48 + #101)

**Branch `agent/release-075`.** 0.7.5 carries FD-48 (outages reach the operator channel) and
PR #101 (an explicit Reload signs in again). Per RUNBOOK step 1 the branch runs `validate.yml -f os=all` before merging.
The screen was locked, so the full `npm run test:e2e` refused at its preflight. Run directly:
- FD-48's branch: e2e app/remote/console 8/8;
- #101: e2e app/focus-console/spend 8/8.

**Next task:**
1. Tag and watch.
2. The owed FD-37 M4 end-to-end proof: an AppImage and an NSIS install of 0.7.4 update to 0.7.5 by themselves, on
   their runners.
3. FD-49 (LC-17). Its 5 GB floor would refuse every console start on this Mac today (3.5–6 GB free), so the
   threshold and its message need care.
4. FD-42.

## Earlier — start here (2026-10-11, FD-48: outages to the operator channel)

**Branch `agent/fd48-outage-alerts`.** This is the operator decision of 2026-10-11, after a service's live database
was down 3 h 07 min unnoticed. [ADR-0010 amendment](adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48), SCN-062.
- The watcher opens an episode for a `down`, or for a degraded source that was not in the service's start baseline.
  After five minutes it sends one `failure`, and one `recovery` when the episode ends.
- Messages go to the local service offering `<id>.notify` over MCP. The tool is found in `tools/list`, and the
  descriptor header is sent when the service has a token file.
- Failed and attention banners go there too.
- The person's rules gate the channel.
- `outage-alerts.json` keeps state across restarts.
- An independent review (5 bugs, 14 risks) changed the model.
  - The state is the queue. Delivery is recorded only when the channel answered, so a recovery never precedes its
    failure, and a missed outage is told once afterwards.
  - There is one episode per service, closed after a 2-minute calm.
  - A baseline source that recovered counts again.
  - The MCP client takes host and port from the origin only, caps the body, has one deadline, joins SSE lines and
    closes its session.
- Checks:
  - `test/outage-alerts.test.ts` 7/7;
  - `npm run check` 0 (472);
  - e2e app/remote/console 8/8 run directly (the screen was locked);
  - five runners green (run 38178081413);
  - a read-only `<id>.status` call to this Mac's real channel answered `connected`.
  - No test message was sent to the operator.

Also on `main` since 0.7.4: PR #101, an explicit Reload signs in again (taken over from #58).

**Next tasks:**
1. File the Switchboard stability rules: LC-17 (disk ≥ 5 GB, swap and a session cap before a console starts),
   LC-18 (save an idle console and close it, resume on reopen) and LC-20 (start through `switchboard launch … --mode
   managed`).
2. Release 0.7.5 (FD-48 + #101), which is also the owed M4 end-to-end proof from 0.7.4.
3. FD-42, the theme picker.

## Earlier — start here (2026-10-11, after 0.7.4)

**Released: 0.7.4 on 2026-10-11 20:01 UTC** (run [38168481474](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38168481474),
tag `v0.7.4` on `09e1c41`; Latest). It is the first release whose feed names every platform. Checked:
- `SHA256SUMS` has a good GPG signature;
- all five receipts are 0.7.4 on `09e1c41`, with no failed check; Windows `SIGNED`;
- `update-feed.json` matches `SHA256SUMS` and names `darwin-universal`, `win32-x64`, `win32-arm64`, `linux-x64`
  and `linux-arm64`, each file's hash equal to `SHA256SUMS`.

**Owed (FD-37 M4):** with the next release, an AppImage (both Linux runners) and an NSIS install (both Windows
runners) of 0.7.4 must update to it by themselves.

**Next task:** FD-42, the theme picker (DEC-0036 ED-8/ED-10). First find out whether `codex/dashboard-session-refresh`
(PR #58) is alive.

## Earlier — start here (2026-10-11, release 0.7.4: FD-37 M4)

**Branch `agent/release-074`.** 0.7.4 carries FD-37 M4:
- M4a: the feed names every platform;
- M4b: the Linux AppImage updates itself; `.deb` and Windows say how they update;
- M4c: an NSIS install on Windows updates itself.

It is the first release whose own feed carries `platforms`. Per RUNBOOK step 1, the branch runs `validate.yml -f
os=all` before merging.

**Next task:** tag and watch. Then the owed end-to-end proof: when the release after 0.7.4 exists, an AppImage
(both Linux runners) and an NSIS install (both Windows runners) of 0.7.4 update to it by themselves.

## Earlier — start here (2026-10-11, FD-37 M4c: Windows updates)

**Branch `agent/fd37-m4c-windows`.** [ADR-0019 amendment](adr/0019-windows-and-linux.md#amendment-2026-10-11--updates-on-windows-fd-37-m4c).
An NSIS install (its uninstaller beside the app) is channel `nsis`. `Updater.prepareFile`, shared with the
AppImage, verifies the installer and keeps it in `pending-update/`. Restart, or ten hidden minutes, starts it
detached with `--updated /S --force-run` and quits. `scripts/nsis-smoke.mjs` now runs that update over a running
copy on both Windows runners. An independent review (1 bug, 7 risks, 1 question) was fixed:
- a PowerShell waiter (`nsisUpdateCommand`) runs the installer only after the app exits, and only if its SHA256 is
  still the verified one; the app quits only after the waiter has started;
- `nsis` only for a copy in `%LOCALAPPDATA%\Programs\<name>`;
- the cleanup at start cannot crash it;
- the smoke follows the real order, stops only its own processes and fails on survivors.

Rehearsal run 38166001899 on all five runners with packages was green. The update took 12 s on x64 and 486 s on
arm64.

**Next task:** merge, release (0.7.4 carries M4a, M4b and M4c), then the owed end-to-end proof once the release
after it exists. FD-37 M5 (systemd / Task Scheduler supervision) waits on its contract with Fabric.

## Earlier — start here (2026-10-11, FD-37 M4b: Linux updates)

**Branch `agent/fd37-m4b-appimage`.** [ADR-0019 amendment](adr/0019-windows-and-linux.md#amendment-2026-10-11--updates-on-linux-fd-37-m4b).
`src/core/self-update.ts` decides the update channel from how the copy was installed: `squirrel`, `appimage`,
`package`, `not-yet` or `development`. `Updater.applyAppImage` verifies the signed SHA256SUMS, then the signed
feed's `platforms.linux-<arch>`, then the file's hash. It replaces `$APPIMAGE`, and a restart runs it. Settings
gives a `.deb` copy and Windows their own sentences (0.7.1–0.7.3 told installed copies "not a development run").
The macOS download now goes through the shared `downloadTo` and behaves the same.
Checks: `test/self-update.test.ts` 4/4 on the published 0.7.3 receipts; `npm run check` 0 (436 pass). An independent review (4 risks and 1 question) was fixed:
- an AppImage only from inside `$APPDIR` with `$APPIMAGE` a regular file, so an inherited variable cannot make a
  `.deb` copy overwrite it;
- fsync before and after the rename;
- writability is checked before the download;
- the restart keeps this run's arguments.

The relaunch order goes to the end-to-end proof. Rehearsal on all five runners with packages:
run 38162827076, green.

**Owed:** the end-to-end proof of M4b is the first real update. An AppImage of the release that first carries
M4a+M4b must update to the release after it, on both Linux runners. No test can redirect the pinned feed.

**Next task:** merge M4b, then M4c (Windows: verified NSIS installer `/S` at an idle exit).

## Earlier — start here (2026-10-11, FD-37 M4a: the feed names every platform)

**Branch `agent/fd37-m4a-feed`.** PL-04's first half, in CI. The macOS seal's feed is staged as `feed-macos`. A
new `feed` job in `release.yml` (`scripts/release-feed.mjs`) adds `platforms` from every receipt:
- `darwin-universal`, `win32-x64`, `win32-arm64`, `linux-x64` and `linux-arm64`, each with its update file and hash;
- the `.deb` as well for Linux.
It refuses a release that lacks a platform or whose receipts disagree, and `publish` needs it. A macOS copy's
`signedFeed` accepts the new feed (test). Checks:
- `test/release-feed.test.ts` 4/4, on the published 0.7.3 receipts (`test/fixtures/release-0.7.3/`);
- `npm run check` 0;
- rehearsal `v0.7.3-rc.1` with `release.yml -f publish=false`, run
  [38160558530](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38160558530): every job green,
  `feed` logged all five platforms, and the artifact `release-feed` names them for 0.7.3.

**Next task:** M4b, the Linux AppImage updater: read the `linux-<arch>` entry, verify against SHA256SUMS, replace
`$APPIMAGE`, apply at restart. A `.deb` copy says a newer `.deb` updates it. Then M4c, Windows NSIS at an idle exit.

## Earlier — start here (2026-10-11, after 0.7.3)

**Released: 0.7.3 on 2026-10-11 16:59 UTC** (run [38156472858](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38156472858),
tag `v0.7.3` on `5b15816`; Latest). It is the first release under approval by checks: `guard` → `check` (5 runners)
→ builds → `still-newest` → `publish`, with no click. Before the tag, the branch was rehearsed with
`validate.yml -f os=all` (run 38156101828, green). Checked:
- 16 files; `SHA256SUMS` (14 lines) has a good GPG signature from key `63B3…B6A7`;
- all five receipts are 0.7.3 on `5b15816`, with no failed check;
- Windows `SIGNED`, x64 and arm64; macOS notarized;
- the feed names 0.7.3.

This Mac ran 0.6.7 at 17:01 UTC. Its updater's next check is at about 17:09 UTC.

**Next task:** confirm this Mac moved to 0.7.3 (and measure CPU/RSS); then FD-37 M4 (updates on Windows and
Linux).

## Earlier — start here (2026-10-11, release 0.7.3: carries 0.7.2)

**Branch `agent/release-073`.** Tag `v0.7.2` started run
[38155693835](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38155693835). `guard` passed, the
first run under approval by checks. `check` then failed on both Windows runners: *FD-47 SH-3* expected a write
into a `chmod 0500` folder to throw, and Windows ignores POSIX modes. That part now runs off Windows only. The next
test (a failing rename) covers the same path everywhere. As with 0.7.0, `v0.7.2` stays tagged and unpublished,
and 0.7.3 carries it. **The cause is the process, not the test:** neither tag was rehearsed on Windows first.
RUNBOOK step 1 now runs `validate.yml -f os=all` on the release branch before merging.

**Next task:** rehearse on all five runners, merge, tag `v0.7.3`, watch, verify; then FD-37 M4.

## Earlier — start here (2026-10-11, release 0.7.2: FD-45 + FD-47)

**Branch `agent/release-072`.** 0.7.2 carries Fabric's button (FD-45, ADR-0021) and the `session-handoff/1` pack
(FD-47, the ADR-0020 amendment); `package.json` and `CHANGELOG.md` say 0.7.2. The first release under approval by
checks: tag, then `guard` → `check` → builds → publish, nobody approves.
Checks before tagging (2026-10-11): `npm run check` 0 (428 of 433, 5 skipped Windows-only).
The screen was locked, so `npm run test:e2e` refused at its preflight. The e2e files run directly:
- `app` and `remote`: 5/5;
- `focus-console`: 3/3;
- `spend` (FD-05's Dock assertion, which needs an unlocked screen): not run. Its code is unchanged since 0.7.1, where it passed.

**Next task:** watch the release run; verify the published files and receipts; then FD-37 M4.

## Earlier — start here (2026-10-11, FD-47: session-handoff/1)

**Branch `agent/fd47-session-handoff`.** The console's pack is the contract's `session-handoff/1` (DEC-0042,
merged `213e5a3a2f4d`). [ADR-0020 amendment](adr/0020-agents-first-handoff-and-setup.md#amendment-2026-10-11--the-pack-is-session-handoff1-fd-47).
`handoff.json` is written for Claude Code, Codex and Gemini CLI (`agent-key`, `service_context` with `key`,
`mcp.auth: none`, not strict). The preamble holds no rule, and the rules are `service_context`'s `rules`. The brief
is inline or `brief.md`. The contract's checker runs in the suite (`test/session-handoff.test.ts`, the copy in
`test/contract/`, schemas in `test/fixtures/contract/schema_*.json`).

Checks (2026-10-11): `npm run check` 0, 425 of 430 tests (5 skipped, Windows-only). `test/session-handoff.test.ts`
5/5, and it fails when a rule (a second tool name) is planted in the preamble (FAC-SEM-053). The screen was
locked, so `npm run test:e2e` refused at its preflight. `test/e2e/focus-console.test.ts`, run directly, passed 3/3:
the console reaches the runtime with the new preamble, `handoff.json` is there, and a Fix starts with
`Do the task in …task.md.`.

An independent review (5 risks, 1 nit) was fixed in the same PR:
- a failed write leaves no `.tmp`, and one a killed writer left is swept;
- the old manifest is removed before anything else;
- a Terminal window does not rewrite the pack of a running console session;
- `service_context` refuses `key` and `service` naming different services, and treats an empty one as absent (checked in `call`; the schema has no top-level `anyOf`, which the Anthropic API refuses — FD-66);
- `launch.args` excluding the runtime's own Continue arguments is declared (SH-10).

After the fixes: `npm run check` 0 (428 of 433 tests), console e2e 3/3. `app` and `remote` e2e, run directly, passed 5/5.

**Next task:** release 0.7.2 (FD-45 + FD-47); then FD-37 M4.

## Earlier — start here (2026-10-11, FD-45 re-pinned to DEC-0041)

`src/core/fabric-links.ts` is re-copied from fabric-agent-contract `7931c1dbb6e6` (DEC-0041, CO-260: credential
words are matched as whole words of a name). The `fabric-link-*` fixtures are unchanged there. Test *FD-45
DEC-0041* covers `themeCode`, `sortKey` and `#auth-settings`, which pass, and `authToken`, `clientSecret` and a
JWT in a value or the fragment, which are refused.

**Next task:** release 0.7.2 with FD-45 (Fabric's button); then FD-37 M4.

## Earlier — start here (2026-10-11, FD-45: Fabric's button)

**Branch `agent/fd45-fabric-button-impl`.** Fabric Agent Contract DEC-0040 (merged `8e49fbd`) as host:
[ADR-0021](adr/0021-fabrics-button-in-the-host.md), SCN-061. A **Fabric** button in the service header
(`src/renderer/components/ServiceView.tsx` `FabricButton`) opens `fabric://chat?service=<id>.<instance>`
(`src/core/fabric-button.ts`, links built by the contract's copied `src/core/fabric-links.ts`). Presence
comes from `app.getApplicationNameForProtocol`; with none, a native menu says *Fabric is not installed — get it
at passioncode.ai/fabric*. Before every dashboard load the host sets `fabric_button=v=1&owner=host&fabric=…`
in the service's partition (FB-6). The mark is the website's `passioncode-mark.svg` (pinned): Fabric's app icon
is that vector on a tile. The Fabric owner's answers: no project in the link (Fabric's REQ-05 resolver finds
it); this glyph is the mark; FB-4 is normative, so Fabric moves its SCN-142 to it in its wave 5.

Checks (2026-10-11, macOS arm64): `test/fabric-button.test.ts` 6/6, and fails with a planted defect (cookie
`Secure` forced off: 1 fail). `npm run test:e2e`: 8/9. The FD-45 assertions passed for both present and absent.
The failure was FD-05's Dock assertion in `spend.test.ts`, with no `dock_` line (the FD-35 shape); alone it
passed 1/1 with the screen unlocked. `npm run check` 0: 423 tests, 418 pass, 5 skipped (Windows-only); 3 brand pins; 89 code regions; UX lint consistent. An independent review (4 risks, 1 nit,
1 question) was fixed in the same PR: the cookie is refreshed before every show and before Reload/Home, a late
answer for the previous agent is dropped, a failed press is caught, the target is 44 × 44 without growing the
header, the cookie can never fail a show, and ADR-0021 declares the Russian FB-5 sentence. After the fixes:
`npm run check` 0, `npm run test:e2e` 9/9; the header was checked on a screenshot (Fabric beside Console, one line).

**Next task:** merge, then release with the next version. FD-37 M4 after that.

## Earlier — start here (2026-10-11, after 0.7.1)

**Released: 0.7.1 on 2026-10-11 11:34 UTC** (run [38106066248](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38106066248),
tag `v0.7.1` on `e1593bb`; Latest). 16 files: DMG, mac zip, Windows setup x64/arm64, Linux AppImage + `.deb`
x64/arm64, five receipts, `SHA256SUMS` (14 lines) + `.asc`, `update-feed.json` (names 0.7.1). Checked:
`gpg --verify` good signature from key `63B30DC324BD697487AA31944FAFB8AEC803B6A7`; every receipt `version`
0.7.1 and `commit` e1593bb with no failed check; Windows `windows_authenticode: SIGNED` on both; macOS
notarization "accepted and stapled: app, update zip, image".

**How it went.** `check` passed on all five runners. The person approved `macos` and both `windows` (one approval).
`publish` then waited on the `release` environment again and was cancelled with "Required reviewers
protection rule deleted.": the environment's required-reviewers rule was removed while it waited. The
`release` environment now has only its `v*` tag policy and **no required reviewers**, so `RUNBOOK.md` step 4
("someone from `release-approvers` approves it") no longer describes it. This was the operator's decision
(2026-10-11, *Approval by checks*, relayed by the Observatory session): #81 (10473c0) added the `guard` job
(`release-guard@v1`) that every signing job needs, and only team `release-approvers` can push a `v*` tag.
RUNBOOK step 4, CONTRIBUTING, AGENTS.md and the workflow comments now say so (branch
`agent/runbook-approval-by-checks`).
`gh run rerun 38106066248 --failed` re-ran `publish` against the already-signed artifacts; it succeeded.

**This Mac** runs 0.6.7 (`startedBy: other`, so the lifecycle broker does not restart it). Its updater
checks every 6 h (last 11:09 UTC, before the publish) and installs after 10 hidden minutes (ADR-0015); expect
`update_check` naming 0.7.1 around 17:09 UTC in `main.log`, then the install. Record it here when seen,
with the CPU and RSS measurement the lifecycle section asks for.

**Next task:** confirm this Mac moved to 0.7.1 (and measure CPU/RSS); then FD-37 M4 (updates on Windows
and Linux). The next release is the first under approval by checks: tag, watch, report — no approval link.

## Earlier — start here (2026-10-11, release 0.7.1: carries 0.7.0)

**Branch `agent/release-071`.** Tag `v0.7.0` (on `fe23c6b`, PR #78) started release run
[38105334997](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38105334997), which failed in
`check` on `windows-latest` and `windows-11-arm` before any build: `test/mcp.test.ts` *FD-39 REQ-004* gave the
descriptor `update: ['/x/update']`, which is not absolute on Windows, so `serviceContext` refused the descriptor
(`command update must start with an absolute or ~/ executable`). macOS and both Linux runners passed. The test
now uses a native absolute path (`UPDATE_CMD`); the app is unchanged. As with 0.6.3 → 0.6.4, the `v0.7.0` tag
stays and 0.7.1 carries everything (`CHANGELOG.md`). Before tagging, the branch's Windows gate is rehearsed with
`gh workflow run validate.yml --ref agent/release-071 -f os=all` (all five runners).

**Next task:** merge, tag `v0.7.1`, watch `release.yml`, send the approval link (reply + communicator); then
record the run, files and receipts here and in FD-37/FD-39/FD-41.

## Earlier — start here (2026-10-11, release 0.7.0: FD-37 + FD-39 + FD-41)

**Branch `agent/release-070`.** 0.7.0 is the first release with Windows (signed NSIS x64/arm64) and Linux
(AppImage + `.deb` x64/arm64) files (FD-37 M1–M3), agents first (FD-39) and the ED-7 host floor (FD-41).
`package.json` and `package-lock.json` at 0.7.0; `CHANGELOG.md` `## 0.7.0 - 2026-10-11` (the stale "not yet
Authenticode-signed" wording replaced: signing is on since the `v0.6.7-rc.2` rehearsal).
Checks on the branch (2026-10-11 02:30 UTC, macOS arm64): `npm ci` 0; `npm run check` 0 — 417 tests, 412 pass,
5 skipped (Windows-only), brand pins, 86 code regions, UX lint; `npm run test:e2e` 0 — 9/9.
After merge: tag `v0.7.0` on the merge commit, push it, watch `release.yml`; the `macos` and `windows` jobs
wait for a `release-approvers` approval (send its run link). Then record the run, the published files and
the receipts here and in FD-37/FD-39/FD-41.

**Next task:** tag and release 0.7.0; then FD-42 once `codex/dashboard-session-refresh` (PR #58) is on `main`.

## Earlier — start here (2026-10-11, FD-41: the ED-7 host floor; FD-42 opened)

**Branch `agent/fd39-dashboard-host-floor`, PR open, not merged.** Fabric Agent Contract DEC-0036
(profile `fabric-dashboard/0.1`, [contract PR #27](https://github.com/passioncode-ai/fabric-agent-contract/pull/27),
merged as `a83bec6`) ED-7 and ED-9:
- **Done (FD-41):** the console stops where the dashboard keeps `max(480, minWidth)` px of the measured
  split (`src/core/layout.ts`, `src/renderer/App.tsx`, the separator's `aria-valuemax`); the remembered width
  survives a narrower window. `minWidth` is read and validated from the well-known `extensions`
  (`dashboardMinWidth`, `packages/service-host` 0.5.0) and carried as `ServiceSnapshot.dashboardMinWidth` and
  MCP `dashboard_min_width`. SCN-060; ADR-0017 amendment 2026-10-11.
- **Checks run:** `npm run check` exit 0 (397 tests, 392 pass, 5 skipped); a planted defect (the floor dropped
  from `consoleMaxFor`) turned 7 of 10 `test/layout.test.ts` tests red, restored green. e2e: see the PR.
- **IDs:** FD-39 is `agent/fd39-agents-first` (merged as PR #67; it holds SCN-053…059), so this work is FD-41 and
  SCN-060; the branch name keeps the `fd39` it was created with. Rebased on that merge: the Setup console beside
  Overview (SCN-058) uses the same rule, with Overview held at 480.
- **Open (FD-42):** the appearance carrier and theme picker (ED-8, ED-10). It needs `src/electron/views.ts`,
  which `codex/dashboard-session-refresh` edits: start it only after that branch lands.

**Next task:** review and merge this PR; then FD-42 once
`codex/dashboard-session-refresh` is on `main`. The release with FD-37 + FD-39 (sections below) can carry FD-41.

## Earlier — start here (2026-10-11, FD-39 agents first; merged as PR #67)

**Branch `agent/fd39-agents-first`** ([brief](evidence/briefs/2026-10-10-agents-first-brief.md), [ADR-0020](adr/0020-agents-first-handoff-and-setup.md)).
Operator 2026-10-10: the coding agent does everything it can; the interface shows the result.
- **M1 context handoff:** each console start writes `userData/consoles/<key>/` (`context.md`, `task.md`, `mcp.json`;
  0700/0600; never the repo). Claude gets `--mcp-config` + `--append-system-prompt`, Codex `-c` + a first prompt,
  Gemini `-i`, every runtime `FABRIC_DASHBOARDS_CONTEXT`; new MCP tool `service_context` (`src/core/handoff.ts`).
- **M2:** *Fix with agent* (header, card, Needs attention) and *Update with agent* (`src/core/offers.ts`).
- **M3:** Pinned section + sort Name / Needs attention / Recent activity (`arrangeProducts`, `settings.layout.list`).
- **M4:** first launch opens the Setup console with `setup.md` (`src/core/setup.ts`, SCN-058); later launches
  open on "Since you were last here" with Continue (`src/core/visit.ts`, SCN-059).
- **M5:** each product's part is filed by its owner: Switchboard SB-93/94/95 (#139/#140), Inbox B-79/80/81 (#59),
  Observatory OBS-54, adapter#49; the principle is fabric-workspace `knowledge/agents-first.md` (#96/#97).
  **Fabric (fabric-90) has not answered yet** about the shared pack format and its RM-09 row.
- Checks: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (401 tests, 395 pass, 6 skipped); `npm run test:e2e` 9/9. One flake
  seen once under load: the Spend e2e's FD-05 Dock check (passed twice alone) — the FD-35 family.

**Done since:** merged #67 (FD-39), #68 (`--mcp-config=<path>`, Switchboard SB-94 asserts it), #69 (FD-40 spend-policy
proposal brief), and this branch: Settings → Setup, *Continue setup* / *Start over*, *Open in Terminal* carries the pack
(arguments and `export` of its environment), setup.md verifies every download with `gpg --verify SHA256SUMS.asc` + the
org key fingerprint and offers Fabric Inbox.
**Next task:** a release with FD-37 + FD-39 (needs a release-approvers approval). Then conform the pack to
`session-handoff/1` when fabric-90's contract PR lands (Fabric P-16 REQ-06), and FD-40's Dashboards part once
Observatory's grant registry exists. Open: Codex `experimental_instructions_file` (C-1); the operator's four money
defaults for FD-40 (brief §Decisions).

## Earlier — start here (2026-10-10 evening, FD-37: Windows signed, one release pipeline)

**Windows Authenticode is on** and its first signed rehearsal passed: `v0.6.7-rc.2`, run
[38073564774](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38073564774), approved by the
operator.
- **Jobs:** preflight, the gate on five runners, macos, windows x64/arm64 and linux x64/arm64 are all green;
  `publish` (approved too; a rehearsal, `publish=false`) attested 14 files — macOS 4, Windows 2 + 2, Linux 3 + 3 —
  and kept the signed set as the artifact `signed-release-v0.6.7-rc.2`; no release was created.
- **Windows receipt:** `windows_authenticode: SIGNED`. `Fabric Dashboards.exe` and the setup are `Valid`,
  signer `CN=Siarhei Sheleh, O=Siarhei Sheleh`, Microsoft RFC 3161 timestamp, and the setup's SHA-256 matches.

**Landed today on `main`:**
- #62: staged Windows build.
- #63: PL-10 pipeline. `windows-signing@v1` with the subject pinned, stage names `preflight → check → macos,
  windows, linux → still-newest → publish`, receipt keys `version/commit/arch/macos_notarization/
  windows_authenticode/checks`; differences in AGENTS.md *Release pipeline (PL-10)*. Linux `.deb` at
  `/opt/fabric-dashboards`, `chrome-sandbox` setuid root via `build/linux/after-install.sh`; the
  clean-Ubuntu check starts the GUI as an ordinary user under Xvfb.
- #64: `id-token` granted to release jobs that call workflows; rc.1 had a `startup_failure`.

**Elsewhere:**
- Identity: `github-release-signing-fabric-dashboards`, made by the project-observatory-3d session.
- `.github` #33: switch on in `products.json`, applied with `setup-release-env.py`.
- fabric-workspace #94: three lessons in platforms.md.

**Next task:** the first real release with Windows and Linux files. Bump the version and write its CHANGELOG
section; signing is on, so no NOT_SIGNED line is needed. Then FD-37 M3 rest, M4 (updates per OS; the feed
check is macOS-only until then), M5 and M6, as below.

## Earlier — start here (2026-10-10, FD-37: Windows and Linux build and run)

**Branch `agent/fd37-m1b-ci-matrix`** — CI evidence: run [38010248791](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38010248791) (the gate green on all five runners) and run [38012299256](https://github.com/passioncode-ai/fabric-dashboards/actions/runs/38012299256) (macOS gate + all four packages green with their install checks). Done on it:

- **Unit suite on five native runners** — `validate.yml` matrix (macos-latest, windows-latest, windows-11-arm,
  ubuntu-24.04, ubuntu-24.04-arm), nightly and on dispatch; `release.yml` now calls it with `os: all`.
  Windows-only twins: `test/windows-processes.test.ts` (LC-02, T-12). Local gate: `FD_SKIP_LAUNCHD=1 npm run
  check` exit 0 (378 tests, 372 pass, 6 skipped with reasons).
- **Packages** — `scripts/dist-other.mjs` (packager app dir → fuses read back → three checks run by the finished
  binary → electron-builder `--prepackaged` → receipt), `packages.yml` (dispatch or called; release `packages`
  job; publish needs it). Every `.deb` is installed on a clean `ubuntu:24.04` (`scripts/deb-smoke.sh`); every
  Windows installer is installed, asked `initialize` and uninstalled with `/S` (`scripts/nsis-smoke.mjs`).
  Measured: the per-user install folder is `%LOCALAPPDATA%\Programs\fabric-dashboards` (electron-builder
  uses the package name); `/S` uninstall takes 2 s on x64 and 225 s on windows-11-arm (the x86 NSIS
  uninstaller under emulation).
  Rehearse from any branch: `gh workflow run validate.yml --ref <branch> -f os=all -f packages=true`.
  Windows ships `windows_authenticode: NOT_SIGNED` (PL-03, waits for the Azure certificate profile).
- **Windows correctness found by CI:** token ACL read through .NET without pwsh's `PSModulePath` and
  asynchronously (`readTokenAsync`, a cold PowerShell on arm64 took > 15 s); owner Administrators/SYSTEM
  accepted — contract **DEC-0033, fabric-agent-contract PR #24** (open; agreed with fabric-90, who cites it in
  platforms.md PL-09, fabric-workspace PR #86). Uninstall helpers no longer detached. Launch links on
  Windows/Linux (`linkInArgv`), XDG autostart on Linux (`src/core/autostart.ts`).
- **Linux `.deb` fixed:** a clean Ubuntu install failed on `libasound.so.2`; `DEB_DEPENDS` names the libraries.
- Tests remove their temp folders at exit (4,810 had piled up, 592 MB, while the disk ran full).

**Next task — M3 rest** (the branch is merged through its PR; see `git log`): MCP launcher path for an AppImage
(its mount moves every run — register `$APPIMAGE` with an `--mcp` entry), the stale-bundle watch off macOS,
host discovery and `open` per OS, notification AppUserModelId on Windows, *Open in Terminal* per OS, `.cmd`
runtimes in the console via `cmd.exe /c`; then M4 updates (PL-04, a feed naming every platform), M5 systemd /
Task Scheduler supervisors (DEC-0032), M6 the platform claim in README, `package.json` description and i18n
strings that still say "this Mac". **Human gates:** a release still needs a `release-approvers` approval; Windows
signing needs the Azure Artifact Signing profile (operator).

## Earlier — start here (2026-10-10, FD-37 Windows and Linux)

**FD-37 in progress** — [brief](evidence/briefs/2026-10-10-windows-linux-brief.md) (source ledger, 12 risky
seams, decisions D-1..D-9, REQ table, modules M1..M6) and [ADR-0019](adr/0019-windows-and-linux.md); shared
rules: fabric-workspace `knowledge/platforms.md` PL-01..PL-08 (PR #86).
**M1a merged (branch `agent/fd37-m1-portable-core`):** `src/core/platform.ts` and its wiring, service-host
0.4.0 (Windows services folder, descriptor paths, token check, look without launchctl off macOS), tray/ico/png
assets, SCN-052. Checks: `FD_SKIP_LAUNCHD=1 npm run check` exit 0 (346 tests, 345 pass, 1 launchd skip);
e2e 7/7 on macOS. **Next task — M1b:** make the unit suite pass on Windows and Linux (the inventory lists the
macOS-assuming tests: `/bin/sh` stubs, 0600 mode asserts, `lipo`, `/usr/bin/env`), add the nightly OS matrix
to `validate.yml` (macos-latest, windows-latest, windows-11-arm, ubuntu-24.04, ubuntu-24.04-arm) and run it by
dispatch; then the Windows (NSIS) and Linux (AppImage + .deb) packaging from the packager's app directory with
receipts and a packaged smoke check. **Open seam:** supervision and the Windows services folder await fabric-90's
answer (proposal sent 2026-10-10; ADR-0019 §7).

## Earlier — start here (2026-10-10, after 0.6.7)

**Released: 0.6.7 on 2026-10-09 17:07 UTC** (run 37955575384, tag `v0.6.7` on `bd136b9`; Latest). Receipt:
`checks.universal` — every Mach-O in the bundle carries arm64 and x86_64 (FD-36) — plus notarized and
stapled app, zip and image, fuses `100011011`, `checks.pty`, `checks.updateVerifier`,
`checks.downgradeGuard`, MCP `initialize` as 0.6.7. Published files checked as the updater checks them
(signature, `signedFeed`, zip hash, `codesign --strict`, team `KJ35UYYL22`, `spctl` accepted,
attestations with `--signer-repo passioncode-ai/.github`); every `node-pty` prebuild in the zip reads
`x86_64 arm64`; the `latest` feed names 0.6.7. This Mac's 0.6.6 downloaded and verified 0.6.7 at
2026-10-09 21:24 UTC (`update_check ready`) and installs it at the next idle moment.
**Next task:** FD-37 — Windows and Linux builds (operator, 2026-10-10: «адаптация сборки под Windows,
чтобы всё корректно работало, и под линукс тоже»).

## Earlier — start here (2026-10-09, release 0.6.7)

**Release 0.6.7 — branch `agent/release-067`:** FD-36 — no Intel-only Mach-O in the universal app
(PR #56, from the fabric-switchboard-93 session; the installed 0.6.6 carried thin x86_64
`node-pty` prebuilds, confirmed with `lipo -archs`). Checks: `FD_SKIP_LAUNCHD=1 npm run check` exit 0
(331 tests, 330 pass, 1 launchd skip); `npm run test:e2e` three full runs on an unlocked screen:
7/7, 7/7, 7/7 (load 10, 9, 9) after FD-35's second cause and FD-38 were fixed — the first attempts failed once each on those. **Next task:** the operator's two approvals (macos, publish), then the receipt — it must carry
`checks.universal` — the published files checked as for 0.6.6, `lipo -archs` on the installed
0.6.7's prebuilds (both `arm64 x86_64`), the knowledge base row. FD-37 (Windows and Linux) is a
product port and needs its own design first.

## Earlier — start here (2026-10-09, after 0.6.6)

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
