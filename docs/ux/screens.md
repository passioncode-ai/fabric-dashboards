<!-- Managed with super-ux (ux-contract v4). The design map: every screen and state with its Figma frame, wireframe, code coverage, and resources. Update in the same change as any interface change; when Figma is enabled, update the frame too. -->

# Fabric Dashboards — screens

## Index
| ID | Screen | Used by | Figma | Status | Coverage |
|----|--------|---------|-------|--------|----------|
| SCR-01 | Overview | SCN-001, SCN-002, SCN-003, SCN-005, SCN-006, SCN-007, SCN-021, SCN-024, SCN-030, SCN-033, SCN-035, SCN-041, SCN-042 | none (text-only) | built | src/renderer/components/Overview.tsx |
| SCR-02 | Service view | SCN-004, SCN-007–SCN-016, SCN-021, SCN-025, SCN-026, SCN-027, SCN-029, SCN-031, SCN-032, SCN-034, SCN-039, SCN-040, SCN-045, SCN-046 | none (text-only) | built | src/renderer/components/ServiceView.tsx |
| SCR-03 | Activity | SCN-003, SCN-017, SCN-018, SCN-020 | none (text-only) | built | src/renderer/components/Activity.tsx |
| SCR-04 | Settings | SCN-019, SCN-022, SCN-024, SCN-043, SCN-044 | none (text-only) | built | src/renderer/components/Settings.tsx |
| SCR-05 | Stop confirmation | SCN-009 | none (text-only) | built | src/renderer/App.tsx |
| SCR-06 | Tray menu | SCN-023 | none (text-only) | built | src/electron/tray.ts |
| SCR-07 | Spend | SCN-036, SCN-037, SCN-038, SCN-041 | none (text-only) | built | src/renderer/components/Spend.tsx |
| SCR-08 | Sidebar | SCN-001, SCN-006, SCN-017, SCN-022, SCN-033, SCN-035, SCN-044, SCN-047 | none (text-only) | built | src/renderer/App.tsx |
| SCR-10 | Console panel | SCN-048, SCN-049, SCN-050 | none (text-only) | built | src/renderer/components/ConsolePanel.tsx |
| SCR-09 | System dialogs | SCN-014, SCN-024, SCN-027, SCN-044 | none (text-only) | built | src/electron/main.ts, src/electron/views.ts |

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
- **Elements:** header with the agent count; the one-time launch-at-login question (Open at login, Not now) until it is answered; the status strip (agents ready, not answering or in conflict, need attention, spent today, spent in 30 days — the spend cells open Spend; labels wrap to two lines); Needs attention (count, three single-line rows — state, name, reason, one action: Restart, "Update to <v>", Open, Logs; "Restarting…" while it runs — then "Show all N" / "Show fewer"); agent cards (state, name, version+commit, uptime or "online · <host>", the agent's one-line summary, up to six tiles, "also:" with each other instance's state, latest event); the Online group; empty state with "Show folder" and "How a service joins"
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first read of the services directory | — | "Looking for services…" |
  | empty | no descriptor | — | "No services yet" + how a service joins + the folder path + Show folder + How a service joins; a Show folder failure reads "Could not open <path>: <reason>" |
  | success | every agent ready | — | strip and cards |
  | attention | any service not ready, asking, or with a failed action in the last 30 minutes | — | Needs attention between the strip and the cards, most severe first; three rows, then Show all |
  | error | services directory unreadable | — | sentence with path + Retry |
- **Coverage:** src/renderer/components/Overview.tsx
- **Scenarios:** SCN-001, SCN-002, SCN-003, SCN-005, SCN-006, SCN-007, SCN-021, SCN-024, SCN-030, SCN-033, SCN-035, SCN-041, SCN-042
- **Status:** built

