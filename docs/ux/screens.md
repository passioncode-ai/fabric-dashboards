<!-- Managed with super-ux (ux-contract v4). The design map: every screen and state with its Figma frame, wireframe, code coverage, and resources. Update in the same change as any interface change; when Figma is enabled, update the frame too. -->

# Fabric Dashboards — screens

## Index
| ID | Screen | Used by | Figma | Status | Coverage |
|----|--------|---------|-------|--------|----------|
| SCR-01 | Overview | SCN-001, SCN-002, SCN-003, SCN-005, SCN-006, SCN-007, SCN-021, SCN-024, SCN-030, SCN-033, SCN-035, SCN-041, SCN-042, SCN-054, SCN-058, SCN-059 | none (text-only) | built | src/renderer/components/Overview.tsx |
| SCR-02 | Service view | SCN-004, SCN-007–SCN-016, SCN-021, SCN-025, SCN-026, SCN-027, SCN-029, SCN-031, SCN-032, SCN-034, SCN-039, SCN-040, SCN-045, SCN-046, SCN-061, SCN-073, SCN-076 | none (text-only) | built | src/renderer/components/ServiceView.tsx |
| SCR-03 | Activity | SCN-003, SCN-017, SCN-018, SCN-020 | none (text-only) | built | src/renderer/components/Activity.tsx |
| SCR-04 | Settings | SCN-019, SCN-022, SCN-024, SCN-043, SCN-044, SCN-075, SCN-086 | none (text-only) | built | src/renderer/components/Settings.tsx |
| SCR-05 | Stop confirmation | SCN-009 | none (text-only) | built | src/renderer/App.tsx |
| SCR-06 | Tray menu | SCN-023, SCN-085 | none (text-only) | built | src/electron/tray.ts |
| SCR-07 | Spend | SCN-036, SCN-037, SCN-038, SCN-041 | none (text-only) | built | src/renderer/components/Spend.tsx |
| SCR-08 | Sidebar, Agents mode | SCN-001, SCN-006, SCN-017, SCN-022, SCN-033, SCN-035, SCN-044, SCN-047, SCN-056, SCN-057, SCN-077 | none (text-only) | built | src/renderer/App.tsx |
| SCR-10 | Console panel | SCN-048, SCN-049, SCN-050, SCN-053, SCN-054, SCN-055, SCN-058, SCN-066, SCN-069, SCN-080 | none (text-only) | built | src/renderer/components/ConsolePanel.tsx |
| SCR-09 | System dialogs | SCN-014, SCN-024, SCN-027, SCN-044 | none (text-only) | built | src/electron/main.ts, src/electron/views.ts |
| SCR-11 | Hand-over page | SCN-069 (before 0.8.0) | none (text-only) | retired | src/renderer/App.tsx |
| SCR-12 | Sidebar, Sessions mode | SCN-077, SCN-078, SCN-082, SCN-083, SCN-084 | none (text-only) | designed | none yet |
| SCR-13 | All sessions | SCN-069, SCN-075, SCN-078, SCN-079, SCN-081, SCN-082, SCN-083, SCN-084 | none (text-only) | designed | none yet |
| SCR-14 | Session page | SCN-066, SCN-069, SCN-075, SCN-080, SCN-081, SCN-082, SCN-083, SCN-084, SCN-085 | none (text-only) | designed | none yet |
| SCR-15 | Connections → Sessions stopped on a limit | SCN-075 (before 0.8.0) | none (text-only) | retired | src/renderer/components/ConnectionsMap.tsx |

## Design system
- **Style pack:** custom — the PassionCode.ai design system v1.1.0 (`passioncode-ai.github.io/design-system/tokens.css`), the family's shared product pack (Fabric ADR-0070); calm product-UI rules from sheleg-design
- **Figma library:** none
- **Tokens in code:** `src/renderer/brand/fabric-tokens.css` (vendored byte-for-byte, pinned in `docs/brand-source.json`)
- **Component source:** `src/renderer/components/`
- **Assets:** `src/renderer/brand/dashboards-mark.svg`, `build/icon.icns`

