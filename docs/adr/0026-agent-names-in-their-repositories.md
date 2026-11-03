# ADR-0026: A name the operator gives an agent lives in the agent's repository

Status: accepted, 2026-11-03; built with this record (FD-135: `src/core/agent-names.ts`, the row menu's Rename and
`src/renderer/components/RenameDialog.tsx`, the MCP tool `rename`, `test/agent-names.test.ts`). Asked by the operator in
chat on 2026-11-03: names of agents can be changed from the menu, and the name is kept "at the level of the agent itself,
in its GitHub".

## Context

An agent's name is the `name` of its descriptor, written by the agent's own code (service.md: at most 80 characters).
The operator runs agents on more than one Mac (FD-132) and wants a name of their own for some of them, set from the
sidebar. A name kept in the app's `settings.json` would live on one Mac only and would be lost with the app's data; a
name written into the agent's descriptor would be overwritten by the agent at its next start, and each agent writes its
descriptor differently. Every descriptor already names its code: `source.repository` (the console finds the agent's
folder by it, ADR-0017).

## Decision

1. **One file in the agent's repository.** `.fabric/names.json` on the repository's default branch:
   `{"schema": "fabric-names/1", "names": {"<id>.<instance>": "<name>"}}`. Keyed by service key, so one repository
   that serves several agents or instances names each of them. A name is 1 to 80 characters, spaces folded, no control
   characters. Keys are sorted and the file ends in a newline, so a diff shows one line per name.
2. **Only the repository the descriptor names counts.** An agent is renamed only by the file in its own
   `source.repository`; another repository's file cannot rename it.
3. **Written through GitHub, never through a working tree.** The app commits with the GitHub contents API through the
   GitHub CLI (`gh api`), which holds the sign-in; the app never sees a token. It reads the file's sha first and sends
   it back, so a name set meanwhile on another Mac is never overwritten: GitHub refuses the stale sha and the change is
   made once more on the new file. The commit message ends in `[skip ci]`: a name is no reason to run the repository's
   checks. When the last name goes, the file goes. A protected branch or a missing permission is said in GitHub's words
   and nothing is retried.
4. **Read once for all agents, kept on this Mac.** One GraphQL call (`HEAD:.fabric/names.json` of every repository,
   40 at a time) 20 s after start, then each repository again after 30 minutes; a repository GitHub does not show this
   sign-in keeps what was read before and is asked again at its next turn. What was read is kept in
   `agent-names.json` in the app's data folder, so a start or a Mac offline shows the names at once. The MCP server
   reads that file and writes it after its own `rename`; the app reads it again when it changed (a stat every 5 s).
5. **Shown everywhere a name is read.** The monitor replaces the descriptor's and the well-known document's `name` in
   every snapshot (the sidebar, the page, the tray, notifications, the map, the MCP answers), and keeps the agent's own
   beside it (`agentName`), so the dialog can give it back. A second instance keeps its instance suffix unless the
   name contains it (ADR-0010: two instances never read alike).
6. **Its agent twin.** The row menu's Rename is the MCP tool `rename` (`{service, name | null}`), declared as action
   `rename` with the gate `relayed`, as Update: it changes something outside this app.

## Consequences

- A name shows on every Mac that runs Fabric Dashboards and can read the repository with `gh`; a Mac without `gh`
  shows the agent's own name and says so in the dialog.
- An agent whose descriptor names no repository, or a repository not on GitHub, cannot be renamed; the dialog says
  why before anything is asked.
- A commit lands on the agent's default branch without a pull request. A repository whose branch rules forbid that
  refuses, and the dialog shows GitHub's sentence.
- Not decided: whether the Fabric contract adopts `fabric-names/1` for other hosts; until then it is this app's file.
