<!-- Managed with super-ux (ux-contract v4). Update in the same change as any user-facing behavior change. -->

# Fabric Dashboards — scenarios

## Index

| ID | Title | Feature | Persona | Traces | Status | Last audit |
|----|-------|---------|---------|--------|--------|------------|
| SCN-001 | First launch finds installed services | discovery | P-01 | ST-001 | draft | — |
| SCN-002 | First launch with no service installed | discovery | P-01 | ST-001 | draft | — |
| SCN-003 | A service is installed or removed while the app runs | discovery | P-01 | ST-001 | draft | — |
| SCN-004 | A descriptor is invalid | discovery | P-01 | ST-001, ST-004 | draft | — |
| SCN-005 | Overview when everything is ready | overview | P-01 | ST-002 | draft | — |
| SCN-006 | Overview lists what needs attention | overview | P-01 | ST-002 | draft | — |
| SCN-007 | Restart a service that is down | control | P-01 | ST-003 | draft | — |
| SCN-008 | Restart does not bring the service back | control | P-01 | ST-003 | draft | — |
| SCN-009 | Stop a service so it stays off | control | P-01 | ST-003 | draft | — |
| SCN-010 | Start a stopped service | control | P-01 | ST-003 | draft | — |
| SCN-011 | Two copies of one service | health | P-01 | ST-004 | draft | — |
| SCN-012 | Another program answers on the service's port | health | P-01 | ST-004 | draft | — |
| SCN-013 | Two services claim one port | health | P-01 | ST-004 | draft | — |
| SCN-014 | Open a dashboard inside the app, signed in | dashboards | P-01 | ST-005 | draft | — |
| SCN-015 | Dashboard view keeps its place | dashboards | P-01 | ST-005 | draft | — |
| SCN-016 | Dashboard cannot sign in | dashboards | P-01 | ST-005 | draft | — |
| SCN-017 | Catch up in Activity | activity | P-01 | ST-006 | draft | — |
| SCN-018 | Activity when a service's feed cannot be read | activity | P-01 | ST-006 | draft | — |
| SCN-019 | Notification when a service goes down and comes back | notifications | P-01 | ST-007 | draft | — |
| SCN-020 | Notification from a service event opens the item | notifications | P-01 | ST-007, ST-006 | draft | — |
| SCN-021 | Update a service | updates | P-01 | ST-008 | draft | — |
| SCN-022 | The app updates itself | updates | P-01 | ST-008 | draft | — |
| SCN-023 | Glance from the menu bar | tray | P-01 | ST-009 | draft | — |
| SCN-024 | Settings: launch at login, notifications, quiet hours | settings | P-01 | ST-010, ST-007 | draft | — |
| SCN-025 | Run doctor and read logs | control | P-01 | ST-003 | draft | — |
| SCN-026 | Open a service page from a link an agent handed over | links | P-01 | ST-011, ST-005 | draft | — |
| SCN-027 | A link that cannot be opened | links | P-01 | ST-011 | draft | — |
| SCN-028 | An agent reads and administers services through MCP | agents | P-01 | ST-012, ST-003 | draft | — |
| SCN-029 | Open a service from Fabric's agent registry | links | P-01 | ST-011, ST-005, ST-003 | draft | — |
| SCN-030 | Online services appear in their own group | overview | P-01 | ST-013, ST-002 | draft | — |
| SCN-031 | Open an online service's dashboard, signed in | dashboards | P-01 | ST-013, ST-005 | draft | — |
| SCN-032 | An online service that cannot be reached says why | health | P-01 | ST-013, ST-004 | draft | — |
| SCN-033 | Several instances of one agent read as one agent | products | P-01 | ST-014, ST-002 | draft | — |
| SCN-034 | Switch between an agent's connections | products | P-01 | ST-014, ST-005 | draft | — |
| SCN-035 | A connection fails while the agent is fine | products | P-01 | ST-014, ST-002, ST-004 | draft | — |
| SCN-036 | See what every agent spent | spend | P-01 | ST-015 | draft | — |
| SCN-037 | A cost that is not known reads as unknown | spend | P-01 | ST-015 | draft | — |
| SCN-038 | An agent's spend cannot be read | spend | P-01 | ST-015, ST-004 | draft | — |
| SCN-039 | Reload and move through an embedded dashboard | dashboards | P-01 | ST-016, ST-005 | draft | — |
| SCN-040 | Copy a dashboard page's address or app link | dashboards | P-01 | ST-016, ST-011 | draft | — |
| SCN-041 | Overview at a glance | overview | P-01 | ST-016, ST-002, ST-015 | draft | — |
| SCN-042 | Many problems stay compact | overview | P-01 | ST-016, ST-002 | draft | — |

