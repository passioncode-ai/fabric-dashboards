# Refactor waves, 2026-11-17

The operator, 2026-11-17 (this repository's session): «Анализируй тот вид, который должен быть в конце, все функции,
которые должны работать корректно, и в каком они вида должны быть. Смотри на то, как и сейчас, и как корректно это
работает, и составь план рефакторинга, и волнами все до конца закрой. Не забудь параллельно решать задачи, которые
прилетают.»

Base: `main` `1410cf27` (0.8.178), `FD_SKIP_LAUNCHD=1 npm run check` green (1471 tests, 1461 pass, 10 skipped, 0 fail).
Course check: North Star §4 (the *Dashboards* row: «One system, not a pile of tools») and the rules' reliable-work goal;
no new feature, so no plan row moves. Architect consulted (`audit.py consult`, 2026-11-17): template `agent-host`, rule
R33 O8 (every person's function is an agent capability with the same effect), applied to FD-300 below.

## What the end state is

The target behaviour is [docs/ux/scenarios.md](../../ux/scenarios.md) (120 scenarios); the target structure is this
plan's last wave: each main-process concern in its own module with its own state, one wrapper per Switchboard command,
one place for each shared constant, and every document saying what the code does. Behaviour stays as it is except
where a finding below shows the code or a document is wrong.

## Findings

Two read-only audits on `1410cf27`, each with file:line evidence (kept in the backlog rows they became):

- **Functional (S):** scenarios, README and backlog against the code. 18 findings: one high (S-1, a New agent or New
  dashboard started on another machine runs without its brief), the rest documents that say something the code no
  longer does or never did. All 33 MCP tools match their scenarios; every button the scenarios name since SCN-095
  exists in English and Russian.
- **Structural (R):** the six largest files. `ConsoleHost` (`src/electron/console.ts`, 2101 lines) holds about 40
  mutable collections shared by hand-overs, limit recovery, the Sessions list, new sessions and quit; `main.ts` is one
  1400-line closure with about 60 shared `let`s; the "old Switchboard" regex is written 10 times, `sessions --help` is
  read in three places with three caches, `switchboard --json targets` in three; the problem-state set in five places;
  eight renderer effects repeat read, interval and cleanup. Several tests read source files as text
  (`lifecycle.test.ts`, `parity.test.ts`, `machine-view.test.ts` and others): a move updates them in the same change.

## Waves

Each wave ends with `FD_SKIP_LAUNCHD=1 npm run check` green, its strings through the copy checks, a release tag, and its rows
closed in [the backlog](../../backlog.md). The e2e suite refuses on this Mac while the disk has under 5 GB free (1.2 GB
on 2026-11-17); waves that touch a shared screen record that and run it when the disk allows.

| Wave | What | Rows | Risk |
|---|---|---|---|
| 1 | S-1 fixed (refuse a machine for agent and dashboard, dialog and MCP); the 17 document drifts; README's tool list; backlog rows whose state is stale | FD-300, FD-301 | low; done 0.8.179 |
| 2 | Pure moves: one `COMMAND_TIMEOUT_MS`, one `SERVICE_KEY`, one `PROBLEM_STATES`, needless exports dropped, `isOldSwitchboard` and `isUnsupported` for the 10 copies, console helpers and IPC validators out of `console.ts`, `readRegistry` out of `main.ts`, the MCP schema out of `server.ts` | FD-302 | low; done 0.8.180 |
| 3 | Shared shapes: the control refusal branch shared by monitor and MCP, a renderer `usePoll` for the eight effects, one accounts cache in `ConsoleHost` | FD-303 | low to medium; done 0.8.181 |
| 4 | `main.ts` split: the console-channel answers, outage words and the uninstall flow into their modules; `registerIpc` into per-group functions | FD-304 | medium; done 0.8.182 |
| 5 | One Switchboard feature probe (launch, sessions, continue, hand-overs help) keyed by path and modification time, so a Switchboard updated in place is read again everywhere | FD-305 | medium (decision below) |
| 6 | `Shell` (`App.tsx`) into `useSessionsShell` and `useConsoleDrawer` | FD-306 | medium |
| 7 | `ConsoleHost` into collaborators (hand-overs, limit recovery, Sessions list, new sessions) over one explicit state object | FD-307 | high: 18 test files construct it |

Waves 2 to 7 change no behaviour a person or agent can see, except wave 5's re-probe timing.

## Decisions taken here

- **D-1 (S-1).** A New agent or New dashboard on another machine is refused, not built there: its brief and MCP pack
  are written beside this Mac's console, and the remote start has no way to carry them. Safest reversible option; the
  person still starts one on this computer. Sending the brief to the other machine is a later row if asked.
- **D-2 (FD-299's fallback).** `historySessionsOf` stays. Switchboard 0.7.114 lists hosted resumes in `--all` (board
  `86403ede`), but this app has no minimum Switchboard version, so a Mac on 0.7.110 to 0.7.113 still needs it. It goes
  when a version floor exists.
- **D-3 (wave 5).** Every Switchboard probe keys its cache by path and modification time, as `inPlaceFor` does today;
  the other three are keyed by path only, so a Switchboard updated in place keeps its old answers until the app
  restarts. Reading again after an update is strictly the fresher answer.

- **D-4 (wave 4).** `registerIpc` stays one function: its handlers are one line each over the main process's one
  closure, so splitting it re-indents about 250 lines and moves no state out. The parts that held logic (the console
  channel's answers, the uninstall flow, the channel's words) moved to their modules instead.

## Running alongside

Board requests are read at the start of each wave (`com.list {unread: true}`) and answered in the same turn. Open on
2026-11-17: Switchboard 0.7.114 (thread `8d8abe81`), which closes nothing here by D-2.
