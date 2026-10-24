---
report:
  id: fabric-dashboards/2026-10-24-sessions-and-navigation
  title: "Dossier: coding sessions get their own mode; the sidebar is rebuilt around Agents and Sessions"
  kind: design
  project: fabric-dashboards
  domains: [ux, navigation, console, hand-overs]
  as_of: 2026-10-24
  status: active
  valid_until: 2026-11-24
  summary: >-
    The operator's review of 2026-10-24: hand-overs sit in the agents' sidebar without saying what they are, unfold
    from the top, and stay there dead after an idle close with nothing to do about them. This dossier moves every
    coding session (running, handed over by Switchboard, stopped on a limit, ended) into a Sessions mode beside the
    Agents mode, gives each state an action, and records that Fabric is their long-term home (decision V-01).
---

# Coding sessions get their own mode

## Why (the operator, 2026-10-24, verbatim in Russian, translated)

> It is unclear why hand-overs are in the Dashboards and not in Fabric. This place should hold agents, not handed-over
> sessions. Either a switch: Agents shows what it shows now; Sessions shows the active coding sessions and the
> handed-over ones. They unfold from the top, it is unclear what they are, why they are needed and how they work.
> They hang there killed, closed after idle, and nothing can be done with them. Fabric will be the main app; the
> navigation must be worked out hard and every nuance fixed.

## As-is, with evidence (main `2b91e3a`)

