# Runbook — Fabric Dashboards

## Where things are

| What | Path |
|---|---|
| Services folder (descriptors) | `~/Library/Application Support/ai.passioncode.fabric/services/` (`FABRIC_SERVICES_DIR` overrides) |
| App settings and activity | `~/Library/Application Support/Fabric Dashboards/` (`settings.json`, `activity.jsonl`, `activity-state.json`) |
| App log | `~/Library/Logs/Fabric Dashboards/main.log` |
| MCP server | `/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp` (stdio; from a checkout: `npm run build:main && node out/main/mcp/server.js`) |
| Update feed | `https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json` (pinned in `src/electron/updater.ts`; no override, LC-16) |

## A service is missing from the list

1. `ls ~/Library/Application\ Support/ai.passioncode.fabric/services/` — no descriptor
   means its installer never wrote one; migrate the service (`building-fabric-services`).
2. It shows **Invalid**: the service view lists every problem; fix the installer, reinstall.
3. Probe it directly: `python3 <adapter>/plugins/fabric-agent-adapter/skills/building-fabric-services/scripts/check_service.py <id>`.

## A service shows the wrong state

| Shown | Check |
|---|---|
| Not answering | `curl -s http://127.0.0.1:<port>/.well-known/fabric-service`; `launchctl print gui/$(id -u)/<label>` |
| Two copies | `lsof -nP -iTCP:<port> -sTCP:LISTEN` shows who holds the port; stop the copy that is not launchd's pid |
| Wrong program on port | another service defaults to the port; move the newcomer and reinstall it |
| Off | the job is disabled (`launchctl print-disabled gui/$(id -u)`); Start in the app enables it |

## A link or the MCP server does not work

| Symptom | Check |
|---|---|
| A `fabric-dashboards://` link opens nothing | `grep 'deep link' ~/Library/Logs/Fabric\ Dashboards/main.log` names the refusal; the app registers the scheme only when packaged, so a checkout build (`npm start`) does not receive links |
| The link opens another copy of the app | two installed copies: `mdfind "kMDItemCFBundleIdentifier == 'ai.passioncode.fabric-dashboards'"`; keep the one in `/Applications` |
| Many tool calls at once read agents as down | concurrent calls share one read of every agent while it runs (FD-148, `look` in `src/mcp/tools.ts`); a call that comes after it reads afresh, so a second answer that still reads down is the agent's own state |
| The MCP server does not connect | `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \| "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"` must print one line with `serverInfo` |

## Release

