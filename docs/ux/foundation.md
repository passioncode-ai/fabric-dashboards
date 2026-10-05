<!-- Managed with super-ux (ux-contract v4). The WHY layer: update when the understanding of users changes. -->

# Fabric Dashboards — foundation

Source of every entry: the operator's request and grill answers of 2026-09-28
(`docs/evidence/briefs/2026-09-28-brief.md`) and the harvest of nine local agents on
the operator's Mac (design §1, O1–O12). Nothing here has been observed with a second
person yet.

## 1. Personas

### P-01: The operator
One person running a studio of agents on one Mac: seven or more local services
(a planning board, a store publisher, an asset maker, Project Observatory, a copywriter, a browser runner, …),
each with its own dashboard, port and way of starting. Technical, works in Russian and
English, switches between many projects a day, and does not want to open a terminal or
hunt browser tabs to learn whether an agent is alive or what it did.
- **evidence_kind:** owner-belief
- **decision_status:** accepted
- **validation_status:** unvalidated
- **Status:** confirmed

## 2. Jobs to Be Done

### JTBD-01: Know at a glance
- **Statement:** When I sit down or come back to the Mac, I want to see which agents are running and whether any needs me, so I can decide in seconds where to spend attention.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: six dashboards, six health shapes, no single view; pull: one window that is always right; anxiety: a monitor that says "fine" while something is down; habit: opening a browser tab per agent
- **Success metric:** the operator learns the state of every service without opening any other app
- **evidence_kind:** owner-belief
- **decision_status:** accepted
- **validation_status:** unvalidated
- **Status:** confirmed

### JTBD-02: Fix a stuck agent without a terminal
- **Statement:** When an agent stopped answering or runs twice, I want to restart, stop or start it from one place, so I can get back to work without remembering launchctl.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: launchd labels and plists nobody remembers; pull: one button with a result; anxiety: making it worse, spawning copies; habit: `kill` and re-run by hand
- **Success metric:** a down or duplicated service is ready again within a minute, started only by launchd
- **evidence_kind:** owner-belief
- **decision_status:** accepted
- **validation_status:** unvalidated
- **Status:** confirmed

### JTBD-03: See what the agents did
- **Statement:** When agents work while I am away, I want one feed of what each of them did and what waits for me, so I can act on the important item and ignore the rest.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: every agent keeps its own log in its own shape; pull: one timeline with a link to the exact item; anxiety: missing the one approval that mattered; habit: scrolling each dashboard
- **Success metric:** the operator reaches the item behind a notification in one click
- **evidence_kind:** owner-belief
- **decision_status:** accepted
- **validation_status:** unvalidated
- **Status:** confirmed

### JTBD-04: Work in an agent's dashboard without the browser
- **Statement:** When I need to act inside one agent, I want its dashboard in the same window, already signed in, so I never search for the right tab or port.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: tabs, ports and sign-in links scattered; pull: one app, one view per agent; anxiety: a token leaking into a URL; habit: bookmarks per port
- **Success metric:** every dashboard opens inside the app, signed in, with no copy of it opened twice
- **evidence_kind:** owner-belief
- **decision_status:** accepted
- **validation_status:** unvalidated
- **Status:** confirmed

## 3. Customer journeys

### JRN-01: P-01 — a working day with the agents (JTBD-01, JTBD-02, JTBD-03, JTBD-04)
| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|-------|------------|------------|---------------|------|-------------|
| 1 | Install | installs Fabric Dashboards and opens it | first launch | 3 | does it find my agents by itself? | discovery with no setup |
| 2 | Glance | looks at the menu bar or the overview | tray, Overview | 4 | six tabs to check | one aggregate status |
| 3 | React | an agent is down or duplicated | notification, Needs attention | 2 | terminal, launchctl | one-button restart with a result |
| 4 | Catch up | reads what agents did overnight | Activity | 3 | six logs in six shapes | one feed, open at the item |
| 5 | Act | approves or edits inside an agent | service view | 4 | finding the tab, signing in | embedded dashboard, signed in |
| 6 | Maintain | updates an agent or the app | update badge | 3 | stale code nobody noticed | update offered where it is visible |
| 7 | Tune | turns noise down | Settings | 3 | notifications for everything | per-service and quiet hours |

