# Organizations that set themselves up, and the "This machine" page (FD-248, FD-52)

Design, 2026-11-15, quality wave 6 of [the plan](../plans/2026-11-15-quality-waves/README.md). Architect consulted the
same day (`fabric-agents-database` `audit.py consult`): rule R33 O8, pattern `agent-surface`. Promised on the
board (thread `f1fd7e94`): design by 2026-11-19, release by 2026-11-22. Operator decision C1 (2026-11-15): activity is
counted per agent, workflow and project; people only in groups of 5 or more; only the agent stack is read.

## 1. Findings: why an organization drops out of the menu

1. The menu is built only from agents: `OrgMenu` counts organizations from `services`
   (`src/renderer/components/Navigation.tsx:460`); `organizationCounts` makes one row per organization at least one
   agent carries (`src/core/organizations.ts:280-293`). Live: Observatory's config defines four organizations; this Mac's
   descriptors resolve to three of them (28, 17 and 9 agents) and one unattributed, so the fourth is missing from the
   menu today.
2. PassionCode's absence on 2026-11-14 matches the rule before FD-252 (`organizations.ts:181` moved every local instance
   of a platform organization's repository to the personal one). FD-252 narrowed it; nothing stops it from vanishing
   again if all its agents become platform products or are turned off.
3. Turned-off agents are not counted: `status.services` is `monitor.snapshots()` only (`src/electron/main.ts:421`), and
   turned-off entries carry no organization (`src/core/monitor.ts:888-891`).
4. The menu is missing for the first 25 s and whenever no map has been read: `organizationOf` returns `undefined` until
   `readAt` (`main.ts:254`), `organizationCounts` returns `[]` (`organizations.ts:282`), `OrgMenu` returns null
   (`Navigation.tsx:462-463`).
5. The survey fallback forgets configured organizations: only the registry path adds every configured organization
   (`organizations.ts:87`); the survey path skips a project with no organization (`organizations.ts:60-61`).
6. Switchboard knows organizations Dashboards never reads (`PassionCode.ai`, id `e2cb7356…`, `passioncode: true`), and
   Observatory's config carries `fabric_org` on passioncode, the key to `org:<id>`.

## 2. Design

### Sources and precedence
One pure function, `knownOrganizations(cache, services, switchboard?, local)` in `src/core/organizations.ts`:
1. Observatory `config/organizations.json`: label, `default` (personal), `platform`, `fabric_org` (context
   `org:<fabric_org>`).
2. Observatory `registry/projects.json`: project organizations, including ones the config does not name.
3. Deployed agents: an instance named after an organization, a Worker in an attributed Cloudflare account (FD-197).
4. Switchboard organizations: add an organization not known above, matched by label without case; never move an agent.
5. Local display settings (label, hidden): display only, never attribution.
On This machine a context the contract reports (descriptor, well-known, `node.*`, CO-422) wins for that instance.

### "Set up by themselves"
On every map read (25 s after start, then every 30 min) the known list is rebuilt and stored in `organizations.json`:
`known: {name, label, kind, context?, sources[]}[]`, `kind` `personal` (the default organization), `yours` (another in
Observatory's config) or `other` (seen only in projects, agents or Switchboard: a client organization). A new
organization in Observatory's config appears within 30 minutes, with zero agents.

### The menu
Every known, non-hidden organization: personal, then yours, then others. One with no agents shows dimmed with 0 (and
"n off" when its agents are turned off; turned-off entries get an organization through `rowOf`). The menu shows when two
or more organizations are known. Before the first read the stored list shows. No known organization disappears unless
the person hid it.

### Settings → Organizations (after Estate)
One row per known organization: label with a "yours" or "platform" tag, where it was seen, agents here (watched and
off), context id. Actions: Rename (local `organizations.labels[name]`; "Rename for everyone" opens Observatory, which
owns the config), Hide from the menu (`organizations.hidden[]`, reversible; its agents still show under All), Join an
organization, Open in Observatory.

### Join one
Membership belongs to Fabric and the membership service; Dashboards builds no protocol. "Join an organization" opens the owner's flow in
the browser (Switchboard's `passioncode.base` when connected, else `https://org.passioncode.ai`). A pasted invite link is
accepted only as `https` on that host. Nothing is stored; the organization arrives on the next read.

### This machine (FD-52)
A top nav item after Spend. Header: totals for this Mac (agents, running, needing attention, spend today) and a Network
link to Observatory's network view when its well-known declares one. One section per context: Personal, each
`org:<id>` under its label, then "Context not reported". Sums only: agents by state, spend (read while shown), activity
per agent, workflow and project, people only for a group of 5 or more ("fewer than 5" otherwise). Rows: agent instance,
state, context, audience ("not reported" when the contract has none). Until CO-422 reports a context the section is
Observatory's organization, marked "Fabric has not confirmed this context"; a difference is shown as a finding.

### MCP parity
`organizations` (read); `settings` patch accepts `organizations.labels` and `organizations.hidden`; `organization_join`
(the link, `open: true` opens it with the same host check); `this_machine` (sums per context, the same 5-or-more rule);
`list_services` gains `context` and `audience` (null when not reported).

### Scenarios
SCN-113 the menu keeps every known organization (SCN-094's alt paths updated); SCN-114 configure organizations;
SCN-115 join an organization; SCN-116 see what this machine gives each context (MC-12, the board ask, C1).

### Implementation plan (each step one revertable PR)
1. Core known list (`organizations.ts`, `organization-store.ts`, the `main.ts` reader with `fabric_org` and kind).
2. Status carries `organizations`; turned-off entries get an organization (`monitor.ts`).
3. The menu reads the known list (`Navigation.tsx`, i18n, SCN-094, SCN-113). Release: closes the lost-organization part.
4. Settings model (labels, hidden) and the `settings` MCP allowlist.
5. Settings section, copy checks, SCN-114.
6. Switchboard organizations as a source.
7. Join (`src/core/join.ts`, IPC, `organization_join`), SCN-115.
8. MCP `organizations`.
9. Machine view core (`src/core/machine-view.ts`), `context` and `audience` readers.
10. The page (`MachinePage.tsx`, nav, route, Network link), SCN-116.
11. MCP `this_machine` and the `list_services` fields.
12. Backlog, CHANGELOG, release by 2026-11-22; the CO-422 field turns on when Fabric publishes it.

## 3. Decisions (made by the safest reversible option, 2026-11-15)
1. Rename stays local, with a link to Observatory.
2. "Client" means any organization not in Observatory's config, until Observatory marks one.
3. Network links to Observatory's page when its well-known declares one; otherwise no link.
4. Fabric's context wins on This machine; the sidebar keeps Observatory's grouping until the operator decides.
5. People counts only from an agent's own aggregate report; none estimated.
6. Hiding covers the menu and grouping headings only; Spend and Map stay whole.
7. Join host: `https://org.passioncode.ai` until the contract names others.