| Id | Defect | Evidence |
|---|---|---|
| SES-01 | Hand-overs are taken with no consent and no explanation; the only sign is a new sidebar row above the agents | `src/electron/console.ts:360-366`, `src/renderer/App.tsx:267` |
| SES-02 | The section repeats one folder name per hand-over (three `passioncode-platform`, three `fabric-switchboard` in the operator's screenshot), with no time, origin or state word; running and ended differ by a glyph only | `App.tsx:267-274` |
| SES-03 | An ended entry cannot be cleared: the only Close is in the page body under the 380 px drawer; rows have no menu; the list lives in memory until quit | `App.tsx:325`, `console.ts:400-405`, `core/types.ts:122` |
| SES-04 | An idle-closed hand-over is a dead end: the text names "New session", which is never drawn for hand-overs (Russian «Новая» names a button that does not exist) | `ConsolePanel.tsx:158,269`, `i18n.ts:254,950` |
| SES-05 | A failed limit resume keeps running but cannot be reached: Open leads to a blank "Overview" page with no drawer | `console.ts:487-490`, `App.tsx:114,345` |
| SES-06 | The console is a drawer that drops over an unrelated page; Collapse leaves the hand-over and goes to Overview; the menu's console toggle does nothing there | `App.tsx:201-241,239,55`, `electron/drawer.ts:1-6` |
| SES-07 | Sessions stopped on a limit live only at the bottom of Connections, apart from the hand-overs they turn into | `ConnectionsMap.tsx:71-112` |
| SES-08 | Nowhere lists the coding sessions running on this machine, though Switchboard answers `sessions --all` (state, folder, account, context, `continues`) | `src/core/switchboard.ts:125-151` reads it per console folder only |
| SES-09 | The texts point the wrong way ("Type to it on the right") and the expired, too-busy and Switchboard-too-old outcomes say nothing at all | `i18n.ts:259,263`, `console.ts:352-378` |

The survey's UX-02, UX-10, UX-16, UX-17, UX-18, UX-25, UX-26, VIS-05, VIS-06 and COPY-17 are the same defects seen
from other sides; this dossier answers them together, so they leave W1b and W3's old list and land here.

## Where sessions belong

- **Long term: Fabric.** The operator's decision V-01 (2026-10-14, `fabric-workspace/knowledge/vision.md:122`) makes
  Fabric the one application and Dashboards one of its modules; SB-108's own request (2026-10-12) was «открывать этих
  агентов в наших агентах, например в Фабрике … чтобы они все внутри одного окна открывались»; Fabric already has
  console tabs (SCN-172), «Агенты» and «Где идёт работа».
- **Blocker for moving them now:** Fabric's sessions end when Fabric quits, and the lifecycle broker stops Fabric
  after 15 idle minutes (CO-382); Dashboards stays resident. A hand-over opened in Fabric today would be killed by an
  idle stop. Fabric also has a 0.3.13 iteration in flight (`agent/0313-ux-iteration`).
- **So, in this release:** Dashboards keeps taking hand-overs, but moves every session out of the agents' world into
  a **Sessions mode**, built so Fabric can take it over: the data layer (`src/core/sessions.ts`, new) is the part
  Fabric would import, and a setting names who opens hand-overs. The move to Fabric is asked of the Fabric project on
  the board (question Q-1 below), not edited in its repository.

## To-be

### The sidebar

```
┌──────────────────────────┐
│ ▣ Fabric Dashboards      │
│ ┌──────────┬───────────┐ │   segmented switch, ⌘1 / ⌘2;
│ │ Агенты   │ Сессии  2 │ │   the badge counts sessions that need a person
│ └──────────┴───────────┘ │
│                          │
│  (the mode's own list)   │
│                          │
│ ⚙ Настройки              │
│ ◧ Свернуть панель        │
└──────────────────────────┘
```

- **Agents mode** is today's sidebar without the hand-over section: Overview, Activity, Connections, Spend, Pinned,
  On this Mac, Online, Services, Hidden. Connections loses "Sessions stopped on a limit".
- **Sessions mode** lists sessions, grouped, in this order; an empty group is not drawn:
  1. **Нужно ваше решение** (needs you): a failed limit resume still running, a hand-over that could not open here,
     a session whose agent asks a question.
  2. **Идут** (running).
  3. **Ждут сброса лимита** (waiting for a limit reset), with the time it is expected.
  4. **Завершены за 24 часа** (ended), folded by default, with «Очистить».
- **A row** reads `<project>` on the first line and `<coding agent> · <account> · <how it came here> · <time>` on the
  second; two rows of one folder are told apart by that second line. State is a word, never a glyph alone.
- **The window opens in the mode it was closed in**; a new hand-over never switches the mode by itself.

### The Sessions page (the mode's first item, «Все сессии»)

- A one-time explanation at the top, dismissible: «Здесь сессии агентов для кода на этом Mac. Когда сессия упирается в
  лимит, Switchboard передаёт работу другому аккаунту или агенту, и она продолжается здесь, в консоли.» with
  «Настроить передачи» (opens Settings → Sessions).
- The same groups as the sidebar, as cards with their actions.

### One session's page

- **Header:** project, state word, origin chip («Передана Switchboard после лимита claude4, 14:02», «Продолжена после
  сброса лимита», «Запущена Switchboard», «Открыта здесь»), account and context chips, and the actions of its state.
- **Body:** the console fills the page under the header, the full height of the window. It is no longer a drawer over
  another page: Collapse does not exist here, so nothing navigates away. (The drawer stays on agent pages, ADR-0017.)
- **Keyboard:** Esc, then Tab leaves the terminal (VIS-05); the terminal follows the theme live (VIS-06).

### Every state has an action

| State | Words | Actions |
|---|---|---|
| running, ours | «Идёт» | Завершить (asks first) · Показать в Finder |
| running, not ours (Switchboard launched it in Terminal) | «Идёт в Терминале» | Показать в Finder (its folder; V-6 of FIX-2) · Показать в Терминале (when Switchboard knows the window) · nothing destructive |
| needs you: resume failed, still running | «Не продолжилась, процесс ещё идёт» | Открыть консоль · Завершить |
| needs you: could not open here (expired, folder missing, Mac too busy, Switchboard too old) | the reason in one sentence, and «Switchboard открыл её в Терминале» when it did | Убрать |
| waiting for a reset | «Продолжится около 15:30» | Продолжить сейчас на другом аккаунте (Switchboard's `recovery` candidates) · Не продолжать |
| ended by itself | «Завершилась в 14:20» | Продолжить (`claude --resume` in the same folder when the transcript is known, else a new session there) · Убрать |
| closed after 30 idle minutes | «Закрыта после 30 минут простоя» | **Продолжить** (the same resume; fixes SES-04) · Убрать |
| ended by you | «Завершена вами» | Продолжить · Убрать |

Ended entries persist for 24 hours in the app's settings, so a restart does not lose them and an old one does not stay
forever.

### Notifications and the tray

- A hand-over taken here sends one system notification: «Switchboard передал сессию: <project> продолжается на
  <coding agent>»; clicking it opens that session. Paused notifications (SCN-023) silence it.
- The tray gets a «Сессии: идут N, нужно ваше решение M» line that opens the Sessions mode (decision 7: counts after the label; "need you" worded as the one name for that state, SCN-077 Copy; `tray.sessions.both` in `src/core/i18n.ts`).

### Settings → Sessions (new section)

- «Открывать сессии, переданные Switchboard, здесь» (Switchboard's `handovers set on|off`, read and written through
  its CLI; today it can only be changed in Switchboard).
- «Продолжать сессии после сброса лимита» (the existing switch, moved here from its own group «Сессии, остановленные лимитом», SCN-086).

## Data (`src/core/sessions.ts`, new, pure)

One list, merged from four sources, deduplicated by folder plus start time, newest first:

| Source | Gives | Already read |
|---|---|---|
| Switchboard `sessions --all` | every Claude Code or Codex session Switchboard launched: state, folder, account, pool, context, `continues` | per console folder only; now machine-wide, every 15 s while the Sessions mode is shown, 60 s otherwise |
| Switchboard `handovers` | pending hand-overs | yes |
| Switchboard `recovery` | stops and their verdicts | yes |
| this app's consoles | sessions it holds, with their exit reason | yes |

Coding sessions started without Switchboard in a plain terminal are not listed; the page says so in its footnote.

## Contracts

- **Switchboard:** no change. `sessions --all`, `handovers`, `handovers set`, `recovery` are read through its CLI as
  today (`docs/CONTRACTS.md` *Session list*, *Capacity notices and console hand-overs*). Its SB-108 row and CONTRACTS
  name "Fabric's console"; that stays true of Dashboards as a Fabric module.
- **Fabric:** none in this release. Q-1 asks Fabric to plan taking hand-overs once it stays resident.

## Tests that will prove it (each fails on main today)

- `test/sessions.test.ts`: the merge of the four sources; two hand-overs of one folder give two distinguishable rows;
  an idle-closed hand-over offers Продолжить; a failed resume that is still running is in «Нужно ваше решение» and
  opens its console; ended entries older than 24 h are dropped; restart keeps the rest.
- `test/navigation.test.ts`: the hand-over section is gone from the Agents mode; Connections has no stops list; the
  mode is remembered; ⌘1/⌘2 switch it.
- e2e: a synthetic hand-over appears in Sessions with a notification, its page shows the console full height, Esc
  then Tab leaves it, Убрать removes it.

## Scenarios

New SCN for the Sessions mode and the session page; SCN-069, SCN-075 and SCN-066 rewritten to land there; SCN-005/006
(navigation) gain the switch. Written before code (super-ux), with screens in `docs/ux/screens.md`.

## Deletes

The hand-over sidebar section and page (`App.tsx:267-274,319-327`), the stops list in Connections, the drawer on
hand-over and resume consoles, `handover.body`/`resumeBody`/`done` and the strings that point "on the right".

## Questions

- **Q-1 (Fabric project, on the board):** will Fabric take hand-overs and limit stops into its own sessions once it stays
  resident (CO-382), and from which release? Until it answers, Dashboards keeps them; the answer moves nothing here.
- **Q-2 (operator, assumed):** "the navigation menu" is read as Dashboards' sidebar (this release) and Fabric's rail
  (Fabric's own iteration, asked in Q-1). Proceeding on that.

## Nodes

| Node | What | Owns | Risk |
|---|---|---|---|
| S1 | Scenarios and screens for the Sessions mode, the session page, the switch (super-ux, copy in both languages) | `docs/ux/` | R1 |
| S2 | `src/core/sessions.ts` and its tests; the machine-wide sessions poll; 24 h persistence | `src/core/sessions.ts`, `src/core/switchboard.ts`, `src/electron/console.ts`, settings | R2 |
| S3 | Sidebar switch, Sessions page, session page with the full-height console, notifications, tray line, Settings → Sessions | `src/renderer/`, `src/electron/tray.ts`, `src/electron/drawer.ts`, `i18n.ts` | R2, product surface: four tiers, two rounds |

## Decisions on S1's design gaps (2026-10-24, by the orchestrator, reversible)

1. Stop verdicts other than "waiting" (terminal still open, payment limit, older than a day, folder or conversation
   not here) go to **Needs you** with the verdict sentence and Remove; stops another host took are not listed.

   **Decision 1, amended 2026-10-24 after 0.8.0** (FD-108, release 0.8.1; superseding the paragraph above). The post-release
   check on the operator's Mac at 22:27 UTC found the installed 0.8.0 showing "39" on the Sessions switch: Switchboard
   held 84 waiting limit stops, 60 of them older than 24 hours and several the same session again (one at attempt 44),
   and every verdict other than waiting landed in Needs you, the dead entries with nothing to do the operator had
   complained about. **Needs you holds only what a person can and must act on now**: a continue that failed while its
   process still runs; a hand-over that could not open here (24 h); a stop on a payment limit (verdict `billing`), for
   24 h. Everything else Switchboard holds as stopped:
   - older than 24 hours (verdict `old`, or any stop whose `stopped_at` is more than a day back, a waiting or billing one
     included): **not listed at all**, since this app never continues it, so a "Continues at" would be false;
   - its terminal is still open (verdict `open`): **not listed**: the session is alive where it is;
   - its folder is not here or its conversation is not found (`no-folder`, `no-transcript`), or this app's continue of
     it failed and its console no longer runs (`resume-failed`): listed under **Ended** as "Cannot be continued here:
     {why}" with Remove, never counted by the badge (state `ended-cannot-continue`);
   - waiting for a reset, or ready to continue here: the **Waiting** group, as before.
   **One row per Switchboard session id**: only its latest stop (highest `stopped_at`, then `attempt`) is listed; the
   latest decides even when it is a stop that is not listed (a session resumed since has no row). Where live processes
   cannot be read (Windows, or `lsof` failing) a ready stop's verdict is `open`, so from 0.8.1 it is not listed there
   rather than shown under Needs you; nothing could be done with it there either. On the fixture built from the live
   answer (`test/fixtures/recovery-0.8.0-shape.json`, ids and folders synthetic) the badge reads 33 under 0.8.0 and 3
   under 0.8.1 (`test/sessions-needs-you.test.ts`; pre-fix failures in [fix081-prefix-failures.txt](fix081-prefix-failures.txt)).
   `src/core/sessions.ts` (`mergeSessions`, section 4) applies it; `verdictOf` and the MCP `audit` verdicts are unchanged.
2. **Do not continue** moves the session to Ended as "Not continued: you declined"; this app never continues it, and
   Switchboard's record is untouched.
3. **Continue now on another account** passes the chosen account to Switchboard's stop claim: the app already calls
   `recovery claim` with an account (`src/core/recovery.ts:109`, `claimStop(run, sb, stop, account)`).
4. Esc always reaches the coding agent; only a Tab within 1 s after it is held back and moves focus.
5. "An agent asks a question" has no source yet: deferred, not drawn.
6. **Continue** without a known conversation reads "New session here".
7. The tray line is «Сессии: идут N, ждут вас M» (counts after the label, the app's Russian rule). Shipped as «Сессии: идут N, нужно ваше решение M», with the one name for the needs-you state (SCN-077 Copy, orchestrator 2026-10-24).
8. **A hand-over always gets its own console**, never an agent's free console in the same folder, so one session
   lives in one place and the agent's console stays the person's. This changes `console.ts:348-385`.
9. An automatic continue after a limit reset also sends one notification, like a taken hand-over.
10. "Show in Terminal" is not drawn until Switchboard's session list carries the window's identity (next pool,
    Switchboard).
