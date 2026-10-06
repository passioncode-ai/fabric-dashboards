# Brief — focus on the dashboard, and an agent console beside it (0.6.0), 2026-10-06

Run: task-pipeline. Stage 0 closed 2026-10-06 (this file). Release: one release, 0.6.0.

## Request (operator, 2026-10-06, translated)

The service header above an open dashboard takes too much of the screen; the dashboard's content
is what matters. Move the header out of the way: a minimal, small view that opens to the full
information when pressed. Make the agents list collapsible too. To the right of the dashboard put
a collapsible panel where the operator works with an agent directly — open a console running
Claude Code, Codex or another installed runtime, with the operator's skills, give it tasks, edit.
Later Fabric (the harness) slots in; until then this works on its own.

Clarifications, same day:

- **No chat of our own.** "The chat is inside the console": the panel is an embedded terminal
  running the runtime's own CLI, unchanged. The same rule goes to Fabric's first version: a chat
  with an agent is the agent's own interface; everything else is harness plus control,
  management and monitoring (relayed to the Fabric owner session).
- **Which runtime, which folder and which account are configurable and correct**: the operator
  picks among the runtimes installed and ready on the Mac; when a Switchboard project binds the
  folder, the session must run on that project's account.

## Grill answers

| # | Question | Answer |
|---|---|---|
| G1 | One console for the app or one per service? | One per service: its own session and folder; switching service switches console; sessions live in parallel |
| G2 | Which folder? | Found automatically: the local checkout whose git `origin` matches the descriptor's `source.repository`, under `~/DATA`, `~/Code`, `~/Projects`, `~/Developer`, `~/src`; shown with «Other…»; remembered per service; none found → choose |
| G3 | Tool permissions | The runtime's own (the operator's Claude Code settings; prompts appear in the console itself) — now automatic, since the console is the real CLI |
| G4 | Design surface | Text (`docs/ux/screens.md`) plus screenshots of the running app; Figma not used |
| G5 | Delivery | One release 0.6.0 with everything; branch + PR, green gate, tag, the operator's two CI approvals |
| G6 | Chat UI | None: an embedded terminal (operator, 2026-10-06) |

Defaults taken and stated (not asked): panel states are remembered across launches; a console
process ends when the app quits (lifecycle LC-02); «Continue» resumes the runtime's last
conversation in that folder (`claude --continue`, `codex resume --last`).

## Source ledger

