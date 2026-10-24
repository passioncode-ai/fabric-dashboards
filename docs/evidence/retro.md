# Retrospective

Read at the start of every run in this repository. **Standing instructions** bind the
run and stay at ten or fewer; each names what retires it. The **Recent log** is queried
by the task's nouns, not read in full.

## Standing instructions

1. **A merge is conditional on the gate's exit code in the same command.** Write it as
   `R=$?; [ "$R" = 0 ] && gh pr merge …`, never as a chain where a failing gate prints and
   the merge still runs. *Retire when* every repository here merges through a protected
   branch whose required check is the same gate.
2. **Reproduce a repository's CI step by step before pushing to it** — every step of its
   workflow file, each with its own exit code — rather than the one suite you changed.
   *Retire when* the repository ships its own `ci-local` script and it is the one run.
3. **Classify ownership before visibility.** Before a repository is transferred, made
   public, or named in a public artifact, establish whose product it is; a service that
   merely implements the public protocol belongs to whoever wrote it, not to this org.
   Public examples use `example-agent`. *Retire when* the org index carries an ownership
   column that a gate checks.
4. **A build writes to the scratchpad and deletes what it made.** A universal Electron
   build plus notarization zips is several gigabytes; a full disk takes down unrelated
   live services. Check free space before `npm run dist`. *Retire when* `dist-mac.mjs`
   refuses to start below a free-space floor.
5. **A test that times out says what it saw.** A wait loop reports the last answer and, for a
   child process, its output and a faulthandler stack dump. The first macOS failure said only
   "did not become ready" and cost three CI rounds; the dump named `socket.getfqdn` at once.
   *Retire when* the kit ships a wait helper that does this and every repository uses it.
6. **Read the target repository's own merge and release rules before touching its version or
   changelog, and fetch before choosing a version number.** *Retire when* a pre-push hook
   refuses both.