### SCR-02: Service view
- **Used by:** SCN-004, SCN-007–SCN-016, SCN-021, SCN-025, SCN-026, SCN-027, SCN-029, SCN-031, SCN-032, SCN-034, SCN-039, SCN-040, SCN-045, SCN-046
- **Purpose:** JTBD-02 and JTBD-04 — control one service and work in its dashboard
- **Layout (ADR-0017, SCN-046):** a compact bar by default — state mark, name, state badge, one problem chip when not ready or after a failed action, a running action's progress, the tabs, "Console", and "Show details" (View → Show or Hide Service Details, ⌃⌘D); the name carries the agent's summary on hover; "Show details" opens the full card below the bar (everything listed next), "Hide details" closes it; the choice is remembered. The console panel (SCR-10) sits to the right of the tab content.
- **Elements:** instance switch (when an agent has more than one instance: "Main · online", "<instance> · this Mac"); header: name, state, progress ("Restarting…"), the agent's summary, facts (version, build, pid, port, uptime), Tools (eight, "+N more"), reasons, the last action's result for 30 minutes (with Logs after a failure), controls (Start, or Restart — primary when down or two copies — and Stop; "Update to <v>" when available; Doctor when declared; Show data folder; Show file; "Show the file of <other>" in a conflict; a path that cannot be shown says so); tabs Dashboard / Activity / Health / Logs (arrow keys move between them; no Logs for an online service); dashboard toolbar (Back, Forward, Reload page, Dashboard home, page address, Copy address, Copy app link); embedded dashboard; "The service restarted." bar with Reload above the page
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
  | page error | the page does not load | — | "The page of <Service> could not load: <reason>" + Retry |
  | crashed | the page crashed twice | — | "The page stopped." + Reload |
  | restarted | a new pid | — | "The service restarted." + Reload above the page |
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
- **Used by:** SCN-019, SCN-022, SCN-024, SCN-043, SCN-044
- **Purpose:** fit startup, updates and notifications to the operator's day
- **Elements:** Fabric Dashboards: Open at login (off until chosen), Theme, Language (As on this Mac / English / Русский), version; Updates: Install updates automatically, its explanation and the update state with its action (Check now, Restart to Update, Move to Applications; a held release: What to do + Install); Notifications: "Whether macOS shows them is set in System Settings → Notifications." with Open macOS Settings, Show notifications, Quiet hours, Pause notifications for 1 hour / "Paused until HH:MM" + Resume, per service Show notifications and Events from; services folder with Show folder; Uninstall (confirmation with "Also delete my settings and activity history"; removes the login item and the MCP entry and moves the app to the Trash; settings and history stay unless ticked); Unattributed listeners (Port, Address, Program, pid; Scan again)
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
- **Used by:** SCN-023
- **Purpose:** JTBD-01 without opening the window
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
- **Elements:** "read at HH:MM", Refresh; All agents tiles (Today, 7 days, 30 days); the agents table (Agent, Today, 7 days, 30 days, Budget; a name expands Model, Calls, Tokens in / out, Cost); "Could not read" with each agent's reason; "Not reporting spend yet: …"; the ≥ note
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first read | — | "Reading what each agent spent…" |
  | empty | no agent reports or fails to report | — | "No agent reports its spend yet" with what an agent must publish |
  | success | reports read | — | totals and table |
  | partial | an unpriced call or an unreadable agent | — | «≥» amounts and the note |
  | error | an agent's report could not be read | — | "Could not read" with the reason in the window's language |
- **Coverage:** src/renderer/components/Spend.tsx, src/core/spend.ts
- **Scenarios:** SCN-036, SCN-037, SCN-038, SCN-041
- **Status:** built

### SCR-08: Sidebar
- **Used by:** SCN-001, SCN-006, SCN-017, SCN-022, SCN-033, SCN-035, SCN-044, SCN-047
- **Purpose:** where everything is, and whether anything needs the operator
- **Rail (SCN-047):** collapsed, the sidebar is a narrow rail — the mark, icons for Overview, Activity, Spend and Settings with their badges, one entry per agent (state mark and initials, "!" when another instance needs attention), each named in a tooltip and to a screen reader; "Collapse sidebar" / "Expand sidebar", View → Show or Hide Sidebar (⌃⌘S); remembered
- **Elements:** Overview (problem count), Activity (unread count), Spend, Services and Background sections (one entry per agent with the primary's state and "!" when another instance needs attention), footer update line ("Checking for updates…", "Downloading an update…", "Update <v> ready" + Restart to Update, "Update <v> is verified and waits for you…" + What to do + Install, "Updates install only from the Applications folder." + Move to Applications, "Update failed: <reason>" + Retry), Settings
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
- **Used by:** SCN-048, SCN-049, SCN-050
- **Purpose:** JTBD-05 — the agent's own runtime, in its repository, beside its dashboard
- **Elements:** header: runtime picker (Claude Code, Codex, other installed runtimes), folder line (shortened path; full path on hover) with "Other…", "Switchboard project <name>" when bound; actions: "New session", "Continue last" (when the runtime can resume), "Stop", "Open in Terminal" ("Open in Terminal via Switchboard" for a project folder the installed Switchboard cannot run in place), "Hide console"; the terminal (the runtime's own interface); an exit line; the left edge drags the width (320 px to half the window)
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | idle | nothing started for this agent | — | runtime, folder, "New session", "Continue last" |
  | running | a session runs | — | the terminal takes the panel; "Stop", "Open in Terminal" |
  | exited | the runtime ended | — | its output stays; "Exited (code N)" with "New session" and "Continue last" |
  | no runtime | none installed | — | "No supported runtime is installed" and the list looked for |
  | no folder | no checkout found, or the folder is gone | — | "Choose the folder this agent's code lives in" + "Choose folder…" |
  | switchboard project, not in place | a project folder; Switchboard without `--in-place` | — | the explanation + "Open in Terminal via Switchboard"; no start in the panel |
  | switchboard error | Switchboard did not answer | — | "Switchboard did not answer; the session was not started" |
  | collapsed | hidden by the person | — | nothing drawn; the session keeps running |
- **Coverage:** src/renderer/components/ConsolePanel.tsx, src/electron/console.ts, src/core/consoles.ts
- **Scenarios:** SCN-048, SCN-049, SCN-050
- **Status:** built