## Web surfaces
- **Web surfaces:** no

## Screens

### SCR-01: Overview
- **Used by:** SCN-001, SCN-002, SCN-003, SCN-005, SCN-006, SCN-007, SCN-021, SCN-024, SCN-030, SCN-033, SCN-035, SCN-041, SCN-042
- **Purpose:** JTBD-01 — the state of every agent, what needs the operator and what was spent, in one screen
- **Elements:** header with the agent count; the one-time launch-at-login question (Open at login, Not now) until it is answered; the status strip, each cell a label over its number (Ready, Not answering or in conflict, Need attention, Spent today, Spent in 30 days — the spend cells open Spend; labels wrap to two lines); Needs attention (count, three single-line rows — state, name, reason, one action: Restart, "Update to <v>", Open, Logs; "Restarting…" while it runs — then "Show all N" / "Show fewer"); agent cards (state, name, version+commit, uptime or "online · <host>", the agent's one-line summary, up to six tiles, "also:" with each other instance's state, latest event); the Online group; empty state with "Set up with my coding agent", "Show the services folder" and "How to build an agent for Fabric"
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first read of the services directory | — | "Looking for services…" |
  | empty | no descriptor | — | "No agents yet" + "Agents appear here once they are installed. Set up Fabric with your coding agent, or install an agent that supports Fabric." + the folder path + Set up with my coding agent (opens the Setup console) + Show the services folder + How to build an agent for Fabric; a Show folder failure reads "Could not open <path>: <reason>" |
  | success | every agent ready | — | strip and cards |
  | attention | any service not ready, asking, or with a failed action in the last 30 minutes | — | Needs attention between the strip and the cards, most severe first; three rows, then Show all |
  | error | services directory unreadable | — | sentence with path + Retry |
- **Coverage:** src/renderer/components/Overview.tsx
- **Scenarios:** SCN-001, SCN-002, SCN-003, SCN-005, SCN-006, SCN-007, SCN-021, SCN-024, SCN-030, SCN-033, SCN-035, SCN-041, SCN-042
- **Status:** built

