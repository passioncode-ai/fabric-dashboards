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
  - Given a service is down for 30 s, when notifications are on, then one notification says so; when it returns, one says it is back.
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

## Design tooling
- **Figma:** disabled
- **Figma file:** none — text-only design surface decided at intake (brief D-7); the PassionCode.ai design system tokens are vendored by hash.

## Product mechanics
- **Personalization:** none
- **Engagement mechanics:** none
- **Accessibility regime:** none stated