7. **A UI end-to-end run on this Mac checks the screen lock first** (`ioreg -n Root -d1 | grep
   CGSSessionScreenIsLocked`): while it is locked, macOS sends windows no show, hide or focus
   events, so every visibility assertion (FD-05's Dock, LC-08) fails for reasons no code has.
   *Retire when* the e2e suite skips those assertions itself on a locked session.

8. **Commit only after `npm run typecheck`, not after a `tsx` test of the file you changed.** `tsx` strips
   types and runs, so a test can pass on code that does not compile; on 2026-10-12 a DEC-0070 change dropped
   the required `kind`, `subject` and `notify` of every event (notify drives notifications) and was committed
   green. *Retire when* the pre-commit hook runs the typecheck on a staged `.ts` change.

## Run stamps

| Run | Commit | Date |
|---|---|---|
| Fabric Dashboards 0.1.0 + fabric-service/0.1 + passioncode launcher | `41facd4` | 2026-09-29 |
| Close-out: Observatory 0.8.0, adapter 0.4.2, passioncode 0.1.2, local reinstalls | `10948f5` | 2026-09-29 |
| 0.6.0 focus layout and agent console (ADR-0017) | `36bf759` | 2026-10-06 |
| Board waves 2026-10-12 (FD-01…FD-60) | `agent/board-waves` | 2026-10-13 |
| Review of 0.7.26 and 0.7.27 (FD-100), DOCMAP (FD-99) | `df2f895` | 2026-10-24 |

## Recent log

### 2026-10-24: the review of 0.7.26 and 0.7.27 (FD-100)

- **Three blind readings found what the author's own checks did not**: a security document left behind (SECURITY.md),
  an empty pane when a conditional tab leaves the list, and a limit read against the wrong unit (per context instead of
  per agent and context). Owned by stage 9 and stage 3: the propagation matrix had no row for "a new token use" until
  `docs/DOCMAP.md` (FD-99), and the spec read the contract's Limits section without its Load section.
- **The whole e2e suite filled the Mac's swap and disk** (130 MB free): `node --test` runs the files in parallel, each
  with its own Electron. On a loaded Mac run it with `--test-concurrency=1`; the tag waited for it.

### 2026-10-13 — board waves: the run diverged twice

- **Retired standing instruction 4** (guarded files take the lease first): FD-26's pre-commit hook now refuses
  an unleased guarded path; it refused this run's own CHANGELOG commit before the lease was taken.
- **A change was committed green that did not compile** (DEC-0070: events lost `kind`, `subject`, `notify`).
  Surfaced at the next typecheck; owned by stage 5 (the change was tested with `tsx`, which strips types).
  Fixed in `f04ad09`; new standing instruction 8.
- **A refactor moved a guard past the call it guards** (FD-20: `busy` set after launchctl instead of
  before). Caught in review of the same change, before commit; a test that failed on the planted defect holds
  it (`test/control.test.ts`, R-8).

### 2026-10-06 — 0.6.0: the run diverged three times

- **Guarded files edited before their lease, again** (`docs/HANDOFF.md` and `CHANGELOG.md` in the
  0.5.6 close-out). Surfaced at stage 9; owned by stage 5. Standing instruction 4 already says it;
  a class seen twice becomes a script: board row to add a pre-commit check that refuses an unleased
  guarded path (instruction 4's own retirement trigger).
- **A doc claimed a consumer that does not exist** — "Fabric shares the package and runs the
  vectors". Surfaced when the Fabric session answered; owned by stage 1 (a cross-repository claim
  was never measured in the other repository). Fix: grade *docs* — ADR-0006 amendment with the
  `git grep` receipt.
- **A locked screen read as a regression.** FD-05 failed on `main` and on the branch alike; a bare
  Electron window got no show/hide events either. Surfaced at stage 6; owned by stage 6. Fix: grade
  *process* → standing instruction 8.

### 2026-09-29 — the run diverged four times

- **Merged on a failing gate.** Symptom: the contract PR merged while the printed gate
  exit was 1. Surfaced at stage 7; owned by stage 7. Root cause: an unconditional command
  chain. The gate re-run on a clean install of the merged main was green (the failure was a
  symlinked `node_modules`), so nothing broken landed — by luck, not by design. Fix: grade
  *process* → standing instruction 1.
- **Guarded ADR edited before its lease.** Surfaced at stage 9; owned by stage 5. The
  lease was taken afterwards and the agent-sync journal carries a `LATE LEASE` row. Fix:
  standing instruction 4.
- **A repository's CI failed on a step never run locally** (its source inventory). Surfaced
  at stage 7; owned by stage 6. Fix: a script reproducing the workflow step by step;
  standing instruction 2.
- **The operator's own services were first treated as org products** — transferred into
  the org and named in public fixtures and the launcher. Surfaced when the operator
  corrected it; owned by stage 0 (the grill never asked whose they were). Fix: the
  repositories went back to their owner, public artifacts were neutralised, this
  repository was recreated from a clean tree with its history archived privately, and the
  rule was recorded in the operator's global instructions. Check next time: standing
  instruction 3.
- **The release build filled the disk** and a live local service's heartbeat hit
  `ENOSPC`. That service now reports a failed heartbeat as a degraded row instead of
  staying `starting`. Standing instruction 5.

### 2026-09-29 (close-out) — three more

- **A CI timeout diagnosed by guessing.** The macOS job failed "server did not become ready"
  three times; the first fix (heartbeat) addressed a real but different fault. Surfaced at
  stage 7; owned by stage 6 (the test gave no evidence). Root cause: `HTTPServer.server_bind()`
  calls `socket.getfqdn()` before `listen()`. Fix: diagnostics first (last answer, output,
  stack dump), then `LoopbackHTTPServer`. Standing instruction 6.
- **A feature PR edited another repository's CHANGELOG**, which its AGENTS.md reserves for the
  release PR. Surfaced at the merge; owned by stage 7. Fix: the PR became the 0.8.0 release.
  Standing instruction 7.
- **Two sessions released the adapter as 0.4.1 at the same time.** Surfaced as a merge
  conflict; owned by stage 7. Fix: rebased and released as 0.4.2; the other session recorded
  the collision in the adapter's handoff. Standing instruction 7.
