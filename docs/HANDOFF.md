# Handoff — Fabric Dashboards

Updated 2026-09-29.

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
| Launcher `@passioncode-ai/passioncode` 0.1.4 | `passioncode` tag `v0.1.4` (`df38fd3`) | **on npm**; this Mac updated from npm; the self-update sees 0.1.4 by `ssheleg`, a trusted publisher | `npx @passioncode-ai/passioncode@latest status`: 3 plugins, hubs 3/3, no shadows |
| Project Observatory server | `project-observatory-dashboard` PR #75 → 0.8.0 (`d454fb4`, tag `v0.8.0`) | merged through all three required checks, released, installed on the operator's Mac with its descriptor | live `check_service.py`: 20 rules, 0 FAIL, 1 NOT_RUN (no login declared) |
| The operator's own services | their private repositories | merged and reinstalled locally only; not published, not named here | each probed live; the only FAIL left is one data directory the operator chose to keep inside its checkout |

This repository was recreated from a clean tree on 2026-09-29 so that nothing about the
operator's personal agents is public; the development history is kept privately in
`passioncode-ai/fabric-dashboards-archive`.

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

Next task: merge, then `npm run dist -- --notary-profile fabric-notary` from the merge
commit, tag `v0.2.0`, publish the release (RUNBOOK → Release), install, register the MCP
server (`claude mcp add fabric-dashboards -- "/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp"`).

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
