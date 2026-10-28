# Changelog

## Unreleased

### Added

- Agents placed on the other machine (FD-132, SCN-089): when Observatory's placement record
  (`project-observatory/placement.json`, `observatory-placement/1`) puts an agent on another machine, a silent copy
  here reads "Stopped" with the machine named, never "Not answering", with no notice, no outage alert and no Start;
  a copy answering here anyway reads as a second copy, with Stop and no Restart. Start and restart are refused
  before launchd runs, in the app and through MCP `control`. `@passioncode-ai/fabric-service-host` 0.10.0
  (`placement.ts`, state vectors). Copy check reports `b66cfed9` (en) and `4927b853` (ru), no findings.

## 0.8.13 - 2026-10-28

### Added

- Settings → Coding agents (FD-117): the default coding agent, the fallback order (level 1, level 2 and on) with the
  model each level works on, and the OpenRouter and Hermes models, all Switchboard's and changed here through its CLI.
  Groups and tasks with an order of their own are listed read-only. Copy check reports `72968823` (en) and `d69750bc`
  (ru), no findings.

## 0.8.12 - 2026-10-27

### Fixed

- A decision an agent waits for reaches the operator channel again (FD-131): since 0.8.8 each one went as a `question`
  without the reply binding the channel requires and was refused (`question_binding_required`, 567 times on this Mac
  since 2026-10-27 18:58 UTC); it now goes as a plain message with the link to decide on the agent's page (copy check report `2ad82409`, no findings).

## 0.8.11 - 2026-10-27

### Changed

- Russian lines about work in progress speak as «мы» («Проверяем…», «Читаем, какие модели…»), the session cap says
  «и это предел для этого компьютера», days read «{n} дн.», and an agent's events surface on Connections is «Лента
  событий», apart from the «События» page (FD-129: COPY-19, COPY-31, COPY-33; copy check report `9768afa2`, no findings).
- The console's cursor stops blinking when the system asks for reduced motion (FD-129: VIS-23).
- The menu-bar menu leaves out agents the person hid; one that needs attention is still listed and counted first
  (FD-129: UX-19). The console's terminal takes its font size from a style token (FD-129: VIS-19).
- The sidebar page is now «Agent map» («Карта агентов»), apart from each agent's own Connections tab, and its list
  of what to fix is «Problems» («Проблемы»): no person audits your agents (FD-129: UX-21, COPY-32).
- Spend: figures line up on the right and read at body size, dollars carry a thousands separator ("$1,234.56"), and
  every agent's row and every "Could not read" line has Open, which opens that agent (FD-129: VIS-18, UX-22).
- Settings opens with an index of its groups, puts Uninstall last, folds the notification rows of hidden agents
  under "Hidden: N", and marks a refused text field with a red border (FD-129: UX-20, VIS-21).
- The details card groups its actions (run, repair, files as quiet links) with one primary per state; a tab list cut
  by a narrow window fades where more tabs are; Overview's blocks share one radius and every agent name that opens
  it is underlined; small controls share one size and chips one shape (FD-129: VIS-16, VIS-17, VIS-20, VIS-24).
- "Since you were last here" names the updates waiting and always says when nothing changed (FD-129: UX-09).

### Added

- A right-click (or the context-menu key) on an agent opens its row menu, also in the folded rail, where it opens
  beside the rail and the dashboard steps aside while it is open (FD-129: UX-23).
- Fix or Update with coding agent while a session already runs keeps the task: the console offers "Send the task to
  this session", which writes the task file and types one line pointing at it, without pressing Enter (FD-129: UX-16).
- The app's own Activity rows (stopped answering, restarted, runs twice) open their agent, and an agent's own
  Activity tab opens its rows as the Activity page does (FD-129: UX-15).

Copy check reports for the new strings: `6baa9afc`, `db3cfdd7`, `4b318012`, `e10d81c5`, `858601c8`, `87668ab8`,
`cfd3edf4`, `dfd39ef0`, `63576e44`, `d6ad9d93`.

## 0.8.10 - 2026-10-27

### Added

- The app is driven end to end on Windows and Linux too (FD-128, SCN-052): `test/e2e/desktop-other.test.ts` checks the
  File menu, the services listed, a dashboard without launchd controls and the window closing into the tray; the
  nightly `validate.yml` runs it on Windows x64 and arm64 and Linux x64 and arm64 (job `e2e-other`, also on a dispatch
  with `e2e: true`). The sample service is now fabric-agent-adapter v0.54.0's, which runs on Windows, so the monitor
  tests no longer skip there.

### Fixed

- A Dock icon that would not leave after the window hid is asked to leave again on the 15-second visibility pass, at
  most three times until the next show or hide (FD-127). macOS dropped the hide four times on 2026-10-25 to 27, around
  an update restart and windows hidden without an event; the icon then stayed until the window was shown again.

## 0.8.9 - 2026-10-27

### Added

- **Arrange the sidebar your way** (FD-121). Drag its right edge to make it wider or narrower; double-click the edge to
  go back. Drag an agent up or down within its section to put it where you want it (or press Alt+Up and Alt+Down); the
  sort then reads "Your order". In the Hidden list, the eye beside an agent shows it again.
- **Agents can arrange the list for you** (FD-122). A new MCP tool, `arrange`, does what an agent's row menu does: pin
  or unpin, hide or show again, show as a service or as an agent. The app now picks up a change to its settings made
  while it runs, and its own next change keeps it instead of writing over it.
- **Turn an agent off** (FD-123). Turn off in an agent's row menu hides it and stops watching it: the app no longer
  checks it or alerts about it, and it waits greyed at the end of the Hidden list. Turn it on there (or show it again)
  and it is checked at once. Agents do the same with `arrange` `turn-off` and `turn-on`.
- **Install a coding agent from the setup card** (FD-113, UX-13). When no coding agent is installed, the first-run card
  shows the install command for Claude Code and for Codex with Copy, and offers the setup once the app finds one.

### Changed

- **Reads the contract of 2026-10-27** (FD-126). An agent's declared action may now hand you a comparison to make
  (`humanStep: comparison`); the app reads it instead of reporting the declaration as broken.

### Fixed

- **Updates no longer wait behind other windows** (FD-80). On a Mac, a ready update waited as long as the window was
  open, even when other windows covered it completely or it sat on another desktop (0.8.7 waited nine hours). Now a
  window covered, or on another desktop, for ten minutes counts as out of sight: the update installs, and the window
  comes back where it was, behind your work.
- **An agent's row menu stays inside the window.** With a long agent name, the menu ran off the left edge and cut
  its items short. It now fits the sidebar and wraps a long item onto a second line.
- **Calmer, more even pages** (FD-113). An available update of the skills or of the contract copy reads in blue, not red
  like a failure. Section headings have one size across pages, and the sort control moves under its section name instead
  of cutting its label. "Limit left" replaces "Budget left"; in Russian a few compact labels are shorter.

## 0.8.8 - 2026-10-27

### Added

- **A decision an agent waits for reaches you away from the Mac** (FD-125). When an agent asks for your approval or a
  decision, the message now also goes to your notification channel (Telegram, for example), once, with the agent's words
  and a link that opens its page in Fabric Dashboards. The same question is not sent again for a day; quiet hours and a
  pause hold it until morning instead of dropping it.

### Fixed

- **A screen reader names every box on the Connections map** (FD-113 VIS-07). The map was one image, which hid the
  agents inside it; it is now a group of named buttons, and a name cut short on screen is read in full.
- **A screen reader reads what an agent card shows** (FD-113 VIS-11): after the name and state, the figures flagged
  for attention and the latest event.
- **A name cut short shows in full when you point at it** (FD-113 VIS-15): an agent in the expanded list, an agent
  card, the names in Needs attention and the capabilities on Connections.
- **A console closed after 30 idle minutes says so calmly** (FD-113 VIS-14): the notice is no longer a red error, and
  a screen reader reads it as news rather than an alert.

### Changed

- **On Windows and Linux one restart installs the newest release** (FD-98). If a newer release comes out while an
  update waits for its restart, the app now prepares the newer one instead, so you restart once rather than twice. The
  update already waiting stays ready if anything goes wrong. macOS works as before.

### Internal

- **Update proof across three versions** (FD-114): `update-proof.yml` can publish the next release while the one
  before it waits ready, on Windows and Linux, to measure how many restarts a copy takes to reach the newest. Only a
  debug build for that proof carries the local release pointer it needs; a release never does.

## 0.8.7 - 2026-10-26

### Added

- **An agent can start a console session or a fix for you** (FD-120, ADR-0025). The MCP tools `console_new` and
  `console_fix` do what New session and Fix with coding agent do, in the running app, through a private channel only
  this app's own MCP server can use: a per-user socket (a named pipe on Windows) with a key made anew at every start,
  which no web page can reach. With the app closed they say so and start nothing. Like Start and Stop, they record
  your words as your decision when the agent passes them.

### Changed

- **Setup knows Switchboard 0.7.0's organization steps.** The setup brief a coding agent follows names the steps
  `switchboard onboard` adds per organization (`org_group`, `seat`, `hook`, `launch`, and an optional `organization`),
  and that `hook` stays optional: its `next.turn_off` is never a command to run.


## 0.8.6 - 2026-10-26

### Fixed

- **A session another agent runs is never taken for Claude Code** (Fabric Switchboard SB-201, ahead of its 0.7.0).
  Switchboard now names the agent each session runs (Goose, Codex, Kimi Code and others), also when it rides the Claude
  route through its proxy. Sessions shows that agent, and Continue takes up a Claude Code conversation only for a
  Claude Code session, never an unrelated one in the same folder.

## 0.8.5 - 2026-10-26

Carries 0.8.4, tagged and not published: its release run 40257149750 stopped at the Windows gate on one test that
built its expected macOS path with the Windows separator (the app's code was right). Nothing else changed.

## 0.8.4 - 2026-10-26 (tagged, not published)

### Fixed

- **Windows reads an agent's token without waiting for PowerShell** (FD-94). Each token check started Windows
  PowerShell, whose first start took from 7 seconds to a minute on an arm64 Windows machine. The app now ships a small
  signed reader beside its MCP launcher that answers in under 2 seconds cold (0.05 seconds on x64); Windows PowerShell
  stays the fallback.
- **A waiting session says why it waits** (FD-118, Fabric Switchboard 0.6.83). Sessions said "No other account has
  capacity now" for every waiting stop, also when its account had been removed or moved to another group. Switchboard
  now names the reason, and the row and the session's page show it: no account in its group can take it, its account
  was removed, its account waits for a payment, or Switchboard waits before it checks again.
- **Settings help leads with what happens** (FD-113, COPY-25). The help under automatic updates, uninstall, outage
  alerts, continuing after a limit, undeclared connections and the subscription estimate now opens with the result in
  one short sentence and gives the conditions after it.
- **Contract and skills settings speak plainly** (FD-113, COPY-21, COPY-22). "Estate updates", "Contract clone" and
  "Consumer pins" are now "Fabric contract and skills updates", "Local copy of the contract (folder)" and "Contract
  version in each project"; the section says who it is for, and Russian keeps Git and npm words only in a closing
  bracket.
- **Errors say what to press next** (FD-113, COPY-24, COPY-26). An agent the system has not loaded, two install files,
  a refused launchctl, a failed sign-in or page load, an unreadable activity feed and a failed setup check each end with
  the one step the screen offers (Start, Show file, Retry, Check setup). The update notification is short enough for
  macOS to show whole: "Version 0.9.0 is ready. Click to restart now, or it installs when you quit."
- **Money words read one way** (FD-113, COPY-14, COPY-16). Errors on Spend said "usage report" while Connections said
  "spend report", Russian mixed «траты» and «расходы», and limits called a job an "order" («заказ»), which reads as a
  purchase. The interface now says "spend report" / «отчёт о расходах», «расходы», and "job" / «задача»
  ("Jobs above it wait for your approval").
- **Spend used two windows** (FD-113, COPY-15). Overview, Spend and Connections counted 30 days, while an agent's page
  and the per-model rows summed the whole report, up to 31 days, so the rows could add up to more than the 30-day
  total. Every spend figure now covers the same last 30 UTC days.

### Added

- **The app declares its own buttons and takes the operator's relayed decision** (FD-110 part 3, contract DEC-0121,
  fabric-workspace MD-10). The MCP server's `initialize` lists Open dashboard, Self-check, Start, Stop, Restart and
  Update with their tools. Start, Stop, Restart and Update act on another agent: an agent that passes your words about
  that act in `_meta.decision` has them recorded as your decision (in `decisions.jsonl` beside the app's log, never in
  an events feed), and a wrongly written decision is refused before anything runs. A call without a decision still
  works as before, recorded as the agent's own act, until the app can ask you itself.
