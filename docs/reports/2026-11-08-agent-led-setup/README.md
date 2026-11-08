---
report:
  id: fabric-dashboards/2026-11-08-agent-led-setup
  title: "Agent-led setup in Fabric Dashboards: the spec and the waves"
  kind: plan
  project: fabric-dashboards
  domains: [setup, agents, ux]
  as_of: 2026-11-08
  status: active
  valid_until: 2026-11-28
  summary: >-
    The operator asked on 2026-11-08 to simplify the interface and the whole setup, make it agent-led, and leave the
    person clear steps. This is Fabric Dashboards' part: where its setup stands, the rule it follows from now on, and
    three waves ordered by the North Star's organization-device steps. The organization console's and the ecosystem's parts are asked on
    the board (thread dc9e3357).
---

# Agent-led setup in Fabric Dashboards

## 1. What was asked

The operator, 2026-11-08, this repository's session `0edbdfdf` (verbatim, typos kept): «по UI UX полностью упростить
[консоль организации] и весь сетап, максимально селать его агентским, а тчо в интерфейсе то понятны ми шаг за щагом + продумать
относительно нашей актуальной даты и целей и видена в fabric workspace как должна работта эта часть экосистемы и давай
граммотно проработаем спеку и план чтоыб волнами все закрыть».

Three owners share it. The organization console's interface and the organization's onboarding are its owner's; the plan across products is
fabric-workspace's (North Star); both were asked on the board on 2026-11-08 (thread `dc9e3357`, request `3a5c6cbd`).
This report is Fabric Dashboards' part: its first launch, the setup card, Settings → Setup and their MCP twins.

## 2. Where it stands (2026-11-08, `main` at `b52c819`)

| What | Today | Evidence |
| --- | --- | --- |
| First session | the setup card and a Setup console for the default coding agent; the runtime starts when the person presses Start setup | SCN-058, `src/core/setup.ts`, `src/renderer/components/Overview.tsx` (SetupCard) |
| The setup brief | register this app's MCP and prove it; skills; then Switchboard, Observatory and Fabric offered one at a time; a first agent | `setupMarkdown`, `src/core/setup.ts:51` |
| Check setup | the launcher's read-only `doctor`, run only on a press; Fix with my coding agent opens the Setup console with the findings first | SCN-070, `src/core/doctor.ts`, MCP `setup_check` |
| Doctor version | pinned at 0.2.2 while the launcher is at 0.2.75; 0.2.75's JSON parses whole (44 of 44 checks on this Mac) | `src/core/doctor.ts:6`, `npm view @passioncode-ai/passioncode version` |
| Agent doors | every button of Settings and Sessions has an MCP twin (FD-175), but the Setup console did not: `console_new` refused `fabric-dashboards.setup` as an unknown service | `src/mcp/tools.ts` `consoleChannel`, `test/agent-doors.test.ts` *FD-182* (fails on the code before it) |
| Organization device | North Star's seven steps (order, device, base set, people, delegation, run, leave); the pilot was stood up by hand, steps 2 and 3 not from templates | fabric-workspace `knowledge/north-star.md` (at `dd19ffba`), table "The organization device", gaps G14, G23 |

## 3. The rule from now on

1. **The agent does, the window shows.** Every setup step is done by a coding agent; the window lists the steps and
   where each stands: done, the agent works on it, or it needs the person.
2. **The person only at a human gate.** A sign-in, a one-time code, a consent screen, a typed secret or a payment, each
   named with the reason no route avoids it (the operator's rules of 2026-11-05, 2026-11-07 and 2026-11-08). The
   gates of a run come as one list, not one by one (North Star, organization device step 2).
3. **No choices that are not decisions.** The standard set (the MCP of this app, the skills, Switchboard, Observatory,
   Fabric) is installed by default; offering each "one at a time" asks the person what the delegation already answered.
4. **Every step has an MCP twin.** What the window offers, an agent calls (FD-175); what the window shows, an agent
   reads.
5. **One source for what is set up:** the launcher's `doctor` at a pinned, current version; the window and the agents
   read the same report.

## 4. The waves

### Wave 1: doors and the current check (this change, ships in 0.8.41)

- **FD-182.** MCP `console_new` takes `fabric-dashboards.setup`: an agent starts the Setup console as Start setup does,
  its brief opening with the last Check setup's findings (Fix with my coding agent). SCN-058 alt path, SCN-098 step 7,
  `test/agent-doors.test.ts` *FD-182*.
- **FD-183.** The doctor pin moves 0.2.2 → 0.2.75. The JSON is the same shape; the fake `npx` fixture follows.

### Wave 2: one step list (target 2026-11-14, the release before the organization slice)

- **FD-184.** The setup card becomes a numbered step list in the doctor's area order (Prerequisites, Skills, Apps, MCP
  servers, Services), each step done, being done, or needs you with its gate named; the three ticks of today fold into
  it. Check setup runs once by itself at the first launch and when a Setup console ends, never on a timer (a change to
  the lifecycle table's row "never run on its own", recorded there in the same change).
- **FD-185.** The setup brief installs the standard set by default and puts every human gate of the run in one list at
  its top; "offer one at a time" goes. MCP `setup_check` answers the step list the card shows, so an agent reads the
  progress without the window.
- Both need SCN-058 and SCN-070 rewritten first (super-ux: scenarios before code), the copy checked in en and
  ru, and an e2e of the first launch on a clean profile.

### Wave 3: the organization device, read-only (with the 2026-11-21 organization slice)

- **FD-186.** On "This machine" (FD-52, RM-28), the North Star's organization-device steps as the host agent's
  receipts report them: each step, who does it, done or not, the gates waiting. Dashboards shows; the host agent and the
  PM agent act. It waits for the host agent to publish its receipts (G14) and for the templates (G23); the organization console owns steps
  1 (order) and 4 (people).

## 5. Dependencies

| Wave | Waits for | Owner | Where asked |
| --- | --- | --- | --- |
| 1 | nothing | fabric-dashboards | this change |
| 2 | the launcher's step order staying the doctor's areas | PassionCode launcher (RM-09) | SCN-070 traces |
| 3 | host agent receipts per step; organization templates | host agent, fabric-agent-adapter | North Star G14, G23 |
| 3 | the organization console's order and people steps | the organization console's project | board thread `dc9e3357` |