### SCR-02: Service view
- **Used by:** SCN-004, SCN-007–SCN-016, SCN-021, SCN-025, SCN-026, SCN-027, SCN-029, SCN-031, SCN-032, SCN-034, SCN-039, SCN-040, SCN-045, SCN-046, SCN-061, SCN-073, SCN-076
- **Purpose:** JTBD-02 and JTBD-04 — control one service and work in its dashboard
- **Layout (ADR-0017, SCN-046):** a compact bar by default — state mark, name, state badge, one problem chip when not ready or after a failed action, a running action's progress, the tabs, "Fabric" (the mark and the word; accessible name "Open Fabric"; opens Fabric about this agent, or a native menu "Fabric is not installed — get it at passioncode.ai/fabric", SCN-061, ADR-0021), "Console", and "Show details" (View → Show or Hide Service Details, ⌃⌘D); the name carries the agent's summary on hover; "Show details" opens the full card below the bar (everything listed next), "Hide details" closes it; the choice is remembered. The console panel (SCR-10) sits to the right of the tab content.
- **Elements:** instance switch (when an agent has more than one instance: "Main · online", "<instance> · this Mac"); header: name, state, progress ("Restarting…"), the agent's summary, facts (version, build, pid, port, uptime), Tools (eight, "+N more"), reasons, the last action's result for 30 minutes (with Logs after a failure), controls (Start, or Restart — primary when down or two copies — and Stop; "Update to <v>" when available; Doctor when declared; Show data folder; Show file; "Show the file of <other>" in a conflict; a path that cannot be shown says so); tabs Dashboard / Activity / Connections / Load (when the agent declares its load) / Health / Logs (arrow keys move between them; no Logs for an online service); dashboard toolbar of icons (Back, Forward, Reload page, Dashboard home, page address, Copy with its menu: Copy address, Copy app link); embedded dashboard; "Restarted, page reloaded" in the toolbar after a restart reloaded the page (FD-74)
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | ready | answers as itself | — | dashboard tab active |
  | degraded | degraded sources | — | reasons listed in the header, dashboard usable |
  | starting | never probed, restarting, or silent under 15 s | — | "Starting", "Waiting for the first answer…" |
  | down | three probes in a row unanswered and no answer for 15 s (ADR-0008) | — | "Not answering since HH:MM." + Restart (primary) + Logs tab |
  | off | launchd job disabled or not loaded | — | "Stopped by you. It stays off until you start it." or "The launchd job is not loaded." + Start |
  | duplicate / foreign / conflict / invalid | see SCN-011–SCN-013, SCN-004 | — | explanation; Dashboard tab "The dashboard opens when the service answers as itself."; no token sent; nothing of another program shown as the service's |
  | working | a control or command is running | — | progress label, other controls disabled, a second action refused |
  | no dashboard | no dashboard surface | — | opens on Health; Dashboard tab "This service has no dashboard." |
  | sign-in error | SCN-016 | — | "Cannot sign in to <Service>: <reason>" + token path + Retry |
  | refreshing | explicit Reload page, SCN-039 | — | spinner includes one fresh sign-in for registered login-capable services, then the current safe page; concurrent clicks share the attempt |
  | page error | the page does not load, or explicit refresh returns an HTTP error | — | "The page of <Service> could not load: <reason>" + Retry |
  | crashed | the page crashed twice | — | "The page stopped." + Reload |
  | restarted | a new pid | — | "The service restarted." + Reload above the page |
  | load | the agent declares `extensions/load/0.1` (SCN-076) | none | Load tab: running, waiting, done and failed in 24 h, the limits, times, a bar per window, a row per context; a tab that leaves the list falls back to Dashboard or Health |
- **Coverage:** src/renderer/components/ServiceView.tsx, src/electron/views.ts
- **Scenarios:** SCN-004, SCN-007, SCN-008, SCN-009, SCN-010, SCN-011, SCN-012, SCN-013, SCN-014, SCN-015, SCN-016, SCN-021, SCN-025, SCN-026, SCN-027, SCN-029, SCN-031, SCN-032, SCN-034, SCN-039, SCN-040, SCN-045, SCN-046
- **Status:** built

### SCR-03: Activity
- **Used by:** SCN-003, SCN-017, SCN-018, SCN-020
- **Purpose:** JTBD-03 — everything the agents did, in one feed
- **Elements:** filters (Service: All services or one; Level: All levels, Notice and above, Warnings and errors, Errors — kept between visits); day groups (Today, Yesterday, a date); rows (time, service, level, sentence; a service row opens its link); one line per feed that fails while its service answers
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first fetch | — | "Loading…" with a spinner |
  | empty | no events | — | "Nothing has happened yet. Events appear here as your services work." |
  | success | events | — | newest first; new rows appear while open |
  | partial | one feed failed while its service answers | — | line naming the service and reason, others shown |
- **Coverage:** src/renderer/components/Activity.tsx
- **Scenarios:** SCN-003, SCN-017, SCN-018, SCN-020
- **Status:** built

