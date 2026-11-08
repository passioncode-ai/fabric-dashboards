---
report:
  id: fabric-dashboards/2026-11-08-studio-move
  title: "The move to the second machine, 2026-11-08: what blocks using it, who does what, and Fabric Dashboards' part"
  kind: plan
  project: fabric-dashboards
  domains: [places, isolation, release]
  as_of: 2026-11-08
  status: active
  valid_until: 2026-11-22
  summary: >-
    The operator asked on 2026-11-08 to bring the move to the always-on second machine to the point where it can be used:
    settings, the organization's space and remote use. Read from the host agent's handoff and plan, the coordinator's
    space plan and placement page, and this repository's backlog. What blocks use, each owner, the operator's steps, and
    what Fabric Dashboards does.
---

# The move to the second machine: state and plan, 2026-11-08

The operator's words (this repository's session 0edbdfdf, 2026-11-08 about 11:15 UTC, recognised speech): bring the
move to the point "чтобы мы уже могли начать пользоваться", with settings, the organization and remote use, coordinated
through Fabric with owners for each step. The coordination request is on board thread `06263bd5` (message `0b2ac94a`);
the coordinator owns the cross-project plan, this page owns Fabric Dashboards' part.

## Sources

Read on 2026-11-08 at each repository's `origin/main`: the host agent's `HANDOFF.md`, `docs/plan.md`,
`docs/decisions/README.md` and its 2026-11-07 audit; fabric-workspace `docs/plans/2026-11-04-studio-spaces/`,
`knowledge/placement.md`, `current-state.md`, `runbook.md` and `knowledge/roadmap.md`; this repository's
`docs/backlog.md` and [the 2026-11-07 plan](../2026-11-07-north-star-plan/README.md). Line numbers are given on the board
thread; the owning repositories hold the facts.

## Where it stands

Working on the second machine: the personal space and the organization's space exist, each with its own keys and
clones; background services come back after a reboot by themselves (the reboot test passed 2026-11-08, `tailscaled`
and the host agent run as system daemons); the vault copies are made daily and restore-checked weekly; Switchboard runs
as a system daemon in both spaces; six agents are placed there, and this Mac's placement record names them
(`~/.local/share/project-observatory/placement.json`, written 2026-11-08 02:12 UTC).

## What blocks using it (P0)

| # | What | Owner | Waits on |
|---|---|---|---|
| 1 | No Claude account is enabled in the personal space | host agent | the operator choosing the account |
| 2 | The Fabric hub and the personal agents have not moved to the personal space | host agent, Fabric, each agent's owner | the move sequence (leave, cut over) per agent |
| 3 | Fabric Dashboards there reads its agents' system daemons as stopped (17 of them) and its buttons would fail | **Fabric Dashboards, FD-167** | the descriptor field's name (contract CT-234, draft by 2026-11-13); the code can start from the host's daemon record |
| 4 | The copies of Fabric Dashboards in the spaces are 0.8.29; the current release is 0.8.38 | host agent (its `dashboards` step) | the step run after each release, or FD-145 |

## Next (P1)

- Organization jobs still loaded on this Mac (15), owners answering on board thread `75b32c6a`.
- Whether the machine answers SSH before FileVault is unlocked after an unplanned restart: never checked.
- The host agent's uncommitted SSH key registry of 2026-11-08 shows some organization deploy keys with write access.
- A receipt to thread `75b32c6a` that failed while the board was down was not sent again.
- Stale lines: the coordinator's `current-state.md` (R4, R6 done), `runbook.md` step 5.2 (no longer on hold), the R2
  numbering that differs between the coordinator and the host agent, and the host agent's architecture page saying this
  Mac's Dashboards shows the second machine's agents (not built; one Dashboards per place was decided 2026-11-07).

## The operator's steps

Each named once: the Claude account for the personal space; unlocking FileVault after an unplanned restart; the
Observatory access binding for Fabric's daily digest (CO-503); the personal vault copy's passphrase (Q10); a decision on
the 12 unassigned repositories and 15 vault projects (open since 2026-11-05).

## Fabric Dashboards' part

| Row | What | State |
|---|---|---|
| FD-179 | An agent placed on the second machine whose port this Mac reaches through the move's SSH tunnel read "Two copies, stop it here"; it now reads as the placed copy | found and fixed 2026-11-08 checking FD-132 against the real placement record; PR #414 |
| FD-132 | The placement record read on a real record | checked 2026-11-08: five agents read placed elsewhere, one found FD-179 |
| FD-167 | Read and act on the spaces' system daemons | started 2026-11-08: the daemon record first, the descriptor field when CT-234 names it |
| FD-145 | The window, login item and self-update of a per-user copy, proven in a space | waits for the spaces' copies to be current (P0 row 4) |
| FD-178 | A failing update feed read twice per check | fixed 2026-11-08, PR #413 |
