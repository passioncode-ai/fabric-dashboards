# Brief — estate updater: the app watches contract and skill versions, 2026-10-07

**Task.** The operator asked for a mechanism that watches the versions of the
Fabric Agent Contract and of the operator's skills, auto-updates where safe, and
lives in this app — started at launch together with Fabric Dashboards.

**Answer to "is it a service?" (building-fabric-services Step 0):** no. The
catalogue service boundary and ADR-0002 (`SECURITY.md`: the app listens on no
port, owns no launchd job, never starts a service process) exclude a separate
`fabric-service/0.1` process supervised next to the app. The mechanism is an
**in-app component of the main process**, started in `whenReady` next to
`Monitor` and `Updater`, running short-lived `git`/`npm` child processes — the
same lifecycle class as the Updater's `codesign`/`plutil` spawns. ADR-0018
records this reading and the update policy.

**Run:** task-pipeline, Proof of Done · model: the session's model, one for the
whole run · run mode off · branch `agent/estate-updater-20261007` from
`origin/main` `3e6a011`.

## Source ledger

| Source | What it says about this task | Read at |
|---|---|---|
| `AGENTS.md` Lifecycle table + LC-16 row | update-check cadence 90 s then 6 h; the app owns no launchd job and listens on no port; files it writes (LC-12) | 2026-10-07 |
| `docs/adr/0002-launchd-is-the-only-supervisor.md`, `SECURITY.md` | the constraint the design must satisfy (no port, no service supervision) | 2026-10-07 |
| `src/electron/updater.ts`, `src/core/version.ts` | the in-process pattern to mirror: timers unref'd, `event(name, outcome, detail)` log lines, one retry after failure, stuck guard | 2026-10-07 |
| `src/electron/main.ts` | wiring points: `whenReady` order, `will-quit` stops, `log()` → main.log, `pushStatus`, settings IPC | 2026-10-07 |
| `src/core/settings.ts`, `src/core/types.ts` | settings merge defaults; `SettingsPatch`; `AppStatus` shape for the status surface | 2026-10-07 |
| contract `docs/specification/versioning.md` §One contract pin | a consumer pins the contract once by full commit; moving the pin is a compatibility change reviewed per release — pins never move by themselves | 2026-10-07 |
| contract DEC-0016 | a `0.x` contract minor is additive; consumers review and repin — so "contract update available" is a *notification*, not an apply | 2026-10-07 |
| `sshlg-skills` (`~/DATA/sshlg-skills`) | `npx sshlg-skills update` reconciles the skill family; the passioncode installer's hook is the prior art: once-a-day probe, publisher trust check, background `npx --yes … update` | 2026-10-07 |
| dashboards vendored contract fixtures | `test/fixtures/contract/SOURCE.txt` records `main @<commit>`; adapter carries `fabric-contract.lock.json`; fabric carries `SOURCE.json` with `currentCommit` | 2026-10-07 |

**Contradictions:** none. ADR-0002 forbids starting *service* processes; the
estate updater starts git/npm *tool* processes like the Updater already does
for `codesign`/`plutil`. ADR-0018 records the interpretation so a future reader
does not re-derive it.

## Decisions

| id | Decision | By |
|---|---|---|
| D-1 | In-app main-process component `estate` (core in `src/core/estate-update.ts`, runner in `src/electron/estate-updater.ts`), started in `whenReady`, stopped in `will-quit`; no port, no launchd, child processes only | run |
| D-2 | Contract watch (opt-in): settings `estate.contractClone` names a local clone; probe = `git ls-remote origin main` vs local `main`; apply = `git fetch origin` only — never pull/reset/rebase; consumer pins are *read* from sibling checkouts and reported as drift, never rewritten | operator's "наблюдение", versioning.md |
| D-3 | Skills watch: registry probe `npm view sshlg-skills version` vs an installed-version record this module keeps in userData (`estate-skills.json`, absent = "unknown until the first update"); apply (only when `estate.autoSkills`, default off) = background `npx --yes sshlg-skills update` after a publisher check (`npm view sshlg-skills maintainers` must list the expected owner — verify the real value while implementing and encode it) | passioncode installer prior art |
| D-4 | Cadence reuses LC-16: first check 90 s after start, then every 6 h; one retry within the hour after a failure; nothing runs when `estate.enabled` is off (default on) | run |
| D-5 | Status surface: `AppStatus.estate`; activity log codes `estate_check` / `estate_update` (LC-12); Settings page section with EN/RU strings; a new UX scenario in `docs/ux/scenarios.md` referencing existing stories/flows | CONTRIBUTING.md |

## REQ spine

| REQ | Deliverable | Verified by |
|---|---|---|
| REQ-001 | `src/core/estate-update.ts`: pure decision logic — pin readers (lock.json, SOURCE.json, SOURCE.txt), probe-result types, trust check, cadence gating | `node --test test/estate-update.test.ts` |
| REQ-002 | `src/electron/estate-updater.ts`: timers, child execution via the existing children/run helper, activity events, settings-driven enable/apply | `npm run check` typecheck + existing suite |
| REQ-003 | Wiring: `main.ts` start/stop, `AppStatus.estate`, settings merge + IPC patch, Settings page UI, EN/RU i18n parity | `npm run check` (typecheck, UX lint, regions) |
| REQ-004 | UX scenario in `docs/ux/scenarios.md`; ADR-0018; backlog FD-30; CHANGELOG; HANDOFF.md — registers under agent-sync lease | `npm run check`, lease protocol |
| REQ-005 | Full gate green on the branch | `FD_SKIP_LAUNCHD=1 npm run check` exit 0 |

## Autonomy sweep

| Item | Resolved |
|---|---|
| Branches | worktree `../fabric-dashboards-estate-updater`, branch `agent/estate-updater-20261007`; the checkout on `agent/fd25-sb0610` belongs to another session — untouched |
| Coordination | agent-sync `fs`/`git-lease`; guarded: `docs/adr/*.md`, `docs/HANDOFF.md`, `CHANGELOG.md`, `docs/backlog*.json/md`; leases acquired per file, released on every path |
| Registers' IDs | no idRegisters here; FD-30 is the informal next backlog id (FD-29 exists) |
| Out of scope | moving any consumer's contract pin; auto-updating the app itself (LC-16 covers it); Fabric's aggregation (ADR-0013 boundary) |
| Merge | PR to `main`; merge conditional on `FD_SKIP_LAUNCHD=1 npm run check` exit 0 in the same command; hosted CI is nightly + dispatch |
