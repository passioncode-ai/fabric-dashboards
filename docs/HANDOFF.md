# Handoff — Fabric Dashboards

Updated 2026-10-04 (CI release rehearsal `v0.4.1-rc.1` green; releases move to CI signing; release
0.4.1, MCP links to online services).

Current release: 0.4.1 (section below). Earlier releases below are preserved as dated evidence.

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
