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

## P: performance and latency

Pending: the audit stopped on an API limit at 2026-11-15 about 02:00 and was resumed; its findings are added here.

## C: correctness and logic

Pending, as P.