## 4. User stories

### ST-001: Find services without setup
- **Story:** As P-01, I want the app to find every installed service by itself, so that I never configure a list.
- **Traces:** JTBD-01, JRN-01/#1
- **Acceptance criteria:**
  - Given two services have descriptors, when the app starts, then both appear within 5 seconds with their state.
  - Given the app is running, when a descriptor is added or removed, then the list changes within 5 seconds without a restart.
  - Given no descriptor exists, when the app starts, then an empty state explains how a service joins.
- **Priority:** must
- **Status:** proposed

### ST-002: One view of every service and what needs me
- **Story:** As P-01, I want an overview of all services with a needs-attention list, so that I see problems first.
- **Traces:** JTBD-01, JRN-01/#2
- **Acceptance criteria:**
  - Given one service is down and one degraded, when the overview is shown, then Needs attention lists both above the cards with the reason and an action.
  - Given every service is ready, when the overview is shown, then Needs attention is hidden and each card shows version, uptime, tiles and the latest event.
- **Priority:** must
- **Status:** proposed

### ST-003: Restart, stop and start through launchd
- **Story:** As P-01, I want to restart, stop and start a service from the app, so that I never use a terminal and never create a second copy.
- **Traces:** JTBD-02, JRN-01/#3
- **Acceptance criteria:**
  - Given a service is down, when I choose Restart, then the app runs launchd's restart and shows ready with a new pid, or says it did not come back within 40 s and offers the log.
  - Given I stop a service, when I log out and back in, then it stays off until I start it.
- **Priority:** must
- **Status:** proposed

### ST-004: Say plainly when something is wrong on a port
- **Story:** As P-01, I want duplicates, foreign programs and port conflicts named, so that I know what to fix.
- **Traces:** JTBD-02, JRN-01/#3
- **Acceptance criteria:**
  - Given the answering pid differs from launchd's, when the app probes, then the service shows "Two copies" with Restart.
  - Given another program answers on the port, when the app probes, then the service shows which program answers and the token is never sent to it.
- **Priority:** must
- **Status:** proposed

### ST-005: Dashboards inside the app, signed in
- **Story:** As P-01, I want each service's dashboard inside the app and signed in, so that I stop hunting tabs.
- **Traces:** JTBD-04, JRN-01/#5
- **Acceptance criteria:**
  - Given a service declares a login, when I open it, then its dashboard appears signed in and no token appears in any URL.
  - Given I switch away and back, when I return, then the same view is there, not a reloaded copy.
- **Priority:** must
- **Status:** proposed

### ST-006: One activity feed across agents
- **Story:** As P-01, I want one feed of every service's events, so that I catch up in one place.
- **Traces:** JTBD-03, JRN-01/#4
- **Acceptance criteria:**
  - Given three services published events, when I open Activity, then events are merged newest first with the service named, filterable by service and level.
  - Given an event has a link, when I choose it, then the service's dashboard opens at that item.
- **Priority:** must
- **Status:** proposed

### ST-007: Notifications that open the exact item
- **Story:** As P-01, I want a notification when a service goes down or an event asks for me, so that I react without watching.
- **Traces:** JTBD-03, JRN-01/#3
- **Acceptance criteria:**
  - Given a service has not answered three probes in a row and a probe still fails after 60 s of silence, when notifications are on, then one notification says so; when it returns, one says it is back. Given it answers again before that, then no notification is shown, neither down nor back.
  - Given quiet hours are active, when an event would notify, then no notification is shown and the event still appears in Activity.
- **Priority:** should
- **Status:** proposed

