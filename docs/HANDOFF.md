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
| Skill `building-fabric-services` | `fabric-agent-adapter` PR #2, tag `v0.4.0` | merged (`18ac7c1`), tagged; **npm publish pending** (needs `npm login`) | `npm test`, both `claude plugin validate --strict` |
| Cross-repository ADR | `fabric` ADR-0083 (PR #2) | merged | `scripts/check-docs.sh`, `check-registers.mjs` |
| Product mark | `passioncode-ai.github.io` PR #6 | merged | site `npm run check` |
| **Fabric Dashboards 0.1.0** | this repository, tag `v0.1.0` | **released** — [GitHub release](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.1.0), installed in `/Applications` on the operator's Mac, login item registered | receipt: Developer ID, notarization `accepted and stapled`, Gatekeeper `accepted`; `update-feed.json` and the zip download anonymously (HTTP 200) |
| Launcher `passioncode` 0.1.1 | `passioncode` tag `v0.1.1` | installed on the operator's Mac from the tagged payload; **npm publish pending** (needs `npm login`) | `passioncode status`: 3 plugins, hubs 3/3, no shadows |
| Project Observatory server | `project-observatory-dashboard` PR #75 | open; CI re-running after the heartbeat fix | 40 fabric-service tests; 62/63 suites locally, the 63rd fails on `main` too |
| The operator's own services | their private repositories | migrated on branches, landed locally only | not published, not named here |

This repository was recreated from a clean tree on 2026-09-29 so that nothing about the
operator's personal agents is public; the development history is kept privately in
`passioncode-ai/fabric-dashboards-archive`.

## Open

- UX scenarios are `draft` until the operator approves them from the running app.
- npm publishing of `@passioncode-ai/fabric-agent-adapter` 0.4.0 and `passioncode` 0.1.1:
  hosted Actions for private repositories are held by the organisation's spending cap, and
  this machine has no npm login.
- Merge PR #75, cut the Observatory release it needs, reinstall its server, and see it in
  the app as `ready`.

## Next task

After `npm login` on the operator's Mac: `npm publish` in `fabric-agent-adapter` (at
`v0.4.0`) and in `passioncode` (at `v0.1.1`, `prepublishOnly` re-vendors from tags and
tests), then `npx passioncode@latest status`.

## Known residue

- Two `enabled` launchd overrides from the first test runs remain in the operator's
  launchd database for labels `ai.passioncode.fabric-dashboards.test.<pid>.<port>`. They do
  nothing; launchctl cannot delete an override. Later runs use one fixed label.

## Checks run

`npm run check` (exit 0, 23 tests incl. a real launchd job), `npm run test:e2e` (pass),
`npm run dist -- --notary-profile fabric-notary` from `v0.1.0` (receipt above), and a real
Electron capture of an embedded dashboard at the bounds of the dashboard area.
