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
| SCN-019 | Notification when a service goes down and comes back | notifications | P-01 | ST-007 | validated | 2026-10-24 |
| SCN-020 | Notification from a service event opens the item | notifications | P-01 | ST-007, ST-006 | validated | 2026-10-24 |
| SCN-021 | Update a service | updates | P-01 | ST-008 | validated | 2026-10-13 |
| SCN-022 | The app updates itself | updates | P-01 | ST-008 | validated | 2026-10-24 |
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
| SCN-043 | Reinstall picks up where I left off | settings | P-01 | ST-017, ST-010 | draft | 2026-10-27 |
| SCN-044 | A copy outside Applications moves itself so it can update | updates | P-01 | ST-017, ST-008 | implemented | 2026-11-13 |
| SCN-045 | A dashboard hands me to another agent | dashboards | P-01 | ST-005, ST-011 | validated | 2026-10-12 |
| SCN-046 | The dashboard gets the screen: a one-line header that opens to the full card | focus | P-01 | ST-018 | validated | 2026-10-24 |
| SCN-047 | The agents list folds into a rail | focus | P-01 | ST-018 | validated | 2026-10-24 |
| SCN-048 | Open an agent's console over its dashboard | console | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-049 | Start a runtime in the agent's repository | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-050 | A folder bound to a Switchboard project runs on that project's account | console | P-01 | ST-019 | validated | 2026-10-06 |
| SCN-051 | The app watches contract and skill versions | estate | P-01 | ST-008, ST-017 | validated | 2026-10-14 |
| SCN-052 | Fabric Dashboards on Windows or Linux | platform | P-01 | ST-001, ST-008 | validated | 2026-10-27 |
| SCN-053 | The console's agent already knows which agent it works on | console | P-01 | ST-020 | validated | 2026-10-12 |
| SCN-054 | Fix with coding agent | console | P-01 | ST-020 | validated | 2026-10-12 |
| SCN-055 | Update with coding agent | console | P-01 | ST-020 | validated | 2026-10-14 |
| SCN-056 | Pin an agent to the top of the list | list | P-01 | ST-021 | validated | 2026-10-12 |
| SCN-057 | Sort the agents list | list | P-01 | ST-021 | validated | 2026-10-13 |
| SCN-058 | First session: my coding agent sets the system up | setup | P-01 | ST-022 | validated | 2026-10-12 |
| SCN-059 | A later session opens on what changed | overview | P-01 | ST-022 | validated | 2026-10-12 |
| SCN-060 | The dashboard keeps its floor while the console widens | console | P-01 | ST-019 | retired | 2026-10-23 |
| SCN-061 | Talk to Fabric about this agent | console | P-01 | ST-020 | validated | 2026-10-12 |
| SCN-062 | Outages reach me away from the Mac | notifications | P-01 | ST-002 | validated | 2026-10-13 |
| SCN-063 | A session starts only when the Mac can carry it | console | P-01 | ST-019 | validated | 2026-10-13 |
| SCN-064 | See what Switchboard runs for this agent | console | P-01 | ST-019 | validated | 2026-10-27 |
| SCN-065 | A provider limit does not stop the agent | console | P-01 | ST-019 | validated | 2026-10-27 |
| SCN-066 | An idle session closes and comes back | console | P-01 | ST-019, ST-023 | validated | 2026-10-27 |
| SCN-067 | Dashboards take my scheme and theme | settings | P-01 | ST-019 | validated | 2026-10-13 |
| SCN-068 | See which runner and model an agent uses | service | P-01 | ST-019 | validated | 2026-10-13 |
| SCN-069 | A hand-over opens in the console | sessions | P-01 | ST-023, ST-019 | validated | 2026-10-27 |
| SCN-070 | Check what is set up | settings | P-01 | ST-017 | validated | 2026-10-14 |
| SCN-071 | See agents on this Mac, online and services apart | list | P-01 | ST-021 | validated | 2026-10-23 |
| SCN-072 | Hide an agent without stopping it | list | P-01 | ST-021 | validated | 2026-10-23 |
| SCN-073 | See what an agent is connected to | service | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-074 | See how agents are wired and what problems were found | connections | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-075 | A session stopped on a limit continues by itself | sessions | P-01 | ST-023, ST-019 | validated | 2026-10-27 |
| SCN-076 | See how busy an agent is | service | P-01 | ST-019 | validated | 2026-10-23 |
| SCN-077 | Switch between Agents and Sessions | navigation | P-01 | ST-023 | validated | 2026-10-27 |
| SCN-078 | See every coding session in one place | sessions | P-01 | ST-023 | validated | 2026-11-13 |
| SCN-079 | The Sessions page explains itself once | sessions | P-01 | ST-023 | validated | 2026-10-27 |
| SCN-080 | Open one session's page | sessions | P-01 | ST-023, ST-019 | implemented | 2026-10-28 |
| SCN-081 | A running session: end it, or find where it runs | sessions | P-01 | ST-023 | validated | 2026-10-27 |
| SCN-082 | A session that needs you | sessions | P-01 | ST-023 | validated | 2026-10-27 |
| SCN-083 | A session waiting for a limit reset | sessions | P-01 | ST-023 | validated | 2026-10-27 |
| SCN-084 | An ended session continues or leaves | sessions | P-01 | ST-023 | validated | 2026-10-27 |
| SCN-085 | A taken hand-over tells me once, and the tray counts sessions | sessions | P-01 | ST-023, ST-007, ST-009 | validated | 2026-10-27 |
| SCN-086 | Settings → Sessions | settings | P-01 | ST-023, ST-010 | validated | 2026-10-27 |
| SCN-087 | Arrange the sidebar: width and order | list | P-01 | ST-021, ST-018 | validated | 2026-10-27 |
| SCN-088 | Choose the default and fallback coding agents | settings | P-01 | ST-010 | validated | 2026-10-28 |
| SCN-089 | See which agents are placed on the other machine | health | P-01 | ST-004 | validated | 2026-10-28 |
| SCN-090 | Rename an agent | list | P-01 | ST-003 | validated | 2026-11-03 |
| SCN-091 | Learn that anonymous usage and error data is shared | settings | P-01 | ST-017 | implemented | 2026-11-04 |
| SCN-092 | See a session Fabric started for a board request | sessions | P-01 | ST-023 | implemented | 2026-11-04 |
| SCN-093 | Hear of a new version with automatic updates off | updates | P-01 | ST-008 | implemented | 2026-11-04 |
| SCN-094 | Show only one organization's agents | organizations | P-01 | ST-019 | implemented | 2026-11-06 |
| SCN-095 | See an agent that only waits for setup | health | P-01 | ST-002 | implemented | 2026-11-07 |
| SCN-096 | Fabric opens a console session here | sessions | P-01 | ST-023 | implemented | 2026-11-07 |
| SCN-097 | A console session runs without permission prompts | console | P-01 | ST-010 | implemented | 2026-11-07 |
| SCN-098 | An agent changes what a person changes in Settings and on the Sessions page | mcp | P-01 | ST-010 | implemented | 2026-11-07 |
| SCN-099 | See the agents a space runs as system services | health | P-01 | ST-004 | implemented | 2026-11-08 |
| SCN-100 | See the setup as steps the agent works through | setup | P-01 | ST-022 | draft | 2026-11-08 |
| SCN-101 | Start a new session in a folder | sessions | P-01 | ST-019 | implemented | 2026-11-09 |
| SCN-102 | Start a new agent from the agent list | console | P-01 | ST-019, ST-022 | implemented | 2026-11-09 |
| SCN-103 | Edit an agent on the machine it runs on | console | P-01 | ST-004, ST-019 | implemented | 2026-11-11 |
| SCN-104 | Open here a session Switchboard's session host holds | sessions | P-01 | ST-019 | implemented | 2026-11-12 |
| SCN-105 | Keep several agents open and move between them | layout | P-01 | ST-002 | implemented | 2026-11-13 |
| SCN-106 | Give an agent's dashboard or console the whole window | layout | P-01 | ST-002, ST-019 | implemented | 2026-11-13 |
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
  1. User opens Fabric Dashboards for the first time -> system shows the window with the sidebar and Overview, a "Looking for agents…" line while it reads the services directory
  2. System reads every descriptor and probes each service -> each agent appears in the sidebar and as a card with its state, name and version within 5 seconds; a second instance of one agent appears inside that agent, and where it is named alone it carries its instance ("Example Agent · preview", SCN-033)
  3. User looks at the menu bar -> system shows the Dashboards icon with the aggregate state
  4. The first launch of an installed copy registers it to open at login, with no question (on by default since 2026-10-16, FD-72) -> Settings shows Open at login on, and the person turns it off there (SCN-024); when macOS holds the login item for approval, a notification says so (SCN-024)
- **Expected result:** every installed service is listed with its real state without any setup
- **Alt paths:** a service is installed but its launchd job is off -> it appears as "Stopped"; its page offers Start (SCN-010); a service not yet probed reads "Starting", never Stopped
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
  1. User opens the app -> system shows Overview with an empty state: "No agents yet", "Agents appear here once they are installed. Set up Fabric with your coding agent, or install an agent that supports Fabric.", and the services folder path (COPY-13)
  2. User chooses "Set up with my coding agent" -> the Setup console opens beside Overview (SCN-058)
  3. User chooses "Show the services folder" instead -> system reveals the folder in Finder, creating it first if absent
- **Expected result:** the operator knows the app works and what makes an agent appear
- **Alt paths:** a descriptor appears later -> SCN-003
- **UI elements:** empty state, "Set up with my coding agent" (primary), "Show the services folder", "How to build an agent for Fabric" (opens the fabric-agent-adapter guide in the browser)
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
- **Errors & recovery:** a half-written file shows as "Broken install file" ("the file cannot be read as JSON: …") until it parses, and Activity may record it as installed (U-16, later); nothing else can fail visibly beyond SCN-004
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
  1. System reads the descriptor -> the service appears with state "Broken install file" and the first problem in one sentence, "Its install file is broken: <problem>. Reinstall the agent." (for example "origin must be http://127.0.0.1:<port>")
  2. User opens it -> system shows every problem and the file path with "Show file"; no probe, token read or control is attempted
- **Expected result:** a broken installation is visible and explained, never silently skipped
- **UI elements:** "Broken install file" badge, problem list, "Show file" button
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
- **UI elements:** service cards, state dot and label, the agent's one-line summary, tiles, latest event line, header count "7 agents" (one per agent, ADR-0012)
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
  1. User opens Overview -> system shows Needs attention right under the strip (above "Since you were last here" and the cards), most severe first: one single-line row per problem with its state, the name, the reason cut to the line ("Not answering since 17:02.") and its actions in one cell (Restart for a local service that is down or runs twice, "Update to 0.2.1" when the service declares an update command, Open otherwise; Logs after a failed action; "Fix with coding agent" after the first action), the reason keeping a floor of 12 characters; an agent whose spending limit stopped work is a row too ("Its spending limit stopped work (daily).", Open Spend), after the agents that do not answer; while the action runs the row shows its progress ("Restarting…"); a folded row of agents down for one reason offers "Restart 3"; more than three rows wait behind "Show all" (SCN-042). The heading's count is the one count of what needs attention: the Overview badge in the sidebar (red when something does not work), the tray's "Needs attention: N" and the Dock badge show the same number (W2, UX-04)
  2. User chooses the action -> system performs it (SCN-007, SCN-011, SCN-021); the row leaves when the problem clears, and a failed action keeps its row, with the failure sentence and Logs, for 30 minutes
- **Expected result:** problems are the first thing read, each with its next action
- **Alt paths:** a degraded service lists its reasons with Open, when the fix is inside the service ("Collector: last ran 3 days ago"); an online service never offers Restart: its platform supervises it; several agents in the same state for the same reason (one hub down behind them) -> one line, "3 agents: A, B, C" with the reason once, each name opening its agent (FD-86); a coding session that needs the person is not listed here: from 0.8.0 the Sessions switch counts it (SCN-077, SCN-082)
- **UI elements:** Needs attention block, problem rows, action buttons (each names its service for a screen reader), the count on Overview in the sidebar, which is the Needs attention count: one per agent in the queue, whatever put it there (a problem state, partly working, an attention tile, an update, a running action, a spending limit that stopped work, a failed action of the last 30 minutes; `attentionQueue` in src/core/attention.ts), red when one of them does not work (`urgent`)
- **States covered:** error, success
- **Errors & recovery:** the action fails -> the row keeps its place with the failure sentence and Logs
- **Status:** validated
- **Coverage:** packages/service-host/src/state.ts (attentionRank), src/core/attention.ts (groupAttention, test/attention.test.ts; attentionQueue, urgent, badgeText, test/attention-queue.test.ts), src/core/spend.ts (limitsNeedingPerson), src/renderer/components/Overview.tsx (test/attention-screens.test.ts), test/e2e/overview-settings.test.ts
- **Product:** unobserved

## control

### SCN-007: Restart a service that is down
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** Needs attention row or service view header (the tray menu opens the service view)
- **Preconditions:** the service is managed by launchd
- **Steps:**
  1. User chooses Restart -> the header and the Needs attention row show "Restarting…", the state reads Starting, and Restart, Stop, Update and Run self-check are disabled; a second click is refused ("<Service> is busy with another action…")
  2. System asks launchd to restart the job and probes until the service answers as itself with a new pid -> state becomes Ready (or Partly working with reasons); Activity gains "<Service> restarted (pid 5542)"
- **Expected result:** the service answers again, started by launchd, and the result is stated
- **Alt paths:** the job was not loaded -> system enables and loads it first, then waits; the page of the restarted service reloads by itself, and its toolbar says "Restarted; the page reloaded." for a moment (SCN-015)
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
- **UI elements:** failure message, Logs button, Run self-check button
- **States covered:** error
- **Errors & recovery:** launchctl itself refuses -> "launchctl refused: <its message>. Press Start again; if it refuses again, reinstall the agent." (FD-113 COPY-24)
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
  1. User chooses Stop -> system asks to confirm: "Stop <Service>?" with "It stays stopped, also after the Mac restarts, until you start it. Agents that use it will get no answer." ("the computer restarts" on Windows and Linux), Cancel (focused) and Stop
  2. User confirms -> system unloads and disables the job and waits until it no longer answers -> state becomes Stopped; Activity gains "<Service> stopped by you"
- **Expected result:** the service is off and stays off across logins
- **Alt paths:** user cancels (Cancel, or Escape wherever focus is) -> nothing changes and focus returns to Stop; the service disappears while the dialog is open -> the dialog closes
- **UI elements:** Stop button, confirmation dialog with Stop and Cancel (focus stays in it while it is open; after Stop it moves to the service's name), Stopped badge
- **States covered:** loading, success, error
- **Errors & recovery:** still answering after 40 s -> "<Service> is still answering; another copy may run outside launchd." with Logs when declared
- **Status:** validated
- **Coverage:** src/core/launchd.ts, src/renderer/App.tsx, test/monitor.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-010: Start a stopped service
- **Persona:** P-01
- **Feature:** control
- **Traces:** ST-003 (JTBD-02, JRN-01/#3)
- **Entry point:** a stopped service in Overview or the sidebar, its service view header (the tray menu opens the service view)
- **Preconditions:** the service is Stopped
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
  2. User chooses "Run self-check" -> system runs the declared doctor command (no shell), switches to Health and shows "Running the self-check…", then "Self-check finished with exit code <n>." and its output
- **Expected result:** the operator sees why a service misbehaves without a terminal
- **Alt paths:** no doctor declared -> the button is absent; no logs declared -> "This agent declares no log files."; the Health tab's properties name who installed the agent from its descriptor (FD-161, contract DEC-0061): "installed by: you, with <tool>", "an organization's administrator, with <tool>", "Project Observatory, from your list of agents (<tool>)" or "Project Observatory, from an organization's list of agents (<tool>)", a role and never a person; an older install file names only its installer, shown as written
- **UI elements:** Logs tab, log panes, Run self-check button, output panel
- **States covered:** loading, empty, success, error
- **Errors & recovery:** the command times out after 120 s -> "Self-check did not finish within 120 s." and the partial output; the command cannot start -> "Self-check could not run: <reason>"; the service is busy with another action -> "<Service> is busy with another action…"; a log file is unreadable -> "Cannot read <path>: <reason>"; an online service has no Logs tab
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
  1. System probes -> state becomes "Two copies"; Needs attention: "Two copies run: process 4412 answers, while the system started process 5542. Restart it to keep one." with Restart; a notification "<Service> runs twice" says the same; Activity gains "<Service> runs as two copies (pid 4412 and pid 5542)."
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
  1. System probes -> state becomes "Wrong program on port", with "Port 47187 answers as maker.default, not as this agent. Nothing is sent to it." or "Port 47187 is used by a program that is not a Fabric agent (<detail>). The app sends it no token until it asks for one."; a notification "Wrong program on <Service>'s port"
  2. User opens the service -> it opens on Health; the Dashboard tab says "The dashboard opens when the agent answers as itself."; no token is sent, and no version, tiles, tools or update of the other program are shown as the service's (S-5); Spend never reads it (S-1)
  3. The service wrote why on its own stderr (launchd writes it to the file its descriptor names in `paths.logs`, as "Port 47851 is in use on this Mac; give this installation its own --port, or stop what uses it.") -> one more reason line reads "Its log says: <that line>", and the notification on this Mac ends with it (FD-198, TG-260). The same holds for "Not answering" (SCN-019) and "Two copies" (SCN-011). Only the last non-empty line of a log written during this episode counts (within the last 15 minutes, or since the service stopped answering), without terminal colours, at most 240 characters; it never goes to the operator channel (FD-48 sends the first reason only)
- **Expected result:** the operator knows the port is taken by another program and nothing is sent to it
- **Alt paths:** on a Mac with several macOS users (or, FD-159, a Linux or Windows computer with several users), the port answers from another user's process (FD-158, the contract's draft norm on loopback owners) -> state "Another user's program", reason "Port {port} is held by a program of another macOS user on this Mac. Nothing is sent to it.", a notification "Another user's program on <name>'s port" once; whatever that process answers, its own id included, is never shown as this service's, no token is sent there (FD-156), and a port nobody holds is still "Not answering"; a listener whose owner the Mac, Linux or Windows tables cannot tell (FD-159, DEC-0154 HA-2) reads the same state with the reason "This computer would not say whose program holds port {port}. Nothing is sent to it." only when its owner is still unknown at a read 15 s or more after the first (FD-201: an owner untold once, as while launchd restarts the job and the pid it named has already exited, keeps the agent as it was, says nothing and is read again within 6 s; an MCP read asks once more after 5.5 s); a listener of another account that accepts the connection and stays silent reads the same state, never "Starting" or "Not answering" (DEC-0154 HA-2); the port answers 401 or 403 to the well-known document (FD-160: the program there, the agent itself included, turned the app away, as an agent that cannot place its peer does) -> state "Not answering", reason "The program on port {port} refuses this app (HTTP 403 on /.well-known/fabric-service). Nothing is read from it.", never "Wrong program on port": a refusal says nothing about which program it is
- **UI elements:** "Wrong program on port" badge, reason line, the log's line as a second reason (FD-198), Dashboard tab notice
- **States covered:** error
- **Errors & recovery:** resolved when the port answers as the service again
- **Status:** validated
- **Coverage:** packages/service-host/src/state.ts, test/monitor.test.ts, test/flap.test.ts, test/e2e/health-states.test.ts; FD-158: test/foreign-user.test.ts, packages/service-host/test/look.test.ts *FD-158*, the `state-precedence.json` cases *FD-158*; FD-198: src/core/monitor.ts (`logReason`, `lastLogLine`), test/log-reason.test.ts; FD-201: src/core/monitor.ts (`unknownOwnerSince`), packages/service-host/src/look.ts (`ownerRecheckMs`), test/foreign-user.test.ts *FD-201*; copy "Its log says: {line}" / «В его логах: {line}» (copy checks `1b7c2bac` en, no findings, and `ae226e9d` ru, whose suggestions are about the service's own English line, shown as written)
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
- **Preconditions:** the service is Ready or Partly working and declares a dashboard
- **Steps:**
  1. User chooses the service -> system shows the service view: header (state, what the agent is for, version and commit, pid, uptime, port, its Tools — the MCP capabilities it serves, eight shown and "+N more" — and controls) and the Dashboard tab with "Opening…"
  2. When the dashboard needs a login, system obtains a one-time code with the service token and opens it -> the service's own page appears, signed in
- **Expected result:** the agent's dashboard is usable in the app without a browser or a password, and no token is visible anywhere
- **Alt paths:** the dashboard declares no login -> it opens directly; the service declares no dashboard -> the view opens on Health and the Dashboard tab says "This agent has no dashboard."; the service is not ready or degraded -> "The dashboard opens when the agent answers as itself."
- **UI elements:** service view header, tabs Dashboard / Activity / Health / Logs, embedded page, loading line
- **States covered:** loading, success, error
- **Errors & recovery:** see SCN-016; a link inside the page to another agent opens that agent here (SCN-045); a link to any other site asks "Open in your browser?" with "<address> is outside this agent's dashboard. It opens in your default browser.", Open in browser and Cancel
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
  2. The service restarts (a new version, a crash) -> the page on screen signs in again and reloads where it was, by itself; the toolbar says "Restarted; the page reloaded." for a moment; a page off screen reloads where it was the next time it is shown (FD-74); an HTTP failure shows Retry (SCN-039)
  3. User comes back to a page whose view was closed (the window was hidden, or the page crashed) -> it opens at once, without a new sign-in, while the same service process signed this app in less than 30 minutes ago; a page or a request of it that is refused then signs in once, on the same page (FD-74)
- **Expected result:** one live view per service, never duplicated; a page the person comes back to opens at once and shows the agent's current version
- **UI elements:** embedded page, "Restarted; the page reloaded." in the toolbar
- **Alt paths:** the session ended while the page was open (the service answers 401) -> the app signs in again by itself, once a minute at most, and reopens the same page (ADR-0014); the window stays hidden for 5 minutes -> every dashboard is released except the two shown last, which open at once when the window shows again; after an hour hidden those two are released as well, and showing the window again reopens the one that was on screen, on its page (FD-74)
- **States covered:** success
- **Errors & recovery:** the page crashes -> the app recreates it once (another recreate only after the page stayed up 60 s), then shows "The page stopped." with Reload
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
  1. System fails to get a login code -> the tab shows "Cannot sign in to <Service>: <reason>. Press Retry; if it repeats, restart the agent." (for example "the token file is readable by others; set mode 0600") and the token file path
- **Alt paths:** the page itself does not load -> "The page of <Service> could not load: <reason>. Press Retry; if it repeats, restart the agent." with Retry and no token path; the reason is the error's name, never the address it loaded (S-3)
- **Expected result:** the reason and the file to fix are named; the app never falls back to a URL carrying a secret
- **UI elements:** sign-in error panel, path, Retry
- **States covered:** error
- **Errors & recovery:** Retry signs in again and shows the page again (R-6); Run self-check when declared
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
  4. User chooses one of the app's own events (stopped answering, restarted, runs twice) -> that agent's page opens; on an agent's own Activity tab its events open the same way, a row with a link at that page of the dashboard (FD-129 UX-15)
- **Expected result:** everything the agents did is readable in one place and the unread count clears
- **Alt paths:** no events yet -> "Nothing has happened yet. Events appear here as your agents work."; the session ended while the page was open (the service answers 401) -> the app signs in again by itself, once a minute at most, and reopens the same page (ADR-0014)
- **UI elements:** Activity list, day headers, service and level filters (labelled Agent and Level), unread count (notice, warning and error rows since the page was last open; reading marks new rows seen)
- **States covered:** loading, empty, success
- **Errors & recovery:** see SCN-018
- **Status:** validated
- **Coverage:** src/core/activity.ts, src/renderer/components/Activity.tsx, src/renderer/components/ServiceView.tsx (ServiceActivity), test/activity-feed.test.ts, test/e2e/app.test.ts
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
  3. The service answers again -> one notification, "<Service> is back" with "After 2 min."
- **Expected result:** the operator learns about an outage and its end once each
- **Alt paths:** the service returns before a failed probe confirms 60 s of silence -> no notification, neither down nor back; Activity records it. One slow answer under load (a probe waits 5 s) changes nothing ([ADR-0008](../adr/0008-a-missed-probe-is-not-an-outage.md))
- **UI elements:** macOS notifications
- **States covered:** success
- **Errors & recovery:** none in the app: whether macOS shows notifications is set in System Settings → Notifications, and Settings says so with "Open System Settings" ("Open system settings" on Windows and Linux; the app cannot read that permission); an online service's notification says its platform runs it
- **Status:** validated (2026-10-24: proved by test/flap.test.ts "a sustained outage notifies once, and its end once" and "a flap inside the notification window sends no notification, neither down nor back", test/monitor.test.ts "a service that stops answering becomes down, notifies once, and is back"; strings `notify.down.title`, `notify.back.title`, `notify.back.body` in src/core/i18n.ts)
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
- **Status:** validated (2026-10-24: proved by test/notify.test.ts "intent: what the agent wants from the operator, read from the event kind and level", "display name: the instance is named when it is not the default, and only once" and "compose: who (the agent), what it wants (subtitle) and the sentence; several at once say the most urgent", test/monitor.test.ts "discovers a service, reads its events and notifies only on new ones")
- **Coverage:** src/core/monitor.ts, src/core/notify.ts, src/electron/main.ts, test/monitor.test.ts, test/notify.test.ts
- **Product:** unobserved

## updates

### SCN-021: Update a service
- **Persona:** P-01
- **Feature:** updates
- **Traces:** ST-008 (JTBD-01, JRN-01/#6)
- **Entry point:** Needs attention row, the service view's one-line bar or its full card showing "Update to 0.2.1" (a degraded service too: the update may be the fix)
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
  1. System checks 90 s after start and every 5 minutes (`FIRST_CHECK_MS`, `APP_UPDATE_EVERY_MS` in src/core/version.ts; test/lifecycle.test.ts asserts the 5 minutes), downloads the release's zip once and verifies it (its SHA256SUMS signed by the organization's key, the zip's hash, the app's signature by team KJ35UYYL22 and its version), then hands the verified file itself to Squirrel through a local feed -> the sidebar footer and Settings → Updates show "Update <version> ready" with Restart to update
  2. User closes the window and leaves it closed for ten minutes -> the app installs the update and reopens in the menu bar, with no window and no question; services are untouched. On macOS a window left open behind other windows (fully covered) or on another desktop for ten minutes counts the same (FD-80): the update installs, and the window comes back on the screen it was on, behind the person's work, without taking the focus
  3. User opens the window later -> it is the new version, on the Overview
- **Expected result:** every copy stays current with no action from the person
- **Alt paths:** user chooses Restart to update while an agent's console or a command runs -> the app names them and asks; Cancel keeps everything running, Restart to update stops them and installs; user chooses Restart to update -> a notification says the app reopens by itself and it installs now, and the new copy opens on the screen the person left (the agent's page, Activity, Spend or Settings; FD-21 U-18); the app is opened (by the person, a link or an agent) while the update installs -> it says "Finishing the update to <version>" with "Fabric Dashboards reopens by itself in a minute or two.", steps aside, and reopens when the install has finished; the window stays open -> nothing installs under the person's eyes, and it installs at the next quit or the next ten closed minutes; a doctor or update command is running -> the install waits for it, checked every minute; "Install updates automatically" is off in Settings → Updates -> nothing is checked, downloaded or installed on its own, and Check for updates still works (LC-16; the choice is kept in a file no update, reinstall or uninstall rewrites); the release needs a step from the person -> it is verified but held: "Update <version> needs a step from you before it installs." with What to do (opens the release's steps) and Install; Settings → Updates → Check now checks at once; the feed names a version that is not newer than the installed one -> nothing installs (F-1); the disk has too little room to unpack the update -> Settings → Updates says "not enough free space to unpack the update: N GB free, about M GB needed", and a failed unpack says the tool's own words and the free space, never only that it failed; the next check tries again (FD-79); the window is shown while an update is ready -> the log says the install waits for the window, and a window of a hidden app (⌘H, or hidden by another program) counts as not shown, so the ten minutes start (FD-80); on Linux from an AppImage -> the same checks, then the new AppImage replaces this one and Restart to update (or ten hidden minutes) starts it (FD-37 M4b); on Linux from a .deb -> Settings → Updates says a newer .deb from the releases page updates it, and nothing is checked; on Windows, installed by the installer -> the same checks, then Restart to update (or ten hidden minutes) runs the verified installer silently in update mode, which installs in place and starts the app again (FD-37 M4c); on Windows without the installer's uninstaller beside the app -> Settings → Updates says this copy was not set up by the installer and where the newer version is
- **UI elements:** footer update line, Restart to update button, held line with What to do and Install, Settings → Updates (Install updates automatically, state line, Check now), "Check for updates" in the app menu
- **States covered:** loading, success, error
- **Errors & recovery:** download or signature check fails -> footer "Update failed: <reason>" with Retry, the next check 5 minutes later tries again (`RETRY_AFTER_FAILURE_MS` in src/electron/updater.ts), and the running app is unchanged; the bundle Squirrel staged is not the verified one -> it is removed before any quit and the footer says so; every step is logged with the organization's update codes (ADR-0015 amendment)
- **Status:** validated
- **Coverage:** src/electron/updater.ts, src/core/self-update.ts, test/self-update.test.ts, src/core/release-verify.ts, src/core/autoupdate.ts, src/core/version.ts (mayCheck, stagedRefusal), src/electron/policy.ts (autoInstallNow, relaunchHidden, inSight, resumeBehind), src/electron/main.ts (auto-install-flow), src/renderer/components/Settings.tsx (UpdateState), scripts/dist-mac.mjs, test/lifecycle.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