| Source | What it gave |
|---|---|
| Code: `src/renderer/App.tsx`, `ServiceView.tsx`, `styles/app.css` | the header is ~300 of 1056 px; the grid is `240px 1fr`; the dashboard view follows a `ResizeObserver` |
| ADR-0014, SCN-014/015/039–042, SCR-02, SCR-08 | the dashboard toolbar stays; service view and sidebar scenarios change |
| `docs/evidence/retro.md` | standing instructions 4 (lease before edit) and 7 (release rules before version) bind |
| `docs/backlog.md` | 23 rows, 9 open or blocked; FD-12 (COM-11) is adjacent |
| Fabric (`hub.ts`, ADR-0115/0117, DEC-0022) | no external chat or routing yet: the board (COM-02/03) is unbuilt; the CEO chat is in-app only |
| Switchboard 0.6.5 (`launch.rs`, `projects.rs`, `docs/CLI.md`, `docs/AGENT-SUPPORT.md`) | `project show --path` resolves a folder's project read-only; `launch <account> --mode managed` always opens Terminal; no supported way to obtain the launch env; subscription accounts are for the unmodified Claude Code / Codex clients only; catalog of 30 runtimes with their binary names |
| Glossaries: contract `CONTEXT.md`, Fabric `CONTEXT.md` | Host, Provider, Agent, Runtime, Session, Adapter |
| Projects wiki `projects/fabric-dashboards`, estate report 2026-10-04 | agent chat is planned over the COM board; the admin console is Fabric's |
| npm | `node-pty` 1.1.0, `@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0 |
| Verification ledger | none found |

## Seams handed to their owners

- **Switchboard** (session fabric-switchboard-ef, 2026-10-06): a launch mode that runs the prepared
  session in the caller's TTY (`--in-place`), so a project-bound session can live in the
  embedded console without Dashboards ever holding a token.
- **Fabric** (session fabric-a6, 2026-10-06): the operator's "no chat of our own" rule for Fabric v1.

## REQ table

Frozen at stage 0: adding is free, removing needs the operator.

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-01 | The service header has a compact one-line form — state, name, badge, the tabs and an expand control — and expands to the full card; the choice is remembered | e2e: compact by default, expand/collapse, height measured; restart keeps it |
| REQ-02 | In compact form a problem is never hidden: a non-ready state's reason or a failed action shows as a chip that expands the header | unit (chip derivation) + e2e |
| REQ-03 | The agents sidebar collapses to a narrow rail (state marks, initials, attention badge, tooltips) and back; remembered | e2e |
| REQ-04 | A console panel to the right of the dashboard, collapsible and resizable, open/closed and width remembered; one per service | e2e |
| REQ-05 | The runtimes offered are those installed and runnable on this Mac (Claude Code, Codex, and any other known runtime found), chosen per service and remembered | unit (detection over a fake PATH) |
| REQ-06 | The folder is found from `source.repository` (git origin match under the known roots), shown, changeable with «Other…», remembered per service | unit (fake repos) |
| REQ-07 | Switchboard: a folder in no project runs the plain runtime; a folder in a project is named, and the session starts through Switchboard (in Terminal until Switchboard can launch in place; embedded once it can); Switchboard absent → plain runtime, said so | unit (fake `switchboard`) |
| REQ-08 | The console is a real terminal: a PTY in the main process, xterm in the window, input, resize, scrollback, exit status, restart; the process is owned (killed on quit and on service removal) and gets no `ELECTRON_RUN_AS_NODE`/`NODE_OPTIONS` | unit + e2e with a scripted runtime |
| REQ-09 | «New» or «Continue» starts the runtime fresh or resumes its last conversation in that folder | unit (argv per runtime) |
| REQ-10 | «Open in Terminal» continues the same runtime and folder in Terminal | unit (argv) + manual |
| REQ-11 | The embedded dashboard's native view always fits the space left between the panels; no overlap while panels move | e2e (view bounds vs host rect) |
| REQ-12 | No token reaches the renderer; the lifecycle table, LC tests, data and uninstall paths cover the console | tests + AGENTS.md |
| REQ-13 | The native PTY module loads in the signed universal release build with the release fuses (`asar` unpacked), and the build checks it | `dist-mac.mjs` receipt check + CI rehearsal |
| REQ-14 | ADR-0017; scenarios and screens; CONTEXT terms; README; CHANGELOG 0.6.0; HANDOFF; backlog rows | `npm run check` (UX lint, regions) |
| REQ-15 | Every new string in English and Russian | i18n parity test |
| REQ-16 | Release 0.6.0 through CI with the operator's approvals | the published release and its receipt |

## Carry-over ledger

| Item | Home | State |
|---|---|---|
| Switchboard in-place launch for project-bound folders | fabric-switchboard (requested) | open |
| Fabric as the launcher/controller of console sessions once its harness and board exist | Fabric (FD-12 neighbourhood) | open |

## Close-out — 2026-10-06

Ladder walk (decision → spec → contract and its failure → task → change → test → docs), ordered by
seam. Absences it found, now rows: the console's process `PATH` (contract said login `PATH`; the
spawn used the app's) and Terminal through Apple Events on a hardened build — both fixed in
`6e54d2b` with the other review findings (R-1…R-11).

| REQ | Evidence | State |
|---|---|---|
| REQ-01 | `ServiceView.tsx` compact bar; `test/e2e/focus-console.test.ts` (one line < 64 px, card opens and closes, `layout.header` saved) | done |
| REQ-02 | `src/core/focus.ts` `problemOf`; `test/parts.test.ts` *ADR-0017 REQ-02* | done |
| REQ-03 | `App.tsx` rail; e2e (`.app.rail`, ≤ 80 px, names kept, `layout.sidebar` saved) | done |
| REQ-04 | `ConsolePanel.tsx`; e2e (opens, folds while running, replays, `layout.console.open` saved) | done |
| REQ-05 | `src/core/runtimes.ts`; `test/console.test.ts` REQ-05 ×3 | done |
| REQ-06 | `src/core/repofind.ts`; `test/console.test.ts` REQ-06 ×3; 11 of 16 real descriptors resolved in 101 ms | done |
| REQ-07 | `src/core/switchboard.ts`, `planStart`; `test/console.test.ts` REQ-07 ×4, R-2 | done (in place waits for Switchboard SB-75 — FD-25) |
| REQ-08 | `src/core/consoles.ts`, `src/electron/console.ts`; unit (fake PTY) + e2e (input, echo, exit, Stop → "Stopped.", login `PATH`) | done |
| REQ-09 | `runtimeArgs`; unit; e2e `args:[--continue]` | done |
| REQ-10 | `openInTerminal` (`.command` via LaunchServices), `terminalScript` quoting unit-tested | done; not yet run on a signed build (HANDOFF next task) |
| REQ-11 | e2e: native view width equals the host's after the console opens | done |
| REQ-12 | no token in renderer (review checked); AGENTS LC-09 row; settings data path | done |
| REQ-13 | `stageNativeModules`, `NATIVE_UNPACK`, `NATIVE_BOTH_ARCHS`, `ptyCheck`; `test/dist.test.ts`; unsigned universal build `checks.pty`, arm64 + x86_64 PTY runs | done; signed run in release 37505569449 |
| REQ-14 | ADR-0017, ADR-0016 amendment, SCN-046…050, SCR-02/08/10, CONTEXT, README, AGENTS, SECURITY, RUNBOOK, CHANGELOG 0.6.0, HANDOFF, FD-24/25; `npm run check` (UX lint, regions) | done |
| REQ-15 | `i18n.ts` en + ru; parity tests green | done |
| REQ-16 | tag `v0.6.0` on `36bf759`; run 37505569449 `version`, `check` green, `macos` waits for the operator | open — the operator's approvals |

Gate counts: `FD_SKIP_LAUNCHD=1 npm run check` 269 tests (268 pass, 1 skipped, the launchd test);
`npm run test:e2e` green except FD-05's Dock assertion, which needs an unlocked screen. Carry-over:
FD-25 (Switchboard SB-75) open; Fabric's harness launching consoles — Fabric P-13.
