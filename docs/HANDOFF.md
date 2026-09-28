# Handoff — Fabric Dashboards

Updated 2026-09-28.

## Objective

One protocol (`fabric-service/0.1`), one Fabric skill set, one desktop app (Fabric
Dashboards) and one self-updating PassionCode.ai skill launcher — see the
[design](design/2026-09-28-fabric-dashboards-design.md) and the
[brief](evidence/briefs/2026-09-28-brief.md) (REQ-01…24, decisions, carry-over ledger).

## Where each module stands

| Module | Repo · branch | State | Evidence |
|---|---|---|---|
| M1 Protocol | `passioncode-ai/fabric-agent-contract` · `agent/fabric-service-m1` · PR #6 | pushed, gate green | `pnpm run check` exit 0 (54 tests), planted schema defect caught |
| M2 Skill + kits | `passioncode-ai/fabric-agent-adapter` · `agent/fabric-service-m2` · PR #2 | pushed, 0.4.0 | `npm test`: validator OK, 30 Python + 9 Node tests; `claude plugin validate --strict` ×2 |
| M3 Pilot service | one of the operator's own services (private repository) | installed live on the operator's Mac | `check_service.py`: 19 PASS, 0 FAIL, 1 NOT_RUN; kill -9 → back in 1.8 s |
| M3/M4 App | this repo · `main` | built and tested; not yet released | `npm run check` exit 0 (23 tests incl. real launchd); `npm run test:e2e` pass |
| Brand mark | `passioncode-ai/passioncode-ai.github.io` · `agent/dashboards-mark` · PR #6 | pushed; vendored at 53cdd1b | `npm run check` in that repo passes |
| M5 Migrations | Project Observatory (`passioncode-ai/project-observatory-dashboard` PR #75); the operator's own services in their private repositories | PRs open | probe 0 FAIL on temp installs |
| M6 Ports | the operator's own services (private) | done on their branches | their suites green |
| M7 Launcher `passioncode` | new repo | open (D-3: separate package) | — |
| M8 Release | all | open (D-8: this repo's visibility decides whether the update feed is reachable) | — |

## Next task

Land the PRs listed in the org run index, release Fabric Dashboards 0.1.0 from a tag, and
verify every local service in the app.

## Known residue

- Two `enabled` launchd overrides from the first test runs remain in this user's launchd
  database (`ai.passioncode.fabric-dashboards.test.98418.63736`, `…9489.64918`). They do
  nothing; launchctl cannot delete an override. Later runs use one fixed label.

## Checks run (this session)

`npm run check` (exit 0), `npm run test:e2e` (pass), a real Electron capture of the
embedded dashboard view of a live local service at the bounds of the dashboard area.