## estate

### SCN-051: The app watches contract and skill versions
- **Persona:** P-01
- **Feature:** estate
- **Traces:** ST-008, ST-017 (JTBD-01, JRN-01/#6)
- **Entry point:** app running; Settings → Fabric contract and skills updates (named "Estate updates" before FD-113 COPY-22)
- **Preconditions:** "Watch the contract and skill versions" is on (default)
- **Steps:**
  1. System checks 90 s after start, every 6 hours and 5 s after a settings change: the contract clone named in Settings (the remote's `main` against what the clone has fetched) and the published sshlg-skills version against the installed-version record -> Settings → Estate updates shows the contract state, the clone's own `main`, and which consumer pins (every `fabric-contract.lock.json` beside the clone, Fabric's and Dashboards' fixtures) name an older commit; one retry within the hour after a failure
  2. System finds the clone has not fetched the remote's `main` -> it runs `git fetch origin` only — never pull, reset or rebase — says the commits were fetched, and the pins are reported, never rewritten
  3. User turns on "Update skills by themselves" -> before applying, the app checks that every maintainer and the publisher of that exact version are the expected owner, then runs that version's update in the background and records it; off (default): a newer version is only reported
  4. User turns "Watch the contract and skill versions" off -> nothing runs until it is back on
- **Expected result:** the operator's estate — the contract and the skill family — stays visible, and only the safe steps ever run by themselves
- **Alt paths:** no clone named -> the section says so and no git runs (the skills are still checked); the named folder does not exist -> the section says so; it is not a clone of passioncode-ai/fabric-agent-contract -> the section says so, and only `git remote get-url` ran in it; the sshlg-skills family is not installed on this computer -> the section says so and nothing about it is read or asked (FD-34); the installed version is the family runtime's, whoever updated it; a clone path that is not absolute or `~/` -> the field says it was not saved
- **UI elements:** Settings → Fabric contract and skills updates (watch switch, auto-update skills switch, the contract's folder field ("Local copy of the contract"), status lines for the contract, the pins and the skills)
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
  1. User looks at the icon -> it shows one of three states: calm (nothing degraded, starting or wrong; a service you turned off keeps it calm), something degraded or starting, something down or wrong; the Dock icon, while shown, carries the Needs attention count as a number, the same count as the menu's first line, Overview's Needs attention and the sidebar badge (`badgeText` over `attentionQueue`, src/electron/main.ts pushStatus), and no badge when nothing needs attention
  2. User clicks it -> the menu starts with a line "Needs attention: 2" (the same count as Overview's Needs attention, the sidebar badge and the Dock), "Ready: 5 of 7" or "All agents ready", lists what needs attention first ("Growth: spending limit stopped work", "Relay: update 2.0.0 available"), then every other agent the person has not hidden, with its state and instance ("● Growth · projection: Ready", src/core/tray-model.ts; a hidden agent that needs attention stays in the first part, FD-129 UX-19); items Open Fabric Dashboards, Pause notifications for 1 hour (Resume notifications while paused; the menu updates when a pause set here or in Settings ends), the line "Quitting Dashboards does not stop your agents.", Quit
  3. User chooses a service -> the window opens at its view, and the Dock icon comes back with it
- **Expected result:** the state is known without opening the window
- **UI elements:** menu bar icon, tray menu, service items, Pause notifications item; from 0.8.0, while a coding session runs or needs the person, a line "Sessions: running N, need you M" under the headline that opens the Sessions mode (SCN-085)
- **States covered:** success, error
- **Errors & recovery:** nothing can fail in the menu; quitting leaves every service running and the menu says so above Quit — no dialog on the way out, except when an agent's console session or a command the app started is running: then Quit names them and asks (Cancel keeps them; ADR-0017 amendment 2026-10-07)
- **Status:** validated
- **Coverage:** src/electron/tray.ts, src/core/tray-model.ts, src/core/attention.ts (`attentionQueue`, `badgeText`), src/electron/main.ts (`syncDock`, pushStatus), test/attention-queue.test.ts, test/e2e/spend.test.ts (*FD-129 (UX-19)* for hidden agents)
- **Product:** unobserved

## settings

### SCN-024: Settings: launch at login, notifications, quiet hours
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-010, ST-007 (JTBD-03, JRN-01/#7)
- **Entry point:** sidebar Settings
- **Preconditions:** none
- **Steps:**
  1. User opens Settings -> system shows Open at login (on by default since 2026-10-16: the first launch of an installed copy registers it once, with no question; the person turns it off here; `loginItemAtStartup` in src/core/loginitem.ts), Colour scheme (FD-226: called Theme before), Language (Same as the system, English, Русский), Updates (SCN-022), Notifications per service with levels (the rows of agents hidden from the sidebar folded under "Hidden: N", FD-129 UX-20), Quiet hours (from–to), the services folder, Unattributed listeners and, last, Uninstall (VIS-21); a line of section names at the top brings each group into view (UX-20); a text field that refuses its value has a red border as well as the message under it
  2. User changes a setting -> it applies immediately and is kept across restarts; after the first launch, launch at login is registered or removed only by the person's choice here, never by a launch or an update
  3. User opens Unattributed listeners -> system lists local ports listening on all interfaces that no descriptor claims, with the program name and pid
  4. User chooses Uninstall Fabric Dashboards… and confirms, leaving "Also delete my settings and activity history" unticked -> the app removes its login item and its entry in Claude Code's MCP servers, moves itself to the Trash and quits; once it has exited, its caches, logs and dashboard sessions are removed, and the settings, the activity history and a note of what to restore stay (SCN-043); services and their data always stay
- **Expected result:** the app fits the operator's day, stray network listeners are visible, and leaving the app removes everything it added without losing what the person set up
- **Alt paths:** user picks Русский (or English) under Language -> the window, the app menu and the tray switch at once, and machine reasons (a descriptor check, a network error) read in that language where they are known, while a service's own words (tiles, events) stay as the service wrote them; Same as the system follows the system language; the person turned the login item off in System Settings -> the next launch shows it off here and does not turn it back on; macOS holds the login item for approval -> every launch shows a notification "Fabric Dashboards cannot open at login" with "Allow it in System Settings → General → Login Items. Click to open it.", and clicking it opens that pane; an update has been downloaded and verified -> a notification "Restart to finish updating" once per version, and clicking it restarts the app (asking first when a console session or a command runs); the person ticks "Also delete my settings and activity history" -> everything the app wrote is removed after it exits, nothing is restored later; settings.json is damaged -> the last good copy is restored and the log says so
- **UI elements:** the section index, toggles, Language select, per-service rows (hidden agents folded), time pickers, folder path with Show, listeners list, Uninstall button and its confirmation with the delete-data box
- **States covered:** empty, success, error
- **Errors & recovery:** macOS refuses the login item -> the toggle returns to off with "macOS refused the login item: <reason>" ("approve Fabric Dashboards in System Settings → General → Login Items" when it needs approval); the listener scan fails -> "Cannot list listeners: <reason>", and nothing listening is "None", not an error; uninstall cannot remove the MCP entry or the login item -> "Nothing was removed: <reason>" and the app stays (a refused login item puts the MCP entry back); the app cannot be moved to the Trash -> it says so and is still uninstalled; Show the services folder fails -> "Could not open <path>: <reason>"
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
- **Alt paths:** the person added their own `fabric-dashboards` MCP entry meanwhile -> it is kept; a project the entry belonged to is gone -> that entry is not recreated; the data was deleted on purpose -> the app starts fresh, as a first launch (SCN-001: open at login registered again, by default)
- **UI elements:** none new (Settings, Activity)
- **States covered:** success, error
- **Errors & recovery:** macOS refuses the login item -> it stays off, the reason is logged, and it is not asked again on every launch; `~/.claude.json` cannot be edited -> the MCP entry is restored at the next launch
- **Status:** draft
- **Coverage:** src/core/uninstall.ts (restore-record, restoreMcpRegistrations, repairMcpRegistrations), src/electron/main.ts (reinstall), src/core/settings.ts, test/lifecycle.test.ts ("ADR-0015: the MCP entries an uninstall removed come back on reinstall, pointed at the new launcher", "ADR-0015: the restore record round-trips; a damaged one is ignored, never trusted"), test/parts.test.ts
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
- **Status:** implemented (2026-11-13, FD-230: the rules are pure functions in `src/electron/policy.ts` (`moveSkip`, `offerMove`, `tryMove`), used by the question, the Settings and footer button and MCP `app_install`; `test/lifecycle.test.ts` "SCN-044: a packaged macOS copy outside Applications is asked once, moves, and a refused or failed move gives its reason". Not validated: no test moves a real signed copy, since Electron's move writes to /Applications and the installed copy holds the single-instance lock)
- **Coverage:** src/electron/policy.ts (moveSkip, offerMove, tryMove), src/electron/updater.ts (misplaced), src/electron/main.ts (moveToApplications, offerMoveToApplications), src/renderer/App.tsx (UpdateLine), src/renderer/components/Settings.tsx (UpdateState), test/lifecycle.test.ts
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
- **Alt paths:** a link with no path opens the service's dashboard; `fabric-dashboards://activity` opens Activity; `fabric-dashboards://` opens the overview; the app is not installed -> the agent's own tool opens the plain `http://127.0.0.1` address in the browser instead (SCN-028); `fabric-dashboards://` opens the Overview, whatever page was open; a link a program opens in the background (an agent's `open`, a script) opens its page behind the app the person is using, since macOS 14 and later keep that app in front, and the Dock icon bounces once (FD-229, issue #335)
- **UI elements:** service view, embedded dashboard
- **States covered:** loading, success
- **Errors & recovery:** see SCN-027; a dashboard that cannot sign in -> SCN-016
- **Status:** validated
- **Coverage:** src/core/deeplink.ts, src/electron/main.ts, src/electron/policy.ts (linkLeftBehind), test/deeplink.test.ts, test/e2e/app.test.ts
- **Product:** unobserved

### SCN-027: A link that cannot be opened
- **Persona:** P-01
- **Feature:** links
- **Traces:** ST-011 (JTBD-04, JRN-01/#5)
- **Entry point:** SCN-026 step 2
- **Preconditions:** the link names no installed service (an address no descriptor names adds the step that registers its agent, FD-109), a key that is not `id.instance` (an encoded character, a capital letter, a third part), something after the key, a parameter other than `path`, a `#fragment` outside `path`, a user, password or port, a path that is not on the service's own origin (`//host`, a full URL, a backslash), a non-local address, or an unknown verb
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
  3. The service is stopped -> the same view opens, the state reads Stopped and Start is offered in the bar and in the Dashboard tab ("Stopped by you. It stays stopped until you start it."); a starting one says "Waiting for the first answer…", one that does not answer says why with Restart and Logs (SCN-010, UX-12)
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
  2. Agent calls `link` for a job it started -> it receives the deep link as the primary dashboard action and the plain address for diagnostics; `host_status` distinguishes installed/absent/unknown/version/handler; `open` uses the existing host and by default never a browser (`fallback=never`, FD-109; a browser only for confirmed absence when the agent passes `fallback=if_absent`); an address no descriptor names is refused with the step that registers its agent, never opened
  3. Agent calls `control` (start, stop, restart), `doctor` or `update` -> the same launchd verbs and descriptor commands as the app run, and the tool returns the result it observed; an agent that carries the operator's decision in `_meta.decision` has it recorded as the operator's in `decisions.jsonl` beside the app's log, an invalid one is refused `decision-invalid` and nothing runs, and a call without one still runs as the agent's own act (FD-110, DEC-0121, MD-10). `initialize` declares this app's buttons and their tools in its `_meta`; with the app running, `console_new` and `console_fix` start a console session or a fix in it through the app's own channel (ADR-0025, FD-120), and with the app closed they answer `app-not-running` and start nothing
  4. Agent calls `activity` -> recent events as sentences, each with a deep link when it points at a page
  5. Agent calls `arrange` with an agent and pin, unpin, hide, show, as-service, as-agent, turn-off or turn-on (FD-123: off hides it too and the app stops watching it; on keeps it hidden and watched; show turns it on as well) -> the same choice the row menu and the hidden row's eye make (FD-122), written to the app's settings: a running app shows it within seconds (it watches settings.json, and stats it every 5 s for what the watch misses), a closed one when it opens; a choice that holds already changes nothing (`changed: false`); a hidden agent is still watched and still alerts
  6. Agent calls `spend` -> each agent's own usage entries (today, 7 and 30 days, per model, budget and every limit with its state; a null cost is unknown, `partial` a lower bound); a service that does not answer, or whose address another program answers, is an error entry — its spend is unknown, never "not reporting"
- **Expected result:** agents hand the operator the exact page and use the app's rules for administration instead of launchctl by hand
- **Alt paths:** an online service or one without launchd lifecycle -> `control` refuses; a missing launchd plist -> `control` refuses before calling launchctl; no declared doctor or update -> the tool refuses; an unknown tool -> a JSON-RPC error (-32602); an argument the tool does not declare -> refused; the app was updated under a running session -> the server hands the session to the installed copy's server and the new version answers the next call, on the same connection (FD-109); a server that took a session never hands it on, and on Windows and Linux only a replaced `resources/app.asar` counts as an update (FD-133: before it, every call there read the server as replaced and servers started each other without end); where no installed launcher can take it, the next call answers stale with both versions, and the server exits; `doctor` and `update` run the service's programs and are not marked read-only
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
- **Errors & recovery:** the token file is missing or readable by others -> the card is "Broken install file" with "The token file cannot be used: <reason>" and the service is never contacted; fix the file and the next scan reads it
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
- **Alt paths:** another service answers the origin -> "Wrong program on port", "<origin> answers as <id.instance>, not as this agent. The token is not sent there again." until the descriptor changes; the origin answers without the protocol -> "<origin> answers, but not as a Fabric agent (<detail>). The app sends it no token until it asks for one."; later checks go without the token until the origin answers 401 or as this service (RemoteTokenLatch)
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
  3. User clicks an agent's name -> the row expands to every limit the agent applies (DEC-0027) — which limit and for whom, its window, spent of limit, and its state (Stopped work, Over the limit, Close to the limit, Within, Spend not counted, Caps each job, Jobs above it wait for your approval, Not enforced) — and below it the models: model, provider, calls, tokens in / out, cost over the last 30 days (the same window as the 30-day column, FD-113 COPY-15), most expensive first; a model the agent ran on the operator's own subscription is its own row, its cost read "~$140.47 subscription" (FD-88)
  4. User clicks Open beside an agent's name -> its page opens (FD-129 UX-22); figures in every table line up on the right and read at body size, dollars with a thousands separator ("$1,234.56", VIS-18)
  5. User leaves the page open -> it is read again every minute while the window shows; a hidden window gets the last sums; Refresh reads now
- **Expected result:** where the money goes, per agent and per model, without opening a provider console
- **Alt paths:** a limit the operator chose not to apply -> still listed, muted, "Not enforced"; an approval threshold crossed -> "Jobs above it wait for your approval", never a breach; a kind of limit the app does not know -> listed by the agent's own name for it; no agent reports -> "No agent reports its spend yet" with what an agent must publish; some agents report and others do not -> "Not reporting spend yet: …" names the others; an agent ran calls on the operator's own subscription (`route: subscription`) -> they spent no money and stay out of every sum; their list-price value shows beside it, "+ ~$140.47 on subscriptions", with a note under the table (FD-88); an agent asks through MCP `spend` -> the same sums, `estimateUsd` apart
- **UI elements:** Spend nav item, totals tiles, agents table with the Limits column and an Open button per agent, limits table, model breakdown, Refresh
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
  1. User opens Spend -> "Could not read" lists the agent with the reason in a sentence ("the agent refused the token (HTTP 401)", "the spend report is malformed: …")
  2. User reads the totals -> when another agent reports, they carry "≥", because one agent's spend is missing; when none reports, only "Could not read" shows
  3. User clicks Open on the agent's line -> its page opens, where the same reason and its fix show (FD-129 UX-22)
- **Expected result:** a failure is named and never silently counted as zero; the other agents still show
- **Alt paths:** the token file is not 0600 -> the reason names it; the agent answers a report for another instance -> refused; an agent that reported earlier and does not answer now -> "it does not answer now, so its spend report could not be read"; another program answers its address -> "another program answers on its address, so its spend report is not read" (its token is never sent there); the reasons follow the window's language
- **UI elements:** "Could not read" notice with Open per agent, "≥" totals
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
  1. User opens Overview -> a strip of five cells, each a label over its number (COPY-04): Ready (agents ready out of all agents), instances not answering or in conflict (two copies, wrong program and invalid included), need attention, spent today, spent in 30 days; the spend is read on arrival and every minute while Overview shows, and labels take two lines before an ellipsis
  2. User clicks a spend cell -> Spend opens (SCN-036); clicks the not-answering or need-attention cell -> Overview moves to Needs attention; a cell that opens something carries an arrow after its label
- **Expected result:** the state of the whole estate and its cost is read before any card
- **Alt paths:** no agent reports or fails to report spend -> the spend cells read "not reported" / «не сообщают» and do nothing; while the first read runs -> a spinner; some calls unpriced -> «≥ $x»; everything unpriced -> "unknown"; under a cent -> "<$0.01"; an agent failed to report -> the cells open Spend, where it is listed
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
- **Entry point:** any service page; View → Show or Hide Agent Details (⌃⌘D)
- **Preconditions:** none
- **Steps:**
  1. User opens a service -> the header is one line: the state mark, the name, the state badge, the tabs (Dashboard, Activity, Connections, Load when the agent declares its load, Health, and Logs for a local agent; src/renderer/components/ServiceView.tsx `tabs`); in a narrow window the tab list fades at the side where more tabs are and the chosen tab scrolls into view (FD-129 VIS-16), the Fabric and Console buttons and a "Show details" control; the dashboard fills the rest; pointing at the name shows the agent's summary
  2. User presses "Show details" -> the full card opens under the bar: summary, version, build, pid, port, uptime, Tools, reasons, the last action and the actions (Restart, Stop, Update, Run self-check, Show data folder, Show file); the control reads "Hide details"
  3. User presses "Hide details" -> back to one line; the choice holds for every service and after a relaunch
- **Expected result:** the embedded dashboard takes the window; everything in the header is one press away
- **Alt paths:** the service is not ready, or its last action failed within half an hour -> the bar shows one chip with the first reason ("Not answering since 10:42", "Restart did not bring it back"); pressing the chip opens the full card for this visit only, never changing the remembered choice (UX-14); the state's own action sits in the bar after the chip, before "Fix": Restart when it does not answer or runs twice, Start when it is off, "Update to <v>" when an update is available, even with nothing wrong (UX-01, UX-03); an action is running -> its spinner and label ("Restarting…") sit in the bar
- **UI elements:** compact bar, state badge, problem chip, tabs, "Show details" / "Hide details", full card (its actions in three groups: Start, Restart and Stop; Update, the self-check and the coding agent, with one primary per state; the files as quiet links, FD-129 VIS-17)
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
  1. User collapses the sidebar -> it becomes a narrow rail: the mark, the mode switch as two icons (SCN-077), icons for Overview, Activity, Agent map, Spend and Settings, and one entry per agent with its state mark and initials; the Overview and Activity badges stay (src/renderer/components/Navigation.tsx `ModeSwitch`, `AgentsNav`; Settings in src/renderer/App.tsx)
  2. User points at an entry -> its name (and state) shows as a tooltip; a screen reader reads the same. The expanded list shows the same tooltip on every agent, since it cuts a long name too (FD-113 VIS-15)
  3. User right-clicks an agent's entry (or presses the context-menu key on it) -> the row menu opens beside the rail: pin, agent or service, hide or show again, turn off; a dashboard on the page steps aside while it is open, and Escape closes it with focus back on the entry. The expanded list opens the same menu on a right-click too (FD-129 UX-23)
  4. User presses "Expand sidebar" -> the full list returns; the choice holds after a relaunch
- **Expected result:** the dashboard gains the sidebar's width, and every page and agent stays one press away
- **Alt paths:** an agent needs attention -> its rail entry carries the same mark as in the full list; the app's own update is ready, held, or cannot install -> the rail shows an entry of its own with an arrow (or "!"), named by its tooltip, that restarts into the update or opens Settings
- **UI elements:** rail, nav icons, agent entries with state marks and initials, the row menu on a right-click, tooltips, "Collapse sidebar" / "Expand sidebar", View menu item
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
- **Alt paths:** the window is hidden while a console runs -> it keeps running and nothing is sent to the window; showing it replays what was printed; the agent is removed -> its page closes and its console ends with it; one of the app's own dialogs opens -> the console steps out of the way until it closes; the Setup console (SCN-058) drops down the same way over its page; a Switchboard hand-over or a continued session no longer does: from 0.8.0 its console fills its own session page (SCN-080), and neither ever runs in this agent's console (decision 8, extended 2026-10-24: SCN-069 step 2, SCN-075 step 3)
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
- **Preconditions:** at least one coding agent (Claude Code, Codex or another known one) is installed
- **Steps:**
  1. User opens the console -> it shows the coding agent (the last one used for this agent, else Claude Code, else the first one found), the folder found for this agent (its repository's local checkout) with "Other…", and one compact row: "New session" and "Continue last session" on the left, the Open in Terminal icon on the right (FD-74)
  2. User presses "New session" -> the coding agent's own interface starts in that folder, in the console; the user types to it as in any terminal, and its permission questions appear there
  3. User presses "Continue last session" -> the coding agent resumes its last conversation in that folder (`claude --continue`, `codex resume --last`)
  4. The coding agent exits -> the console says "The session exited with code 0." with "New session" and "Continue last session" again
- **Expected result:** the coding agent the user chose runs in the agent's repository, with their settings and skills, one press from the dashboard
- **Alt paths:** "Other…" -> a folder dialog; the choice is remembered for this agent; the user picks another coding agent -> remembered for this agent; the red cross -> the coding agent ends after a confirmation and the console folds (SCN-048) if it is still running; "Open in Terminal" -> the same coding agent continues in that folder in Terminal
- **UI elements:** coding agent picker, folder line with "Other…", "New session", "Continue last session", the red cross (SCN-048), "Open in Terminal", terminal, exit line
- **States covered:** empty, loading, success, error
- **Errors & recovery:** no coding agent installed -> "No supported coding agent is installed" with the list it looks for; no repository found -> "Choose the folder this agent's code lives in" with "Choose folder…"; the folder no longer exists -> the same; the coding agent cannot start -> its own error in the console, and "New session" again; a coding agent with no resume flag -> "Continue last session" is not offered
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
  3. User starts a session, and the installed Switchboard cannot launch in place yet -> the console says "This folder runs on Switchboard project <name>. This Switchboard opens its sessions in Terminal." with "Open in Terminal via Switchboard"; pressing it starts the session there on the project's account
- **Expected result:** a project folder never runs on the ordinary sign-in
- **Alt paths:** the folder is in no project but Switchboard holds an account for the runtime's provider -> the session still runs through Switchboard, managed, on the account it selects for the folder (SCN-065); Switchboard is not installed, or holds no account for the provider -> the runtime runs on its ordinary sign-in, and the folder line says nothing about Switchboard
- **UI elements:** folder line with the project name, "Open in Terminal via Switchboard"
- **States covered:** success, error
- **Errors & recovery:** Switchboard needs its app or `switchboard serve` running -> its own message, shown as it says it; a managed session for the same project already runs -> Switchboard's refusal is shown as it says it; Switchboard's answer cannot be read -> "Switchboard did not start the session: <detail>"; never a silent fallback to the ordinary sign-in
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
  1. User presses "New session" or "Continue last session" -> the app checks the disk the folder is on (at least 5 GB free), the swap, and how many console sessions run (at most six at once)
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
- **Status:** validated
- **Coverage:** src/core/switchboard.ts, src/electron/console.ts, src/renderer/components/ConsolePanel.tsx, test/switchboard-sessions.test.ts, test/e2e/switchboard-strip.test.ts (validated 2026-10-27: only the session running in this folder, its account, mode and start; read again 15 s later while the console is on screen, not while it is folded)
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
- **Status:** validated
- **Coverage:** src/core/consoles.ts, src/core/switchboard.ts, src/electron/console.ts, test/switchboard-sessions.test.ts, test/e2e/switchboard-strip.test.ts (validated 2026-10-27: step 2, the move to the pool's next account after a limit); step 1, a managed launch in place, seen in `main.log` since 2026-10-14
- **Product:** unobserved

### SCN-066: An idle session closes and comes back
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019, ST-023; lifecycle LC-18; FD-50; operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-04
- **Entry point:** a console session running with no input or output
- **Preconditions:** none
- **Steps:**
  1. Thirty minutes pass with nothing typed and nothing printed -> the app saves when it closed, the Switchboard account it ran on and its conversation, and closes the session, which frees its memory and its MCP servers
  2. The session was an agent's own console -> opening that agent's console again continues it ("Continue last session") with "This session was closed after 30 idle minutes to free memory and is continued now. Account: <account>"
  3. Any closed session, a hand-over's or a continued one's included -> the Sessions mode lists it under "Ended in the last 24 hours" as "Closed at {time} after 30 idle minutes", with Continue and Remove (SCN-084); Continue resumes the same conversation in the same folder on the saved account
- **Expected result:** a session nobody uses holds nothing, and coming back costs one press, wherever it came from
- **Alt paths:** the runtime cannot continue a conversation -> in an agent's console "This session was closed after 30 idle minutes to free memory. New session starts a fresh one.", and in Sessions the button reads "New session here" (SCN-084); the person starts a session themselves first -> the saved mark is cleared; one idle-closed agent console has two ways back, step 2 and SCN-084's Continue: Continue in Sessions starts that console's continue (`continueSession` calls `start(key, 'continue')`, which clears the saved mark, src/electron/console.ts) and takes the ended row off the list, and continuing from the agent's console clears the saved mark and takes that console's last ended row off the list too (R1-C)
- **UI elements:** the console's notice line, a calm notice a screen reader reads as a status, never a red error alert (FD-113 VIS-14); the Sessions mode's ended row with Continue and Remove
- **States covered:** success
- **Errors & recovery:** the continue cannot start (no room, SCN-063) -> that notice instead, and the row keeps both actions
- **Supersedes:** for a hand-over or a continued session, the dead end of SES-04 (its console was reopened only from the sidebar's Hand-overs section, whose text named a "New session" button that was never drawn there): from 0.8.0 SCN-084 owns its Continue
- **Status:** validated
- **Coverage:** the Sessions mode: src/renderer/components/Sessions.tsx (Continue, New session here), test/sessions-ui.test.ts; the agent console's idle close and continue (validated 2026-10-14): src/core/consoles.ts, src/electron/console.ts, src/core/settings.ts, src/renderer/components/ConsolePanel.tsx, test/switchboard-sessions.test.ts; the Sessions mode's "Closed at <time> after 30 idle minutes" with Continue and Remove (validated 2026-10-27): test/e2e/sessions.test.ts *SCN-077 to SCN-086*, test/sessions-ui.test.ts *SES-04*
- **Product:** observed 2026-10-14 on this Mac (installed copy, `main.log`): an agent's console closed after 30 idle minutes at 16:29:29 UTC and, opened again at 16:39:33, continued (`started claude-code (continue) … through Switchboard`); two hand-over consoles closed the same way at 19:59 and 21:00

### SCN-067: Dashboards take my scheme and theme
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-019; contract DEC-0036 ED-8/ED-10, DEC-0059; FD-42, FD-56, FD-214, FD-221
- **Entry point:** Settings → the app group
- **Preconditions:** none
- **Steps:**
  1. User picks the colour scheme: Same as the system, Dark or Light -> the app follows it at once. FD-214: a new install opens in Light (the operator, 2026-11-12, relayed by Project Observatory on board thread `8207a3b6`: light by default in all our software); a saved choice is kept
  2. User picks the dashboard theme: Graphite, Fabric, Paper, Forest, Ocean, Ember or High contrast -> every open dashboard that follows the app takes the scheme and the theme without a reload; the others keep their own
  3. User opens a dashboard later -> it opens in that scheme and theme, and the empty view behind it is already the right colour
- **Expected result:** one choice in one place sets the look of every dashboard that follows the app
- **Alt paths:** a dashboard declares the themes it ships and the chosen one is not among them -> it gets the scheme only and keeps its own default theme; a dashboard declares nothing, or an invalid profile -> it follows macOS's light or dark only, and an invalid profile is written to the log once per load; a page that does not declare a dark colour scheme is shown on white once it has loaded, as a browser shows it, so its default black text reads in the dark scheme (FD-221); Same as the system -> the system switching light/dark is followed live
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
  1. User opens Health -> "How it runs": what it runs on (kind, profile, subscription or API key), the model profile and its models, who set it (this agent, the project, the default), what it spent per model over 30 days, and the budget left
  2. User presses "Change in Fabric" -> Fabric opens a conversation about this agent, where the profile is changed
- **Expected result:** the person sees what the agent runs on and what it costs, one press from changing it
- **Alt paths:** the agent declares no configuration -> no section; it reports no usage -> "No spend reported"; limit left -> "Shown here once Project Observatory publishes its spending limits" until it does (FD-40); Fabric is not installed -> Fabric's button offers its download (ADR-0021)
- **UI elements:** Health → How it runs, Change in Fabric
- **States covered:** empty, loading, success
- **Errors & recovery:** the spend report cannot be read -> no spend line beyond "No spend reported"; Spend says why
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
  2. The hand-over's folder is a registered agent's console folder -> the agent's console is left to the person (decision 8 of 2026-10-24, FD-103: one session lives in one place)
  3. The session runs in a console of its own, listed only in the Sessions mode, under "Running", its row reading "<project>" over "<coding agent> · <account> · handed over · <time>"; its page (SCN-080) carries "Handed over by Switchboard after a limit on <account>, <time>" and its console full height
  4. The app has taken it -> one notification (SCN-085); the mode the window shows does not change
  5. The session ends -> it moves to "Ended in the last 24 hours" as "Ended at <time>", or "Closed at <time> after 30 idle minutes", with Continue and Remove (SCN-084), and stays listed across a restart for 24 hours
- **Expected result:** Switchboard's continuing sessions run inside the app, not in a new Terminal window each, and are listed with the other sessions, never among the agents
- **Alt paths:** less than 5 GB free or six sessions already run, the folder is not on this Mac, the offer expired before it could be taken, or the running Switchboard is older than its CLI -> the app leaves the hand-over and lists it under "Needs you" with that reason in one sentence, followed by "Switchboard opened it in Terminal." once Switchboard does after two minutes (SCN-082); another console or Terminal took it first -> the console shows Switchboard's own message; Switchboard is not installed -> nothing is read
- **UI elements:** the Sessions mode's rows and cards, the session page, the notification
- **States covered:** empty, success, error
- **Errors & recovery:** a hand-over that cannot be read or taken goes to Terminal on Switchboard's side after two minutes; nothing is lost, and the Needs you row says where it went
- **Supersedes:** step 3's sidebar section "Hand-overs" above the agents and its hand-over page (by SCN-077, SCN-078, SCN-080); step 4's "Ended" glyph and Close in the page body under the drawer (by SCN-084); the console dropping down over the hand-over page (by SCN-080's full-height console); the alt path's silent "nothing is taken" and "logged once" (by SCN-082)
- **Status:** validated
- **Coverage:** the Sessions mode: src/renderer/components/Navigation.tsx, src/renderer/components/Sessions.tsx, test/sessions-ui.test.ts, test/handovers.test.ts; the taking of a hand-over (validated 2026-10-14): src/core/switchboard.ts, src/electron/console.ts, src/electron/main.ts, test/handovers.test.ts; live on the installed 0.7.9 (2026-10-14, main.log): `ho-fcdfdee61542` taken in `handover.ho-fcdfdee61542` at 19:28:32Z and `ho-3bec5ef68052` at 20:29:35Z, each once and within the 15 s poll, under Switchboard's 120 s Terminal fallback (workflow `wf_5e78a8c1a8ee6c19`, run by Switchboard's session); the Sessions mode on the running app (validated 2026-10-27): test/e2e/sessions.test.ts *a hand-over taken once* (one `switchboard handovers run <id>`, one notification, a console of its own, End then Continue and Remove)
- **Product:** unobserved

### SCN-071: See agents on this Mac, online and services apart
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-021 (JTBD-01); FD-78 (operator 2026-10-20)
- **Entry point:** the sidebar and Overview
- **Preconditions:** at least one agent
- **Steps:**
  1. User opens the app -> the sidebar lists Pinned, then "On this Mac" ("On this computer" on Windows and Linux, COPY-23), "Online" and "Services", each sorted by the chosen sort; Overview shows the same three groups of cards
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
- **Traces:** ST-021 (JTBD-01); FD-78 (operator 2026-10-20); FD-123 (board `8a8647e3`, the operator 2026-10-26: «спрячем, пусть не будем совсем стирать, но пока он будет скрыт, неактивен, задизейблен»)
- **Entry point:** the agent's row menu → Hide, or → Turn off
- **Preconditions:** at least one agent
- **Steps:**
  1. User chooses Hide -> the agent leaves its section (and Pinned) and a folded "Hidden: 1" appears at the bottom of the sidebar and of Overview; in the narrow rail the fold is an entry of its own
  2. User opens the fold -> the hidden agents are listed; clicking one opens it as usual
  3. User chooses "Show again" in the row menu, or presses the eye beside a hidden agent in the open fold (FD-121) -> it returns to its section, pinned again if it was pinned
  4. User chooses Turn off in the row menu (FD-123) -> the agent is hidden too and the app stops watching it: no checks, no events read, no notifications, no outage alerts, and it counts in no badge, tray entry or Needs attention; the open fold lists it last, greyed, with "Off" in words and a Turn on button ("Turn {name} on"); "Hidden: N" counts it; Overview's open fold names the agents turned off in one line
  5. User presses Turn on -> it is checked at once, starting afresh (an outage it had before it was turned off is not carried over and its old events are not replayed as news), and it stays hidden until shown again; the eye or Show again on an agent that is off shows it and turns it on
- **Expected result:** service agents the person does not look at take no room, and nothing about them stops
- **Alt paths:** a hidden agent fails -> Needs attention lists it as before, its outage still reaches the operator channel, and the folded header carries a "!" ("A hidden agent needs attention"); the fold's open or closed state is remembered; a hidden agent that is removed leaves the list; an agent turned off opens no page (nothing about it is read) and keeps its descriptor on disk; an agent turns one off or on with MCP `arrange` `turn-off`/`turn-on` (SCN-028)
- **UI elements:** Hide, Show again and Turn off in the row menu, a greyed row with "Off" and a Turn on button for an agent turned off (the rail shows its name only), the "Hidden: N" fold with its mark, an eye button on each hidden row named "Show {name} again" (FD-121; not in the narrow rail, where the row menu is gone too: the person widens the sidebar)
- **States covered:** success, empty, error
- **Errors & recovery:** n/a
- **Status:** validated (test/e2e/focus-console.test.ts (ADR-0017 test, FD-78 steps) passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** src/core/products.ts (toggleHidden, arrangeProducts, setOff, showAgain), src/core/monitor.ts (offServices, listChanged), src/renderer/App.tsx, src/renderer/components/Navigation.tsx (OffItem), src/renderer/components/Overview.tsx, test/listorder.test.ts *FD-78*, test/agent-off.test.ts *FD-123*, test/e2e/focus-console.test.ts *FD-78*
- **Product:** unobserved

### SCN-073: See what an agent is connected to
- **Persona:** P-01
- **Feature:** service
- **Traces:** ST-019 (JTBD-01); FD-78 (operator 2026-10-20); contract DEC-0096 `extensions/connections/0.1` (board thread with fabric-agent-contract)
- **Entry point:** an agent's page → Connections tab (every agent, services included)
- **Preconditions:** the agent answered at least once
- **Steps:**
  1. User opens Connections -> one line: the worst state of the agent and anywhere in its connections in a word and a shape ("Ready", "Partly working", "Not answering", "Not known"), how many connections, how many with problems and how many nobody checks; a connection nobody checks is counted there and never pulls a working agent below "Ready" (FD-152); a part the agent reports as waiting for setup gives its declared connection the reason and never makes it worse (FD-155)
  2. User reads three columns -> "Used by": the agents here whose declarations name it; in the middle the agent itself, what it offers (dashboard, MCP and its capabilities, events, spend report); "Uses": agents, models, runner, connectors, data stores, channels and the parts it reports, each with its state, its target and why
  3. User reads a connection to another agent -> it carries that agent's own state too (the worse of the two) and, below it, that agent's connections, up to three levels; an agent already shown in the chain is not repeated
  4. User clicks a connected agent -> its page opens on its Connections tab
- **Expected result:** the person sees what an agent depends on and what depends on it, and where in the chain something does not work
- **Alt paths:** another agent names it twice (two capabilities) -> one row in "Used by" with both; an agent asks through MCP -> `connections` answers the same graph and `list_services` carries `category` and `hidden`; the agent declares no connections -> a line says so, and the tab shows what the app sees: the models of its spend report (with their calls over 30 days), its runner, the parts it reports failing, the agents that name it; the declaration is invalid -> "the declaration is invalid, so none of it is shown" with the reasons, and the rest as for no declaration; a declared agent that is not installed here reads "Not known"; a part the agent reports failing that a declaration names marks that connection; nothing known -> "Nothing known yet."
- **UI elements:** Connections tab, summary line, Used by list, the agent card with its offers, the Uses groups with the chain drawn as a tree
- **States covered:** loading (models being read), empty, success, error
- **Errors & recovery:** an unreadable spend report leaves models out, never blocks the tab
- **Status:** validated (test/e2e/focus-console.test.ts and test/e2e/connections.test.ts *FD-78* passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** packages/service-host/src/connections.ts, src/core/connections.ts (FD-152: `headState`, `uncheckedCount`, test/connections.test.ts *FD-152*), src/renderer/components/Connections.tsx, src/mcp/tools.ts (connections, listing), packages/service-host/test/connections.test.ts, test/connections.test.ts, test/mcp.test.ts *FD-78*, test/e2e/connections.test.ts, test/e2e/focus-console.test.ts *SCN-073*
- **Product:** unobserved

### SCN-074: See how agents are wired and what problems were found
- **Persona:** P-01
- **Feature:** connections
- **Traces:** ST-019 (JTBD-01); FD-81 (operator 2026-10-21); FD-226; ADR-0023; FD-110 (contract DEC-0121, CT-126: `extensions/actions/0.1`, FAC-SEM-142)
- **Entry point:** sidebar → Agent map (its count is what does not work; named apart from each agent's own Connections tab, FD-129 UX-21)
- **Preconditions:** at least one agent
- **Steps:**
  1. User opens Agent map -> one line: "Does not work: N · Partly working: N · Waits for you: N · Worth knowing: N" (only the ones above zero), or "Nothing to fix: every agent and connection works." (FD-129 COPY-32); below it "Agents that declare their connections: X of Y."
  2. User reads the Map -> each agent a box with its state as a shape and a colour, calls drawn left to right, the worse state of the call and the agent reached on each line; an agent named but not installed is a dashed box "not installed here"; agents with no line are under "Not connected"
  3. User reads Problems -> one row per agent to fix, worst first: its name, its key and each finding in a sentence ("google-ads fails: quota exhausted", "It relies on Relay, which does not answer.", "Version 2.0.0 is available.", and for the buttons its pages declare (DEC-0121, FD-110): "The button "Send" has no agent twin: its MCP surface does not serve replies.send.", or, worth knowing, "It has a dashboard but declares no actions, so an agent cannot tell which buttons it may press for you.")
  4. User picks the coding agent in "Coding agent" (the one chosen for that agent, Claude Code by default) and presses "Fix with coding agent" -> the agent's page opens with its console, the chosen coding agent starts in the agent's folder with the findings as its task
  5. User clicks an agent's name or box -> its page opens on its Connections tab
- **Expected result:** every problem in the estate in one place, where each comes from, and one click to hand it to a coding agent
- **Alt paths:** no agent declares a connection to another -> "No agent declares a connection to another agent yet, so there is no line to draw." with how to declare one; a failing part whose source is the id of a connection the agent declares down or degraded (FD-155) -> one finding on the connection, with the part's words, not a second one for the part; an agent declares an extension under the short form of its key (FD-151) -> "It declares an extension under the short key \"{key}\", so nothing reads it. The key is the full URI: {full}."; a connection names a service id installed here more than once with no `default` instance (FD-149) -> "It names {name}, which is installed here more than once ({instances}) with none called default, so Fabric Dashboards follows {chosen}. If it uses another one, its declaration needs the full id with the instance."; a connection names the repository of agents installed here instead of a service (FD-147) -> "It names {name} as an agent it uses, but {name} is the repository of {services}. A connection names a service, so its declaration needs the service id." / «Он называет {name} агентом, которым пользуется, но {name} здесь имя репозитория, где живут {services}. Связь называет сервис, поэтому в объявлении нужен идентификатор сервиса.» (copy check `98bee258` en, `958542b0` ru, no findings; nothing is resolved from it); a row whose only findings are about an agent it relies on, or an update -> no Fix button (the fix goes where the cause is); no coding agent installed -> "No coding agent is installed, so a session cannot start here."; a connection reaches an agent of another organization (FD-163, operator 2026-11-06: an organization's agents work only with agents of the same organization) -> "It uses {name}, which belongs to {theirs} while it belongs to {ours}. Agents of an organization work only with agents of the same organization: move {name} into {ours}, or give {ours} an agent of its own that calls it.", a problem (error) on the calling agent; an agent asks through MCP -> `audit` answers the same findings, counts, coverage and edges; a failing part or connection reads as one sentence, its name and then the agent's own words after a colon ("demo works only in part: the mail provider answers slowly"), or a full stop when it gave none (FD-226)
- **UI elements:** Agent map nav item with its count, the summary line, the coverage line, the Map, Not connected chips, the Problems rows with the Coding agent picker and Fix with coding agent
- **States covered:** empty, success, error
- **Errors & recovery:** an agent's spend report that cannot be read leaves its limits out, never the rest
- **Status:** validated (test/e2e/connections.test.ts *FD-78* (the map and the auditor, FD-81 steps) passed on the running app, 2026-10-23 00:00 UTC)
- **Coverage:** src/core/audit.ts (FD-147: `audit.connection.repository`; FD-149: `audit.connection.ambiguous`, test/audit.test.ts *FD-149*; FD-151: `audit.declaration.shortKey`, test/audit.test.ts *FD-151*; FD-155: test/audit.test.ts *FD-155*), packages/service-host/src/actions.ts, packages/service-host/test/actions.test.ts, test/audit.test.ts *FD-110*, src/core/estate-map.ts, src/renderer/components/ConnectionsMap.tsx, src/core/handoff.ts (auditTask), src/mcp/tools.ts (auditAll, setupCheck), test/audit.test.ts, test/mcp.test.ts *FD-81*, test/e2e/connections.test.ts, test/e2e/focus-console.test.ts *FD-81*
- **Product:** unobserved

### SCN-094: Show only one organization's agents
- **Persona:** P-01
- **Feature:** organizations
- **Traces:** FD-162 (operator 2026-11-06: "filters ... all agents or one organization, or several"); FD-163 (operator 2026-11-06: agents of an organization work only with agents of the same organization); board thread `22876238`; FD-195 (operator 2026-11-09, this repository's session `0edbdfdf`: my agents apart from other organizations' agents, filters, all or chosen, the shared agents and the crossings, in step with the Studio's spaces: `personal` and `org:<name>`)
- **Entry point:** the sidebar's Organizations menu, beside the sort, above the agent sections; an agent's Health tab
- **Preconditions:** Project Observatory is installed here (its registry file is read on this Mac), so each agent's organization is known from its repository
- **Steps:**
  1. User opens the Organizations menu -> "All organizations" and one line per organization the agents here belong to, each with its count ("Acme 13", "Personal 26"), and "Not attributed" for an agent whose organization is not known
  2. User ticks one organization -> the sidebar, Overview, Agent map and Spend show only its agents; the menu's button reads its name (it reads "All organizations" when nothing is chosen); the choice is kept across restarts
  3. User ticks a second one -> both are shown; the button reads "2 organizations"
  4. User chooses "All organizations" -> every agent is shown again
  5. User opens an agent -> its Health tab names its organization ("organization: Acme")
  6. User ticks "Group by organization" at the bottom of the menu -> each section of the list (on this Mac, online, services) shows a small heading per organization, the chosen sort inside each, "Not attributed" last; a section of one organization has no heading; rows are not dragged while grouped (FD-161)
  7. User ticks "Mine" at the top of the menu -> only the agents of the operator's own organization (the one Project Observatory's config marks `default`, the context Switchboard and the Studio call `personal`) are shown; that organization's own line below reads "{label} (mine)" (FD-195)
  8. User ticks "Other organizations" -> every agent of an organization that is not theirs is shown (an agent not attributed is not one of them); with Mine as well, both
  9. User ticks "Shared between organizations" -> the agents whose product runs here in two organizations or more (one copy each, as one product's instances for two organizations) are shown; the line is there only when such an agent exists; any kinds and organizations ticked together show every agent any of them keeps, and the button reads "Filters: {count}"
  10. An agent runs in another organization's context than its repository's owner -> it is shown under the organization of the context it runs in (FD-197, studio-agent's DEC-0052): an instance named after an organization (`observatory.acme`) is that organization's; an online instance served as a Worker of a Cloudflare account Project Observatory attributes (its config's `match.cloudflare_accounts`) is that account's organization's (a custom domain's zone is not a deployment: where its DNS is hosted does not move the instance); an instance of a platform product (one published by the organization Observatory's config marks `platform: true`, else by the publisher of this app's own repository) on this Mac is this space's own organization's; anything else keeps its repository's organization. The auditor's cross-organization finding (FD-163) reads the same organizations, so a personal agent calling the personal copy of a platform service is not a finding
- **Expected result:** the operator sees one organization's agents at a time, or several, or all, and every agent says which organization it belongs to
- **Alt paths:** Observatory's config marks no organization `default` -> no "Mine" line; Other organizations then keeps every attributed agent; an agent asks through MCP -> `list_services` marks the personal organization `personal: true` and takes `@mine`, `@others`, `@shared` among `organizations`, and Settings (MCP `settings`) keeps them in `layout.list.orgs`; Project Observatory is not installed and its registry was never read -> no Organizations menu, and the Health tab names no organization; its registry cannot be read later -> the last organizations it gave are kept (`organizations.json` beside the settings) and the menu still works; an organization chosen earlier has no agent here now -> it stays chosen and reads "0" until unticked; an agent asks through MCP -> `list_services` carries `organization` on every row and takes `organizations` to list only theirs
- **UI elements:** Organizations menu button, its checkbox list with counts, "All organizations", "Mine", "Other organizations", "Shared between organizations" above a rule, each organization below it, "Group by organization" and its headings in the list, the Health tab's organization row
- **Copy:**
  - "Mine" / «Мои»; "Other organizations" / «Другие организации»; "Shared between organizations" / «Общие для организаций»; "{label} (mine)" / «{label} (мои)»; "Filters: {count}" / «Фильтров: {count}» (copy checks `aee4cea1`, `b98403e9`, `0f3e202e`, `30e985f4`, `3e3bab49` en and `1e2ccd03`, `be898b6b`, `34aeb850`, `6e94c092`, `f3890070` ru, no findings)
- **States covered:** empty, success, error
- **Errors & recovery:** a page of the registry that cannot be read keeps the last full map and is read again in 30 minutes; a repository Project Observatory does not know reads "Not attributed", never a guessed organization; a Worker name listed in two Cloudflare accounts, or an account Observatory does not attribute, gives no context and the repository decides (FD-197)
- **Status:** implemented
- **Coverage:** src/core/organizations.ts (`groupByOrganization`, FD-161; copy checks `9c0f84f2` en and `0a3a4fd8` ru, no findings; `keepsOrganization` with `@mine`, `@others`, `@shared`, `sharedProducts`, `kindCounts`, FD-195), src/renderer/components/Navigation.tsx, src/renderer/App.tsx, src/mcp/tools.ts, src/electron/main.ts (`organization_personal`; `organization_platform` and `cloudflare_accounts`, FD-197), test/organizations.test.ts, test/org-kinds.test.ts, test/instance-org.test.ts (`organizationOfInstance`, FD-197)
- **Product:** unobserved

### SCN-100: See the setup as steps the agent works through
- **Persona:** P-01
- **Feature:** setup
- **Traces:** ST-022, ST-017; FD-184, FD-185 (wave 2 of `docs/reports/2026-11-08-agent-led-setup/README.md`); the operator, 2026-11-08, this repository's session `0edbdfdf`: the setup agent-led, the interface clear steps one by one; SCN-058 and SCN-070, which it folds together
- **Entry point:** Overview's setup card, and Settings → Setup
- **Preconditions:** the setup is not hidden (`setupDone` false)
- **Steps:**
  1. The person opens the app for the first time -> Check setup runs once by itself (once per install, kept in `setupChecked`; a build from source runs it only with the test fixture); the card shows the steps in the doctor's order (Prerequisites, Skills, Apps, MCP servers, Services), numbered, each one line: done, the agent works on it, or needs you, with the first step not done marked
  2. The person presses "Set up with my coding agent", or asks an agent to (MCP `console_new` with the Setup service, SCN-098 step 7) -> the Setup console starts; its first message names everything it installs and every step that needs the person (FD-185)
  3. The agent works -> the step it is on reads "Your coding agent is on it"; a step finished turns done without a refresh
  4. A step needs the person (a sign-in, a code, a secret, a payment) -> it reads "Needs you" with what and where in one line; the console beside it has the prompt
  5. The Setup console ends -> Check setup runs once more and the card shows what is left, with Continue setup when something is
- **Expected result:** the person sees at any moment where the setup is and what, if anything, is theirs to do, and never has to decide what to do next
- **Alt paths:** every step done -> one quiet line "Everything is set up." with Check setup and Hide (as SCN-070); no coding agent installed -> the first step is "Install a coding agent" with each vendor's command (SCN-058 alt path); Node.js missing -> the check cannot run and the first step says so (SCN-070); an agent reads the same steps (MCP `setup_check`), also as fabric-agent-contract's draft `setup-layer/1` records layer by layer, with the person's steps not done as one list (`setup`, FD-208, FD-209, 2026-11-12: `test/setup-layer.test.ts`; the card shows them once the contract decides)
- **UI elements:** the numbered step list on the setup card and in Settings → Setup, Set up with my coding agent, Continue setup, Check setup, Hide
- **States covered:** loading, success, empty, error
- **Errors & recovery:** the check fails to run -> the steps from the last check stay, with the reason; pressing Check setup again is always safe
- **Copy:**
  - "Setup steps" / «Шаги настройки»; "Your coding agent is on it" / «Этим занят ваш агент для кода»; "Needs you: {what}" / «Нужны вы: {what}», with "sign in" / «войти в аккаунт», "a one-time code" / «одноразовый код», "your consent" / «ваше согласие», "a payment" / «оплата», "a key or secret" / «ключ или секрет»; "Done" / «Готово»; "Worth a look" / «Стоит проверить»; "To do" / «Сделать»; "Next" / «Следующий»; "Everything the check found ({n})" / «Всё, что нашла проверка ({n})»
- **Status:** draft (2026-11-08, FD-184 in part: steps 1, 2, 3 and 5 built (3: while the Setup console prints, the Next mark reads "Your coding agent is on it", from the console's own events; 5: when it exits, one check by itself; copy check reports `08beee97` (en), `7b56fe14` (ru), no findings), the numbered steps with Next and the folded findings, the one check by itself per install; copy check reports `240f0d85`, `0f4fd628`, `f97934cb`, `5c9faf2c`, `487510d0`, `61679b61` (en), `0fbc03d6`, `e10000f4`, `333ed424`, `bf143fe1`, `cbc7e41d`, `fefa1079` (ru), no findings; `test/e2e/overview-settings.test.ts` *SCN-070* asserts the steps: passed 2026-11-09 01:01 UTC on the built app (3 of 3 in the file, load average 38). Step 4 built 2026-11-08 later: the launcher names each fix's human gate (`gate`, its PC-171, from 0.2.76); a step whose failing or warning check names one reads "Needs you: …" and the agent's brief says to ask for it once; until 0.2.76 is the pin no check names one; copy check reports `e753b8cd`, `39e8874e`, `1578b41f`, `81291c54`, `2e575821` (en), `454ae27e`, `8db59e68`, `31779444`, `8ea0ebf5`, `34618554` (ru), no findings)
- **Coverage:** src/core/doctor.ts (setupSteps), src/core/setup-layer.ts (FD-208, FD-209), src/renderer/components/Overview.tsx (SetupCheck), src/electron/main.ts (setup check by itself), test/doctor.test.ts, test/e2e/overview-settings.test.ts
- **Product:** unobserved

### SCN-099: See the agents a space runs as system services
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004; FD-167; Observatory's OBS-361 (a space nobody logs into has no `gui/<uid>` domain, so its agents' jobs are system daemons with `UserName`); the host agent's measurement of 2026-11-07 on the second machine: 17 such agents read "Stopped"
- **Entry point:** the agent list and an agent's page, in Fabric Dashboards running in such a space (or its MCP server)
- **Preconditions:** Observatory installed the agent as a system daemon of this space and recorded it in `/Library/Application Support/ProjectObservatory/space-daemons.json` (owned by root) for this user's uid, or the agent's descriptor names its plist in `/Library/LaunchDaemons/` (FD-180: the adapter's kit 0.78.0 installs a service there to run at boot)
- **Steps:**
  1. The person opens the app in the space -> the agent reads its real state ("Ready" when it runs), read with `launchctl print system/<label>`, never "Stopped" for want of a `gui` domain
  2. The person opens its page -> it offers no Start, Stop or Restart and says "Runs as a system service of this space: only the administrator starts or stops it."
  3. An agent calls MCP `control` on it -> refused before launchctl changes anything: "{name} runs as a system service of this space, which only the administrator can start or stop; ask the host agent (studio.service.control)"
- **Expected result:** the space's agents read as they are, and nothing in the app tries an action only root can do
- **Alt paths:** no record, or a record not owned by root or writable by others -> every job is read in `gui/<uid>` as before (a record others could write could hide Start); a label the record lists for another uid -> read in `gui`, as it is not this user's
- **UI elements:** the state on the agent's row and page; the note in place of the run group
- **States covered:** success, error
- **Errors & recovery:** the record unreadable -> as no record
- **Copy:**
  - "Runs as a system service of this space: only the administrator starts or stops it." / «Работает как системная служба этого пространства: запускает и останавливает её только администратор.»
  - "{name} runs as a system service of this space: only the administrator starts or stops it." / «{name} работает как системная служба этого пространства: запускает и останавливает её только администратор.»
- **Status:** implemented (2026-11-08: `packages/service-host/test/space-daemons.test.ts`, `test/elsewhere.test.ts` *FD-167*, `test/mcp.test.ts` *FD-167*; copy check reports `903f23c3` (en) and `6622e99f` (ru), no findings). Start and stop through the host agent's `studio.service.control` and the descriptor's own field (CT-234) come later
- **Coverage:** packages/service-host/src/space-daemons.ts, packages/service-host/src/launchd.ts, packages/service-host/src/look.ts, src/core/monitor.ts, src/core/control.ts, src/core/focus.ts, src/mcp/tools.ts, src/renderer/components/ServiceView.tsx
- **Product:** unobserved

### SCN-098: An agent changes what a person changes in Settings and on the Sessions page
- **Persona:** P-01
- **Feature:** mcp
- **Traces:** ST-010; FD-175; the operator, 2026-11-07 (said in fabric-agents-database's session 12c8d3fa, relayed on board thread `a5885efd`, message `ea54cd39`): «я не хочу пользоваться интерфейсом любое действие в интерфейсе должно уметь делаться клауд кодом по моему запросу»
- **Entry point:** the person asks a coding agent; the agent calls MCP `settings`, `session_action`, `app_update`, `console_choose` or `app_install`
- **Preconditions:** the app runs (a change or an act); reading the settings needs nothing running
- **Steps:**
  1. The person asks: "switch Dashboards to the light theme and group the list by organization" -> the agent calls `settings` with `{theme: "light", layout: {list: {groupByOrg: true}}}` -> the window changes at once, as if the person had clicked
  2. The person asks to end a session -> the agent reads the row from `consoles` and calls `session_action` `end` with the operator's words in `_meta.decision` -> the session ends as with End
  3. The person asks to update -> the agent calls `app_update` `check`, then `restart` -> the update installs; when consoles run, the window asks the person first, as the button does
  4. The person asks: "run Codex in the growth agent's console, in its worktree" -> the agent calls `console_choose` with `runtime: "codex"` and the folder -> the console's pickers show them, and the next New session takes them
  5. The person asks to send the auditor's findings to an agent whose session already runs -> the agent calls `console_fix` -> the task is typed into that session without Enter (`typed: true`), as Send to the running session does
  6. The person asks to move the app to Applications, or to uninstall it -> the agent calls `app_install` with the action repeated in `confirm` and the operator's words in `_meta.decision` -> the app answers, then moves itself and opens from Applications, or uninstalls as Settings → Uninstall does (`uninstall` keeps settings and history; `uninstall-all` deletes them, as the confirmation's box ticked)
  7. The person asks the agent to set the system up, or to repair what Check setup found -> the agent calls `console_new` with `service: "fabric-dashboards.setup"` -> the Setup console starts as Start setup starts it, its brief opening with the last Check setup's findings, failures first (Fix with my coding agent); `consoles` lists it with its `open_link` (FD-182); `console_fix` with the same service and the agent's request as `findings` -> a new Setup console opens its brief with that request, fenced, before the steps; a Setup console that runs gets it in `request.md` beside `setup.md`, with one line typed in and no Enter (FD-187)
- **Expected result:** nothing the window offers needs the person's hands, except their own gates (sign-in, a code, a typed secret, payment)
- **Alt paths:** a field Settings does not offer (a console's folder, which `console_choose` sets, or the Sessions records) -> named in `refused`, nothing written; a runtime not installed here or a folder that does not exist -> `unknown-runtime` (with the ids installed) or `no-folder`, nothing saved; `confirm` that does not repeat the action -> refused before the app is asked; Move to Applications where it is not needed -> `moved: false` with why; the app closed -> `app-not-running` for a change, a read still answers; a row that is gone -> the refusal in the app's words
- **UI elements:** none new
- **States covered:** success, error
- **Errors & recovery:** a decision for another action or another row is refused `decision-invalid` (DEC-0121); every act is recorded as the caller's or the operator's
- **Status:** implemented (2026-11-07: `test/agent-doors.test.ts`)
- **Coverage:** src/core/settings.ts, src/core/console-channel.ts, src/electron/main.ts, src/electron/console.ts (`chooseFor`), src/mcp/tools.ts, src/mcp/server.ts, src/mcp/actions.ts, test/agent-doors.test.ts
- **Product:** unobserved

### SCN-097: A console session runs without permission prompts
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-010; FD-174; the operator's rule for every PassionCode project (2026-11-07, said in fabric-switchboard's session 38adf103, relayed on board thread `eefa7959`, message `aa7c14a9`): agents run with permissions bypassed, since nobody can answer a prompt, above all on remote machines; a task's questions are settled when it is set
- **Entry point:** New session, Continue last, Fix or Set up with coding agent, Update with coding agent, MCP `console_new` and `console_fix`, a session continued after a limit or from the Sessions list
- **Preconditions:** a coding agent is installed (SCN-058)
- **Steps:**
  1. The person or an agent starts a console -> the runtime starts with its own flag that turns permission prompts off (Claude Code `--dangerously-skip-permissions`, Codex `--dangerously-bypass-approvals-and-sandbox`, Gemini CLI `--approval-mode yolo`, OpenCode `--auto`, Cursor CLI `--force`), placed before Codex's `resume`, and passed through Switchboard's in-place launch after `--`
  2. The agent works through its task without stopping to ask for a tool's permission
- **Expected result:** a console never waits on a permission prompt nobody is there to answer
- **Alt paths:** a runtime whose flag was not read from an installed copy (Qwen Code, Goose, Aider, GitHub Copilot CLI, Amp) starts as before, without a flag, rather than with a guess that could stop it starting; a hand-over Switchboard runs (`handovers run`) takes Switchboard's own setting (its SB-298); an agent's console whose service-written context reads like instructions (FD-234, SCN-053) starts without its flag for that start, a security exception to this rule: a start nobody watches (an MCP `console_fix`) may wait at a prompt until a person answers in the console, and the context and the app's log say why
- **UI elements:** none new
- **States covered:** success
- **Errors & recovery:** money, publishing to people and secrets stay under the agents' and services' own rules (doors, limits, checks), not a permission dialog
- **Status:** implemented (2026-11-07: `test/console.test.ts` *FD-174*, `test/handoff.test.ts`, `test/recovery.test.ts`, `test/sessions.test.ts`)
- **Coverage:** src/core/runtimes.ts, src/core/consoles.ts, src/electron/console.ts, test/console.test.ts
- **Product:** unobserved

### SCN-096: Fabric opens a console session here
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023; FD-166; Fabric's CO-457 (board thread `b250bec9`, messages `5c5a4923`, `c8788f35`): one screen of sessions in Fabric marks a session this app's console holds as "open in Fabric Dashboards"
- **Entry point:** a session in Fabric's sessions screen, or any agent, through MCP `consoles`; the link it hands out
- **Preconditions:** Fabric Dashboards is open and at least one console runs a coding session
- **Steps:**
  1. Fabric (or an agent) calls `consoles` -> one row per console running now: the agent it belongs to (or none for a console of its own), the runtime, the folder, the session ids when Switchboard or a resume named them, since when, and `open_link`
  2. The person clicks the session in Fabric -> `fabric-dashboards://sessions?id=<row>` opens this app on that session's page, its console on screen
- **Expected result:** a session the operator sees in Fabric opens where it runs, never a second copy of it
- **Alt paths:** the app is closed -> `consoles` answers app-not-running and nothing starts; the session ended between the read and the click -> its page shows it ended, as SCN-080 does; a link with a malformed id -> refused with the reason, nothing opens
- **UI elements:** none new: the Sessions mode's session page
- **States covered:** success, empty, error
- **Errors & recovery:** a refused link says why (as every link does, SCN-031); a read the app does not answer within 15 s is an error to the caller, never an empty list
- **Status:** implemented (2026-11-07: `test/consoles-read.test.ts`, `test/mcp.test.ts` *FD-166*)
- **Coverage:** src/core/console-channel.ts, src/electron/console-channel.ts, src/electron/console.ts, src/electron/main.ts, src/core/deeplink.ts, src/mcp/tools.ts, src/mcp/server.ts, test/consoles-read.test.ts, test/mcp.test.ts
- **Product:** unobserved

### SCN-095: See an agent that only waits for setup
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-002; FD-169; the contract's DEC-0149 (an agent with a source manifest starts before its instance is set up and names each missing slot as `degraded[]` with `setup: true`), decided with the contract 2026-11-07 (board thread `1fe66e6e`, message `5549a61a`): a presentation over `degraded`, not a host state
- **Entry point:** Overview, the sidebar, an agent's page, the menu bar icon, the Dock badge
- **Preconditions:** an agent answers with status `degraded` and every entry of its `degraded[]` carries `setup: true`
- **Steps:**
  1. The app reads the agent -> it reads "Waits for setup" with a diamond, not "Partly working"; each entry is said as "{source} waits for you to set it up: {reason}"
  2. Overview lists it under Needs attention after the agents that are partly working, before the tiles that ask for attention; it never turns the sidebar badge red, and the menu bar icon stays calm for it
  3. User presses "Set up with coding agent" -> a console opens with a task to set up each part it names, asking the person for every secret through a hidden prompt (SCN-058's console, the Fix path)
  4. The last setup entry goes -> the agent reads "Ready"
- **Expected result:** an agent that is new and waits for a person is told apart from one that broke, and the person is offered to set it up
- **Alt paths:** its list mixes a setup entry with a failing one -> it reads "Partly working" with both reasons, and Fix is offered; it also has a descriptor problem or a failed last action -> Fix is offered, not Set up
- **UI elements:** the state badge, the diamond glyph, the Needs attention row, the Set up with coding agent button
- **States covered:** success, partial
- **Errors & recovery:** nothing new: the state everything outside the window reads (MCP `list_services` and `service_status`, events, digests, the operator channel) stays `degraded` with `reason.setup`, and no outage message is ever sent for a setup entry (DEC-0044)
- **Copy:**
  - "Waits for setup" / «Ждёт настройки»
  - "Set up with coding agent" / «Настроить с агентом для кода»; short "Set up" / «Настроить»
- **Status:** implemented (2026-11-07: `test/setup-wait.test.ts`; copy checks `7e9f9d7e` (en) and `4b2b4ccb` (ru), no findings)
- **Coverage:** src/core/setup-wait.ts, src/core/attention.ts, src/core/tray-model.ts, src/core/offers.ts, src/core/handoff.ts, src/electron/tray.ts, src/renderer/lib.tsx, src/renderer/components/ServiceActions.tsx, src/renderer/components/Overview.tsx, src/renderer/components/Navigation.tsx, src/renderer/components/ServiceView.tsx, src/core/i18n.ts, test/setup-wait.test.ts
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
  3. The session opens in a console of its own, never in an agent's console (decision 8, extended 2026-10-24: one session lives in one place), and the app sends one notification (SCN-085) -> Sessions lists it under "Running", its row reading "after a limit reset", its page carrying "Continued after a limit reset, <time>" and "Stopped on a usage limit and continued here by <agent> once Switchboard had capacity again."
- **Expected result:** sessions the operator left running come back by themselves after a limit, never twice and never next to a terminal still holding them; every stop is in the Sessions mode with when it comes back or what it waits for
- **Alt paths:** its terminal is still open -> nothing is claimed and it is not listed: the session is alive where it is (FD-108, 0.8.1; 0.8.0 listed it under "Needs you"); the session went on after its stop (Switchboard moved its traffic to another account, the CLI continued at the reset, or the person sent it again) -> it is not listed and never continued again, though Switchboard still holds the stop open: its transcript has a model reply recorded after the stop (read in the person's home, or in the Switchboard home its launch names, FD-217), or the session stopped again later (FD-116, operator 2026-10-25); a later launch took its work over (a Fabric dispatch continues its workflow in a new launch: `continued_as` in `switchboard sessions --history`, read once a pass when a stop names its launch) -> not listed and never continued (FD-217, Switchboard 0.7.69); no account has capacity -> it waits with "Waits for an account with capacity." (SCN-083); a payment limit -> "Needs you" with "Stopped on a payment limit: a top-up is needed." and Remove, for a day (SCN-082); stopped more than a day ago -> not listed, whatever Switchboard still holds it as (FD-108); one session Switchboard holds several stops of -> one row, its latest stop (FD-108); the folder is not here -> "Ended in the last 24 hours" with "Cannot be continued here: its folder is not on this Mac." and Remove, not counted by the badge (SCN-084, FD-108); its conversation is not in the person's own home (a Switchboard launch keeps it in that account's home, `homes/<account>/projects/...`, and a continue runs on another account, so it is not continued here yet, FD-217) -> the same, "Cannot be continued here: its conversation is not in your Claude Code or Codex home.", and nothing is claimed; the continued session exits, or runs without writing its transcript within 30 seconds -> recorded `cancelled`: one that exited is under "Ended in the last 24 hours" with "Cannot be continued here: it did not start; see the log." and Remove (FD-108), and one left running (silent) is under "Needs you" with "Did not continue; its process is still running", Open console and End (SCN-082); the Mac cannot carry another console now (LC-17) -> nothing is claimed and the next pass tries again; another host took the stop -> it is not listed here; the switch is off -> every stop waits with "Continuing by itself is off in Settings, so continue it yourself." and the actions of SCN-083; an agent asks through MCP -> `audit` answers `limitStops` with the same verdicts, read-only
- **UI elements:** the Sessions mode's Waiting, Running and Needs you rows, the session page's origin chip and console line, the Settings → Sessions switch
- **States covered:** empty, success, error
- **Errors & recovery:** a claim Switchboard refuses starts nothing ("Could not be continued here; see the log."); a claimed stop whose console cannot start is recorded `cancelled`; Switchboard not answering says so on All sessions (SCN-078); live processes that cannot be read count as open, never as none
- **Supersedes:** Connections → "Sessions stopped on a limit" with its Open (step 4 and the section, by SCN-078, SCN-082 and SCN-083); the console "listed under Hand-overs by its folder's name" (by SCN-078 and SCN-080); the Settings group "Sessions stopped on a limit" (by SCN-086)
- **Status:** validated
- **Coverage:** the Sessions mode: src/renderer/components/Sessions.tsx, test/sessions-ui.test.ts; the console of its own: src/electron/console.ts (`resume`), test/recovery.test.ts *decision 8 extended*; the automatic continue (validated 2026-10-23): src/core/recovery.ts, src/electron/console.ts (pollRecovery), src/mcp/tools.ts (limitStops), test/recovery.test.ts (*FD-217* included), test/e2e/connections.test.ts *FD-83*; a stop whose session went on: src/core/recovery.ts (`continuedAfter`, `continuedOf`), test/recovery.test.ts *FIX-5*; the Sessions mode on the running app (validated 2026-10-27): test/e2e/sessions.test.ts (the waiting stop under "Waiting for a limit reset", Settings → Sessions)
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
- **Alt paths:** the agent declares its load wrongly -> "This agent declares its load wrongly, so it is not read" with each reason (FAC-SEM-133) and no read is made; the report refuses the token, does not answer, is not JSON or fails its checks (FAC-SEM-132) -> "The load report could not be read" with the reason, and the limits it declared; the report has no window -> "Nothing has run yet"; the report is older than two of its windows -> a note that its counts are of then; an agent that declares nothing has no Load tab; the declaration goes while the tab is open (the agent stops answering, or drops the key) -> the page falls back to Dashboard or Health, never an empty pane; an invalid declaration is a finding under Problems too (Agent map page, MCP `audit`); an agent asks through MCP -> `load` answers the same declaration and sums, or `invalid` / `error` with the reason; the window is hidden -> the last read is answered, nothing is read (LC-08)
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
  1. User presses "Check setup" -> "Checking… this can take up to two minutes." while the app runs the PassionCode launcher's read-only `doctor` at a pinned version (`npx --yes @passioncode-ai/passioncode@0.2.75 doctor --json`, no shell, two-minute cap)
  2. The check ends -> one line: "Failing: <n> · Warnings: <n> · OK: <n> · checked at HH:MM"; below it "Setup steps": one numbered line per area in the launcher's order with Done, Worth a look or To do, the first not done marked Next, each not done with the check that holds it (FD-184); then, folded under "Everything the check found (<n>)", every failing and warning check, grouped by area (Prerequisites, Skills, Apps, MCP servers, Services), an area with a failure first and failures first within it, each with its own words and "Fix:" followed by the launcher's fix
  3. User presses "Fix with my coding agent" -> the Setup console opens beside Overview; its brief starts with what the check found, failures first, each with its fix
- **Expected result:** the person sees in one place what is not set up on this computer and hands the repair to their coding agent; the app runs no repair itself
- **Alt paths:** FD-212: the launcher reports the agents' wiki memory (area `memory`, its PC-178, after 0.2.76) -> a step "Agent memory" / «Память агентов» after Services; a check of an area this version does not know -> listed under "Other" / «Другое», never dropped, so a failed report always shows the line that failed it (copy checks `90e15cf6`, `2fc85cd4`, `98cf4d3f`, `5bc547eb`, no findings; `test/doctor.test.ts` *FD-212*); the setup card's three steps are done -> the card is one quiet line "Everything is set up." with Check setup and Hide (FD-81); an agent asks through MCP -> `setup_check` runs the same read-only doctor and answers with it the steps, one per area (done, attention or todo, with the first check that keeps each from done) and `next`, the first step not done (FD-185); every check passes -> "Every check passed." and no repair button; Node.js is not installed -> "Node.js 18 or later is not installed, so the check cannot run. Install it from nodejs.org, then check again."; the launcher answers anything but its report -> "The check could not run: <its first line>"; no answer in two minutes -> "The check could not run: no answer within 120 s"; a second press while a check runs joins it; the last result stays until the next press and is never re-run on its own
- **UI elements:** Check setup button, the summary line, the grouped lines with their fixes, Fix with my coding agent
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
- **Alt paths:** open at login is on by default here too (SCN-024) and starts the app hidden in the tray at sign-in (`--hidden`, `startHidden` in src/core/platform.ts): on Windows the system's login item, on Linux an XDG autostart entry, `$XDG_CONFIG_HOME/autostart/fabric-dashboards.desktop` (src/core/autostart.ts, FD-37 M3; test/autostart.test.ts); Settings → Open at login turns it off; notification settings open Windows Settings, on Linux the app says to look in the desktop's own settings
- **UI elements:** system window frame, File / View / Window / Help menus, tray icon and menu, Settings → Uninstall
- **States covered:** success, error
- **Errors & recovery:** a Windows copy with no uninstaller beside it, or a Linux copy that is neither an AppImage nor a package -> "Fabric Dashboards is uninstalled from your settings. To remove the app itself: …" with what to do; updates: a Windows copy installed by the installer and a Linux AppImage update themselves as on macOS, and a .deb or a copy the installer did not set up says where the newer version is (SCN-022, FD-37 M4b and M4c)
- **Status:** validated
- **Coverage:** src/core/platform.ts, src/electron/main.ts, src/electron/tray.ts, test/platform.test.ts, test/e2e/desktop-other.test.ts (validated 2026-10-27 on Windows x64 and arm64 and Linux x64 and arm64, validate run 40508339382: steps 1 to 3); step 4 by the package smokes, scripts/nsis-smoke.mjs and scripts/deb-smoke.sh
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
- **Alt paths:** the context cannot be written (disk full) -> the session starts without it and the app's log says why; a Switchboard-bound folder -> the same context goes through Switchboard's in-place launch; text the agent service wrote (its summary, reasons, problems, events, descriptor, a task's findings or a failed command's output) reads like instructions to the coding agent ("ignore previous instructions", `curl … | sh`) -> the session starts without the flag that turns permission prompts off, for this start (Open in Terminal too), so the coding agent's own permission setting decides each step, the context says why, and the console's saved choice is unchanged (FD-234)
- **UI elements:** console panel (unchanged); the runtime's own interface
- **States covered:** success, error
- **Errors & recovery:** context not written -> logged, session still starts; nothing of the token ever reaches the context; the service's free texts sit inside `<untrusted-data>` blocks and its short values (name, version, origin, repository) are one quoted line; the context and `service_context` name all of it as data, never instructions (FD-234)
- **Status:** validated
- **Coverage:** src/core/handoff.ts, src/core/untrusted.ts, src/electron/console.ts, src/mcp/tools.ts (service_context), test/handoff.test.ts, test/untrusted.test.ts, test/mcp.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-054: Fix with coding agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-020 (JTBD-06, JRN-02/#4); ADR-0020
- **Entry point:** "Fix with coding agent" beside a problem in Overview's Needs attention, in a service's reasons, or after a failed command
- **Preconditions:** the agent has a problem (down, degraded, invalid, a failed doctor or update)
- **Steps:**
  1. User presses "Fix with coding agent" -> the agent's page opens with its console; the coding agent starts with the context and a task: what is wrong, and that fixed means `service_status` says ready
  2. User watches -> the runtime's own interface shows what it reads and runs; it asks before anything destructive, any sign-in or secret
  3. The agent fixes it -> the agent's state turns ready in the list and the page, with no refresh
- **Expected result:** a problem becomes a running fix in one click, and the person sees it resolve
- **Alt paths:** a console already runs for this agent -> never a second session: the console says, as information, "A session already runs here. The task waits: send it to this session, or start a new one when this one ends." with "Send the task to this session", which writes the task file and types one line pointing at it into the running session without pressing Enter ("The task is typed into the session. Press Enter in it to send."); New, once that session ends, starts with the task (FD-129 UX-16); no runtime installed -> the console's install guidance (SCN-049)
- **UI elements:** "Fix with coding agent" button; console panel
- **States covered:** success, error, loading
- **Errors & recovery:** the runtime fails to start -> the console says why (SCN-049's errors)
- **Status:** validated
- **Coverage:** src/core/offers.ts (offersFix), src/core/handoff.ts (fixTask), src/renderer/App.tsx (handToAgent), src/renderer/components/ConsolePanel.tsx, ServiceView.tsx (header and card), Overview.tsx (Needs attention), test/handoff.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-055: Update with coding agent
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-020 (JTBD-06, JRN-02/#4); ADR-0020
- **Entry point:** "Update with coding agent" where an update is offered and the agent has no update command, or its update command failed
- **Preconditions:** the agent reports a newer version, or its update failed
- **Steps:**
  1. User presses "Update with coding agent" -> the console starts the runtime with the context and a task: from which version to which, how (the descriptor's command, or the repository's own instructions), and the failed output when there is one
  2. The agent updates and restarts it -> the page shows the new version
- **Expected result:** every update has a way through, even one the agent's own command cannot do
- **Alt paths:** the agent's update command exists and has not failed -> "Update to <v>" runs it as before (no coding agent needed)
- **UI elements:** "Update with coding agent" button
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
  1. User chooses Needs attention first -> agents by rank: not answering or in conflict (two copies, a wrong or another user's program on the port, a port conflict, a broken install file) first, then partly working, then starting or stopping, then ready, then stopped; by name within a rank
  2. User chooses Recent activity -> the agent with the newest event comes first
  3. User chooses By name -> alphabetical, as before
- **Expected result:** the list is in the order the person works in; the choice is remembered
- **Alt paths:** pinned agents keep pin order whatever the sort; On this Mac, Online, Services and Hidden are each sorted inside (FD-78); the sort control sits in the first shown section's header
- **UI elements:** sort control (By name, Needs attention first, Recent activity, Your order)
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
  2. User presses "Start setup" -> the runtime starts in the Setup console with the setup brief: register this app's MCP and make the proving call; check or install the Fabric Agent Adapter skills; install Switchboard, Observatory and Fabric; create or adapt a first agent; make it a service. Before any step the agent sends one message: what it installs, one consent for all of it, and every step that needs the person (each sign-in, code, secret, payment) listed together (FD-185)
  3. The agent reaches a step the first message named (a sign-in, a code, a secret) -> the user answers in the console (a secret in a hidden prompt); nothing else is asked
  4. A service lands -> it appears in the list while the setup runs; the setup card ticks what is done (MCP registered, skills found, first agent)
- **Expected result:** a working system without a manual, and every step visible
- **Alt paths:** an agent starts the setup for the person (MCP `console_new` with `service: "fabric-dashboards.setup"`, FD-182) -> the same Setup console and brief, listed in `consoles`; no coding agent installed -> the card shows each vendor's install command to copy, and Start setup appears once one is found; the person declines a product -> the agent moves on; the person closes the app mid-setup -> the next launch offers Continue setup; the PassionCode launcher prints its one-time line about anonymous usage counts -> the agent gives it to the person word for word (setup.md asks it to, `test/setup.test.ts`)
- **UI elements:** setup card with its checklist, Setup console, "Start setup", "Continue setup"
- **States covered:** success, empty, error, loading
- **Errors & recovery:** a step fails -> the agent says why in the console; the checklist shows what is done and what is not
- **Status:** validated
- **Coverage:** src/core/setup.ts, src/core/offers.ts (SETUP_KEY), src/core/install-commands.ts (the alt path's commands, UX-13), src/electron/console.ts, src/renderer/components/Overview.tsx (SetupCard), src/renderer/App.tsx, test/setup.test.ts, test/e2e/focus-console.test.ts
- **Product:** unobserved

### SCN-059: A later session opens on what changed
- **Persona:** P-01
- **Feature:** overview
- **Traces:** ST-022 (JTBD-06, JRN-02/#3); ADR-0020
- **Entry point:** any launch after setup
- **Preconditions:** the person has used the app before
- **Steps:**
  1. User opens the app -> Overview shows, after Needs attention, "Since you were last here": agents that broke (each with Fix with coding agent), "Updates waiting: <agent> <version>, …" (the Update button is the agent's row in Needs attention above, FD-129 UX-09), and new or removed agents
  2. User sees the agents they worked with -> each offers Continue (the last console session, resumed with fresh context)
  3. User opens one -> the agent they had selected last time is selected
- **Expected result:** the person starts from what needs them, not from the whole list
- **Alt paths:** nothing changed -> the section says so in one line ("Nothing changed since <when>."), also for a person with no console history (UX-09), and Overview reads as before; Dismiss puts the section away; the window shown again after an hour or more hidden (the app lives in the menu bar for days) -> the section is computed again from the previous show (UX-08)
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
- **Alt paths:** Fabric is not installed -> the press opens a small menu with one line, "Fabric is not installed. Get it at passioncode.ai/fabric.", and choosing it opens that page in the browser; nothing downloads and nothing is retried; Fabric is installed later -> the next press opens it; the dashboard page has its own Fabric button -> it is hidden inside this app (the page is told the app draws one), and it still shows in a browser; an id outside Fabric's grammar -> no button
- **UI elements:** Fabric button in the service header (accessible name "Open Fabric"), the native menu when Fabric is absent
- **States covered:** success, empty (Fabric not installed)
- **Errors & recovery:** the OS names a handler but it cannot open the link -> the same "not installed" menu, and `main.log` has `fabric_button failed` with the reason
- **Status:** validated
- **Coverage:** src/core/fabric-button.ts, src/core/fabric-links.ts (the contract's copy), src/electron/main.ts (fabricButton, fabricPress), src/electron/views.ts (fabricCookie), src/renderer/components/ServiceView.tsx (FabricButton), test/fabric-button.test.ts, test/e2e/app.test.ts (FD-45, present and absent)
- **Product:** unobserved

### SCN-062: Outages reach me away from the Mac
- **Persona:** P-01
- **Feature:** notifications
- **Traces:** ST-002 (JTBD-01); ADR-0010 amendments 2026-10-11 (FD-48), 2026-10-19 (FD-76) and 2026-10-27 (FD-125); operator decisions 2026-10-11 and 2026-10-19 (the Telegram rule), 2026-10-25 and 2026-10-27 (a decision an agent waits for, relayed by growth `482a8030`)
- **Entry point:** nothing — the watcher acts; Settings → Notifications → Also send outages to
- **Preconditions:** an installed agent offers a notify capability (for example the person's Telegram channel)
- **Steps:**
  1. An agent stops answering and stays so for 15 minutes -> one message reaches the channel: "<Agent> is not answering" with how long and why
  2. The agent works again and keeps working for 15 minutes -> one more message: "<Agent> is back", after how many minutes
  3. An agent asks for the operator's decision (an events-feed row with `notify` whose kind asks for one: an approval, a choice, a decision owed, a guardrail stop) -> one message reaches the channel: "<Agent> waits for your decision", the agent's own words and "Open in Fabric Dashboards: <link>" to the page it names; the same question is not sent again for a day; during a pause, quiet hours or with the agent muted it waits until they allow it (FD-125)
  4. User opens Settings → Notifications -> Also send outages to: Automatic (<channel>), the agents that offer it, Off; under it what it does and the last delivery ("Last sent HH:MM: …" or "Sending failed HH:MM: …")
- **Expected result:** an outage longer than fifteen minutes is known wherever the person is, once, and its end too; so is every decision an agent waits for; nothing routine reaches the channel
- **Alt paths:** shorter than 15 minutes -> nothing is sent (the Mac banner of ADR-0008 still shows after a minute), and nothing later either: an agent that is well again when its fifteen minutes come round sends neither "down" nor "back" (0.7.16); the agent falls again within 15 minutes of coming back -> the same outage, no new message; while it is down a part of it fails ("<Agent>: <part> is failing") -> still the same outage, no "back"; an agent that answers but reports a failing part, or a setup state -> shown on this Mac only; the person paused notifications, is in quiet hours or switched the agent off -> nothing is sent for it, nor its recovery; no agent offers the capability -> Settings says outages are shown on this Mac only; several do -> Settings asks to choose; an events-feed failure or warning banner -> shown on this Mac only (FD-76)
- **UI elements:** Settings → Notifications: Also send outages to (select), its help line and its last-delivery line
- **States covered:** success, error, empty
- **Errors & recovery:** the channel does not answer -> retried every minute until it is sent, and given up 24 hours after the outage ended; the last failure shows in Settings with its reason; the app's log has `alerts:` lines
- **Status:** validated
- **Coverage:** src/core/outage-alerts.ts, src/core/mcp-client.ts, src/electron/outage-alerts.ts, src/electron/main.ts (outage-alerts), src/renderer/components/Settings.tsx (AlertChannel), src/core/notify.ts (intentOf), test/outage-alerts.test.ts, test/operator-asks.test.ts *FD-125*, *FD-131*
- **Product:** observed 2026-10-12 on this Mac: 22 failure alerts sent 5.0–5.4 min after an outage began, none for the 34 shorter episodes (FD-01). FD-76 (2026-10-19): the installed 0.7.14 had sent 798 messages in 8 days (311 outages, 309 recoveries, 203 banners); the 15-minute rule, one case per outage and Mac-only banners are counted on a fake clock by `test/outage-alerts.test.ts`, the live count is owed after the release. FD-131 (2026-10-27): step 3 never reached the channel on the installed 0.8.8 to 0.8.11: each ask went as `question` without the reply binding the channel requires and was refused (`question_binding_required`, 567 times since 18:58 UTC, `main.log`); asks now go as `result`; step 3 observed on 0.8.12 on 2026-10-28 02:39:47 UTC: three asks sent to the channel in the second the update installed (`main.log`)

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
  3. User presses "Agents" (or ⌘1) -> the sidebar lists Overview, Activity, Agent map, Spend, Pinned, On this Mac, Online, Services and Hidden, with no session among them and no hand-over section; the main area shows the page last open in this mode (Overview the first time)
  4. A session needs a person (SCN-082) -> "Sessions" carries a count badge in either mode, named to a screen reader "Sessions, need you: 2"; with none it carries no badge
  5. User quits and opens the app again -> it opens in the mode and on the page it was closed on
- **Expected result:** agents and coding sessions never share one list; one press or one key moves between them, and the app remembers where the person was
- **Alt paths:** Switchboard hands a session over or a session changes state while Agents is shown -> the badge changes and the mode does not: a new hand-over never switches the mode by itself; the person clicks a session's notification or the tray's Sessions line (SCN-085) -> Sessions opens on it; a fabric-dashboards:// link to an agent's page, a notification about an agent or an agent in the tray menu -> Agents opens on it; the sidebar is folded into a rail (SCN-047) -> the switch becomes two icons, each named in a tooltip and to a screen reader, the badge on the Sessions icon; the page last open in a mode has gone (a session removed, an agent uninstalled) -> that mode opens on its first page (All sessions or Overview); a session's terminal has focus (SCN-080) -> ⌘1 and ⌘2 (Ctrl+1 and Ctrl+2 on Windows and Linux) still switch the mode: they are the View menu's shortcuts (`menuKeys`, `modeMenuItems` in src/core/platform.ts), so the menu takes them before the terminal and they never reach the coding agent
- **UI elements:** the sidebar switch (two buttons, the selected one pressed), its badge, View → Agents and View → Sessions with their shortcuts, the rail's two icons
- **States covered:** empty, success
- **Errors & recovery:** the remembered mode cannot be read (damaged settings) -> Agents on Overview; nothing else depends on it
- **Copy:**
  - "Agents" / «Агенты» (the switch and the View menu)
  - "Sessions" / «Сессии» (the switch and the View menu)
  - "Sessions, need you: {n}" / «Сессии, нужно ваше решение: {n}» (the switch's accessible name with a badge; one name for the needs-you state, orchestrator 2026-10-24)
  - "All sessions" / «Все сессии»
  - "On this Mac" / «На этом Mac» (existing; "On this computer" / «На этом компьютере» elsewhere)
- **Status:** validated
- **Coverage:** src/renderer/components/Navigation.tsx (ModeSwitch, AgentsNav, SessionsNav), src/renderer/App.tsx (mode and the page last open in each mode), src/core/settings.ts (`layout.mode`, `layout.sessionId`), src/core/platform.ts (`modeMenuItems`), src/electron/main.ts (View menu); test/navigation.test.ts. Partly: the Sessions mode reopens on its page after a relaunch; the Agents mode remembers its page within a run and reopens on Overview after a relaunch Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-078: See every coding session in one place
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JTBD-01, JRN-01/#9); operator review 2026-10-24 ("They unfold from the top, it is unclear what they are, why they are needed and how they work."); SES-02, SES-03, SES-07, SES-08; UX-02, UX-17
- **Entry point:** Sessions → All sessions, or a group heading in the sidebar
- **Preconditions:** none
- **Steps:**
  1. User opens Sessions -> "Reading sessions…" until the first read; then the sidebar and the page list the sessions in four groups, in this order, each with its count after its label and an empty group not drawn: "Needs you: N", "Running: N", "Waiting for a limit reset: N", "Ended in the last 24 hours: N" (in the sidebar "Ended: N", R1-V3); a waiting row's mark is a clock (R1-V2)
  2. User reads a row -> on a card, first line: the project (the folder's name); second line: coding agent · account · how it came here · time ("Claude Code · claude4 · handed over · 14:02"); in the sidebar the time sits beside the project, never cut, and the second line is account · how it came here, led by the coding agent only when it is not Claude Code ("claude4 · handed over", R1-V1), in the sidebar's own shorter words ("handed over", "after a reset", "hit a limit", "via Switchboard", "opened here") that fit its width in both languages, and wraps to a second line rather than cut them (FD-107); an ended row in the sidebar shows when it ended, the time its group is ordered by (FD-107); the session whose page is open stays in the sidebar's view: the list scrolls to it, and a folded Ended group still shows it (FD-107); on a card how it came here is one of "handed over", "after a limit reset", "stopped by a limit" (a stop that waits, cannot continue here, or was declined, with the account it stopped on; V-1 of FIX-2), "started by Switchboard", "opened here"; times read 14:02 in Russian and 2:02 PM in English (V-7); a card wraps its second line rather than cut its time, and one or two cards fill the row (V-4); in the narrow rail two entries of one folder differ by their hover title, which carries the time and the second line (V-4); two rows of one folder differ by that second line; the state is said in words by the group heading and on the card, never by a glyph alone
  3. User reads a card on the page -> the same two lines, the state in words and the state's actions as buttons (SCN-081 to SCN-084); choosing the card itself opens the session's page (SCN-080)
  4. User unfolds "Ended in the last 24 hours" (folded by default; the fold is remembered) -> ended sessions newest first, each with its Continue and Remove; "Clear" above them removes every ended session from the list at once, with no question: an ended entry is only a list row, and the transcript stays where the coding agent wrote it
  5. User reads the bottom of the page -> the footnote "Sessions started in a terminal without Switchboard are not listed." (once the list is read; not under "Reading sessions…", FD-107), only while Switchboard does not list every agent process (`sessions --machine`, FD-231): where it does, those sessions are listed and the footnote is not drawn
- **Expected result:** every coding session Switchboard or this app knows is listed once, newest first in its group, each saying what it is, where it came from and what it needs
- **Alt paths:** FD-231 (SL-8, Switchboard SB-353, 0.7.72 and newer): a Claude Code or Codex process that no owner started (no Switchboard launch, not a console of this app) is listed under Running as "Running, started by hand" / «Идёт, запущена вручную», "started by hand" / «запущена вручную» on its second line ("by hand" / «вручную» in the sidebar), with the folder Show in Finder opens and no End: this app did not start it and does not stop it; its page says "Someone started this session by hand, not through Switchboard or this app. It is listed so you see everything that runs on this Mac. This app cannot type to it, end it or continue it after a limit." / «Эту сессию запустили вручную, не через Switchboard и не из этого приложения. Она в списке, чтобы было видно всё, что работает на этом Mac. Писать ей, завершить её или продолжить после лимита это приложение не может.»; one whose folder's transcripts were not written for 30 minutes reads "Running, but has written nothing for {minutes} min" / «Идёт, но ничего не пишет уже {minutes} мин»; one whose folder Switchboard cannot read is named "Folder unknown" / «Папка неизвестна» and offers nothing; a runtime this app ran itself in the same folder within two minutes is that console's row, never a second one. A Switchboard without `--machine` is not asked again for ten minutes and the list is not called out of date. FD-207: FD-207: a board run Fabric started (`switchboard dispatch`: its launch record names a dispatch, or Fabric's surface not in place) has no window -> it is listed as "Running in the background" / «Идёт в фоне, без окна», its page says "Fabric started this session for a board request. It runs with no window, so there is nothing to type to: it answers on the board." / «Эту сессию запустил Fabric для запроса с доски. Она идёт без окна, писать ей некуда: ответ она даст на доске.», and Show in Finder stays (before, "Running in Terminal", which sent the person to a window that does not exist; copy checks `43a28a41`, `43ae21fe`, `68763171`, `fe0850f8`, no findings; `test/sessions.test.ts` *FD-207*); no session at all -> the empty sentence (Copy) and no group; Switchboard is not installed -> only this app's console sessions, with the not-installed sentence; Switchboard did not answer on the last read -> what was read before stays, with the not-answering sentence and the time it stopped answering (the first failed read, FD-107); Switchboard and a console of this app know the same session -> one row (merged by folder and start time); Switchboard holds several limit stops of one session (one stopped 44 times on 2026-10-24) -> one row, its latest stop (FD-108); a limit stop older than 24 hours, or one whose terminal is still open -> not listed at all (FD-108, 0.8.1); an ended session older than 24 hours -> it leaves the list by itself; the app restarts -> the ended sessions of the last 24 hours are still listed (what their consoles printed is not, SCN-080); the list is read every 15 seconds while the window is shown and every 60 seconds while it is hidden, in either mode (`HANDOVER_POLL_MS` in src/electron/console.ts, the same tick as SCN-086 and AGENTS.md §Lifecycle), so a new session appears within that time
- **UI elements:** the sidebar's group headings and rows, the All sessions page with the same groups as cards, the fold of Ended with Clear, the footnote, the empty, not-installed and not-answering lines
- **States covered:** loading, empty, success, error
- **Errors & recovery:** Switchboard does not answer -> the not-answering line with the time it stopped answering, and the next read tries again; the list of ended sessions cannot be saved -> the list still shows them until the app quits, and the log says why
- **Copy:**
  - "Reading sessions…" / «Читаем сессии…»
  - "Needs you: {n}" / «Нужно ваше решение: {n}»
  - "Running: {n}" / «Идут: {n}»
  - "Waiting for a limit reset: {n}" / «Ждут сброса лимита: {n}»
  - "Ended in the last 24 hours: {n}" / «Завершены за 24 часа: {n}»; in the sidebar "Ended: {n}" / «Завершены: {n}»
  - "Clear" / «Очистить»
  - "handed over" / «передана»
  - "after a limit reset" / «после сброса лимита»
  - "stopped by a limit" / «остановлена лимитом»
  - "started by Switchboard" / «запущена Switchboard»
  - "opened here" / «открыта здесь»
  - in the sidebar (FD-107): "handed over" / «передана», "after a reset" / «после сброса», "hit a limit" / «на лимите», "via Switchboard" / «Switchboard», "opened here" / «открыта здесь»
  - "No coding sessions yet. A session you start in an agent's console, or one Switchboard starts or hands over, appears here." / «Сессий агентов для кода пока нет. Здесь появится сессия, которую вы начнёте в консоли агента, или та, что запустит или передаст Switchboard.»
  - "Switchboard is not installed, so only sessions started in this app's consoles are listed." / «Switchboard не установлен, поэтому здесь только сессии из консолей этого приложения.»
  - "Switchboard has not answered since {time}, so sessions it runs may be missing." / «Switchboard не отвечает с {time}, поэтому его сессий здесь может не быть.» (FD-107: the time is the first failed read, never called a check)
  - "Sessions started in a terminal without Switchboard are not listed." / «Сессии, запущенные в терминале без Switchboard, здесь не видны.»
- **Status:** validated
- **Coverage:** src/core/sessions.ts (S2), src/core/sessions-view.ts (`groupRows`, `secondLine`, `stateWords`), src/renderer/components/Navigation.tsx (SessionsNav), src/renderer/components/Sessions.tsx (AllSessions); test/sessions.test.ts, test/sessions-ui.test.ts, test/sessions-polish.test.ts (FD-107) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-079: The Sessions page explains itself once
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("it is unclear what they are, why they are needed and how they work"); SES-01, SES-09
- **Entry point:** Sessions → All sessions, until the note is dismissed
- **Preconditions:** the note has not been dismissed on this computer
- **Steps:**
  1. User opens All sessions -> above the groups a note says what a session here is and why Switchboard sends sessions here (Copy), with "Choose where sessions continue" and "Got it"
  2. User presses "Choose where sessions continue" -> Settings opens on its Sessions section (SCN-086); the note stays until it is dismissed
  3. User presses "Got it" -> the note goes and never comes back, also after an update or a restart
- **Expected result:** the first look at the page explains what is listed, why it is here, and the one place that changes it
- **Alt paths:** Windows or Linux -> the "this computer" variant; Switchboard is not installed -> no note: one notice says Switchboard is not installed and how to get it (the not-installed sentence of SCN-078, then "Install Fabric Switchboard…"), with no button to a setting of a Switchboard that is not there (V-7 of FIX-2)
- **UI elements:** the note, "Choose where sessions continue", "Got it"
- **States covered:** success
- **Errors & recovery:** the dismissal cannot be saved -> the note shows again at the next launch; nothing else depends on it
- **Copy:**
  - "Here are the coding agents' sessions on this Mac. When a session hits a limit, Switchboard passes the work to another account or coding agent, and it continues here, in the console." / «Здесь сессии агентов для кода на этом Mac. Когда сессия упирается в лимит, Switchboard передаёт работу другому аккаунту или агенту для кода, и она продолжается здесь, в консоли.»
  - "Here are the coding agents' sessions on this computer. When a session hits a limit, Switchboard passes the work to another account or coding agent, and it continues here, in the console." / «Здесь сессии агентов для кода на этом компьютере. Когда сессия упирается в лимит, Switchboard передаёт работу другому аккаунту или агенту для кода, и она продолжается здесь, в консоли.»
  - "Install Fabric Switchboard so that a session that hits a limit continues here." / «Установите Fabric Switchboard, чтобы сессия, упёршаяся в лимит, продолжалась здесь.»
  - "Choose where sessions continue" / «Выбрать, где продолжаются сессии» (COPY-17: "hand-over" is Switchboard's word, orchestrator 2026-10-24)
  - "Got it" / «Понятно» (accessible name "Hide this explanation" / «Скрыть это пояснение»)
- **Status:** validated
- **Coverage:** src/renderer/components/Sessions.tsx (AllSessions), src/renderer/App.tsx (`sessionsNoteSeen`, Settings on its Sessions section), src/core/settings.ts; test/sessions-ui.test.ts Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-080: Open one session's page
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023, ST-019 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-05, SES-06, SES-09; UX-18, UX-25, VIS-05, VIS-06
- **Entry point:** a session's row or card; a session's notification (SCN-085)
- **Preconditions:** the session is listed (SCN-078)
- **Steps:**
  1. User opens a session -> the header: the project as the title, the state in words beside it, the origin chip, the account chip, a "Paid" chip on a hand-over that runs on money (FD-124), the context chip when Switchboard names one, the coding agent and the folder (shortened, the full path on hover), and the actions of its state on the right (SCN-081 to SCN-084)
  2. The session runs in this app's console -> under the header the console fills the rest of the main area, the full height of the window; it is not a drawer: there is no fold and no collapse, and nothing on this page navigates elsewhere by itself
  3. User types into the terminal -> every key reaches the coding agent, Esc included, except the app's menu shortcuts, which the menu takes first (⌘1 and ⌘2 switch the mode, SCN-077; Ctrl+1 and Ctrl+2 on Windows and Linux); while the terminal has focus a quiet line under it says how to leave it
  4. User presses Esc, then Tab within one second -> the Esc has reached the coding agent as usual and the Tab does not; focus leaves the terminal for the next control in the window's order (Esc, then Shift+Tab: the header's last action)
  5. User changes the colour scheme or the theme in Settings, or the system switches between light and dark -> the terminal's background, text, selection and colours follow at once, without restarting the session (SCN-067)
  6. Switchboard 0.7.0 kept a launch record for the session (FD-124, SB-212) -> under the header's chips one folded line "About this launch"; opened, it lists where the launch was asked for (Switchboard, the command line, an agent through MCP, another session's limit, a limit reset, or this app), who asked, how it ended and when, where its work went on (a hand-over, a workflow, another session) and the number of turns, with Show transcript, which shows the coding agent's own transcript file in the file manager; the path is never drawn on the page and the file is never read or sent; the console under the header moves down while the line is open
- **Expected result:** a session is a page of its own: what it is, where it came from, which account it spends and what can be done with it at the top, and its console filling the rest
- **Alt paths:** the session runs in a Terminal window Switchboard opened (SCN-081) -> no console; the page says where to type to it (it names the window Switchboard opens there: Terminal on macOS, a PowerShell window on Windows, a terminal window on Linux, R1-A); an ended session of this app's console after the app restarted -> its console shows what it printed, kept for as long as its row is listed (24 hours) in a file only the person can read, removed with the row (FD-124); a session whose output was not kept (it ran in Terminal, printed nothing, ended before 0.8.17, or a later session of the same console took its place) -> the page says nothing it printed was kept (V-5 of FIX-2); a session waiting for a limit reset -> under the header a calm panel says when Switchboard tries it again ("at about {time}", or when an account has capacity, or that continuing by itself is off), the way out now (Continue now on another account, or "Do not continue"; with no other account, that none has capacity), its folder and when it stopped (FD-107, SCN-083); a hand-over that did not open here -> a panel says where it is (the window Switchboard opened) and that Remove takes it off the list (FD-107, SCN-082); any other state without a console of this app -> a panel says no console holds it: no state leaves the body blank (FD-107); the session leaves the list while its page is open (Remove, Clear, 24 hours passed) -> All sessions opens, never an empty page; the window is hidden while it runs -> it keeps running, its output waits in the console's buffer and shows when the window is shown again; a hand-over or a session continued after a limit reset never runs in an agent's console (decision 8, extended 2026-10-24: SCN-069 step 2, SCN-075 step 3); a session started in an agent's own console is listed as "opened here", and its page and the agent's drawer show one console and one output; Windows or Linux -> the same keys; Switchboard before 0.7.0, or a launch it kept no record for -> no "About this launch" line; a fact Switchboard recorded in another form is left out, never guessed; the transcript file was moved or deleted -> Show transcript says the file is no longer there (FD-124)
- **UI elements:** the header (title, state words, origin, account, paid and context chips, coding agent, folder, actions), the folded launch facts with Show transcript (FD-124), the full-height console, the keyboard line, the Terminal and not-kept notes
- **States covered:** empty, success, error
- **Errors & recovery:** the console cannot start (no room, SCN-063) -> its reason in the console's place, and the header keeps the state's actions
- **Copy:**
  - "Handed over by Switchboard after a limit on {account}, {time}" / «Передана Switchboard после лимита {account}, {time}» (not drawn yet: no source says which account hit the limit, so the plain chip below is shown and the account chip names the account it runs on)
  - "Handed over by Switchboard, {time}" / «Передана Switchboard, {time}» (a hand-over not caused by a limit)
  - "Continued after a limit reset, {time}" / «Продолжена после сброса лимита, {time}»
  - "Continue tried after a limit reset, {time}" / «Попытка продолжить после сброса лимита, {time}» (a continue that did not take up its conversation, SCN-082; V-3 of FIX-2)
  - "Stopped by a limit on {account}, {time}" / «Остановлена лимитом на {account}, {time}»; without a known account "Stopped by a limit, {time}" / «Остановлена лимитом, {time}» (a stop that waits, cannot continue here or was declined; its account is Switchboard's `account` of the stop, by its label; no separate account chip then; V-1 of FIX-2)
  - "Started by Switchboard, {time}" / «Запущена Switchboard, {time}»
  - "Opened here, {time}" / «Открыта здесь, {time}»
  - "Account: {account}" / «Аккаунт: {account}»
  - "Context: personal" / «Контекст: личный»
  - "Context: {organization}" / «Контекст: {organization}»
  - "To leave the terminal, press Esc, then Tab." / «Чтобы выйти из терминала, нажмите Esc, затем Tab.»
  - "This session runs in a Terminal window that Switchboard opened. Type to it there." / «Эта сессия идёт в окне Терминала, которое открыл Switchboard. Пишите ей там.»; on Windows "a PowerShell window" / «в окне PowerShell», on Linux "a terminal window" / «в окне терминала»
  - "Nothing this session printed was kept." / «Вывод этой сессии не сохранился.» (FD-124: an ended console's output is kept 24 hours; text check reports a7b46c1b-b5be-46e2-88c5-30dd025d55fa, 285bae61-a263-40f8-90a4-f51e9878ac22, the one suggestion, no full stop, declined: the app's body sentences end with one)
  - "Switchboard tries this session again at about {time} on an account with capacity." / «Switchboard попробует продолжить эту сессию около {time} на аккаунте с запасом.»; with no time "Switchboard tries this session again when an account has capacity." / «Switchboard попробует продолжить эту сессию, когда у аккаунта появится запас.»; with continuing by itself off "Continuing by itself is off in Settings, so Switchboard does not try it again." / «Автоматическое продолжение выключено в настройках, поэтому Switchboard не продолжит её сам.» (FD-107)
  - "Continue now on another account, or choose "Do not continue"." / «Можно продолжить сейчас на другом аккаунте или выбрать «Не продолжать».»; with no other account "No other account has capacity now; choose "Do not continue" if it should not continue." / «Сейчас ни у одного другого аккаунта нет запаса; если продолжать не нужно, выберите «Не продолжать».» (FD-107)
  - "Folder" / «Папка», "Stopped" / «Остановлена» (FD-107)
  - "Type to it in the window Switchboard opened. Remove takes it off this list." / «Пишите ей в окне, которое открыл Switchboard. Кнопка «Убрать» уберёт её из списка.»; when it opened nowhere "Nothing of this session runs in this app. Remove takes it off this list." / «В этом приложении эта сессия не идёт. Кнопка «Убрать» уберёт её из списка.» (FD-107)
  - "No console of this app holds this session, so there is nothing to show here." / «Ни одна консоль этого приложения не держит эту сессию, поэтому показать здесь нечего.» (FD-107)
  - "About this launch" / «О запуске»; its labels "Started" / «Запущена», "Asked by" / «Кто попросил», "Ended" / «Завершилась», "Work went on as" / «Работа продолжена как», "Turns" / «Ходов» (FD-124)
  - Started: "from Switchboard" / «из Switchboard», "from the command line" / «из командной строки», "by an agent, through MCP" / «агентом через MCP», "when another session reached its limit" / «когда другая сессия упёрлась в лимит», "to continue after a limit reset" / «чтобы продолжить после сброса лимита», "from Fabric Dashboards" / «из Fabric Dashboards»
  - Ended: "finished, {time}" / «закончила работу, {time}», "stopped by a limit, {time}" / «остановлена лимитом, {time}», "stopped, {time}" / «остановлена, {time}», "did not start" / «не запустилась», "not known how" / «неизвестно как»
  - Work went on as: "a hand-over" / «передача», "workflow {id}" / «рабочий процесс {id}», "another session" / «другая сессия»
  - "Paid: OpenRouter key" / «Платно: ключ OpenRouter», "Paid: API key" / «Платно: ключ API»: a chip beside the account on a hand-over Switchboard runs on money, not a subscription (its `paid`, FD-124; text check reports dd68bd76-a7e8-46f8-9abf-d85c25d01bf7, db32e37f-06d2-4406-8d00-3d776257ebf0)
  - "Show transcript" / «Показать запись разговора»; "The transcript file is no longer there." / «Файла с записью разговора больше нет.» (text check reports 0ac9db9e-9dbd-493b-8531-725e1625f5c9, 6fa43598-9237-4912-ae78-21679fc5e9fd; the one suggestion, active voice for «остановлена лимитом», is declined to keep the word the origin chip already uses)
- **Status:** implemented (step 6 and its alt paths, FD-124, 2026-10-28; the rest validated 2026-10-27)
- **Coverage:** src/renderer/components/Sessions.tsx (SessionHeader, SessionChain, SessionBody), src/core/sessions-view.ts (`chainFacts`), src/core/switchboard.ts (`launchFactsOf`), src/electron/console.ts (`revealTranscript`, `transcriptFile`, `restoreKept`), src/core/kept-output.ts, test/kept-output.test.ts, src/renderer/App.tsx (sessions-shell region; the console area), src/core/layout.ts (`drawerBoundsFor`), src/electron/drawer.ts (`full`), src/renderer/DrawerApp.tsx, src/renderer/components/ConsolePanel.tsx (page mode; Esc then Tab; the scheme followed live), src/core/sessions-view.ts (`terminalKey`, `resolveSessionRoute`); test/sessions-ui.test.ts, test/sessions-polish.test.ts (FD-107); step 6 in test/e2e/sessions.test.ts (the SCN-077 test opens the ended session's launch facts, FD-124). The e2e of a synthetic hand-over's page is still owed Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
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
  3. User presses "End session" -> the coding agent is asked to stop and, if it has not ended within 2 seconds, is stopped; the session moves to Ended as "Ended by you at {time}" (SCN-084)
  4. User presses "Show in Finder" -> the session's folder opens in Finder
  5. Switchboard runs a session in a Terminal window -> state "Running in Terminal"; "Show in Finder" for its folder (V-6 of FIX-2); "Show in Terminal" when Switchboard knows its window; no action that ends or removes it
- **Expected result:** a running session can be ended here only when this app runs it, always with a question first; one Switchboard runs elsewhere can be found, never stopped from here
- **Alt paths:** Switchboard does not know the Terminal window -> no "Show in Terminal", and the page says where it runs (SCN-080); the session ends by itself while the question is open -> the question closes and the session is Ended (SCN-084)
- **UI elements:** the state words, End and its question, Show in Finder (Explorer, folder), Show in Terminal
- **States covered:** success, error
- **Errors & recovery:** the session cannot be signalled -> it stays Running with "The session could not be ended: {reason}"; the folder cannot be shown -> "Could not open {path}: {reason}"
- **Copy:**
  - "Running" / «Идёт»
  - "Running in Terminal" / «Идёт в Терминале»; on Windows "Running in a PowerShell window" / «Идёт в окне PowerShell», on Linux "Running in a terminal window" / «Идёт в окне терминала»
  - "End" / «Завершить»
  - "Show in Finder" / «Показать в Finder»; "Show in Explorer" / «Показать в Проводнике»; "Show folder" / «Показать папку»
  - "Show in Terminal" / «Показать в Терминале»
  - "End this session?" / «Завершить эту сессию?»
  - "The coding agent stops. What it printed stays on this page, and you can continue the session later." / «Агент для кода остановится. Всё, что он вывел, останется на этой странице, а сессию можно будет продолжить позже.»
  - "End session" / «Завершить сессию»; "Cancel" / «Отмена»
  - "The session could not be ended: {reason}" / «Не удалось завершить сессию: {reason}»
  - "Could not open {path}: {reason}" / «Не удалось открыть {path}: {reason}»
- **Status:** validated
- **Coverage:** src/renderer/components/Sessions.tsx (SessionActions), src/renderer/App.tsx (the End question); test/sessions-ui.test.ts. "Show in Terminal" is not drawn (decision 10) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
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
  3. A hand-over Switchboard offered could not open here -> under "Needs you" with the reason in one sentence (it expired; its folder is not on this Mac; this Mac could not carry another session; Switchboard is too old), followed by "Switchboard opened it in Terminal." once it did; action "Remove". "Could not carry" is any refusal of SCN-063 (`admit` in src/core/admission.ts, src/electron/console.ts takeHandover), and its sentence names the one cause found: the disk, six sessions, or swap run out on Linux (R1-B); on Windows and Linux the window is named as Switchboard opens it there (R1-A)
  4. A session stopped on a payment limit within the last day -> under "Needs you" with "Stopped on a payment limit: a top-up is needed." (SCN-075); action "Remove". Nothing else Switchboard holds as stopped is counted here (decision 1, amended 2026-10-24 after 0.8.0; FD-108): a stop older than a day, or whose terminal is still open, is not listed; one whose folder or conversation is not here is Ended, "Cannot be continued here" (SCN-084); one that waits for a reset waits (SCN-083)
  5. User presses "Remove" -> the row leaves the list and the badge counts one less; nothing else changes (a Terminal window Switchboard opened stays open, and Switchboard's own record is untouched)
- **Expected result:** every session that waits for a decision says why in one sentence and offers the one thing that can be done about it here; the badge counts only those (0.8.0 counted 39 on 2026-10-24, most of them stops more than a day old: FD-108)
- **Alt paths:** the person opens the page of a hand-over that did not open here -> under the header a panel says where it is (the window Switchboard opened, or that nothing of it runs here) and that Remove takes it off the list (SCN-080, FD-107); a hand-over Switchboard still offers that the app has not taken yet -> not listed and not counted until it is taken or fails (orchestrator 2026-10-24); the cause clears by itself (the stopped session's terminal closes and Switchboard marks it ready) -> it moves to its new group at the next read; a coding agent asking a question in its console joins this group once a source reports it (none does in this release)
- **UI elements:** the Needs you group and badge, the reason sentence, Open console, End, Remove
- **States covered:** error, success
- **Errors & recovery:** the console of a failed resume cannot be reached (its process ended meanwhile) -> it moves to Ended as "Ended at {time}" with Continue (SCN-084)
- **Copy:**
  - "Did not continue; its process is still running" / «Не продолжилась, процесс ещё идёт»
  - "Open console" / «Открыть консоль»
  - "The hand-over expired before the session could open here." / «Передача истекла раньше, чем сессия открылась здесь.»
  - "Its folder is not on this Mac." / «Её папки нет на этом Mac.» (existing; "Its folder is not on this computer." / «Её папки нет на этом компьютере.»)
  - "This Mac cannot carry another session now: less than 5 GB is free on its disk." / «Этот Mac сейчас не может принять ещё одну сессию: на её диске свободно меньше 5 ГБ.» ("This computer" / «Этот компьютер» on Windows and Linux)
  - "This Mac cannot carry another session now: six console sessions already run." / «Этот Mac сейчас не может принять ещё одну сессию: уже идут шесть консольных сессий.»; "This computer cannot carry another session now: the system has run out of swap." / «Этот компьютер сейчас не может принять ещё одну сессию: в системе кончилась память подкачки.» (Linux)
  - "The running Switchboard is older than its command line, so the session was not taken here. Update Switchboard." / «Запущенный Switchboard старше своей командной строки, поэтому сессию здесь не взяли. Обновите Switchboard.»
  - "Switchboard opened it in Terminal." / «Switchboard открыл её в Терминале.»; on Windows "in a PowerShell window" / «в окне PowerShell», on Linux "in a terminal window" / «в окне терминала»
  - "The session could not start here; see the log." / «Сессия не смогла запуститься здесь, подробности в журнале.» (a hand-over whose console did not start)
  - "Stopped on a payment limit: a top-up is needed." / «Остановлена денежным лимитом: нужно пополнение.» (existing)
  - "Remove" / «Убрать»
- **Status:** validated
- **Coverage:** src/core/sessions.ts (S2), src/core/sessions-view.ts (`stateWords`), src/renderer/components/Sessions.tsx; test/sessions.test.ts, test/sessions-ui.test.ts, test/sessions-needs-you.test.ts (FD-108) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
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
- **Alt paths:** the person opens its page -> under the header a panel says when Switchboard tries it again, the way out now, its folder and when it stopped (SCN-080, FD-107); no other account can take it now -> the button is disabled with "No other account has capacity now.", or with Switchboard's own reason when it names one (FD-118, Switchboard 0.6.83): "No account in its group can take it.", "The account it stopped on was removed from Switchboard.", "The account it stopped on waits for a payment." or "Switchboard waits before it checks the accounts again."; the reset comes and "Continue sessions after a limit reset" is on -> it continues by itself (SCN-075) and moves to Running; the setting is off -> the row says to continue it yourself, stays under Waiting and is not counted by the badge, and both actions stay
- **UI elements:** the waiting line, Continue now on another account with its account menu, Do not continue
- **States covered:** success, error
- **Errors & recovery:** Switchboard refuses the claim, or the console cannot start -> the row stays waiting with "Could not be continued here; see the log."
- **Copy:**
  - "Continues at about {time}" / «Продолжится около {time}»
  - "Waits for an account with capacity." / «Ждёт аккаунт с запасом.» (existing)
  - "Continue now on another account" / «Продолжить сейчас на другом аккаунте»
  - "{account} · {provider}" (the account menu's items, untranslated)
  - "No other account has capacity now." / «Сейчас ни у одного другого аккаунта нет запаса.»
  - "No account in its group can take it." / «Ни один аккаунт в её группе не может её взять.» (FD-118)
  - "The account it stopped on was removed from Switchboard." / «Аккаунт, на котором она остановилась, удалён из Switchboard.» (FD-118)
  - "The account it stopped on waits for a payment." / «Аккаунт, на котором она остановилась, ждёт оплаты.» (FD-118)
  - "Switchboard waits before it checks the accounts again." / «Switchboard выжидает, прежде чем снова проверить аккаунты.» (FD-118)
  - "Do not continue" / «Не продолжать»
  - "Continuing by itself is off in Settings, so continue it yourself." / «Автоматическое продолжение выключено в настройках, поэтому продолжите её сами.»
  - "Could not be continued here; see the log." / «Продолжить здесь не удалось, подробности в журнале.» (existing)
- **Status:** validated
- **Coverage:** src/core/sessions.ts (S2), src/renderer/components/Sessions.tsx (SessionActions: the account menu), src/electron/console.ts (`continueStop`); test/sessions-ui.test.ts, test/sessions-polish.test.ts (the page's panel, FD-107) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-084: An ended session continues or leaves
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023 (JTBD-05, JRN-01/#9); operator review 2026-10-24 ("They hang there killed, closed after idle, and nothing can be done with them."); SES-03, SES-04; UX-02; dossier "Every state has an action": ended, closed after idle, ended by you
- **Entry point:** Sessions → "Ended in the last 24 hours", or an ended session's page
- **Preconditions:** the session ended less than 24 hours ago
- **Steps:**
  1. User reads an ended session -> one of "Ended at {time}" (it ended by itself), "Closed at {time} after 30 idle minutes" (SCN-066), "Ended by you at {time}" (SCN-081), "Closed when the app quit" / «Закрыта при выходе из приложения» (R1-S4) or "Not continued: you declined" (SCN-083); actions "Continue" and "Remove"; a limit stop of the last day this app cannot continue reads "Cannot be continued here: {why}" (its folder is not on this Mac; its conversation is not in your Claude Code or Codex home; it did not start, see the log) with "Remove" only, and its page says nothing of it runs here (FD-108); the group is ordered by when each ended, newest first, and each one's words and sidebar row say that time (FD-107)
  2. User presses "Continue" -> the coding agent's own resume of that conversation starts in the same folder (Claude Code's `--resume`, Codex's own), through Switchboard on its account when the folder is bound to one; the session moves to Running with its page and console, keeping its origin
  3. User presses "Remove" -> it leaves the list; its transcript stays where the coding agent wrote it
  4. Twenty-four hours after it ended -> it leaves the list by itself; until then a restart of the app keeps it
- **Expected result:** no ended session is a dead end: each can be continued where it was or taken off the list
- **Alt paths:** the conversation is not known to the app (no transcript recorded) -> the button reads "New session here" and starts a fresh session in that folder; its folder is gone -> Continue is disabled with "Its folder is not on this Mac."; the row is an agent's own console closed after 30 idle minutes -> Continue here is that console's own continue: it clears the console's idle note and the row leaves the list (the other way back, from the agent's console, is SCN-066 and takes this row off the list as well, R1-C)
- **UI elements:** the ended state words, Continue (New session here), Remove
- **States covered:** success, error
- **Errors & recovery:** the continue cannot start (no room, SCN-063, or Switchboard refuses) -> its reason on the page, and the session stays Ended with both actions
- **Copy:**
  - "Ended at {time}" / «Завершилась в {time}»
  - "Closed at {time} after 30 idle minutes" / «Закрыта в {time} после 30 минут простоя» (FD-107: with its time)
  - "Ended by you at {time}" / «Завершена вами в {time}» (FD-107: with its time)
  - "Not continued: you declined" / «Не продолжена: вы отказались»
  - "Cannot be continued here: {why}" / «Здесь не продолжить: {why}», where {why} is "its folder is not on this Mac." / «её папки нет на этом Mac.» ("this computer" / «этом компьютере» on Windows and Linux), "its conversation is not in your Claude Code or Codex home." / «её диалога нет в вашей папке Claude Code или Codex.», "it did not start; see the log." / «она не запустилась, подробности в журнале.» (FD-108)
  - "Continue" / «Продолжить»
  - "New session here" / «Новая сессия здесь»
  - "Remove" / «Убрать»
- **Status:** validated
- **Coverage:** src/core/sessions.ts (S2: `resumable`, 24 h memory, `ended-cannot-continue`), src/core/sessions-view.ts (`continueLabel`, `stateWords`), src/renderer/components/Sessions.tsx (SessionBody); test/sessions.test.ts, test/sessions-ui.test.ts, test/sessions-needs-you.test.ts (FD-108) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-085: A taken hand-over tells me once, and the tray counts sessions
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023, ST-007, ST-009 (JTBD-01, JRN-01/#9); operator review 2026-10-24 ("it is unclear what they are, why they are needed and how they work"); SES-01
- **Entry point:** nothing to press: the app takes a hand-over (SCN-069); the menu bar icon
- **Preconditions:** notifications are not paused and not in quiet hours (SCN-024)
- **Steps:**
  1. The app takes a hand-over -> one system notification titled "Sessions": "Switchboard handed over a session: {project} continues on {coding agent}"; a session the app continues by itself after a limit reset (SCN-075) sends one too: "{project} continues after a limit reset on {coding agent}" (decision 9)
  2. User clicks it -> the window shows in the Sessions mode on that session's page (SCN-080)
  3. User opens the menu bar menu while a session runs or needs the person -> a line "Sessions: running N, need you M" (a part at zero left out) under the headline
  4. User chooses that line -> the window shows in the Sessions mode on All sessions
  5. A session needs the person, with the window closed or not -> the menu bar icon takes its attention shape (a diamond in the fourth panel's place, not a problem's dot) until nothing needs the person; a problem still shows the dot (R1-P1)
- **Expected result:** a session Switchboard hands over is announced once and is one click away; the tray says how many sessions run and wait without opening the window
- **Alt paths:** notifications are paused or in quiet hours -> no notification; the session is listed and the switch's badge counts it when it needs the person; no session runs or waits -> no tray line; the system refuses the app's notifications -> nothing shows, the list and the badge still say it
- **UI elements:** the notification, the tray's Sessions line
- **States covered:** success, empty
- **Errors & recovery:** the session has left the list when the notification is clicked -> All sessions opens
- **Copy:**
  - "Sessions" / «Сессии» (the notification's title)
  - "Switchboard handed over a session: {project} continues on {agent}" / «Switchboard передал сессию: {project} продолжается на {agent}»
  - "{project} continues after a limit reset on {agent}" / «{project} продолжается после сброса лимита на {agent}» (an automatic continue, decision 9)
  - "Sessions: running {running}, need you {waiting}" / «Сессии: идут {running}, нужно ваше решение {waiting}»
  - "Sessions: running {running}" / «Сессии: идут {running}»
  - "Sessions: need you {waiting}" / «Сессии: нужно ваше решение {waiting}»
- **Status:** validated
- **Coverage:** src/core/sessions-notice.ts, src/core/sessions-view.ts (`traySessionsLine`), src/electron/main.ts (the notice becomes a notification; its click opens the session), src/electron/tray.ts; test/sessions-ui.test.ts, test/review-round1.test.ts; test/e2e/sessions.test.ts walks a synthetic hand-over with its notification (R1-E1) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-086: Settings → Sessions
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-023, ST-010 (JTBD-05, JRN-01/#9, JRN-01/#7); operator review 2026-10-24 ("it is unclear what they are, why they are needed and how they work"); FD-62, FD-83; Switchboard SB-108
- **Entry point:** Settings → Sessions; "Choose where sessions continue" on All sessions (SCN-079)
- **Preconditions:** none
- **Steps:**
  1. User opens Settings → Sessions -> two switches: "Open sessions handed over by Switchboard here" with its explanation, read from Switchboard (`switchboard handovers`), and "Continue sessions after a limit reset" with its explanation (moved here from "Sessions stopped on a limit")
  2. User turns the first switch -> the app asks Switchboard to change it (`switchboard handovers set on` or `off`) and shows the value Switchboard reads back
  3. User turns the second switch -> it applies at once (SCN-075) and is kept across restarts
- **Expected result:** both choices about where sessions continue are in one place in this app, the first one kept by Switchboard itself
- **Alt paths:** opened by "Choose where sessions continue" (SCN-079) -> the page scrolls only as far as needed to show the whole Sessions section, never past its heading, so when it fits the page title stays in view, and focus is on the section's heading (FD-107); Switchboard is not installed -> the first switch is disabled with how to get it; this Switchboard cannot change the setting -> the first switch is disabled with "update Switchboard"; the setting is changed in Switchboard itself -> this switch shows it at the next read (15 seconds with the window shown, 60 hidden)
- **UI elements:** the Sessions section, its two switches with their explanations, the disabled reasons
- **States covered:** success, error
- **Errors & recovery:** Switchboard refuses the change -> the switch returns to Switchboard's value with "Switchboard did not change it: {reason}"
- **Copy:**
  - "Sessions" / «Сессии» (the section)
  - "Open sessions handed over by Switchboard here" / «Открывать сессии, переданные Switchboard, здесь»
  - "When a session hits a limit, Switchboard passes it to another account or coding agent. On: it continues here, in a console. Off: Switchboard opens it in a new Terminal window. The setting is Switchboard's; it is changed here through Switchboard." / «Когда сессия упирается в лимит, Switchboard передаёт её другому аккаунту или агенту для кода. Включено: она продолжается здесь, в консоли. Выключено: Switchboard открывает её в новом окне Терминала. Настройка принадлежит Switchboard, здесь она меняется через него.»; on Windows "a new PowerShell window" / «новом окне PowerShell», on Linux "a new terminal window" / «новом окне терминала» (R1-A)
  - "Continue sessions after a limit reset" / «Продолжать сессии после сброса лимита»
  - its explanation: the existing `settings.resumeAfterLimit.body` in both languages
  - "Install Fabric Switchboard to have sessions handed over here." / «Чтобы сессии передавались сюда, установите Fabric Switchboard.»
  - "This Switchboard cannot change this setting; update Switchboard." / «Эта версия Switchboard не умеет менять эту настройку; обновите Switchboard.»
  - "Switchboard did not change it: {reason}" / «Switchboard не изменил настройку: {reason}»
- **Status:** validated
- **Coverage:** src/renderer/components/Settings.tsx (sessions-settings region; the scroll by `revealScrollTop` of src/core/layout.ts), src/electron/console.ts (`readHandoversSwitch`, `setHandoversSwitch`); i18n parity in test/copy.test.ts; test/sessions-polish.test.ts (`revealScrollTop`, FD-107) Validated 2026-10-27 on the running app by test/e2e/sessions.test.ts (both tests green on an unlocked screen).
- **Product:** unobserved

### SCN-087: Arrange the sidebar: width and order
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-021, ST-018 (JTBD-01); FD-121 (operator 2026-10-26: «чтобы я мог её чуть по ширине двигать», «менять местами агентов, просто зажать их, подвинуть»)
- **Entry point:** the sidebar's right edge; an agent's row in the sidebar
- **Preconditions:** the sidebar is expanded (SCN-047)
- **Steps:**
  1. User drags the sidebar's right edge -> the sidebar follows the pointer between 200 and 420 px, the dashboard beside it takes the rest; while the edge is held the dashboard steps aside (a native view would take the pointer) and comes back on release; the width is kept across restarts
  2. User double-clicks the edge -> it returns to 240 px
  3. User holds an agent's row and drags it up or down within its section -> a line shows where it lands; on release it stays there, the sort reads "Your order", and every section keeps what the person saw, on Overview too
  4. User drags a pinned agent within Pinned -> the pin order changes; the sort of the other sections stays as it was
  5. User restarts the app -> width and order are as they were; a new agent arrives after the ones the person placed
- **Expected result:** the sidebar is as wide as the person's names need and lists the agents in the order they work in
- **Alt paths:** keyboard -> the edge is a separator: Left and Right arrows change the width by 16 px, Home returns it to 240; on an agent's row Alt+Up and Alt+Down move it one place within its section and a screen reader hears its new place; the person chooses another sort (By name, Needs attention first, Recent activity) -> the list follows that sort, and choosing "Your order" again brings the dragged order back; an agent is dropped on another section -> nothing moves (sections are On this Mac, Online, Services, Pinned and Hidden; Pin and Show as a service move between them); the sidebar is folded into the rail -> no edge and no dragging; a damaged width in settings reads as 240
- **UI elements:** the sidebar's edge (a separator, "Sidebar width"), the drop line, the "Your order" sort
- **States covered:** success
- **Errors & recovery:** n/a: nothing is sent anywhere; a write of settings that fails keeps the screen as the person left it (R-9)
- **Copy:**
  - "Sidebar width" / «Ширина боковой панели» (the separator's name)
  - "Drag to change the width. Double-click returns it to the start." / «Потяните, чтобы изменить ширину. Двойной щелчок вернёт исходную.» (its tooltip)
  - "Your order" / «Свой порядок» (the sort)
  - "{name}: place {n} of {total}" / «{name}: место {n} из {total}» (said after a move)
  - "Show {name} again" / «Показать {name} снова» (the eye on a hidden row)
- **Status:** validated
- **Coverage:** src/core/products.ts (moveInSection, arrangeProducts), src/core/settings.ts (sidebarWidth, mergeList), src/renderer/components/Navigation.tsx, src/renderer/App.tsx (SidebarEdge), test/sidebar-manage.test.ts, test/e2e/focus-console.test.ts *FD-121* (validated 2026-10-27: the edge drag saved, double-click and Home back to 240 px, the arrow step)
- **Product:** unobserved

### SCN-088: Choose the default and fallback coding agents
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-010 (JTBD-01); FD-117 (operator 2026-10-25: «понятную в интерфейсе настройку ... фоллбека, с какого агента на какой агент пробрасывается, какие там модели включаются в каком агенте ... дефолтный этот, фоллбек ... уровень один этот, два этот»); Switchboard's fallback chains and default agent (fabric-switchboard `docs/CLI.md`)
- **Entry point:** Settings → Coding agents, from the Settings index
- **Preconditions:** Fabric Switchboard is installed; the settings are Switchboard's (its chain per machine and its default agent), and this app reads and writes them through Switchboard's CLI, never its files
- **Steps:**
  1. User opens Settings → Coding agents -> the default coding agent ("Auto" or one agent) and the fallback order, level 1, level 2 and on, each with the model it works on: "on its account's model" for Claude Code, Codex and Kimi Code, "on <model> through OpenRouter" for OpenCode and Hermes
  2. User picks another default coding agent -> Switchboard saves it (`agents default`) and the screen reads it back
  3. User picks another agent for a level, adds a level, removes one or moves one up or down -> Switchboard saves the whole order (`chain set`; `chain clear` when no level is left) and the screen reads it back; a level whose agent did not change keeps its pinned account or key
  4. User picks the OpenRouter model, or Hermes's own model -> Switchboard saves it (`agents openrouter model`, `agents hermes set`); the note says it applies to every session of that agent on this Mac, and every level on that model shows the new one
  5. Groups and tasks with an order of their own are listed under the machine's order, read-only: "<group>: <agents>", "Tasks with their own order: <n>"
- **Expected result:** the person sees who starts work, who continues it at a limit and on which model, and changes it in one place
- **Alt paths:** no order is set -> "No order is set: when a coding agent reaches its limit, its work waits." and Add level; eight levels -> Add level is off and says Switchboard takes at most eight; a level names an agent that cannot take over work now (not installed or turned off in Switchboard) -> it stays listed with why, and the person can replace or remove it; no OpenRouter key saved -> the model choice says so instead of a list; Hermes does not answer -> its level shows the OpenRouter key's model and the Hermes model choice says Hermes did not answer; an agent asks for this through MCP -> it uses Switchboard's own tools (`switchboard_chain_set`, `switchboard_agent_set`, `switchboard_openrouter_model`, `switchboard_hermes_set`), so this app adds none (dashboard parity holds through Switchboard)
- **UI elements:** the Coding agents section in Settings and its index entry; a select for the default coding agent; per level a select, Move up, Move down and Remove; Add level; the OpenRouter model and Hermes model selects; the read-only list of groups with their own order
- **States covered:** success, empty, error, loading
- **Errors & recovery:** Switchboard is not installed -> "Install Fabric Switchboard to choose coding agents here." and no controls; a Switchboard without fallback orders -> "This Switchboard has no fallback order; update Switchboard."; Switchboard does not answer -> "Switchboard did not answer: <its sentence>"; a write is refused -> "Switchboard did not change it: <its sentence>" and the screen shows what Switchboard holds
- **Copy:**
  - "Coding agents" / «Агенты для кода» (the section)
  - "Which coding agent starts work, and which ones continue it in turn when its accounts reach their limits. The settings are Switchboard's; they are changed here through Switchboard." / «Какой агент для кода начинает работу и какие по очереди продолжают её, когда у его аккаунтов кончаются лимиты. Настройки принадлежат Switchboard, здесь они меняются через него.»
  - "Default coding agent" / «Агент для кода по умолчанию»; "Auto" / «Авто»
  - "Fallback order" / «Порядок запасных»; "Level {n}" / «Уровень {n}»; "Add level" / «Добавить уровень»
  - "on its account's model" / «на модели своего аккаунта»; "on {model} through OpenRouter" / «на {model} через OpenRouter»
- **Status:** validated (2026-10-28: `test/e2e/fallback.test.ts` walks steps 1 to 4, the refused default and the empty order against a Switchboard fake that keeps its state; `test/fallback.test.ts` the reads, the pins, the models, the old and silent Switchboard and the refusals before Switchboard sees a malformed change; the section read on this Mac's Switchboard 0.6.83, read-only)
- **Coverage:** src/core/fallback.ts, src/core/fallback-types.ts, src/electron/console.ts (fallback-host), src/renderer/components/Fallback.tsx, src/renderer/components/Settings.tsx (index), test/fallback.test.ts, test/e2e/fallback.test.ts
- **Product:** unobserved

### SCN-089: See which agents are placed on the other machine
- **Persona:** P-01
- **Feature:** health
- **Traces:** ST-004, ST-003; FD-132 (MV-9 of the second-machine move, fabric-workspace `docs/reports/2026-10-28-second-machine-move/README.md`); the placement record Observatory writes (OBS-283, `observatory-placement/1`), decision MD-20 of fabric-workspace-7f: "a label is there: placed on the other machine, no Start; no label: off, as before"
- **Entry point:** the agent list, Needs attention and an agent's page
- **Preconditions:** the person runs agents on two machines; Observatory wrote this machine's placement record, `${XDG_DATA_HOME:-~/.local/share}/project-observatory/placement.json` (owner only), naming the agents placed on the other machine by launchd label or `id.instance`
- **Steps:**
  1. An agent the record places on the other machine does not answer here -> it reads "Stopped" with "Placed on the other machine, {machine}: it runs there, so here it stays off. Its dashboard opens here while a port forward from that machine runs."; it is never "Not answering", raises no notification and no outage alert, and its page offers no Start
  2. The person presses Start through an agent anyway (MCP `control`) -> it is refused before launchd runs anything: "{name} is placed on {machine}; starting it here would run a second copy. Move it in Observatory's placement first"
  3. An agent the record places on the other machine answers here too -> it reads "Two copies" with "Placed on {machine}, yet a copy runs here too. Stop it here to keep one."; its page offers Stop and no Restart, and Needs attention lists it
  4. Observatory moves the agent back (its label leaves the record) -> at its next probe it reads as before: off with Start, or ready
  5. An agent the record places on the other machine answers here while this Mac's own job for it is not loaded (the move left an SSH tunnel on its port) -> it reads with the copy's own state ("Ready", or what that copy says) and "Runs on {machine}. This computer reaches it through its port, so what you see here is that copy."; its page offers no Start, Restart or Stop (FD-179)
  6. The person (MCP `control`, or the Stop of an older page) asks to stop such an agent -> if this Mac's job for it is not loaded, it is refused before launchctl runs: MCP answers "{name} runs on {machine} and its job is not loaded here: nothing of it runs on this machine to stop. Stop it on the machine that runs it", the page "{name} runs on {machine}: nothing of it runs on this computer to stop."; if the job is loaded with no process, it is unloaded and that is the whole stop: the forwarded answer on the port is not waited out (FD-179)
  7. The record names the forward that should bring such an agent's port here (`forward`, the launchd label of the job, OBS-480) and the agent does not answer -> it reads "Stopped" with "Runs on {machine}, and its port forward to this computer ({forward}) is not running, so its dashboard does not open here." (FD-196)
- **Expected result:** on each machine the person sees which agents run here and which run on the other machine, and a copy on both is named as a second copy, so the move between machines leaves no duplicate or missing agent unseen
- **Alt paths:** no record on this machine -> every agent reads as placed here, as before; an online agent -> its platform places it, the record is not read for it; the record names no machine for the agent (Observatory writes `placedOn` `unknown` when the moved bundle named none) -> each sentence says "another machine" instead of a name
- **UI elements:** the state and reason on the agent's row, its page and Needs attention; the run group on the agent's page (Start hidden, Stop alone for a second copy)
- **States covered:** success, empty, error
- **Errors & recovery:** a record another user owns, that others may write, larger than 1 MB or not of `observatory-placement/1` is not read (it could hide Start), the reason goes to `main.log` once (`placement_unreadable <reason>`) and the agents read as placed here
- **Copy:**
  - "Placed on the other machine, {machine}: it runs there, so here it stays off. Its dashboard opens here while a port forward from that machine runs." / «Размещён на другой машине ({machine}): работает там, а здесь выключен. Его дашборд открывается здесь, пока идёт проброс порта с той машины.» (the second sentence since FD-196)
  - FD-196, step 7: "Runs on {machine}, and its port forward to this computer ({forward}) is not running, so its dashboard does not open here." / «Работает на {machine}, а проброс его порта на этот компьютер ({forward}) не идёт, поэтому дашборд здесь не открывается.»; machine unknown: "Runs on another machine, …" / «Работает на другой машине, …»
  - "Placed on {machine}, yet a copy runs here too. Stop it here to keep one." / «Агент размещён на машине {machine}, но копия работает и здесь. Остановите её здесь, чтобы осталась одна.»
  - "{name} is placed on {machine}: starting it here would run a second copy." / «{name} размещён на машине {machine}: если запустить его здесь, будут работать две копии.»
  - FD-179, step 6: "{name} runs on {machine}: nothing of it runs on this computer to stop." / «{name} работает на машине {machine}: на этом компьютере останавливать нечего.»; machine unknown: "{name} runs on another machine: nothing of it runs on this computer to stop." / «{name} работает на другой машине: на этом компьютере останавливать нечего.»
  - FD-179: "Runs on {machine}. This computer reaches it through its port, so what you see here is that copy." / «Работает на машине {machine}. Этот компьютер обращается к агенту через его порт, поэтому здесь вы видите ту копию.»; machine unknown: "Runs on another machine. This computer reaches it through its port, so what you see here is that copy." / «Работает на другой машине. Этот компьютер обращается к агенту через его порт, поэтому здесь вы видите ту копию.»
  - Machine unknown: "Placed on another machine: it runs there, so here it stays off. Its dashboard opens here while a port forward from that machine runs." / «Размещён на другой машине: работает там, а здесь выключен. Его дашборд открывается здесь, пока идёт проброс порта с той машины.»; "Placed on another machine, yet a copy runs here too. Stop it here to keep one." / «Агент размещён на другой машине, но копия работает и здесь. Остановите её здесь, чтобы осталась одна.»; "{name} is placed on another machine: starting it here would run a second copy." / «{name} размещён на другой машине: если запустить его здесь, будут работать две копии.»
- **Status:** validated (2026-10-28: `test/e2e/elsewhere.test.ts` walks steps 1 and 3 on the built app with a record under a temporary `XDG_DATA_HOME`, an agent off here and the sample answering here; `test/elsewhere.test.ts` the monitor (off for longer than the notice delay with nothing said, the second copy, Start refused before launchctl, an unusable record said once); `test/control.test.ts` and `test/attention-queue.test.ts` the refusal and the first action; the package's vectors and `packages/service-host/test/placement.test.ts` the state and the record; copy check reports `b66cfed9` (en) and `4927b853` (ru), no findings. 2026-11-03: the record Observatory 0.30.1's own writer makes is read (`packages/service-host/test/placement.test.ts`); the machine-unknown sentences: `test/elsewhere.test.ts`, copy check reports `5420d6ed` (en) and `f13c7774` (ru), no findings. 2026-11-08, FD-179 (step 5): `test/elsewhere.test.ts` *FD-179* and the package's vector; copy check reports `436b7448` (en) and `952943eb` (ru), no findings; step 6: `test/control.test.ts` *FD-179* (fails on the code before it), copy check reports `538b74f5`, `94b14c43` (en), `9f27df2f`, `ab1fe264` (ru), one suggestion each in ru (no final full stop), kept: every `result.*` sentence ends with one. 2026-11-09, FD-196 (steps 1 and 7): `test/elsewhere.test.ts` *FD-196*, `packages/service-host/test/placement.test.ts` *FD-196* and the package's vector; copy check reports `deb37475`, `94f30467`, `6d3da181` (en), `57739f67`, `72a9180b`, `3e243072` (ru), no findings in en, the no-final-full-stop suggestion in ru kept as above)
- **Coverage:** packages/service-host/src/placement.ts, packages/service-host/src/state.ts, packages/service-host/src/look.ts, src/core/monitor.ts (placed-elsewhere), src/core/control.ts, src/core/focus.ts, src/mcp/tools.ts, src/renderer/components/ServiceView.tsx, test/e2e/elsewhere.test.ts, test/elsewhere.test.ts
- **Product:** unobserved

### SCN-090: Rename an agent
- **Persona:** P-01
- **Feature:** list
- **Traces:** ST-003; FD-135; ADR-0026; the operator in chat, 2026-11-03: names of agents set from the menu and kept in the agent's own GitHub repository
- **Entry point:** the agent's row menu in the sidebar (⋯, or a right-click in either width), item Rename…
- **Preconditions:** the agent's descriptor names its repository on GitHub (`source.repository`); the GitHub CLI (`gh`) is installed and signed in with write access to that repository
- **Steps:**
  1. The person opens the row's menu and chooses Rename… -> a dialog shows the name now in a field, selected, and says where it goes: "Saved in the agent's repository on GitHub ({repo}), so each of your Macs shows it."; the dashboard steps aside while the dialog is open
  2. The person types a name and presses Save (or Return) -> "Saving to GitHub…" with a spinner; the app commits `.fabric/names.json` to the repository's default branch
  3. GitHub takes it -> the dialog closes and the new name shows at once in the sidebar, the page header, the tray and notifications; another Mac shows it within 30 minutes of its last read
  4. The person opens Rename… on a renamed agent -> the dialog also shows "Its own name: {name}" with Use its own name, which removes the name from the file
- **Expected result:** the person sees the agents under names of their own on every Mac, and the agent's own name is one click away
- **Alt paths:** the name is the agent's own name again -> it is removed from the file, not written twice; the same name as now -> Save stays off; a name set meanwhile on another Mac -> both are kept (the file is read again and the change made on it); the descriptor names no repository, or one not on GitHub -> the field is off and the dialog says why before anything is asked
- **UI elements:** the row menu item Rename…; the Rename agent dialog (field Name, the sentence where it goes, Its own name with Use its own name, Cancel, Save)
- **States covered:** success, loading, error, empty
- **Errors & recovery:** a name over 80 characters -> "At most {max} characters." and Save off; `gh` not installed -> "GitHub CLI (gh) is not installed. Install it and sign in with gh auth login."; GitHub refuses (no permission, a protected branch, sign-in expired) -> "GitHub did not take the name: {error}" in GitHub's words, the field keeps the text, the person can try again or cancel; Escape or Cancel closes the dialog unless it is saving
- **Copy:**
  - "Rename…" / «Переименовать…»; "Rename agent" / «Переименовать агента»; "Name" / «Имя»
  - "Saved in the agent's repository on GitHub ({repo}), so each of your Macs shows it." / «Имя сохранится в репозитории агента на GitHub ({repo}), и его покажет каждый ваш Mac.»
  - "Its own name: {name}" / «Собственное имя агента: {name}»; "Use its own name" / «Вернуть собственное имя»
  - "Save" / «Сохранить»; "Saving to GitHub…" / «Сохраняю на GitHub…»; "At most {max} characters." / «Не длиннее {max} символов.»
  - "The agent does not name its repository, so the name has nowhere to go." / «Агент не указывает свой репозиторий, поэтому имя негде сохранить.»
  - "The agent's repository is not on GitHub: {repo}." / «Репозиторий агента не на GitHub: {repo}.»
  - "GitHub CLI (gh) is not installed. Install it and sign in with gh auth login." / «Не установлен GitHub CLI (gh). Установите его и войдите командой gh auth login.»
  - "GitHub did not take the name: {error}" / «GitHub не принял имя: {error}»
- **Status:** validated (2026-11-03: `test/e2e/rename.test.ts` walks steps 1 to 4 and the no-repository path on the built app against a fake `gh` (FD_TEST_GH); `test/agent-names.test.ts` walks the file, the reads, the commits against a fake GitHub (create, change, give back, delete the file, a change made meanwhile on another Mac, a refused write), the store's cadence and cache, the monitor's names and the MCP tool `rename`; copy check reports `12b0541b` (en) and `5933b2b3` (ru), no findings; the other-platform sentence `7e52bfd0` (en, none) and `502a2af7` (ru, one suggestion: no full stop in a one-sentence hint, kept for consistency with the other dialog sentences); a live read of the 20 GitHub repositories the agents of this Mac name, one call, 2 s, none failed)
- **Coverage:** src/core/agent-names.ts, src/core/monitor.ts (agent-names), src/electron/main.ts (agent-names), src/renderer/components/RenameDialog.tsx, src/renderer/components/Navigation.tsx, src/mcp/tools.ts (agent-names), test/agent-names.test.ts, test/e2e/rename.test.ts
- **Product:** unobserved

### SCN-091: Learn that anonymous usage and error data is shared
- **Persona:** P-01
- **Feature:** settings
- **Traces:** ST-017; FD-136; docs/ANALYTICS.md; the operator, 2026-11-04 (relayed by Fabric's session 5d9bed98): anonymous usage and error data on by default, for installs already out too, a notice at the first launch, off in each product's settings
- **Entry point:** the first time the window shows in a release build; Settings → Privacy
- **Preconditions:** a release build that carries an App Key (a source build sends nothing and shows no notice)
- **Steps:**
  1. The window shows for the first time -> a dialog: "Fabric Dashboards shares anonymous usage and error data", what is counted and what never is, with OK and Turn off; the dashboard steps aside while it is open
  2. The person presses OK -> the dialog closes and does not come back; counting goes on
  3. The person presses Turn off -> the dialog closes and does not come back; nothing more is sent and what waited is dropped
  4. Later, in Settings → Privacy, the person turns *Share anonymous usage and error data* on or off -> it takes effect at once, for Fabric Dashboards only
- **Expected result:** the person knows what the app shares before it matters to them, and turns it off in one place
- **Alt paths:** an install that ran an earlier version -> on, and the notice shows once; another PassionCode app turned its own sharing off -> this one is not turned off; a build without a key -> no notice, and Settings says "This build sends nothing: only a released Fabric Dashboards carries the key to send."
- **UI elements:** the notice dialog (title, two sentences, Turn off, OK); Settings → Privacy (the switch and its note)
- **States covered:** success, empty
- **Errors & recovery:** a send that fails is kept and tried again later (60 s, then 10 min) and never shown; a shared installation file that cannot be read sends the counts without an id
- **Copy:**
  - "Fabric Dashboards shares anonymous usage and error data" / «Fabric Dashboards отправляет анонимные данные об использовании и сбоях»
  - "To make the app better, it sends counts: how many agents it watches, which days it is used, and which part of it crashed." / «Чтобы приложение становилось лучше, оно отправляет счётчики: сколько агентов отслеживает, в какие дни им пользуются и какая его часть дала сбой.»
  - "Never names, paths, addresses, keys or what your agents do. You can turn it off any time in Settings, under Privacy." / «Никаких имён, путей, адресов, ключей и того, что делают ваши агенты. Выключить можно в любой момент в Настройках, в разделе «Конфиденциальность».»
  - "OK" / «Хорошо»; "Turn off" / «Выключить»; "Privacy" / «Конфиденциальность»
  - "Share anonymous usage and error data" / «Отправлять анонимные данные об использовании и сбоях»
  - "Counts of agents and days of use, and which part of the app crashed. Never names, paths or what your agents do. For Fabric Dashboards only." / «Счётчики агентов и дней использования и то, какая часть приложения дала сбой. Никаких имён, путей и того, что делают ваши агенты. Только для Fabric Dashboards.»
  - "This build sends nothing: only a released Fabric Dashboards carries the key to send." / «Эта сборка ничего не отправляет: ключ для отправки есть только у выпущенного Fabric Dashboards.»
- **Status:** implemented (2026-11-04: `test/analytics.test.ts` walks the client against a fake server (no key, on by default, the install once, an update, off drops everything, retries, crashes once and nothing that names, one active day, an unreadable shared file, another app's switch); copy check reports `8178a7f5` (en, no findings) and `3f537438` (ru, two suggestions on lists of three, kept: they are the facts); the notice and the switch are not yet walked in a built app, which needs a build with a key)
- **Coverage:** src/core/analytics.ts, src/electron/main.ts (usage-analytics), src/renderer/components/AnalyticsNotice.tsx, src/renderer/components/Settings.tsx, src/core/settings.ts, test/analytics.test.ts
- **Product:** unobserved

### SCN-092: See a session Fabric started for a board request
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-023; FD-137; Switchboard SB-247 (`switchboard dispatch`, the launch record's shape agreed on the board, thread a9672312); the operator, 2026-11-04 (relayed by Fabric's session 5d9bed98): sessions started on demand are shown in Dashboards, who started them, for which request and how they ended
- **Entry point:** the Sessions mode; a session's page (SCN-080), its launch fold; the agent's page, Activity tab
- **Preconditions:** Switchboard is installed and its launch history holds a launch with `launched_by.surface: fabric` (a board request no live session took, which Fabric handed to Switchboard)
- **Steps:**
  1. The person opens the Sessions mode -> the session's second line says "on a board request", its sidebar row "board request", and its page's header "Started by Fabric, {time}" (Switchboard ran it, Fabric asked for it)
  2. The person opens the agent in whose folder it ran, Activity tab -> above the events, "Board requests": one line per such session, newest first (at most ten), with the request, how it went and how long it ran, and Open session
  3. The person opens the session -> its launch fold says who started it ("by Fabric, for a board request no session took"), which request and thread (the first eight characters of each id), how it ended (exited with its code, stopped by Fabric, or stopped at its time limit) with the time, and how long it ran
- **Expected result:** the person sees that Fabric itself started this session, for which request, and how it ended, without opening the board or a terminal
- **Alt paths:** a record without a request id -> the Request line is not shown, and the agent's page says "request not named"; a request without a thread id -> the request alone; a session that ran in a folder no agent of this Mac uses -> listed in the Sessions mode only; an agent with no such session -> no Board requests section; an exit Switchboard did not wait for itself (no `exit_code`, SB-247) -> "exited, {time}" with no code; an end of a kind the app does not know -> no Ended line; a record in the older form (`ended` as a word) -> read as before
- **UI elements:** the session's second line in the list; the launch fold (Started, Request, Ended, Ran); the agent's Board requests section (title, note, one line per session, Open session)
- **States covered:** success, empty
- **Errors & recovery:** an id that is not an id (spaces, too long) is dropped and the line it would fill is not shown; the record carries ids only, never the request's text
- **Copy:**
  - "on a board request" / «по запросу с доски»; "board request" / «с доски» (sidebar); "Started by Fabric, {time}" / «Запущена Fabric, {time}» (header)
  - "by Fabric, for a board request no session took" / «Fabric, по запросу с доски, который не взяла ни одна сессия»
  - "Request" / «Запрос»; "{request} · thread {thread}" / «{request} · тред {thread}»
  - "exited with code {code}, {time}" / «вышла с кодом {code}, {time}»; "exited, {time}" / «завершилась, {time}» (copy check `55f26cda`, `9c9d370a`); "stopped by Fabric, {time}" / «остановлена Fabric, {time}»; "stopped at its time limit, {time}" / «остановлена по лимиту времени, {time}»
  - "Ran" / «Работала»
  - "Board requests" / «Запросы с доски»; "Sessions Fabric started in this agent's folder for a board request no session took." / «Сессии, которые Fabric запустила в папке этого агента по запросу с доски, когда его не взяла ни одна сессия.»; "request not named" / «запрос не назван»; "Open session" / «Открыть сессию»
- **Status:** implemented (2026-11-04: `test/dispatch.test.ts` reads a record in the agreed shape, a thin one, an unknown end and the older form, and walks the launch fold and the list line in both languages; copy check reports `217f5b0e` (en, no findings) and `7ef98a03` (ru, two suggestions kept: the digits are an id, and minutes use the app's existing duration string); the agent's page: `test/dispatch.test.ts` lists only its own folder's board-request sessions, `test/sessions.test.ts` *FD-137* matches a session to the agent whose console folder it ran in; copy check reports `d5d7f42f`, `bd98b45b` (en) and `78b4f723`, `80a4bb21` (ru), no findings; `test/e2e/dispatch.test.ts` walks it in the built app against a Switchboard fake: the agent's Board requests line, Open session, the header, the sidebar and the unfolded launch fold; not yet seen on a real record: Switchboard's SB-247 is not in its main yet)
- **Coverage:** src/core/switchboard.ts, src/core/sessions.ts, src/core/sessions-view.ts, src/core/i18n.ts, src/electron/console.ts (dispatch-agent), src/renderer/components/ServiceView.tsx (dispatch-agent-page), src/renderer/App.tsx, test/dispatch.test.ts, test/sessions.test.ts, test/e2e/dispatch.test.ts
- **Product:** unobserved


### SCN-093: Hear of a new version with automatic updates off
- **Persona:** P-01
- **Feature:** updates
- **Traces:** ST-008; FD-143; LC-16; the operator, 2026-11-04 (relayed by Fabric's session 5d9bed98, board thread `f7758225`): every product updates itself by default; it can be turned off in Settings, and off still tells the person a new version is out
- **Entry point:** a notification; Settings → Updates; the folded sidebar's update entry
- **Preconditions:** Settings → *Install updates automatically* is off (the `auto-update` file says `off`); a newer release is published
- **Steps:**
  1. The app reads the update feed on its usual cadence -> a newer version is out: one notification per version, "Fabric Dashboards {version} is out", "Automatic updates are off. Click to update."; nothing is downloaded
  2. Settings → Updates and the folded sidebar say "Version {version} is out" with "Update to {version}"
  3. The person presses Update to {version}, or clicks the notification -> the update is downloaded and verified as with the switch on, and "Restart to update" follows (SCN-022)
- **Expected result:** the person who turned automatic updates off still learns of every new version, and decides when it installs
- **Alt paths:** the feed cannot be read -> nothing changes, an announced version stays announced; a still newer version is published -> it is announced once more; the person turns automatic updates on -> the usual update takes over; the installed copy is already the newest -> no line, no notification
- **UI elements:** the notification; the "Update to {version}" line in Settings → Updates and in the sidebar
- **States covered:** success, empty
- **Errors & recovery:** a download or a verification that fails after Update says why, as SCN-022 does, with Retry
- **Copy:**
  - "Fabric Dashboards {version} is out" / «Вышел Fabric Dashboards {version}»; "Automatic updates are off. Click to update." / «Автообновление выключено. Нажмите, чтобы обновить.»
  - "Version {version} is out" / «Вышла версия {version}»; "Update to {version}" / «Обновить до {version}» (the terminology's existing label)
  - Settings note, its last sentence: "Off: a new version is announced, and it installs only when you choose to update." / «Выключено: о новой версии приходит уведомление, а устанавливается она, только когда вы решите обновить.»
- **Status:** implemented (2026-11-04: `test/offer-when-off.test.ts`: with the switch off the timer only reads the feed, the person's Update runs the whole update, the main process tells once per version and its click is Update, the words in both languages; copy check reports `d220b8c0`, `5858d67b` (en, no findings) and `e35aa7ba`, `56c29655` (ru: one suggestion on the final period, kept: in the app it closes the last of several sentences); not yet seen on a released copy, which needs the release after this one)
- **Coverage:** src/core/version.ts (mayPeek), src/electron/updater.ts (offer-when-off), src/electron/main.ts, src/renderer/App.tsx, src/renderer/components/Settings.tsx, src/core/i18n.ts, test/offer-when-off.test.ts
- **Product:** unobserved

### SCN-101: Start a new session in a folder
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-019; FD-191; FD-206 (the operator, 2026-11-11, board thread `000ae765`: Switchboard's remote launch released, "the machine choice in New session can be built"); the operator, 2026-11-09, this repository's session `0edbdfdf` (an organization member's report: a session could be opened only from an agent's console, "and if there is no agent yet?"): New session in the Sessions mode, the coding agent chosen from those installed, the permission mode as a box ticked by default, a folder only, the projects folder by default and any other through the picker; operator rule 2026-10-09 (a folder through the system picker only, an isolated box in the same dialog)
- **Entry point:** the Sessions mode: New session in the sidebar under All sessions, and on the All sessions page's header; an agent, MCP `session_new`
- **Preconditions:** at least one coding agent is installed
- **Steps:**
  1. The person presses New session -> a dialog: the coding agents installed here as choices (the last one used chosen, else Claude Code), the folder (the last one chosen, else the folder that holds most agents' folders, else a usual projects folder such as `~/DATA` or `~/Projects`, else the home folder) with Change…, "Run without permission prompts" ticked, "Isolated session" as it was last chosen (not ticked the first time; MCP `session_new` leaves it off unless it asks for it)
  2. The person presses Change… -> the system folder picker opens on the folder shown; the folder chosen replaces it (nothing is typed)
  3. The person presses Start session -> the session's page opens with its console running the chosen coding agent in that folder; the Sessions list shows it under Running, like any console of this app
  4. FD-206: Switchboard knows other machines (`switchboard --json targets`) and can start a session there (`launch --target`, Switchboard 0.7.53, SB-332) -> the dialog shows Machine: "This Mac" and each machine as ssh knows it. The person picks one -> the app asks that machine over SSH for its home and its projects under `~/DATA` (projects by name, service folders such as `_worktrees` last) and the folder becomes a list of them with "Home folder" at the end (chosen, never typed), the coding agents narrow to Claude Code and Codex, and one line says "The session runs on {machine} through that machine's Switchboard and account. Only Claude Code and Codex start there." Start session runs `switchboard launch --target <machine> --provider … --working-directory <folder there> --in-place` in the console here; the session's label ends with "· {machine}", its row and MCP `consoles` name the folder there, and Continue goes there again. The dialog offers the last machine and its folder next time; MCP `session_new` takes `machine` with `folder` (a path there). FD-210: this Mac's free disk does not hold such a session back (it writes to that machine's disk; the six-session cap and swap still apply), a machine may be named by any of Switchboard's names for it (`aliases`), and when no account there can run it (`launch --target` exits 3, `no-route`) the page says "{machine} has no account that can run a session in this folder. Choose another folder, or add an account to its group in that machine's Switchboard." / «На {machine} для этой папки нет аккаунта, на котором можно запустить сессию. Выберите другую папку или добавьте аккаунт в её группу в Switchboard той машины.» (copy checks `d54e839c`, `6b727951`, no findings)
  5. The person ends it and comes back later -> its row is under Ended with Continue, which starts it again with the same coding agent, folder, permission and isolation
- **Expected result:** a coding session runs in any folder without an agent to hang it on, in two clicks when the defaults suit
- **Alt paths:** the chosen coding agent has no verified switch to run without prompts -> the box is off and greyed with "{agent} has no such switch, so it asks as usual."; Switchboard is not installed, cannot launch in place, or the coding agent is neither Claude Code nor Codex -> "Isolated session" is greyed with the one-line reason; isolated ticked -> Switchboard launches it on the folder's account in that account's own home (`--mode isolated`), never quietly as an ordinary session; no coding agent installed -> the dialog says which it looked for, and Start is off; an agent calls `session_new` -> the same start, every choice it leaves out is the dialog's default, and the answer gives the session's link
- **UI elements:** New session (sidebar item, page header button), the dialog: Coding agent (choices), Machine (FD-206, only when Switchboard can start a session elsewhere), Folder with Change… (on another machine a list of its projects), Run without permission prompts, Isolated session, Cancel, Start session
- **States covered:** loading, success, empty, error
- **Errors & recovery:** the folder was removed -> "This folder no longer exists. Choose another."; the coding agent was uninstalled -> "This coding agent is no longer installed. Choose another."; the computer cannot carry another session (disk, six sessions, swap) -> the console's own sentence (SCN-048 LC-17); each keeps the dialog open with the choices made; FD-206: the machine does not answer -> "{machine} does not answer over SSH, so its folders cannot be read. Try again later." and Start stays off; it has no projects -> "{machine} has no projects in ~/DATA, so the session opens in its home folder."; Switchboard no longer lists it -> "Switchboard no longer lists this machine. Choose another one."; a coding agent other than Claude Code or Codex asked through MCP -> "On another machine only Claude Code and Codex start."; Switchboard here missing or older than 0.7.53 -> "Starting a session on another machine needs Switchboard on this Mac." / "Switchboard on this Mac cannot start a session on another machine yet. Update it to 0.7.53 or later."; anything the other machine says (its sign-in, a missing folder) shows in the console
- **Copy:**
  - FD-206: "Machine" / «Машина»; "This Mac" / «Этот Mac» (off macOS "This computer" / «Этот компьютер»); "Home folder" / «Домашняя папка»; "Reading the folders on {machine}…" / «Читаю папки на {machine}…»; "{machine} does not answer over SSH, so its folders cannot be read. Try again later." / «{machine} не отвечает по SSH, поэтому папки на ней не прочитать. Попробуйте позже.»; "{machine} has no projects in ~/DATA, so the session opens in its home folder." / «На {machine} нет проектов в ~/DATA, сессия откроется в домашней папке.»; "The session runs on {machine} through that machine's Switchboard and account. Only Claude Code and Codex start there." / «Сессия работает на {machine} через Switchboard той машины и с её аккаунтом. Там запускаются только Claude Code и Codex.»; "On another machine only Claude Code and Codex start." / «На другой машине запускаются только Claude Code и Codex.»; "Switchboard on this Mac cannot start a session on another machine yet. Update it to 0.7.53 or later." / «Switchboard на этом Mac пока не умеет запускать сессию на другой машине. Обновите его до 0.7.53 или новее.»; "Starting a session on another machine needs Switchboard on this Mac." / «Чтобы запустить сессию на другой машине, на этом Mac нужен Switchboard.»; "Switchboard no longer lists this machine. Choose another one." / «Switchboard больше не знает эту машину. Выберите другую.»
  - "New session" / «Новая сессия»; "A session of a coding agent in any folder, not tied to an agent. It is listed with your other sessions." / «Сессия агента для кода в любой папке, без привязки к агенту. Она появится в списке сессий.»
  - "Coding agent" / «Агент для кода»; "Folder" / «Папка»; "Change…" / «Изменить…»
  - "Run without permission prompts" / «Без запросов разрешений»; "The coding agent runs each command without stopping to ask you first." / «Агент для кода выполняет команды, не останавливаясь, чтобы спросить вас.»; "{agent} has no such switch, so it asks as usual." / «У {agent} нет такого переключателя, поэтому он спрашивает как обычно.»
  - "Isolated session" / «Изолированная сессия»; "Runs on a Switchboard account's own home, apart from your usual sign-in." / «Работает в собственной папке аккаунта Switchboard, отдельно от вашего обычного входа.»; "Needs Fabric Switchboard." / «Нужен Fabric Switchboard.»; "Needs a newer Fabric Switchboard." / «Нужна более новая версия Fabric Switchboard.»; "Switchboard isolates only Claude Code and Codex sessions." / «Switchboard изолирует только сессии Claude Code и Codex.»
  - "Start session" / «Начать сессию»; "Starting…" / «Запускается…»; "The session did not start. Try again." / «Сессия не запустилась. Попробуйте ещё раз.»; "This folder no longer exists. Choose another." / «Этой папки больше нет. Выберите другую.»; "This coding agent is no longer installed. Choose another." / «Этот агент для кода больше не установлен. Выберите другого.»; "The coding agents could not be read: {detail}" / «Не удалось прочитать список агентов для кода: {detail}»
- **Status:** implemented (2026-11-12: FD-206: `test/target-session.test.ts` (7 tests: the targets read and filtered, the projects probe and its answer, the launch argv, the start there with its row folder and Continue, the refusals, the dialog's and the channel's machine, the machine kept in settings); the projects probe ran live against Switchboard's four targets on the Studio (118, 61, 7 and 118 projects); copy checks `1e183e78`, `aeda690a`, `975224b1`, `9d5cf46b`, `2e74317f`, `7dbc1605`, `8646d02a`, `28dd3dda`, `51aabb68`, `7c207db2`, `93c1678c`, `369ed997`, `e1b6d986`, `da918552` (ru: final full stop and `DATA` capitals suggestions kept) and `2fe9c5a5` to `15e8c208` (en, 14 reports, no findings). 2026-11-09: `test/new-session.test.ts` (15 tests: keys, projects folder, isolation, planStart, the channel's `session.new`, the start, Continue keeping the choices, the refusals, `session_started`); copy check reports `a5d3255a`, `fc72ec24`, `80fd401e`, `5ea46063`, `70fdb920`, `7ffb4bd5`, `5c96a390`, `a5e34167`, `dcd96f12`, `110bce85`, `0c3922cb`, `aa339d59`, `d5642f8a`, `aef79220`, `8d5b7acf`, `02b50d76`, `33b45c07`, `7e768098`, `cf0a352b`, `b3217f2b`, `d1c32086`, `96bc9e0c` (en, no findings) and `5311537e`, `0048c334`, `4a06c2ff`, `ced4d270`, `f4419e5e`, `7ff0445c`, `23d5e5c2`, `ab45e37c`, `8b246697`, `158c9c9c`, `fc9c3413`, `bb8eaf79`, `add10723`, `2015e45a`, `2918dab7`, `3c1cf234`, `c7d8a566`, `1a949a5a`, `35c97fc2`, `4f79ddec`, `9be2c8eb`, `0f59f9dd` (ru: seven suggestions to drop the final full stop of a hint, kept: each is a whole sentence, voice rule 2))
- **Coverage:** src/core/target-session.ts (targetsOf, projectsProbeArgv, projectsOf, targetLaunchArgv), src/electron/console.ts (target-session-host: startOnMachine, machineFolders), src/core/new-session.ts, src/core/consoles.ts (planStart bypass, isolated), src/electron/console.ts (startNew), src/renderer/components/NewSessionDialog.tsx, src/renderer/components/Navigation.tsx (SessionsNav), src/renderer/App.tsx, src/core/console-channel.ts (session.new), src/mcp/tools.ts (sessionNew), test/new-session.test.ts
- **Product:** unobserved

### SCN-102: Start a new agent from the agent list
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-019, ST-022; FD-191; the operator, 2026-11-09, this repository's session `0edbdfdf`: "where the agents are, a button to create a new agent: we open a Claude session and describe it"
- **Entry point:** Overview's header (the agent list): New agent; an agent, MCP `session_new` with kind agent
- **Preconditions:** at least one coding agent is installed
- **Steps:**
  1. The person presses New agent -> the same dialog as SCN-101, titled New agent, with "Your coding agent asks what the new agent should do, builds it in this folder and sets it to run by itself, so it shows in this list."
  2. The person presses Create with coding agent -> the session's page opens; the coding agent starts with the brief to create one agent (written beside its console, never in the person's folder) and this app's MCP server, and asks its first question: what the agent should do
  3. The coding agent builds it (the `creating-fabric-agents` skill, or `adapting-projects-to-fabric` for a project the person names) in the projects folder and makes it run by itself (`building-fabric-services`) -> the new agent appears in the agent list, which the coding agent checks with `list_services`
- **Expected result:** a person with an idea for an agent starts from the agent list, answers questions, and ends with the agent in the list
- **Alt paths:** as SCN-101 (no switch, no Switchboard, no coding agent installed, an agent's call); the Fabric skills are not installed -> the brief tells the coding agent to say so and install the adapter as the setup does
- **UI elements:** New agent (Overview's header), the dialog of SCN-101 with Create with coding agent
- **States covered:** loading, success, empty, error
- **Errors & recovery:** as SCN-101
- **Copy:**
  - "New agent" / «Новый агент»; "Your coding agent asks what the new agent should do, builds it in this folder and sets it to run by itself, so it shows in this list." / «Агент для кода спросит, что должен делать новый агент, соберёт его в этой папке и настроит, чтобы он работал сам и появился в этом списке.»
  - "Create with coding agent" / «Создать с агентом для кода»
- **Status:** implemented (2026-11-09: `test/new-session.test.ts` *FD-191 (SCN-102)*: the brief names the folder, the skills and the proof, 0600, the runtime's arguments; New agent starts with it; copy checks as SCN-101)
- **Coverage:** src/core/new-session.ts (newAgentMarkdown, prepareNewAgent), src/electron/console.ts (pack), src/renderer/App.tsx, test/new-session.test.ts
- **Product:** unobserved

### SCN-103: Edit an agent on the machine it runs on
- **Persona:** P-01
- **Feature:** console
- **Traces:** ST-004, ST-019; FD-199; the operator, 2026-11-11, this repository's session `a1bc2cc0`: "connect to remote agents you have access to, and if you can edit them, start from the code here and run the editing there"; FD-132 (the placement record), FD-179 and FD-196 (the port forward that brings a moved agent here)
- **Entry point:** the console of an agent the placement record puts on another machine (SCN-089); an agent, MCP `console_new`
- **Preconditions:** Observatory's placement record puts the agent on another machine; a launchd job of this user forwards the agent's port from that machine over ssh (`ssh -N -L <port>:127.0.0.1:<port> <user>@<host>` with its key), as the move left it; the coding agent is installed there and signed in
- **Steps:**
  1. The person opens the agent's console -> its header shows the folder and a chip "Runs on {destination}" (the ssh destination of the forward), with the hint "This agent is placed on another machine, so its coding agent runs there, in the same folder."
  2. The person presses New session -> the app asks the other machine which folder it has (FD-203): the console's folder under that machine's home (`~/DATA/agent` here is `~/DATA/agent` there, whatever the user), else the agent's repository checkout under that home's projects folder (`~/DATA/<repository>`, as the move lays it out; a worktree of this Mac is not there). Then it runs `ssh -t` to that destination with the forward's key options, enters the folder found and starts the chosen coding agent through a login shell (FD-210: this Mac's free disk is not asked, the session writes there); the session's label ends with "· {destination}", and the Sessions row and MCP `consoles` name the folder it opened in there (FD-204)
  3. The person edits, commits and pushes there; Stop, Continue and the idle close (LC-18) work as for any console; Open in Terminal opens the same session on that machine in Terminal
  4. Before a session starts, the app asks the other machine once whether this key opens a shell there (`ssh -T` running one `echo`; remembered five minutes when it does, thirty seconds otherwise) -> a key that opens a shell edits; a key that reaches only the agent's port (a forwarding-only key, a forced command) is view only: nothing starts, the header shows a "View only" chip and the console says "Your key opens only this agent's port on the other machine, so you can view and use the agent but not edit it there." (FD-200)
  5. FD-205: the person picks "Runs on this Mac" in the header's place picker (instead of "Runs on {destination}"), or an agent calls MCP `console_choose` with `where: here` -> the agent itself stays where it is placed, and its console runs on this Mac like an agent placed here: in the folder here (the checkout found here, or the one chosen with Other…), with this Mac's coding agent and sign-in, and its free-space check is this Mac's. The choice is saved per agent and kept through a runtime or folder change; "Runs on {destination}" (MCP `where: there`) goes back. Used when the other machine cannot run a session: its account has no checkout or no coding agent, or the key there only forwards the port
  6. The person, or an agent through MCP `doctor` / `update`, runs the agent's Doctor or Update -> it runs on that machine through the same route, only with a key that opens a shell, as that machine's own descriptor declares it (another release than this Mac's copy may run there), and never on this Mac's stale copy; a view-only key: "{name} runs on {machine}, and your key opens no shell there, so {command} cannot run there from this computer."; no forward: "{name} runs on {machine}, and no port forward on this computer says how to reach it, so {command} cannot run there." (FD-200)
- **Expected result:** a person on this Mac edits a moved agent where it runs, from its own console, with no new setting: the forward the move made is the route; or, by one choice, runs that agent's console here
- **Alt paths:** the record names the forward (`forward`, OBS-480) -> that job's route is used, else the job that brings the agent's port here; the folder does not exist on this Mac -> it is still started there (only the other machine's folder matters); the console's folder exists only on this Mac (a worktree here) -> the session opens in the repository's checkout the other machine has (FD-203); an agent placed here -> the console runs on this Mac as before, with no place picker (MCP `where` answers not-placed-elsewhere); "Runs on this Mac" with no folder here -> the console asks for a folder, as for an agent placed here (FD-205)
- **UI elements:** the console header's place picker (FD-205; it replaced the chip), the session label
- **States covered:** success, error
- **Errors & recovery:** the other machine has neither the console's folder nor the repository's checkout -> nothing starts, and the console says "The other machine has neither this folder nor the agent's repository in ~/DATA, so a session cannot open there. Press Other… and choose the folder it has, or run the session on this Mac." (FD-203, FD-205; before, `cd` failed there and the session ended with code 1); the other machine refuses the key -> "The other machine refuses this computer's key, so a session cannot open there."; it does not answer over SSH -> "The other machine does not answer over SSH now, so a session cannot open there. Try again later." (FD-200); no forward reaches the machine -> nothing starts, and the console and a refused Continue say "This agent runs on another machine, and no port forward on this computer says how to reach it, so a session cannot open there."; the other machine refuses the key or does not answer -> ssh's own words show in the console and the session ends (no prompt is ever shown: `BatchMode=yes`); the coding agent is missing there -> the remote shell's own error shows in the console
- **Copy:**
  - "Runs on {destination}" / «Работает на {destination}»
  - "This agent is placed on another machine, so its coding agent runs there, in the same folder." / «Агент размещён на другой машине, поэтому агент для кода работает там, в той же папке.»
  - "This agent runs on another machine, and no port forward on this computer says how to reach it, so a session cannot open there." / «Этот агент работает на другой машине, а на этом компьютере нет проброса порта, по которому до неё можно дойти, поэтому сессия там не откроется.»
  - FD-203, FD-205: "The other machine has neither this folder nor the agent's repository in ~/DATA, so a session cannot open there. Press Other… and choose the folder it has, or run the session on this Mac." / «На другой машине нет ни этой папки, ни репозитория агента в ~/DATA, поэтому сессия там не откроется. Выберите папку, которая там есть, кнопкой «Другая папка…» или запустите сессию на этом Mac.»
  - FD-205: "Where the session runs" / «Где работает сессия»; "Runs on this computer" / «Работает на этом компьютере» (on macOS "Runs on this Mac" / «Работает на этом Mac»); "Runs on the agent's machine" / «Работает на машине агента» (no forward named); "The agent itself stays on its machine; this session runs here, in the folder on this computer." / «Сам агент остаётся на своей машине, а эта сессия работает здесь, в папке на этом компьютере.» (on macOS "this Mac" / «этом Mac»; the no-folder sentence too)
  - FD-200: "View only" / «Только просмотр»; "Your key opens only this agent's port on the other machine, so you can view and use the agent but not edit it there." / «Ваш ключ открывает на другой машине только порт агента: смотреть и пользоваться агентом можно, а править его там нельзя.»; "The other machine refuses this computer's key, so a session cannot open there." / «Другая машина не принимает ключ этого компьютера, поэтому сессия там не откроется.»; "The other machine does not answer over SSH now, so a session cannot open there. Try again later." / «Другая машина сейчас не отвечает по SSH, поэтому сессия там не откроется. Попробуйте позже.»
  - FD-200: "{name} runs on {machine}, and your key opens no shell there, so {command} cannot run there from this computer." / «{name} работает на машине {machine}, а ваш ключ не открывает там командную строку, поэтому {command} отсюда там не запустится.»; "{name} runs on {machine}, and no port forward on this computer says how to reach it, so {command} cannot run there." / «{name} работает на машине {machine}, а на этом компьютере нет проброса порта, по которому до неё можно дойти, поэтому {command} там не запустится.»
- **Status:** implemented (2026-11-11: FD-205 the same day: `test/remote-console.test.ts` (4 tests: run here starts on this Mac in the folder here with this Mac's admission and back, run here with no folder here refused and nothing to choose for an agent placed here, the choice kept through a runtime or folder write and dropped by there, the channel's `where`); the case it was made for: PassionCode's PM agent on the Studio runs in a space account with no checkout and no coding agent (probed: a shell opens, `~/DATA/passioncode-pm-agent` absent, no `claude`), so its console could not run there; copy checks `b64e4a79`, `5e27ae97`, `bcda7191`, `62f8d5da`, `e100203d` (ru: the no-final-full-stop and `DATA` capitals suggestions kept) and `aa95d7f7`, `445b6e81`, `41eec536`, `fc516a21`, `366d9c12` (en, no findings); the wording off macOS `c5f40e42`, `1ba9f044`, `41e3146a` (ru, the same suggestions kept) and `10ce1b18`, `f82c1c52`, `c9b5c2e0` (en, no findings). FD-203 the same day: `test/remote-console.test.ts` (4 tests: the candidates, the folder probe and its answer, a worktree of this Mac replaced by the checkout there, the refusal when there is none); the probe ran live against the Studio for a moved agent: its worktree here is not there, its checkout under `~/DATA` is, and a folder absent there answered none; copy checks `fe95b777` (en, no findings) and `7bd50c0a` (ru: the capitals of `DATA` kept, a folder's name). FD-200 the same day: `test/remote-console.test.ts` (15 tests: probe answers, the console refused for a view-only key, Doctor and Update placed here, there or refused, the other machine's own command); the access matrix read live against the Studio (the operator key opens a shell in five spaces and is refused in a sixth; an organization's key opens only its own space), and a moved agent's Doctor ran on the Studio through the route as its descriptor there declares it (exit 0); copy checks `fff7be30`, `34958a82`, `fac8d03c`, `4bb3aad1`, `6f5465b7`, `ebfa1b4f` (en, no findings) and `2d3942f6`, `a82a6759`, `91f27b76`, `467bb832`, `68c2e25e`, `2ff8d894` (ru: the no-final-full-stop suggestion kept). FD-199: `test/remote-console.test.ts` (10 tests: the forward's route and ports, the record's forward first, the remote line under the remote home, the ssh argv, reading launchd jobs, the start on the other machine, the refusal, an agent placed here unchanged, the refused Continue's sentence); live against the Studio: the argv the console builds ran `claude --version` (2.1.319) in `sshlg` and `assessment`, in the agent's folder; copy check reports `613d9dd5`, `3421ae8c`, `4482fe7b` (en, no findings) and `40222fa0`, `3f541ccb`, `3fe54dbd` (ru: two suggestions to drop the final full stop, kept, voice rule 2))
- **Coverage:** src/core/settings.ts (patchConsoles), src/core/console-channel.ts (console.choose), src/mcp/server.ts and src/mcp/tools.ts (console_choose), src/core/remote-console.ts (remote-access: accessOf, placeCommand, remoteCommandArgv; remote-folder: remoteFolderCandidates, folderProbeArgv, folderOf), src/core/remote-words.ts, src/core/monitor.ts (command), src/mcp/tools.ts (command), src/electron/console.ts (remote-console-host, remoteAccess, start, openTerminal), src/core/monitor.ts (placedElsewhere), src/renderer/components/ConsolePanel.tsx, src/renderer/components/Sessions.tsx (failText), test/remote-console.test.ts
- **Product:** unobserved

### SCN-104: Open here a session Switchboard's session host holds
- **Persona:** P-01
- **Feature:** sessions
- **Traces:** ST-019; FD-211 (Switchboard's board request `22ccd485`, thread `b401662f`, the operator's words in its session `59745113`: sessions cannot be opened across our apps); Switchboard's SB-342 H-1 (0.7.63: `launch --hosted`, `switchboard attach`, `sessions` marks `attachable`) and H-1b (0.7.64: Terminal windows Switchboard opens run through a host)
- **Entry point:** the Sessions page, a running row of a session Switchboard started (in Terminal, or by `launch --in-place --hosted`); an agent, MCP `session_action` with `act: attach`
- **Preconditions:** Switchboard 0.7.63 or later; its `sessions` list marks the session `attachable` with its launch id
- **Steps:**
  1. The person opens Sessions -> the row of a session a host holds offers "Open here" beside Show in Finder
  2. The person presses Open here -> a console of its own opens and runs `switchboard attach <launch_id>`: the same session the Terminal window shows, typed into from either; the row becomes that console's, with no End (closing the view would not end the session), and a second Open here finds it open
  3. The console reads "Switchboard runs this session; this console shows it. Closing the console leaves the session running." -> the person closes it without a question, and the row offers Open here again
  4. The session ends where it runs -> the console shows how it ended, and the row is Switchboard's ended row; nothing of this app's is kept as a session that ended here
  5. FD-211, 0.8.64: with a Switchboard that can end a hosted session (`sessions end`, 0.7.66), this app's own consoles start their session in its host too (`launch --in-place --hosted`) -> Stop (and End in Sessions) and the idle close end it there with `switchboard sessions end`, as before for the person; quitting or updating the app only closes the view, the quit question does not name it, and the session runs on in Switchboard's list
- **Expected result:** a session started in Terminal or another app is worked in here, and leaving the app (quit, update, close) never ends it
- **Alt paths:** no Switchboard here -> "Could not open this session here: no-switchboard"; six consoles run, or the swap is exhausted -> the refusal says so (LC-17; a view writes nothing to this Mac's disk, so free disk is not asked); the app quits while a view is open -> it is not named among the sessions the quit ends, and the session runs on
- **UI elements:** Open here on a Sessions row; the console's one-line note
- **States covered:** success, error
- **Errors & recovery:** `switchboard attach` fails (the host is gone) -> the console shows its exit, the row reads as Switchboard lists it, and pressing Open here again is safe
- **Copy:**
  - "Open here" / «Открыть здесь»
  - "Could not open this session here: {reason}" / «Не удалось открыть эту сессию здесь: {reason}»
  - "Switchboard runs this session; this console shows it. Closing the console leaves the session running." / «Эту сессию ведёт Switchboard, консоль только показывает её. Если закрыть консоль, сессия продолжит работать.»
- **Status:** implemented (2026-11-12, 0.8.64: step 5, `test/hosted-console.test.ts` (5 tests); live: `switchboard sessions end` ended a hosted session in 0.5 s on this MacBook. 0.8.63: `test/sessions.test.ts` *FD-211* (3 tests); copy check reports `43a2631b`, `4b6eadf3`, `3746748f` (en), `0869a8b7`, `cbe35b12`, `6f29571d` (ru), no findings). Open here waits on Switchboard listing `attachable` in `sessions --all` (today only `--history` has it; asked on thread `b401662f`, message `748d91ca`)
- **Coverage:** src/core/switchboard.ts (allSessionsOf: `attachable`; launchFeatures: `hosted`; inPlaceArgv), src/core/consoles.ts (planStart `hosted`), src/core/sessions.ts (mergeSessions, attachOwnKey), src/electron/console.ts (attachSession, isView, recordEnd, endConsole, launchOf, runsOnWithoutApp, endAllForQuit), src/electron/main.ts (sessions.act, the quit question), src/mcp/server.ts, src/mcp/tools.ts, src/mcp/actions.ts (session_action `attach`), src/renderer/components/Sessions.tsx, src/renderer/components/ConsolePanel.tsx
- **Product:** unobserved

### SCN-105: Keep several agents open and move between them
- **Persona:** P-01
- **Feature:** layout
- **Traces:** ST-002; FD-220; the operator, 2026-11-13, this repository's session `a1bc2cc0`: «показывать агентов открытых к дашборду и возможность закрыть/свернуть/открыть»
- **Entry point:** the Agents mode, any page
- **Preconditions:** the person opened at least one agent's page
- **Steps:**
  1. The person opens an agent -> it joins a strip of open agents above the page, in the order they were opened (at most 12, remembered across launches; a thirteenth pushes out the oldest, whose dashboard is released as Close releases it, FD-228); each shows its state mark and name
  2. The person opens another agent -> both are in the strip, the one on show marked; one press on a name moves to that agent, its dashboard still loaded
  3. The person presses Fold on the agent on show -> Overview opens and the agent stays in the strip, its dashboard loaded
  4. The person presses Close on an agent -> it leaves the strip and its dashboard is released at once; if it was on show, its neighbour opens, else Overview
  5. The person moves along the strip from the keyboard: View → Next Open Agent (Ctrl+Tab) and Previous Open Agent (Ctrl+Shift+Tab) go round it, from Overview to its first or last agent, and Close Agent (Shift+Cmd+W; Ctrl+Shift+W elsewhere) closes the agent on show as its Close does (FD-227)
- **Expected result:** the agents in use are one press away, and closing one frees what it held
- **Alt paths:** an agent removed from this Mac leaves the strip by itself; more agents than fit: the strip scrolls, each keeps its name, and the agent on screen is kept in view (FD-223); the Sessions mode and the window filled by a dashboard (SCN-106) show no strip
- **UI elements:** the strip of open agents: name with state mark, Fold (on the agent on show), Close
- **States covered:** success, empty
- **Errors & recovery:** none; a name that no longer answers keeps its state mark and opens its page as any agent's
- **Copy:**
  - "Open agents" / «Открытые агенты» (the strip's label); "Fold {name} away; it stays open" / «Свернуть {name}, агент останется открытым»; "Close {name}" / «Закрыть {name}»
  - "Next Open Agent" / «Следующий открытый агент»; "Previous Open Agent" / «Предыдущий открытый агент»; "Close Agent" / «Закрыть агента» (the View menu, FD-227)
- **Status:** implemented (2026-11-13, 0.8.68: `test/parts.test.ts` *FD-220*; 0.8.71: the menu commands, `test/layout.test.ts` and `test/platform.test.ts` *FD-227*, copy check reports `1f952e98`, `7d0d360d`, `182df42d` (en), `0fa3eb81`, `4a747011`, `1c7475e6` (ru), no findings; 0.8.72: the oldest agent pushed out releases its dashboard, `test/layout.test.ts` *FD-228*; copy check reports `f0aa3911`, `6e2acd19`, `35578507` (en), `1ff81300`, `80f628ee`, `537ebc53` (ru), no findings; seen on the built app with the kit's sample agents)
- **Coverage:** src/renderer/components/OpenAgents.tsx, src/renderer/App.tsx (tabs, closeTab, tabCommandRef), src/core/layout.ts (tabStep, addTab, MAX_TABS), src/core/platform.ts (menuKeys nextAgent, previousAgent, closeAgent), src/core/settings.ts (mergeLayout `tabs`), src/electron/main.ts (`viewClose`, the View menu), src/electron/views.ts (`drop`)
- **Product:** unobserved

### SCN-106: Give an agent's dashboard or console the whole window
- **Persona:** P-01
- **Feature:** layout
- **Traces:** ST-002, ST-019; FD-220; the operator, 2026-11-13, this repository's session `a1bc2cc0`: «сделать возможность скрыть агентов слева и шапку дашборда чтобы он был на весь экран, консоль агента открывать на весь экран как окно агента а не попап»
- **Entry point:** an agent's page: the header's Fill the window button, View → Dashboard Fills the Window (Ctrl+Cmd+M; Ctrl+Shift+M elsewhere); the console's own button
- **Preconditions:** none
- **Steps:**
  1. The person presses Fill the window -> the agent list, the strip of open agents and the agent's header step aside; the dashboard keeps its own toolbar (back, forward, reload, home, address), which now moves the window and also holds the console and Show the agent list and header
  2. The person presses Show the agent list and header, the menu item again, or Esc while the window's page has the keyboard -> everything comes back; the choice is remembered across launches
  3. The person opens an agent's console -> it fills the area under the agent's header, as the agent's own window, with its controls at the top and no edge to drag
  4. The person presses Show the console as a panel -> it becomes the drawer over the dashboard, with its edge, as before; the choice is remembered, and Fill the window with the console brings it back
- **Expected result:** a dashboard or a console that needs the room gets all of it, with one press back
- **Alt paths:** a tab other than the dashboard keeps the header while the list is hidden, with the same button to bring it back; a session's page keeps its console as the page (SCN-080); the console opens under the dashboard's toolbar, never over it, and while the dashboard is opening, failed or declares none a bar with the agent's name keeps the console and the way back (FD-224)
- **UI elements:** Fill the window / Show the agent list and header (the header and, while filled, the toolbar), Console in the toolbar while filled, the console's Fill the window with the console / Show the console as a panel
- **States covered:** success
- **Errors & recovery:** none
- **Copy:**
  - "Dashboard Fills the Window" / «Дашборд на всё окно» (menu); "Fill the window with the dashboard" / «Развернуть дашборд на всё окно»; "Show the agent list and header" / «Вернуть список агентов и шапку»; "Fill the window with the console" / «Развернуть консоль на всё окно»; "Show the console as a panel" / «Показать консоль панелью»
- **Status:** implemented (2026-11-13, 0.8.68: `test/parts.test.ts` *FD-220*, `test/sidebar-manage.test.ts` *FD-121*; copy check reports `ce1de9a2`, `9345d320`, `930f80b3`, `ef799040` (en), `171b2822` (en), `5f5e84d3`, `99e6dbb4`, `cefe7e10`, `8019ef48`, `ea4d0c61` (ru), no findings; seen on the built app: the filled dashboard, the console filling the area)
- **Coverage:** src/renderer/App.tsx (focus, DashChromeContext, the drawer's `expand`), src/renderer/components/ServiceView.tsx (header and toolbar buttons), src/renderer/DrawerApp.tsx, src/renderer/components/ConsolePanel.tsx (expand), src/electron/drawer.ts, src/electron/main.ts (menu, layoutCommand), src/core/platform.ts (menuKeys.focus), src/renderer/styles/app.css (.app.focus)
- **Product:** unobserved