A release is built, signed and published **only by GitHub Actions**, in this repository's
protected `release` environment ([`.github/workflows/release.yml`](../.github/workflows/release.yml);
the organization's rule and shared actions:
[passioncode-ai/.github `release-signing/`](https://github.com/passioncode-ai/.github/blob/main/release-signing/README.md)).
No laptop holds the release keys, and a build signed anywhere else is a debug build that is never
published or attached to a release.

1. Release pull request: bump `version` in `package.json`, add the `CHANGELOG.md` section
   `## <version> - <date>`, run `npm ci && npm run check && npm run test:e2e`, then the same gate on every
   system the release ships for, from the branch: `gh workflow run validate.yml --ref <branch> -f os=all`, read
   green before merging. A tag is the release decision: a Windows-only test failure found by `check` after the
   tag costs a version (0.7.0 and 0.7.2, both stopped that way on 2026-10-11). Merge to `main`.
2. Tag the merge commit and push the tag:
   `git tag -a v<version> <merge commit> -m v<version> && git push origin v<version>`.
   **Pushing the tag is the release decision** (operator, 2026-10-11): the tag ruleset `release-tags`
   lets only team `release-approvers` create, move or delete a `v*` tag, and nothing after it waits
   for a click.
3. `release.yml` starts. `version` checks that the tag names `package.json`'s version, that
   the CHANGELOG has its section and — for a full release — that the version is newer than the
   latest published release: Squirrel installs whatever the latest feed names, so an older one
   would move every installed copy backwards (ADR-0015). `guard` ([release-guard@v1](https://github.com/passioncode-ai/.github/blob/main/docs/release-signing/DESIGN.md),
   *Approval by checks*) passes the tag only when `main` contains the tagged commit; every job that
   holds the `release` environment's keys needs it, and its list of CI workflows is empty because
   `check` below runs before any signing. `check` runs `npm run check` (`validate.yml`) on every native runner
   the release ships for — macOS, Windows x64 and arm64, Linux x64 and arm64 (PL-08). `macos`,
   `windows` and `linux` (step 4a) then run in the `release` environment.
4. **Nobody approves the run** (operator, 2026-10-11, *Approval by checks*): the `release`
   environment has no reviewers since `guard` landed (#81, 10473c0); it keeps only its `v*` tag
   policy. Before that, `release-approvers` approved twice, and run 38106066248 (0.7.1) shows the
   cost: signed builds waited hours for a click nobody saw. An agent never approves a deployment with
   a person's account; under checks there is nothing to approve, so the agent watches the run and
   reports it. Should the organization return to `"approval": "people"` (`products.json`), the
   reviewers come back, and an agent that asks for an approval sends the run's direct link with the
   tag and the waiting jobs after checking the run is `waiting`.
   In the `macos` job:
   - `apple-signing` puts the CI Developer ID in a throwaway keychain. The identity and team come
     from the environment (`vars.APPLE_TEAM_ID`), never from this repository.
   - `node scripts/dist-mac.mjs --stage app --identity <from the action>` packages the universal
     app, <a id="usage-descriptions"></a>removes Electron's `NS…UsageDescription` purpose strings
     from the app's and every helper's `Info.plist` (the app asks for no camera, microphone or
     Bluetooth; `checks.usageDescriptions`, one left failing the build — FD-06), sets the release
     fuses before signing, signs it with the hardened runtime and checks it
     (strict signature, runtime flag, both architectures, `checks.fuses` — the release fuses read
     back from every slice by `scripts/fuses.mjs`, a wrong one failing the build — the MCP
     launcher answers `initialize` from the finished bundle, and the agent console's PTY spawns a
     command from `app.asar` (`checks.pty`, ADR-0017; node-pty is staged by `stageNativeModules` and
     unpacked from the asar)).
   - `notarize` notarizes the app with the App Store Connect API key, requires `Accepted`
     (Apple's log otherwise), staples it and runs `spctl --type execute`.
   - `--stage package` makes the update zip and the image **from the stapled app**, and signs
     the image.
   - `notarize` then notarizes, staples and assesses the image (`context:primary-signature`).
   - `--stage seal` measures what ships: the app, the app unpacked from the update zip and the
     image must each be stapled, and Gatekeeper must accept the app and the image. It then
     writes `update-feed.json` and the receipt; anything else fails the job. The receipt's
     `pruned` names the older release files it removed: `release/` keeps this release and the
     previous one (LC-15).
4a. <a id="windows-and-linux-packages"></a>`windows` and `linux` (both run
   [`packages.yml`](../.github/workflows/packages.yml); FD-37, ADR-0019, platforms.md PL-03, PL-10) on
   `windows-latest`, `windows-11-arm`, `ubuntu-24.04` and `ubuntu-24.04-arm`. `scripts/dist-other.mjs`
   runs in three stages:
   - `--stage app` packages the app directory, writes the fuses and reads them back (ASAR integrity is
     off on Linux, where Electron does not validate it), and has the finished binary prove three things:
     the MCP launcher answers `initialize`, node-pty runs a command from `app.asar`, and the update
     verifier accepts a real release's signature and refuses one changed byte.
   - `--stage installer` re-reads the fuses and has electron-builder `--prepackaged` make
     `Fabric-Dashboards-<version>-windows-<arch>-setup.exe` (NSIS, per user, no elevation;
     `ELECTRON_BUILDER_7Z_FILTER=BCJ`) or `…-linux-<arch>.AppImage` and `.deb` (installed to
     `/opt/fabric-dashboards`: Chromium cannot start from a path with a space).
   - `--stage seal` writes the receipt with the PL-10 keys (`version`, `commit`, `arch`,
     `macos_notarization`, `windows_authenticode`, `checks`) and each file's SHA-256.

   **Windows signing.** The `windows` job runs in the `release` environment and needs `guard`, as
   `macos` does. Where the environment's `AZURE_SIGNING_ENABLED` is `true`, the organization's
   `windows-signing@v1` signs `Fabric Dashboards.exe` between `app` and `installer`, then the installer
   after `installer`, over OIDC (no secret), and fails unless each file is `Valid` and timestamped;
   `seal` checks again and embeds both reports. The uninstaller the installer writes stays unsigned.
   While signing is off, the receipt says `windows_authenticode: NOT_SIGNED` and `seal` refuses a release
   whose `## <version>` CHANGELOG section lacks the line *Windows installers are not Authenticode-signed
   yet; SmartScreen warns once. Verify them with SHA256SUMS.* The identity (one app registration per
   repository, its federated credential and the signer role) is made by `.github`
   `scripts/setup-windows-signing.py`; the switch lives in `.github` `release-signing/products.json`.

   **Install checks.**
   - Each Windows installer is installed per user with `/S`, its MCP server answers, and the app's own
     `/S` uninstall removes it (`scripts/nsis-smoke.mjs`; about four minutes on arm64).
   - Each `.deb` is installed in a clean `ubuntu:24.04` (`scripts/deb-smoke.sh`). As an ordinary user,
     not root, its MCP server answers and the app starts under Xvfb and logs `started <version>`; then
     `apt remove` takes it away.

   Rehearse from any branch without a tag; a rehearsal never signs:
   `gh workflow run validate.yml --ref <branch> -f os=all -f packages=true`.
4b. <a id="feed"></a>`feed` (FD-37 M4a, PL-04) runs once `macos`, `windows` and `linux` are done. It takes the macOS
   `update-feed.json` (staged as the artifact `feed-macos`, outside `release-*`) and every receipt, and writes the
   release's feed with `platforms`: for each of `darwin-universal`, `win32-x64`, `win32-arm64`, `linux-x64` and
   `linux-arm64`, the file that copy updates from and its hash (Linux also names its `.deb`). A release whose feed
   would lack a platform, or whose receipts disagree on the version or the commit, fails here, and `publish` never
   starts (`scripts/release-feed.mjs`, `test/release-feed.test.ts`).
5. `still-newest` repeats step 3's guard right before publishing: hours may pass between the
   first check and the publish, and a newer release may have been published meanwhile. A
   rehearsal skips it.
6. `publish` holds the GPG key, so it runs in the `release` environment too, after `still-newest`. It attests every file
   (Sigstore), writes `SHA256SUMS` and `SHA256SUMS.asc`, and publishes the release with the
   CHANGELOG section as its notes. Its files: `Fabric-Dashboards-<version>.dmg`,
   `Fabric-Dashboards-<version>-mac.zip`, `update-feed.json`, the receipt, the Windows and Linux
   packages with their receipts (step 4a), and the sums. It publishes only when every system's
   packages were made.
7. The feed is served from `releases/latest/download/`, so the newest release is the feed.
   Installed apps pick the update up within six hours, or at once from
   *Fabric Dashboards → Check for Updates…*.

**One release run at a time.** Every run of `release.yml` — rehearsals included — shares the
concurrency group `release` without cancel-in-progress: a new tag's run waits, without even running
`version`, until the run ahead of it ends. GitHub keeps one *pending*
run per group, so a third run silently cancels the second. To supersede a queued run, cancel it
first, then push the new tag. A run waiting on an environment approval (only under `"approval": "people"`) ignores
`gh run cancel` (it stays `waiting`, measured 2026-10-06 on 37398766044); end it with
`gh api -X POST repos/passioncode-ai/fabric-dashboards/actions/runs/<id>/force-cancel`.

**Re-running a failed job of a release run** (`gh run rerun <id> --failed`) keeps the tag and the version, and is
right for a failure the product's code did not cause (a runner, a network, a flake that passed on the same code
before). A **Windows package job** needs nothing more since FD-96: before each signing pass it deletes the signing
module's cache (`ArtifactSigning-*`; step *Drop the signing module's cache* in `packages.yml`), so the action installs
the module itself. Azure's action keeps that module under one key for both Windows images, at the first
`PSModulePath` entry of the job that saved it, and a job that restored another's copy could not load it ("The term
'Invoke-ArtifactSigning' is not recognized", measured on 0.7.26's run 39955756486: attempt 2 failed that way, attempt
3 after a manual deletion signed and published). By hand, if that step ever fails: `gh cache list --key
ArtifactSigning`, then `gh cache delete <id>`.

A published release is never rewritten; a fix is a new tag. Verify a download with
`gpg --verify SHA256SUMS.asc SHA256SUMS`, `shasum -a 256 -c SHA256SUMS --ignore-missing` and
`gh attestation verify <file> -R passioncode-ai/fabric-dashboards --signer-repo passioncode-ai/.github`
(the attestation is signed by the organization's reusable `release-publish.yml`, so without
`--signer-repo` the check fails with `verifying with issuer "sigstore.dev"` — measured on 0.6.5).

**The app verifies the same files before it updates** (LC-16, ADR-0015 amendment): `SHA256SUMS`
must be signed by the key pinned in `src/core/release-verify.ts`, and the zip's hash and the app's
signature must match. A release is installable only if its `SHA256SUMS` lists
`Fabric-Dashboards-<v>-mac.zip` and is signed; when the organization rotates the release key, ship
a release signed by the old key that pins the new one first. The receipt's
`checks.updateVerifier` proves the finished bundle verifies v0.6.0's signature. A release that
needs a person's step puts `"needsPerson": "https://…"` (its steps) in `update-feed.json`; the app
then holds it until the person installs it. What the updater did is in `main.log` under the codes
`update_check`, `update_download`, `update_install`, `update_restart`, `auto_update`
(`grep -E 'update_|auto_update' ~/Library/Logs/Fabric\ Dashboards/main.log`).

**Rehearsal.** Push an annotated `v<version>-rc.<n>` tag (the push trigger ignores it), then run
`gh workflow run release.yml --ref v<version>-rc.<n> -f publish=false`. The same `guard` and
`check` apply. The signed set is kept as a workflow artifact for 14 days, and no release is created.

**A local build is for debugging only.** `npm run dist` runs the same three stages in one go on
this Mac with the one Developer ID it finds (or `--identity NAME`). `--notary-profile NAME`
notarizes with a keychain profile and reads Apple's status, not the exit code. `--unsigned`
makes a test build. Its receipt reads like a release's, but it is never published.
`node scripts/fuses.mjs "<path>.app"` reads the fuses of any built or installed app.

The update URL is public only while the repository is public; a private repository's
release assets need authentication, and the updater then reports the error in the
sidebar footer instead of updating.

## Update proof

`update-proof.yml` proves that a copy installed the way a person installs it updates itself with nobody touching it, on
Windows x64 and arm64 and Linux x64 and arm64 (`scripts/update-proof.mjs`; macOS updates are proven by every release,
ADR-0015). The copy runs hidden with its own data folder, and the proof is read from its log.

- **Two versions** (after every release): `gh workflow run update-proof.yml -f from=<previous> -f to=<latest>`.
- **A fix before its release**: add `-f build=true`. The installed copy is then this ref's code, built unsigned with
  the `from` version number (`FD_PROOF_FROM_DIR`).
- **Three versions** (FD-114, for FD-98): `-f build=true -f from=<n> -f via=<n+1> -f to=<n+2>`, where `to` is the
  latest release. The build bakes `out/main/proof-feed.json` with `FD_PROOF_FEED=http://127.0.0.1:47391/update-feed.json`.
  - `dist-other.mjs` writes that file only in a debug build (`--allow-dirty`, never `FD_WINDOWS_RELEASE`) and removes it
    from every other build; `dist-mac.mjs` always removes it.
  - The updater accepts only a loopback http URL of an `update-feed.json` (`proofFeedUrl`, `src/core/release-verify.ts`)
    and logs `update: proof feed …` when it reads one.
  - The proof's server on that port names `via` until the copy logs `update_check ready version=<via>`, then `to`: a
    release published while an update waits.
  - The releases' signed files still come from GitHub and are verified as always; only the `latest` pointer is local.
  - The copy must end as `to` in one restart: since FD-98 a ready Windows or Linux copy prepares the newer release
    beside the ready one (`recheckReady`, `src/electron/updater.ts`), and the proof fails on a second restart.
  - Tests: `test/proof-feed.test.ts`.

## Log digests

FD-144 (ADR-0188 in Fabric, the operator's relay of 2026-11-04): the app counts what `main.log` takes, by operation and
outcome, and writes digests beside its data in `digests/` (0700, files 0600):

- `hourly-YYYY-MM.jsonl`: one `ops.digest.hourly@1` per closed hour the app ran through, empty ones included (OD-1 of
  the contract's draft DEC-0153: the next hour then compares with zero; an hour the app did not run is a gap), `{schema, from, to, ops[{op, ok, failed, unknown}],
  total, risen[{op, failed, previous}]}`; written within a minute of the hour's end.
- `daily-YYYY-MM.jsonl`: one `ops.digest.daily@1` per closed UTC day that has hours, `{schema, day, hours, ops, total,
  risen[{op, hours, failed}]}`. Once a UTC day, and at the first roll after a start, every closed day of this month and
  the one before with hours and no daily line is folded (OD-5, FD-153), so a Mac closed over midnight still gets its days;
  a day the app did not run has no daily line.
- `open.json`: the hour still open, kept across a quit so a restart in the same hour neither loses nor doubles it; after a
  crash it may hold an hour the minute timer already wrote, and that hour is not written again (FD-153).

What is counted (`classify` in `src/core/ops-digest.ts`): the structured events (`update_check`, `update_download`,
`update_install`, `update_restart`, `auto_update`, `estate_check`, `dock_hide`, `fabric_button`, `analytics.flush`),
alert deliveries (`alerts`: sent or not delivered), agent-name reads (`agent_names`) and crashes (`crash`). Prose lines are
not counted rather than guessed at.

The map of outcomes (OD-3 of the contract's DEC-0153 allows a product its own, published here; FD-153):

| Counted as | Outcomes |
|---|---|
| `ok`: the operation did what it was asked | `current`, `ready`, `available`, `newer_while_ready`, `started`, `done`, `installed`, `restaged`, `resumed`, `requested`, `confirmed`, `on`, `off`, `opened`, `recovered`, `sent`, `shipit_removed`, `ok`, `alerts: sent`, `agent_names failed=0` (only these) |
| `failed`: it tried and could not | any outcome with `fail`, `error`, `mismatch` or `timeout` in it (`check_failed`, `download_failed`, `recheck_failed`, `signature_failed`, `shipit_remove_failed`, `get_failed`, `failed`), `kept` (an analytics batch the server did not take, kept to send again), `dropped` (one it gave up on), `alerts: … not delivered`, `agent_names failed=N` with N above 0, a crash |
| `unknown`: an answer of setup or policy, or the person's | `unsupported`, `needs_migration`, `refused` (also the person declining Restart to update), `denied`, `skipped`, `held`, `misplaced`, `staging_lost`, and any outcome not named in this table |

A rise is at least 10 failures in an hour and at least twice the previous hour's (a previous
hour with none counts as one). Files older than three months go when a new month's file starts. The shape is the contract's DEC-0153 as released (fabric-agent-contract `v0.1.0+2026-11-06.1`): its vectors and its
closed schemas run in `npm run check` (`test/ops-digest-contract.test.ts`, the files in `test/fixtures/contract/`), and on
a Mac that has digests the same test checks every line already written. Sending the daily digest to Observatory is
Fabric's (below) and waits for Observatory's record kind (OBS-330).

Who sends it (Fabric's CO-503, board thread `f7758225`, 2026-11-05): nobody in this app. Fabric reads
`digests/daily-YYYY-MM.jsonl` once a day after the UTC day closes and passes the day's line as it is to Observatory's
`ops.digest.record` with source `app`, under this product's project. Dashboards has no fabric-service descriptor, so
Fabric keeps the folder in its own list of known hosts (macOS `~/Library/Application Support/Fabric Dashboards/digests`,
Windows `%APPDATA%\Fabric Dashboards\digests`, Linux `~/.config/Fabric Dashboards/digests`). **Moving the folder breaks
that list**: say so on that thread before the release that moves it.

Read the last day: `tail -1 ~/Library/Application\ Support/Fabric\ Dashboards/digests/daily-$(date -u +%Y-%m).jsonl`.

## Moving to another Mac or another macOS user

FD-157 (the operator's instruction of 2026-11-05, relayed on board thread `1fe66e6e`). Dashboards keeps nothing that
binds it to one machine: everything it writes is under the user's home (AGENTS.md, Lifecycle, "Files it writes").

| What | On the new Mac or user |
|---|---|
| The app | installed fresh from the release, into `/Applications` on a one-user Mac or `~/Applications` where several macOS users share it (FD-145); it updates itself there |
| Settings, layout, pinned and hidden agents, activity history | copy `~/Library/Application Support/Fabric Dashboards/settings.json` (and `activity.jsonl`) with the app quit, or start fresh; nothing else in that folder needs to move |
| Agent names | nothing to move: they live in each agent's own GitHub repository (`.fabric/names.json`, ADR-0026) and are read again 20 s after start |
| The MCP entry for Claude Code and the login item | made again by the first launch of the installed copy, for that user only |
| Dashboard sign-ins | not moved: the cookies are encrypted with this Mac's «Fabric Dashboards Safe Storage» Keychain item (FD-04), so each dashboard asks for a new sign-in code once |
| Descriptors and token files | belong to the services, not to Dashboards: each agent writes its own when it is installed on the new Mac (`~/Library/Application Support/ai.passioncode.fabric/services`); Dashboards never copies a token |
| Ports | none to choose: Dashboards listens on no port; its one channel is a socket in its own data folder (ADR-0025) |

On a Mac with several macOS users, a service token goes to 127.0.0.1 only when that user's own process listens on the
port (FD-156, SECURITY.md), so one user's Dashboards never sends a token to another user's agent.

## Tests that touch this Mac

`test/monitor.test.ts` bootstraps a throwaway LaunchAgent labelled
`ai.passioncode.fabric-dashboards.test.sample` and removes it afterwards. launchd keeps an
enable/disable override for every label it has seen and offers no command to delete
one; the fixed label keeps that to a single `enabled` entry.

## Installed MCP cold-start check

After an app update, quit the graphical Fabric Dashboards app while retaining a
registered ready service. Use a fresh MCP process from the installed bundle:
initialize, host_status, then open that service with `fallback=never`. Observe
that the app is running before using a UI helper that could itself launch it,
then verify the selected service and embedded page. Repeat from Overview while
the host is running. Keep these UI observations separate from accepted_by_os.

Version 0.3.2 exposed why a warm-open check alone is insufficient: the packaged
MCP's ELECTRON_RUN_AS_NODE flag reached desktop dispatch, which accepted the URL
but started no graphical window. Version 0.3.3 clears it only in the dispatch
child. The process-boundary regression is in test/host.test.ts; the release
[receipt](runs/2026-10-01-dashboard-links/cold-launch-regression.json) records its
failing baseline. Never fix this by adding open -n or starting another service.
