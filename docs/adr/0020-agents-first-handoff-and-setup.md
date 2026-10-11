# ADR-0020 — Agents first: the console hands the agent its context; setup is done by the coding agent

Status: accepted · 2026-10-10. The operator said: «все максимум передаем на кодинг агентов а интерфейс для того
чтобы пользователь видел результат» ("hand as much as possible to coding agents; the interface is there so the person
sees the result"). Brief: [2026-10-10-agents-first-brief.md](../evidence/briefs/2026-10-10-agents-first-brief.md).
Organisation principle: fabric-workspace `knowledge/agents-first.md` (PR #96) and `principles.md` §8.

## Context

ADR-0017's console started a coding agent's own CLI in an agent's folder. It passed only
`FABRIC_DASHBOARDS_SERVICE=<key>` and the working directory (`src/core/consoles.ts`, 2026-10-10). The agent did not
know the state, the reasons, the errors, the recent events, the descriptor or the repository, and it had no way to
read them. Fabric's own sessions already get all of this, from `sessionBundle.ts` (`context.md`, `mcp.json`, an
appended brief, and `fabric_whoami` as the first call). The first run asked one question about login items and then
showed an empty list.

## Decision

1. **Every console start writes a context pack** to `userData/consoles/<key>/`: the folder is 0700, each file 0600
   and written whole, and none of it goes into the agent's repository (`src/core/handoff.ts` `writePack`).
   - `context.md` holds the agent's identity, its state and reasons as sentences, descriptor problems, its last
     action, its version and any pending update, its repository and folder, its last 20 events (warnings and
     errors keep up to half), and the descriptor **without its `auth` block**. A token file is never the agent's
     to read (SECURITY.md).
   - `task.md` is written only when the console was opened to do a job (decision 3).
   - `mcp.json` starts this app's MCP server: this binary run as Node through the RunAsNode fuse, the same on
     every OS.
2. **The pack reaches the agent before its first turn.** The brief stays under 1000 characters, because a
   Switchboard in-place launch passes at most 16 arguments of 1024 characters each.
   - **Claude Code:** `--mcp-config <mcp.json> --append-system-prompt <brief>`. An option always follows the
     variadic `--mcp-config` (Switchboard SB-94).
   - **Codex:** `-c mcp_servers.fabric-dashboards.*`, placed before `resume`, plus a first prompt naming
     `context.md`.
   - **Gemini CLI:** `-i <first prompt>`.
   - **Every runtime:** `FABRIC_DASHBOARDS_CONTEXT`, plus `FABRIC_DASHBOARDS_TASK` when there is a task.
3. **The new MCP tool `service_context`** returns the same picture, read at call time. The brief tells the agent
   to call it first, the way Fabric's preamble names `fabric_whoami`.
4. **Work goes to the coding agent with the context**:
   - *Fix with agent* hands over a problem and what "fixed" means: confirmed with `service_status`.
   - *Update with agent* applies when an update is available and the descriptor has no `update` command, or that
     command failed.

   Either way the task is the agent's first prompt, and the person watches the result in the app.
5. **The list:**
   - A *Pinned* section sits above the rest, in pin order, never re-sorted (Fabric's favourites rule), keyed by
     product id (ADR-0012).
   - The other entries sort by Name (the default), Status or Recent activity.
   - Both settings live in `settings.layout.list`.
6. **The first session is a setup run by the person's coding agent**, in a console that is not tied to an agent.
   - One click starts it: a coding agent spends the person's subscription.
   - It registers this app's MCP and makes the proving call, checks or installs the adapter skills, offers
     the family products one at a time with consent (each through its own `onboard` guide), creates or adapts
     the first agent and makes it a service.
   - When the family setup entry exists (fabric-agent-adapter#49), the setup run calls it.
   - **Later sessions** open on what changed since the last visit: problems, updates, and *Continue* for each
     agent the person worked with.
7. **Human gates stay human:** sign-ins, consents, secrets (typed into a hidden prompt, never printed), the
   subscription.

## Consequences

- A pack that cannot be written is logged and the session starts without it. The handoff never blocks a console.
- *Open in Terminal* still starts the runtime without the pack (a separate window; a later change).
- Codex's appended-instructions file (`experimental_instructions_file`) is not verified on this machine, so Codex
  gets a first prompt instead: one short turn that reads the file (brief carry-over C-1).
- Other products get their own parts of this decision through their owners: Fabric (fabric-90, waiting on the
  shared pack format), Switchboard SB-93..95, Inbox B-79..81, Observatory OBS-54, and adapter#49. All of them are
  listed in `knowledge/agents-first.md`.

## Amendment 2026-10-11 — the pack is `session-handoff/1` (FD-47)

Fabric Agent Contract DEC-0042 (merged `213e5a3a2f4d`; Fabric ADR-0140, Fabric 0.4.0 REQ-06) makes the pack one
format that Fabric and this app both write, so a Fabric agent opens in this console and a Dashboards agent opens
from Fabric with the same folder. What changed here:

- **`handoff.json`**, the manifest, is written last at each start, for Claude Code, Codex and Gemini CLI. It
  declares `lifetime: agent-key` (the folder is kept per agent and rewritten), `firstCall: service_context` on
  `fabric-dashboards` with `arguments.key`, `mcp: {auth: none, strict: false}` (the stdio launcher, no secret;
  the person's own servers stay loaded), the brief's delivery, and what the launch adds (`args` in order, `env`).
  `launch.args` are the handoff's own arguments (SH-10): Continue's `--continue` or Codex's `resume --last` are the
  runtime's, sit between them on the command line, and are not recorded. A Terminal window opened while a console
  session of the same agent runs gets no pack: the folder is one per agent key, and that session owns it.
  Other runtimes get no manifest: the brief does not reach them, so a manifest would declare a delivery that
  does not happen. The Setup console writes none either: it does start the person's coding agent, but on no
  agent, so there is no key for `service_context`, the only first call `session-handoff/1` allows a console. Fabric's
  own Setup console is a Fabric session and does write one (the Fabric owner, 2026-10-11).
- **The preamble holds no rule** (SH-6). The brief is the task's path, when there is a task, then one line naming
  `service_context` alone. The rules that used to be in the brief (do the work yourself; ask only for decisions,
  sign-ins, consents and secrets; secrets only in a hidden prompt; confirm a fix with `service_status`) are now
  `rules` in `service_context`'s answer (`CONSOLE_RULES`, `src/mcp/tools.ts`). This replaces decision 2's brief.
- **The brief is inline up to 1000 characters on one line, otherwise `brief.md`** (SH-8), named by its absolute
  path in `--append-system-prompt-file`. Codex's brief is its first prompt, and Gemini CLI's is its `-i` prompt.
  Claude Code with a task gets the brief as its system prompt and `Do the task in <task.md>.` as its first prompt.
- **`service_context` takes `key`**, the argument the handoff's first call passes; `service` still works.
- **Conformance is a test**: `test/session-handoff.test.ts` runs the contract's own `validateSessionHandoff`
  (copied in `test/contract/`) against the folders `prepareHandoff` writes.

