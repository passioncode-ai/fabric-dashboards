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
4. **Guarded files take the lease before the edit, not after.** *Retire when* the
   pre-commit hook refuses an unleased guarded path.
5. **A build writes to the scratchpad and deletes what it made.** A universal Electron
   build plus notarization zips is several gigabytes; a full disk takes down unrelated
   live services. Check free space before `npm run dist`. *Retire when* `dist-mac.mjs`
   refuses to start below a free-space floor.
6. **A test that times out says what it saw.** A wait loop reports the last answer and, for a
   child process, its output and a faulthandler stack dump. The first macOS failure said only
   "did not become ready" and cost three CI rounds; the dump named `socket.getfqdn` at once.
   *Retire when* the kit ships a wait helper that does this and every repository uses it.
7. **Read the target repository's own merge and release rules before touching its version or
   changelog, and fetch before choosing a version number.** *Retire when* a pre-push hook
   refuses both.

## Run stamps

| Run | Commit | Date |
|---|---|---|
| Fabric Dashboards 0.1.0 + fabric-service/0.1 + passioncode launcher | `41facd4` | 2026-09-29 |
| Close-out: Observatory 0.8.0, adapter 0.4.2, passioncode 0.1.2, local reinstalls | `10948f5` | 2026-09-29 |

## Recent log

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