### SCR-04: Settings
- **Used by:** SCN-019, SCN-022, SCN-024, SCN-043, SCN-044, SCN-062, SCN-075, SCN-086
- **Purpose:** fit startup, updates and notifications to the operator's day
- **Elements:** Fabric Dashboards: Open at login (off until chosen), Theme, Language (Same as the system / English / Русский), version; Updates: Install updates automatically, its explanation and the update state with its action (Check now, Restart to update, Move to Applications; a held release: What to do + Install); Notifications: "Whether macOS shows them is set in System Settings → Notifications." with Open System Settings (on Windows and Linux: "Whether the system shows them is set in its notification settings." with Open system settings), Show notifications, Quiet hours, Pause notifications for 1 hour / "Paused until HH:MM" + Resume, Also send outages to (Automatic / an agent offering a notify capability / Off, its help and last-delivery lines, SCN-062), per service Show notifications and Events from; services folder with Show folder; Uninstall (confirmation with "Also delete my settings and activity history"; removes the login item and the MCP entry and moves the app to the Trash; settings and history stay unless ticked); Unattributed listeners (Port, Address, Program, pid; Scan again); from 0.8.0 a Sessions section (SCN-086): "Open sessions handed over by Switchboard here" (read and written through Switchboard, disabled with its reason when Switchboard is missing or too old) and "Continue sessions after a limit reset" (moved here from the group "Sessions stopped on a limit"), each with its explanation
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | default | — | settings apply immediately |
  | error | login item refused, listener scan failed, uninstall stopped, a folder that cannot be shown | — | reason beside the control |
- **Coverage:** src/renderer/components/Settings.tsx
- **Scenarios:** SCN-019, SCN-022, SCN-024, SCN-043, SCN-044
- **Status:** built

### SCR-05: Stop confirmation
- **Used by:** SCN-009
- **Purpose:** a destructive-feeling action is confirmed with its consequence
- **Elements:** "Stop <Service>?" — "It stays off, also after the Mac restarts, until you start it. Agents that use it will get no answer."; Cancel (focused), Stop (destructive); Escape cancels wherever focus is; focus stays in the dialog while it is open, returns to Stop on Cancel and moves to the service's name after Stop (U-14, T-21); a service that disappears closes the dialog (T-18)
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | Stop chosen | — | dialog |
- **Coverage:** src/renderer/App.tsx
- **Scenarios:** SCN-009
- **Status:** built

### SCR-06: Tray menu
- **Used by:** SCN-023, SCN-085
- **Purpose:** JTBD-01 without opening the window
- **Sessions line (0.8.0, SCN-085):** under the headline, while a coding session runs or waits for the person, "Sessions: running N, waiting for you M" (a part at zero left out); it opens the Sessions mode
- **Elements:** icon in three states; headline line ("Needs attention: N", "Ready: n of m", "All services ready"); problems first; every service as "● <name · instance> — <state>"; Open Fabric Dashboards; Pause notifications for 1 hour / Resume notifications; "Quitting Dashboards does not stop your services." (disabled line); Quit
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | nothing degraded, starting or wrong (a service turned off keeps it calm) | — | calm icon, "All services ready" or "Ready: n of m" |
  | degraded | degraded, starting or stopping | — | degraded icon |
  | error | something down or wrong | — | alert icon, problems first |
- **Coverage:** src/electron/tray.ts
- **Scenarios:** SCN-023
- **Status:** built

### SCR-07: Spend
- **Used by:** SCN-036, SCN-037, SCN-038, SCN-041
- **Purpose:** JTBD-01 — what every agent spent, per agent and per model, from its own report
- **Elements:** "read at HH:MM", Refresh; All agents tiles (Today, 7 days, 30 days); the agents table (Agent, Today, 7 days, 30 days, Limits — the limit that most needs a person, red when it stopped work or is breached, amber at 80 %; a name expands the limits table — Limit, Window, Spent, State, not-enforced rows muted — then Model, Calls, Tokens in / out, Cost); "Could not read" with each agent's reason; "Not reporting spend yet: …"; the ≥ note
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first read | — | "Reading what each agent spent…" |
  | empty | no agent reports or fails to report | — | "No agent reports its spend yet" with what an agent must publish |
  | success | reports read | — | totals and table |
  | partial | an unpriced call or an unreadable agent | — | «≥» amounts and the note |
  | subscription | calls on the operator's own subscription (FD-88, FD-97) | none | beside the money: "+ ~$x on subscriptions", "+ at least ~$x" when some are unpriced or an agent was unreadable, "+ subscription calls not priced" when none is priced; never in the sums |
  | error | an agent's report could not be read | — | "Could not read" with the reason in the window's language |
