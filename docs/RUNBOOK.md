# Runbook — Fabric Dashboards

## Where things are

| What | Path |
|---|---|
| Services folder (descriptors) | `~/Library/Application Support/ai.passioncode.fabric/services/` (`FABRIC_SERVICES_DIR` overrides) |
| App settings and activity | `~/Library/Application Support/Fabric Dashboards/` (`settings.json`, `activity.jsonl`, `activity-state.json`) |
| App log | `~/Library/Logs/Fabric Dashboards/main.log` |
| Update feed | `https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json` (`FABRIC_DASHBOARDS_UPDATE_URL` overrides) |

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

## Release

1. Bump `version` in `package.json`, add the `CHANGELOG.md` section, commit.
2. `npm ci && npm run check && npm run test:e2e`.
3. `npm run dist -- --notary-profile fabric-notary` — read the receipt: signing names the
   Developer ID, notarization `accepted and stapled`, Gatekeeper `accepted`.
4. `git tag -a v<version> -m v<version> && git push origin v<version>`, then
   `gh release create v<version> release/Fabric-Dashboards-<version>.dmg release/Fabric-Dashboards-<version>-mac.zip release/update-feed.json --notes-file <section>`.
   The feed is served from `releases/latest/download/`, so the newest release is the feed.
5. Installed apps pick the update up within six hours, or at once from
   *Fabric Dashboards → Check for Updates…*.

The update URL is public only while the repository is public; a private repository's
release assets need authentication, and the updater then reports the error in the
sidebar footer instead of updating.

## Tests that touch this Mac

`test/monitor.test.ts` bootstraps a throwaway LaunchAgent labelled
`ai.passioncode.fabric-dashboards.test.sample` and removes it afterwards. launchd keeps an
enable/disable override for every label it has seen and offers no command to delete
one; the fixed label keeps that to a single `enabled` entry.
