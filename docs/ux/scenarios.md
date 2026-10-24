<!-- Managed with super-ux (ux-contract v4). Update in the same change as any user-facing behavior change. -->

# Fabric Dashboards — scenarios

## Index

| ID | Title | Feature | Persona | Traces | Status | Last audit |
|----|-------|---------|---------|--------|--------|------------|
| SCN-001 | First launch finds installed services | discovery | P-01 | ST-001 | validated | 2026-10-12 |
| SCN-002 | First launch with no service installed | discovery | P-01 | ST-001 | validated | 2026-10-13 |
| SCN-003 | A service is installed or removed while the app runs | discovery | P-01 | ST-001 | validated | 2026-10-13 |
| SCN-004 | A descriptor is invalid | discovery | P-01 | ST-001, ST-004 | validated | 2026-10-13 |
| SCN-005 | Overview when everything is ready | overview | P-01 | ST-002, ST-023 | validated | 2026-10-12 |
| SCN-006 | Overview lists what needs attention | overview | P-01 | ST-002, ST-023 | validated | 2026-10-13 |
| SCN-007 | Restart a service that is down | control | P-01 | ST-003 | validated | 2026-10-13 |
| SCN-008 | Restart does not bring the service back | control | P-01 | ST-003 | validated | 2026-10-13 |
| SCN-009 | Stop a service so it stays off | control | P-01 | ST-003 | validated | 2026-10-12 |
| SCN-010 | Start a stopped service | control | P-01 | ST-003 | validated | 2026-10-13 |
| SCN-011 | Two copies of one service | health | P-01 | ST-004 | validated | 2026-10-13 |
| SCN-012 | Another program answers on the service's port | health | P-01 | ST-004 | validated | 2026-10-13 |
| SCN-013 | Two services claim one port | health | P-01 | ST-004 | validated | 2026-10-13 |
| SCN-014 | Open a dashboard inside the app, signed in | dashboards | P-01 | ST-005 | validated | 2026-10-12 |
| SCN-015 | Dashboard view keeps its place | dashboards | P-01 | ST-005 | validated | 2026-10-12 |
| SCN-016 | Dashboard cannot sign in | dashboards | P-01 | ST-005 | validated | 2026-10-13 |
| SCN-017 | Catch up in Activity | activity | P-01 | ST-006 | validated | 2026-10-12 |
| SCN-018 | Activity when a service's feed cannot be read | activity | P-01 | ST-006 | validated | 2026-10-13 |
| SCN-019 | Notification when a service goes down and comes back | notifications | P-01 | ST-007 | draft | 2026-10-06 |
| SCN-020 | Notification from a service event opens the item | notifications | P-01 | ST-007, ST-006 | draft | 2026-10-06 |
| SCN-021 | Update a service | updates | P-01 | ST-008 | validated | 2026-10-13 |
| SCN-022 | The app updates itself | updates | P-01 | ST-008 | validated | 2026-10-12 |
| SCN-023 | Glance from the menu bar | tray | P-01 | ST-009 | validated | 2026-10-12 |
| SCN-024 | Settings: launch at login, notifications, quiet hours | settings | P-01 | ST-010, ST-007 | validated | 2026-10-13 |
| SCN-025 | Run doctor and read logs | control | P-01 | ST-003 | validated | 2026-10-13 |
| SCN-026 | Open a service page from a link an agent handed over | links | P-01 | ST-011, ST-005 | validated | 2026-10-12 |
| SCN-027 | A link that cannot be opened | links | P-01 | ST-011 | validated | 2026-10-12 |
| SCN-028 | An agent reads and administers services through MCP | agents | P-01 | ST-012, ST-003 | validated | 2026-10-13 |
| SCN-029 | Open a service from Fabric's agent registry | links | P-01 | ST-011, ST-005, ST-003 | validated | 2026-10-12 |
| SCN-030 | Online services appear in their own group | overview | P-01 | ST-013, ST-002 | validated | 2026-10-13 |
| SCN-031 | Open an online service's dashboard, signed in | dashboards | P-01 | ST-013, ST-005 | validated | 2026-10-12 |
| SCN-032 | An online service that cannot be reached says why | health | P-01 | ST-013, ST-004 | validated | 2026-10-14 |
| SCN-033 | Several instances of one agent read as one agent | products | P-01 | ST-014, ST-002 | validated | 2026-10-13 |
| SCN-034 | Switch between an agent's connections | products | P-01 | ST-014, ST-005 | validated | 2026-10-13 |
| SCN-035 | A connection fails while the agent is fine | products | P-01 | ST-014, ST-002, ST-004 | validated | 2026-10-13 |
| SCN-036 | See what every agent spent | spend | P-01 | ST-015 | validated | 2026-10-12 |
| SCN-037 | A cost that is not known reads as unknown | spend | P-01 | ST-015 | validated | 2026-10-23 |
| SCN-038 | An agent's spend cannot be read | spend | P-01 | ST-015, ST-004 | validated | 2026-10-13 |
| SCN-039 | Reload and move through an embedded dashboard | dashboards | P-01 | ST-016, ST-005 | validated | 2026-10-12 |
| SCN-040 | Copy a dashboard page's address or app link | dashboards | P-01 | ST-016, ST-011 | validated | 2026-10-12 |
| SCN-041 | Overview at a glance | overview | P-01 | ST-016, ST-002, ST-015 | validated | 2026-10-13 |
| SCN-042 | Many problems stay compact | overview | P-01 | ST-016, ST-002 | validated | 2026-10-13 |
| SCN-043 | Reinstall picks up where I left off | settings | P-01 | ST-017, ST-010 | draft | 2026-10-06 |
| SCN-044 | A copy outside Applications moves itself so it can update | updates | P-01 | ST-017, ST-008 | draft | 2026-10-06 |
| SCN-045 | A dashboard hands me to another agent | dashboards | P-01 | ST-005, ST-011 | validated | 2026-10-12 |
| SCN-046 | The dashboard gets the screen: a one-line header that opens to the full card | focus | P-01 | ST-018 | validated | 2026-10-06 |
| SCN-047 | The agents list folds into a rail | focus | P-01 | ST-018 | validated | 2026-10-06 |
| SCN-048 | Open an agent's console over its dashboard | console | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-049 | Start a runtime in the agent's repository | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-050 | A folder bound to a Switchboard project runs on that project's account | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-051 | The app watches contract and skill versions | estate | P-01 | ST-008, ST-017 | validated | 2026-10-14 |
| SCN-052 | Fabric Dashboards on Windows or Linux | platform | P-01 | ST-001, ST-008 | draft | 2026-10-10 |
| SCN-053 | The console's agent already knows which agent it works on | console | P-01 | ST-020 | validated | 2026-10-12 |
| SCN-054 | Fix with agent | console | P-01 | ST-020 | validated | 2026-10-12 |
| SCN-055 | Update with agent | console | P-01 | ST-020 | validated | 2026-10-14 |
| SCN-056 | Pin an agent to the top of the list | list | P-01 | ST-021 | validated | 2026-10-12 |
| SCN-057 | Sort the agents list | list | P-01 | ST-021 | validated | 2026-10-13 |
| SCN-058 | First session: my coding agent sets the system up | setup | P-01 | ST-022 | validated | 2026-10-12 |
| SCN-059 | A later session opens on what changed | overview | P-01 | ST-022 | validated | 2026-10-12 |
| SCN-060 | The dashboard keeps its floor while the console widens | console | P-01 | ST-019 | retired | 2026-10-23 |
| SCN-061 | Talk to Fabric about this agent | console | P-01 | ST-020 | validated | 2026-10-12 |
| SCN-062 | Outages reach me away from the Mac | notifications | P-01 | ST-002 | validated | 2026-10-13 |
| SCN-063 | A session starts only when the Mac can carry it | console | P-01 | ST-019 | validated | 2026-10-13 |
| SCN-064 | See what Switchboard runs for this agent | console | P-01 | ST-019 | draft | 2026-10-12 |
| SCN-065 | A provider limit does not stop the agent | console | P-01 | ST-019 | draft | 2026-10-12 |
| SCN-066 | An idle session closes and comes back | console | P-01 | ST-019, ST-023 | draft | 2026-10-24 |
| SCN-067 | Dashboards take my scheme and theme | settings | P-01 | ST-019 | validated | 2026-10-13 |
| SCN-068 | See which runner and model an agent uses | service | P-01 | ST-019 | validated | 2026-10-13 |
| SCN-069 | A hand-over opens in the console | sessions | P-01 | ST-023, ST-019 | draft | 2026-10-24 |
| SCN-070 | Check what is set up | settings | P-01 | ST-017 | validated | 2026-10-14 |
| SCN-071 | See agents on this Mac, online and services apart | list | P-01 | ST-021 | validated | 2026-10-23 |
| SCN-072 | Hide an agent without stopping it | list | P-01 | ST-021 | validated | 2026-10-23 |
| SCN-073 | See what an agent is connected to | service | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-074 | See how agents are wired and what the auditor found | connections | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-075 | A session stopped on a limit continues by itself | sessions | P-01 | ST-023, ST-019 | draft | 2026-10-24 |
| SCN-076 | See how busy an agent is | service | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-077 | Switch between Agents and Sessions | navigation | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-078 | See every coding session in one place | sessions | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-079 | The Sessions page explains itself once | sessions | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-080 | Open one session's page | sessions | P-01 | ST-023, ST-019 | draft | 2026-10-24 |
| SCN-081 | A running session: end it, or find where it runs | sessions | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-082 | A session that needs you | sessions | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-083 | A session waiting for a limit reset | sessions | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-084 | An ended session continues or leaves | sessions | P-01 | ST-023 | draft | 2026-10-24 |
| SCN-085 | A taken hand-over tells me once, and the tray counts sessions | sessions | P-01 | ST-023, ST-007, ST-009 | draft | 2026-10-24 |
| SCN-086 | Settings → Sessions | settings | P-01 | ST-023, ST-010 | draft | 2026-10-24 |
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
- **Status:** validated
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
- **Status:** validated
- **Coverage:** src/renderer/components/Overview.tsx, test/e2e/discovery.test.ts
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
- **Status:** validated
- **Coverage:** src/core/monitor.ts, test/monitor.test.ts, test/e2e/discovery.test.ts
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
- **Status:** validated
- **Coverage:** packages/service-host/src/descriptor.ts, packages/service-host/src/state.ts, test/monitor.test.ts, packages/service-host/test/descriptor.test.ts, test/e2e/discovery.test.ts
- **Product:** unobserved

## overview