- **The auditor reads the buttons each agent declares** (FD-110, contract DEC-0121). An agent lists every action its
  pages let you take and the agent tool that takes the same action. Connections now names a button with no such tool
  ("The button "Send" has no agent twin"), a wrongly written declaration, and, as worth knowing, an agent that has a
  dashboard but declares no actions yet, so an agent cannot tell which buttons it may press for you. MCP `audit`
  answers the same findings.

## 0.8.3 - 2026-10-26

### Changed

- **Agent pages open in Fabric Dashboards, never in a browser** (FD-109, the operator's rule of 2026-10-24). The MCP
  `open` tool no longer opens a browser by default: where the app is not installed it answers `host_not_installed`
  with the link, and opens the plain address only when the agent asks for it with `fallback=if_absent`. A link or an
  `open` call for a page no installed agent serves is refused, and the reason now names the step that makes it
  openable here: register that agent with Fabric by putting its install file in the services folder.

### Fixed

- **An app update cut agent sessions off from this app's MCP tools** (FD-109). After an update the MCP server of a
  running Claude Code session answered `stale` and exited, and the session had no `open` or `link` until it was
  restarted; on 2026-10-24 an agent went to a browser for that reason. Now that server hands the session to the
  updated copy's server on the same connection, and the new version answers the next call. Where no installed copy
  can take it, the old behaviour stays: the call is answered `stale` and the server exits.

## 0.8.2 - 2026-10-25

### Fixed

- **Sessions that had gone on were listed as waiting for a limit reset** (FD-116). On 2026-10-25 the Sessions mode
  showed three sessions under "Waiting for a limit reset" with "No other account has capacity now", although each
  had hit a limit for a moment and gone on, on another account, within minutes, and was still working. Fabric
  Switchboard keeps such a stop open: it is closed only after a claim, and a session that goes on by itself is never
  claimed. Now a stop whose session recorded a model reply after it, or stopped again later, is not listed, is never
  continued again by this app, and is left out of MCP `audit`. Only the end of the session's transcript is read, and
  only each line's type, time and error flag. On the operator's Mac all seven stops of the last day were such stops.

## 0.8.1 - 2026-10-24

### Fixed

- **The Sessions badge counted old and repeated limit stops** (FD-108). On 2026-10-24 the installed 0.8.0 showed 39 on
  the Sessions switch: Fabric Switchboard held 84 sessions stopped on a usage limit, 60 of them more than a day old,
  and every one this app does not continue went under "Needs you". Now "Needs you" holds only what you can and must
  act on now: a continue that did not take up its conversation while its process still runs, a hand-over that could
  not open here, and a stop on a payment limit from the last day. A stop more than a day old, or whose terminal is
  still open, is not listed; one whose folder or conversation is not on this computer is under "Ended in the last 24
  hours" as "Cannot be continued here", with Remove; a session Switchboard holds several stops of is one row, its
  latest stop. Decision 1 of the
  [Sessions dossier](docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md) records the amended rule.

## 0.8.0 - 2026-10-24

0.8.0 separates the coding sessions from the agents, and makes the app say one thing about what needs you, in the
same words everywhere. The iteration's records are in
[docs/reports/2026-10-24-ui-ux-iteration/](docs/reports/2026-10-24-ui-ux-iteration/README.md).

### Added

- **A Sessions mode** (FD-103; SCN-077 to SCN-086). A switch at the top of the sidebar moves between Agents and
  Sessions: ⌘1 and ⌘2 (Ctrl+1 and Ctrl+2 on Windows and Linux), also in the View menu. The window reopens in the mode
  it was closed in, and "Sessions" carries a badge with the number of sessions that need you, in either mode. Sessions
  lists every coding session on this computer, the ones Fabric Switchboard runs and the ones in this app's consoles,
  grouped by what it needs: Needs you, Running, Waiting for a limit reset, and Ended in the last 24 hours (folded). Each
  row names the project over the coding agent, the account, how it came here (handed over, after a limit reset, started
  by Switchboard, opened here) and when.
- **The pages of the Sessions mode.** All sessions explains itself once, says when Switchboard is missing or did not
  answer, and shows each session as a card with the actions of its state: End (asks first), Show in Finder (Show in
  Explorer on Windows, Show folder on Linux), Open console, Continue now on another account, Do not continue, Continue
  or New session here, Remove. A session's own page shows its project, state, origin, account and context, with its
  console filling the rest of the window; Esc reaches the coding agent, and Esc then Tab within a second leaves the
  terminal. The terminal follows a change of the colour scheme at once. Ended sessions stay listed for 24 hours, also
  across a restart.
- **One notification per session that continues here**: a hand-over this app took, or a session continued after a
  limit reset. Paused notifications and quiet hours silence it, and a click opens the session.
- **A Sessions line in the menu bar menu**, "Sessions: running N, need you M" («Сессии: идут N, нужно ваше решение M»),
  shown while a session runs or needs you; it opens the Sessions mode.
- **Settings → Sessions**: "Open sessions handed over by Switchboard here", read and changed through Switchboard, and
  "Continue sessions after a limit reset", moved here from the group "Sessions stopped on a limit".
- **The interface's words have a home**: the brand pack in [docs/brand/](docs/brand/README.md) (voice, terminology,
  Russian choices), checked by `test/copy.test.ts`.

### Changed

- **States and actions have new names**, one name for each, in both languages:
  - Off is now **Stopped** (Russian unchanged, «Выключен»); Degraded is **Partly working** («Работает частично»);
    Invalid is **Broken install file** («Ошибка в файле установки», was «Ошибка в дескрипторе»), with "Its install
    file is broken: … Reinstall the agent."
  - Fix with agent is **Fix with coding agent** («Исправить с агентом для кода», was «Исправить через агента»);
    Update with agent is **Update with coding agent** («Обновить с агентом для кода», was «Обновить через агента»);
    Repair with my coding agent is **Fix with my coding agent**.
  - Doctor is **Run self-check** («Запустить проверку», was «Диагностика»); Reload is **Reload page**; Restart to
    Update is **Restart to update**; Continue last is **Continue last session**.
  - No services yet is **No agents yet** («Агентов пока нет»), and Show folder is **Show the services folder**
    («Показать папку сервисов»); "service" becomes "agent" wherever a person reads it, and "runtime" becomes "coding
    agent" («агент для кода»).
  - Same as macOS and As on this Mac are **Same as the system** («Как в системе»); "this Mac" stays on macOS, and
    Windows and Linux read "this computer".
  - No string the app composes carries an em dash any more: the tray reads "● Example: Ready".
- **One count of what needs you.** Overview's Needs attention, its strip, the sidebar's Overview badge, the menu bar
  menu's first line and the Dock badge count the same items, and the Dock badge is now that number instead of "!". The
  count now includes agents that partly work, updates, attention tiles, a running action and a failed action of the
  last 30 minutes, besides the agents that do not answer.
- **A spending limit that stopped an agent's work needs you**: a Needs attention row ("Its spending limit stopped work
  (daily)." with Open Spend), an item in the menu bar menu and the red menu bar icon.
- **Needs attention comes first** on Overview, right under the strip; each row's actions sit in one cell, a row of
  agents down for one reason offers "Restart N", and the strip's not-answering and attention cells move to it.
- **The agent's bar offers the state's own action first**: Restart or Start, then Fix; an available update shows in
  the bar as "Update to <version>" even when nothing is wrong, and the problem chip opens the details for this visit
  only.
- **"Since you were last here" is read again** when the window comes back after an hour hidden, and can be dismissed.
- **The folded sidebar rail shows the app's own update** as an entry of its own.
- **The light theme's accent is readable**: text, lines and focus rings use darker shades; the sidebar's row menu is
  reachable with the keyboard, and reduced motion stops the cursor blinking and the spinner.