## Personas

Defined in [foundation.md](foundation.md) → P-01.

Language: the interface follows the Mac's language — English or Russian — from the
first release; every sentence a service writes is shown as the service wrote it.

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
- **Alt paths:** a service is installed but its launchd job is off -> it appears as "Off" with Start
- **UI elements:** window, sidebar service list, Overview cards, loading line, menu bar icon
- **States covered:** loading, success
- **Errors & recovery:** services directory unreadable -> Overview shows "Cannot read the services folder: <reason>" with the path and Retry
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/core/descriptor.ts, src/renderer/components/Overview.tsx, test/e2e/app.test.ts
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
- **UI elements:** empty state, "Show folder" button, link "How a service joins" (opens the building-fabric-services guide)
- **States covered:** empty
- **Errors & recovery:** Finder cannot open the folder -> inline message with the path to copy
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
- **Errors & recovery:** a half-written file is ignored until it parses; nothing can fail visibly beyond SCN-004
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
- **Coverage:** src/core/descriptor.ts, src/core/state.ts, test/monitor.test.ts
- **Product:** unobserved

## overview

### SCN-005: Overview when everything is ready
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-002 (JTBD-01, JRN-01/#2)
- **Entry point:** Overview
- **Preconditions:** every service answers ready
- **Steps:**
  1. User opens Overview -> system shows one card per service: state dot and word, name, version and short commit, uptime, up to six summary tiles, the latest event sentence with its time
  2. User chooses a card -> system opens that service's view (SCN-014)
- **Expected result:** the state of every service is readable in one screen; no Needs attention block is shown
- **UI elements:** service cards, state dot and label, tiles, latest event line, header count "7 services"
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
  1. User opens Overview -> system shows Needs attention above the cards, most severe first: one single-line row per problem with the sentence ("Runner is not answering since 17:02") cut to the line, and its one action (Restart, Show, Update); more than three rows wait behind "Show all" (SCN-042)
  2. User chooses the action -> system performs it (SCN-007, SCN-011, SCN-021) and the row leaves when the problem clears
- **Expected result:** problems are the first thing read, each with its next action
- **Alt paths:** a degraded service lists its reasons, not an action, when the fix is inside the service ("Collector last ran 3 days ago")
- **UI elements:** Needs attention block, problem rows, action buttons, badge count in the sidebar
- **States covered:** error, success
- **Errors & recovery:** the action fails -> the row keeps its place with the failure sentence and Logs
- **Status:** draft
- **Coverage:** src/core/state.ts, src/renderer/components/Overview.tsx
- **Product:** unobserved

## control

### SCN-007: Restart a service that is down
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** Needs attention row, service view header, or tray menu
- **Preconditions:** the service is managed by launchd
- **Steps:**
  1. User chooses Restart -> the control shows "Restarting…", other controls for this service are disabled
  2. System asks launchd to restart the job and probes until the service answers as itself with a new pid -> state becomes Ready (or Degraded with reasons); Activity gains "<Service> restarted (pid 5542)"
- **Expected result:** the service answers again, started by launchd, and the result is stated
- **Alt paths:** the job was not loaded -> system loads it first, then waits
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
  1. System reaches the 40 s limit -> the control stops, state stays Down, message: "<Service> did not come back within 40 s." with Logs and Doctor
  2. User chooses Logs -> system shows the tail of the service's declared log files (SCN-025)
- **Expected result:** the operator knows the restart failed and where to look; nothing keeps spinning
- **UI elements:** failure message, Logs button, Doctor button
- **States covered:** error
- **Errors & recovery:** launchctl itself refuses -> its exact message is shown verbatim
- **Status:** draft
- **Coverage:** src/core/monitor.ts
- **Product:** unobserved

### SCN-009: Stop a service so it stays off
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** service view header or tray menu
- **Preconditions:** the service is managed by launchd and running
- **Steps:**
  1. User chooses Stop -> system asks to confirm: "Stop <Service>? It stays off, also after a restart of the Mac, until you start it. Agents that use it will get no answer."
  2. User confirms -> system unloads and disables the job and waits until it no longer answers -> state becomes Off; Activity gains "<Service> stopped by you"
- **Expected result:** the service is off and stays off across logins
- **Alt paths:** user cancels -> nothing changes
- **UI elements:** Stop button, confirmation dialog with Stop and Cancel, Off badge
- **States covered:** loading, success, error
- **Errors & recovery:** still answering after 40 s -> "<Service> is still answering; another copy may run outside launchd" with Show
- **Status:** draft
- **Coverage:** src/core/launchd.ts, src/renderer/App.tsx, test/monitor.test.ts
- **Product:** unobserved

### SCN-010: Start a stopped service
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** Off card, service view header, or tray menu
- **Preconditions:** the service is Off
- **Steps:**
  1. User chooses Start -> system enables and loads the job, "Starting…"
  2. System waits until the service answers as itself -> state becomes Ready; Activity gains "<Service> started by you"
- **Expected result:** the service runs under launchd again and will come back after a reboot
- **UI elements:** Start button, progress label, state badge
- **States covered:** loading, success, error
- **Errors & recovery:** no answer in 40 s -> as SCN-008; plist missing -> "The launchd file is missing: reinstall <Service>." with its path
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
  2. User chooses Doctor -> system runs the declared command (no shell), shows "Running doctor…", then its exit code and output
- **Expected result:** the operator sees why a service misbehaves without a terminal
- **Alt paths:** no doctor declared -> the button is absent; no logs declared -> "This service declares no log files."
- **UI elements:** Logs tab, log panes, Doctor button, output panel
- **States covered:** loading, empty, success, error
- **Errors & recovery:** the command times out after 120 s -> "Doctor did not finish within 120 s" and the partial output; a log file is unreadable -> its path and reason
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
  1. System probes -> state becomes "Two copies", Needs attention: "<Service> answers from pid 4412, launchd runs pid 5542." with Restart
  2. User chooses Restart -> system restarts the launchd job and re-probes; if the stray copy still holds the port, it says so and names its pid for the operator to stop
- **Expected result:** a duplicate is named with both pids and resolved or handed to the operator
- **UI elements:** Two copies badge, attention row, Restart button
- **States covered:** error, success
- **Errors & recovery:** the app never kills a process it did not start through launchd
- **Status:** draft
- **Coverage:** src/core/state.ts, test/core.test.ts
- **Product:** unobserved

### SCN-012: Another program answers on the service's port
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004 (JTBD-02, JRN-01/#3)
- **Entry point:** any screen
- **Preconditions:** the well-known answer names another id or instance, or the port answers without the protocol
- **Steps:**
  1. System probes -> state becomes "Wrong program on :47187", with "Answers as maker" or "Answers without fabric-service"
  2. User opens the service -> the dashboard is not opened and the token is not sent; the view explains the port is held by something else
- **Expected result:** the operator knows the port is taken by another program and nothing is sent to it
- **UI elements:** Foreign badge, explanation panel
- **States covered:** error
- **Errors & recovery:** resolved when the port answers as the service again
- **Status:** draft
- **Coverage:** src/core/state.ts, test/monitor.test.ts
- **Product:** unobserved

### SCN-013: Two services claim one port
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004 (JTBD-02, JRN-01/#3)
- **Entry point:** any screen
- **Preconditions:** two descriptors declare the same port
- **Steps:**
  1. System reads descriptors -> both services show "Port conflict", naming each other and the port
  2. User opens either -> the view explains that one of them must move and shows both descriptor paths
- **Expected result:** the conflict is visible before anything answers wrongly
- **UI elements:** Conflict badge, both names, "Show file" buttons
- **States covered:** error
- **Errors & recovery:** clears when one descriptor is rewritten with another port
- **Status:** draft
- **Coverage:** src/core/descriptor.ts, test/monitor.test.ts
- **Product:** unobserved

## dashboards

### SCN-014: Open a dashboard inside the app, signed in
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a card, a sidebar row, an Activity row or a notification
- **Preconditions:** the service is Ready or Degraded and declares a dashboard
- **Steps:**
  1. User chooses the service -> system shows the service view: header (state, version and commit, pid, uptime, port, controls) and the Dashboard tab with "Opening…"
  2. When the dashboard needs a login, system obtains a one-time code with the service token and opens it -> the service's own page appears, signed in
- **Expected result:** the agent's dashboard is usable in the app without a browser or a password, and no token is visible anywhere
- **Alt paths:** the dashboard declares no login -> it opens directly; the service declares no dashboard -> the tab shows Health instead
- **UI elements:** service view header, tabs Dashboard / Activity / Health / Logs, embedded page, loading line
- **States covered:** loading, success, error
- **Errors & recovery:** see SCN-016; a link inside the page to another site asks "Open <address> in your browser?" before leaving the app
- **Status:** draft
- **Coverage:** src/electron/views.ts, src/electron/policy.ts, test/viewslot.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-015: Dashboard view keeps its place
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** a service view already opened once
- **Preconditions:** none
- **Steps:**
  1. User switches to another service and back -> system shows the same page, scrolled and filled as it was; it is not reloaded and no second copy exists. Switching between two dashboards that are both open shows the chosen one, never a blank tab
  2. The service restarts -> the view shows "Service restarted — Reload" and reloads when chosen
- **Expected result:** one live view per service, never duplicated
- **UI elements:** embedded page, reload bar
- **States covered:** success
- **Errors & recovery:** the page crashes -> the app recreates it once, then shows "The page stopped. Reload"
- **Status:** draft
- **Coverage:** src/electron/views.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-016: Dashboard cannot sign in
- **Persona:** P-01
- **Feature:** dashboards
- **Traces:** ST-005 (JTBD-04, JRN-01/#5)
- **Entry point:** SCN-014 step 2
- **Preconditions:** the token file cannot be read, or the service refuses the token
- **Steps:**
  1. System fails to get a login code -> the tab shows "Cannot sign in to <Service>: <reason>" (for example "the token file is readable by others; set mode 0600") and the token file path
- **Expected result:** the reason and the file to fix are named; the app never falls back to a URL carrying a secret
- **UI elements:** sign-in error panel, path, Retry
- **States covered:** error
- **Errors & recovery:** Retry after the fix; Doctor when declared
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
  2. User filters by service or level -> the list narrows immediately; the filter is kept
  3. User chooses an event with a link -> system opens that service's view at the link (SCN-014)
- **Expected result:** everything the agents did is readable in one place and the unread count clears
- **Alt paths:** no events yet -> "Nothing has happened yet. Events appear here as your services work."; the session ended while the page was open (the service answers 401) -> the app signs in again by itself, once a minute at most, and reopens the same page (ADR-0014)
- **UI elements:** Activity list, day headers, service and level filters, unread count
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
- **Preconditions:** one service's events feed fails (down, 401, invalid page)
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
  3. The service answers again -> one notification: "<Service> is back after 2 min"
- **Expected result:** the operator learns about an outage and its end once each
- **Alt paths:** the service returns before a failed probe confirms 60 s of silence -> no notification, neither down nor back; Activity records it. One slow answer under load (a probe waits 5 s) changes nothing ([ADR-0008](../adr/0008-a-missed-probe-is-not-an-outage.md))
- **UI elements:** macOS notifications
- **States covered:** success
- **Errors & recovery:** notifications denied by macOS -> Settings shows "Notifications are off in macOS Settings" with a button opening them
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
- **Alt paths:** several such events in one read from one service -> one notification "3 need you · needs your decision" with the most urgent sentence, opening Activity filtered to it. The same subject's event again within its cool-down (question 24 h, warning 12 h, failure 6 h), the same warning from another instance of the agent, a delivery, a recovery or a plain notice -> no notification; Activity records it ([ADR-0010](../adr/0010-notifications-only-when-it-matters.md))
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
- **Entry point:** Needs attention row or service view header showing "Update to 0.2.1"
- **Preconditions:** the service reports an available version and declares an update command
- **Steps:**
  1. User chooses Update -> system runs the command (no shell), "Updating…", then shows its output and exit code
  2. System re-probes -> the header shows the new version and commit, or the old one with the command's failure
- **Expected result:** the service runs the new build, visibly
- **Alt paths:** no update command declared -> the row says "0.2.1 is available" without a button
- **UI elements:** Update button, output panel, version label
- **States covered:** loading, success, error
- **Errors & recovery:** non-zero exit -> the output stays visible; the service keeps its previous state
- **Status:** draft
- **Coverage:** src/core/monitor.ts, src/renderer/components/ServiceView.tsx
- **Product:** unobserved

### SCN-022: The app updates itself
- **Persona:** P-01
- **Feature:** updates
- **Traces:** ST-008 (JTBD-01, JRN-01/#6)
- **Entry point:** app running
- **Preconditions:** a newer signed release is published
- **Steps:**
  1. System checks at start and every 6 hours and downloads the update -> the sidebar footer shows "Update ready — Restart"
  2. User chooses Restart -> the app installs and reopens on the same screen; services are untouched
- **Expected result:** the app stays current without a manual download
- **Alt paths:** user ignores it -> the update installs on the next quit
- **UI elements:** footer update line, Restart button, "Check for updates" in the app menu
- **States covered:** loading, success, error
- **Errors & recovery:** download or signature check fails -> footer "Update failed: <reason>" with Retry; the running app is unchanged
- **Status:** draft
- **Coverage:** src/electron/updater.ts, scripts/dist-mac.mjs
- **Product:** unobserved

## tray

### SCN-023: Glance from the menu bar
- **Persona:** P-01
- **Feature:** tray
- **Traces:** ST-009 (JTBD-01, JRN-01/#2)
- **Entry point:** menu bar icon
- **Preconditions:** app running (window may be closed; while it is closed the app has no Dock icon and lives in the menu bar only)
- **Steps:**
  1. User looks at the icon -> it shows one of three states: all ready, something degraded, something down or wrong
  2. User clicks it -> the menu lists problems first, then every service with its state; items Open Fabric Dashboards, Pause notifications for 1 hour, the line "Quitting Dashboards does not stop your services.", Quit
  3. User chooses a service -> the window opens at its view, and the Dock icon comes back with it
- **Expected result:** the state is known without opening the window
- **UI elements:** menu bar icon, tray menu, service items, Pause notifications item
- **States covered:** success, error
- **Errors & recovery:** nothing can fail in the menu; quitting leaves every service running and the menu says so above Quit — never a dialog on the way out
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
  1. User opens Settings -> system shows Launch at login (off until the person chooses, on the first-run card or here), Notifications per service with levels, Quiet hours (from–to), the services folder, Uninstall, and Unattributed listeners
  2. User changes a setting -> it applies immediately and is kept across restarts; launch at login is registered with macOS only at this moment, never by a launch or an update
  3. User opens Unattributed listeners -> system lists local ports listening on all interfaces that no descriptor claims, with the program name and pid
  4. User chooses Uninstall Fabric Dashboards… and confirms -> the app removes its login item and its entry in Claude Code's MCP servers, moves itself to the Trash and quits; its data is removed once it has exited; services and their data stay
- **Expected result:** the app fits the operator's day, stray network listeners are visible, and leaving the app leaves nothing behind
- **Alt paths:** the person turned the login item off in System Settings -> the next launch shows it off here and does not turn it back on
- **UI elements:** toggles, per-service rows, time pickers, folder path with Show, Uninstall button and its confirmation, listeners list
- **States covered:** empty, success, error
- **Errors & recovery:** macOS refuses the login item -> the toggle returns to off with the reason; the listener scan is unavailable -> "Cannot list listeners: <reason>"; uninstall cannot remove the login item or the MCP entry -> "Nothing was removed: <reason>" and the app stays; the app cannot be moved to the Trash -> it says so and is still uninstalled
- **Status:** draft
- **Coverage:** src/renderer/components/Settings.tsx, src/renderer/components/Overview.tsx, src/core/settings.ts, src/core/loginitem.ts, src/core/uninstall.ts, src/core/listeners.ts, test/parts.test.ts, test/lifecycle.test.ts
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
- **Alt paths:** a link with no path opens the service's dashboard; `fabric-dashboards://activity` opens Activity; `fabric-dashboards://` opens the overview; the app is not installed -> the agent's own tool opens the plain `http://127.0.0.1` address in the browser instead (SCN-028)
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
  1. System refuses the link -> the window comes forward and a message says "This link cannot be opened" with the reason (for example `no installed service "x.default"`) and "Nothing was opened."
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
  1. Agent calls `list_services` or `service_status` -> it receives each service's state and reasons, version and commit, dashboard address, deep link, tiles and pending update — no token
  2. Agent calls `link` for a job it started -> it receives the deep link as the primary dashboard action and the plain address for diagnostics; `host_status` distinguishes installed/absent/unknown/version/handler; `open` uses the existing host (browser only for confirmed absence with `fallback=if_absent`, never with `fallback=never`)
  3. Agent calls `control` (start, stop, restart), `doctor` or `update` -> the same launchd verbs and descriptor commands as the app run, and the tool returns the result it observed
  4. Agent calls `activity` -> recent events as sentences, each with a deep link when it points at a page
- **Expected result:** agents hand the operator the exact page and use the app's rules for administration instead of launchctl by hand
- **Alt paths:** a service without launchd lifecycle -> `control` refuses; no declared update -> `update` refuses
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
- **Errors & recovery:** the token file is missing or readable by others -> the card is `invalid` with that sentence and the service is never contacted; fix the file and the next scan reads it
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
- **Errors & recovery:** the login code is refused or the page cannot load -> the view says so in a sentence with Reload, as in SCN-016
- **Status:** draft
- **Coverage:** src/electron/views.ts, src/core/probe.ts, test/remote-e2e.test.ts
- **Product:** unobserved

### SCN-032: An online service that cannot be reached says why
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-013, ST-004 (JTBD-01, JRN-01/#1)
- **Entry point:** an Online card or its service view
- **Preconditions:** a remote descriptor
- **Steps:**
  1. The service refuses the token -> `down`, «the service refused the token — set the same token on its platform and here»
  2. The certificate does not verify -> `down`, the reason names TLS; the app does not connect around it
  3. The service answers with a redirect -> `down`, «answered with a redirect, which the app does not follow»
  4. Nothing answers for a minute -> `down` with the time it went quiet; one missed probe is not an outage (ADR-0008)
- **Expected result:** I can tell a configuration problem from an outage without opening a terminal
- **Alt paths:** another service answers the origin -> `foreign`, and the app does not send the token there again until the descriptor changes
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
  2. User looks below the agents -> the communicator is listed under **Background**
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
  1. User clicks Spend -> system reads each agent's usage report with its token in the main process and shows totals for Today, 7 days and 30 days across agents
  2. User reads the table -> one row per reporting agent: today, 7 days, 30 days, and its own budget ("$1.59 of $100.00 this month")
  3. User clicks an agent's name -> the row expands to models: model, provider, calls, tokens in / out, cost over the last 31 days, most expensive first
  4. User leaves the page open -> it is read again every minute; Refresh reads it now
- **Expected result:** where the money goes, per agent and per model, without opening a provider console
- **Alt paths:** no agent reports -> "No agent reports its spend yet" with what an agent must publish; some agents report and others do not -> "Not reporting spend yet: …" names the others; an agent asks through MCP `spend` -> the same sums
- **UI elements:** Spend nav item, totals tiles, agents table, model breakdown, Refresh
- **States covered:** loading, empty, success
- **Errors & recovery:** see SCN-038
- **Status:** draft
- **Coverage:** src/renderer/components/Spend.tsx, src/core/spend.ts, packages/service-host/src/usage.ts, src/mcp/tools.ts (spend), test/e2e/spend.test.ts
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
- **Alt paths:** every call in a window unpriced -> that window reads "unknown"; no calls in a window -> "$0.00"
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
  2. User reads the totals -> they carry "≥", because one agent's spend is missing
- **Expected result:** a failure is named and never silently counted as zero; the other agents still show
- **Alt paths:** the token file is not 0600 -> the reason names it; the agent answers a report for another instance -> refused
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
  3. User clicks Reload page -> the same page loads again, a spinner on the button while it loads
  4. User clicks Dashboard home -> the service's dashboard path opens, signed in
- **Expected result:** the operator controls the embedded page like a browser tab, without leaving the app
- **Alt paths:** the page crashed or the service restarted -> the existing Reload overlay (SCN-016) still appears; a page on another origin is never shown in the address
- **UI elements:** dashboard toolbar
- **States covered:** loading, success, error
- **Errors & recovery:** a reload that fails shows the existing sign-in error with Retry (SCN-016)
- **Status:** draft
- **Coverage:** src/renderer/components/ServiceView.tsx (DashboardToolbar), src/electron/views.ts (page, navigate), test/e2e/app.test.ts
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
  1. User opens Overview -> a strip of five cells: agents ready out of all, not answering or in conflict, need attention, spent today, spent in 30 days
  2. User clicks a spend cell -> Spend opens (SCN-036)
- **Expected result:** the state of the whole estate and its cost is read before any card
- **Alt paths:** no agent reports spend -> the spend cells read "—" and do nothing; some calls unpriced -> «≥ $x»; everything unpriced -> "unknown"
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

