---
report: fabric-dashboards-2026-11-15-quality-audit
project: fabric-dashboards
date: 2026-11-15
asked: the operator, session 36babb6c: «запускай анализ интерфейсов, и глюков, задержек, производительности и корректности работы, багов ... недоработки, ошибки, недоделки, опечатки, нарушения логики, проблемы в интерфейсе, с вёрсткой, с типографикой, с UI-дизайном ... и всё это волнами до конца исправляем»
base: main 8b7bdf7 (0.8.101)
---

# Quality audit, 2026-11-15

Four read-only audits on `main` (0.8.100 to 0.8.101), each with file:line evidence: interface and UX (U), text and
terminology (T), performance and latency (P), correctness and logic (C). The waves that fix them are in
[the plan](../../plans/2026-11-15-quality-waves/README.md). Sources besides the audits: the 52 backlog rows not done,
GitHub issues #294 and #26, the project board (nothing queued on 2026-11-15).

## U: interface, layout, typography, UX (14 findings, none blocking)

Screenshots: today's e2e runs (`FD_SCREENSHOTS`); no dark theme or Russian shots, so contrast and Russian overflow are
judged from code and string lengths.

| Id | Sev. | Screen | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| U-01 | high | agent header | tabs and the problem chip squeezed out at ordinary widths: Health and Logs hidden exactly when an agent is in trouble | `app.css:273-282` (the chip shrinks first, labels fold only under 900 px), `ServiceView.tsx:83,87` (the active tab scrolled into view only on a tab change) | fold button labels before tabs, a More menu for tabs that do not fit, scroll on resize, chip floor about 16ch |
| U-02 | medium | agent page | the task line runs into the sidebar and the window edge | `app.css:812`, `.svc-task` has no side padding | the header's padding |
| U-03 | medium | sidebar | the ⋯ button covers the place icons on hover, always on pinned rows | `Navigation.tsx:311`, `app.css:168-169,530,800` | the same right margin for `.nav-places` |
| U-04 | medium | sidebar, cards | a place icon's state by colour alone | `Navigation.tsx:235`, `Overview.tsx:355` against `app.css:153` | the state glyph on a place that is not ready |
| U-05 | low-med | sidebar | starting and stopped hard to tell apart, starting nearly invisible | `lib.tsx:54` | the info colour for starting and stopping |
| U-06 | medium | New session dialog | the page behind is not made inert; a native view can cover the dialog | `App.tsx:247,501` (`stopOpen` leaves out `newSession`) | add it |
| U-07 | low-med | all pages | the page title jumps when the open-agent strip shows | screenshots 01 against 03 and 04 | less top padding under the strip |
| U-08 | low | Overview card | "No activity yet" beside "1 Events" before the first read | `Overview.tsx:383` | a reading state |
| U-09 | low | Overview card | a cut event line has no tooltip | `Overview.tsx:382` | `title` |
| U-10 | low | Since you were last here | removed agents shown as raw keys | `visit.ts:42`, `Overview.tsx:263` | keep names with the keys |
| U-11 | low | several | mixed type sizes and fonts (the card's meta line; a 32 px Continue among compact controls) | `Overview.tsx:293` | `btn-sm`, one font per meta line |
| U-12 | low | task line | announced as a search box | `ServiceView.tsx:530` `role="search"` | drop the role |
| U-13 | low | setup card, no coding agent | the body describes a console that does not exist; ○ marks read as radio buttons | `i18n.ts:36,41` | a body for this state, check marks |
| U-14 | low | Sessions | Clear removes saved console output with no undo; SCN-078 and FD-124 disagree | `Navigation.tsx` `sessionsClearEnded`, `scenarios.md:1798,1865` | an undo notice, or correct the scenario |

Found sound: state badges (shape and word), focus rings, Stop, End and Uninstall confirmations, narrow layouts,
keyboard moves, the open-agent strip, Sessions' reading, empty and degraded states, the New session dialog's states,
reduced motion, terminology between sidebar and page titles, SCN-102, SCN-107.

## T: text, typos, terminology (16 findings; the copy checker on 200 strings: none blocking; copy tests 39/39)

| Id | Sev. | Where | Finding | Fix |
|---|---|---|---|---|
| T-01 | high | `Sessions.tsx:30` | the new `pool` refusal falls through to `sessions.reason.busy`, which names "six sessions" | map `pool` to `sessions.reason.busy-pool`; `busy` names no number |
| T-02 | medium | `sessions.reason.busy-cap` | hard-coded "six" | `{cap}` |
| T-03 | medium | `sessions.reason.busy-disk` (ru) | «Этот компьютер … на её диске»: wrong gender | «на его диске» |
| T-04 | medium | 8 keys | «Скилы» against the brand pack's D-T6 («навыки») | «Навыки», «навыки (skills)» at first use |
| T-05 | medium | `tab.health` | "Health" against D-T3 | "State" |
| T-06 | medium | `console.account.*` (ru) | «агент» alone for the coding agent; hints miss the full stop | «агент для кода», full stops |
| T-07 | medium | `instance.switch`, `nav.memberProblem` (en) | "connection" names another copy, clashing with the Connections tab | "Where {name} runs", "Another copy of this agent needs attention" |
| T-08 | medium | `src/mcp/server.ts` | descriptions name buttons that do not exist (Start setup, Send to the running session, clear-ended, Connections map) and a garbled clause | the real labels |
| T-09 | low-med | 2 keys (ru) | first person «Читаю», «Сохраняю» against COPY-19 | «Читаем», «Сохраняем» |
| T-10 | low-med | `console.ts:1459,1480` | "Switchboard is not installed" in English in the Russian interface | a key in both languages |
| T-11 | low | `audit.connection.crossOrg` (ru) | the placeholder breaks the dative | rephrase around «организации {x}» |
| T-12 | low | `settings.setup.body` (ru) | «рядом с обзором» quotes no real label | «рядом с разделом «Обзор»» |
| T-13 | low | `console.other`, `setup.agent.start` | English and Russian differ in meaning | "Other folder…", «с моим агентом для кода» |
| T-14 | low | `estate.skills.absent`, `setupCheck.area.services` | banned "family"; «Сервисы» off glossary | "package" / «пакет», «Сервисы Fabric» |
| T-15 | low | `console.continueUnsupported`, `console.terminalOnly`, MCP `console_choose` | Mac-only wording on every platform | `.mac` values, "a terminal window" |
| T-16 | low | `Settings.tsx:369` | a join with a literal colon in a component | the `reason.attention` template |

## P: performance and latency (11 findings)

Measured on the installed 0.8.100 and 0.8.101 (`ps`, `main.log`, `vmmap --summary`) and read from code.

| ID | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| P-01 | high | main process | about 5 % CPU with the window hidden against the 0.3 % target (AGENTS.md *Idle budget*) | profile the hidden cadence; wave 4 |
| P-02 | high | `main.ts` window visibility | a window covered by others keeps the on-screen cadence, so dashboard views are never released | treat covered as hidden for probes and view release |
| P-03 | medium | updater | about six updates a day, each leaving a few minutes with no monitoring | batch releases; keep the monitor across the install |
| P-04 | medium | `before-quit-for-update` | the handler runs twice and the update checks overlap | one guard per quit; one check in flight |
| P-05 | medium | status push | the whole snapshot is pushed after every probe, nothing memoized | push only what changed |
| P-06 | medium | Switchboard reads | a read that times out flips the Sessions view to "not available" | keep the last list, mark it stale |
| P-07 | low | bug journal | every repeat rewrites the whole file synchronously; a failed write leaves a temp file | temp removed (wave 1); async write in wave 4 |
| P-08 | low | `console.ts` limit pass | `machine()` is read for each waiting stop | one read a pass |
| P-09 | low | FD-64 visibility check | a show that the check notices starts a burst of probes | spread the first probes |
| P-10 | high | `views.ts` `fitBackground` | `Cannot read properties of undefined (reading 'isDestroyed')` in `main.log` 2026-11-14: a view closed while its page loaded | `viewGone` (wave 1, C-07) |
| P-11 | low | MCP servers | one server per agent session adds up (32 servers measured 2026-11-14) | measured, inside budget each; no change |

## C: correctness and logic (9 findings)

| ID | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| C-01 | high | `console.ts` start, mode continue | Continue in a console resumes the folder's last conversation even while a live agent holds it in another terminal | check the folder's live sessions first, refuse with `held` (wave 1) |
| C-02 | medium | Sessions | a Switchboard read that failed shows as "the group selects no account" | say the read failed; wave 4 |
| C-03 | medium | `continueStop`, `continueRow` | a refusal loses its cause (held, the machine's room) and reads as a failed claim | typed `held` and `admission` refusals (wave 1) |
| C-04 | high | `heldElsewhere` on Windows | 0.8.100 reads no process list on Windows, so every continue was refused as held | read the session files there (wave 1) |
| C-05 | medium | `i18n.ts` | `console.handover` was removed while the console still shows it: the key is printed | restored; `test/i18n-used.test.ts` checks every literal key (wave 1) |
| C-06 | medium | outage alerts | a failing send retried every minute holds the queue behind it | per-episode retry; wave 4 |
| C-07 | high | `views.ts`, `main.ts` | the `isDestroyed` crash (P-10); unhandled rejections logged without their stack | `viewGone`; the stack in `main.log` (wave 1) |
| C-08 | medium | bug journal | page errors take minified frame names, so a new build makes a new row; `admission_*` refusals are journaled as bugs | page errors by message; expected refusals left out (wave 1) |
| C-09 | low | bug journal | an issue link an MCP server records between the app's read and write can be lost | the window is one read; wave 4 merges by fingerprint on write |