- **Hand-overs and sessions continued after a limit reset each run in a console of their own**, never in an agent's
  free console in the same folder, so one session lives in one place and the agent's console stays yours (decision 8
  of [the iteration's design](docs/reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md)). A hand-over
  Switchboard still offers is not listed until this app takes it or it fails.

### Fixed

- **Sessions found in review** (round 1, [review-round1.md](docs/reports/2026-10-24-ui-ux-iteration/review-round1.md)):
  Remove and Clear no longer bring an ended session back as a Switchboard row; a limit stop you chose not to continue
  stays declined after Remove or Clear; stops Switchboard finished or cancelled no longer show as waiting with a time
  in the past (also in MCP `audit`); a waiting session shows Switchboard's own probe time, or none; Continue on a
  session Switchboard launched starts a new one when its conversation may still be running; quitting the app records
  running consoles as "Closed when the app quit"; the settings channel can no longer write a session's folder.
- **The menu bar icon** turns to its problem state on a failed action, as the sidebar badge does, and shows a new
  attention shape (a diamond) while a session needs you.
- **Session rows** keep their time beside the project; the second line reads "account · origin" and names the coding
  agent only when it is not Claude Code; a waiting session has a visible clock mark; the sidebar's ended heading reads
  "Ended: N" («Завершены: N»); a session page shows its exit strip only for an unclean exit.
- **Windows and Linux** name the window Switchboard really opens (a PowerShell window, a terminal window) instead of
  "Terminal"; a hand-over that could not open here names its one cause (under 5 GB free, six sessions already, or swap
  run out on Linux); continuing an idle-closed agent console from the console itself removes its ended row.
- **Sessions found in the adversarial round** (fix cycle 2,
  [fix2-prefix-failures.txt](docs/reports/2026-10-24-ui-ux-iteration/fix2-prefix-failures.txt)): a limit stop you
  declined and then continued is settled in Switchboard, so a restart never continues the same conversation again; two
  presses of Continue now, or one during the automatic continue, start one session and never record it as cancelled;
  quitting during a continue settles the stop in Switchboard before the app exits; a stop waits while a console of this
  app works in its folder; two Switchboard sessions launched in the same second are both listed; a time ahead of the
  clock neither hides a row for a year nor drops a decline; later rows never push a decline out of the list's memory.
- **Session words and layout** (the visual round): a stopped session reads "Stopped by a limit on {account}" instead of
  "Continued after a limit reset"; a continue that did not take up its conversation reads "Continue tried after a limit
  reset"; English times read 1:37 PM; one or two cards fill the row and a card never cuts its time; a session running in
  Terminal offers Show in Finder; an ended session's page after a restart says its output is not kept instead of showing
  an empty console; without Switchboard the page says once how to get it; the sidebar's focus ring is no longer cut.
- **Sessions polish** (FD-107, fix cycle 3,
  [fix3-prefix-failures.txt](docs/reports/2026-10-24-ui-ux-iteration/fix3-prefix-failures.txt)): the sidebar keeps the
  open session's row in view, also under a folded Ended group; an ended session shows when it ended, the time its
  group is ordered by ("Closed at 13:02 after 30 idle minutes", "Ended by you at 11:32"); the not-answering line says
  since when Switchboard has not answered instead of calling that time a check; the footnote no longer shows under the
  loading line; a waiting session's page says when Switchboard tries it again, what you can do now, its folder and when
  it stopped, and no other session page leaves its body blank; Settings → Sessions keeps the page title in view when the
  section fits; a sidebar row's second line uses shorter words and wraps rather than cut "после сброса лимита".
- **Sessions found in the confirming round** (fix cycle 4,
  [fix4-prefix-failures.txt](docs/reports/2026-10-24-ui-ux-iteration/fix4-prefix-failures.txt)): continuing a limit stop
  you declined no longer shows the new session on the account that ran out; a quit while Switchboard is still answering a
  claim cancels that stop too, and a finish Switchboard refused is tried again at the quit; Continue on a declined stop
  reads Switchboard again first, never cancels a stop another host claimed meanwhile, and records it as resumed only
  when the conversation itself was taken up (a new session in the folder records it as cancelled); a stop whose own
  console already runs is no longer left claimed; account names are read at most once every 30 s while stops wait, and
  a stop whose continue failed keeps the account it stopped on.

- **Spend adds agents up as the contract does** (FD-101, contract DEC-0110). The sum across agents is read over all their
  report rows at once: beside an agent whose calls carry no price, an agent with no metered calls makes the money unknown
  rather than "at least $0.00", and a subscription row with no calls but a cost is no longer dropped from the estimate.
  An agent's own figures follow the same rule. MCP `spend` answers each sum's `sides`. Shared package
  `@passioncode-ai/fabric-service-host` 0.9.0.
- **No more dead ends for handed-over sessions**: a hand-over or a continued session closed after 30 idle minutes can be
  continued from its row (its console was reopened only from the sidebar's Hand-overs section, whose text named a "New session" button that was never drawn there); a
  session continued after a limit reset that did not take up its conversation but still runs is listed under Needs you
  with Open console; ended sessions that hung in the list can be removed one by one or all at once with Clear.
- **`npm run test:e2e` is safe on a loaded Mac** (HV-02): it refuses at once when the 1-minute load average is above 150
  or free disk is under 5 GB (`FD_E2E_MAX_LOAD`, `FD_E2E_MIN_FREE_GB` move the floors) and runs its files one at a time
  unless `-- --parallel` or `FD_E2E_CONCURRENCY` asks for more.

### Removed

- The sidebar's Hand-overs section and its page, and the console dropping down over a hand-over: hand-overs are in the
  Sessions mode now. The strings that pointed "on the right" went with them.
- The list of sessions stopped on a limit under Connections: those sessions are under Waiting for a limit reset or
  Needs you in the Sessions mode.

## 0.7.28 - 2026-10-24

### Fixed

- **The Load tab no longer compares counts with limits it cannot judge** (FD-100, a review of 0.7.26). The contract sets
  an agent's queue limits per agent and context, and a service's report adds up every agent it hosts, so "5 of 4" could
  be normal. The tab now states the limits ("Each agent it hosts runs at most 4 at once in each context …") and shows the
  counts without "of N". With two contexts or more the wait and run times are only in each context's row.
- **The Load tab never leaves an empty page.** When the agent stops answering, or drops its load declaration, while the
  tab is open, the page moves to Dashboard or Health.
- **"Done in 24 h" counts a daily window**, and a report written with a space instead of `T` in a time, an offset without
  its colon or a very large count is read, as the contract reads it.
- **The Connections page reports an agent whose load declaration is invalid.**
- **Spend:** a subscription estimate reads "at least" while an agent's report could not be read; a $0 estimate with
  unpriced subscription calls reads "+ at least ~$0.00 on subscriptions" instead of nothing; the agent's Health tab
  shows a small subscription amount as "<$0.01", as Spend does.
- SECURITY.md names the load report among the requests sent with a service's token.
- **The console grows by every key press** (FD-102). Pressing the arrow keys on the console's bottom edge several times
  quickly grew it by one step only, on a busy Mac; each press now counts from the height already asked for.

## 0.7.27 - 2026-10-23

### Fixed

- **A subscription whose calls carry no price no longer reads as ~$0** (FD-97, contract DEC-0110). In Spend the value
  beside the money now reads "+ subscription calls not priced" when none of those calls is priced, and "+ at least
  ~$x on subscriptions" when only some are; such a model reads "subscription, not priced" in Spend and on an agent's
  Health tab. The money is unchanged.
  MCP `spend` answers `estimateUsd: null` and `estimatePartial` the same way. Shared package
  `@passioncode-ai/fabric-service-host` 0.8.0.

## 0.7.26 - 2026-10-23

### Added

- **How busy an agent is** (FD-93). An agent that reports its load (contract DEC-0104, `extensions/load/0.1`) gets a
  Load tab on its page: how many jobs run now and how many wait, against its limits, what was done and what failed in
  the last 24 hours, the latest wait in the queue and run time, a bar per window, and a row per context when it works
  in more than one. The limits count in each context. An agent that declares its load wrongly is shown with each
  reason and is not read; a report that cannot be read, or fails its checks, says why. Agents read the same through
  the new MCP tool `load`. Shared package `@passioncode-ai/fabric-service-host` 0.7.0 adds `./load`.

## 0.7.25 - 2026-10-23

### Changed

- **The console drops down over the dashboard** (FD-92). Pressing Console pulls it down from under the bar like a
  tab, over the top of the dashboard; the dashboard no longer narrows or moves. Drag the console's bottom edge to
  make it taller or shorter; the height is remembered. Pressing Console again (or the arrow in its corner) folds it
  back up, and whatever runs in it keeps running. The red cross in its corner closes it: a running session asks
  first, then ends. The Setup console and Switchboard hand-overs open the same way.

## 0.7.24 - 2026-10-22

### Changed

- **Needs attention folds agents that share one problem** (FD-86). When several agents are in the same state
  for the same reason, for example because one hub behind them is down, they read as one line naming them
  all ("3 agents: A, B, C") with the reason once, and each name still opens its agent.
- **Nothing is left as a bare dash.** Where a value is not reported, not stated or not recorded, the window
  says so in words: "not reported" on the Overview strip, "No limit stated" in Spend, "not stated" and
  "not recorded" on an agent's page and in its console.

## 0.7.23 - 2026-10-22

### Fixed

- **Spend shows money, not what a subscription would have cost** (FD-88). Calls an agent made on your own
  Claude or Codex subscription were priced at list price and added to what it spent: one agent read $147
  for the month while it had spent $6.80. They now stay out of every sum, and their list-price value shows
  beside it as "+ ~$140.47 on subscriptions", with a note saying what it means. The MCP `spend` tool returns
  the two apart (`costUsd` and `estimateUsd`).

## 0.7.22 - 2026-10-22

### Fixed

- **An agent's call is never left unanswered while the app updates** (FD-85). When an update replaced the app just as
  one call ended, the agent's connection began to close and the next call got no answer at all; it now gets the usual
  answer that the app was updated and the session should be restarted. Seen once in the nightly check on Linux arm64.
- When reading the sessions Switchboard holds as stopped on a limit works again after a failure, the log now says so,
  as it already did for hand-overs.

## 0.7.21 - 2026-10-22

### Fixed

- **A session continued after a limit now really continues** (FD-84). 0.7.20 continued it through a Switchboard
  managed launch, which runs Claude Code in a home of its own where the conversation is not, and allows one such
  session per account group: on this Mac one of three opened without its conversation and two closed at once, yet all
  three were recorded as continued. Now the session continues with the agent's own CLI in its folder, in the home that
  holds the conversation (a folder bound to a Switchboard group still goes through Switchboard), only a session whose
  conversation is found there is taken, and it counts as continued only once it is running and has written to its
  own conversation (within 30 seconds). Reading Switchboard's stopped sessions waits 30 seconds instead of 10: it
  sometimes takes 12 to 15.

## 0.7.20 - 2026-10-22

### Added

- **Sessions stopped on a usage limit continue by themselves** (FD-83). Once Switchboard has capacity again, a Claude
  Code or Codex session that stopped on a limit continues in a console here with the same transcript: claimed once,
  at most two at a time, within a day of the stop, and never while a terminal still holds it. Connections lists every
  stopped session with why it waits; Settings can turn it off; the MCP `audit` tool answers the same list.

### Fixed

- A stray test script from another project left in the repository root is gone.

## 0.7.19 - 2026-10-21

### Added

- **Connections page with an auditor** (FD-81). One page lists everything that does not work, works only in part,
  waits for you or is out of date, across every agent, worst first, with the reason in a sentence. Each agent's row has
  *Fix with agent*: pick the coding agent (Claude Code by default) and it starts in that agent's console with the
  findings as its task. A map shows which agent calls which, and where a chain breaks. The sidebar shows how many things
  do not work.
- **Connections follow the contract's decision** (DEC-0096). A declaration that carries anything like a key or a
  token is refused and shown as invalid, exactly as the contract reads it.
- **Agents can run the auditor and Check setup** (FD-81): the MCP tools `audit` and `setup_check`. README lists every
  function of the app and how an agent reaches it.

### Changed

- **Cleaner screens** (FD-81). On and off settings are switches; their lists line up; when everything is set up the
  setup card is one quiet line; Spend's totals look like the Overview strip.

### Fixed

- **A ready update installs while the app is hidden** (FD-80). A window of a hidden app counted as shown, so an update
  could wait for hours; the log now also says when an update waits for the window.
- **The update setting said "every 6 hours"**; the app checks every 5 minutes.

## 0.7.18 - 2026-10-21

### Added

- **Agents can read connections too** (FD-78). The MCP server has a `connections` tool that returns what an agent's
  Connections tab shows, and `list_services` says how the app lists each agent (on this Mac, online or service) and
  whether you hid it.

### Fixed

- **Dashboard sign-ins stored before 0.7.15 are encrypted too** (FD-04). Cookie encryption applied only to cookies
  written after it was turned on; older ones stayed readable on disk. The first start of this version writes every
  stored sign-in back once, so it is stored encrypted, and nobody is signed out.
- **An update that cannot be unpacked says why** (FD-79). When the disk is too full, the message says how much space is
  free and how much is needed, instead of only "could not be unpacked".
- **The row menu is never cut off** at the bottom of a long list; it opens above its row there.
- **Hidden agents can be opened in the narrow sidebar** (FD-78): the "Hidden" fold is an entry of its own there.
- **An agent that names another one twice is listed once** under "Used by", with both of its calls.

## 0.7.17 - 2026-10-20

### Added

- **Agents on this Mac, online agents and services, apart** (FD-78). The sidebar and Overview group them under
  On this Mac, Online and Services. An agent with no dashboard of its own is a service; a small menu on each row
  pins it, moves it between agent and service, or hides it.
- **Hidden agents** (FD-78). An agent you hide leaves the list and waits in a folded "Hidden" section at the bottom.
  It is still watched and still alerts; the fold shows "!" when one of them needs attention.
- **Connections tab** (FD-78). Every agent, services included, shows who uses it, what it offers, and what it uses:
  other agents, models, its runner, connectors, data stores, channels and the parts it reports, each with its state.
  A connected agent shows its own connections below it, up to three levels, and the worst state anywhere in the chain
  is named at the top. An agent can declare its connections with the proposed contract extension
  `extensions/connections/0.1`; until it does, the tab shows what the app already sees.

## 0.7.16 - 2026-10-20

### Changed

- **Token counts that an agent could not count in full read as a lower bound** (CT-62, contract DEC-0091). When an
  agent's spend report says some calls' tokens were not measured in full, Spend shows that model's tokens with «≥»
  and a note explains it, the way a cost with unpriced calls already reads. A report that claims more such calls
  than calls is refused as malformed.

### Fixed

- **A short outage no longer sends "down" and "back" to your Telegram channel** (FD-76). An agent that stopped
  answering for a few seconds or minutes could still get both messages, seconds apart, fifteen minutes later. Now the
  "down" message goes only if the agent is still not answering after fifteen minutes. In the first seven hours of
  0.7.15, two of four outages were such false pairs.

## 0.7.15 - 2026-10-19

### Changed

- **Fewer, more useful messages in your Telegram channel** (FD-76). An agent's outage reaches the channel only after it
  has not answered for 15 minutes, and "back" only after it has worked again for 15 minutes; an agent that falls again
  meanwhile is the same outage, told once. A part of an agent that fails while the agent still answers, and the
  agents' own event notices, now stay on this Mac. The installed app had sent about 100 messages a day.

### Security

- **Dashboard sign-ins are encrypted on disk** (FD-04). The cookies that keep each agent's dashboard signed in
  are now stored encrypted on macOS and Windows. On a Mac the key is a «Fabric Dashboards Safe Storage» item in
  your login keychain, made at first use; later versions read it without asking. Dashboards
  keep signing in by themselves as before. Linux keeps the earlier storage, because its keyring may ask you to
  unlock it.

## 0.7.14 - 2026-10-19

### Fixed

- **Restart to update works when the downloaded update was removed** (FD-75). If the files of a downloaded update
  disappear from disk, the app notices, downloads the update again and installs it once it is ready, instead of
  restarting into the old version. A leftover installer that has nothing to install is cleaned up at start.

## 0.7.13 - 2026-10-19

### Added

- **⌘R reloads the dashboard on screen** (FD-74), signed in again; **⇧⌘R** first drops its stored files. On Windows
  and Linux the keys are F5 and Shift+F5, so Ctrl+R stays the console shell's own search.

### Changed

- **Dashboards open faster** (FD-74). A page you come back to opens straight away, without a new sign-in, while the
  same agent process let you in less than 30 minutes ago. A hidden window keeps the two pages you used last for an
  hour instead of closing every page after 5 minutes.
- **Agents show their new version by themselves** (FD-74). When an agent restarts, its page on screen reloads where
  it was; a page off screen reloads the next time you open it. The Reload bar is gone.
- **The console opens at once** (FD-74). The runtimes are found right after the app starts, and a slow Switchboard
  no longer holds the panel.
- **Tidier buttons** (FD-74). The console's buttons sit in one compact row with Open in Terminal as an icon, and its
  notes are no longer cut at the left edge. The dashboard toolbar uses icons and one Copy button with a menu. The setup
  card's buttons share one row.

- **No em dash in the interface** (FD-73). Fourteen strings in English and Russian now use a full stop, comma, colon
  or parentheses instead; a test keeps new strings free of it.

## 0.7.12 - 2026-10-18

### Changed

- **Opens at login by default** (FD-72, the organization's lifecycle rule). The first launch of an installed copy
  registers the login item once; turn it off in Settings and it stays off. The first-run question is gone. If
  macOS holds the login item for approval, every launch says so in a notification that opens the right pane.
- **Checks for an update every 5 minutes** (FD-72), against the release's static feed. A check that finds nothing
  new is logged once, not every time.

### Added

- **«Restart to finish updating»** (FD-72): when an update is downloaded and verified, a notification asks once per
  version; clicking it restarts the app, asking first if a console session or a command is running.

## 0.7.11 - 2026-10-17

### Fixed

- **A failed read names its cause** (FD-70). A command stopped at its deadline, ended by a signal or exiting with
  nothing on stderr is now logged as such ("no answer within 10 s (stopped)"), not as a bare "Command failed".

## 0.7.10 - 2026-10-14

### Added

- **Check setup** (FD-65, SCN-070). Settings → Setup and the setup card run the PassionCode launcher's read-only
  check at a pinned version and list what is not set up on this computer, grouped by area, each with its fix.
  **Repair with my coding agent** opens the Setup console, and its brief starts from those lines. The check runs only
  when you press it.

### Fixed

- **A failed read says why** (FD-69). A command killed at its deadline now logs its reason instead of a bare
  "exit 1", and the console logs once when Switchboard's hand-overs can be read again.

- **Claude Code sees `service_context`** (FD-66). Its input schema had `anyOf` at the top level, which the Anthropic
  API refuses, so Claude Code dropped the tool and a console's agent could not make its first call. One of `key` or
  `service` is still required; the server checks it.

## 0.7.9 - 2026-10-13

### Added

- **Switchboard's hand-overs open in the console, not in Terminal** (FD-62, Switchboard SB-108). With "Open
  hand-overs in Fabric" on in Switchboard 0.6.26 or later, each continuing session Switchboard prepares is taken
  once with `switchboard handovers run <id>`. It runs in the free console of the agent whose folder it is, or in a
  console of its own listed under Hand-overs. Hand-overs are read every 15 s with the window shown and every 60 s
  hidden, only where Switchboard is installed. One the Mac cannot carry (LC-17) goes to Terminal on Switchboard's
  side after two minutes, as before.

## 0.7.8 - 2026-10-13

### Fixed

- **A window hidden with ⌘H counts as hidden** (FD-64). macOS sends the window no hide or show event for ⌘H.
  The app therefore stayed at the shown cadence, kept the embedded dashboards and never started the
  ten hidden minutes before an automatic update: 0.7.7, downloaded and verified at 04:29, waited on this Mac
  with nothing running. What is on screen is now checked when the app becomes or stops being active, and
  every 15 s. A held automatic install also says in the log why it waits.

### Contributors

- **The pre-commit hook refuses private data in this public tree** (FD-63): org-index `check_private.py` runs
  after the lease check when it is found; see CONTRIBUTING.md *Private data*.

## 0.7.7 - 2026-10-13

### Added

- **The agent console starts only what the Mac can carry** (FD-49, lifecycle LC-17): at least 5 GB free on the
  folder's disk, swap not exhausted, at most six console sessions at once; otherwise the start is deferred and the
  console says why and what frees it.
- **Switchboard sessions beside the agent** (FD-43): the console lists what Switchboard launched in its folder —
  state, account, mode, since when — read every 15 s only while the console is on screen.
- **A provider limit does not stop the agent** (FD-51, LC-20): with a Switchboard account for the provider, every
  Claude Code and Codex start runs through Switchboard's managed mode, and a session Switchboard moved to the
  pool's next account says so.
- **An idle console session closes and comes back** (FD-50, LC-18): after 30 minutes with no input or output it is
  saved (when, and the Switchboard account) and closed; opening the console continues it.
- **Dashboards take the scheme and the theme** (FD-42, FD-56): Settings offers Same as macOS, Dark and Light, and
  the dashboard theme (Graphite, Fabric, Paper, Forest, Ocean, Ember, High contrast). Each dashboard gets
  `fabric_appearance` in its own partition before every load and on a change, without a reload; a theme the page
  says it does not ship is not sent; an invalid dashboard profile counts as undeclared and is logged once per load.
- **Runner and model on an agent's Health** (FD-46, DEC-0046): the profile that applies, who set it, spend per
  model, and Change in Fabric.
- **Every supervisor the contract names** (FD-55, FD-57): descriptors under systemd, the Task Scheduler and the
  Observatory node — and with `runner`, `channels`, `peer` and the object form of `installedBy` — are read instead
  of shown Invalid (proven on the contract's 78 descriptor fixtures at fe55fc6). On Linux a copy waiting on its
  lock reads Duplicate from systemd's MainPID; the Task Scheduler gives no pid, so a waiting copy is never an
  outage. An app's own descriptor (`manager: person`, DEC-0069) is skipped, never probed.
- **A pre-commit check for leases** (FD-26): `npm ci` installs a hook that refuses a commit staging a guarded
  register without this run's agent-sync lease.

### Security

- **Windows: a token file that grants Everyone GENERIC_READ is refused** (CT-21, contract DEC-0057). The ACL reader
  took .NET's signed `FileSystemRights`, so an ACE carrying GENERIC_READ (0x80000000) came out negative and was
  skipped as granting nothing: such a token file passed. The mask is now read as an unsigned 32-bit number
  (`-band 4294967295` in the PowerShell read), and a mask that is not one is refused rather than skipped. An ACE of
  any type other than allow or deny is refused, SIDs compare case-insensitively, and an unreadable owner, SID or
  type refuses the file. The contract's `fixtures/vectors/windows-token.json` runs in the tests, vendored at 7688304.

### Fixed

- **Restart to update reopens on the screen the person left** (FD-21 U-18), not on Overview.
- **A half-written new descriptor no longer flashes Invalid** or logs "installed" (U-16); a misnamed one keeps its
  own key instead of colliding with the real one.
- **An online service that refuses TLS or redirects is down at once** (R-19), not after three missed probes.
- **Uninstall removes an update Squirrel has staged** (R-20), so ShipIt cannot put the app back as it quits.
- **One start/stop/restart sequence for the app and MCP** (FD-20): the MCP tool now also names a stray copy that
  keeps the port.
- **An event's `data` is not kept in the history** (DEC-0070); every member the protocol names still is.
- **Skills updates: "another update is running" is no longer an error.** From sshlg-skills 1.56.0 one update
  runs at a time and a second one refuses with exit 75. The app now logs that as `estate_update busy`, keeps
  the version it showed and tries again within the hour, instead of reporting a failed update.
- **The Russian interface reads as Russian.** After the operator's review, 164 of the 471 Russian strings and 16
  translated machine reasons were rewritten. Each thing now has one name («агент для кода», «скилы», «События»).
  Sentences agree with any service name, and calques and rhetorical dashes are gone. One string had lost half of its
  meaning and says it again: a port that answers without fabric-service/0.1 gets the token again only when it asks
  for one. The "since you were last here" date now follows the interface language, not the system's.

## 0.7.6 - 2026-10-12

### Fixed

- **Windows: an update installs, and Uninstall runs its uninstaller** (found by the first end-to-end update test).
  The helpers that must work after the app quits were stopped together with it: the update waiter, the
  uninstaller's waiter and the data clean-up. 0.7.4 and 0.7.5 downloaded and verified an update on Windows but
  never installed it. They now run on their own after the app has quit.
  **On Windows, if you run 0.7.4 or 0.7.5, install 0.7.6 once by hand** from the releases page: those versions
  cannot finish an update themselves (their Restart to Update closes the app without installing). From 0.7.6 on,
  updates install by themselves.
- **Linux AppImage: an update starts the new version.** The AppImage replaced its own file but did not start
  again; now the new version starts once the old one has quit. A 0.7.4 or 0.7.5 AppImage has already replaced
  itself with the newer file: start it once by hand and it runs the new version.
- **An automatic install stays in the menu bar or tray** even when the installer takes several minutes (Windows on
  Arm), and a failed install never leaves a later launch hidden.
- Settings → Notifications says plainly that outages are shown on this computer only when no agent offers a
  channel, instead of a warning.

### Added

- **An agent that waits for you to finish its setup is not an outage** (FD-48, Fabric Agent Contract DEC-0044). A
  part of an agent marked as waiting for setup shows as "waits for you to set it up" and never sends an outage
  message.

## 0.7.5 - 2026-10-11

### Added

- **Outages reach you away from the Mac** (FD-48). When an agent has been down for five minutes, or a part of it
  has failed that was fine when it started, one message goes to the agent you use as your channel (for example
  your Telegram channel), and one more when it is back. Settings → Notifications → *Also send outages to* chooses
  it: automatic, a specific agent, or off. Failure and warning banners go there too. Your pause, quiet hours and
  per-agent switches apply.

### Fixed

- **Reload signs a dashboard in again** when its session has ended, once, and returns to the same page (PR #101).

## 0.7.4 - 2026-10-11

### Added

- **Windows updates itself** (FD-37 M4c). A copy set up by the installer verifies the next installer the same way,
  then runs it silently when the app quits: it installs in place and starts the app again.
- **The Linux AppImage updates itself** (FD-37 M4b). It goes through the same checks as on a Mac: the release's
  signed SHA256SUMS, then the file's own hash. Then the new AppImage replaces the old one and starts at the next
  restart. A copy installed from a `.deb` says that a newer `.deb` updates it. Until now both wrongly said that updates come only with the installed app.
- **Every release's update feed names each platform it ships** (FD-37 M4a). A release that lacks one is not
  published.

## 0.7.3 - 2026-10-11

Carries everything listed under 0.7.2 below. 0.7.2 was tagged, then stopped by its own test gate before anything
was built (run 38155693835: one test relied on a folder's POSIX mode, which Windows ignores), so it was never
published.

## 0.7.2 - 2026-10-11 (superseded by 0.7.3 — not published)

### Added

- **One pack format with Fabric** (FD-47, Fabric Agent Contract DEC-0042, `session-handoff/1`). A console
  now writes its context pack the way Fabric writes its own, with a manifest (`handoff.json`). An agent opened
  here or from Fabric is handed the same folder. The coding agent is told to call `service_context` first. The
  console's rules now come back in that answer instead of being repeated in the system prompt, and a long brief
  travels as a file instead of being cut.
- **Fabric's button** (FD-45, [ADR-0021](docs/adr/0021-fabrics-button-in-the-host.md), Fabric Agent Contract
  DEC-0040). Every agent's page has a **Fabric** button in its header. One press opens Fabric's conversation
  about that agent; Fabric finds the agent's project itself. Without Fabric, the button says *Fabric is not
  installed — get it at passioncode.ai/fabric*. An agent's dashboard that has its own Fabric button hides it
  inside the app, so there is only ever one.

## 0.7.1 - 2026-10-11

The first published release since 0.6.7. It carries everything listed under 0.7.0 below — 0.7.0 was
tagged, then stopped by its own test gate before anything was built (run 38105334997: one test fixture
used a path that is not absolute on Windows), so it was never published.

## 0.7.0 - 2026-10-11 (superseded by 0.7.1 — not published)

### Changed

- **The console never squeezes a dashboard below its floor** (FD-41, Fabric Agent Contract DEC-0036 ED-7,
  [PR #27](https://github.com/passioncode-ai/fabric-agent-contract/pull/27)). Dragging the console wider
  stops where the dashboard keeps 480 px, or the larger width the service declares its page needs
  (`minWidth`, 360 to 1280 px, in its well-known document). A narrower window narrows the console first
  and keeps the width you dragged to; widening the window gives it back. A window too small for both
  keeps the console at 320 px and lets the page lay itself out; the page is never zoomed. This replaces
  the old limit of half the window. The MCP tools `list_services` and `service_status` report the declared
  floor as `dashboard_min_width`.
- **Groundwork for Windows and Linux** (FD-37, [ADR-0019](docs/adr/0019-windows-and-linux.md)). Nothing
  changes on macOS. What differs by system is decided in one place: uninstall removes only this
  install (the old rule would have trashed `%LOCALAPPDATA%` on Windows or `/` on Linux), settings keep
  folder paths in each system's own form, the window uses the system frame and a File menu where there
  is no app menu, the tray shows a colour mark on Windows and Linux, a login launch starts hidden, and a
  service supervised by launchd is shown read-only on a system without launchd, saying why. The shared
  service-host package reads Windows services from `%LOCALAPPDATA%\passioncode-fabric\services`,
  accepts Windows paths in descriptors written there, and checks a Windows token file by where it lives.
- **Windows and Linux builds** (FD-37, platforms.md PL-02, PL-08). Each release now carries a Windows
  installer for x64 and arm64 (per user, no administrator rights) and
  a Linux AppImage and `.deb` for x64 and arm64, each built on its own system and checked by the finished
  app before it ships; every `.deb` is installed on a clean Ubuntu 24.04 and asked to answer as an MCP
  server. The test suite runs on all five systems before a release.
- **On Windows and Linux** (FD-37 M2/M3): commands an agent or the Health tab runs end with their whole
  process tree; the console finds runtimes the way the system does (PATHEXT on Windows); a
  `fabric-dashboards://` link that starts the app opens its page; *Open at login* works on Linux (an
  XDG autostart entry, written only when you choose it); a Windows token file owned by Administrators
  (any file an elevated administrator writes) is accepted, as the contract now says (DEC-0033), and its
  permissions are read without the window ever waiting on PowerShell.

- **Linux installs to `/opt/fabric-dashboards`** (was `/opt/Fabric Dashboards`): Chromium cannot start
  an app from a path with a space. Before shipping, each `.deb` is installed on a clean Ubuntu, and the
  app itself is started there by an ordinary user.
- **Windows installers are signed** with the organization's Authenticode certificate (PL-03): the app
  and its setup are each `Valid` and timestamped before they ship (first proven on the `v0.6.7-rc.2`
  rehearsal).

- **Agents first** (FD-39, ADR-0020). The coding agent does the work; the app shows the result.
  - The console starts your coding agent already knowing the agent it was opened for: its state and
    why, errors, recent events, version, repository and descriptor (never its token), and this app's
    tools. Claude Code and Codex get it before their first turn.
  - *Fix with agent* sits beside a problem, and *Update with agent* appears when an agent's own update
    command can't apply an update. Either one opens the console with the job already described.
  - Pin agents to the top of the list, and sort the rest by name, by what needs attention, or by
    recent activity.
  - On a first launch, your coding agent sets everything up in a console beside Overview: this app's
    tools, the Fabric skills, the products you agree to, your first agent. You answer only sign-ins,
    consents and secrets.
  - Later launches open on what changed since your last visit, with *Continue* for the agents you
    worked with.

### Fixed

- The test suite removes its temporary folders when it ends; 4,810 had piled up (592 MB) on a
  developer's machine.

## 0.6.7 - 2026-10-09

### Fixed

- **The Dock icon leaves with the window under load too** (FD-35, second cause). Electron ignores a
  Dock hide within a second of a show, and macOS updates the Dock state the app reads only a moment
  later, so a hide asked right after a show could be dropped and still read as done. The hide now
  waits out that second and reads the state only after it has settled.
- **No Intel-only component ships in the universal app** (operator decision 2026-10-09: every
  PassionCode product runs natively on Apple silicon and Intel Macs). 0.6.6 carried node-pty's
  `prebuilds/darwin-x64/{pty.node,spawn-helper}` as thin x86_64 files, which macOS reports as
  "Support Ending for Intel-Based Apps". Each is now joined with `lipo` into one universal file
  placed in both prebuild folders, and the build refuses a bundle that holds any Mach-O without
  both slices (`thinMachO`, receipt `checks.universal`). Measured on an unsigned build: the agent
  console's PTY spawns on the x86_64 slice (Rosetta) and on arm64.

## 0.6.6 - 2026-10-09

### Changed

- **The skills watch runs only where the skills family is installed, and asks the registry only
  when it must** (FD-34). An install without `~/.sshlg-skills/runtime/package.json` reads and asks
  nothing about the family, and Settings says so. Where it is installed, the installed version is
  that runtime's — so an update the person or an agent ran is seen — and the latest version comes
  from the launcher's own update check while it is under a day old; npm is asked only otherwise.

### Fixed

- **A hidden window always takes its Dock icon with it** (FD-35, FD-05). Electron drops a Dock hide
  asked for within a second of a show, and a show that is still settling can put the icon back; the
  hide is now asked again until the Dock reports it gone (bounded), and re-asserted after every
  show. A hide that still does not take is written to `main.log` as `dock_hide failed`.

## 0.6.5 - 2026-10-08

### Fixed

- **An update is downloaded once, and the bytes that were checked are the bytes that install**
  (FD-29). The app used to verify its own download and then let Squirrel fetch the zip again from
  the network; now Squirrel is handed a local feed that names the verified file on this disk, so the
  window between the app's check and Squirrel's fetch is gone by construction. The bundle Squirrel
  stages is still compared against the verified code-directory hash before it may install.
- **Estate updates work in the installed app, and only what was checked runs** (FD-33, FD-30 review,
  [ADR-0018 amendment](docs/adr/0018-estate-updates-from-inside-the-app.md)). The skills check failed on
  every run with `spawn npm ENOENT`, because an app opened from Finder has no `npm` on its PATH; `git`,
  `npm` and `npx` now run with the login shell's PATH, git without a terminal prompt. The automatic
  skills update runs `sshlg-skills@<the checked version>` and only when every maintainer and the
  publisher of that version are the expected owner, never whatever copy `npx` finds. A clone whose
  remote merely contains the contract's name is refused; after a fetch the clone reads as up to date,
  and its own `main` is shown, never moved. A short pin that names the tip (`main @94b1829`) is no
  longer reported as behind, and every `fabric-contract.lock.json` beside the clone is read. A failed
  check reads "could not be checked" instead of "tracked from the first run", a failed update is a
  failed check with its retry, a `~/` clone path is kept, a settings change checks again within
  seconds, and nothing starts after quit.

## 0.6.4 - 2026-10-07

The first published release since 0.6.2. It carries everything listed under 0.6.3 below — 0.6.3 was
tagged and built, then superseded by this release before approval (run 37557707038 cancelled), so
the operator approves one release instead of two.

### New

- **Every limit an agent applies is visible on Spend** (contract DEC-0027). The Limits column shows
  the limit that most needs you — red when it stopped work or is over its line, amber at 80 % — and
  expanding an agent lists all of them: which limit and for whom, its window, spent of limit, and its
  state. Limits the operator chose not to apply stay listed as «Not enforced»; an approval threshold
  is never shown as a breach; a kind of limit the app does not know shows by the agent's own name.
  MCP `spend` returns the same list.

## 0.6.3 - 2026-10-07 (superseded by 0.6.4 — not published)

### Fixed

- **Opening the app during an update no longer breaks the install.** On 2026-10-07 the 0.5.6 → 0.6.2
  install on the operator's Mac was aborted twice because the old copy was opened again while it was
  being replaced. Now a launch that finds an install under way says «Finishing the update to X —
  Fabric Dashboards reopens by itself», steps aside, and the app opens by itself when the install has
  finished. «Restart to Update» says the same before it quits.

### Added

- **Estate updates (FD-30, [ADR-0018](docs/adr/0018-estate-updates-from-inside-the-app.md)).** The
  app watches the versions of the Fabric Agent Contract and of the operator's skills, and updates
  them where safe. Settings → Estate updates: name a local contract clone to watch its `main`
  against the sibling consumer pins — the only automatic step is `git fetch`; a pin move stays a
  reviewed decision in each consumer. Skills: a background `npx sshlg-skills update` behind the
  auto-update switch (off by default), after the package's publisher is checked; the first run
  bootstraps the installed-version record through the same trusted apply. LC-16 cadence
  (90 s, then every 6 h), activity codes `estate_check` / `estate_update`, status on the Settings
  page. Starts and stops with the app — no port, no launchd job, child `git`/`npm` processes only.

## 0.6.2 - 2026-10-07

The first published release since 0.6.0. It carries everything listed under 0.6.1 below — 0.6.1 was
tagged and built, but a bug audit by the fabric-workspace session found that Restart to Update ended
running agent consoles without asking, so it was withdrawn before approval (run 37539041728
cancelled). This release fixes that and the rest of the audit.

### Fixed

- **Restart to Update and Quit ask before ending work.** With an agent's console session or a
  command running, «Restart to Update», the app menu's Quit and the tray's Quit name what would be
  stopped and wait for a yes. Nothing running, no question. The automatic install never asks: it
  waits until nothing runs, as before.
- **A slow service no longer freezes the monitor.** A health probe now ends at its deadline even
  when the service keeps trickling bytes (`@passioncode-ai/fabric-service-host` 0.3.2).
- **Rewriting a descriptor no longer removes the service.** A writer that deletes and recreates the
  file (no atomic rename) used to end that service's console and wipe its stored session; a service
  now counts as removed only when its descriptor stays absent for 1.5 s across two scans.
- **Uninstall never deletes data from under a running app.** If the app is still running after the
  30-second wait, the helper leaves its data in place.
- **A `~/.claude.json` kept as a symlink stays a symlink** when uninstall or a repair edits it.
- **The login shell read for the console's `PATH`** ends at its deadline together with everything
  its startup files launched, not just the shell itself.
- **Open in Terminal through Switchboard** says it cannot continue the last session instead of
  quietly starting a new one.
- **An update check or download that stops moving fails after 45 minutes** instead of showing
  «Checking…» forever.

### Changed

- **The update's version and its "needs your step" mark are signed.** The app reads the release's
  own `update-feed.json` and requires its hash to match the signed `SHA256SUMS` (the same check as
  Fabric Inbox 95af4f7). A mark added after signing makes the update fail with `signature_failed`.
- Updater errors read in Russian in a Russian interface.

## 0.6.1 - 2026-10-07 (withdrawn — not published)

Updates by the organization's standard, and the interface in Russian by choice.

### New

- **Language in Settings:** As on this Mac, English or Русский. The window, the app menu and the
  tray switch at once. In Russian, machine reasons — a descriptor check, a refused token, a network
  error — read in Russian where the sentence is known; a service's own words stay as it wrote them.
- **A release that needs your step waits for you.** It is downloaded and verified, then held with
  «What to do» (its steps) and «Install».

### Changed

- **Updates follow LC-16 in detail** ([ADR-0015 amendment](docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#lc-16)):
  - nothing reaches Squirrel unverified: the release's `SHA256SUMS` must be signed by the
    organization's key, the zip must match it, and the app inside must be signed by team
    `KJ35UYYL22` with the announced, newer version; the bundle Squirrel stages must be that same
    build (code-directory hash), or it is removed before any quit;
  - the first check runs 90 s after start, then every 6 hours, with one retry within the hour after
    a failure;
  - **Install updates automatically** off now stops every automatic check and download («Check for
    Updates…» still works). The choice lives in the `auto-update` file, which no update, reinstall
    or uninstall rewrites; a 0.6.0 choice of off is carried over;
  - the update feed can no longer be replaced by an environment variable; Squirrel's own downgrade
    guard is on;
  - `main.log` records every step with the organization's codes (`update_check`,
    `update_download`, `update_install`, `update_restart`, `auto_update`).
- Russian follows the organization's glossary: «Устанавливать обновления автоматически»,
  «Перезапустить для обновления», «Завершить», «Открыть в Терминале».

### Fixed

- With the console open, the compact service bar lost the service's name and hid the last tab: a
  padding rule after the narrow-bar rules overrode them. The name and every tab now fit; labels fold
  into icons first.
- The collapsed sidebar's «Свернуть панель» / «Развернуть панель» no longer truncate.
- A full disk during an update download fails the check instead of hanging it.

### Build

- The release build ships `openpgp` (its one CommonJS file) and proves the finished bundle verifies a
  real release's signature and refuses one changed byte (`checks.updateVerifier`).

## 0.6.0 - 2026-10-06

The dashboard gets the screen, and the agent's own runtime sits beside it
([ADR-0017](docs/adr/0017-focus-layout-and-agent-console.md)).

### New

- **The header steps aside.** A service page opens with a one-line bar: the state, the name, the
  tabs, and «Show details» for the full card with the controls. A problem is never hidden: a
  state that is not ready, or a failed action, shows as a chip in the bar that opens the card. The
  name's hover text is the agent's summary. View → Show or Hide Service Details (⌃⌘D).
- **The sidebar folds into a rail** of icons and agents' initials with their state marks and
  badges, each named on hover. View → Show or Hide Sidebar (⌃⌘S).
- **An agent console beside the dashboard.** «Console» opens a panel with a real terminal running
  the runtime you choose — Claude Code, Codex, or another one installed and found on your login
  `PATH` — in the agent's repository: the folder whose git `origin` is the descriptor's
  `source.repository`, or one you choose. It is the runtime's own interface, with your settings and
  skills; its permission questions appear in it. New session, Continue last (`claude --continue`,
  `codex resume --last`), Stop (asks first), Open in Terminal. One console per agent; it keeps
  running while folded, hidden or on another agent's page, and ends when the app quits. View →
  Show or Hide Console (⌃⌘T).
- **The right account.** A folder that Fabric Switchboard binds to a project never runs on the
  ordinary sign-in: the session starts through Switchboard on the project's account — in the
  console once Switchboard can launch in place (its SB-75), in Terminal until then. When
  Switchboard cannot say, the session is not started.
- Panel states, the console's width and each agent's runtime and folder are remembered.

### Changed

- An automatic update does not install while a console session runs (ADR-0015 treats it like a
  running command).
- The window's style policy allows inline styles, which the terminal view needs; scripts and
  connections stay as strict as before (`SECURITY.md`).
- The release build ships `node-pty` (N-API prebuilds for both architectures, unpacked from the
  asar, `spawn-helper` made executable before signing) and proves a PTY runs from the finished
  bundle (`checks.pty`).

## 0.5.6 - 2026-10-06

The first published release since 0.4.1. It carries everything listed under 0.5.5, 0.5.4, 0.5.3
and 0.5.2 below — none of them was published on its own. 0.5.5 was tagged and built, but a third
review of the release found that a service's token could still reach an address that is not the
service, so it was withdrawn before approval. This release fixes that and everything else the
review found ([audit report, third pass](docs/reports/2026-10-05-release-audit/README.md#third-pass--2026-10-06-fix-list-for-056)).

### Security

- **An online address that is not the service gets no token again.** An online service's address
  that answers without the Fabric protocol (an error page, a parked domain) used to receive the
  token with every health check, once a minute, while the page said nothing was sent. Now only the
  check that found out carries it; later checks go without the token until the address asks for one
  again. The MCP server keeps the same rule for its whole session, where before every call sent the
  token again to an address that had answered as another service.
- **Another program on a service's port never gets its token.** The MCP `activity` tool read the
  events feed of whatever answered on the port, with the service's token, and `link`/`open` could
  build the browser address from that program's dashboard path. Both now refuse it.
- **Signing in again checks who answers now.** A dashboard whose session ended signs in again with
  the service as the app sees it at that moment, so a program that took the port after the service
  stopped never receives the token.

### Fixed

- **A page that crashes right after every load stops at "The page stopped".** It used to reload
  itself forever, starting a new page process each time. One automatic reload per crash streak
  stays; a page that ran for a minute earns it back.
- **The page you moved to in a dashboard stays when you switch tabs.** Switching to Health and back,
  or a short outage, no longer sends you back to the page a notification opened.
- **Showing a dashboard again after an error or a crash loads it again.** It no longer puts the dead
  page back on screen; a sign-in that fails while the window comes back says so with Retry.
- **The Stop dialog.** While it is open, Tab stays on its two buttons and nothing behind it can be
  reached; Escape closes it wherever focus is; closing it puts focus back on Stop, and confirming
  puts it on the service's name. A service that disappears while the dialog is open closes it,
  instead of leaving its dashboard hidden and the dialog popping up later (U-14).
- **A failed action leaves Needs attention after half an hour** even when nothing else changes on
  screen. An online service no longer offers Logs it does not have.
- **Spend.** When no agent has reported, the strip says the sum is unknown instead of «≥ $0.00». A
  report that cannot be read for a network or token-file reason is worded in the app's language.
- **Commands.** A doctor or update ended by a signal says so and keeps its output; only a command
  that never started reads «could not run». What a finished command left running counts as owned
  until it is gone, so quitting right after it ends it too.
- **An update a notification started runs once,** also when its page is opened again.
- **Small things:** the update output keeps its heading; the Activity filter forgets a service that
  is gone; notifications no longer pile up in memory over weeks; an uninstall that stopped halfway
  says what it already removed; a hidden window gets no page-load events; an online service that
  answers from several replicas no longer reads as restarted every minute; a Russian Spend reason
  reads correctly.

### MCP

- `spend` reports a stopped agent's spend as unknown, never as not reporting.
- An argument of the wrong type — a numeric path, a string limit, an empty service — is refused
  instead of silently replaced by its default.
- `fabric-dashboards://open/<anything>?…` and `open?service=…&url=` are refused like the other
  malformed links.

### Shared package and release

- `@passioncode-ai/fabric-service-host` 0.3.1: `RemoteTokenLatch`, and `lookAtServices` takes a
  `latch`. It also carries the three remote-5xx state vectors of 0.5.5. Fabric does not import the
  package today (its registry reads `services/` itself and probes nothing), so nothing changes there.
- `npm run test:e2e` installs Electron's binary before its tests, so it no longer fails right after
  `npm ci`. The release workflow's publish step uses `!cancelled()`, and a rehearsal's signed set is
  kept 14 days.

## 0.5.5 - 2026-10-06

Tagged, never published: its run was cancelled before approval, superseded by 0.5.6 after a third
review found token leaks. It carries everything listed under 0.5.4, 0.5.3 and 0.5.2
below — none of them was published on its own. In short: one entry per agent, Spend, a toolbar
over every dashboard and an at-a-glance Overview, updates that install themselves, settings that
survive an uninstall, and the lifecycle contract. On top of that, this release closes the
[release audit of 2026-10-05](docs/reports/2026-10-05-release-audit/README.md): every screen and
scenario, the code and the architecture were checked, and its findings are fixed below.

### New

- **Each agent says what it is for.** The descriptor's one-line summary shows under the name on
  its Overview card and on its page. Until now only the summary tiles were drawn.
- **An agent's page lists its tools.** These are the MCP capabilities from its well-known document,
  eight shown and «+N more».
- **One agent's dashboard can hand you to another.** A `fabric-dashboards://service/<id.instance>?path=…`
  link, or another installed agent's own address, clicked or opened in a new window inside an
  embedded dashboard, now opens that agent here at that page, signed in with its own session.
  Before, the first was refused and the second went to the browser without a session. Links to
  other sites still ask before opening the browser. A new window on the dashboard's own site opens
  in place instead of being dropped. ([ADR-0016](docs/adr/0016-agent-summary-tools-and-cross-links.md))

### Security

- **A service's token never goes to another program.** When something else answers on a service's
  port, the app no longer reads its usage report with the service's token, and no longer shows its
  version, tiles, tools or update offer as the service's own. An online service whose address
  answered as another service gets no token again until its descriptor changes.
- **A one-time sign-in code never appears in an error.** A failed page load shows the error's name,
  not the address it was loading.
- **A dashboard can only load its own site.** Links from events and notifications, and the
  dashboard path a service declares, are checked so that `/\host` or `@host` cannot open another
  site in the service's signed-in view.

### Fixed

- **Spend never turns unknown into $0.** An agent that reported spend and then stopped answering is
  listed under "could not read", and the totals read «≥». A row with calls but no cost is a lower
  bound. The Overview strip uses Spend's format (<$0.01), refreshes every minute, and leads to
  Spend when an agent failed. Opening Spend or pressing Refresh reads now, and "read at" is the
  time of that read.
- **A dashboard that failed recovers.** Retry and Reload sign in again and show the page again,
  instead of an empty pane. A page that cannot load says so, separately from a sign-in failure.
  The "service restarted — Reload" bar is visible above the page. A link from a notification or
  another agent is applied once, so switching tabs keeps your place.
- **A full disk no longer silences outage alerts or freezes the app at start.** Activity and
  settings are kept in memory until a write succeeds.
- **Quitting, updating and moving the app behave.** After a failed update or move, closing the
  window hides it again instead of quitting. Quit waits for a stubborn doctor/update command to
  end. What such a command leaves running ends with it.
- **One action at a time.** A double click no longer starts two restarts. A restart is noticed
  even when the state did not change. Restarting a duplicate whose stray copy keeps the port names
  that process.
- **A service not yet checked reads "Starting"**, not "Off" with a Start button.
- Needs attention keeps a row while its action runs, and shows a failure with a Logs button.
  Doctor and Update show a running line, end on failure, and put their output on Health. That
  includes an Update started from Needs attention.
- An unreadable services folder has Retry. The empty state links to how a service joins.
- A port conflict shows the other service's file. `fabric-dashboards://` opens the Overview.
- The menu-bar icon says "Ready: n of m" when not everything is ready, names instances, and updates
  when a notification pause ends.
- Activity keeps its filter, shows new app events while open, and a notification about several
  events of one service opens Activity filtered to it.
- Settings no longer claims notifications are off in macOS (the app cannot know). It links to
  System Settings → Notifications instead.
- Russian: Health labels, listener table, command names, menu item and dates.
- Accessibility: service tabs work with arrow keys, and buttons and cards name their service.
- The `open?…` link forms refuse unknown or repeated parameters.
- "Show data folder" reveals an app bundle instead of launching it. No listeners is "none", not an
  error.
- The uninstall removes the MCP entry before the login item, and puts it back if macOS refuses.

### Second pass (2026-10-06)

A second walk of every scenario, the interface in English and Russian, and every MCP tool against
live sample services:
- **An online service whose platform answers 5xx** (a deploy, an outage) reads "not up", then
  Not answering — never "Wrong program on port". An origin answering without the protocol is named
  by its address, not "port 0".
- Activity rows and action results name the instance ("Growth · projection"). A doctor/update
  that cannot start says "could not run: <reason>". An undeclared command or a busy service says
  so.
- The service page's Activity tab shows new rows while open. Show data folder and Show file say
  when they cannot open a path. Needs attention offers an update for a degraded service too.
  An online service's down notification says its platform runs it.
- Russian: the app's own Spend reasons, the login-item approval, command results and Overview
  strip labels (they wrap to two lines).
- MCP: instances are named apart, `spend` treats a service that does not answer as unknown, and a
  command that cannot start is a refusal.
- The update check times out instead of sticking at "Checking…".

### MCP

- `doctor` is no longer marked read-only (it runs the service's program).
- An unknown tool is a protocol error. Undeclared arguments are refused.
- An unreadable events feed is a clear refusal.
- `control` refuses a missing launchd plist, as the app does.

### Updates and releases

- **An installed copy only ever moves forward.** The app reads the update feed's version and
  installs only a newer one, so a release published out of order can never pull it back. Releases
  run one at a time, and the newer-than-published check runs again right before publishing.

## 0.5.4 - 2026-10-05

Tagged, never published: its run was cancelled before publish, superseded by 0.5.5. What it
added over 0.5.3:

- **Updates install themselves.** A downloaded version installs once the window has been closed
  for ten minutes and nothing the app started is running, and the app reopens in the menu bar.
  **Settings → Updates** has **Install updates automatically** (on by default, also for settings
  saved by an earlier version), the update state and **Check now**. Before this, an update waited
  for a quit, which a menu-bar app rarely gets.
- **A copy outside Applications says why it cannot update and moves itself.** Opened from the disk
  image or Downloads, the app asks once to move to Applications; afterwards the footer and
  Settings → Updates offer **Move to Applications**. Squirrel cannot replace a copy there, and it
  used to fail with its own error text.
- **Uninstall keeps your settings and history.** Settings → Uninstall still removes the login
  item and the MCP entry and moves the app to the Trash. Caches, logs and dashboard sessions are
  removed, but the settings and activity history stay unless you tick **Also delete my settings
  and activity history** (lifecycle LC-14: data goes only on request).
- **A reinstall puts back what the uninstall removed:** the login item and the `fabric-dashboards`
  MCP entries, pointed at the new copy. An MCP entry that points at a moved or deleted copy is
  repaired at every launch.
- **A damaged `settings.json` is restored from its last good copy** (`settings.json.bak`). It no
  longer resets to the defaults without a word, and the damaged file is kept beside it.

## 0.5.3 - 2026-10-05

Tagged, never published: its release run was superseded by 0.5.4. It carries everything listed
under 0.5.2 — one entry per agent, Spend, the dashboard toolbar and the at-a-glance Overview, the
lifecycle contract — plus the items below.

- **A dashboard whose session ended signs in again by itself.** When the page answers 401, the app
  runs the login code again and reopens the same page, at most once a minute per view. Reload page
  covers the same case. Before this, the operator was left on the service's 401 text, and the only
  way back was Restart, then Reload. Reported by an agent's owner session.
- Embedded dashboards follow the app's light or dark theme (`nativeTheme`), not only the theme of
  macOS.
- **No Dock icon while the window is hidden.** Closing the window leaves the app in the menu bar
  only; opening it from the menu bar, a link or Finder brings the Dock icon back (FD-05,
  `test/e2e/spend.test.ts`).
- **The app no longer ships Electron's camera, microphone and Bluetooth purpose strings.** It asks
  for none of these (every permission request is refused), and the release build now removes them
  from the app's and every helper's `Info.plist` and fails if one remains (FD-06,
  `checks.usageDescriptions`).

## 0.5.2 - 2026-10-05

Tagged, never published: its run was cancelled before approval, superseded by 0.5.3. The `v0.5.0`
and `v0.5.1` tags were never released either: their CI check failed on lifecycle tests (LC-02, then
LC-14). This version carries both fixes.

### Fixed

- **A command that exited is done, even when a descendant holds its output open.** A `doctor` or
  `update` command whose child left the process group (`setsid`) and kept stdout open used to
  count as running until that child let go. Measured: 5054 ms against 1 s now
  (`test/lifecycle.test.ts`, *LC-02: a command that exited is done…*). The command's streams get
  one second after its exit, and then the command counts as finished.
- **A kill in progress is never abandoned.** The SIGKILL fallback for a group that ignores SIGTERM
  no longer rides an unreferenced timer, so an exiting MCP server or app still sends it. The LC-02
  test had failed in CI since the lifecycle contract landed.
- The LC-14 test holds the purge helper it waits for. The app lets that helper go on purpose so it
  can quit, and in CI the test's own process ended first.

## 0.5.0 - 2026-10-05 (tagged, not released)

- **A toolbar over every embedded dashboard ([ADR-0014](docs/adr/0014-dashboard-toolbar.md)).**
  It has Back, Forward, Reload page and Dashboard home, shows the page's address, and offers two
  copies: **Copy address** (the page's own URL) and **Copy app link** (a `fabric-dashboards://`
  link that opens the same page here, signed in). A one-time login code is never shown or copied
  (SCN-039, SCN-040).
- **Overview reads at a glance.** A status strip shows agents ready, not answering, needing
  attention, and spend today and in 30 days. Needs attention takes one line per row, shows three
  rows and folds the rest behind "Show all". The cards are denser: four across a wide window,
  equal height in a row, one-line values and events (SCN-041, SCN-042).

- **Spend ([ADR-0013](docs/adr/0013-spend-from-the-agents.md)).** A new page shows what every
  agent spent today, in 7 and in 30 days, its own budget, and a per-model breakdown. The numbers
  come from each agent's own usage report (Fabric Agent Contract DEC-0021, `surfaces.usage`). A sum
  that includes unpriced calls reads «≥ $x», and a cost nobody knows reads «unknown», never $0.
  Agents that cannot be read are named with the reason, and agents that do not report are named
  too. Nothing is read while the page is closed or the window is hidden. Agents get the same sums through the new MCP tool
  `spend` (SCN-036…038).
- `@passioncode-ai/fabric-service-host` 0.3.0: `…/usage` (`checkUsage`, `summarizeUsage`), and
  `WellKnown.surfaces` carries `mcp.capabilities` and `usage`.

- **One entry per agent ([ADR-0012](docs/adr/0012-one-entry-per-product.md)).** Every instance of
  one service id — the main endpoint, a local projection, a read-only access point — is one entry in
  the sidebar and one card on Overview; the service page switches between the instances, each with
  its own state, session and controls. The `default` instance is the one a click opens, and a down
  default is never replaced by another instance. Services that answer without a dashboard are listed
  under **Background**. Attention, Activity, notifications, the tray, deep links and start/stop/restart
  still act on the exact instance; MCP `list_services` names each service's `product`
  (SCN-033…035).
- The online-service end-to-end test waits one full online probe interval (60 s, LC-08) for a
  refused token; it had been failing on `main` since the lifecycle contract landed.

- **Releases are signed only in GitHub Actions.** `.github/workflows/release.yml` runs on a
  `vX.Y.Z` tag in the protected `release` environment, after a person from `release-approvers`
  approves (whoever pushed the tag may; an agent never does). It signs with the organization's CI Developer ID, notarizes and staples
  the app and then the image with the shared `notarize` action, attests every file (Sigstore), and
  publishes them with `SHA256SUMS` and its GPG signature. A `-rc` tag with `publish=false` rehearses
  the whole path without creating a release. A locally signed build is for debugging and is never
  published ([RUNBOOK](docs/RUNBOOK.md#release)).
- `scripts/dist-mac.mjs` runs in stages (`--stage app|package|seal`), so the update zip and the
  image are made from the stapled app. The identity is named with `--identity` and never picked
  from a keychain in CI. The seal stage fails unless the app, the app inside the update zip and the
  image are all stapled and Gatekeeper accepts the app as well as the image. The local
  `--notary-profile` path now reads Apple's status (`Accepted`) instead of trusting the exit code.
- `validate.yml` pins its actions by commit and runs before every release.

The organization's [lifecycle contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md)
(LC-07…LC-15), from the 2026-10-03 lifecycle audit. `AGENTS.md` → *Lifecycle* is the inventory and
idle budget; `test/lifecycle.test.ts` holds each rule.

- **Idle means idle (LC-08).** The monitor starts hidden — a launch at login shows no window, so it
  now runs at the background cadence instead of the 5-second one forever — and wakes only when a
  probe or a rescan is due instead of every second. Status reaches the window, the tray and the
  Dock only when something a person can see changed; a hidden window gets no IPC. Hidden, the
  events feed is read every 30 s, an online service at most once a minute, and `launchctl print`
  runs only after a missed probe, a changed pid or every 5 minutes. Embedded dashboards are released
  5 minutes after the window hides and come back on their page when it shows.
- **Bounded files (LC-12).** The activity feed is appended, compacted at twice its 5,000-row cap,
  and its state written on a 2-second debounce, not rewritten and fsynced on every event.
  Start-up removes temporary files left by a killed writer and the stored sessions of services that
  are no longer installed; a service removed while the app runs takes its view and session with it.
  `main.log` is 0600 and rotates at 5 × 5 MB.
- **The MCP server leaves with its session and its code (LC-10).** It exits within a second of
  stdin closing or `SIGTERM`, ending every command it started with its whole process group. After an
  app update it answers the next call `stale` with both versions and exits, instead of serving the
  old code until the session restarts. A descriptor's `doctor`/`update` no longer inherits
  `ELECTRON_RUN_AS_NODE` or `NODE_OPTIONS`, and runs in its own process group with a deadline, in the
  app as well.
- **Asked once (LC-07).** Launch at login is off until the person answers a one-time question on
  Overview or sets it in Settings; a launch or an update never registers it, and a login item turned
  off in System Settings stays off. Tray Quit no longer opens a dialog the first time; the menu says
  that quitting stops no service.
- **Uninstall (LC-14).** Settings → Uninstall removes the login item, the `fabric-dashboards` entry
  in Claude Code's `~/.claude.json`, and the app's data once it has exited, then moves the app to
  the Trash. `fabric-dashboards-mcp --unregister` removes the MCP entry alone.
- **Hardened fuses (LC-13).** `npm run dist` (`--stage app`, before signing) turns off
  `NODE_OPTIONS` and the inspector arguments and turns on ASAR integrity validation and
  `OnlyLoadAppFromAsar`, then reads the fuses back from the built binary and fails on a wrong one. `RunAsNode` stays on (the MCP server runs in this binary)
  and cookie encryption stays off (no Keychain item without a signed upgrade test); both are
  declared in `AGENTS.md`.
- **Builds clean up (LC-15).** `npm run dist` keeps the current and previous release in `release/`
  (`--stage seal` prunes the rest and names them in the receipt's `pruned`) and unregisters every
  bundle it deletes from LaunchServices; `npm run clean` removes regenerated output, including a
  `release/stage/` left by a build stopped between stages.

## 0.4.1 - 2026-10-03

- **MCP `link` and `open` without a path point `http_url` at the service's dashboard**, read from
  its well-known document, instead of the origin root. An online service often serves its panel
  under a path and answers 404 at `/`, so the diagnostic URL and the browser fallback led nowhere.
  `open_link` is unchanged — the app already opened the dashboard. A service that does not answer
  keeps the root. Found on the first real online service.
- **MCP tool descriptions name online services**: the instructions, `list_services`, the `url`
  argument and `control` (which refuses an online service) no longer say "local" and
  `http://127.0.0.1` only.

## 0.4.0 — 2026-10-02

- **Online services.** An agent or dashboard that runs online — an `https` origin on a platform —
  appears beside the local ones, under **Online**, read directly over verified TLS
  ([ADR-0011](docs/adr/0011-online-services.md); Fabric Agent Contract DEC-0019, `placement: "remote"`).
  The well-known document, events and the one-time login code are the same; the token goes only to
  the descriptor's own https origin; no redirect is followed; the dashboard opens signed in inside
  the app (SCN-030, SCN-031). A refused token, a certificate that does not verify, a redirect and a
  minute of silence are each `down` with their own reason (SCN-032); a token file that cannot be read
  is `invalid` and the service is never contacted. No start, stop, restart or update is offered for
  an online service — its platform supervises it.
- **MCP:** `list_services` carries `placement`; `control` refuses an online service; `activity` and
  the status read it with its token; `open?url=` accepts exactly a registered online origin.
- **`@passioncode-ai/fabric-service-host` 0.2.0:** placement-aware descriptors, https requests,
  `readToken`/`authHeaders` (moved from the app), `refused`, the remote state precedence and nine new
  shared vectors.
- Tests reach an online service through `FD_TEST_REMOTE`, honoured only in an unpackaged build.

## 0.3.4 — 2026-10-01

- **Fixed: a blank Dashboard tab.** Switching between two services whose dashboards were both open
  left the tab empty: the old dashboard's hide arrived after the new one's show and removed it. A
  hide now withdraws only the view its own dashboard asked for, and a page that finishes loading
  after a newer choice never covers it (`ViewSlot`, SCN-015; reproduced by a new end-to-end test,
  which fails without the fix).
- **Notifications only when it matters** ([ADR-0010](docs/adr/0010-notifications-only-when-it-matters.md)).
  A service event that asks to notify becomes a banner only when the agent needs a decision, failed,
  or warns — once per subject and cool-down (question 24 h, warning 12 h, failure 6 h), remembered
  across restarts; one warning from two instances of an agent is one banner. Deliveries, recoveries
  and plain notices go to Activity only. The banner names the agent and its instance, says what it
  wants in the subtitle, and opens the item on click.
- **Two instances read apart:** the sidebar, cards and banners name a non-default instance
  ("Example Agent · preview").
- **Less disk work:** a poll that brings no new event no longer rewrites the activity file (about
  1 MB, every 15 s per service); a failed write leaves no temporary file behind.

## 0.3.3 — 2026-10-01

- **Cold launch from MCP:** remove the MCP launcher’s `ELECTRON_RUN_AS_NODE` flag from the child that opens a dashboard. Previously macOS could accept a link while the closed app exited without a window. Existing-host routing, strict fallback and the MCP process environment are preserved.
- A process-boundary regression test reproduces the inherited flag before the fix and verifies its removal only in the dispatch child. [Release verification](docs/runs/2026-10-01-dashboard-links/README.md#cold-launch-correction--033).

## 0.3.2 — 2026-10-01

- **Dashboard routing:** MCP `host_status` checks the installed app, its version and the URL handler without opening a window. `open` targets that verified app; an installed-host failure returns an error instead of opening the dashboard in a browser.
- **Explicit fallback:** `fallback=never` prohibits browser opening. The default `if_absent` permits it only after confirmed app absence. Success means the OS accepted the request, not that the page has loaded.
- **Agent handoff:** MCP instructions identify `open_link` as the primary dashboard link. [SCN-028](docs/ux/scenarios.md) and [verification](docs/runs/2026-10-01-dashboard-links/README.md) cover host discovery, failure handling and repeated-link view reuse.

## 0.3.1 — 2026-10-01

- **Fixed: "not answering" no longer flaps under load.** A probe waits 5 s instead of 2 s. A
  service counts as not answering only after three probes in a row fail; a missed probe is
  re-checked after 5 s, and until then the last answer stands. The notification needs a probe
  that still fails after 60 s of silence (was 30 s), so a service that answers again before
  that sends neither "not answering" nor "is back". Activity still records each outage
  ([ADR-0008](docs/adr/0008-a-missed-probe-is-not-an-outage.md)).
- **License.** This is the first release under the GNU AGPL-3.0, with a commercial license
  from PassionCode.ai for use the AGPL does not cover (`AGPL-3.0-only OR
  LicenseRef-PassionCode-Commercial`, [ADR-0007](docs/adr/0007-agpl-or-commercial.md)).
  v0.2.0 and v0.3.0 stay PolyForm Noncommercial or Internal Use, and v0.1.0 stays MIT.

## 0.3.0 — 2026-09-30

- **Service links.** `fabric-dashboards://service/<id>.<instance>` opens that service in the app,
  and `?path=/…` one page of it — the link Fabric's "Open dashboard" opens. The MCP tools hand
  links out in this form; the 0.2.0 forms `open?service=…` and `open?url=…` still open. A
  malformed link, one that names a service not installed, carries extra parameters, a user,
  password or port, or points off the service's origin is refused with the reason
  ([ADR-0005](docs/adr/0005-service-links.md)).
- **MCP:** `open_link` is `null` for a descriptor that cannot be read, and an event whose link is
  not a path on the service gets no deep link instead of failing the whole `activity` call.
- **Shared with Fabric:** the code that reads services — descriptors, claim conflicts, launchd
  status, the health probe, the state precedence, one look at every service, the service link —
  is the workspace package `@passioncode-ai/fabric-service-host` (`packages/service-host`), with
  state-precedence test vectors every host runs. The app and its MCP server read through it;
  nothing a user sees changes ([ADR-0006](docs/adr/0006-shared-service-host-package.md)).
- **README:** a quick start a newcomer can follow — download, first run, `claude mcp add --scope
  user`, one tool call that proves the server answers.

## 0.2.0 - 2026-09-29

- **Links from agents open here.** `fabric-dashboards://open?service=<id.instance>&path=/…`
  (or `?url=http://127.0.0.1:<port>/…`) opens that page of an installed service inside the
  app, signed in, whether the app was running or not. A link to anything else is refused with
  the reason.
- **MCP server for agents.** `Contents/Resources/bin/fabric-dashboards-mcp` (stdio): list
  services with their state and links, open a page, start, stop or restart through launchd,
  run a service's doctor or update, read its recent activity. Tokens are never returned.
- **Fixed:** a notification clicked while the window was still loading could land on the
  overview instead of the item; the window now picks the waiting navigation up once it listens.

- **License.** From this release, Fabric Dashboards is source-available under
  `PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0`, with a
  commercial license on request (contact@passioncode.ai). Release 0.1.0 and every earlier
  commit, and the later commits up to and including `7fb699d`, stay available under MIT.
  Contributions are accepted under [CLA.md](CLA.md).

## 0.1.0 - 2026-09-28

First release of Fabric Dashboards: one window for every local agent service on the Mac
that speaks `fabric-service/0.1`.

- Finds services from the descriptors in the services folder, live, with no setup.
- Shows each service's real state: ready, degraded, not answering, off, two copies,
  another program on its port, a port conflict or an invalid descriptor.
- Starts, stops and restarts services through launchd only; Stop stays off after a
  restart of the Mac.
- Opens each service's dashboard inside the app, signed in with a one-time code, one
  live view per service.
- Activity: every service's events and the app's own observations in one feed.
- Notifications for outages, recoveries, duplicates and events a service marks for
  you, with per-service settings, quiet hours and a one-hour pause.
- Menu bar status, open at login, English and Russian, dark and light themes.
- Updates itself from signed releases.
