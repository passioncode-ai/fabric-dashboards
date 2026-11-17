# Sessions mode with machines (FD-247)

Design, 2026-11-15, quality wave 6 of [the plan](../plans/2026-11-15-quality-waves/README.md). Architect consulted the
same day (`fabric-agents-database` `audit.py consult`): rule R33 O8, pattern `agent-surface`: every button below is an
MCP capability first.

## 1. What the Sessions mode shows today, and its gaps

**What it shows**
- One merged list of this Mac's sessions, from four sources: Switchboard's `sessions --all`, hand-overs, limit stops
  and this app's own consoles (`src/core/sessions.ts:372`). Processes started by hand come from `sessions --machine`
  (`sessions.ts:511`).
- Four groups: needs you, running, waiting, ended (`sessions.ts:39`, `sessions-view.ts:67`).
- The sidebar shows two-line rows (`Navigation.tsx:376-440`); All sessions shows the same rows as cards
  (`Sessions.tsx:123-195`); a session's page has a header (`Sessions.tsx:202-228`).
- Read every 15 s with the window shown, 60 s hidden (`console.ts:116`, `pollSessions` at `console.ts:1199`).

**Gaps**
1. Rows have no machine: `SessionRow` has no machine field (`sessions.ts:52-107`); an FD-206 session names its machine
   only through its console label `${runtime.name} · ${machine}` (`console.ts:704`), copied into `agent`
   (`console.ts:1219`).
2. Sessions on other machines are invisible: only this Mac's Switchboard is asked (`console.ts:200-216`).
3. Likely bug: an ended FD-206 row loses Continue, because "the folder no longer exists" runs a local `isDir` on the
   other machine's path (`console.ts:1233`).
4. Hard to pick from: no search, no filter, no column view; cards are large.
5. Errors are thin: only the first failing source gets one warning line (`Sessions.tsx:156,172`).
6. No way to reach a remote machine directly: the only ssh console is FD-199's, for an agent placed elsewhere
   (`src/core/remote-console.ts:63`).
7. MCP has no session list: `consoles` covers only this app's running consoles; `session_action` takes local rows.
8. Switchboard 0.7.89: no `remote` CLI command (MCP only); `attach` and `sessions end` have no `--target`;
   `targets --json` gives `machine`, `aliases`, `program`, `data_dir`.

## 2. Design

### The list
- Grouping: machine first ("This Mac" first, then each Switchboard target), then state in today's order. A machine with
  no sessions folds into one line. Each machine heading carries its status: read at a time, unreachable since a time,
  no Switchboard there, Switchboard too old.
- Sidebar: the same tree; machine headings fold and the fold is remembered; needs-you and running rows stay visible
  when their machine is folded.
- All sessions becomes a table: state mark with its words, project, machine, coding agent, account, how it came, time,
  the main action with the others in a More menu. Cards stay as the narrow-width fallback.
- Search across project, folder, account and agent; filter chips for Machine, State and Origin, kept in
  `settings.layout.sessions`; a filtered list says "N of M shown" with Clear filters.
- Pure helpers in `sessions-view.ts` (`machineGroups`, `filterRows`, `searchRows`) shared by the sidebar, the page and
  MCP.

### Remote sessions
- Preferred source: Switchboard on the other machine through `switchboard --json sessions --all --target X` (asked
  on the board).
- Until then the app runs a fixed argv:
  `/usr/bin/ssh -T -n -o BatchMode=yes -o ConnectTimeout=5 <machine> <sb-there> --json sessions --all [--data-dir D]`,
  `<sb-there>` and `D` from `targets` (absolute paths, no shell characters, quoted). The parser of `allSessionsOf`
  becomes a pure `parseAllSessions(stdout)`. By-hand processes there are left out of v1.
- Cadence: only while the window is shown and the Sessions mode is on screen; every 60 s per machine, at most two ssh
  calls in flight; nothing while hidden (zero new spawns in the idle budget).
- A failing machine is retried after 60 s, 5 min, 15 min; its last rows stay greyed with "Not answering since {time}"
  and are dropped after 24 hours. Statuses: reading, ok, unreachable (exit 255), no Switchboard (127), too old,
  bad answer; each on its heading and in `SessionsStatus.machines[]`.

### Connecting to a remote machine
1. Open terminal on {machine}: a console of its own (`machine.<fnv(machine)>`), `/usr/bin/ssh -t <machine>` into a login
   shell; LC-17 cap and swap apply (disk skipped, FD-210), LC-18 idle close, End sends SIGHUP to the group.
2. Open here for a hosted session there: `ssh -t <machine> <sb-there> attach <launch_id>`, the id checked against
   `^[A-Za-z0-9._:-]{1,128}$`; closing the view leaves it running (SCN-104).
3. New session there: the FD-206 dialog with that machine and folder filled in.
4. End on a remote hosted row: asks first, then `ssh <machine> <sb-there> sessions end <id>`; non-hosted remote rows
   offer no End.
5. FD-291 (2026-11-17, 0.8.162): Continue on a stop that machine's Switchboard reads as ready (`why: ready_to_continue`,
   `acts: continue`): a console of its own runs `ssh -t <machine> <sb-there> sessions continue <session> --in-place
   --hosted --surface dashboards`, which continues it in that machine's session host under a launch of its own and
   attaches (SB-400); closing the view leaves it running there. `sessions continue` takes no `--target` (Switchboard
   0.7.111), so it is always our ssh. The session id is checked like a launch id and quoted; nothing of this Mac (no
   context pack, no prompt) reaches that machine, so the FD-234 hold has nothing to fence.

