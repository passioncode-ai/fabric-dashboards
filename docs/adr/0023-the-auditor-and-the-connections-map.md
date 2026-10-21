# ADR-0023: The auditor and the Connections map

Status: accepted, 2026-10-21 (FD-81). Requested by the operator on 2026-10-21: «аудитор, который работает и следит,
чтобы ... сразу же мог запускать сессию, которую у нас там по дефолту выбрана, клауд-код ... внутри дашборда видеть,
как эти агенты между собой соединены, какие-то проблемы ... чтобы все функции были в MCP».

## Context

Problems were spread across the app: Needs attention listed agents whose own state was bad; a degraded part, a broken
declared connection, an agent another one relies on, an over-the-line limit or an available update each lived on its
own page or nowhere. ADR-0022 gave every agent a Connections tab, but nothing showed the estate as one wiring.

## Decision

1. **One auditor, pure and live.** `audit()` (`src/core/audit.ts`) runs over every installed agent with each status
   push and returns findings: `error` (does not work), `warn` (works in part), `setup` (waits for a person, DEC-0044),
   `info` (worth knowing). Kinds: the agent's own state, a part it reports, a connection it declares, an agent in its
   chain, an invalid declaration, an update, a spending limit that stopped work or is over its line. A finding is a code
   with parameters; the reader words it, and an agent's own words stay its own.
2. **A finding names the agent to fix.** A chain finding (the agent relies on one that fails) sits on the caller so the
   person sees whose work is at risk, but it never offers a session there: the agent reached has its own finding, and
   the fix goes where the cause is.
3. **Fix with agent, in the coding agent the person picks.** Each agent's findings carry a runtime select (the one
   chosen for that agent, else Claude Code, else the first installed) and *Fix with agent*: the choice is saved
   (`consoleChoose`) and the console starts with a task of kind `audit`, its `task.md` holding the findings as the person
   read them. The auditor proposes; a person starts the session (honest state: no session starts by itself).
4. **The Connections page** (sidebar, between Activity and Spend) shows the auditor's summary, how many agents declare
   their connections, the map, and the findings by agent. The nav item carries the count of `error` findings.
5. **The map is layered and bounded.** `estateMap()` (`src/core/estate-map.ts`): an agent sits one column right of the
   farthest agent that calls it, a cycle is cut where it closes, a target that is not installed is a dashed node, agents
   with no edge wait under "Not connected". Edges carry the worse of the declared state and the reached agent's own.
   An agent that declares nothing has no line, and the page says so.
6. **Everything the app shows, an agent can read.** MCP `audit` returns the same findings (English), counts, coverage and
   edges; `setup_check` runs Check setup's read-only doctor. What stays the person's, on purpose: the list choices
   (pin, kind, hide; readable through `list_services`), starting a console session (it spends the person's
   subscription), settings, notifications and Uninstall. README *For agents* has the full table.

## Consequences

- The auditor reads only what the monitor already has, plus the spending limits Spend reads; it adds no probe.
- Until agents declare connections (extensions/connections/0.1, ADR-0022), the map has few lines; the coverage line
  keeps that visible instead of an empty-looking success.

## Proof

`test/audit.test.ts`, `test/mcp.test.ts` *FD-81*, `test/handoff.test.ts` *FD-81*, `test/e2e/connections.test.ts`
*SCN-074*, `test/e2e/focus-console.test.ts` *FD-81*; scenario SCN-074.