### SCN-005: Overview when everything is ready
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-002 (JTBD-01, JRN-01/#2); from 0.8.0 also ST-023 (the Agents mode, SCN-077)
- **Entry point:** Overview, the first page of the Agents mode (the sidebar switch's "Agents", or ⌘1; SCN-077)
- **Preconditions:** every service answers ready
- **Steps:**
  1. User opens Overview -> system shows one card per service: state dot and word, name, version and short commit, uptime, what the agent is for (the descriptor's one-line summary, at most two lines), up to six summary tiles, the latest event sentence with its time
  2. User chooses a card -> system opens that service's view (SCN-014)
- **Expected result:** the state of every service is readable in one screen; no Needs attention block is shown
- **UI elements:** service cards, state dot and label, the agent's one-line summary, tiles, latest event line, header count "7 services" (one per agent, ADR-0012)
- **States covered:** loading, success
- **Errors & recovery:** nothing can fail on this screen itself; per-service failures are SCN-006
- **Status:** validated
- **Coverage:** src/renderer/components/Overview.tsx, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-006: Overview lists what needs attention
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-002 (JTBD-01, JRN-01/#2); from 0.8.0 also ST-023 (the Agents mode, SCN-077)
- **Entry point:** Overview, the first page of the Agents mode (the sidebar switch's "Agents", or ⌘1; SCN-077)
- **Preconditions:** at least one service is down, degraded, duplicated, foreign, conflicting, invalid, has an attention tile, or has an update
- **Steps:**
  1. User opens Overview -> system shows Needs attention above the cards, most severe first: one single-line row per problem with its state, the name, the reason cut to the line ("Not answering since 17:02.") and its one action (Restart for a local service that is down or runs twice, "Update to 0.2.1" when the service declares an update command, Open otherwise; Logs after a failed action); while the action runs the row shows its progress ("Restarting…"); more than three rows wait behind "Show all" (SCN-042)
  2. User chooses the action -> system performs it (SCN-007, SCN-011, SCN-021); the row leaves when the problem clears, and a failed action keeps its row, with the failure sentence and Logs, for 30 minutes
- **Expected result:** problems are the first thing read, each with its next action
- **Alt paths:** a degraded service lists its reasons with Open, when the fix is inside the service ("Collector: last ran 3 days ago"); an online service never offers Restart: its platform supervises it; several agents in the same state for the same reason (one hub down behind them) -> one line, "3 agents: A, B, C" with the reason once, each name opening its agent (FD-86); a coding session that needs the person is not listed here: from 0.8.0 the Sessions switch counts it (SCN-077, SCN-082)
- **UI elements:** Needs attention block, problem rows, action buttons (each names its service for a screen reader), the problem count on Overview in the sidebar (not answering, two copies, wrong program, conflict, invalid)
- **States covered:** error, success
- **Errors & recovery:** the action fails -> the row keeps its place with the failure sentence and Logs
- **Status:** validated
- **Coverage:** packages/service-host/src/state.ts (attentionRank), src/core/attention.ts (groupAttention, test/attention.test.ts), src/renderer/components/Overview.tsx, test/e2e/overview-settings.test.ts
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
- **Status:** validated
- **Coverage:** src/core/monitor.ts, src/core/launchd.ts, test/monitor.test.ts, test/e2e/launchd-control.test.ts
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
- **Status:** validated
- **Coverage:** src/core/monitor.ts, test/e2e/launchd-control.test.ts
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
- **Status:** validated
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
- **Status:** validated
- **Coverage:** src/core/launchd.ts, test/monitor.test.ts, test/e2e/launchd-control.test.ts
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
- **Status:** validated
- **Coverage:** src/core/monitor.ts, src/renderer/components/ServiceView.tsx, test/e2e/health-states.test.ts
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
- **Status:** validated
- **Coverage:** packages/service-host/src/state.ts, src/core/monitor.ts, test/core.test.ts, test/e2e/launchd-control.test.ts
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
- **Status:** validated
- **Coverage:** packages/service-host/src/state.ts, test/monitor.test.ts, test/flap.test.ts, test/e2e/health-states.test.ts
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
- **Status:** validated
- **Coverage:** packages/service-host/src/descriptor.ts (claimConflicts), src/renderer/components/ServiceView.tsx, test/monitor.test.ts, test/e2e/health-states.test.ts
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
- **Status:** validated
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
- **Status:** validated
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
  2. The service restarts (a new version, a crash) -> the page on screen signs in again and reloads where it was, by itself; the toolbar says "Restarted, page reloaded" for a moment; a page off screen reloads where it was the next time it is shown (FD-74); an HTTP failure shows Retry (SCN-039)
  3. User comes back to a page whose view was closed (the window was hidden, or the page crashed) -> it opens at once, without a new sign-in, while the same service process signed this app in less than 30 minutes ago; a page or a request of it that is refused then signs in once, on the same page (FD-74)
- **Expected result:** one live view per service, never duplicated; a page the person comes back to opens at once and shows the agent's current version
- **UI elements:** embedded page, "Restarted, page reloaded" in the toolbar
- **Alt paths:** the session ended while the page was open (the service answers 401) -> the app signs in again by itself, once a minute at most, and reopens the same page (ADR-0014); the window stays hidden for 5 minutes -> every dashboard is released except the two shown last, which open at once when the window shows again; after an hour hidden those two are released as well, and showing the window again reopens the one that was on screen, on its page (FD-74)
- **States covered:** success
- **Errors & recovery:** the page crashes -> the app recreates it once (again after every page that loads), then shows "The page stopped." with Reload
- **Status:** validated
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
- **Status:** validated
- **Coverage:** src/renderer/components/ServiceView.tsx, src/core/probe.ts, test/e2e/products-problems.test.ts
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
- **Status:** validated
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
- **Status:** validated
- **Coverage:** src/renderer/components/Activity.tsx, src/core/monitor.ts, test/e2e/products-problems.test.ts
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
- **Status:** validated
- **Coverage:** src/core/monitor.ts, src/renderer/components/ServiceView.tsx, test/e2e/update.test.ts
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
- **Alt paths:** user chooses Restart to Update while an agent's console or a command runs -> the app names them and asks; Cancel keeps everything running, Restart to Update stops them and installs; user chooses Restart to Update -> a notification says the app reopens by itself and it installs now, and the new copy opens on the screen the person left — the agent's page, Activity, Spend or Settings (FD-21 U-18); the app is opened (by the person, a link or an agent) while the update installs -> it says «Finishing the update to <version> — reopens by itself», steps aside, and reopens when the install has finished; the window stays open -> nothing installs under the person's eyes, and it installs at the next quit or the next ten closed minutes; a doctor or update command is running -> the install waits for it, checked every minute; "Install updates automatically" is off in Settings → Updates -> nothing is checked, downloaded or installed on its own, and Check for updates still works (LC-16; the choice is kept in a file no update, reinstall or uninstall rewrites); the release needs a step from the person -> it is verified but held: "Update <version> is verified and waits for you" with What to do (opens the release's steps) and Install; Settings → Updates → Check now checks at once; the feed names a version that is not newer than the installed one -> nothing installs (F-1); the disk has too little room to unpack the update -> Settings → Updates says "not enough free space to unpack the update: N GB free, about M GB needed", and a failed unpack says the tool's own words and the free space, never only that it failed; the next check tries again (FD-79); the window is shown while an update is ready -> the log says the install waits for the window, and a window of a hidden app (⌘H, or hidden by another program) counts as not shown, so the ten minutes start (FD-80); on Linux from an AppImage -> the same checks, then the new AppImage replaces this one and Restart to Update (or ten hidden minutes) starts it (FD-37 M4b); on Linux from a .deb -> Settings → Updates says a newer .deb from the releases page updates it, and nothing is checked; on Windows, installed by the installer -> the same checks, then Restart to Update (or ten hidden minutes) runs the verified installer silently in update mode, which installs in place and starts the app again (FD-37 M4c); on Windows without the installer's uninstaller beside the app -> Settings → Updates says this copy was not set up by the installer and where the newer version is
- **UI elements:** footer update line, Restart to Update button, held line with What to do and Install, Settings → Updates (Install updates automatically, state line, Check now), "Check for updates" in the app menu
- **States covered:** loading, success, error
- **Errors & recovery:** download or signature check fails -> footer "Update failed: <reason>" with Retry, one automatic retry within the hour, and the running app is unchanged; the bundle Squirrel staged is not the verified one -> it is removed before any quit and the footer says so; every step is logged with the organization's update codes (ADR-0015 amendment)
- **Status:** validated
- **Coverage:** src/electron/updater.ts, src/core/self-update.ts, test/self-update.test.ts, src/core/release-verify.ts, src/core/autoupdate.ts, src/core/version.ts (mayCheck, stagedRefusal), src/electron/policy.ts (autoInstallNow, relaunchHidden), src/electron/main.ts (auto-install-flow), src/renderer/components/Settings.tsx (UpdateState), scripts/dist-mac.mjs, test/lifecycle.test.ts, test/e2e/app.test.ts
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
- **Status:** validated
- **Coverage:** src/core/estate-update.ts, src/electron/estate-updater.ts, src/electron/main.ts (estate-update), src/renderer/components/Settings.tsx (ClonePath, EstateState), test/estate-update.test.ts, test/e2e/overview-settings.test.ts *SCN-051* (a real clone of the contract named in Settings on the running app: the remote read, the commits fetched, the local main left where it was — it fails when the fetch is replaced by a pull, 2026-10-14); the installed app logs `estate_check ok` every 6 hours (main.log)
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
- **UI elements:** menu bar icon, tray menu, service items, Pause notifications item; from 0.8.0, while a coding session runs or waits for the person, a line "Sessions: running N, waiting for you M" under the headline that opens the Sessions mode (SCN-085)
- **States covered:** success, error
- **Errors & recovery:** nothing can fail in the menu; quitting leaves every service running and the menu says so above Quit — no dialog on the way out, except when an agent's console session or a command the app started is running: then Quit names them and asks (Cancel keeps them; ADR-0017 amendment 2026-10-07)
- **Status:** validated
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
  1. User opens Settings -> system shows Launch at login (on by default since 2026-10-16: the first launch of an installed copy registers it once; the person turns it off here), Theme, Language (As on this Mac, English, Русский), Updates (SCN-022), Notifications per service with levels, Quiet hours (from–to), the services folder, Uninstall, and Unattributed listeners
  2. User changes a setting -> it applies immediately and is kept across restarts; after the first launch, launch at login is registered or removed only by the person's choice here, never by a launch or an update
  3. User opens Unattributed listeners -> system lists local ports listening on all interfaces that no descriptor claims, with the program name and pid
  4. User chooses Uninstall Fabric Dashboards… and confirms, leaving "Also delete my settings and activity history" unticked -> the app removes its login item and its entry in Claude Code's MCP servers, moves itself to the Trash and quits; once it has exited, its caches, logs and dashboard sessions are removed, and the settings, the activity history and a note of what to restore stay (SCN-043); services and their data always stay
- **Expected result:** the app fits the operator's day, stray network listeners are visible, and leaving the app removes everything it added without losing what the person set up
- **Alt paths:** user picks Русский (or English) under Language -> the window, the app menu and the tray switch at once, and machine reasons (a descriptor check, a network error) read in that language where they are known — a service's own words (tiles, events) stay as the service wrote them; As on this Mac follows the system language; the person turned the login item off in System Settings -> the next launch shows it off here and does not turn it back on; macOS holds the login item for approval -> every launch shows a notification "Fabric Dashboards cannot open at login — Allow it in System Settings → General → Login Items", and clicking it opens that pane; an update has been downloaded and verified -> a notification "Restart to finish updating" once per version, and clicking it restarts the app (asking first when a console session or a command runs); the person ticks "Also delete my settings and activity history" -> everything the app wrote is removed after it exits, nothing is restored later; settings.json is damaged -> the last good copy is restored and the log says so
- **UI elements:** toggles, Language select, per-service rows, time pickers, folder path with Show, Uninstall button and its confirmation with the delete-data box, listeners list
- **States covered:** empty, success, error
- **Errors & recovery:** macOS refuses the login item -> the toggle returns to off with "macOS refused the login item: <reason>" ("approve Fabric Dashboards in System Settings → General → Login Items" when it needs approval); the listener scan fails -> "Cannot list listeners: <reason>", and nothing listening is "None", not an error; uninstall cannot remove the MCP entry or the login item -> "Nothing was removed: <reason>" and the app stays (a refused login item puts the MCP entry back); the app cannot be moved to the Trash -> it says so and is still uninstalled; Show folder fails -> "Could not open <path>: <reason>"
- **Status:** validated
- **Coverage:** src/renderer/components/Settings.tsx, src/core/settings.ts, src/core/i18n.ts (chooseLang), src/core/machine-ru.ts, src/core/loginitem.ts (loginItemAtStartup: on by default, checked at every launch), src/electron/main.ts (login-item-startup, restart-to-update), src/core/uninstall.ts, src/core/listeners.ts, test/parts.test.ts, test/lifecycle.test.ts, test/e2e/overview-settings.test.ts
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
- **Status:** validated
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
- **Status:** validated
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
- **Status:** validated
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
  1. Agent calls `list_services` or `service_status` -> it receives each service's product, placement, state and reasons (codes), version and build, dashboard address, deep link (open_link), tiles, pending update, declared commands and problems, and how the app lists it (`category`, `hidden`, FD-78) — no token, and nothing of another program that answers a service's port
  2. Agent calls `link` for a job it started -> it receives the deep link as the primary dashboard action and the plain address for diagnostics; `host_status` distinguishes installed/absent/unknown/version/handler; `open` uses the existing host (browser only for confirmed absence with `fallback=if_absent`, never with `fallback=never`)
  3. Agent calls `control` (start, stop, restart), `doctor` or `update` -> the same launchd verbs and descriptor commands as the app run, and the tool returns the result it observed
  4. Agent calls `activity` -> recent events as sentences, each with a deep link when it points at a page
  5. Agent calls `spend` -> each agent's own usage entries (today, 7 and 30 days, per model, budget and every limit with its state; a null cost is unknown, `partial` a lower bound); a service that does not answer, or whose address another program answers, is an error entry — its spend is unknown, never "not reporting"
- **Expected result:** agents hand the operator the exact page and use the app's rules for administration instead of launchctl by hand
- **Alt paths:** an online service or one without launchd lifecycle -> `control` refuses; a missing launchd plist -> `control` refuses before calling launchctl; no declared doctor or update -> the tool refuses; an unknown tool -> a JSON-RPC error (-32602); an argument the tool does not declare -> refused; the app was updated under a running session -> the next call answers stale with both versions, and the server exits; `doctor` and `update` run the service's programs and are not marked read-only
- **UI elements:** none (agent tool results); the opened service view
- **States covered:** success, error
- **Errors & recovery:** installed-host open failure, unknown discovery, incompatible version and wrong handler open no browser; OS acceptance is not page readiness; a restart that gets no new answer within 40 s is reported as not done, with the state it left; a refusal is a tool error the agent reads, not a crash
- **Status:** validated
- **Coverage:** src/mcp/tools.ts, src/mcp/server.ts, test/mcp.test.ts, test/e2e/mcp-admin.test.ts, test/e2e/app.test.ts
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
- **Status:** validated
- **Coverage:** src/renderer/components/Overview.tsx, packages/service-host/src/descriptor.ts, test/remote.test.ts, test/e2e/remote.test.ts
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
- **Status:** validated
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
  2. The certificate does not verify -> Not answering, "The certificate of <origin> does not verify: <detail>. The app does not connect around it." — at once, even when it answered before: a certificate refusal is the origin's own verdict, not a slow host (R-19, FD-21)
  3. The service answers with a redirect -> Not answering, "<origin> answered with a redirect, which the app does not follow."; its platform answers HTTP 5xx (a deploy, an outage) -> after a minute, "<origin> is not up: its platform answers HTTP 503 …"
  4. Nothing answers for a minute -> Not answering, "<origin> has not answered since HH:MM."; one missed probe is not an outage (ADR-0008)
- **Expected result:** I can tell a configuration problem from an outage without opening a terminal
- **Alt paths:** another service answers the origin -> "Wrong program on port", "<origin> answers as <id.instance>, not as this service. The token is not sent there again." until the descriptor changes; the origin answers without the protocol -> "<origin> answers without fabric-service/0.1 (<detail>). The token is not sent there again until it asks for one." — later checks go without the token until the origin answers 401 or as this service (RemoteTokenLatch)
- **UI elements:** state badge, reason line, Health tab
- **States covered:** error
- **Errors & recovery:** each reason names the next action; none offers restart, because the platform supervises the service
- **Status:** validated
- **Coverage:** packages/service-host/src/state.ts, packages/service-host/test-vectors/state-precedence.json, src/core/i18n.ts, test/e2e/remote.test.ts (the refused token, then a redirect, a certificate the app does not trust, HTTP 503 after the minute's grace and silence, on the running app, 2026-10-14; it fails when the grace is removed)
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
  2. User looks below the agents in the sidebar -> the communicator is listed under **Services**; on Overview its card sits under Services too (ADR-0022)
  3. User clicks the Growth entry -> the default instance's page opens on its dashboard
- **Expected result:** five endpoints of two products read as two agents; nothing is hidden — every instance is one click away
- **Alt paths:** no `default` instance -> the first instance with a dashboard is the primary; a service that has never answered stays among the agents, not under Services
- **UI elements:** sidebar product entry, Services section, Overview product card, "also:" line
- **States covered:** success, empty
- **Errors & recovery:** an invalid descriptor of one instance keeps its own `invalid` state inside the product and in Attention
- **Status:** validated
- **Coverage:** src/core/products.ts, src/renderer/App.tsx, src/renderer/components/Overview.tsx, test/products.test.ts, test/e2e/products-problems.test.ts
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
- **Status:** validated
- **Coverage:** src/renderer/components/ServiceView.tsx (InstanceSwitch), src/renderer/App.tsx, test/e2e/products-problems.test.ts
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
- **Status:** validated
- **Coverage:** src/core/products.ts (memberProblem), src/renderer/App.tsx (ProductItem), test/products.test.ts, test/e2e/health-states.test.ts
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
  3. User clicks an agent's name -> the row expands to every limit the agent applies (DEC-0027) — which limit and for whom, its window, spent of limit, and its state (Stopped work, Over the limit, Close to the limit, Within, Spend not counted, Caps each order, Orders above it wait for you, Not enforced) — and below it the models: model, provider, calls, tokens in / out, cost over the last 31 days, most expensive first; a model the agent ran on the operator's own subscription is its own row, its cost read "~$140.47 subscription" (FD-88)
  4. User leaves the page open -> it is read again every minute while the window shows; a hidden window gets the last sums; Refresh reads now
- **Expected result:** where the money goes, per agent and per model, without opening a provider console
- **Alt paths:** a limit the operator chose not to apply -> still listed, muted, "Not enforced"; an approval threshold crossed -> "Orders above it wait for you", never a breach; a kind of limit the app does not know -> listed by the agent's own name for it; no agent reports -> "No agent reports its spend yet" with what an agent must publish; some agents report and others do not -> "Not reporting spend yet: …" names the others; an agent ran calls on the operator's own subscription (`route: subscription`) -> they spent no money and stay out of every sum; their list-price value shows beside it, "+ ~$140.47 on subscriptions", with a note under the table (FD-88); an agent asks through MCP `spend` -> the same sums, `estimateUsd` apart
- **UI elements:** Spend nav item, totals tiles, agents table with the Limits column, limits table, model breakdown, Refresh
- **States covered:** loading, empty, success
- **Errors & recovery:** see SCN-038
- **Status:** validated
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
- **Alt paths:** every call in a window unpriced -> that window reads "unknown"; no calls in a window -> "$0.00"; a row with calls and no cost -> a lower bound («≥»), whatever its unpricedCalls says; a cost reported without calls is kept, never zeroed; the report counts `unmeasuredCalls` for a model (calls whose tokens the agent could not count in full, DEC-0091) -> that model's tokens read "≥ 10,000 / 1,000" and the note below says "≥ beside tokens means the agent could not count every token of some calls…"; its cost is read as before; calls on the operator's own subscription that carry no price (FD-97, contract DEC-0110 `usageSpend`) -> the subscription value beside the money reads "+ subscription calls not priced" when none is priced, "+ at least ~$140.47 on subscriptions" when only some are, and that model reads "subscription, not priced", never ~$0; priced at $0 while others are not -> "+ at least ~$0.00 on subscriptions"; an agent whose report could not be read makes a priced estimate "at least"; the agent's Health tab reads the model the same way
- **UI elements:** "≥" amounts, "unknown", the note
- **States covered:** success
- **Errors & recovery:** a report claiming a price for calls it marks unpriced is refused as malformed (SCN-038)
- **Status:** validated
- **Coverage:** packages/service-host/src/usage.ts (summarizeUsage), packages/service-host/test/usage.test.ts (DEC-0091, FD-97), src/renderer/components/Spend.tsx (tokens, estimate, subscriptionCost), test/spend.test.ts, test/e2e/spend.test.ts (FD-97's alt path validated: the whole test passed on the running app on an unlocked screen, 2026-10-23 22:4x UTC)
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
- **Status:** validated
- **Coverage:** src/core/spend.ts (readSpend), src/core/probe.ts (fetchUsage), test/spend.test.ts, test/e2e/products-problems.test.ts
- **Product:** unobserved

## dashboard-toolbar

### SCN-039: Reload and move through an embedded dashboard
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-016, ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a service page, Dashboard tab
- **Preconditions:** the service is ready and its dashboard is open
- **Steps:**
  1. User looks above the page -> a toolbar of icons: Back, Forward (disabled until there is history), Reload page (its tooltip names ⌘R, F5 off macOS), Dashboard home, the page's address, and Copy (SCN-040)
  2. User clicks a link inside the dashboard -> the address follows the page, Back becomes available
  3. User clicks Reload page -> for a registered live service that requires sign-in, the app performs one fresh sign-in using its existing service token, then reloads the current same-origin page; concurrent clicks share the attempt, with a spinner through sign-in and page loading. A service without sign-in uses its ordinary reload
  4. User clicks Dashboard home -> the service's dashboard path opens, signed in
  5. User presses ⌘R (View → Reload Page; F5 on Windows and Linux) anywhere in the window, the console included -> the dashboard on screen reloads as in step 3; with no dashboard on screen every service is read again (FD-74)
  6. User presses ⇧⌘R (View → Reload Page Ignoring Cache; Shift+F5) -> the service's stored files are dropped first, then the page reloads as in step 3, so every file comes from the service again (FD-74)
- **Expected result:** the operator controls the embedded page like a browser tab, without leaving the app
- **Alt paths:** the page crashed -> "The page stopped." with Reload replaces the page and the toolbar (SCN-015); the service restarted -> the page reloads by itself (SCN-015); a page on another origin is never shown in the address; Ctrl+R stays the console shell's own reverse search off macOS
- **UI elements:** dashboard toolbar, View → Reload Page, View → Reload Page Ignoring Cache
- **States covered:** loading, success, error
- **Errors & recovery:** a reload or renewed sign-in that fails (including an HTTP error page) -> the existing page-error message with Retry (SCN-016); no automatic retry on a 404. A service no longer answering as the registered identity gets no token. Switching away while sign-in is pending prevents the completed attempt from taking over the current view
- **Status:** validated
- **Coverage:** src/renderer/components/ServiceView.tsx (DashboardToolbar), src/electron/views.ts (page, navigate, refresh), test/dashboard-refresh.test.ts, test/e2e/app.test.ts; native refresh acceptance pending
- **Product:** unobserved

### SCN-040: Copy a dashboard page's address or app link
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-016, ST-011 (JTBD-04)
- **Entry point:** the dashboard toolbar
- **Preconditions:** a dashboard page is open
- **Steps:**
  1. User clicks Copy (the icon at the toolbar's end) -> a menu: Copy address, Copy app link (FD-74: one button instead of two)
  2. User chooses Copy address -> the page's own address (`http://127.0.0.1:<port>/…` or the online `https://…`) is on the clipboard; the icon turns into a check mark and the button reads "Copied" for a moment
  3. User chooses Copy app link -> `fabric-dashboards://service/<id.instance>?path=…` is on the clipboard: pasted to an agent or a teammate on this Mac, it opens the same page here, signed in
  4. User clicks the address -> the whole address is selected for a manual copy
- **Expected result:** any page can be handed on in one click, in the form the receiver needs
- **Alt paths:** the page is the one-time sign-in URL -> the dashboard's address is copied instead; no login code ever reaches the clipboard; the menu closes without a choice -> nothing is copied
- **UI elements:** address field, Copy with its menu (Copy address, Copy app link)
- **States covered:** success
- **Errors & recovery:** none needed — both values are computed locally
- **Status:** validated
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
- **Status:** validated
- **Coverage:** src/renderer/components/Overview.tsx (StatusStrip), src/core/spend.ts (sumSpend), test/e2e/overview-settings.test.ts
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
  3. User clicks "Show all N" -> every row shows; "Show fewer" folds them back. Rows are counted after agents in one state for one reason fold into one line (FD-86, SCN-006): four agents silent for the same reason are one row, "4 agents: …", and nothing folds
- **Expected result:** the block never pushes the agents off the first screen
- **Alt paths:** three or fewer -> no toggle
- **UI elements:** Needs attention block, Show all / Show fewer
- **States covered:** error, success
- **Errors & recovery:** as SCN-006
- **Status:** validated
- **Coverage:** src/renderer/components/Overview.tsx, test/e2e/products-problems.test.ts
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

### SCN-048: Open an agent's console over its dashboard
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019 (JTBD-05, JRN-01/#8); ADR-0017 (amended 2026-10-23, FD-92)
- **Entry point:** "Console" in a service page's bar, or View → Show or Hide Console (⌃⌘T)
- **Preconditions:** none
- **Steps:**
  1. User presses "Console" -> the console drops down from under the page's bar, over the top of the dashboard, like a tab pulled open; the dashboard stays where it was, at its full width and height, and its lower part shows under the console's edge; the runtimes are read 3 s after the app starts, and what Switchboard said about the folder in the last 30 s is shown while it is asked again in the background, so a slow Switchboard never holds it (FD-74)
  2. User drags the console's bottom edge (or moves it with the up and down arrow keys) -> it grows or shrinks, from 180 px down to where some of the dashboard still shows; the height is remembered
  3. User presses "Console" again, or the fold arrow in the console's corner -> the console folds back up; whatever runs in it keeps running; opening it again shows everything it printed
  4. User presses the red cross in the console's corner -> a session that runs asks "End this session and close the console?"; "Close console" ends it and folds the console, Cancel keeps it; with nothing running the cross folds it at once
  5. User switches to another agent -> the console shows that agent's console; each agent has its own
- **Expected result:** a console that belongs to the agent is one press away over its dashboard, never moves the dashboard, folds without stopping anything, and closes only with its own red cross
- **Alt paths:** the window is hidden while a console runs -> it keeps running and nothing is sent to the window; showing it replays what was printed; the agent is removed -> its page closes and its console ends with it; one of the app's own dialogs opens -> the console steps out of the way until it closes; the Setup console (SCN-058) drops down the same way over its page; a Switchboard hand-over or a continued session no longer does: from 0.8.0 its console fills its own session page (SCN-080), and this console shows it only when it runs in this agent's own folder (SCN-069 step 2)
- **UI elements:** console drawer, its bottom edge with a grip, the fold arrow, the red cross, "Console" in the bar, View menu item
- **States covered:** success, empty
- **Errors & recovery:** n/a here; starting is SCN-049
- **Status:** validated
- **Coverage:** src/electron/drawer.ts, src/renderer/DrawerApp.tsx, src/renderer/components/ConsolePanel.tsx, src/core/layout.ts (drawerHeightFor), src/renderer/App.tsx, src/core/consoles.ts, src/electron/console.ts, test/layout.test.ts, test/console.test.ts, test/e2e/focus-console.test.ts (the drawer over the dashboard with both views' bounds, the height, the fold from the drawer and from the bar, the cross with its question, on the running app 2026-10-23)
- **Product:** unobserved

### SCN-049: Start a runtime in the agent's repository
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019 (JTBD-05, JRN-01/#8); ADR-0017
- **Entry point:** an agent's console that runs nothing yet
- **Preconditions:** at least one runtime (Claude Code, Codex or another known one) is installed
- **Steps:**
  1. User opens the console -> it shows the runtime (the last one used for this agent, else Claude Code, else the first one found), the folder found for this agent (its repository's local checkout) with "Other…", and one compact row: "New session" and "Continue last" on the left, the Open in Terminal icon on the right (FD-74)
  2. User presses "New session" -> the runtime's own interface starts in that folder, in the console; the user types to it as in any terminal, and its permission questions appear there
  3. User presses "Continue last" -> the runtime resumes its last conversation in that folder (`claude --continue`, `codex resume --last`)
  4. The runtime exits -> the console says "Exited (code 0)" with "New session" and "Continue last" again
- **Expected result:** the runtime the user chose runs in the agent's repository, with their settings and skills, one press from the dashboard
- **Alt paths:** "Other…" -> a folder dialog; the choice is remembered for this agent; the user picks another runtime -> remembered for this agent; the red cross -> the runtime ends after a confirmation and the console folds (SCN-048) if it is still running; "Open in Terminal" -> the same runtime continues in that folder in Terminal
- **UI elements:** runtime picker, folder line with "Other…", "New session", "Continue last", the red cross (SCN-048), "Open in Terminal", terminal, exit line
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
- **Alt paths:** the folder is in no project but Switchboard holds an account for the runtime's provider -> the session still runs through Switchboard, managed, on the account it selects for the folder (SCN-065); Switchboard is not installed, or holds no account for the provider -> the runtime runs on its ordinary sign-in, and the folder line says nothing about Switchboard
- **UI elements:** folder line with the project name, "Open in Terminal via Switchboard"
- **States covered:** success, error
- **Errors & recovery:** Switchboard needs its app or `switchboard serve` running -> its own message, shown as it says it; a managed session for the same project already runs -> Switchboard's refusal is shown as it says it; Switchboard's answer cannot be read -> "Switchboard did not answer; the session was not started" — never a silent fallback to the ordinary sign-in
- **Status:** validated
- **Coverage:** src/core/switchboard.ts, src/core/consoles.ts, src/electron/console.ts, test/console.test.ts
- **Product:** unobserved

### SCN-063: A session starts only when the Mac can carry it
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019; lifecycle LC-17; FD-49
- **Entry point:** an agent's console that runs nothing yet
- **Preconditions:** a runtime is installed and the folder exists
- **Steps:**
  1. User presses "New session" or "Continue last" -> the app checks the disk the folder is on (at least 5 GB free), the swap, and how many console sessions run (at most six at once)
  2. The Mac has room -> the session starts as in SCN-049
- **Expected result:** a session never starts only to make the Mac and its neighbours fail
- **Alt paths:** less than 5 GB free -> "Not started: only <n> GB is free on this disk, and a session needs 5 GB. Free some space, then start again."; six sessions already run -> "Not started: 6 console sessions already run, the most this Mac carries at once. Stop one, then start again."; Linux swap is nearly exhausted -> "Not started: the system has run out of swap…" (macOS grows its swap while the disk has room, so the disk check covers it)
- **UI elements:** the console's notice line
- **States covered:** success, error
- **Errors & recovery:** the disk or swap cannot be read -> the start is not refused for it; the person frees space or stops a session and presses the button again
- **Status:** validated
- **Coverage:** src/core/admission.ts, src/electron/console.ts, src/renderer/components/ConsolePanel.tsx, test/admission.test.ts, test/console-admission.test.ts, test/e2e/update.test.ts (the deferral observed on this Mac with 2.3 GB free, 2026-10-13)
- **Product:** unobserved

### SCN-064: See what Switchboard runs for this agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019; Switchboard SB-95; FD-43
- **Entry point:** an agent's console, shown
- **Preconditions:** Switchboard 0.6.18 or later is installed
- **Steps:**
  1. User opens the console -> under the folder line, each session Switchboard launched in this folder that starts or runs: "Switchboard: running", its account's label, its mode (managed or isolated) and since when
  2. The console stays open -> the list is read again every 15 seconds, and only while the console is on screen
- **Expected result:** the person sees which account and mode the agent's sessions use without opening Switchboard
- **Alt paths:** Switchboard is not installed and the runtime is one it serves -> "Switchboard is not installed, so sessions run on the ordinary sign-in and a provider limit pauses them."; an older Switchboard -> "This Switchboard cannot list its sessions yet; update Switchboard to see them here."; nothing launched here -> no line
- **UI elements:** session lines under the folder line
- **States covered:** empty, success, error
- **Errors & recovery:** Switchboard's answer cannot be read -> "Switchboard did not list its sessions: <its words>"
- **Status:** draft
- **Coverage:** src/core/switchboard.ts, src/electron/console.ts, src/renderer/components/ConsolePanel.tsx, test/switchboard-sessions.test.ts
- **Product:** unobserved

### SCN-065: A provider limit does not stop the agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019; lifecycle LC-20; Switchboard SB-98; FD-51
- **Entry point:** an agent's console with Claude Code or Codex chosen
- **Preconditions:** Switchboard can launch in place and holds an account for the provider
- **Steps:**
  1. User starts a session -> it runs through Switchboard in managed mode, in the console, whether or not the folder is in a Switchboard project
  2. A request is refused for a limit -> Switchboard moves the session once to its pool's next account and the agent goes on; the session line says "Switchboard moved this session to <account> after a limit; the agent goes on."
- **Expected result:** the agent keeps working while any account in the pool has room
- **Alt paths:** Switchboard holds no account for the provider, or cannot launch in place -> the runtime runs on its ordinary sign-in (SCN-049)
- **UI elements:** session line with the moved notice
- **States covered:** success
- **Errors & recovery:** Switchboard refuses the launch -> its own words in the console, and "New session" again
- **Status:** draft
- **Coverage:** src/core/consoles.ts, src/core/switchboard.ts, src/electron/console.ts, test/switchboard-sessions.test.ts
- **Product:** unobserved

### SCN-066: An idle session closes and comes back
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019, ST-023; lifecycle LC-18; FD-50; operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-04
- **Entry point:** a console session running with no input or output
- **Preconditions:** none
- **Steps:**
  1. Thirty minutes pass with nothing typed and nothing printed -> the app saves when it closed, the Switchboard account it ran on and its conversation, and closes the session, which frees its memory and its MCP servers
  2. The session was an agent's own console -> opening that agent's console again continues it ("Continue last") with "This session was closed after 30 idle minutes to free memory and is continued now. Account: <account>"
  3. Any closed session, a hand-over's or a continued one's included -> the Sessions mode lists it under "Ended in the last 24 hours" as "Closed after 30 idle minutes", with Continue and Remove (SCN-084); Continue resumes the same conversation in the same folder on the saved account
- **Expected result:** a session nobody uses holds nothing, and coming back costs one press, wherever it came from
- **Alt paths:** the runtime cannot continue a conversation -> in an agent's console "This session was closed after 30 idle minutes to free memory. New session starts a fresh one.", and in Sessions the button reads "New session here" (SCN-084); the person starts a session themselves first -> the saved mark is cleared
- **UI elements:** the console's notice line; the Sessions mode's ended row with Continue and Remove
- **States covered:** success
- **Errors & recovery:** the continue cannot start (no room, SCN-063) -> that notice instead, and the row keeps both actions
- **Supersedes:** for a hand-over or a continued session, the dead end of SES-04 (its console was reopened only from the sidebar's Hand-overs section, whose text named a "New session" button that was never drawn there): from 0.8.0 SCN-084 owns its Continue
- **Status:** draft
- **Coverage:** none yet for the Sessions mode (dossier nodes S2 and S3); the agent console's idle close and continue (validated 2026-10-14): src/core/consoles.ts, src/electron/console.ts, src/core/settings.ts, src/renderer/components/ConsolePanel.tsx, test/switchboard-sessions.test.ts
- **Product:** observed 2026-10-14 on this Mac (installed copy, `main.log`): an agent's console closed after 30 idle minutes at 16:29:29 UTC and, opened again at 16:39:33, continued (`started claude-code (continue) … through Switchboard`); two hand-over consoles closed the same way at 19:59 and 21:00

### SCN-067: Dashboards take my scheme and theme
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-019; contract DEC-0036 ED-8/ED-10, DEC-0059; FD-42, FD-56
- **Entry point:** Settings → the app group
- **Preconditions:** none
- **Steps:**
  1. User picks the colour scheme: Same as macOS, Dark or Light -> the app follows it at once
  2. User picks the dashboard theme: Graphite, Fabric, Paper, Forest, Ocean, Ember or High contrast -> every open dashboard that follows the app takes the scheme and the theme without a reload; the others keep their own
  3. User opens a dashboard later -> it opens in that scheme and theme, and the empty view behind it is already the right colour
- **Expected result:** one choice in one place sets the look of every dashboard that follows the app
- **Alt paths:** a dashboard declares the themes it ships and the chosen one is not among them -> it gets the scheme only and keeps its own default theme; a dashboard declares nothing, or an invalid profile -> it follows macOS's light or dark only, and an invalid profile is written to the log once per load; Same as macOS -> macOS switching light/dark is followed live
- **UI elements:** Settings → colour scheme, dashboard theme, the hint under them
- **States covered:** success
- **Errors & recovery:** the cookie cannot be written -> the dashboard follows macOS's light or dark, which every dashboard must handle
- **Status:** validated
- **Coverage:** src/core/appearance.ts, src/electron/views.ts, src/renderer/components/Settings.tsx, src/renderer/App.tsx, test/appearance.test.ts, packages/service-host/test/look.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-068: See which runner and model an agent uses
- **Persona:** P-01
- **Feature:** service
- **Traces:** ST-019; contract DEC-0046; FD-46
- **Entry point:** an agent's page → Health
- **Preconditions:** the agent declares `configuration` in its well-known document
- **Steps:**
  1. User opens Health -> "Runner and model": the runner (kind, profile, subscription or API key), the model profile and its models, who set it (this agent, the project, the default), what it spent per model over 31 days, and the budget left
  2. User presses "Change in Fabric" -> Fabric opens a conversation about this agent, where the profile is changed
- **Expected result:** the person sees what the agent runs on and what it costs, one press from changing it
- **Alt paths:** the agent declares no configuration -> no section; it reports no usage -> "No usage reported"; budget left -> "Shown here once Project Observatory publishes its budgets" until it does (FD-40); Fabric is not installed -> Fabric's button offers its download (ADR-0021)
- **UI elements:** Health → Runner and model, Change in Fabric
- **States covered:** empty, loading, success
- **Errors & recovery:** the usage report cannot be read -> no spend line beyond "No usage reported"; Spend says why
- **Status:** validated
- **Coverage:** src/renderer/components/ServiceView.tsx, packages/service-host/src/protocol.ts, test/e2e/profile.test.ts
- **Product:** unobserved

### SCN-069: A hand-over opens in the console
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023, ST-019 (JTBD-05, JRN-01/#9); Switchboard SB-108; FD-62 (operator 2026-10-12: «открывать агентов внутри Фабрики, чтобы не копились терминалы»); operator review 2026-10-24 ("This place should hold agents, not handed-over sessions."); SES-01, SES-02, SES-03, SES-06; COPY-17
- **Entry point:** nothing to press: Switchboard hands a continuing session over while Fabric Dashboards runs
- **Preconditions:** Switchboard 0.6.26 or later with "Open sessions handed over by Switchboard here" on (Settings → Sessions, SCN-086, or `switchboard handovers set on`); the running Switchboard app is as new as its CLI
- **Steps:**
  1. Switchboard's automatic fallback prepares a continuing session and leaves it as a hand-over -> within 15 seconds (60 while the window is hidden) the app takes it with `switchboard handovers run <id>` on a console
  2. The hand-over's folder is a registered agent's console folder and that console runs nothing -> the session runs in that agent's console, under "Handed over by Switchboard: <workflow>, on <account>."; it is also listed in Sessions under "Running", and its session page shows the same console
  3. Otherwise -> the session runs in a console of its own, listed only in the Sessions mode, under "Running", its row reading "<project>" over "<coding agent> · <account> · handed over · <time>"; its page (SCN-080) carries "Handed over by Switchboard after a limit on <account>, <time>" and its console full height
  4. The app has taken it -> one notification (SCN-085); the mode the window shows does not change
  5. The session ends -> it moves to "Ended in the last 24 hours" as "Ended at <time>", or "Closed after 30 idle minutes", with Continue and Remove (SCN-084), and stays listed across a restart for 24 hours
- **Expected result:** Switchboard's continuing sessions run inside the app, not in a new Terminal window each, and are listed with the other sessions, never among the agents
- **Alt paths:** less than 5 GB free or six sessions already run, the folder is not on this Mac, the offer expired before it could be taken, or the running Switchboard is older than its CLI -> the app leaves the hand-over and lists it under "Needs you" with that reason in one sentence, followed by "Switchboard opened it in Terminal." once Switchboard does after two minutes (SCN-082); another console or Terminal took it first -> the console shows Switchboard's own message; Switchboard is not installed -> nothing is read
- **UI elements:** the Sessions mode's rows and cards, the session page, the agent console's hand-over line, the notification
- **States covered:** empty, success, error
- **Errors & recovery:** a hand-over that cannot be read or taken goes to Terminal on Switchboard's side after two minutes; nothing is lost, and the Needs you row says where it went
- **Supersedes:** step 3's sidebar section "Hand-overs" above the agents and its hand-over page (by SCN-077, SCN-078, SCN-080); step 4's "Ended" glyph and Close in the page body under the drawer (by SCN-084); the console dropping down over the hand-over page (by SCN-080's full-height console); the alt path's silent "nothing is taken" and "logged once" (by SCN-082)
- **Status:** draft
- **Coverage:** none yet for the Sessions mode (dossier nodes S2 and S3); the taking of a hand-over (validated 2026-10-14): src/core/switchboard.ts, src/electron/console.ts, src/electron/main.ts, test/handovers.test.ts; live on the installed 0.7.9 (2026-10-14, main.log): `ho-fcdfdee61542` taken in `handover.ho-fcdfdee61542` at 19:28:32Z and `ho-3bec5ef68052` at 20:29:35Z, each once and within the 15 s poll, under Switchboard's 120 s Terminal fallback (workflow `wf_5e78a8c1a8ee6c19`, run by Switchboard's session)
- **Product:** unobserved

### SCN-071: See agents on this Mac, online and services apart
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-021 (JTBD-01); FD-78 (operator 2026-10-20)
- **Entry point:** the sidebar and Overview
- **Preconditions:** at least one agent
- **Steps:**
  1. User opens the app -> the sidebar lists Pinned, then "On this Mac", "Online" and "Services", each sorted by the chosen sort; Overview shows the same three groups of cards
  2. User opens an agent's row menu and chooses "Show as a service" -> it moves to Services at once, in the sidebar and on Overview; "Show as an agent" moves it back
  3. User restarts the app -> every choice is as it was
- **Expected result:** the agents the person works with are not mixed with the services that keep them running
- **Alt paths:** a product whose members answer and none offers a dashboard is a service until the person says otherwise; choosing what the app would guess anyway removes the choice; an online service (remote, no dashboard) is a service too; a section with nothing in it is not shown
- **UI elements:** section headers, the row menu (Pin, Show as a service or an agent, Hide), the sort in the first section's header
- **States covered:** success, empty
- **Errors & recovery:** a damaged choice in settings is dropped and the app's guess applies
- **Status:** validated (test/e2e/focus-console.test.ts (ADR-0017 test, FD-78 steps) passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** src/core/products.ts (categoryOf, arrangeProducts, setKind), src/core/settings.ts (mergeList), src/renderer/App.tsx (RowMenu), src/renderer/components/Overview.tsx, test/listorder.test.ts *FD-78*, test/e2e/focus-console.test.ts *FD-78*
- **Product:** unobserved

### SCN-072: Hide an agent without stopping it
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-021 (JTBD-01); FD-78 (operator 2026-10-20)
- **Entry point:** the agent's row menu → Hide
- **Preconditions:** at least one agent
- **Steps:**
  1. User chooses Hide -> the agent leaves its section (and Pinned) and a folded "Hidden: 1" appears at the bottom of the sidebar and of Overview; in the narrow rail the fold is an entry of its own
  2. User opens the fold -> the hidden agents are listed; clicking one opens it as usual
  3. User chooses "Show again" -> it returns to its section, pinned again if it was pinned
- **Expected result:** service agents the person does not look at take no room, and nothing about them stops
- **Alt paths:** a hidden agent fails -> Needs attention lists it as before, its outage still reaches the operator channel, and the folded header carries a "!" ("A hidden agent needs attention"); the fold's open or closed state is remembered; a hidden agent that is removed leaves the list
- **UI elements:** Hide and Show again in the row menu, the "Hidden: N" fold with its mark
- **States covered:** success, empty, error
- **Errors & recovery:** n/a
- **Status:** validated (test/e2e/focus-console.test.ts (ADR-0017 test, FD-78 steps) passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** src/core/products.ts (toggleHidden, arrangeProducts), src/renderer/App.tsx, src/renderer/components/Overview.tsx, test/listorder.test.ts *FD-78*, test/e2e/focus-console.test.ts *FD-78*
- **Product:** unobserved

### SCN-073: See what an agent is connected to
- **Persona:** P-01
- **Feature:** service
- **Traces:** ST-019 (JTBD-01); FD-78 (operator 2026-10-20); contract DEC-0096 `extensions/connections/0.1` (board thread with fabric-agent-contract)
- **Entry point:** an agent's page → Connections tab (every agent, services included)
- **Preconditions:** the agent answered at least once
- **Steps:**
  1. User opens Connections -> one line: the worst state anywhere in its connections in a word and a shape ("Works", "Partly works", "Does not work", "Not known"), how many connections, how many with problems
  2. User reads three columns -> "Used by": the agents here whose declarations name it; in the middle the agent itself, what it offers (dashboard, MCP and its capabilities, events, spend report); "Uses": agents, models, runner, connectors, data stores, channels and the parts it reports, each with its state, its target and why
  3. User reads a connection to another agent -> it carries that agent's own state too (the worse of the two) and, below it, that agent's connections, up to three levels; an agent already shown in the chain is not repeated
  4. User clicks a connected agent -> its page opens on its Connections tab
- **Expected result:** the person sees what an agent depends on and what depends on it, and where in the chain something does not work
- **Alt paths:** another agent names it twice (two capabilities) -> one row in "Used by" with both; an agent asks through MCP -> `connections` answers the same graph and `list_services` carries `category` and `hidden`; the agent declares no connections -> a line says so, and the tab shows what the app sees: the models of its spend report (with their calls over 30 days), its runner, the parts it reports failing, the agents that name it; the declaration is invalid -> "the declaration is invalid, so none of it is shown" with the reasons, and the rest as for no declaration; a declared agent that is not installed here reads "Not known"; a part the agent reports failing that a declaration names marks that connection; nothing known -> "Nothing known yet."
- **UI elements:** Connections tab, summary line, Used by list, the agent card with its offers, the Uses groups with the chain drawn as a tree
- **States covered:** loading (models being read), empty, success, error
- **Errors & recovery:** an unreadable spend report leaves models out, never blocks the tab
- **Status:** validated (test/e2e/focus-console.test.ts and test/e2e/connections.test.ts *FD-78* passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** packages/service-host/src/connections.ts, src/core/connections.ts, src/renderer/components/Connections.tsx, src/mcp/tools.ts (connections, listing), packages/service-host/test/connections.test.ts, test/connections.test.ts, test/mcp.test.ts *FD-78*, test/e2e/connections.test.ts, test/e2e/focus-console.test.ts *SCN-073*
- **Product:** unobserved

### SCN-074: See how agents are wired and what the auditor found
- **Persona:** P-01
- **Feature:** connections
- **Traces:** ST-019 (JTBD-01); FD-81 (operator 2026-10-21); ADR-0023
- **Entry point:** sidebar → Connections (its count is what does not work)
- **Preconditions:** at least one agent
- **Steps:**
  1. User opens Connections -> one line: "Does not work: N · Works in part: N · Waits for you: N · Updates: N" (only the ones above zero), or "The auditor found nothing to fix."; below it "Agents that declare their connections: X of Y."
  2. User reads the Map -> each agent a box with its state as a shape and a colour, calls drawn left to right, the worse state of the call and the agent reached on each line; an agent named but not installed is a dashed box "not installed here"; agents with no line are under "Not connected"
  3. User reads the Auditor -> one row per agent to fix, worst first: its name, its key and each finding in a sentence ("google-ads fails: quota exhausted", "It relies on Relay, which does not answer.", "Version 2.0.0 is available.")
  4. User picks the coding agent in "Start in" (the one chosen for that agent, Claude Code by default) and presses "Fix with agent" -> the agent's page opens with its console, the chosen runtime starts in the agent's folder with the findings as its task
  5. User clicks an agent's name or box -> its page opens on its Connections tab
- **Expected result:** every problem in the estate in one place, where each comes from, and one click to hand it to a coding agent
- **Alt paths:** no agent declares a connection to another -> "No agent declares a connection to another agent yet, so there is no line to draw." with how to declare one; a row whose only findings are about an agent it relies on, or an update -> no Fix button (the fix goes where the cause is); no coding agent installed -> "No coding agent is installed, so a session cannot start here."; an agent asks through MCP -> `audit` answers the same findings, counts, coverage and edges
- **UI elements:** Connections nav item with its count, the summary line, the coverage line, the Map, Not connected chips, the Auditor rows with Start in and Fix with agent
- **States covered:** empty, success, error
- **Errors & recovery:** an agent's spend report that cannot be read leaves its limits out, never the rest
- **Status:** validated (test/e2e/connections.test.ts *FD-78* (the map and the auditor, FD-81 steps) passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** src/core/audit.ts, src/core/estate-map.ts, src/renderer/components/ConnectionsMap.tsx, src/core/handoff.ts (auditTask), src/mcp/tools.ts (auditAll, setupCheck), test/audit.test.ts, test/mcp.test.ts *FD-81*, test/e2e/connections.test.ts, test/e2e/focus-console.test.ts *FD-81*
- **Product:** unobserved

### SCN-075: A session stopped on a limit continues by itself
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023, ST-019 (JTBD-01, JTBD-05, JRN-01/#9); FD-83 (operator 2026-10-21, «лимиты прошли ... перезапускай агентов»); Switchboard SB-115 (the host acts on `ready` rows); operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-05, SES-07
- **Entry point:** nothing to press: the app reads Switchboard's stopped sessions with the hand-overs (every 15 s with the window shown, 60 s hidden); the Sessions mode lists them; Settings → Sessions → "Continue sessions after a limit reset"
- **Preconditions:** Fabric Switchboard installed and its StopFailure hook registering stops; the switch on (the default)
- **Steps:**
  1. A coding session stops on a usage limit -> Switchboard records the stop, and Sessions lists it under "Waiting for a limit reset" with when it is expected to continue (SCN-083); once an account has capacity again Switchboard marks it ready
  2. The app finds a ready stop that stopped within a day, whose folder is on this Mac and in which no claude or codex process works and no process names its session -> its conversation is in the person's own Claude Code or Codex home, it claims the stop once in Switchboard, continues it in a console with the agent's own CLI in that folder (`claude --resume <session> "The usage limit has reset. Continue your task from where it stopped."`; a folder bound to a Switchboard group routes it through Switchboard by its own settings) and records `resumed` once the session is still running and has written its own transcript (within 30 seconds); at most two in one pass (FD-84)
  3. The session opens in the free console of the agent whose folder it is, else in a console of its own -> Sessions lists it under "Running", its row reading "after a limit reset", its page carrying "Continued after a limit reset, <time>" and "Stopped on a usage limit and continued here by <agent> once Switchboard had capacity again."
- **Expected result:** sessions the operator left running come back by themselves after a limit, never twice and never next to a terminal still holding them; every stop is in the Sessions mode with when it comes back or what it waits for
- **Alt paths:** its terminal is still open -> "Needs you" with "Its terminal is still open: type "continue" there." and nothing is claimed; no account has capacity -> it waits with "Waits for an account with capacity." (SCN-083); a payment limit -> "Needs you" with "Stopped on a payment limit: a top-up is needed."; stopped more than a day ago -> "Needs you" with "Stopped more than a day ago: open it yourself if the task is still open."; the folder is not here -> "Needs you" with "Its folder is not on this Mac."; its conversation is not in the person's own home -> "Needs you" with "Its conversation is not in your Claude Code or Codex home, so it cannot be continued here." and nothing is claimed; each of these "Needs you" rows offers Remove (SCN-082); the continued session exits, or runs without writing its transcript within 30 seconds -> recorded `cancelled`: one that exited is under "Needs you" with "Could not be continued here; see the log." and Remove, and one left running (silent) is under "Needs you" with "Did not continue; its process is still running", Open console and End (SCN-082); the Mac cannot carry another console now (LC-17) -> nothing is claimed and the next pass tries again; another host took the stop -> it is not listed here; the switch is off -> every stop waits with "Continuing by itself is off in Settings, so it waits for you." and the actions of SCN-083; an agent asks through MCP -> `audit` answers `limitStops` with the same verdicts, read-only
- **UI elements:** the Sessions mode's Waiting, Running and Needs you rows, the session page's origin chip and console line, the Settings → Sessions switch
- **States covered:** empty, success, error
- **Errors & recovery:** a claim Switchboard refuses starts nothing ("Could not be continued here; see the log."); a claimed stop whose console cannot start is recorded `cancelled`; Switchboard not answering says so on All sessions (SCN-078); live processes that cannot be read count as open, never as none
- **Supersedes:** Connections → "Sessions stopped on a limit" with its Open (step 4 and the section, by SCN-078, SCN-082 and SCN-083); the console "listed under Hand-overs by its folder's name" (by SCN-078 and SCN-080); the Settings group "Sessions stopped on a limit" (by SCN-086)
- **Status:** draft
- **Coverage:** none yet for the Sessions mode (dossier nodes S2 and S3); the automatic continue (validated 2026-10-23): src/core/recovery.ts, src/electron/console.ts (pollRecovery), src/mcp/tools.ts (limitStops), test/recovery.test.ts, test/e2e/connections.test.ts *FD-83*
- **Product:** unobserved

### SCN-076: See how busy an agent is
- **Persona:** P-01
- **Feature:** service
- **Traces:** ST-019 (JTBD-01); FD-93; contract DEC-0104 (`extensions/load/0.1`, `service-load/1`, FAC-SEM-132, FAC-SEM-133), which names Fabric Dashboards as the host that draws the load panels; ADR-0024
- **Entry point:** an agent's page → Load tab (there only when the agent declares its load, rightly or not)
- **Preconditions:** the agent answered at least once and its well-known document carries the load key
- **Steps:**
  1. User opens Load -> four numbers: running now, waiting, done and failed in the last 24 hours (every window any part of which lies in that day); anything waiting reads as work to watch, a failure as trouble. No count is set against a limit: DEC-0104's limits are per agent and context and the report sums every agent the service hosts
  2. User reads the lines below -> the limits ("Each agent it hosts runs at most 4 at once in each context and 2 for one caller; 3 more may wait.", or "nothing waits" when the queue is 0), with one context the latest wait in the queue and run time (median and 95 %), and a bar per window of what was done and what failed
  3. User reads By context (two contexts or more) -> one row per context: running, waiting, done, failed, wait and run at 95 %, a time never measured reads "not measured"
  4. User presses Refresh -> it is read now; while the tab is open it is read again every minute
- **Expected result:** the person sees whether an agent keeps up with its calls, where it waits, and whether its queue refuses work, without opening the agent's own dashboard
- **Alt paths:** the agent declares its load wrongly -> "This agent declares its load wrongly, so it is not read" with each reason (FAC-SEM-133) and no read is made; the report refuses the token, does not answer, is not JSON or fails its checks (FAC-SEM-132) -> "The load report could not be read" with the reason, and the limits it declared; the report has no window -> "Nothing has run yet"; the report is older than two of its windows -> a note that its counts are of then; an agent that declares nothing has no Load tab; the declaration goes while the tab is open (the agent stops answering, or drops the key) -> the page falls back to Dashboard or Health, never an empty pane; an invalid declaration is a finding of the auditor too (Connections page, MCP `audit`); an agent asks through MCP -> `load` answers the same declaration and sums, or `invalid` / `error` with the reason; the window is hidden -> the last read is answered, nothing is read (LC-08)
- **UI elements:** Load tab, read-at line with Refresh, the four-number strip, the limits line, the wait and run lines, the bar chart, the By context table, the warning and error notices
- **States covered:** loading, empty, success, error
- **Errors & recovery:** any failure is that agent's notice with its reason, never a blank tab or a zero; the token goes only to the agent's own well-known answer (S-1)
- **Status:** validated (test/e2e/load.test.ts *FD-93* passed on the running app, 2026-10-23; the review fixes, fallback and hidden-window steps included, passed 2026-10-24, the fallback step seen failing without its fix)
- **Coverage:** packages/service-host/src/load.ts, src/core/load.ts, src/core/probe.ts (fetchLoad), src/electron/main.ts (load-ipc), src/renderer/components/Load.tsx, src/mcp/tools.ts (load), packages/service-host/test/load.test.ts, test/load.test.ts, test/mcp.test.ts *FD-93*, test/e2e/load.test.ts
- **Product:** unobserved

### SCN-070: Check what is set up
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-017; FD-65; PassionCode launcher ADR-0004 (`doctor`), roadmap RM-09
- **Entry point:** Settings → Setup → "Check setup", or the setup card on Overview
- **Preconditions:** none; Node.js 18 or later is needed for the check itself
- **Steps:**
  1. User presses "Check setup" -> "Checking… this can take up to two minutes." while the app runs the PassionCode launcher's read-only `doctor` at a pinned version (`npx --yes @passioncode-ai/passioncode@0.2.2 doctor --json`, no shell, two-minute cap)
  2. The check ends -> one line: "Failing: <n> · Warnings: <n> · OK: <n> · checked at HH:MM"; below it every failing and warning check, grouped by area (Prerequisites, Skills, Apps, MCP servers, Services), an area with a failure first and failures first within it, each with its own words and "Fix:" followed by the launcher's fix
  3. User presses "Repair with my coding agent" -> the Setup console opens beside Overview; its brief starts with what the check found, failures first, each with its fix
- **Expected result:** the person sees in one place what is not set up on this computer and hands the repair to their coding agent; the app runs no repair itself
- **Alt paths:** the setup card's three steps are done -> the card is one quiet line "Everything is set up." with Check setup and Hide (FD-81); an agent asks through MCP -> `setup_check` runs the same read-only doctor; every check passes -> "Every check passed." and no repair button; Node.js is not installed -> "Node.js 18 or later is not installed, so the check cannot run. Install it from nodejs.org, then check again."; the launcher answers anything but its report -> "The check could not run: <its first line>"; no answer in two minutes -> "The check could not run: no answer within 120 s"; a second press while a check runs joins it; the last result stays until the next press and is never re-run on its own
- **UI elements:** Check setup button, the summary line, the grouped lines with their fixes, Repair with my coding agent
- **States covered:** loading, success, error
- **Errors & recovery:** each error names what to do; the check is read-only, so pressing again is always safe
- **Status:** validated
- **Coverage:** src/core/doctor.ts, src/electron/main.ts (setup-check), src/renderer/components/Overview.tsx (SetupCheck), src/core/setup.ts (the brief), test/doctor.test.ts, test/e2e/overview-settings.test.ts *SCN-070* (on the running app, with a fixture standing in for npx that refuses any other arguments, 2026-10-14); the real launcher's `doctor --json` 0.2.2 answered on this Mac in 27 s (44 checks, 0 failing)
- **Product:** unobserved

### SCN-060: The dashboard keeps its floor while the console widens
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019 (JTBD-05, JRN-01/#8); ADR-0017; Fabric Agent Contract DEC-0036 ED-7, ED-9 ([PR #27](https://github.com/passioncode-ai/fabric-agent-contract/pull/27))
- **Entry point:** the console panel's left edge, dragged or moved with the arrow keys, beside a service's dashboard
- **Preconditions:** the console is open
- **Steps:**
  1. User drags the console's edge to the left -> the console widens and the dashboard narrows until the dashboard is 480 px wide, or as wide as the service declares its page needs (its `minWidth`, 360 to 1280 px) when that is more; there the edge stops, and a screen reader hears the separator at its maximum
  2. User makes the window narrower -> the console gives way first and the dashboard keeps its floor; the width the user dragged to is still remembered
  3. User makes the window wider again -> the console returns to the width the user dragged to
- **Expected result:** the console never squeezes a dashboard below the width the page was built for; the page is never zoomed to fit
- **Alt paths:** the window is too narrow for both the console's 320 px and the dashboard's floor (for example the smallest window, 960 px, with the full sidebar) -> the console keeps its 320 px and the dashboard gets what is left, laid out by the page itself (it scrolls sideways rather than collapse); collapsing the sidebar (SCN-047) or the console gives the dashboard its floor back; a service that declares nothing, or a `minWidth` outside 360 to 1280, gets the 480 px every dashboard gets; the user presses the right arrow key at the floor -> the console narrows by 24 px, and the left arrow key there changes nothing and keeps the remembered width
- **UI elements:** console panel, its edge handle (separator with its current maximum)
- **States covered:** success
- **Errors & recovery:** n/a — a layout rule that never fails; an invalid declaration is treated as no declaration
- **Status:** retired (2026-10-23, FD-92: the console drops down over the dashboard and never narrows it, so the dashboard always has its whole width; ED-7's floor holds by construction)
- **Coverage:** test/e2e/focus-console.test.ts (the floor, the narrower and wider window, the left arrow key at the floor and the 960 px window on the running app, 2026-10-14), src/core/layout.ts, src/renderer/App.tsx, src/renderer/components/ConsolePanel.tsx, packages/service-host/src/protocol.ts, src/core/monitor.ts, test/layout.test.ts, packages/service-host/test/protocol.test.ts, test/flap.test.ts (DEC-0036 ED-9), test/mcp.test.ts (DEC-0036 ED-9)
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

### SCN-053: The console's agent already knows which agent it works on
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-020 (JTBD-06, JRN-02/#4); ADR-0020
- **Entry point:** New or Continue in an agent's console (SCN-049)
- **Preconditions:** a runtime is installed; the agent's folder is known
- **Steps:**
  1. User presses New -> the app writes the agent's context (state and reasons, problems, last events, version and update, repository, folder, descriptor without its token) into its own data folder and starts the runtime with it: Claude Code with it as its system prompt and this app's MCP tools; Codex with the MCP tools and a first prompt that reads it; any other runtime with FABRIC_DASHBOARDS_CONTEXT naming the file
  2. User asks "why is it degraded?" -> the agent answers from the context, or calls `service_context` for the live state
  3. User presses Continue later -> the context is written again, fresh, before the session resumes
- **Expected result:** the person gives the agent a task, never the situation
- **Alt paths:** the context cannot be written (disk full) -> the session starts without it and the app's log says why; a Switchboard-bound folder -> the same context goes through Switchboard's in-place launch
- **UI elements:** console panel (unchanged); the runtime's own interface
- **States covered:** success, error
- **Errors & recovery:** context not written -> logged, session still starts; nothing of the token ever reaches the context
- **Status:** validated
- **Coverage:** src/core/handoff.ts, src/electron/console.ts, src/mcp/tools.ts (service_context), test/handoff.test.ts, test/mcp.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-054: Fix with agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-020 (JTBD-06, JRN-02/#4); ADR-0020
- **Entry point:** "Fix with agent" beside a problem in Overview's Needs attention, in a service's reasons, or after a failed command
- **Preconditions:** the agent has a problem (down, degraded, invalid, a failed doctor or update)
- **Steps:**
  1. User presses "Fix with agent" -> the agent's page opens with its console; the runtime starts with the context and a task: what is wrong, and that fixed means `service_status` says ready
  2. User watches -> the runtime's own interface shows what it reads and runs; it asks before anything destructive, any sign-in or secret
  3. The agent fixes it -> the agent's state turns ready in the list and the page, with no refresh
- **Expected result:** a problem becomes a running fix in one click, and the person sees it resolve
- **Alt paths:** a console already runs for this agent -> the app says so and offers to show it, never a second session; no runtime installed -> the console's install guidance (SCN-049)
- **UI elements:** "Fix with agent" button; console panel
- **States covered:** success, error, loading
- **Errors & recovery:** the runtime fails to start -> the console says why (SCN-049's errors)
- **Status:** validated
- **Coverage:** src/core/offers.ts (offersFix), src/core/handoff.ts (fixTask), src/renderer/App.tsx (handToAgent), src/renderer/components/ConsolePanel.tsx, ServiceView.tsx (header and card), Overview.tsx (Needs attention), test/handoff.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-055: Update with agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-020 (JTBD-06, JRN-02/#4); ADR-0020
- **Entry point:** "Update with agent" where an update is offered and the agent has no update command, or its update command failed
- **Preconditions:** the agent reports a newer version, or its update failed
- **Steps:**
  1. User presses "Update with agent" -> the console starts the runtime with the context and a task: from which version to which, how (the descriptor's command, or the repository's own instructions), and the failed output when there is one
  2. The agent updates and restarts it -> the page shows the new version
- **Expected result:** every update has a way through, even one the agent's own command cannot do
- **Alt paths:** the agent's update command exists and has not failed -> "Update to <v>" runs it as before (no coding agent needed)
- **UI elements:** "Update with agent" button
- **States covered:** success, error
- **Errors & recovery:** as SCN-054
- **Status:** validated
- **Coverage:** src/core/offers.ts (offersAgentUpdate), src/core/handoff.ts (updateTask), ServiceView.tsx, Overview.tsx, test/handoff.test.ts, test/e2e/update.test.ts (the agent started on `task.md` naming 0.3.0 and the failed output, on the running app with 7.1 GB free, 2026-10-14)
- **Product:** unobserved

### SCN-056: Pin an agent to the top of the list
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-021 (JTBD-01, JRN-02/#5); ADR-0020
- **Entry point:** the agent's row menu (the small button on its row, FD-78)
- **Preconditions:** at least one agent
- **Steps:**
  1. User pins an agent -> a Pinned section appears above the rest with it; pinning another adds it below the first
  2. User unpins it -> it returns to its place in the sorted rest; an empty Pinned section disappears
  3. User restarts the app -> the Pinned section is as it was
- **Expected result:** the agents the person works with are always first
- **Alt paths:** a pinned agent is removed -> it leaves the list; reinstalled with the same id, it is pinned again
- **UI elements:** pin control on the row, Pinned section header, rail mode keeps pinned first
- **States covered:** success, empty
- **Errors & recovery:** n/a
- **Status:** validated
- **Coverage:** src/core/products.ts (arrangeProducts, togglePin), src/core/settings.ts, src/renderer/App.tsx, test/listorder.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-057: Sort the agents list
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-021 (JTBD-01, JRN-02/#5); ADR-0020
- **Entry point:** the sort control at the top of the list
- **Preconditions:** two or more agents
- **Steps:**
  1. User chooses Status -> agents needing attention come first, then the rest by name
  2. User chooses Recent activity -> the agent with the newest event comes first
  3. User chooses Name -> alphabetical, as before
- **Expected result:** the list is in the order the person works in; the choice is remembered
- **Alt paths:** pinned agents keep pin order whatever the sort; On this Mac, Online, Services and Hidden are each sorted inside (FD-78); the sort control sits in the first shown section's header
- **UI elements:** sort control (Name, Status, Recent activity)
- **States covered:** success
- **Errors & recovery:** n/a
- **Status:** validated
- **Coverage:** src/core/products.ts (arrangeProducts), src/renderer/App.tsx, test/listorder.test.ts, test/e2e/overview-settings.test.ts
- **Product:** unobserved

### SCN-058: First session: my coding agent sets the system up
- **Persona:** P-01
- **Feature:** setup
- **Traces:** ST-022 (JTBD-06, JRN-02/#1, JRN-02/#2); ADR-0020
- **Entry point:** the first launch (and Settings -> Setup, until it is done)
- **Preconditions:** none
- **Steps:**
  1. User opens the app for the first time -> Overview shows the setup card and the console opens with a Setup session for the default coding agent
  2. User presses "Start setup" -> the runtime starts in the Setup console with the setup brief: register this app's MCP and make the proving call; check or install the Fabric Agent Adapter skills; offer Switchboard, Observatory and Fabric one at a time; create or adapt a first agent; make it a service
  3. The agent asks for a consent, a sign-in or a secret -> the user answers in the console (a secret in a hidden prompt)
  4. A service lands -> it appears in the list while the setup runs; the setup card ticks what is done (MCP registered, skills found, first agent)
- **Expected result:** a working system without a manual, and every step visible
- **Alt paths:** no coding agent installed -> the card shows each vendor's install command to copy, and Start setup appears once one is found; the person declines a product -> the agent moves on; the person closes the app mid-setup -> the next launch offers Continue setup
- **UI elements:** setup card with its checklist, Setup console, "Start setup", "Continue setup"
- **States covered:** success, empty, error, loading
- **Errors & recovery:** a step fails -> the agent says why in the console; the checklist shows what is done and what is not
- **Status:** validated
- **Coverage:** src/core/setup.ts, src/core/offers.ts (SETUP_KEY), src/electron/console.ts, src/renderer/components/Overview.tsx (SetupCard), src/renderer/App.tsx, test/setup.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-059: A later session opens on what changed
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-022 (JTBD-06, JRN-02/#3); ADR-0020
- **Entry point:** any launch after setup
- **Preconditions:** the person has used the app before
- **Steps:**
  1. User opens the app -> Overview leads with "Since you were last here": agents that broke (each with Fix with agent), updates (Update, or Update with agent), and new or removed agents
  2. User sees the agents they worked with -> each offers Continue (the last console session, resumed with fresh context)
  3. User opens one -> the agent they had selected last time is selected
- **Expected result:** the person starts from what needs them, not from the whole list
- **Alt paths:** nothing changed -> the section says so in one line and Overview reads as before
- **UI elements:** "Since you were last here" section, Continue buttons
- **States covered:** success, empty
- **Errors & recovery:** n/a
- **Status:** validated
- **Coverage:** src/core/visit.ts, src/core/settings.ts, src/renderer/App.tsx (continueWith), src/renderer/components/Overview.tsx, test/visit.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-061: Talk to Fabric about this agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-020 (JTBD-06, JRN-02/#4); ADR-0021; Fabric Agent Contract DEC-0040 FB-1…FB-8, FL-1…FL-7 ([PR #30](https://github.com/passioncode-ai/fabric-agent-contract/pull/30)); Fabric 0.4.0 REQ-42
- **Entry point:** a service page's header, the **Fabric** button (the mark and the word; the mark alone in a narrow bar), on every tab
- **Preconditions:** the service's id is an agent id Fabric's links can carry (lowercase, `id.instance`)
- **Steps:**
  1. User presses Fabric (or focuses it and presses Return or Space) -> Fabric comes forward with its conversation about this agent (`fabric://chat?service=<id>.<instance>`); Fabric finds the agent's project from the agent's repository and asks inside the conversation when it cannot tell
  2. User talks to Fabric there, or opens a coding session from it -> nothing in this app changes; Fabric links back to the agent's page here (`fabric-dashboards://service/…`, SCN-029)
- **Expected result:** one press reaches the manager agent about the agent on screen, without copying a name or a link
- **Alt paths:** Fabric is not installed -> the press opens a small menu with one line, "Fabric is not installed — get it at passioncode.ai/fabric", and choosing it opens that page in the browser; nothing downloads and nothing is retried; Fabric is installed later -> the next press opens it; the dashboard page has its own Fabric button -> it is hidden inside this app (the page is told the app draws one), and it still shows in a browser; an id outside Fabric's grammar -> no button
- **UI elements:** Fabric button in the service header (accessible name "Open Fabric"), the native menu when Fabric is absent
- **States covered:** success, empty (Fabric not installed)
- **Errors & recovery:** the OS names a handler but it cannot open the link -> the same "not installed" menu, and `main.log` has `fabric_button failed` with the reason
- **Status:** validated
- **Coverage:** src/core/fabric-button.ts, src/core/fabric-links.ts (the contract's copy), src/electron/main.ts (fabricButton, fabricPress), src/electron/views.ts (fabricCookie), src/renderer/components/ServiceView.tsx (FabricButton), test/fabric-button.test.ts, test/e2e/app.test.ts (FD-45, present and absent)
- **Product:** unobserved

### SCN-062: Outages reach me away from the Mac
- **Persona:** P-01
- **Feature:** notifications
- **Traces:** ST-002 (JTBD-01); ADR-0010 amendments 2026-10-11 (FD-48) and 2026-10-19 (FD-76); operator decisions 2026-10-11 and 2026-10-19 (the Telegram rule)
- **Entry point:** nothing — the watcher acts; Settings → Notifications → Also send outages to
- **Preconditions:** an installed agent offers a notify capability (for example the person's Telegram channel)
- **Steps:**
  1. An agent stops answering and stays so for 15 minutes -> one message reaches the channel: "<Agent> is down" with how long and why
  2. The agent works again and keeps working for 15 minutes -> one more message: "<Agent> is back", after how many minutes
  3. User opens Settings → Notifications -> Also send outages to: Automatic (<channel>), the agents that offer it, Off; under it what it does and the last delivery ("Last sent HH:MM: …" or "Sending failed HH:MM: …")
- **Expected result:** an outage longer than fifteen minutes is known wherever the person is, once, and its end too; nothing routine reaches the channel
- **Alt paths:** shorter than 15 minutes -> nothing is sent (the Mac banner of ADR-0008 still shows after a minute), and nothing later either: an agent that is well again when its fifteen minutes come round sends neither "down" nor "back" (0.7.16); the agent falls again within 15 minutes of coming back -> the same outage, no new message; while it is down a part of it fails ("<Agent>: <part> is failing") -> still the same outage, no "back"; an agent that answers but reports a failing part, or a setup state -> shown on this Mac only; the person paused notifications, is in quiet hours or switched the agent off -> nothing is sent for it, nor its recovery; no agent offers the capability -> Settings says outages are shown on this Mac only; several do -> Settings asks to choose; an events-feed failure or warning banner -> shown on this Mac only (FD-76)
- **UI elements:** Settings → Notifications: Also send outages to (select), its help line and its last-delivery line
- **States covered:** success, error, empty
- **Errors & recovery:** the channel does not answer -> retried every minute, at most five times; the last failure shows in Settings with its reason; the app's log has `alerts:` lines
- **Status:** validated
- **Coverage:** src/core/outage-alerts.ts, src/core/mcp-client.ts, src/electron/outage-alerts.ts, src/electron/main.ts (outage-alerts), src/renderer/components/Settings.tsx (AlertChannel), test/outage-alerts.test.ts
- **Product:** observed 2026-10-12 on this Mac: 22 failure alerts sent 5.0–5.4 min after an outage began, none for the 34 shorter episodes (FD-01). FD-76 (2026-10-19): the installed 0.7.14 had sent 798 messages in 8 days (311 outages, 309 recoveries, 203 banners); the 15-minute rule, one case per outage and Mac-only banners are counted on a fake clock by `test/outage-alerts.test.ts`, the live count is owed after the release

## sessions

The Sessions mode (0.8.0): every coding session apart from the agents, each state with an action. Design: [sessions-and-navigation.md](../reports/2026-10-24-ui-ux-iteration/sessions-and-navigation.md) (the operator's review of 2026-10-24; defects SES-01 to SES-09). The interface copy of each scenario is in its **Copy** field, English then Russian; "this Mac" is "this computer" («этот компьютер») on Windows and Linux, and every such string has both variants.

### SCN-077: Switch between Agents and Sessions
- **Persona:** P-01
- **Feature:** navigation
- **Traces:** ST-023 (JTBD-05, JTBD-01, JRN-01/#9); operator review 2026-10-24 ("This place should hold agents, not handed-over sessions. Either a switch: Agents shows what it shows now; Sessions shows the active coding sessions and the handed-over ones."); SES-01, SES-02, SES-07; COPY-17
- **Entry point:** the switch at the top of the sidebar; View → Agents (⌘1) and View → Sessions (⌘2); Ctrl+1 and Ctrl+2 on Windows and Linux
- **Preconditions:** none
- **Steps:**
  1. User opens the window -> under the app's mark a two-part switch reads "Agents" and "Sessions"; the mode the window was closed in is selected (Agents the first time) and the sidebar below lists that mode's entries
  2. User presses "Sessions" (or ⌘2) -> the sidebar lists "All sessions" and the sessions in their groups (SCN-078); the main area shows the page last open in this mode ("All sessions" the first time)
  3. User presses "Agents" (or ⌘1) -> the sidebar lists Overview, Activity, Connections, Spend, Pinned, On this Mac, Online, Services and Hidden, with no session among them and no hand-over section; the main area shows the page last open in this mode (Overview the first time)
  4. A session needs a person (SCN-082) -> "Sessions" carries a count badge in either mode, named to a screen reader "Sessions, waiting for you: 2"; with none it carries no badge
  5. User quits and opens the app again -> it opens in the mode and on the page it was closed on
- **Expected result:** agents and coding sessions never share one list; one press or one key moves between them, and the app remembers where the person was
- **Alt paths:** Switchboard hands a session over or a session changes state while Agents is shown -> the badge changes and the mode does not: a new hand-over never switches the mode by itself; the person clicks a session's notification or the tray's Sessions line (SCN-085) -> Sessions opens on it; a fabric-dashboards:// link to an agent's page, a notification about an agent or an agent in the tray menu -> Agents opens on it; the sidebar is folded into a rail (SCN-047) -> the switch becomes two icons, each named in a tooltip and to a screen reader, the badge on the Sessions icon; the page last open in a mode has gone (a session removed, an agent uninstalled) -> that mode opens on its first page (All sessions or Overview)
- **UI elements:** the sidebar switch (two buttons, the selected one pressed), its badge, View → Agents and View → Sessions with their shortcuts, the rail's two icons
- **States covered:** empty, success
- **Errors & recovery:** the remembered mode cannot be read (damaged settings) -> Agents on Overview; nothing else depends on it
- **Copy:**
  - "Agents" / «Агенты» (the switch and the View menu)
  - "Sessions" / «Сессии» (the switch and the View menu)
  - "Sessions, waiting for you: {n}" / «Сессии, ждут вас: {n}» (the switch's accessible name with a badge)
  - "All sessions" / «Все сессии»
  - "On this Mac" / «На этом Mac» (existing; "On this computer" / «На этом компьютере» elsewhere)
- **Status:** draft
- **Coverage:** none yet (dossier nodes S2 and S3; `test/navigation.test.ts` owed)
- **Product:** unobserved

### SCN-078: See every coding session in one place
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JTBD-01, JRN-01/#9); operator review 2026-10-24 ("They unfold from the top, it is unclear what they are, why they are needed and how they work."); SES-02, SES-03, SES-07, SES-08; UX-02, UX-17
- **Entry point:** Sessions → All sessions, or a group heading in the sidebar
- **Preconditions:** none
- **Steps:**
  1. User opens Sessions -> "Reading sessions…" until the first read; then the sidebar and the page list the sessions in four groups, in this order, each with its count after its label and an empty group not drawn: "Needs you: N", "Running: N", "Waiting for a limit reset: N", "Ended in the last 24 hours: N"
  2. User reads a row -> first line: the project (the folder's name); second line: coding agent · account · how it came here · time ("Claude Code · claude4 · handed over · 14:02"); how it came here is one of "handed over", "after a limit reset", "started by Switchboard", "opened here"; two rows of one folder differ by that second line; the state is said in words by the group heading and on the card, never by a glyph alone
  3. User reads a card on the page -> the same two lines, the state in words and the state's actions as buttons (SCN-081 to SCN-084); choosing the card itself opens the session's page (SCN-080)
  4. User unfolds "Ended in the last 24 hours" (folded by default; the fold is remembered) -> ended sessions newest first, each with its Continue and Remove; "Clear" above them removes every ended session from the list at once, with no question: an ended entry is only a list row, and the transcript stays where the coding agent wrote it
  5. User reads the bottom of the page -> the footnote "Sessions started in a terminal without Switchboard are not listed."
- **Expected result:** every coding session Switchboard or this app knows is listed once, newest first in its group, each saying what it is, where it came from and what it needs
- **Alt paths:** no session at all -> the empty sentence (Copy) and no group; Switchboard is not installed -> only this app's console sessions, with the not-installed sentence; Switchboard did not answer on the last read -> what was read before stays, with the not-answering sentence and its time; Switchboard and a console of this app know the same session -> one row (merged by folder and start time); an ended session older than 24 hours -> it leaves the list by itself; the app restarts -> the ended sessions of the last 24 hours are still listed (what their consoles printed is not, SCN-080); the list is read every 15 seconds while Sessions is shown and every 60 seconds otherwise, so a new session appears within that time
- **UI elements:** the sidebar's group headings and rows, the All sessions page with the same groups as cards, the fold of Ended with Clear, the footnote, the empty, not-installed and not-answering lines
- **States covered:** loading, empty, success, error
- **Errors & recovery:** Switchboard does not answer -> the not-answering line with the time of the last good read, and the next read tries again; the list of ended sessions cannot be saved -> the list still shows them until the app quits, and the log says why
- **Copy:**
  - "Reading sessions…" / «Читаем сессии…»
  - "Needs you: {n}" / «Нужно ваше решение: {n}»
  - "Running: {n}" / «Идут: {n}»
  - "Waiting for a limit reset: {n}" / «Ждут сброса лимита: {n}»
  - "Ended in the last 24 hours: {n}" / «Завершены за 24 часа: {n}»
  - "Clear" / «Очистить»
  - "handed over" / «передана»
  - "after a limit reset" / «после сброса лимита»
  - "started by Switchboard" / «запущена Switchboard»
  - "opened here" / «открыта здесь»
  - "No coding sessions yet. A session you start in an agent's console, or one Switchboard starts or hands over, appears here." / «Сессий агентов для кода пока нет. Здесь появится сессия, которую вы начнёте в консоли агента, или та, что запустит или передаст Switchboard.»
  - "Switchboard is not installed, so only sessions started in this app's consoles are listed." / «Switchboard не установлен, поэтому здесь только сессии из консолей этого приложения.»
  - "Switchboard did not answer just now, so sessions it runs may be missing. Checked at {time}." / «Switchboard сейчас не ответил, поэтому его сессий здесь может не быть. Проверено в {time}.»
  - "Sessions started in a terminal without Switchboard are not listed." / «Сессии, запущенные в терминале без Switchboard, здесь не видны.»
- **Status:** draft
- **Coverage:** none yet (dossier nodes S2 and S3; `test/sessions.test.ts` owed)
- **Product:** unobserved

### SCN-079: The Sessions page explains itself once
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("it is unclear what they are, why they are needed and how they work"); SES-01, SES-09
- **Entry point:** Sessions → All sessions, until the note is dismissed
- **Preconditions:** the note has not been dismissed on this computer
- **Steps:**
  1. User opens All sessions -> above the groups a note says what a session here is and why Switchboard sends sessions here (Copy), with "Set up hand-overs" and "Got it"
  2. User presses "Set up hand-overs" -> Settings opens on its Sessions section (SCN-086); the note stays until it is dismissed
  3. User presses "Got it" -> the note goes and never comes back, also after an update or a restart
- **Expected result:** the first look at the page explains what is listed, why it is here, and the one place that changes it
- **Alt paths:** Windows or Linux -> the "this computer" variant; Switchboard is not installed -> the note's second sentence is the not-installed one, and "Set up hand-overs" still opens Settings → Sessions, which says how to get it
- **UI elements:** the note, "Set up hand-overs", "Got it"
- **States covered:** success
- **Errors & recovery:** the dismissal cannot be saved -> the note shows again at the next launch; nothing else depends on it
- **Copy:**
  - "Here are the coding agents' sessions on this Mac. When a session hits a limit, Switchboard passes the work to another account or agent, and it continues here, in the console." / «Здесь сессии агентов для кода на этом Mac. Когда сессия упирается в лимит, Switchboard передаёт работу другому аккаунту или агенту, и она продолжается здесь, в консоли.»
  - "Here are the coding agents' sessions on this computer. When a session hits a limit, Switchboard passes the work to another account or agent, and it continues here, in the console." / «Здесь сессии агентов для кода на этом компьютере. Когда сессия упирается в лимит, Switchboard передаёт работу другому аккаунту или агенту, и она продолжается здесь, в консоли.»
  - "Install Fabric Switchboard so that a session that hits a limit continues here." / «Установите Fabric Switchboard, чтобы сессия, упёршаяся в лимит, продолжалась здесь.»
  - "Set up hand-overs" / «Настроить передачи»
  - "Got it" / «Понятно» (accessible name "Hide this explanation" / «Скрыть это пояснение»)
- **Status:** draft
- **Coverage:** none yet (dossier node S3)
- **Product:** unobserved

### SCN-080: Open one session's page
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023, ST-019 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-05, SES-06, SES-09; UX-18, UX-25, VIS-05, VIS-06
- **Entry point:** a session's row or card; a session's notification (SCN-085)
- **Preconditions:** the session is listed (SCN-078)
- **Steps:**
  1. User opens a session -> the header: the project as the title, the state in words beside it, the origin chip, the account chip, the context chip when Switchboard names one, the coding agent and the folder (shortened, the full path on hover), and the actions of its state on the right (SCN-081 to SCN-084)
  2. The session runs in this app's console -> under the header the console fills the rest of the main area, the full height of the window; it is not a drawer: there is no fold and no collapse, and nothing on this page navigates elsewhere by itself
  3. User types into the terminal -> every key reaches the coding agent, Esc included; while the terminal has focus a quiet line under it says how to leave it
  4. User presses Esc, then Tab within one second -> the Esc has reached the coding agent as usual and the Tab does not; focus leaves the terminal for the next control in the window's order (Esc, then Shift+Tab: the header's last action)
  5. User changes the colour scheme or the theme in Settings, or the system switches between light and dark -> the terminal's background, text, selection and colours follow at once, without restarting the session (SCN-067)
- **Expected result:** a session is a page of its own: what it is, where it came from, which account it spends and what can be done with it at the top, and its console filling the rest
- **Alt paths:** the session runs in a Terminal window Switchboard opened (SCN-081) -> no console; the page says where to type to it; an ended session after the app restarted -> the page says what it printed was not kept; the session leaves the list while its page is open (Remove, Clear, 24 hours passed) -> All sessions opens, never an empty page; the window is hidden while it runs -> it keeps running, its output waits in the console's buffer and shows when the window is shown again; the same session also runs in an agent's console drawer (SCN-069 step 2) -> both show one console and one output; Windows or Linux -> the same keys
- **UI elements:** the header (title, state words, origin, account and context chips, coding agent, folder, actions), the full-height console, the keyboard line, the Terminal and not-kept notes
- **States covered:** empty, success, error
- **Errors & recovery:** the console cannot start (no room, SCN-063) -> its reason in the console's place, and the header keeps the state's actions
- **Copy:**
  - "Handed over by Switchboard after a limit on {account}, {time}" / «Передана Switchboard после лимита {account}, {time}»
  - "Handed over by Switchboard, {time}" / «Передана Switchboard, {time}» (a hand-over not caused by a limit)
  - "Continued after a limit reset, {time}" / «Продолжена после сброса лимита, {time}»
  - "Started by Switchboard, {time}" / «Запущена Switchboard, {time}»
  - "Opened here, {time}" / «Открыта здесь, {time}»
  - "Account: {account}" / «Аккаунт: {account}»
  - "Context: personal" / «Контекст: личный»
  - "Context: {organization}" / «Контекст: {organization}»
  - "To leave the terminal, press Esc, then Tab." / «Чтобы выйти из терминала, нажмите Esc, затем Tab.»
  - "This session runs in a Terminal window that Switchboard opened. Type to it there." / «Эта сессия идёт в окне Терминала, которое открыл Switchboard. Пишите ей там.»
  - "What this session printed is not kept after the app restarts." / «То, что вывела эта сессия, не сохраняется после перезапуска приложения.»
- **Status:** draft
- **Coverage:** none yet (dossier node S3; the e2e owed: a synthetic hand-over's page shows the console full height, Esc then Tab leaves it)
- **Product:** unobserved

### SCN-081: A running session: end it, or find where it runs
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("nothing can be done with them"); dossier "Every state has an action": running, ours; running, not ours
- **Entry point:** a running session's card or page
- **Preconditions:** the session runs
- **Steps:**
  1. A session runs in this app's console -> state "Running"; actions "End" and "Show in Finder" ("Show in Explorer" on Windows, "Show folder" on Linux)
  2. User presses "End" -> a question "End this session?" with its explanation, "Cancel" focused and "End session"; Esc or Cancel changes nothing
  3. User presses "End session" -> the coding agent is asked to stop and, if it has not ended within 2 seconds, is stopped; the session moves to Ended as "Ended by you" (SCN-084)
  4. User presses "Show in Finder" -> the session's folder opens in Finder
  5. Switchboard runs a session in a Terminal window -> state "Running in Terminal"; "Show in Terminal" when Switchboard knows its window; no action that ends or removes it
- **Expected result:** a running session can be ended here only when this app runs it, always with a question first; one Switchboard runs elsewhere can be found, never stopped from here
- **Alt paths:** Switchboard does not know the Terminal window -> no "Show in Terminal", and the page says where it runs (SCN-080); the session ends by itself while the question is open -> the question closes and the session is Ended (SCN-084)
- **UI elements:** the state words, End and its question, Show in Finder (Explorer, folder), Show in Terminal
- **States covered:** success, error
- **Errors & recovery:** the session cannot be signalled -> it stays Running with "The session could not be ended: {reason}"; the folder cannot be shown -> "Could not open {path}: {reason}"
- **Copy:**
  - "Running" / «Идёт»
  - "Running in Terminal" / «Идёт в Терминале»
  - "End" / «Завершить»
  - "Show in Finder" / «Показать в Finder»; "Show in Explorer" / «Показать в Проводнике»; "Show folder" / «Показать папку»
  - "Show in Terminal" / «Показать в Терминале»
  - "End this session?" / «Завершить эту сессию?»
  - "The coding agent stops. What it printed stays on this page, and you can continue the session later." / «Агент для кода остановится. Всё, что он вывел, останется на этой странице, а сессию можно будет продолжить позже.»
  - "End session" / «Завершить сессию»; "Cancel" / «Отмена»
  - "The session could not be ended: {reason}" / «Не удалось завершить сессию: {reason}»
  - "Could not open {path}: {reason}" / «Не удалось открыть {path}: {reason}»
- **Status:** draft
- **Coverage:** none yet (dossier node S3)
- **Product:** unobserved

### SCN-082: A session that needs you
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JTBD-01, JRN-01/#9); operator review 2026-10-24 ("nothing can be done with them"); SES-05, SES-09; dossier "Every state has an action": needs you
- **Entry point:** Sessions → "Needs you", or the badge on the switch (SCN-077)
- **Preconditions:** a session is in one of the states below
- **Steps:**
  1. A session the app continued after a limit reset did not write its transcript within 30 seconds but its process still runs (SCN-075) -> under "Needs you" with "Did not continue; its process is still running"; actions "Open console" and "End"
  2. User presses "Open console" -> the session's page with its console full height (SCN-080); what the person types reaches it; "End" asks first (SCN-081)
  3. A hand-over Switchboard offered could not open here -> under "Needs you" with the reason in one sentence (it expired; its folder is not on this Mac; this Mac could not carry another session; Switchboard is too old), followed by "Switchboard opened it in Terminal." once it did; action "Remove"
  4. A stopped session only the person can move on (its terminal is still open, a payment limit, stopped more than a day ago, its folder or its conversation is not here) -> under "Needs you" with Switchboard's verdict sentence (SCN-075); action "Remove"
  5. User presses "Remove" -> the row leaves the list and the badge counts one less; nothing else changes (a Terminal window Switchboard opened stays open, and Switchboard's own record is untouched)
- **Expected result:** every session that waits for a decision says why in one sentence and offers the one thing that can be done about it here
- **Alt paths:** the cause clears by itself (the stopped session's terminal closes and Switchboard marks it ready) -> it moves to its new group at the next read; a coding agent asking a question in its console joins this group once a source reports it (none does in this release)
- **UI elements:** the Needs you group and badge, the reason sentence, Open console, End, Remove
- **States covered:** error, success
- **Errors & recovery:** the console of a failed resume cannot be reached (its process ended meanwhile) -> it moves to Ended as "Ended at {time}" with Continue (SCN-084)
- **Copy:**
  - "Did not continue; its process is still running" / «Не продолжилась, процесс ещё идёт»
  - "Open console" / «Открыть консоль»
  - "The hand-over expired before the session could open here." / «Передача истекла раньше, чем сессия открылась здесь.»
  - "Its folder is not on this Mac." / «Её папки нет на этом Mac.» (existing; "Its folder is not on this computer." / «Её папки нет на этом компьютере.»)
  - "This Mac cannot carry another session now: less than 5 GB is free or six sessions already run." / «Этот Mac сейчас не может принять ещё одну сессию: свободно меньше 5 ГБ или уже идут шесть сессий.»
  - "This computer cannot carry another session now: less than 5 GB is free or six sessions already run." / «Этот компьютер сейчас не может принять ещё одну сессию: свободно меньше 5 ГБ или уже идут шесть сессий.»
  - "The running Switchboard is older than its command line, so the session was not taken here. Update Switchboard." / «Запущенный Switchboard старше своей командной строки, поэтому сессию здесь не взяли. Обновите Switchboard.»
  - "Switchboard opened it in Terminal." / «Switchboard открыл её в Терминале.»
  - "Remove" / «Убрать»
- **Status:** draft
- **Coverage:** none yet (dossier nodes S2 and S3; `test/sessions.test.ts` owed: a failed resume still running is in Needs you and opens its console)
- **Product:** unobserved

### SCN-083: A session waiting for a limit reset
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("nothing can be done with them"); SES-07; FD-83; Switchboard SB-115; dossier "Every state has an action": waiting for a reset
- **Entry point:** Sessions → "Waiting for a limit reset"
- **Preconditions:** Switchboard holds the session as stopped on a usage limit and no account has room for it yet
- **Steps:**
  1. User reads the row -> "Continues at about {time}" (the reset Switchboard expects), or "Waits for an account with capacity." when it names no time; actions "Continue now on another account" and "Do not continue"
  2. User presses "Continue now on another account" -> a menu lists the accounts Switchboard says can take it now, "{account} · {provider}"
  3. User chooses one -> the app claims the stop in Switchboard once and continues the session in a console with that account, as SCN-075 step 2 does by itself; the row moves to Running with "Continued after a limit reset" and its page opens
  4. User presses "Do not continue" -> the row moves to Ended as "Not continued: you declined" and this app never continues that stop; Switchboard's own record is untouched
- **Expected result:** a stopped session says when it will come back, and the person can bring it back now on another account or let it go
- **Alt paths:** no other account can take it now -> the button is disabled with "No other account has capacity now."; the reset comes and "Continue sessions after a limit reset" is on -> it continues by itself (SCN-075) and moves to Running; the setting is off -> the row says it waits for the person, and both actions stay
- **UI elements:** the waiting line, Continue now on another account with its account menu, Do not continue
- **States covered:** success, error
- **Errors & recovery:** Switchboard refuses the claim, or the console cannot start -> the row stays waiting with "Could not be continued here; see the log."
- **Copy:**
  - "Continues at about {time}" / «Продолжится около {time}»
  - "Waits for an account with capacity." / «Ждёт аккаунт с запасом.» (existing)
  - "Continue now on another account" / «Продолжить сейчас на другом аккаунте»
  - "{account} · {provider}" (the account menu's items, untranslated)
  - "No other account has capacity now." / «Сейчас ни у одного другого аккаунта нет запаса.»
  - "Do not continue" / «Не продолжать»
  - "Continuing by itself is off in Settings, so it waits for you." / «Автоматическое продолжение выключено в настройках, поэтому сессия ждёт вас.»
  - "Could not be continued here; see the log." / «Продолжить здесь не удалось, подробности в журнале.» (existing)
- **Status:** draft
- **Coverage:** none yet (dossier nodes S2 and S3)
- **Product:** unobserved

### SCN-084: An ended session continues or leaves
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-03, SES-04; UX-02; dossier "Every state has an action": ended, closed after idle, ended by you
- **Entry point:** Sessions → "Ended in the last 24 hours", or an ended session's page
- **Preconditions:** the session ended less than 24 hours ago
- **Steps:**
  1. User reads an ended session -> one of "Ended at {time}" (it ended by itself), "Closed after 30 idle minutes" (SCN-066), "Ended by you" (SCN-081) or "Not continued: you declined" (SCN-083); actions "Continue" and "Remove"
  2. User presses "Continue" -> the coding agent's own resume of that conversation starts in the same folder (Claude Code's `--resume`, Codex's own), through Switchboard on its account when the folder is bound to one; the session moves to Running with its page and console, keeping its origin
  3. User presses "Remove" -> it leaves the list; its transcript stays where the coding agent wrote it
  4. Twenty-four hours after it ended -> it leaves the list by itself; until then a restart of the app keeps it
- **Expected result:** no ended session is a dead end: each can be continued where it was or taken off the list
- **Alt paths:** the conversation is not known to the app (no transcript recorded) -> the button reads "New session here" and starts a fresh session in that folder; its folder is gone -> Continue is disabled with "Its folder is not on this Mac."
- **UI elements:** the ended state words, Continue (New session here), Remove
- **States covered:** success, error
- **Errors & recovery:** the continue cannot start (no room, SCN-063, or Switchboard refuses) -> its reason on the page, and the session stays Ended with both actions
- **Copy:**
  - "Ended at {time}" / «Завершилась в {time}»
  - "Closed after 30 idle minutes" / «Закрыта после 30 минут простоя»
  - "Ended by you" / «Завершена вами»
  - "Not continued: you declined" / «Не продолжена: вы отказались»
  - "Continue" / «Продолжить»
  - "New session here" / «Новая сессия здесь»
  - "Remove" / «Убрать»
- **Status:** draft
- **Coverage:** none yet (dossier nodes S2 and S3; `test/sessions.test.ts` owed: an idle-closed hand-over offers Continue; ended entries older than 24 hours are dropped; a restart keeps the rest)
- **Product:** unobserved

### SCN-085: A taken hand-over tells me once, and the tray counts sessions
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023, ST-007, ST-009 (JTBD-01, JRN-01/#9); operator review 2026-10-24 ("it is unclear what they are, why they are needed and how they work"); SES-01
- **Entry point:** nothing to press: the app takes a hand-over (SCN-069); the menu bar icon
- **Preconditions:** notifications are not paused and not in quiet hours (SCN-024)
- **Steps:**
  1. The app takes a hand-over -> one system notification titled "Sessions": "Switchboard handed over a session: {project} continues on {coding agent}"
  2. User clicks it -> the window shows in the Sessions mode on that session's page (SCN-080)
  3. User opens the menu bar menu while a session runs or waits for the person -> a line "Sessions: running N, waiting for you M" (a part at zero left out) under the headline
  4. User chooses that line -> the window shows in the Sessions mode on All sessions
- **Expected result:** a session Switchboard hands over is announced once and is one click away; the tray says how many sessions run and wait without opening the window
- **Alt paths:** notifications are paused or in quiet hours -> no notification; the session is listed and the switch's badge counts it when it needs the person; no session runs or waits -> no tray line; the system refuses the app's notifications -> nothing shows, the list and the badge still say it
- **UI elements:** the notification, the tray's Sessions line
- **States covered:** success, empty
- **Errors & recovery:** the session has left the list when the notification is clicked -> All sessions opens
- **Copy:**
  - "Sessions" / «Сессии» (the notification's title)
  - "Switchboard handed over a session: {project} continues on {agent}" / «Switchboard передал сессию: {project} продолжается на {agent}»
  - "Sessions: running {running}, waiting for you {waiting}" / «Сессии: идут {running}, ждут вас {waiting}»
  - "Sessions: running {running}" / «Сессии: идут {running}»
  - "Sessions: waiting for you {waiting}" / «Сессии: ждут вас {waiting}»
- **Status:** draft
- **Coverage:** none yet (dossier node S3; the e2e owed: a synthetic hand-over appears in Sessions with a notification)
- **Product:** unobserved

### SCN-086: Settings → Sessions
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-023, ST-010 (JTBD-05, JRN-01/#9, JRN-01/#7); operator review 2026-10-24 ("it is unclear what they are, why they are needed and how they work"); FD-62, FD-83; Switchboard SB-108
- **Entry point:** Settings → Sessions; "Set up hand-overs" on All sessions (SCN-079)
- **Preconditions:** none
- **Steps:**
  1. User opens Settings → Sessions -> two switches: "Open sessions handed over by Switchboard here" with its explanation, read from Switchboard (`switchboard handovers`), and "Continue sessions after a limit reset" with its explanation (moved here from "Sessions stopped on a limit")
  2. User turns the first switch -> the app asks Switchboard to change it (`switchboard handovers set on` or `off`) and shows the value Switchboard reads back
  3. User turns the second switch -> it applies at once (SCN-075) and is kept across restarts
- **Expected result:** both choices about where sessions continue are in one place in this app, the first one kept by Switchboard itself
- **Alt paths:** Switchboard is not installed -> the first switch is disabled with how to get it; this Switchboard cannot change the setting -> the first switch is disabled with "update Switchboard"; the setting is changed in Switchboard itself -> this switch shows it at the next read (15 seconds with the window shown, 60 hidden)
- **UI elements:** the Sessions section, its two switches with their explanations, the disabled reasons
- **States covered:** success, error
- **Errors & recovery:** Switchboard refuses the change -> the switch returns to Switchboard's value with "Switchboard did not change it: {reason}"
- **Copy:**
  - "Sessions" / «Сессии» (the section)
  - "Open sessions handed over by Switchboard here" / «Открывать сессии, переданные Switchboard, здесь»
  - "When a session hits a limit, Switchboard passes it to another account or agent. On: it continues here, in a console. Off: Switchboard opens it in a new Terminal window. The setting is Switchboard's; it is changed here through Switchboard." / «Когда сессия упирается в лимит, Switchboard передаёт её другому аккаунту или агенту. Включено: она продолжается здесь, в консоли. Выключено: Switchboard открывает её в новом окне Терминала. Настройка принадлежит Switchboard, здесь она меняется через него.»
  - "Continue sessions after a limit reset" / «Продолжать сессии после сброса лимита»
  - its explanation: the existing `settings.resumeAfterLimit.body` in both languages
  - "Install Fabric Switchboard to have sessions handed over here." / «Чтобы сессии передавались сюда, установите Fabric Switchboard.»
  - "This Switchboard cannot change this setting; update Switchboard." / «Эта версия Switchboard не умеет менять эту настройку; обновите Switchboard.»
  - "Switchboard did not change it: {reason}" / «Switchboard не изменил настройку: {reason}»
- **Status:** draft
- **Coverage:** none yet (dossier node S3)
- **Product:** unobserved
