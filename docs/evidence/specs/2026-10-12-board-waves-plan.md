# Board waves 2026-10-12 — canvas, waves and decisions

Operator 2026-10-12: «давай закроем все задачи из бэклога — выполняй до конца». Run through
`/task-pipeline waves`. Base `cdb624a`. Inventory: [2026-10-12-board-waves-inventory.json](2026-10-12-board-waves-inventory.json)
(21 open rows of `docs/backlog.md`, the only source `docs/backlog-sources.json` lists).

## Survey — what was verified, not assumed (2026-10-12)

| Dependency a row waited on | Measured | Rows |
|---|---|---|
| Switchboard SB-95 `sessions`, SB-65 restart-safe sign-ins, SB-98 limit failover | `switchboard --version` → 0.6.20 (release v0.6.20 2026-10-12); `switchboard --json sessions` → `{"ok":true,"data":{"sessions":[]}}`; SB-98 commit `4f98b72` is in tags v0.6.17+ | FD-43, FD-50, FD-51 unblocked |
| `codex/dashboard-session-refresh` | merged (`619b2f1`, PR #101) | FD-42 unblocked |
| Contract runner/model profile field | `service-well-known.schema.json` `configuration.resolved.{runnerProfile,runnerKind,route,modelProfile,models}` (DEC-0046) at fabric-agent-contract `0656aa1`; a service on this Mac serves `configuration` | FD-46 unblocked except budget left |
| Contract `lifecycle.manager` per supervisor | enum `launchd, systemd, task-scheduler, node, none` (DEC-0032/0057/0061) | FD-55 buildable |
| Contract `surfaces.a2a` in the service well-known | absent (a2a only a binding/manifest `profileKind`) | FD-22 stays blocked |
| Contract instance context / audience (CX-11) | absent | FD-52 stays blocked |
| Fabric board in a fabric-service well-known | no Fabric descriptor among the 22 on this Mac | FD-12 stays blocked |
| Observatory read of policy, budget left, grants | 0.24.1 serves `grant.check` (callee side) only; no host read | FD-40 stays blocked; FD-46's budget-left part waits with it |
| Observatory node (`node.lifecycle.*`) | not served | FD-37 M5 and FD-52 wait |
| The first organization server's pages and origin | no descriptor of the first organization server on this Mac | FD-53 stays blocked |

## Canvas — target state per node

| Node | As-is | To-be | Rows |
|---|---|---|---|
| tooling | standing instruction 4 is a habit | a `pre-commit` hook (`scripts/lease-guard.mjs`) refuses a commit that stages a guarded path without this checkout's lease; installed by `npm ci` (`prepare`) | FD-26 |
| core-control | `src/electron` and `src/mcp` each run the start/stop/restart sequence | one `src/core/control.ts` both call; descriptor-flash debounce; restart-to-update returns to the page that was open; `productIdOf` in `packages/service-host` | FD-20, FD-21 |
| console-switchboard | the console starts runtimes; no admission check, no session list, no idle close | LC-17 admission (disk ≥ 5 GB, swap not exhausted, live consoles under the cap) before every start; Switchboard sessions shown beside the agent; LC-18 idle save/close/resume; LC-20 managed start checked and a moved account said | FD-43, FD-49, FD-50, FD-51 |
| appearance | ED-8/ED-10 declaration read, not applied | Settings → Appearance (scheme + seven themes), the `fabric_appearance` cookie per service partition, only declared fields applied (DEC-0059), view background follows the theme | FD-42, FD-56 |
| agent-profile | Spend breaks spend down by model | the agent's page shows its runner/model profile (DEC-0046), its spend by model and a link to change it in Fabric; budget left says where it will come from | FD-46 |
| state | `duplicate` read from launchd only | per supervisor: launchd as today, systemd `MainPID`, Task Scheduler not an outage | FD-55 |
| ops-evidence | measurements owed | FD-07 idle numbers on the installed copy, FD-01 outage-notice history, FD-02 scenario walk, FD-37 closed (M5 split out), FD-04 attempted | FD-01, FD-02, FD-04, FD-07, FD-37 |

**Deleted or superseded:** FD-42's sentence "reloads only the pages that do not declare `appearance`" is superseded by DEC-0059 (FD-56). FD-37's M5 leaves FD-37 as its own row (blocked by the node).

## Waves

| Wave | Rows | Exit criteria (before it starts) |
|---|---|---|
| 1 | FD-26, FD-20, FD-21 | hook refuses an unleased guarded commit in a test repo; one control module, both callers' tests green; U-16/U-18/M-4 tests; `npm run check` 0 |
| 2 | FD-49, FD-43, FD-51, FD-50 | admission refusal test with stubbed disk/swap/cap; sessions read through the Switchboard probe, absent Switchboard says why; managed-start test and the moved notice; idle save/close/resume test; scenarios updated; `npm run check` 0 |
| 3 | FD-42, FD-56, FD-46, FD-55 | cookie written per partition with the contract's attributes; dashboard-declaration vectors run; profile panel renders DEC-0046 fields; duplicate per supervisor tests; i18n parity; `npm run check` 0 |
| 4 | FD-07, FD-01, FD-02, FD-37, FD-04 | numbers recorded in HANDOFF with commands; scenario walk receipt; FD-37 closed with receipts; FD-04 shipped or carried with the measured reason |
| release | 0.7.7 | five-runner `validate.yml`, e2e on this Mac, tag, release run green, `update-proof.yml -f from=0.7.6`, installed copy updated |

## Decisions

| # | Question | Answer | How |
|---|---|---|---|
| D1 | LC-17 cap on live console sessions | 6 at once (this Mac: 16 GB; LC-17's day had 37 sessions at ≈ 12 GB) | assumed — the product states it in AGENTS.md; a setting can raise it |
| D2 | LC-18 idle time | 30 minutes without input or output | assumed — stated in AGENTS.md's lifecycle table |
| D3 | Blocked rows | stay open with the dependency measured today, not closed | resolved from the sources (backlog contract: close only with a receipt) |
| D4 | Release | 0.7.7 after wave 4, by tag, approval by checks | resolved from the sources (AGENTS.md *Release*, operator 2026-10-11) |

## Progress — resume here (2026-10-12, run stopped at a usage limit)

Branch `agent/board-waves` (worktree `~/DATA/.worktrees/fd-waves`), pushed; not merged, nothing released.

- **Wave 1 done** (code, tests, docs; `FD_SKIP_LAUNCHD=1 npm run check` exit 0, 499 pass at `3e51666`):
  FD-26 `f12992a`+`55612d1` (pre-commit lease guard, installed by `prepare`); FD-20 `62c29af`
  (`src/core/control.ts`); FD-21 `dcb9527` (U-16, U-18, R-19, R-20 — R-20 has no live two-release proof, M-4).
- **Wave 2 started:** FD-49's pure module `src/core/admission.ts` + `test/admission.test.ts` (6 pass), not yet
  wired into `ConsoleHost.start` (`src/electron/console.ts`).
- **Not yet done:** the backlog rows and CHANGELOG for wave 1 (guarded: take the leases), retro standing
  instruction 4's retirement (FD-26 lands it).

**Exact next task:** wire `machineProbe` + `admit` into `ConsoleHost.start` before `manager.start` (a refusal
returns `{ ok: false, reason: 'admission', detail }`, the console notice says why and what frees it, en+ru
strings), then FD-43/FD-51 in `src/core/switchboard.ts` (`--json sessions` filtered by folder; managed start
via `inPlaceArgv` for any Claude/Codex folder when `accounts list` has a `<provider>:default` route; "moved" =
the pool's route ≠ the session's `account_id`), then FD-50 (30-minute idle save/close/resume), then waves 3–4
and the 0.7.7 release as the table above says.