### Security
- ssh only to names in the current `targets` list, matched by `MACHINE` (`platform.ts:152`), through a fixed argv; no
  `-o` from remote data; `StrictHostKeyChecking` never turned off; BatchMode for reads.
- No token, key or account id in argv.
- Everything a remote machine answers is untrusted: schema-checked, capped (200 rows, folder 4096, labels 120),
  rendered as text, never fed into a pack or a prompt, `untrusted` in MCP answers (FD-236). Continue on a remote row
  goes through the FD-234 hold.

### MCP parity
- New read-only `sessions` tool `{machine?, state?, search?}`: rows with machine, per-machine status and `untrusted`.
- `session_action` gains remote row ids for `attach`, `end`, `continue`, an act `open-terminal` with `machine`, and
  `check`. `OWN_ACTIONS`: `machine-terminal` (relayed), `session-end-remote` (relayed), `machine-check` (none). The
  parity test holds every new button to them.

### Lifecycle and cost
New AGENTS.md rows: remote session lists (ssh, 60 s per machine, shown and on screen only, none hidden) and the machine
terminal console. `test/lifecycle.test.ts` counts a hidden hour with targets present: 0 ssh.

### Scenarios
SCN-109 find a session (search, filters, table); SCN-110 sessions on other machines; SCN-111 a terminal on another
machine; SCN-112 open here or end a hosted session there. SCN-078 steps 1-2 and SCN-101 step 4 updated.

### Implementation plan (each step one revertable commit)
1. Board ask to Switchboard: `sessions --all --target`, `attach --target`, `sessions end --target`.
2. Fix the `isDir` check for a console with `settings.consoles[key].machine`, with a test.
3. `machine: string | null` on `SessionRow` and `ConsoleInput`, filled from saved settings; drop the label hack.
4. `src/core/remote-sessions.ts`: argv, parse, validation; `parseAllSessions` split out of `switchboard.ts`.
5. The remote reader in `console.ts` (cadence, backoff, the Sessions-on-screen signal, `SessionsStatus.machines[]`),
   behind Settings → Sessions "Show sessions on other machines", on by default.
   Done in 0.8.112: `RemoteSessions` in `src/core/remote-sessions.ts` (the schedule, on the caller's tick), read by
   `ConsoleHost.pollRemote` beside the sessions tick when the switch is on, the window shown and `layout.mode` is
   `sessions` (the mode the window saves); rows `rm:<machine>:<launch>` carry no actions until step 7. Greying the kept
   rows is left to step 6 (the table); meanwhile a status line per machine not read says why.
6. The renderer list: helpers, table and filters, machine tree, filters in settings.
   In part in 0.8.113: `filterRows`, `searchRows`, `machineGroups`, `machineStatusWords` in `sessions-view.ts`; All
   sessions with search, chips, "N of M shown", machine headings and greyed rows of a machine not read now;
   `settings.layout.sessionsFilter`. 0.8.114: the sidebar's machine tree (`layout.sessionsFolded`; a folded machine keeps
   needs-you, running and the open row). 0.8.116: the table view (`@container sessions (min-width: 900px)`; the machine is the section's heading, not a column).
7. Remote actions: attach and end argv, the machine terminal console, channel and IPC.
   In part in 0.8.115: `remoteAttachArgv`, `remoteEndArgv`, `LAUNCH_ID` (`src/core/remote-sessions.ts`); a hosted remote
   row carries `attach` and `end`, served by the existing channels (`sessionsAttach`, `sessionsEnd`, MCP `session_action`).
   Also 0.8.115: Open terminal on {machine} (SCN-111): `ConsoleHost.openMachineTerminal`, key `session.term-<fnv>`,
   IPC `sessionsMachineTerminal`, MCP `session_new` kind `terminal`. 0.8.116: New session there from a machine heading (`initialMachine`).
8. MCP tools and the parity test.
   Done in 0.8.116: MCP `sessions` (channel op `sessions.list`, a read under the read limit; `sessionListRow`,
   `filterListRows`); the actions were already MCP doors (`session_action`, `session_new` kind `terminal`).
9. Docs: scenarios, AGENTS.md lifecycle rows, CHANGELOG, copy checks in en and ru.
10. Switch to Switchboard's `--target` doors when they ship; the ssh path stays as the fallback.
    Done in 0.8.127 for the list: `targetSessionsArgv` (`switchboard --json sessions --all --target <machine>`, with
    `--remote` and `--remote-data-dir` from `targets`), used when this Mac's Switchboard's `sessions --help` names them
    (`sessionsTakeTarget`, read once per Switchboard); its ssh's exit code and stderr pass through, so the states hold.
    Open here and End there followed in 0.8.134: `targetAttachArgv` and `targetEndArgv`, used when this Mac's
    Switchboard's `attach --help` and `sessions end --help` name `--target` (read with `targets`, `RemoteSessions.via`);
    its `--json` refusal (`{ok: false, error}`) is shown as its sentence. Our ssh stays the fallback for an older one.

## 3. Decisions (made by the safest reversible option, 2026-11-15)
1. Remote reads: ask Switchboard and ship the read-only ssh path meanwhile, behind a setting.
2. By-hand processes on remote machines: not in v1.
3. The app adds no machine (no `~/.ssh/config` edits, no key copies); it points at Switchboard and the person's ssh.
4. End on remote non-hosted rows: none.
5. Remote machines are not read while hidden; the tray counts this Mac only.
6. The machine terminal opens a login shell in the home folder.
