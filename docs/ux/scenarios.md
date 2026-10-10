<!-- Managed with super-ux (ux-contract v4). Update in the same change as any user-facing behavior change. -->

# Fabric Dashboards — scenarios

## Index

| ID | Title | Feature | Persona | Traces | Status | Last audit |
|----|-------|---------|---------|--------|--------|------------|
| SCN-001 | First launch finds installed services | discovery | P-01 | ST-001 | draft | 2026-10-06 |
| SCN-002 | First launch with no service installed | discovery | P-01 | ST-001 | draft | 2026-10-06 |
| SCN-003 | A service is installed or removed while the app runs | discovery | P-01 | ST-001 | draft | 2026-10-06 |
| SCN-004 | A descriptor is invalid | discovery | P-01 | ST-001, ST-004 | draft | 2026-10-06 |
| SCN-005 | Overview when everything is ready | overview | P-01 | ST-002 | draft | 2026-10-06 |
| SCN-006 | Overview lists what needs attention | overview | P-01 | ST-002 | draft | 2026-10-06 |
| SCN-007 | Restart a service that is down | control | P-01 | ST-003 | draft | 2026-10-06 |
| SCN-008 | Restart does not bring the service back | control | P-01 | ST-003 | draft | 2026-10-06 |
| SCN-009 | Stop a service so it stays off | control | P-01 | ST-003 | draft | 2026-10-06 |
| SCN-010 | Start a stopped service | control | P-01 | ST-003 | draft | 2026-10-06 |
| SCN-011 | Two copies of one service | health | P-01 | ST-004 | draft | 2026-10-06 |
| SCN-012 | Another program answers on the service's port | health | P-01 | ST-004 | draft | 2026-10-06 |
| SCN-013 | Two services claim one port | health | P-01 | ST-004 | draft | 2026-10-06 |
| SCN-014 | Open a dashboard inside the app, signed in | dashboards | P-01 | ST-005 | draft | 2026-10-06 |
| SCN-015 | Dashboard view keeps its place | dashboards | P-01 | ST-005 | draft | 2026-10-06 |
| SCN-016 | Dashboard cannot sign in | dashboards | P-01 | ST-005 | draft | 2026-10-06 |
| SCN-017 | Catch up in Activity | activity | P-01 | ST-006 | draft | 2026-10-06 |
| SCN-018 | Activity when a service's feed cannot be read | activity | P-01 | ST-006 | draft | 2026-10-06 |
| SCN-019 | Notification when a service goes down and comes back | notifications | P-01 | ST-007 | draft | 2026-10-06 |
| SCN-020 | Notification from a service event opens the item | notifications | P-01 | ST-007, ST-006 | draft | 2026-10-06 |
| SCN-021 | Update a service | updates | P-01 | ST-008 | draft | 2026-10-06 |
| SCN-022 | The app updates itself | updates | P-01 | ST-008 | draft | 2026-10-07 |
| SCN-023 | Glance from the menu bar | tray | P-01 | ST-009 | draft | 2026-10-07 |
| SCN-024 | Settings: launch at login, notifications, quiet hours | settings | P-01 | ST-010, ST-007 | draft | 2026-10-07 |
| SCN-025 | Run doctor and read logs | control | P-01 | ST-003 | draft | 2026-10-06 |
| SCN-026 | Open a service page from a link an agent handed over | links | P-01 | ST-011, ST-005 | draft | 2026-10-06 |
| SCN-027 | A link that cannot be opened | links | P-01 | ST-011 | draft | 2026-10-06 |
| SCN-028 | An agent reads and administers services through MCP | agents | P-01 | ST-012, ST-003 | draft | 2026-10-06 |
| SCN-029 | Open a service from Fabric's agent registry | links | P-01 | ST-011, ST-005, ST-003 | draft | 2026-10-06 |
| SCN-030 | Online services appear in their own group | overview | P-01 | ST-013, ST-002 | draft | 2026-10-06 |
| SCN-031 | Open an online service's dashboard, signed in | dashboards | P-01 | ST-013, ST-005 | draft | 2026-10-06 |
| SCN-032 | An online service that cannot be reached says why | health | P-01 | ST-013, ST-004 | draft | 2026-10-06 |
| SCN-033 | Several instances of one agent read as one agent | products | P-01 | ST-014, ST-002 | draft | 2026-10-06 |
| SCN-034 | Switch between an agent's connections | products | P-01 | ST-014, ST-005 | draft | 2026-10-06 |
| SCN-035 | A connection fails while the agent is fine | products | P-01 | ST-014, ST-002, ST-004 | draft | 2026-10-06 |
| SCN-036 | See what every agent spent | spend | P-01 | ST-015 | draft | 2026-10-07 |
| SCN-037 | A cost that is not known reads as unknown | spend | P-01 | ST-015 | draft | 2026-10-06 |
| SCN-038 | An agent's spend cannot be read | spend | P-01 | ST-015, ST-004 | draft | 2026-10-06 |
| SCN-039 | Reload and move through an embedded dashboard | dashboards | P-01 | ST-016, ST-005 | draft | 2026-10-09 |
| SCN-040 | Copy a dashboard page's address or app link | dashboards | P-01 | ST-016, ST-011 | draft | 2026-10-06 |
| SCN-041 | Overview at a glance | overview | P-01 | ST-016, ST-002, ST-015 | draft | 2026-10-06 |
| SCN-042 | Many problems stay compact | overview | P-01 | ST-016, ST-002 | draft | 2026-10-06 |
| SCN-043 | Reinstall picks up where I left off | settings | P-01 | ST-017, ST-010 | draft | 2026-10-06 |
| SCN-044 | A copy outside Applications moves itself so it can update | updates | P-01 | ST-017, ST-008 | draft | 2026-10-06 |
| SCN-045 | A dashboard hands me to another agent | dashboards | P-01 | ST-005, ST-011 | draft | 2026-10-06 |
| SCN-046 | The dashboard gets the screen: a one-line header that opens to the full card | focus | P-01 | ST-018 | validated | 2026-10-06 |
| SCN-047 | The agents list folds into a rail | focus | P-01 | ST-018 | validated | 2026-10-06 |
| SCN-048 | Open an agent's console beside its dashboard | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-049 | Start a runtime in the agent's repository | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-050 | A folder bound to a Switchboard project runs on that project's account | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-051 | The app watches contract and skill versions | estate | P-01 | ST-008, ST-017 | draft | 2026-10-07 |
| SCN-052 | Fabric Dashboards on Windows or Linux | platform | P-01 | ST-001, ST-008 | draft | 2026-10-10 |
## Personas

Defined in [foundation.md](foundation.md) → P-01.

Language: the interface follows the Mac's language — English or Russian — from the
first release (`FD_TEST_LANG=ru` walks the Russian interface in a development run); every sentence a service writes is shown as the service wrote it. Reasons the app derives through the shared package (descriptor problems, token refusals, feed and link errors) stay in English in both languages until FD-19; the app's own sentences, Spend's reasons included, follow the language.

## discovery

