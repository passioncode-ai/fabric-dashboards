# Waves of 2026-11-18: agents, consoles, sessions, release

Asked by the operator in this repository's session, 2026-11-18: «прорабатывай все задачи … волнами закрываем все до конца»,
with new themes: the organization's dashboards (access and updates), the launch UI, a console for a remote agent without
a local copy, a full terminal as in Fabric and Inbox, session management split with Switchboard, load and refresh
behaviour, and keeping in step with the other products' releases. Built on the
[agent-connect audit](../../reports/2026-11-18-agent-connect-audit/README.md). Rows live in [the backlog](../../backlog.md).

## Principles (decided here, by the operator's recorded rules and this product's goal)

- **P1, Switchboard owns sessions; Dashboards shows them.** Starting, continuing, ending and moving a coding session is
  Switchboard's (its sessions page `sessions --rows`, its session host). Dashboards keeps a view: a session list read from
  that page, an agent's console, and buttons that call Switchboard's own doors. Nothing Dashboards-only decides a
  session's state (the joins FD-322 retires go first).
- **P2, the coding agent works where the code is.** An agent placed on another machine is edited on that machine,
  through that machine's Switchboard (FD-328). A cloud agent is edited in a checkout of its repository: here when one
  exists, cloned on request into `~/DATA/<name>` with the person's `gh` (Switchboard's `github clone`), or not at all.
- **P3, context reaches the coding agent through doors, never through tokens.** A remote session gets this app's
  context pack as text (the brief and `session-handoff/1`), the agent's own MCP through a delegation token the hub
  mints (contract DEC-0039), and nothing read from a descriptor token.
- **P4, one terminal.** Every console is the same xterm surface as Fabric's and Inbox's: it fills the window under a thin
  bar (back, agent, folder, machine, account, stop), with the panel form as the person's choice.
- **P5, one name per agent** (audit §5.1): an answer under another name is told as what it is (FD-327, FD-329, done).

## Waves

| Wave | Rows | State |
|---|---|---|
| A, false alarms and remote consoles | FD-327, FD-329 (done, PR #672); FD-328 | FD-328 next |
| B, the terminal | FD-333 | after A |
| C, a console without a local copy | FD-330, FD-334 | after A (FD-328 is its route) |
| D, the launch UI | FD-335 | needs the built app on screen; e2e waits for load under 40 and 5 GB free (FD-325) |
| E, the organization | FD-331, FD-336; FD-332, FD-186, FD-188, FD-189, FD-194 wait for others | after C |
| F, sessions with Switchboard | FD-337, FD-322 (not before 2026-11-25), FD-326 | board ask sent with this plan |
| G, load, refresh, restarts | FD-338, FD-325 | measured when load allows |
| H, MCP two doors | FD-339 | after F |
| I, in step with other products | board messages per wave | each wave |
| Release | version, CHANGELOG, tag, readback | after each landed wave when the gate is green |

## Waits

| Wait | Owner | Watcher |
|---|---|---|
| SMM Manager's events feed | smm-manager-agent, request `1094b815` | the board; FD-327 already removes the false alarm |
| The video agent's Studio copy renamed | its project, reply `569340bc` | the board |
| Machine load under 40 and 5 GB free for e2e | other sessions | checked at each wave's gate (`scripts/check-machine.mjs`) |

Next task: FD-328.