### ST-008: Updates where they are visible
- **Story:** As P-01, I want to see when a service or the app has an update and apply it from the app, so that nothing runs stale.
- **Traces:** JTBD-01, JRN-01/#6
- **Acceptance criteria:**
  - Given a service reports an available update and declares an update command, when I choose Update, then the command runs and its output is shown.
  - Given a newer app release exists, when it is downloaded, then the app offers Restart to update and installs on quit otherwise.
- **Priority:** should
- **Status:** proposed

### ST-009: Glance from the menu bar
- **Story:** As P-01, I want the menu bar icon to show whether everything is fine, so that I know without opening a window.
- **Traces:** JTBD-01, JRN-01/#2
- **Acceptance criteria:**
  - Given one service is down, when I look at the menu bar, then the icon shows the problem state and the menu lists it first.
- **Priority:** should
- **Status:** proposed

### ST-010: Settings that turn the noise down
- **Story:** As P-01, I want to choose launch at login, notifications per service and quiet hours, so that the app fits my day.
- **Traces:** JTBD-03, JRN-01/#7
- **Acceptance criteria:**
  - Given I turn notifications off for one service, when it goes down, then no notification appears and Needs attention still lists it.
- **Priority:** should
- **Status:** proposed

### ST-011: A link from an agent opens the exact page here
- **Story:** As P-01, I want a link an agent hands me to open that service's page inside the app, signed in, so that I watch the work it started without hunting for a port.
- **Traces:** JTBD-04, JRN-01/#5
- **Acceptance criteria:**
  - Given the app is installed and an agent (or Fabric's "Open dashboard") hands me `fabric-dashboards://service/<id.instance>?path=/…`, when I open it, then the service view opens at that path, signed in, whether the app was running or not.
  - Given the link names a service that is not installed or a path off its origin, when I open it, then the app says it cannot open it and why, and opens nothing.
- **Priority:** should
- **Status:** proposed

### ST-012: Agents use the same controls through MCP
- **Story:** As P-01, I want an agent to see the services, hand me their links and restart or update one through the app's own rules, so that it never runs launchctl by hand or starts a second copy.
- **Traces:** JTBD-02, JRN-01/#3
- **Acceptance criteria:**
  - Given an agent calls the `fabric-dashboards` MCP server, when it lists services, then it gets the same states the app shows, a deep link per service, and no token.
  - Given an agent restarts a service through it, when the service does not come back within 40 s, then the tool says so rather than reporting success.
- **Priority:** should
- **Status:** proposed

### ST-013: Online agents and dashboards sit beside the local ones
- **Story:** As P-01, I want an agent or dashboard that runs online (an `https` origin on a platform) to appear here beside my local services, signed in when I open it, so that I watch every agent I run in one place — local or not.
- **Traces:** JTBD-01, JTBD-04, JRN-01/#1, JRN-01/#5; Fabric Agent Contract DEC-0019
- **Acceptance criteria:**
  - Given a remote descriptor (`placement: "remote"`) in the services directory, when the app reads it, then the service appears in an **Online** group with its state, version and tiles, and offers no start, stop or restart.
  - Given I open an online service, when its dashboard loads, then I am signed in through a one-time code, as for a local service, and the page is its https origin.
  - Given the online service refuses the token, has a certificate the system does not trust, redirects, or stays silent for a minute, when the app shows it, then it is `down` with that reason in a sentence — never `foreign` for a refused token, never a redirect followed.
- **Priority:** should
- **Status:** proposed

### ST-014: One entry per agent, with its connections inside
- **Story:** As P-01, I want every instance of one agent — its main endpoint, a local projection, a read-only access point — to appear as one agent with its connections inside, and services without a dashboard to sit apart, so that the list reads as the agents I run, not as the endpoints they expose.
- **Traces:** JTBD-01, JTBD-04, JRN-01/#1, JRN-01/#5; ADR-0012; Fabric Agent Contract service.md (a second copy of a service is a second instance)
- **Acceptance criteria:**
  - Given `growth.default`, `growth.projection` and `growth.reader`, when the app lists services, then the sidebar and Overview show one Growth entry, and its page switches between the three instances, each with its own state.
  - Given the default instance is down, when I open the product, then the default instance opens with its down state; no other instance stands in for it.
  - Given a second instance is down while the default is ready, when I look at the sidebar, then the product shows ready with a mark that a connection needs attention, and Attention names the exact instance.
  - Given a service that answers without a dashboard surface, when the app lists services, then it is under Background.
  - Notifications, Activity, the tray, MCP, deep links and start/stop/restart keep acting on the exact instance.
- **Priority:** must
- **Status:** proposed

### ST-015: See what every agent spent, counted by the agent itself
- **Story:** As P-01, I want one page that shows what each agent spent today, this week and this month — and on which models — reported by the agents themselves, so that I know where the money goes without opening each provider's console.
- **Traces:** JTBD-01, JRN-01/#2; ADR-0013; Fabric Agent Contract DEC-0021
- **Acceptance criteria:**
  - Given agents that publish a usage report, when I open Spend, then I see totals for today, 7 days and 30 days, one row per agent with its budget, and a per-model breakdown on expanding a row.
  - Given some calls carry no price, when Spend shows a sum that includes them, then it reads «≥ $x», and a model with no priced call reads «unknown» — never $0.
  - Given an agent's report cannot be read, when Spend opens, then that agent is listed with the reason and the totals are lower bounds.
  - Given an agent publishes no report, then Spend names it as not reporting yet.
  - Usage reports are read only while Spend or Overview is shown (ADR-0014): when Spend opens, on Refresh, and at most once a minute while either page is on screen; one read serves both for 30 s. Nothing is read while the window is hidden: the last sums are shown instead.
- **Priority:** should
- **Status:** proposed

### ST-016: The main screen reads at a glance, and every dashboard page can be handed on
- **Story:** As P-01, I want Overview to tell me in one look what runs, what needs me and what was spent, and every embedded dashboard to have its own reload, history and copyable address, so that I steer my agents from one screen and can hand any page to an agent or a teammate.
- **Traces:** JTBD-01, JTBD-04, JRN-01/#2, JRN-01/#5; ADR-0014
- **Acceptance criteria:**
  - Given Overview, when it opens, then a strip shows agents ready, not answering, needing attention, spent today and in 30 days, each as one number and one label.
  - Given more than three problems, when I look at Needs attention, then three single-line rows show and "Show all" opens the rest.
  - Given an embedded dashboard, when I use its toolbar, then I can go back, forward, reload, go home, see the page's address, and copy either the address or a fabric-dashboards:// link to this page — never a login code.
- **Priority:** should
- **Status:** proposed

### ST-017: Nothing I set up is lost to an uninstall, and the app keeps itself current
- **Story:** As P-01, I want my settings, history, login item and MCP entry to survive uninstalling and reinstalling the app, and every copy to install new versions by itself, so that I never redo setup and never run a stale app.
- **Traces:** JTBD-03, JRN-01/#6, JRN-01/#7; ADR-0015
- **Acceptance criteria:**
  - Given I uninstall from Settings without ticking "Also delete my settings and activity history", when I install the app again, then my settings and history are there, and the login item and the MCP entry are back.
  - Given an update has downloaded and the window has been closed for ten minutes, when nothing the app started is running, then it installs and the app reopens in the menu bar, unless I turned "Install updates automatically" off.
  - Given the app runs outside Applications, when it checks for updates, then it says updates install only from Applications and offers to move itself.
- **Priority:** must
- **Status:** proposed

## Design tooling
- **Figma:** disabled
- **Figma file:** none — text-only design surface decided at intake (brief D-7); the PassionCode.ai design system tokens are vendored by hash.

## Product mechanics
- **Personalization:** none
- **Engagement mechanics:** none
- **Accessibility regime:** none stated