### SCN-001: First launch finds installed services
- **Persona:** P-01
- **Feature:** discovery
- **Traces:** ST-001 (JTBD-01, JRN-01/#1)
- **Entry point:** first launch of the app; descriptors exist in the services directory
- **Preconditions:** at least one service is installed and running
- **Steps:**
  1. User opens Fabric Dashboards for the first time -> system shows the window with the sidebar and Overview, a "Looking for services…" line while it reads the services directory
  2. System reads every descriptor and probes each service -> each agent appears in the sidebar and as a card with its state, name and version within 5 seconds; a second instance of one agent appears inside that agent, and where it is named alone it carries its instance ("Example Agent · preview", SCN-033)
  3. User looks at the menu bar -> system shows the Dashboards icon with the aggregate state
  4. Above Overview, the app asks once: "Open Fabric Dashboards when you log in?" with Open at login and Not now -> either answer is kept, the card is gone, and Settings shows the choice (SCN-024)
- **Expected result:** every installed service is listed with its real state without any setup
- **Alt paths:** a service is installed but its launchd job is off -> it appears as "Off"; its page offers Start (SCN-010); a service not yet probed reads "Starting", never Off
- **UI elements:** window, sidebar service list, Overview cards, loading line, menu bar icon
- **States covered:** loading, success
- **Errors & recovery:** services directory unreadable -> Overview shows "Cannot read the services folder: <reason>" with the path and Retry
- **Status:** draft
- **Coverage:** src/core/monitor.ts, packages/service-host/src/descriptor.ts, src/renderer/components/Overview.tsx, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-002: First launch with no service installed
- **Persona:** P-01
- **Feature:** discovery
- **Traces:** ST-001 (JTBD-01, JRN-01/#1)
- **Entry point:** first launch; services directory empty or absent
- **Preconditions:** none
- **Steps:**
  1. User opens the app -> system shows Overview with an empty state: "No services yet", one sentence on how a service joins (its installer writes a descriptor), and the services folder path
  2. User chooses "Show folder" -> system reveals the folder in Finder, creating it first if absent
- **Expected result:** the operator knows the app works and what makes a service appear
- **Alt paths:** a descriptor appears later -> SCN-003
- **UI elements:** empty state, "Show folder" button, "How a service joins" (opens the fabric-agent-adapter guide in the browser)
- **States covered:** empty
- **Errors & recovery:** Finder cannot open the folder -> "Could not open <path>: <reason>" below the buttons
- **Status:** draft
- **Coverage:** src/renderer/components/Overview.tsx
- **Product:** unobserved

### SCN-003: A service is installed or removed while the app runs
- **Persona:** P-01
- **Feature:** discovery
- **Traces:** ST-001 (JTBD-01, JRN-01/#1)
- **Entry point:** app running
- **Preconditions:** none
- **Steps:**
  1. An installer writes a new descriptor -> within 5 seconds the service appears in the sidebar and Overview, and Activity gains "<Service> was installed"
  2. An uninstaller removes a descriptor -> within 5 seconds the service leaves the list; if its view was open the app returns to Overview; Activity gains "<Service> was removed"
- **Expected result:** the list always matches the services directory without restarting the app
- **Alt paths:** a descriptor is rewritten (reinstall) -> the service keeps its place and view; the card updates
- **UI elements:** sidebar, Overview cards, Activity rows
- **States covered:** success
- **Errors & recovery:** a half-written file shows as Invalid ("the file cannot be read as JSON: …") until it parses, and Activity may record it as installed (U-16, later); nothing else can fail visibly beyond SCN-004
- **Status:** draft
- **Coverage:** src/core/monitor.ts, test/monitor.test.ts
- **Product:** unobserved

### SCN-004: A descriptor is invalid
- **Persona:** P-01
- **Feature:** discovery
- **Traces:** ST-001, ST-004 (JTBD-02, JRN-01/#3)
- **Entry point:** a descriptor that fails the fabric-service/0.1 rules
- **Preconditions:** none
- **Steps:**
  1. System reads the descriptor -> the service appears with state "Invalid" and the first problem as a sentence (for example "origin must be http://127.0.0.1:<port>")
  2. User opens it -> system shows every problem and the file path with "Show file"; no probe, token read or control is attempted
- **Expected result:** a broken installation is visible and explained, never silently skipped
- **UI elements:** Invalid badge, problem list, "Show file" button
- **States covered:** error
- **Errors & recovery:** the operator fixes or reinstalls; the state clears within 5 seconds of a valid rewrite
- **Status:** draft
- **Coverage:** packages/service-host/src/descriptor.ts, packages/service-host/src/state.ts, test/monitor.test.ts, packages/service-host/test/descriptor.test.ts
- **Product:** unobserved

## overview

### SCN-005: Overview when everything is ready
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-002 (JTBD-01, JRN-01/#2)
- **Entry point:** Overview
- **Preconditions:** every service answers ready
- **Steps:**
  1. User opens Overview -> system shows one card per service: state dot and word, name, version and short commit, uptime, what the agent is for (the descriptor's one-line summary, at most two lines), up to six summary tiles, the latest event sentence with its time
  2. User chooses a card -> system opens that service's view (SCN-014)
- **Expected result:** the state of every service is readable in one screen; no Needs attention block is shown
- **UI elements:** service cards, state dot and label, the agent's one-line summary, tiles, latest event line, header count "7 services" (one per agent, ADR-0012)
- **States covered:** loading, success
- **Errors & recovery:** nothing can fail on this screen itself; per-service failures are SCN-006
- **Status:** draft
- **Coverage:** src/renderer/components/Overview.tsx, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-006: Overview lists what needs attention
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-002 (JTBD-01, JRN-01/#2)
- **Entry point:** Overview
- **Preconditions:** at least one service is down, degraded, duplicated, foreign, conflicting, invalid, has an attention tile, or has an update
- **Steps:**
  1. User opens Overview -> system shows Needs attention above the cards, most severe first: one single-line row per problem with its state, the name, the reason cut to the line ("Not answering since 17:02.") and its one action (Restart for a local service that is down or runs twice, "Update to 0.2.1" when the service declares an update command, Open otherwise; Logs after a failed action); while the action runs the row shows its progress ("Restarting…"); more than three rows wait behind "Show all" (SCN-042)
  2. User chooses the action -> system performs it (SCN-007, SCN-011, SCN-021); the row leaves when the problem clears, and a failed action keeps its row, with the failure sentence and Logs, for 30 minutes
- **Expected result:** problems are the first thing read, each with its next action
- **Alt paths:** a degraded service lists its reasons with Open, when the fix is inside the service ("Collector: last ran 3 days ago"); an online service never offers Restart — its platform supervises it
- **UI elements:** Needs attention block, problem rows, action buttons (each names its service for a screen reader), the problem count on Overview in the sidebar (not answering, two copies, wrong program, conflict, invalid)
- **States covered:** error, success
- **Errors & recovery:** the action fails -> the row keeps its place with the failure sentence and Logs
- **Status:** draft
- **Coverage:** packages/service-host/src/state.ts (attentionRank), src/renderer/components/Overview.tsx
- **Product:** unobserved

## control

### SCN-007: Restart a service that is down
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** Needs attention row or service view header (the tray menu opens the service view)
- **Preconditions:** the service is managed by launchd
- **Steps:**
  1. User chooses Restart -> the header and the Needs attention row show "Restarting…", the state reads Starting, and Restart, Stop, Update and Doctor are disabled; a second click is refused ("<Service> is busy with another action…")
  2. System asks launchd to restart the job and probes until the service answers as itself with a new pid -> state becomes Ready (or Degraded with reasons); Activity gains "<Service> restarted (pid 5542)"
- **Expected result:** the service answers again, started by launchd, and the result is stated
- **Alt paths:** the job was not loaded -> system enables and loads it first, then waits; the page of the restarted service offers "The service restarted." with Reload
- **UI elements:** Restart button, progress label, state badge, Activity row
- **States covered:** loading, success, error
- **Errors & recovery:** see SCN-008
- **Telemetry:** none — the app sends nothing off the Mac
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/core/launchd.ts, test/monitor.test.ts
- **Product:** unobserved

### SCN-008: Restart does not bring the service back
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** after SCN-007 step 1
- **Preconditions:** the service fails to answer within 40 seconds
- **Steps:**
  1. System reaches the 40 s limit -> the control stops, the state follows the next probe, and the header and the Needs attention row say "<Service> did not come back within 40 s." with Logs when the service declares log files; Doctor stays in the header when declared
  2. User chooses Logs -> system shows the tail of the service's declared log files (SCN-025)
- **Expected result:** the operator knows the restart failed and where to look; nothing keeps spinning
- **UI elements:** failure message, Logs button, Doctor button
- **States covered:** error
- **Errors & recovery:** launchctl itself refuses -> "launchctl refused: <its message>"
- **Status:** draft
- **Coverage:** src/core/monitor.ts
- **Product:** unobserved

### SCN-009: Stop a service so it stays off
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** service view header (the tray menu opens the service view)
- **Preconditions:** the service is managed by launchd and running or not answering
- **Steps:**
  1. User chooses Stop -> system asks to confirm: "Stop <Service>?" — "It stays off, also after the Mac restarts, until you start it. Agents that use it will get no answer." with Cancel (focused) and Stop
  2. User confirms -> system unloads and disables the job and waits until it no longer answers -> state becomes Off; Activity gains "<Service> stopped by you"
- **Expected result:** the service is off and stays off across logins
- **Alt paths:** user cancels (Cancel, or Escape wherever focus is) -> nothing changes and focus returns to Stop; the service disappears while the dialog is open -> the dialog closes
- **UI elements:** Stop button, confirmation dialog with Stop and Cancel (focus stays in it while it is open; after Stop it moves to the service's name), Off badge
- **States covered:** loading, success, error
- **Errors & recovery:** still answering after 40 s -> "<Service> is still answering; another copy may run outside launchd." with Logs when declared
- **Status:** draft
- **Coverage:** src/core/launchd.ts, src/renderer/App.tsx, test/monitor.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-010: Start a stopped service
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** Off service in Overview or the sidebar, its service view header (the tray menu opens the service view)
- **Preconditions:** the service is Off
- **Steps:**
  1. User chooses Start -> system enables and loads the job, "Starting…"
  2. System waits until the service answers as itself -> state becomes Ready; Activity gains "<Service> started by you"
- **Expected result:** the service runs under launchd again and will come back after a reboot
- **UI elements:** Start button, progress label, state badge
- **States covered:** loading, success, error
- **Errors & recovery:** no answer in 40 s -> as SCN-008; plist missing -> "The launchd file is missing: reinstall <Service>. (<path>)"
- **Status:** draft
- **Coverage:** src/core/launchd.ts, test/monitor.test.ts
- **Product:** unobserved

### SCN-025: Run doctor and read logs
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** service view → Health or Logs tab; SCN-008 buttons
- **Preconditions:** the descriptor declares a doctor command or log files
- **Steps:**
  1. User opens Logs -> system shows the last 300 lines of each declared log file, newest at the bottom, refreshed while visible
  2. User chooses Doctor -> system runs the declared command (no shell), switches to Health and shows "Running doctor…", then "Doctor finished with exit code <n>." and its output
- **Expected result:** the operator sees why a service misbehaves without a terminal
- **Alt paths:** no doctor declared -> the button is absent; no logs declared -> "This service declares no log files."
- **UI elements:** Logs tab, log panes, Doctor button, output panel
- **States covered:** loading, empty, success, error
- **Errors & recovery:** the command times out after 120 s -> "Doctor did not finish within 120 s." and the partial output; the command cannot start -> "Doctor could not run: <reason>"; the service is busy with another action -> "<Service> is busy with another action…"; a log file is unreadable -> "Cannot read <path>: <reason>"; an online service has no Logs tab
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/renderer/components/ServiceView.tsx
- **Product:** unobserved

## health

### SCN-011: Two copies of one service
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004 (JTBD-02, JRN-01/#3)
- **Entry point:** any screen
- **Preconditions:** the pid answering on the port differs from launchd's pid for the job
- **Steps:**
  1. System probes -> state becomes "Two copies"; Needs attention: "Two copies: pid 4412 answers, launchd runs pid 5542." with Restart; a notification "<Service> runs twice" says the same; Activity gains "<Service> runs as two copies (pid 4412 and pid 5542)."
  2. User chooses Restart -> system restarts the launchd job and waits for a new pid; if the stray copy still holds the port: "<Service> did not take over: pid 4412, outside launchd, still holds port 47187. Stop that process, then restart."
- **Expected result:** a duplicate is named with both pids and resolved or handed to the operator
- **UI elements:** Two copies badge, attention row, Restart button
- **States covered:** error, success
- **Errors & recovery:** the app never kills a process it did not start through launchd
- **Status:** draft
- **Coverage:** packages/service-host/src/state.ts, src/core/monitor.ts, test/core.test.ts
- **Product:** unobserved

### SCN-012: Another program answers on the service's port
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004 (JTBD-02, JRN-01/#3)
- **Entry point:** any screen
- **Preconditions:** the well-known answer names another id or instance, or the port answers without the protocol
- **Steps:**
  1. System probes -> state becomes "Wrong program on port", with "Port 47187 answers as maker.default, not as this service. Nothing is sent to it." or "Port 47187 answers without fabric-service/0.1 (<detail>). Nothing is sent to it."; a notification "Wrong program on <Service>'s port"
  2. User opens the service -> it opens on Health; the Dashboard tab says "The dashboard opens when the service answers as itself."; no token is sent, and no version, tiles, tools or update of the other program are shown as the service's (S-5); Spend never reads it (S-1)
- **Expected result:** the operator knows the port is taken by another program and nothing is sent to it
- **UI elements:** "Wrong program on port" badge, reason line, Dashboard tab notice
- **States covered:** error
- **Errors & recovery:** resolved when the port answers as the service again
- **Status:** draft
- **Coverage:** packages/service-host/src/state.ts, test/monitor.test.ts, test/flap.test.ts
- **Product:** unobserved

### SCN-013: Two services claim one port
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004 (JTBD-02, JRN-01/#3)
- **Entry point:** any screen
- **Preconditions:** two descriptors declare the same port
- **Steps:**
  1. System reads descriptors -> both services show "Port conflict": "Port 47187 is also claimed by <other key>. One of them has to move."
  2. User opens either -> the view shows "Show file" and "Show the file of <other>"; Restart is disabled
- **Expected result:** the conflict is visible before anything answers wrongly
- **UI elements:** "Port conflict" badge, both names, "Show file" and "Show the file of <other>" buttons
- **States covered:** error
- **Errors & recovery:** clears when one descriptor is rewritten with another port
- **Status:** draft
- **Coverage:** packages/service-host/src/descriptor.ts (claimConflicts), src/renderer/components/ServiceView.tsx, test/monitor.test.ts
- **Product:** unobserved

## dashboards

### SCN-014: Open a dashboard inside the app, signed in
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a card, a sidebar row, an Activity row or a notification
- **Preconditions:** the service is Ready or Degraded and declares a dashboard
- **Steps:**
  1. User chooses the service -> system shows the service view: header (state, what the agent is for, version and commit, pid, uptime, port, its Tools — the MCP capabilities it serves, eight shown and "+N more" — and controls) and the Dashboard tab with "Opening…"
  2. When the dashboard needs a login, system obtains a one-time code with the service token and opens it -> the service's own page appears, signed in
- **Expected result:** the agent's dashboard is usable in the app without a browser or a password, and no token is visible anywhere
- **Alt paths:** the dashboard declares no login -> it opens directly; the service declares no dashboard -> the view opens on Health and the Dashboard tab says "This service has no dashboard."; the service is not ready or degraded -> "The dashboard opens when the service answers as itself."
- **UI elements:** service view header, tabs Dashboard / Activity / Health / Logs, embedded page, loading line
- **States covered:** loading, success, error
- **Errors & recovery:** see SCN-016; a link inside the page to another agent opens that agent here (SCN-045); a link to any other site asks "Open in your browser?" — "<address> is outside this service. It opens in your default browser." with Open in browser and Cancel
- **Status:** draft
- **Coverage:** src/electron/views.ts, src/electron/policy.ts, src/renderer/components/ServiceView.tsx (Tools), test/viewslot.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-045: A dashboard hands me to another agent
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005, ST-011 (JTBD-04, JRN-01/#5); ADR-0016
- **Entry point:** a link or button inside one agent's embedded dashboard that points at another agent: "Approve in Growth", "Open in Analytics agent"
- **Preconditions:** both agents are installed; the link is `fabric-dashboards://service/<id.instance>?path=…`, or the other agent's own address (`http://127.0.0.1:<port>/…` or its registered `https` origin)
- **Steps:**
  1. User clicks the link -> the app checks it against the installed descriptors, switches to the other agent's page and opens the path, signed in with that agent's own session
  2. User goes back in the sidebar to the first agent -> its dashboard is still on the page it was on
- **Expected result:** moving between agents is one click, inside the app, each with its own sign-in
- **Alt paths:** the link opens a new window (`target=_blank`, `window.open`) -> the same; a new window on the agent's own origin opens in its view
- **UI elements:** the other agent's service view and dashboard
- **States covered:** success, error
- **Errors & recovery:** the link names no installed agent or a path off its origin -> "This link cannot be opened" with the reason, nothing opens (SCN-027); the other agent is stopped -> its page opens on Start (SCN-010); a link to an unknown site -> the browser question of SCN-014
- **Status:** draft
- **Coverage:** src/electron/policy.ts (routeLink), src/electron/views.ts, src/electron/main.ts, test/parts.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-015: Dashboard view keeps its place
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a service view already opened once
- **Preconditions:** none
- **Steps:**
  1. User switches to another service and back -> system shows the same page, scrolled and filled as it was; a link from a notification or another agent is applied once, so a tab switch afterwards keeps the page the person moved to
  2. The service restarts -> above the page, with the toolbar still there: "The service restarted." with Reload; Reload signs in again once and reopens the same page; an HTTP failure shows Retry (SCN-039)
- **Expected result:** one live view per service, never duplicated
- **UI elements:** embedded page, "The service restarted." bar above it
- **Alt paths:** the session ended while the page was open (the service answers 401) -> the app signs in again by itself, once a minute at most, and reopens the same page (ADR-0014); the window stays hidden for 5 minutes -> every dashboard is released, and showing the window again reopens the one that was on screen, on its page
- **States covered:** success
- **Errors & recovery:** the page crashes -> the app recreates it once (again after every page that loads), then shows "The page stopped." with Reload
- **Status:** draft
- **Coverage:** src/electron/views.ts, src/electron/policy.ts (ViewSlot, resumePath), src/renderer/components/ServiceView.tsx (DashboardHost), test/viewslot.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-016: Dashboard cannot sign in
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** SCN-014 step 2
- **Preconditions:** the token file cannot be read, the service refuses a login code, or the page does not load
- **Steps:**
  1. System fails to get a login code -> the tab shows "Cannot sign in to <Service>: <reason>" (for example "the token file is readable by others; set mode 0600") and the token file path
- **Alt paths:** the page itself does not load -> "The page of <Service> could not load: <reason>" with Retry and no token path; the reason is the error's name, never the address it loaded (S-3)
- **Expected result:** the reason and the file to fix are named; the app never falls back to a URL carrying a secret
- **UI elements:** sign-in error panel, path, Retry
- **States covered:** error
- **Errors & recovery:** Retry signs in again and shows the page again (R-6); Doctor when declared
- **Status:** draft
- **Coverage:** src/renderer/components/ServiceView.tsx, src/core/probe.ts
- **Product:** unobserved

## activity

### SCN-017: Catch up in Activity
- **Persona:** P-01
- **Feature:** activity
- **Traces:** ST-006 (JTBD-03, JRN-01/#4)
- **Entry point:** sidebar Activity, with an unread count
- **Preconditions:** services published events
- **Steps:**
  1. User opens Activity -> system shows all events newest first, grouped by day: time, service, level marker, the sentence; the app's own events ("Runner stopped answering") included
  2. User filters by service or level (All levels, Notice and above, Warnings and errors, Errors) -> the list narrows immediately; the filter is kept between visits, and new rows — the app's own included — appear while the page is open
  3. User chooses an event with a link -> system opens that service's view at the link (SCN-014)
- **Expected result:** everything the agents did is readable in one place and the unread count clears
- **Alt paths:** no events yet -> "Nothing has happened yet. Events appear here as your services work."; the session ended while the page was open (the service answers 401) -> the app signs in again by itself, once a minute at most, and reopens the same page (ADR-0014)
- **UI elements:** Activity list, day headers, service and level filters (labelled Service and Level), unread count (notice, warning and error rows since the page was last open; reading marks new rows seen)
- **States covered:** loading, empty, success
- **Errors & recovery:** see SCN-018
- **Status:** draft
- **Coverage:** src/core/activity.ts, src/renderer/components/Activity.tsx, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-018: Activity when a service's feed cannot be read
- **Persona:** P-01
- **Feature:** activity
- **Traces:** ST-006 (JTBD-03, JRN-01/#4)
- **Entry point:** Activity
- **Preconditions:** one service's events feed fails while the service answers (the token refused, an HTTP error, a malformed page, an unreadable token file); a service that does not answer shows no line — its state says why
- **Steps:**
  1. System shows the feed -> other services' events are shown; a line at the top says "Store Agent's activity is unavailable: <reason>"
- **Expected result:** one broken feed never hides the others
- **UI elements:** partial-failure line
- **States covered:** error, success
- **Errors & recovery:** the line clears when the feed reads again; events resume from the stored cursor, none are duplicated
- **Status:** draft
- **Coverage:** src/renderer/components/Activity.tsx, src/core/monitor.ts
- **Product:** unobserved

## notifications

### SCN-019: Notification when a service goes down and comes back
- **Persona:** P-01
- **Feature:** notifications
- **Traces:** ST-007 (JTBD-03, JRN-01/#3)
- **Entry point:** app running in the background
- **Preconditions:** notifications on for the service; not in quiet hours
- **Steps:**
  1. A service stops answering: three probes in a row fail and a probe still fails after 60 s of silence -> one notification: "<Service> is not answering"
  2. User clicks it -> the app opens the service view
  3. The service answers again -> one notification: "<Service> is back" — "After 2 min."
- **Expected result:** the operator learns about an outage and its end once each
- **Alt paths:** the service returns before a failed probe confirms 60 s of silence -> no notification, neither down nor back; Activity records it. One slow answer under load (a probe waits 5 s) changes nothing ([ADR-0008](../adr/0008-a-missed-probe-is-not-an-outage.md))
- **UI elements:** macOS notifications
- **States covered:** success
- **Errors & recovery:** none in the app: whether macOS shows notifications is set in System Settings → Notifications, and Settings says so with "Open macOS Settings" (the app cannot read that permission); an online service's notification says its platform runs it
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/core/notify.ts, test/monitor.test.ts, test/flap.test.ts
- **Product:** unobserved

### SCN-020: Notification from a service event opens the item
- **Persona:** P-01
- **Feature:** notifications
- **Traces:** ST-007, ST-006 (JTBD-03, JRN-01/#4)
- **Entry point:** app running
- **Preconditions:** a service publishes an event with notify true
- **Steps:**
  1. System reads the event; it is a question (`*.awaiting_*`, `*.approval_*`, `human_step.opened`), a failure (level error) or a warning -> a notification: the title names the agent and its instance when it is not the default ("Example Agent · preview"), the subtitle says what it wants ("Needs your decision", "Failed", "Needs attention"), the body is the event sentence
  2. User clicks it -> the app opens the service view at the event's link
- **Expected result:** one click reaches the exact item; the operator is interrupted only when an agent needs them or something went wrong
- **Alt paths:** several such events in one read from one service -> one notification "3 need you · needs your decision" that opens Activity filtered to that service (the filter is kept)
- **UI elements:** macOS notification, service view
- **States covered:** success
- **Errors & recovery:** the link no longer exists in the service -> the service's own page shows its not-found state; nothing can fail in the app
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/core/notify.ts, src/electron/main.ts, test/monitor.test.ts, test/notify.test.ts
- **Product:** unobserved

## updates

### SCN-021: Update a service
- **Persona:** P-01
- **Feature:** updates
- **Traces:** ST-008 (JTBD-01, JRN-01/#6)
- **Entry point:** Needs attention row or service view header showing "Update to 0.2.1" (a degraded service too: the update may be the fix)
- **Preconditions:** the service reports an available version and declares an update command
- **Steps:**
  1. User chooses Update -> system runs the command (no shell) and shows on Health "Updating…", then "Update finished with exit code <n>." and its output; from Needs attention it opens the service on Health first; a command that cannot start -> "Update could not run: <reason>"
  2. System re-probes -> the header shows the new version and commit, or the old one with the command's failure
- **Expected result:** the service runs the new build, visibly
- **Alt paths:** no update command declared -> the row says "Version 0.2.1 is available." with Open
- **UI elements:** Update button, output panel, version label
- **States covered:** loading, success, error
- **Errors & recovery:** non-zero exit -> the output stays visible; the service keeps its previous state
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/renderer/components/ServiceView.tsx
- **Product:** unobserved

### SCN-022: The app updates itself
- **Persona:** P-01
- **Feature:** updates
- **Traces:** ST-008, ST-017 (JTBD-01, JRN-01/#6)
- **Entry point:** app running
- **Preconditions:** a newer signed release is published; the app is in Applications
- **Steps:**
  1. System checks 90 s after start and every 6 hours, downloads the release's zip once and verifies it (its SHA256SUMS signed by the organization's key, the zip's hash, the app's signature by team KJ35UYYL22 and its version), then hands the verified file itself to Squirrel through a local feed -> the sidebar footer and Settings → Updates show "Update <version> ready" with Restart to Update
  2. User closes the window and leaves it closed for ten minutes -> the app installs the update and reopens in the menu bar, with no window and no question; services are untouched
  3. User opens the window later -> it is the new version, on the Overview
- **Expected result:** every copy stays current with no action from the person
- **Alt paths:** user chooses Restart to Update while an agent's console or a command runs -> the app names them and asks; Cancel keeps everything running, Restart to Update stops them and installs; user chooses Restart to Update -> a notification says the app reopens by itself and it installs now; the app is opened (by the person, a link or an agent) while the update installs -> it says «Finishing the update to <version> — reopens by itself», steps aside, and reopens when the install has finished and reopens on the Overview (U-18 keeps the screen later); the window stays open -> nothing installs under the person's eyes, and it installs at the next quit or the next ten closed minutes; a doctor or update command is running -> the install waits for it, checked every minute; "Install updates automatically" is off in Settings → Updates -> nothing is checked, downloaded or installed on its own, and Check for updates still works (LC-16; the choice is kept in a file no update, reinstall or uninstall rewrites); the release needs a step from the person -> it is verified but held: "Update <version> is verified and waits for you" with What to do (opens the release's steps) and Install; Settings → Updates → Check now checks at once; the feed names a version that is not newer than the installed one -> nothing installs (F-1)
- **UI elements:** footer update line, Restart to Update button, held line with What to do and Install, Settings → Updates (Install updates automatically, state line, Check now), "Check for updates" in the app menu
- **States covered:** loading, success, error
- **Errors & recovery:** download or signature check fails -> footer "Update failed: <reason>" with Retry, one automatic retry within the hour, and the running app is unchanged; the bundle Squirrel staged is not the verified one -> it is removed before any quit and the footer says so; every step is logged with the organization's update codes (ADR-0015 amendment)
- **Status:** draft
- **Coverage:** src/electron/updater.ts, src/core/release-verify.ts, src/core/autoupdate.ts, src/core/version.ts (mayCheck, stagedRefusal), src/electron/policy.ts (autoInstallNow, relaunchHidden), src/electron/main.ts (auto-install-flow), src/renderer/components/Settings.tsx (UpdateState), scripts/dist-mac.mjs, test/lifecycle.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

## estate

### SCN-051: The app watches contract and skill versions
- **Persona:** P-01
- **Feature:** estate
- **Traces:** ST-008, ST-017 (JTBD-01, JRN-01/#6)
- **Entry point:** app running; Settings → Estate updates
- **Preconditions:** "Watch the contract and skill versions" is on (default)
- **Steps:**
  1. System checks 90 s after start, every 6 hours and 5 s after a settings change: the contract clone named in Settings (the remote's `main` against what the clone has fetched) and the published sshlg-skills version against the installed-version record -> Settings → Estate updates shows the contract state, the clone's own `main`, and which consumer pins (every `fabric-contract.lock.json` beside the clone, Fabric's and Dashboards' fixtures) name an older commit; one retry within the hour after a failure
  2. System finds the clone has not fetched the remote's `main` -> it runs `git fetch origin` only — never pull, reset or rebase — says the commits were fetched, and the pins are reported, never rewritten
  3. User turns on "Update skills by themselves" -> before applying, the app checks that every maintainer and the publisher of that exact version are the expected owner, then runs that version's update in the background and records it; off (default): a newer version is only reported
  4. User turns "Watch the contract and skill versions" off -> nothing runs until it is back on
- **Expected result:** the operator's estate — the contract and the skill family — stays visible, and only the safe steps ever run by themselves
- **Alt paths:** no clone named -> the section says so and no git runs (the skills are still checked); the named folder does not exist -> the section says so; it is not a clone of passioncode-ai/fabric-agent-contract -> the section says so, and only `git remote get-url` ran in it; the sshlg-skills family is not installed on this computer -> the section says so and nothing about it is read or asked (FD-34); the installed version is the family runtime's, whoever updated it; a clone path that is not absolute or `~/` -> the field says it was not saved
- **UI elements:** Settings → Estate updates (watch switch, auto-update skills switch, clone path field, status lines for the contract, the pins and the skills)
- **States covered:** loading, success, error
- **Errors & recovery:** a probe fails -> the section shows "could not be checked", `estate_check failed` is logged with one retry within the hour; the publisher check fails -> the apply is refused, `estate_update refused` is logged, nothing runs; an update that fails -> `estate_update failed` and a failed check, retried within the hour; every check and update is logged in `main.log` with the codes `estate_check` / `estate_update`
- **Status:** draft
- **Coverage:** src/core/estate-update.ts, src/electron/estate-updater.ts, src/electron/main.ts (estate-update), src/renderer/components/Settings.tsx (ClonePath, EstateState), test/estate-update.test.ts
- **Product:** unobserved

## tray

### SCN-023: Glance from the menu bar
- **Persona:** P-01
- **Feature:** tray
- **Traces:** ST-009 (JTBD-01, JRN-01/#2)
- **Entry point:** menu bar icon
- **Preconditions:** app running (window may be closed; while it is closed the app has no Dock icon and lives in the menu bar only)
- **Steps:**
  1. User looks at the icon -> it shows one of three states: calm (nothing degraded, starting or wrong; a service you turned off keeps it calm), something degraded or starting, something down or wrong; the Dock icon, while shown, carries "!" when a service is down or wrong
  2. User clicks it -> the menu starts with a line "Needs attention: 2", "Ready: 5 of 7" or "All services ready", lists problems first, then every service with its state and instance ("● Growth · projection — Ready"); items Open Fabric Dashboards, Pause notifications for 1 hour (Resume notifications while paused; the menu updates when a pause set here or in Settings ends), the line "Quitting Dashboards does not stop your services.", Quit
  3. User chooses a service -> the window opens at its view, and the Dock icon comes back with it
- **Expected result:** the state is known without opening the window
- **UI elements:** menu bar icon, tray menu, service items, Pause notifications item
- **States covered:** success, error
- **Errors & recovery:** nothing can fail in the menu; quitting leaves every service running and the menu says so above Quit — no dialog on the way out, except when an agent's console session or a command the app started is running: then Quit names them and asks (Cancel keeps them; ADR-0017 amendment 2026-10-07)
- **Status:** draft
- **Coverage:** src/electron/tray.ts, src/electron/main.ts (`syncDock`), test/e2e/spend.test.ts
- **Product:** unobserved

## settings

### SCN-024: Settings: launch at login, notifications, quiet hours
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-010, ST-007 (JTBD-03, JRN-01/#7)
- **Entry point:** sidebar Settings
- **Preconditions:** none
- **Steps:**
  1. User opens Settings -> system shows Launch at login (off until the person chooses, on the first-run card or here), Theme, Language (As on this Mac, English, Русский), Updates (SCN-022), Notifications per service with levels, Quiet hours (from–to), the services folder, Uninstall, and Unattributed listeners
  2. User changes a setting -> it applies immediately and is kept across restarts; launch at login is registered with macOS only at this moment, never by a launch or an update
  3. User opens Unattributed listeners -> system lists local ports listening on all interfaces that no descriptor claims, with the program name and pid
  4. User chooses Uninstall Fabric Dashboards… and confirms, leaving "Also delete my settings and activity history" unticked -> the app removes its login item and its entry in Claude Code's MCP servers, moves itself to the Trash and quits; once it has exited, its caches, logs and dashboard sessions are removed, and the settings, the activity history and a note of what to restore stay (SCN-043); services and their data always stay
- **Expected result:** the app fits the operator's day, stray network listeners are visible, and leaving the app removes everything it added without losing what the person set up
- **Alt paths:** user picks Русский (or English) under Language -> the window, the app menu and the tray switch at once, and machine reasons (a descriptor check, a network error) read in that language where they are known — a service's own words (tiles, events) stay as the service wrote them; As on this Mac follows the system language; the person turned the login item off in System Settings -> the next launch shows it off here and does not turn it back on; the person ticks "Also delete my settings and activity history" -> everything the app wrote is removed after it exits, nothing is restored later; settings.json is damaged -> the last good copy is restored and the log says so
- **UI elements:** toggles, Language select, per-service rows, time pickers, folder path with Show, Uninstall button and its confirmation with the delete-data box, listeners list
- **States covered:** empty, success, error
- **Errors & recovery:** macOS refuses the login item -> the toggle returns to off with "macOS refused the login item: <reason>" ("approve Fabric Dashboards in System Settings → General → Login Items" when it needs approval); the listener scan fails -> "Cannot list listeners: <reason>", and nothing listening is "None", not an error; uninstall cannot remove the MCP entry or the login item -> "Nothing was removed: <reason>" and the app stays (a refused login item puts the MCP entry back); the app cannot be moved to the Trash -> it says so and is still uninstalled; Show folder fails -> "Could not open <path>: <reason>"
- **Status:** draft
- **Coverage:** src/renderer/components/Settings.tsx, src/renderer/components/Overview.tsx, src/core/settings.ts, src/core/i18n.ts (chooseLang), src/core/machine-ru.ts, src/core/loginitem.ts, src/core/uninstall.ts, src/core/listeners.ts, test/parts.test.ts, test/lifecycle.test.ts
- **Product:** unobserved

### SCN-043: Reinstall picks up where I left off
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-017, ST-010 (JTBD-03, JRN-01/#7)
- **Entry point:** the app opened for the first time after an uninstall that kept the data, or after the app was dragged to the Trash and installed again
- **Preconditions:** the earlier install had settings, history, launch at login on and the MCP entry registered
- **Steps:**
  1. User installs the app and opens it -> Settings show the earlier theme, notification choices and quiet hours; Activity shows the earlier history
  2. System puts back the login item and the MCP entry the uninstall removed, pointed at this copy -> Settings shows Open at login on; an agent session started now finds the `fabric-dashboards` server
  3. User installed the copy in another folder than before -> an MCP entry still pointing at the old copy is pointed at this one
- **Expected result:** a reinstall needs no setup again
- **Alt paths:** the person added their own `fabric-dashboards` MCP entry meanwhile -> it is kept; a project the entry belonged to is gone -> that entry is not recreated; the data was deleted on purpose -> the app starts fresh, with the first-run card
- **UI elements:** none new (Settings, Activity)
- **States covered:** success, error
- **Errors & recovery:** macOS refuses the login item -> it stays off, the reason is logged, and it is not asked again on every launch; `~/.claude.json` cannot be edited -> the MCP entry is restored at the next launch
- **Status:** draft
- **Coverage:** src/core/uninstall.ts (restore-record, restoreMcpRegistrations, repairMcpRegistrations), src/electron/main.ts (reinstall), src/core/settings.ts, test/lifecycle.test.ts, test/parts.test.ts
- **Product:** unobserved

### SCN-044: A copy outside Applications moves itself so it can update
- **Persona:** P-01
- **Feature:** updates
- **Traces:** ST-017, ST-008 (JTBD-01, JRN-01/#6)
- **Entry point:** the app opened from the disk image, Downloads or any folder other than Applications
- **Preconditions:** a packaged, signed copy
- **Steps:**
  1. User opens the app the first time -> a question: "Move Fabric Dashboards to Applications?" with Move to Applications and Not now
  2. User chooses Move to Applications -> the app moves itself, reopens from Applications, and updates work (SCN-022)
- **Expected result:** a downloaded copy ends up where it can keep itself current
- **Alt paths:** user chooses Not now -> the question is not asked again; the sidebar footer and Settings → Updates say "Updates install only from the Applications folder." with Move to Applications
- **UI elements:** move question, footer line and Settings → Updates notice with Move to Applications
- **States covered:** error, success
- **Errors & recovery:** the move fails -> a message names the reason and says to drag the app to Applications in Finder
- **Status:** draft
- **Coverage:** src/electron/updater.ts (misplaced), src/electron/main.ts (moveToApplications, offerMoveToApplications), src/renderer/App.tsx (UpdateLine), src/renderer/components/Settings.tsx (UpdateState)
- **Product:** unobserved

## links

### SCN-026: Open a service page from a link an agent handed over
- **Persona:** P-01
- **Feature:** links
- **Traces:** ST-011, ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a `fabric-dashboards://service/<id.instance>?path=/…` link (the form the MCP tools hand out; the 0.2.0 forms `open?service=<id.instance>&path=/…` and `open?url=http://127.0.0.1:<port>/…` still open) in a chat, a terminal or another app
- **Preconditions:** Fabric Dashboards is installed; the service is installed
- **Steps:**
  1. User opens the link -> macOS hands it to Fabric Dashboards; if the app was not running it starts, waits for its first scan of the services folder, then continues
  2. System checks the link against the installed descriptors -> the window comes forward on the service view, and its dashboard opens at the path, signed in as in SCN-014
- **Expected result:** the page the agent meant, inside the app, with no second window, no browser tab and no token in any address
- **Alt paths:** a link with no path opens the service's dashboard; `fabric-dashboards://activity` opens Activity; `fabric-dashboards://` opens the overview; the app is not installed -> the agent's own tool opens the plain `http://127.0.0.1` address in the browser instead (SCN-028); `fabric-dashboards://` opens the Overview, whatever page was open
- **UI elements:** service view, embedded dashboard
- **States covered:** loading, success
- **Errors & recovery:** see SCN-027; a dashboard that cannot sign in -> SCN-016
- **Status:** draft
- **Coverage:** src/core/deeplink.ts, src/electron/main.ts, test/deeplink.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-027: A link that cannot be opened
- **Persona:** P-01
- **Feature:** links
- **Traces:** ST-011 (JTBD-04, JRN-01/#5)
- **Entry point:** SCN-026 step 2
- **Preconditions:** the link names no installed service, a key that is not `id.instance` (an encoded character, a capital letter, a third part), something after the key, a parameter other than `path`, a `#fragment` outside `path`, a user, password or port, a path that is not on the service's own origin (`//host`, a full URL, a backslash), a non-local address, or an unknown verb
- **Steps:**
  1. System refuses the link -> the window comes forward and a message says "This link cannot be opened" with the reason (for example `no installed service "x.default"`) and "Nothing was opened."; the `open?service=` and `open?url=` forms refuse an unknown or repeated parameter, `path=` together with `url=`, and a #fragment, as the `service/` form does
- **Expected result:** the operator sees why; a crafted link can never point the signed-in view at another site
- **UI elements:** warning message, OK
- **States covered:** error
- **Errors & recovery:** install or start the service, then open the link again
- **Status:** draft
- **Coverage:** src/core/deeplink.ts, src/electron/main.ts, test/deeplink.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-029: Open a service from Fabric's agent registry
- **Persona:** P-01
- **Feature:** links
- **Traces:** ST-011, ST-005, ST-003 (JTBD-04, JRN-01/#5); Fabric SCN-101, plan row AR-2.5
- **Entry point:** Fabric's agent registry → a service card → Open dashboard, which opens `fabric-dashboards://service/<id>.<instance>`
- **Preconditions:** Fabric Dashboards is installed; the service's descriptor is in the services folder
- **Steps:**
  1. User chooses Open dashboard in Fabric -> macOS hands the link to Fabric Dashboards, running or not (a running app gets it from the second process, which quits)
  2. System checks the key against the installed descriptors -> the window comes forward on that service's view, its dashboard open and signed in as in SCN-014
  3. The service is stopped -> the same view opens, the state reads Off and Start is offered (SCN-010)
- **Expected result:** the service is watched here; Fabric never becomes a second dashboard host
- **Alt paths:** `?path=/…` opens one page of the service, as in SCN-026; Fabric Dashboards is not installed -> nothing reaches the app, and Fabric's card says so and links to the download (Fabric's own scenario)
- **UI elements:** service view, state badge, Start, embedded dashboard
- **States covered:** loading, success, error
- **Errors & recovery:** a service that is not installed, or a malformed or foreign link -> SCN-027 with the reason; nothing opens in a browser tab
- **Status:** draft
- **Coverage:** src/core/deeplink.ts#parseDeepLink, test/deeplink.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

## agents

### SCN-028: An agent reads and administers services through MCP
- **Persona:** P-01
- **Feature:** agents
- **Traces:** ST-012, ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** an agent session with the `fabric-dashboards` MCP server registered (`Contents/Resources/bin/fabric-dashboards-mcp`)
- **Preconditions:** none; the app does not need to be running
- **Steps:**
  1. Agent calls `list_services` or `service_status` -> it receives each service's product, placement, state and reasons (codes), version and build, dashboard address, deep link (open_link), tiles, pending update, declared commands and problems — no token, and nothing of another program that answers a service's port
  2. Agent calls `link` for a job it started -> it receives the deep link as the primary dashboard action and the plain address for diagnostics; `host_status` distinguishes installed/absent/unknown/version/handler; `open` uses the existing host (browser only for confirmed absence with `fallback=if_absent`, never with `fallback=never`)
  3. Agent calls `control` (start, stop, restart), `doctor` or `update` -> the same launchd verbs and descriptor commands as the app run, and the tool returns the result it observed
  4. Agent calls `activity` -> recent events as sentences, each with a deep link when it points at a page
  5. Agent calls `spend` -> each agent's own usage entries (today, 7 and 30 days, per model, budget and every limit with its state; a null cost is unknown, `partial` a lower bound); a service that does not answer, or whose address another program answers, is an error entry — its spend is unknown, never "not reporting"
- **Expected result:** agents hand the operator the exact page and use the app's rules for administration instead of launchctl by hand
- **Alt paths:** an online service or one without launchd lifecycle -> `control` refuses; a missing launchd plist -> `control` refuses before calling launchctl; no declared doctor or update -> the tool refuses; an unknown tool -> a JSON-RPC error (-32602); an argument the tool does not declare -> refused; the app was updated under a running session -> the next call answers stale with both versions, and the server exits; `doctor` and `update` run the service's programs and are not marked read-only
- **UI elements:** none (agent tool results); the opened service view
- **States covered:** success, error
- **Errors & recovery:** installed-host open failure, unknown discovery, incompatible version and wrong handler open no browser; OS acceptance is not page readiness; a restart that gets no new answer within 40 s is reported as not done, with the state it left; a refusal is a tool error the agent reads, not a crash
- **Status:** draft
- **Coverage:** src/mcp/tools.ts, src/mcp/server.ts, test/mcp.test.ts
- **Product:** unobserved

- **Cold-start acceptance:** from the packaged MCP, opening a link while the app is closed launches its graphical host and selected page. The MCP-only Electron RunAsNode flag is not inherited by desktop dispatch. Verify actual page readiness separately from the OS-acceptance receipt.

## online

### SCN-030: Online services appear in their own group
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-013, ST-002 (JTBD-01, JRN-01/#1)
- **Entry point:** Overview, with a remote descriptor in the services directory (`placement: "remote"`, origin `https://…`)
- **Preconditions:** the descriptor's token file is readable (0600, mine)
- **Steps:**
  1. The app reads the descriptor -> the service appears under **Online**, after the local services, with its state badge, version, build and tiles
  2. I read the card -> it names the origin's host, so I know it runs online
  3. I look for start, stop or restart -> there are none: its platform supervises it
- **Expected result:** every agent I run, local or online, on one overview, each in the group that says where it runs
- **Alt paths:** no online service -> the group is not shown; an online service that needs attention also appears in Needs attention, as a local one does
- **UI elements:** Overview → Online group, service card (host line), state badge
- **States covered:** success, empty
- **Errors & recovery:** the token file is missing or readable by others -> the card is Invalid with "The token file cannot be used: <reason>" and the service is never contacted; fix the file and the next scan reads it
- **Status:** draft
- **Coverage:** src/renderer/components/Overview.tsx, packages/service-host/src/descriptor.ts, test/remote.test.ts
- **Product:** unobserved

### SCN-031: Open an online service's dashboard, signed in
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-013, ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** an Online card, or a `fabric-dashboards://service/<id.instance>` link
- **Preconditions:** the service is `ready` or `degraded`
- **Steps:**
  1. I open the service -> the app asks the service for a one-time login code with its token, in the main process
  2. The dashboard opens inside the app at the service's https origin, signed in; the token never reaches the page
- **Expected result:** the online dashboard behaves like a local one: one click, signed in, inside the app
- **Alt paths:** the link names a path -> that page opens, as in SCN-026
- **UI elements:** Service view → Dashboard tab
- **States covered:** success, error
- **Errors & recovery:** the login code is refused or the page cannot load -> the view says so in a sentence with Retry, as in SCN-016
- **Status:** draft
- **Coverage:** src/electron/views.ts, src/core/probe.ts, test/e2e/remote.test.ts
- **Product:** unobserved

### SCN-032: An online service that cannot be reached says why
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-013, ST-004 (JTBD-01, JRN-01/#1)
- **Entry point:** an Online card or its service view
- **Preconditions:** a remote descriptor
- **Steps:**
  1. The service refuses the token -> Not answering, "<origin> refused the token. Set the same token on its platform and in this computer's token file."
  2. The certificate does not verify -> Not answering, "The certificate of <origin> does not verify: <detail>. The app does not connect around it." — after three probes in a row when it answered before (R-19, later)
  3. The service answers with a redirect -> Not answering, "<origin> answered with a redirect, which the app does not follow."; its platform answers HTTP 5xx (a deploy, an outage) -> after a minute, "<origin> is not up: its platform answers HTTP 503 …"
  4. Nothing answers for a minute -> Not answering, "<origin> has not answered since HH:MM."; one missed probe is not an outage (ADR-0008)
- **Expected result:** I can tell a configuration problem from an outage without opening a terminal
- **Alt paths:** another service answers the origin -> "Wrong program on port", "<origin> answers as <id.instance>, not as this service. The token is not sent there again." until the descriptor changes; the origin answers without the protocol -> "<origin> answers without fabric-service/0.1 (<detail>). The token is not sent there again until it asks for one." — later checks go without the token until the origin answers 401 or as this service (RemoteTokenLatch)
- **UI elements:** state badge, reason line, Health tab
- **States covered:** error
- **Errors & recovery:** each reason names the next action; none offers restart, because the platform supervises the service
- **Status:** draft
- **Coverage:** packages/service-host/src/state.ts, packages/service-host/test-vectors/state-precedence.json, src/core/i18n.ts
- **Product:** unobserved

## products

### SCN-033: Several instances of one agent read as one agent
- **Persona:** P-01
- **Feature:** products
- **Traces:** ST-014, ST-002 (JTBD-01, JRN-01/#1)
- **Entry point:** Overview and the sidebar, with `growth.default` (online), `growth.projection` (this Mac) and `growth.reader` (online) installed, and a communicator that answers without a dashboard
- **Preconditions:** the instances share the service id `growth`
- **Steps:**
  1. User opens the app -> the sidebar lists one **Growth** entry with the default instance's state; Overview shows one Growth card with the default instance's tiles and an "also:" line naming `projection` and `reader`, each with its state glyph
  2. User looks below the agents in the sidebar -> the communicator is listed under **Background**; on Overview its card sits with the others
  3. User clicks the Growth entry -> the default instance's page opens on its dashboard
- **Expected result:** five endpoints of two products read as two agents; nothing is hidden — every instance is one click away
- **Alt paths:** no `default` instance -> the first instance with a dashboard is the primary; a service that has never answered stays among the agents, not under Background
- **UI elements:** sidebar product entry, Background section, Overview product card, "also:" line
- **States covered:** success, empty
- **Errors & recovery:** an invalid descriptor of one instance keeps its own `invalid` state inside the product and in Attention
- **Status:** draft
- **Coverage:** src/core/products.ts, src/renderer/App.tsx, src/renderer/components/Overview.tsx, test/products.test.ts
- **Product:** unobserved

### SCN-034: Switch between an agent's connections
- **Persona:** P-01
- **Feature:** products
- **Traces:** ST-014, ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a product's service page, or a `fabric-dashboards://service/growth.reader` link
- **Preconditions:** the product has more than one instance
- **Steps:**
  1. User opens Growth -> above the header, a switch lists `Main · online`, `projection · this Mac`, `reader · online`, each with its state; Main is current
  2. User chooses `reader · online` -> the reader's page opens with its own header, tabs, session and controls; the sidebar keeps Growth selected
  3. User opens a link that names `growth.reader` directly -> the same page opens, with `reader` current in the switch
- **Expected result:** each connection opens as itself — its own sign-in and its own authority; the switch never borrows the main instance's session
- **Alt paths:** a product with one instance shows no switch
- **UI elements:** instance switch above the service header
- **States covered:** success
- **Errors & recovery:** a connection whose dashboard cannot sign in shows the sign-in error of SCN-016 for that connection only
- **Status:** draft
- **Coverage:** src/renderer/components/ServiceView.tsx (InstanceSwitch), src/renderer/App.tsx
- **Product:** unobserved

### SCN-035: A connection fails while the agent is fine
- **Persona:** P-01
- **Feature:** products
- **Traces:** ST-014, ST-002, ST-004 (JTBD-01, JRN-01/#2)
- **Entry point:** the sidebar and Overview while `growth.projection` is down and `growth.default` is ready
- **Preconditions:** the projection's launchd job has stopped answering
- **Steps:**
  1. User looks at the sidebar -> Growth shows ready, with a "!" mark that a connection needs attention
  2. User looks at Overview -> Attention lists "Growth · projection" with its reason and Restart; the Growth card shows `projection` with the down glyph
  3. User restarts it from Attention -> the projection comes back; the mark disappears
- **Expected result:** the failing connection is named exactly and acted on exactly; the agent's own state is neither raised nor lowered to cover it
- **Alt paths:** the default instance itself is down -> the product shows down, and no connection is promoted in its place
- **UI elements:** sidebar mark, Attention row, card "also:" line
- **States covered:** error, success
- **Errors & recovery:** a restart that does not bring it back follows SCN-008 for that instance
- **Status:** draft
- **Coverage:** src/core/products.ts (memberProblem), src/renderer/App.tsx (ProductItem), test/products.test.ts
- **Product:** unobserved

## spend

### SCN-036: See what every agent spent
- **Persona:** P-01
- **Feature:** spend
- **Traces:** ST-015 (JTBD-01, JRN-01/#2)
- **Entry point:** sidebar → Spend
- **Preconditions:** at least one agent declares `surfaces.usage` in its well-known document (contract DEC-0021)
- **Steps:**
  1. User clicks Spend -> system reads each agent's usage report now, with its token in the main process, and shows "read at HH:MM", Refresh and totals for Today, 7 days and 30 days across agents (when at least one agent reports)
  2. User reads the table -> one row per reporting agent: today, 7 days, 30 days, and Limits — the limit that most needs a person ("Over the limit: $6.00 of $5.00 · Daily · project demo (+7 more)"; a limit that stopped work or is breached shows first and in red, one at 80 % or more in amber), or the older single budget ("$1.59 of $100.00 this month") from an agent that lists no limits
  3. User clicks an agent's name -> the row expands to every limit the agent applies (DEC-0027) — which limit and for whom, its window, spent of limit, and its state (Stopped work, Over the limit, Close to the limit, Within, Spend not counted, Caps each order, Orders above it wait for you, Not enforced) — and below it the models: model, provider, calls, tokens in / out, cost over the last 31 days, most expensive first
  4. User leaves the page open -> it is read again every minute while the window shows; a hidden window gets the last sums; Refresh reads now
- **Expected result:** where the money goes, per agent and per model, without opening a provider console
- **Alt paths:** a limit the operator chose not to apply -> still listed, muted, "Not enforced"; an approval threshold crossed -> "Orders above it wait for you", never a breach; a kind of limit the app does not know -> listed by the agent's own name for it; no agent reports -> "No agent reports its spend yet" with what an agent must publish; some agents report and others do not -> "Not reporting spend yet: …" names the others; an agent asks through MCP `spend` -> the same sums
- **UI elements:** Spend nav item, totals tiles, agents table with the Limits column, limits table, model breakdown, Refresh
- **States covered:** loading, empty, success
- **Errors & recovery:** see SCN-038
- **Status:** draft
- **Coverage:** src/renderer/components/Spend.tsx, src/core/spend.ts, src/core/limits.ts, packages/service-host/src/usage.ts (limitsProblem, rankLimits), src/mcp/tools.ts (spend), test/e2e/spend.test.ts
- **Product:** unobserved

### SCN-037: A cost that is not known reads as unknown
- **Persona:** P-01
- **Feature:** spend
- **Traces:** ST-015 (JTBD-01)
- **Entry point:** Spend, with an agent whose report has unpriced calls (a local model with no price list)
- **Preconditions:** the report counts `unpricedCalls` and gives `costUsd: null` for the unpriced model
- **Steps:**
  1. User opens Spend -> the agent's today and week read "≥ $0.31" and "≥ $1.59", and the totals read "≥" too
  2. User expands the agent -> the unpriced model's cost reads "unknown"
  3. User reads below the table -> "≥ means some calls carry no price… An unknown cost is never counted as $0."
- **Expected result:** a partial sum is never shown as the whole, and an unknown cost never reads as free
- **Alt paths:** every call in a window unpriced -> that window reads "unknown"; no calls in a window -> "$0.00"; a row with calls and no cost -> a lower bound («≥»), whatever its unpricedCalls says; a cost reported without calls is kept, never zeroed
- **UI elements:** "≥" amounts, "unknown", the note
- **States covered:** success
- **Errors & recovery:** a report claiming a price for calls it marks unpriced is refused as malformed (SCN-038)
- **Status:** draft
- **Coverage:** packages/service-host/src/usage.ts (summarizeUsage), packages/service-host/test/usage.test.ts, test/e2e/spend.test.ts
- **Product:** unobserved

### SCN-038: An agent's spend cannot be read
- **Persona:** P-01
- **Feature:** spend
- **Traces:** ST-015, ST-004 (JTBD-01)
- **Entry point:** Spend, with an agent that refuses the token, cannot be reached, or answers a malformed report
- **Preconditions:** the agent declares `surfaces.usage`
- **Steps:**
  1. User opens Spend -> "Could not read" lists the agent with the reason in a sentence ("the service refused the token (HTTP 401)", "the usage report is malformed: …")
  2. User reads the totals -> when another agent reports, they carry "≥", because one agent's spend is missing; when none reports, only "Could not read" shows
- **Expected result:** a failure is named and never silently counted as zero; the other agents still show
- **Alt paths:** the token file is not 0600 -> the reason names it; the agent answers a report for another instance -> refused; an agent that reported earlier and does not answer now -> "it does not answer now, so its usage report could not be read"; another program answers its address -> "another program answers on its address, so its usage report is not read" (its token is never sent there); the reasons follow the window's language
- **UI elements:** "Could not read" notice, "≥" totals
- **States covered:** error
- **Errors & recovery:** the next read (a minute later, or Refresh) shows the agent again once it answers
- **Status:** draft
- **Coverage:** src/core/spend.ts (readSpend), src/core/probe.ts (fetchUsage), test/spend.test.ts
- **Product:** unobserved

## dashboard-toolbar

### SCN-039: Reload and move through an embedded dashboard
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-016, ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a service page, Dashboard tab
- **Preconditions:** the service is ready and its dashboard is open
- **Steps:**
  1. User looks above the page -> a toolbar: Back, Forward (disabled until there is history), Reload page, Dashboard home, the page's address, Copy address, Copy app link
  2. User clicks a link inside the dashboard -> the address follows the page, Back becomes available
  3. User clicks Reload page -> for a registered live service that requires sign-in, the app performs one fresh sign-in using its existing service token, then reloads the current same-origin page; concurrent clicks share the attempt, with a spinner through sign-in and page loading. A service without sign-in uses its ordinary reload
  4. User clicks Dashboard home -> the service's dashboard path opens, signed in
- **Expected result:** the operator controls the embedded page like a browser tab, without leaving the app
- **Alt paths:** the page crashed -> "The page stopped." with Reload replaces the page and the toolbar (SCN-015); the service restarted -> "The service restarted." with Reload above the page, the toolbar stays; a page on another origin is never shown in the address
- **UI elements:** dashboard toolbar
- **States covered:** loading, success, error
- **Errors & recovery:** a reload or renewed sign-in that fails (including an HTTP error page) -> the existing page-error message with Retry (SCN-016); no automatic retry on a 404. A service no longer answering as the registered identity gets no token. Switching away while sign-in is pending prevents the completed attempt from taking over the current view
- **Status:** draft
- **Coverage:** src/renderer/components/ServiceView.tsx (DashboardToolbar), src/electron/views.ts (page, navigate, refresh), test/dashboard-refresh.test.ts, test/e2e/app.test.ts; native refresh acceptance pending
- **Product:** unobserved

### SCN-040: Copy a dashboard page's address or app link
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-016, ST-011 (JTBD-04)
- **Entry point:** the dashboard toolbar
- **Preconditions:** a dashboard page is open
- **Steps:**
  1. User clicks Copy address -> the page's own address (`http://127.0.0.1:<port>/…` or the online `https://…`) is on the clipboard; the button reads "Copied" for a moment
  2. User clicks Copy app link -> `fabric-dashboards://service/<id.instance>?path=…` is on the clipboard: pasted to an agent or a teammate on this Mac, it opens the same page here, signed in
  3. User clicks the address -> the whole address is selected for a manual copy
- **Expected result:** any page can be handed on in one click, in the form the receiver needs
- **Alt paths:** the page is the one-time sign-in URL -> the dashboard's address is copied instead; no login code ever reaches the clipboard
- **UI elements:** address field, Copy address, Copy app link
- **States covered:** success
- **Errors & recovery:** none needed — both values are computed locally
- **Status:** draft
- **Coverage:** src/electron/policy.ts (pageAddress), test/toolbar.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-041: Overview at a glance
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-016, ST-002, ST-015 (JTBD-01, JRN-01/#2)
- **Entry point:** Overview
- **Preconditions:** services are installed; some publish a usage report
- **Steps:**
  1. User opens Overview -> a strip of five cells: agents ready out of all agents, instances not answering or in conflict (two copies, wrong program and invalid included), need attention, spent today, spent in 30 days; the spend is read on arrival and every minute while Overview shows, and labels take two lines before an ellipsis
  2. User clicks a spend cell -> Spend opens (SCN-036)
- **Expected result:** the state of the whole estate and its cost is read before any card
- **Alt paths:** no agent reports or fails to report spend -> the spend cells read "—" and do nothing; while the first read runs -> a spinner; some calls unpriced -> «≥ $x»; everything unpriced -> "unknown"; under a cent -> "<$0.01"; an agent failed to report -> the cells open Spend, where it is listed
- **UI elements:** status strip
- **States covered:** loading, success
- **Errors & recovery:** a report that cannot be read makes the sums lower bounds («≥»), as on Spend
- **Status:** draft
- **Coverage:** src/renderer/components/Overview.tsx (StatusStrip), src/core/spend.ts (sumSpend)
- **Product:** unobserved

### SCN-042: Many problems stay compact
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-016, ST-002 (JTBD-01)
- **Entry point:** Overview with more than three services needing attention
- **Preconditions:** four or more rows in Needs attention
- **Steps:**
  1. User opens Overview -> Needs attention shows its count and the three most severe rows, each one line: state, name, reason cut to the line, action
  2. User hovers a cut reason -> the full sentence shows
  3. User clicks "Show all N" -> every row shows; "Show fewer" folds them back
- **Expected result:** the block never pushes the agents off the first screen
- **Alt paths:** three or fewer -> no toggle
- **UI elements:** Needs attention block, Show all / Show fewer
- **States covered:** error, success
- **Errors & recovery:** as SCN-006
- **Status:** draft
- **Coverage:** src/renderer/components/Overview.tsx
- **Product:** unobserved

## focus

### SCN-046: The dashboard gets the screen: a one-line header that opens to the full card
- **Persona:** P-01
- **Feature:** focus
- **Traces:** ST-018 (JTBD-04, JRN-01/#5); ADR-0017
- **Entry point:** any service page; View → Show or Hide Service Details (⌃⌘D)
- **Preconditions:** none
- **Steps:**
  1. User opens a service -> the header is one line: the state mark, the name, the state badge, the tabs (Dashboard, Activity, Health, Logs) and a "Show details" control; the dashboard fills the rest; pointing at the name shows the agent's summary
  2. User presses "Show details" -> the full card opens under the bar: summary, version, build, pid, port, uptime, Tools, reasons, the last action and the actions (Restart, Stop, Update, Doctor, Show data folder, Show file); the control reads "Hide details"
  3. User presses "Hide details" -> back to one line; the choice holds for every service and after a relaunch
- **Expected result:** the embedded dashboard takes the window; everything in the header is one press away
- **Alt paths:** the service is not ready, or its last action failed within half an hour -> the bar shows one chip with the first reason ("Not answering since 10:42", "Restart did not bring it back"); pressing the chip opens the full card; an action is running -> its spinner and label ("Restarting…") sit in the bar
- **UI elements:** compact bar, state badge, problem chip, tabs, "Show details" / "Hide details", full card
- **States covered:** success, error, loading
- **Errors & recovery:** every error the full card shows (SCN-007, SCN-008, SCN-011, SCN-012, SCN-013, SCN-021) is reachable from the chip
- **Status:** validated
- **Coverage:** src/renderer/components/ServiceView.tsx, src/core/focus.ts, src/renderer/styles/app.css, test/parts.test.ts (ADR-0017 REQ-02), test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-047: The agents list folds into a rail
- **Persona:** P-01
- **Feature:** focus
- **Traces:** ST-018 (JTBD-04, JRN-01/#5); ADR-0017
- **Entry point:** the sidebar's "Collapse sidebar" control, or View → Show or Hide Sidebar (⌃⌘S)
- **Preconditions:** none
- **Steps:**
  1. User collapses the sidebar -> it becomes a narrow rail: the mark, icons for Overview, Activity, Spend and Settings, and one entry per agent with its state mark and initials; the Overview and Activity badges stay
  2. User points at an entry -> its name (and state) shows as a tooltip; a screen reader reads the same
  3. User presses "Expand sidebar" -> the full list returns; the choice holds after a relaunch
- **Expected result:** the dashboard gains the sidebar's width, and every page and agent stays one press away
- **Alt paths:** an agent needs attention -> its rail entry carries the same mark as in the full list
- **UI elements:** rail, nav icons, agent entries with state marks and initials, tooltips, "Collapse sidebar" / "Expand sidebar", View menu item
- **States covered:** success
- **Errors & recovery:** n/a — a layout choice that never fails
- **Status:** validated
- **Coverage:** src/renderer/App.tsx, src/renderer/styles/app.css, src/electron/main.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

## console

### SCN-048: Open an agent's console beside its dashboard
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019 (JTBD-05, JRN-01/#8); ADR-0017
- **Entry point:** "Console" in a service page's bar, or View → Show or Hide Console (⌃⌘T)
- **Preconditions:** none
- **Steps:**
  1. User opens the console -> a panel opens to the right of the dashboard with this agent's console; the dashboard narrows to the space left
  2. User drags the panel's edge -> it widens or narrows (320 px up to half the window); the width is remembered
  3. User collapses the panel -> it closes; whatever runs in it keeps running; opening it again shows everything it printed
  4. User switches to another agent -> the panel shows that agent's console; each agent has its own
- **Expected result:** a console that belongs to the agent sits beside its dashboard and gets out of the way when asked
- **Alt paths:** the window is hidden while a console runs -> it keeps running and nothing is sent to the window; showing it replays what was printed; the agent is removed -> its page closes and its console ends with it
- **UI elements:** console panel, its edge handle, "Console" / "Hide console", View menu item
- **States covered:** success, empty
- **Errors & recovery:** n/a here; starting is SCN-049
- **Status:** validated
- **Coverage:** src/renderer/components/ConsolePanel.tsx, src/core/consoles.ts, src/electron/console.ts, test/console.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-049: Start a runtime in the agent's repository
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019 (JTBD-05, JRN-01/#8); ADR-0017
- **Entry point:** an agent's console that runs nothing yet
- **Preconditions:** at least one runtime (Claude Code, Codex or another known one) is installed
- **Steps:**
  1. User opens the console -> it shows the runtime (the last one used for this agent, else Claude Code, else the first one found), the folder found for this agent (its repository's local checkout) with "Other…", and "New session" and "Continue last"
  2. User presses "New session" -> the runtime's own interface starts in that folder, in the console; the user types to it as in any terminal, and its permission questions appear there
  3. User presses "Continue last" -> the runtime resumes its last conversation in that folder (`claude --continue`, `codex resume --last`)
  4. The runtime exits -> the console says "Exited (code 0)" with "New session" and "Continue last" again
- **Expected result:** the runtime the user chose runs in the agent's repository, with their settings and skills, one press from the dashboard
- **Alt paths:** "Other…" -> a folder dialog; the choice is remembered for this agent; the user picks another runtime -> remembered for this agent; "Stop" -> the runtime ends after a confirmation if it is still running; "Open in Terminal" -> the same runtime continues in that folder in Terminal
- **UI elements:** runtime picker, folder line with "Other…", "New session", "Continue last", "Stop", "Open in Terminal", terminal, exit line
- **States covered:** empty, loading, success, error
- **Errors & recovery:** no runtime installed -> "No supported runtime is installed" with the list it looks for; no repository found -> "Choose the folder this agent's code lives in" with "Choose folder…"; the folder no longer exists -> the same; the runtime cannot start -> its own error in the console, and "New session" again; a runtime with no resume flag -> "Continue last" is not offered
- **Status:** validated
- **Coverage:** src/core/runtimes.ts, src/core/repofind.ts, src/core/consoles.ts, src/electron/console.ts, src/renderer/components/ConsolePanel.tsx, test/console.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-050: A folder bound to a Switchboard project runs on that project's account
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019 (JTBD-05, JRN-01/#8); ADR-0017
- **Entry point:** an agent's console whose folder Fabric Switchboard binds to a project
- **Preconditions:** Switchboard is installed; `switchboard project show --path <folder>` names a project
- **Steps:**
  1. User opens the console -> the folder line says "Switchboard project <name>"
  2. User starts a session, and the installed Switchboard can launch in place -> the console runs the session through Switchboard on the project's account; no token passes through the app
  3. User starts a session, and the installed Switchboard cannot launch in place yet -> the console says "This folder runs on Switchboard project <name>; this Switchboard opens it in Terminal" with "Open in Terminal via Switchboard"; pressing it starts the session there on the project's account
- **Expected result:** a project folder never runs on the ordinary sign-in
- **Alt paths:** the folder is in no project, or Switchboard is not installed -> the runtime runs on its ordinary sign-in, and the folder line says nothing about Switchboard
- **UI elements:** folder line with the project name, "Open in Terminal via Switchboard"
- **States covered:** success, error
- **Errors & recovery:** Switchboard needs its app or `switchboard serve` running -> its own message, shown as it says it; a managed session for the same project already runs -> Switchboard's refusal is shown as it says it; Switchboard's answer cannot be read -> "Switchboard did not answer; the session was not started" — never a silent fallback to the ordinary sign-in
- **Status:** validated
- **Coverage:** src/core/switchboard.ts, src/core/consoles.ts, src/electron/console.ts, test/console.test.ts
- **Product:** unobserved

### SCN-052: Fabric Dashboards on Windows or Linux
- **Persona:** P-01
- **Feature:** platform
- **Traces:** ST-001, ST-008 (JTBD-01, JRN-01/#1); ADR-0019
- **Entry point:** the app installed on Windows (NSIS) or Linux (AppImage or .deb)
- **Preconditions:** none
- **Steps:**
  1. User starts the app -> the window has the system's own frame and a File menu (Check for Updates, Quit — Ctrl+Q); the services found in this computer's services folder are listed as on macOS
  2. User closes the window -> the app stays in the system tray with the colour mark; its state shows as a shape and a colour (amber triangle: degraded, red dot: a problem); the tray menu opens the window again
  3. User opens a local service -> its dashboard, events and spend work as on macOS; start, stop and restart are not offered yet, and the service's facts say why (supervision on this system comes with the contract decision, ADR-0019)
  4. User chooses Settings → Uninstall -> on Windows this install's own uninstaller runs after the app quits; on Linux the AppImage goes to the trash, or for a .deb the app shows `sudo apt remove fabric-dashboards`
- **Expected result:** the same monitoring as on macOS, nothing macOS-only offered, and nothing removed but this app
- **Alt paths:** Windows: Settings → Launch at login starts the app hidden in the tray at sign-in; Linux: launch at login is not offered until the autostart file lands (FD-37 M3); notification settings open Windows Settings, on Linux the app says to look in the desktop's own settings
- **UI elements:** system window frame, File / View / Window / Help menus, tray icon and menu, Settings → Uninstall
- **States covered:** success, error
- **Errors & recovery:** a Windows copy with no uninstaller beside it, or a Linux copy that is neither an AppImage nor a package -> "Fabric Dashboards is uninstalled from your settings. To remove the app itself: …" with what to do; updates on Windows and Linux -> reported as unsupported until the per-OS updater lands (ADR-0019 §6)
- **Status:** draft
- **Coverage:** src/core/platform.ts, src/electron/main.ts, src/electron/tray.ts, test/platform.test.ts
- **Product:** unobserved
