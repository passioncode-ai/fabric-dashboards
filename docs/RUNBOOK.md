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
| The MCP server does not connect | `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \| "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"` must print one line with `serverInfo` |

## Release

A release is built, signed and published **only by GitHub Actions**, in this repository's
protected `release` environment ([`.github/workflows/release.yml`](../.github/workflows/release.yml);
the organization's rule and shared actions:
[passioncode-ai/.github `release-signing/`](https://github.com/passioncode-ai/.github/blob/main/release-signing/README.md)).
No laptop holds the release keys, and a build signed anywhere else is a debug build that is never
published or attached to a release.

1. Release pull request: bump `version` in `package.json`, add the `CHANGELOG.md` section
   `## <version> - <date>`, run `npm ci && npm run check && npm run test:e2e`, merge to `main`.
2. Tag the merge commit and push the tag:
   `git tag -a v<version> <merge commit> -m v<version> && git push origin v<version>`.
3. `release.yml` starts. `version` checks that the tag names `package.json`'s version, that
   the CHANGELOG has its section and — for a full release — that the version is newer than the
   latest published release: Squirrel installs whatever the latest feed names, so an older one
   would move every installed copy backwards (ADR-0015). A superseded run waiting for approval is
   cancelled, never approved. `check` runs `npm run check` (`validate.yml`). The `macos` job
   then waits for the `release` environment.
4. Someone from `release-approvers` approves it (*Review deployments*); that may be whoever
   pushed the tag. An agent never approves a release run, even when its account could.
   In the job:
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
5. `still-newest` repeats step 3's guard right before publishing: hours may pass between the
   first check and the approvals, and a newer release may have been published meanwhile. A
   rehearsal skips it.
6. `publish` waits for a second approval, because it holds the GPG key. It attests every file
   (Sigstore), writes `SHA256SUMS` and `SHA256SUMS.asc`, and publishes the release with the
   CHANGELOG section as its notes. Its files: `Fabric-Dashboards-<version>.dmg`,
   `Fabric-Dashboards-<version>-mac.zip`, `update-feed.json`, the receipt, and the sums.
7. The feed is served from `releases/latest/download/`, so the newest release is the feed.
   Installed apps pick the update up within six hours, or at once from
   *Fabric Dashboards → Check for Updates…*.

**One release run at a time.** Every run of `release.yml` — rehearsals included — shares the
concurrency group `release` without cancel-in-progress: a new tag's run waits, without even running
`version`, until the run ahead of it is approved, rejected or cancelled. GitHub keeps one *pending*
run per group, so a third run silently cancels the second. To supersede a run that waits for
approval, cancel it first, then push the new tag. A run waiting on an environment approval ignores
`gh run cancel` (it stays `waiting`, measured 2026-10-06 on 37398766044); end it with
`gh api -X POST repos/passioncode-ai/fabric-dashboards/actions/runs/<id>/force-cancel`.

A published release is never rewritten; a fix is a new tag. Verify a download with
`gpg --verify SHA256SUMS.asc SHA256SUMS`, `shasum -a 256 -c SHA256SUMS --ignore-missing` and
`gh attestation verify <file> -R passioncode-ai/fabric-dashboards`.

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
`gh workflow run release.yml --ref v<version>-rc.<n> -f publish=false`. The same approvals
apply. The signed set is kept as a workflow artifact for 14 days, and no release is created.

**A local build is for debugging only.** `npm run dist` runs the same three stages in one go on
this Mac with the one Developer ID it finds (or `--identity NAME`). `--notary-profile NAME`
notarizes with a keychain profile and reads Apple's status, not the exit code. `--unsigned`
makes a test build. Its receipt reads like a release's, but it is never published.
`node scripts/fuses.mjs "<path>.app"` reads the fuses of any built or installed app.

The update URL is public only while the repository is public; a private repository's
release assets need authentication, and the updater then reports the error in the
sidebar footer instead of updating.

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
