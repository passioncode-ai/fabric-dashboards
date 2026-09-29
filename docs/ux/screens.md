<!-- Managed with super-ux (ux-contract v4). The design map: every screen and state with its Figma frame, wireframe, code coverage, and resources. Update in the same change as any interface change; when Figma is enabled, update the frame too. -->

# Fabric Dashboards — screens

## Index
| ID | Screen | Used by | Figma | Status | Coverage |
|----|--------|---------|-------|--------|----------|
| SCR-01 | Overview | SCN-001, SCN-002, SCN-005, SCN-006 | none (text-only) | built | src/renderer/components/Overview.tsx |
| SCR-02 | Service view | SCN-004, SCN-007–SCN-016, SCN-021, SCN-025, SCN-026, SCN-027 | none (text-only) | built | src/renderer/components/ServiceView.tsx |
| SCR-03 | Activity | SCN-003, SCN-017, SCN-018 | none (text-only) | built | src/renderer/components/Activity.tsx |
| SCR-04 | Settings | SCN-019, SCN-024 | none (text-only) | built | src/renderer/components/Settings.tsx |
| SCR-05 | Stop confirmation | SCN-009 | none (text-only) | built | src/renderer/App.tsx |
| SCR-06 | Tray menu | SCN-023 | none (text-only) | built | src/electron/tray.ts |

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
- **Used by:** SCN-001, SCN-002, SCN-005, SCN-006
- **Purpose:** JTBD-01 — the state of every service and what needs the operator, in one screen
- **Elements:** header with service count; Needs attention block (rows with one action each — the primary action of the screen when present); service cards (state, name, version+commit, uptime, tiles, latest event); empty state with "Show folder"
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first read of the services directory | — | "Looking for services…" |
  | empty | no descriptor | — | "No services yet" + how a service joins + Show folder |
  | success | every service ready | — | cards only |
  | attention | any service not ready or asking | — | Needs attention above the cards, most severe first |
  | error | services directory unreadable | — | sentence with path + Retry |
- **Coverage:** src/renderer/components/Overview.tsx
- **Scenarios:** SCN-001, SCN-002, SCN-005, SCN-006
- **Status:** built

### SCR-02: Service view
- **Used by:** SCN-004, SCN-007–SCN-016, SCN-021, SCN-025, SCN-026, SCN-027
- **Purpose:** JTBD-02 and JTBD-04 — control one service and work in its dashboard
- **Elements:** header (state, name, version+commit, pid, uptime, port; Restart — primary when down —, Stop/Start, Update when available, Doctor when declared, Show data folder); tabs Dashboard / Activity / Health / Logs; embedded dashboard; reload bar
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | ready | answers as itself | — | dashboard tab active |
  | degraded | degraded sources | — | reasons listed in the header, dashboard usable |
  | down | no answer for 15 s | — | "Not answering since HH:MM" + Restart + Logs |
  | off | launchd job disabled | — | Start |
  | duplicate / foreign / conflict / invalid | see SCN-011–SCN-013, SCN-004 | — | explanation, no dashboard, no token sent |
  | working | a control is running | — | progress label, other controls disabled |
  | sign-in error | SCN-016 | — | reason + token path + Retry |
- **Coverage:** src/renderer/components/ServiceView.tsx
- **Scenarios:** SCN-004, SCN-007, SCN-008, SCN-009, SCN-010, SCN-011, SCN-012, SCN-013, SCN-014, SCN-015, SCN-016, SCN-021, SCN-025, SCN-026, SCN-027
- **Status:** built

### SCR-03: Activity
- **Used by:** SCN-003, SCN-017, SCN-018
- **Purpose:** JTBD-03 — everything the agents did, in one feed
- **Elements:** filters (service, level); day groups; rows (time, service, level marker, sentence; opens the link); partial-failure line
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | loading | first fetch | — | skeleton rows |
  | empty | no events | — | "Nothing has happened yet…" |
  | success | events | — | newest first |
  | partial | one feed failed | — | line naming the service and reason, others shown |
- **Coverage:** src/renderer/components/Activity.tsx
- **Scenarios:** SCN-003, SCN-017, SCN-018
- **Status:** built

### SCR-04: Settings
- **Used by:** SCN-019, SCN-024
- **Purpose:** fit notifications and startup to the operator's day
- **Elements:** Launch at login; notifications per service with levels; quiet hours; services folder with Show; Unattributed listeners; macOS notification permission notice
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | default | — | settings apply immediately |
  | error | login item refused, listener scan failed, notifications denied | — | reason beside the control |
- **Coverage:** src/renderer/components/Settings.tsx
- **Scenarios:** SCN-019, SCN-024
- **Status:** built

### SCR-05: Stop confirmation
- **Used by:** SCN-009
- **Purpose:** a destructive-feeling action is confirmed with its consequence
- **Elements:** sentence naming the service and that it stays off across restarts; Stop (primary, destructive), Cancel
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
- **Elements:** icon in three states; problems first; every service with state; Open Fabric Dashboards; Pause notifications for 1 hour; Quit
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |-------|---------|-------------|----------|
  | success | all ready | — | calm icon |
  | error | something down or wrong | — | alert icon, problems first |
- **Coverage:** src/electron/tray.ts
- **Scenarios:** SCN-023
- **Status:** built