- **Coverage:** src/renderer/components/Spend.tsx, src/core/spend.ts
- **Scenarios:** SCN-036, SCN-037, SCN-038, SCN-041
- **Status:** built

### SCR-08: Sidebar, Agents mode
- **Used by:** SCN-001, SCN-006, SCN-017, SCN-022, SCN-033, SCN-035, SCN-044, SCN-047, SCN-056, SCN-057, SCN-077
- **Mode switch (0.8.0, SCN-077):** under the mark, a two-part switch "Agents" / "Sessions" (⌘1 / ⌘2; Ctrl+1 / Ctrl+2 elsewhere), the Sessions part carrying the count of sessions that need the person; the window reopens in the mode it was closed in, and nothing switches it but the person (a click on a session's notification or the tray's Sessions line counts as the person). This record is the Agents mode; the Sessions mode is SCR-12. In the rail the switch is two icons.
- **Purpose:** where everything is, and whether anything needs the operator
- **Rail (SCN-047):** collapsed, the sidebar is a narrow rail — the mark, icons for Overview, Activity, Spend and Settings with their badges, one entry per agent (state mark and initials, "!" when another instance needs attention), each named in a tooltip and to a screen reader; "Collapse sidebar" / "Expand sidebar", View → Show or Hide Sidebar (⌃⌘S); remembered
- **Elements:** the mode switch; Overview (problem count), Activity (unread count), Connections, Spend, Pinned, On this Mac (On this computer elsewhere), Online, Services and the folded Hidden section (one entry per agent with the primary's state and "!" when another instance needs attention; no hand-over or session entry from 0.8.0, SES-01, SES-02), footer update line ("Checking for updates…", "Downloading an update…", "Update <v> ready" + Restart to update, "Update <v> is verified and waits for you…" + What to do + Install, "Updates install only from the Applications folder." + Move to Applications, "Update failed: <reason>" + Retry), Settings
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | default | — | entries and counts |
  | rail | collapsed | — | icons, state marks and initials; names in tooltips |
- **Coverage:** src/renderer/App.tsx
- **Scenarios:** SCN-001, SCN-006, SCN-017, SCN-022, SCN-033, SCN-035, SCN-044, SCN-047
- **Status:** built

### SCR-09: System dialogs
- **Used by:** SCN-014, SCN-024, SCN-027, SCN-044
- **Purpose:** the few moments the app asks before it acts
- **Elements:** "Uninstall Fabric Dashboards?" with its explanation and "Also delete my settings and activity history"; "Move Fabric Dashboards to Applications?" (Move to Applications, Not now); "This link cannot be opened" with the reason and "Nothing was opened."; "Open in your browser?" — "<address> is outside this service. It opens in your default browser." (Open in browser, Cancel)
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | the action that asks | — | native macOS dialog |
- **Coverage:** src/electron/main.ts, src/electron/views.ts
- **Scenarios:** SCN-014, SCN-024, SCN-027, SCN-044
- **Status:** built

### SCR-10: Console panel
- **Used by:** SCN-048, SCN-049, SCN-050, SCN-060, SCN-066, SCN-069, SCN-080
- **Where it shows (0.8.0):** as a drawer over an agent's page (ADR-0017), and full height on a session's page (SCR-14), where it has no fold and no collapse; a hand-over or continued session no longer drops down over a page of its own (SES-06)
- **Purpose:** JTBD-05 — the agent's own runtime, in its repository, beside its dashboard
- **Elements:** header: coding agent picker (Claude Code, Codex, other installed coding agents), folder line (shortened path; full path on hover) with "Other…", "Switchboard project <name>" when bound; actions in one compact row: "New session", "Continue last session" (when the coding agent can resume), the exit line, and on the right the Open in Terminal icon ("Open in Terminal via Switchboard" as its label for a bound folder; the full button for a project folder the installed Switchboard cannot run in place); "Stop" and "Hide console" in the header; the terminal (the runtime's own interface); an exit line; the left edge drags the width (320 px up to where the dashboard keeps max(480, its declared `minWidth`) px, DEC-0036 ED-7; SCN-060)
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | idle | nothing started for this agent | — | coding agent, folder, "New session", "Continue last session" |
  | running | a session runs | — | the terminal takes the panel; "Stop" in the header |
  | exited | the coding agent ended | — | its output stays; "The session exited with code N." with "New session" and "Continue last session" |
  | no runtime | none installed | — | "No supported runtime is installed" and the list looked for |
  | no folder | no checkout found, or the folder is gone | — | "Choose the folder this agent's code lives in" + "Choose folder…" |
  | switchboard project, not in place | a project folder; Switchboard without `--in-place` | — | the explanation + "Open in Terminal via Switchboard"; no start in the panel |
  | switchboard error | Switchboard did not answer | — | "Switchboard did not answer; the session was not started" |
  | collapsed | hidden by the person | — | nothing drawn; the session keeps running |
- **Coverage:** src/renderer/components/ConsolePanel.tsx, src/electron/console.ts, src/core/consoles.ts
- **Scenarios:** SCN-048, SCN-049, SCN-050
- **Status:** built

### SCR-11: Hand-over page
- **Used by:** SCN-069 (before 0.8.0)
- **Purpose:** a Switchboard hand-over that ran in a console of its own, reached from the sidebar's "Hand-overs" section
- **Elements:** the agent, the account and the folder; "Switchboard handed this session to the console instead of opening a Terminal window. Type to it on the right."; the console dropping down over it; Close once ended
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | a hand-over runs | none | the console over the page |
- **Coverage:** src/renderer/App.tsx
- **Scenarios:** SCN-069 (before 0.8.0)
- **Status:** retired (2026-10-24, operator review: the sidebar section, this page, its Close under the drawer and the text pointing "on the right" (SES-01 to SES-06, SES-09) are replaced by the Sessions mode: SCR-12, SCR-13, SCR-14)

### SCR-12: Sidebar, Sessions mode
- **Used by:** SCN-077, SCN-078, SCN-082, SCN-083, SCN-084
- **Purpose:** ST-023: every coding session in one list apart from the agents, grouped by what it needs
- **Elements:** the mode switch with "Sessions" selected (SCR-08); "All sessions"; the groups in this order, an empty one not drawn, each heading with its count after its label: "Needs you: N", "Running: N", "Waiting for a limit reset: N", "Ended in the last 24 hours: N" (folded by default, the fold remembered); one row per session: line 1 the project (folder name), line 2 "<coding agent> · <account> · <handed over | after a limit reset | started by Switchboard | opened here> · <time>"; Settings and Collapse sidebar at the foot as in the Agents mode
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | the first read of the session list | none | "Reading sessions…" under All sessions |
  | empty | no session known | none | All sessions alone; no group |
  | success | sessions listed | none | the groups and rows; a new hand-over adds a row and never switches the mode |
  | rail | the sidebar folded (SCN-047) | none | the switch as two icons; one entry per session with a state mark and the project's initials, named in a tooltip |
  | error | Switchboard did not answer | none | the rows read before stay; All sessions carries the not-answering line (SCR-13) |
- **Coverage:** none yet (dossier node S3)
- **Scenarios:** SCN-077, SCN-078, SCN-082, SCN-083, SCN-084
- **Status:** designed

### SCR-13: All sessions
- **Used by:** SCN-069, SCN-075, SCN-078, SCN-079, SCN-081, SCN-082, SCN-083, SCN-084
- **Purpose:** ST-023: what each session is, where it came from and what it needs, each with its actions
- **Elements:** title "All sessions"; the one-time note (SCN-079) with "Set up hand-overs" and "Got it"; the same groups as SCR-12, as cards: the project, the second line of SCR-12, the state in words ("Running", "Running in Terminal", "Did not continue; its process is still running", a could-not-open reason, "Continues at about <time>", "Ended at <time>", "Closed after 30 idle minutes", "Ended by you", "Not continued: you declined") and the state's actions (End, Show in Finder, Show in Terminal, Open console, Continue now on another account, Do not continue, Continue or New session here, Remove); "Clear" on the Ended group; the footnote "Sessions started in a terminal without Switchboard are not listed."
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | the first read | none | "Reading sessions…" |
  | empty | no session | none | "No coding sessions yet. A session you start in an agent's console, or one Switchboard starts or hands over, appears here." |
  | success | sessions listed | none | groups of cards with their actions; a card opens its page (SCR-14) |
  | partial | Switchboard is not installed | none | this app's console sessions only, with "Switchboard is not installed, so only sessions started in this app's consoles are listed." |
  | error | Switchboard did not answer on the last read | none | "Switchboard did not answer just now, so sessions it runs may be missing. Checked at <time>." above the groups read before |
- **Coverage:** none yet (dossier node S3)
- **Scenarios:** SCN-069, SCN-075, SCN-078, SCN-079, SCN-081, SCN-082, SCN-083, SCN-084
- **Status:** designed

### SCR-14: Session page
- **Used by:** SCN-066, SCN-069, SCN-075, SCN-080, SCN-081, SCN-082, SCN-083, SCN-084, SCN-085
- **Purpose:** ST-023, ST-019: one session as a page of its own, with its console filling it
- **Layout:** a header one or two lines high, then the console (SCR-10) filling the rest of the main area to the window's bottom edge; no drawer, no fold, no collapse; nothing on the page navigates away by itself
- **Elements:** header: the project as the title, the state in words, the origin chip ("Handed over by Switchboard after a limit on <account>, <time>", "Handed over by Switchboard, <time>", "Continued after a limit reset, <time>", "Started by Switchboard, <time>", "Opened here, <time>"), "Account: <account>", "Context: personal" or "Context: <organization>" when Switchboard names one, the coding agent, the folder (shortened, full on hover), the state's actions on the right (as SCR-13); the console; under the terminal while it has focus, "To leave the terminal, press Esc, then Tab."; the End question ("End this session?", Cancel focused, "End session")
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | the session runs in this app's console | none | the console full height, following the scheme and theme live |
  | terminal | it runs in a Terminal window Switchboard opened | none | no console; "This session runs in a Terminal window that Switchboard opened. Type to it there." |
  | empty | an ended session after the app restarted | none | "What this session printed is not kept after the app restarts." with Continue and Remove |
  | error | the console cannot start (SCN-063), the session cannot be ended, or the continue is refused | none | the reason in the console's place or beside the action; the state's actions stay |
  | gone | the session left the list while open | none | All sessions opens instead (UX-18) |
- **Coverage:** none yet (dossier node S3)
- **Scenarios:** SCN-066, SCN-069, SCN-075, SCN-080, SCN-081, SCN-082, SCN-083, SCN-084, SCN-085
- **Status:** designed

### SCR-15: Connections → Sessions stopped on a limit
- **Used by:** SCN-075 (before 0.8.0)
- **Purpose:** the stops Switchboard records, under the Connections page, each with its verdict and Open
- **Elements:** "Sessions stopped on a limit N"; per stop its folder, the agent, when it stopped, the verdict sentence and Open
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | stops recorded | none | one row per stop |
- **Coverage:** src/renderer/components/ConnectionsMap.tsx
- **Scenarios:** SCN-075 (before 0.8.0)
- **Status:** retired (2026-10-24, operator review: stops lived apart from the hand-overs they turn into (SES-07); from 0.8.0 they are in the Sessions mode, SCR-12 and SCR-13, under Waiting for a limit reset or Needs you)
