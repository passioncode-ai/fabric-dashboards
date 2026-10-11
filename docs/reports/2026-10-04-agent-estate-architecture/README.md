---
report:
  id: fabric-dashboards/2026-10-04-agent-estate-architecture
  title: "Agent estate: employee workplaces, the admin channel, agent chat and spend — who owns what"
  kind: decision-input
  project: fabric-dashboards
  domains: [ai-agent, architecture, security, telegram, billing]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-11-03
  summary: >-
    The operator's 2026-10-04 asks — a ready agent workplace for an employee (agent, Dashboards,
    Switchboard, Claude Code), an admin channel to see, configure, analyse and update those
    agents, a Telegram chat where agents and people talk, a place where agents exchange requests,
    and spend reported by the agents — mapped onto what is already designed (fleet tunnel CE-0…14,
    relay ADR-0088, COM board, DEC-0021) with eight gaps, an owner per piece and five decisions
    the operator made on 2026-10-05. Only DEC-0021 and the Dashboards Spend page are built.
  sources:
    - name: "Device control and the fleet tunnel (fabric-workspace, proposed, nothing built)"
      url: "https://github.com/passioncode-ai/fabric-workspace/blob/main/docs/reports/2026-10-03-device-control-and-fleet/README.md"
      read_at: 2026-10-04
    - name: "Fabric ADR-0088: three surfaces through one relay"
      url: "https://github.com/passioncode-ai/fabric/blob/main/docs/adr/0088-fabric-reaches-the-operator-on-three-surfaces-through-one-relay.md"
      read_at: 2026-10-04
    - name: "Project communications plan COM-01…14 (fabric branch codex/claude-recovery-20261004, not on main)"
      url: "https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/docs/evidence/plans/2026-10-04-project-communications.md"
      read_at: 2026-10-04
    - name: "Telegram board transport research (fabric branch codex/telegram-board-transport-research, b9aa8bff)"
      path: "README.md#telegram-chat-of-agents-and-people"
      read_at: 2026-10-04
    - name: "Fabric Agent Contract DEC-0021 usage report (PR #10, merged 9091d3d)"
      url: "https://github.com/passioncode-ai/fabric-agent-contract/pull/10"
      read_at: 2026-10-04
    - name: "Fabric Dashboards ADR-0012 and ADR-0013"
      path: "../../adr/0013-spend-from-the-agents.md"
      read_at: 2026-10-04
  produced_by:
    agent: "Claude Code (Opus 5.5), fabric-dashboards session"
    task: "Operator request 2026-10-04: employee workplaces, admin tunnel, agent Telegram chat, agent exchange, spend — design, owners, plan"
  supersedes: []
  consumers: [fabric, fabric-workspace, fabric-switchboard, project-observatory-dashboard, fabric-agent-contract, fabric-agent-adapter]
---

# Agent estate: employee workplaces, the admin channel, agent chat and spend

<sub>ssheleg skills — evidence-docs · project-reports</sub>

## Главное

**What was asked (2026-10-04, condensed).** An employee, for example someone in support, should
get a ready workplace in the enterprise edition. They install an agent built for their role,
Fabric Dashboards, and Fabric Switchboard if the agent needs many accounts, then keep working in
Claude Code as usual. The organisation must be able to manage those agents through an admin
channel: see them, read their data, configure, analyse and update. Agents need a place to
exchange information and requests, and a Telegram chat where they talk to each other and people
can ask them questions. Every agent reports its own spend at the protocol level, and one view
shows which agents spent how much.

**What already exists, and how much of it is built:**

| Piece | Where | Built? |
|---|---|---|
| Fleet tunnel: admin Fabric → employee Fabric, outbound-only mTLS through a relay, enrolment, typed commands, signed catalogue | fabric-workspace `docs/reports/2026-10-03-device-control-and-fleet` §4, packets CE-0…CE-14 | **No.** Proposed; licence "path B" decided (knowledge `licensing.md`) |
| Relay | Fabric ADR-0088 (accepted direction) | No. Hosting is open question O2 |
| Agent exchange: Project board and mailbox, claims, cursor reads | Fabric COM-01…COM-14 (branch only) | No. All rows open, no schema in the contract |
| Telegram mirror and replies, agents discussing in a group | COM-08/COM-09 + Telegram transport research (branches) | No. Live tests NOT_RUN |
| Spend reported by the agents | Contract DEC-0021 `surfaces.usage` ([PR #10](https://github.com/passioncode-ai/fabric-agent-contract/pull/10), merged `9091d3d`); Dashboards Spend page and MCP `spend` ([ADR-0013](../../adr/0013-spend-from-the-agents.md)) | **Yes, at source level.** Contract on `main`; Dashboards unreleased; no agent publishes a report yet |
| One entry per agent, connections inside | Dashboards [ADR-0012](../../adr/0012-one-entry-per-product.md) | **Yes**, on `main` `f294285`, unreleased |

So the employee workplace is not a new architecture. It is the fleet tunnel's member node plus a
**role profile** (gap G1), with Dashboards as the person's local monitor. The admin channel is
CE-7…CE-12. The Telegram chat is COM-08/09 over the COM board. Spend reaches the admin through
the node's `status.read` projection built from DEC-0021 reports (G6).

## Who owns what

One owner per piece. A piece that crosses repositories names the seam rather than a second owner.

| Concern | Owner | On the employee's machine | For the admin |
|---|---|---|---|
| Running, watching and restarting the role's agents; their pages signed in | **Fabric Dashboards** | Yes: local monitor, launchd verbs, MCP for Claude Code | Nothing direct. It opens no port and is not reachable from outside (ADR-0088 item 7, `SECURITY.md`) |
| Reading services (descriptors, health, state, links, **usage**) | `@passioncode-ai/fabric-service-host` (in this repo) | Used by Dashboards **and** by the Fabric node to build its projection | — |
| Member node, policy evaluation, command receipts, enrolment, leaving | **Fabric** (node mode) | Yes | — |
| Admin console: fleet, rollouts, tasks, audit, spend rollup | **Fabric** (organisation mode, private module, path B) | — | Yes |
| Relay: outbound connections, queues, projection cache | Fabric relay (ADR-0088, CE-7) | Outbound client only | Outbound client only |
| Machine evidence: projects, findings, credentials by name, vault | **Project Observatory** | Yes: health source for `status.read` and the CE-10 gates; vault for the node's keys | Read through the node's projection, never directly |
| Provider accounts: work and personal pools, which account serves the next request, quota | **Fabric Switchboard** | Yes, when the role profile includes it | Organisation-managed pool and quotas (G4) |
| What an agent is and must answer (descriptor, well-known, events, usage, COM messages) | **Fabric Agent Contract** | — | — |
| Making a project an agent: kits, provider bundle, COM consumer adapters, Telegram mirror service | **fabric-agent-adapter** | The agent's build | — |
| Agent exchange: board, mailbox, claims | **Fabric** (COM-02/03) | Agents talk to it through their adapters | Board view per project and team |

**What does not move.** Dashboards does not become the admin endpoint, Observatory does not
execute admin commands, and Switchboard does not carry agent traffic. Each keeps one job. The
admin reaches a machine only through the node, which checks every command against its own policy
(fleet design §4.4).

## The employee workplace (role profile)

<a id="g1"></a>**G1 — role profile (new, extends CE-10).** The fleet design catalogues items one
at a time: an agent, a skill, an MCP configuration. A workplace is a **set of items with one
version**. Proposed catalogue item kind `workplace-profile`, for example
`support-desk@2026.10.1`, which pins:

1. **Agents.** Their provider bundles with exact versions (adapter `provider-bundle.md`: content
   hash, contract lock). Each is installed as a local `fabric-service/0.1` service under launchd,
   with a descriptor whose `installedBy` names the organisation. Organisation-owned agents are
   uninstalled when the person leaves (LC-14, fleet §4.3).
2. **Fabric Dashboards** (signed, from its CI release), plus its MCP registered in Claude Code.
3. **Fabric Switchboard**, only if the profile's agents need several provider accounts. Most
   roles need one account and do not get it.
4. **Claude Code configuration.** MCP registrations for the agents (each agent's own MCP surface
   and the Dashboards MCP), the organisation's plugin marketplace and the skills the role uses,
   and `CLAUDE.md` rules. Installed through the plugin channel, never as plain copies, so updates
   reach them (the same rule as `sshlg-skills`).
5. **Credentials by name, never by value.** Which keys each agent needs. The node gets them
   issued per person from the organisation's vault, through the Observatory doors on the node
   (G5). A shared operator key is never copied to an employee.
6. **Policy.** What the organisation may do on this node, which the person sees in plain words
   at enrolment (fleet §4.3 step 2).

**Install path.** The person installs Fabric and opens the enrolment link. The node applies the
profile through `catalogue.install` and reports each item's receipt. The person then works in
Claude Code as before. The new parts are the Dashboards window and its menu-bar icon, plus
whatever the agents add to Claude Code through MCP. **Update path:** a new profile version rolls
out through CE-10's canary and stable channels with health gates, and a failed gate rolls back.

## The admin channel

The fleet design's commands cover most of «see, read, configure, analyse, update».

| Admin wants to | Command | Status |
|---|---|---|
| See agents, versions, health, last runs | `status.read` (node projection built from service-host + Observatory) | designed (CE-9) |
| See spend per employee, agent and model | `status.read` carrying each agent's DEC-0021 summary | **G6**, new; source built |
| Change settings, model and provider choice, budgets | `config.push` | designed (CE-9); budgets are G6 |
| Update or roll back an agent or the whole profile | `catalogue.update` / `rollback` | designed (CE-10); profile is G1 |
| Give the employee's Fabric a task | `task.assign` | designed (CE-9) |
| Read an agent's **data** (its tickets, drafts, history) | — | **G3**, new; needs a decision |
| Help live on the screen | `device.session`: the person's live consent every time | designed (CE-11) |

<a id="g3"></a>**G3 — reading an agent's data.** `status.read` carries metadata. An agent's
content (support tickets, customer messages, drafts) is personal data under employee-monitoring
and data-protection law. Proposed command `service.read`: the admin calls one of the agent's
**declared read capabilities** (`surfaces.mcp.capabilities`, contract DEC-0016/0020) through
the node. Two keys apply, as with `device.session`: the organisation's policy names which
capabilities a seat may call, and the agent's own capability declares itself `readOnly`. Every
call is audited on both sides and **visible to the employee** in Dashboards and in their Fabric.
Content never travels in `status.read`. **Decision D3:** whether content reads are in the first
enterprise release at all, and which compliance regime shapes them (CE-0 already lists works
councils).

<a id="g6"></a>**G6 — spend rollup.** Built at source level: each agent publishes
`surfaces.usage` (DEC-0021), and Dashboards reads and sums it on demand (ADR-0013). Still to do:

- The node includes each agent's `summarizeUsage` output (same shared code) in its `status.read`
  projection, so the admin console sums the same numbers the employee sees.
- `config.push` carries budgets. The agent enforces its own budget (DEC-0021 `budget`); the
  console only shows it.
- Unknown stays unknown across the fleet: the console never turns `null` into $0 (the rule COM-10
  and Observatory #146 already state).
- Switchboard quotas (`used_percent`) are a different measure, provider quota rather than money.
  The console shows them next to spend, never adds them to it.

## Agent exchange and the Telegram chat

**The place where agents exchange information and requests is Fabric's Project board and
mailbox** (COM plan at `3b2878fc`). Messages are addressed to `(estate, project, capability)`,
never to a session. Kinds are request, reply, finding, announcement and cancel. Claims are leases
with a fence, and agents catch up by cursor. Nothing of it is built, and **COM-01 (the contract
schemas and the capability name) blocks every consumer**, including Dashboards COM-11 (issue #26,
backlog FD-12). Dashboards will show each agent's communication capability and the board's health,
and link to the board, once COM-01 names the capability. The groundwork is in place: it now reads
`surfaces.mcp.capabilities`.

<a id="telegram-chat-of-agents-and-people"></a>**The Telegram chat** is COM-08 (mirror) and
COM-09 (replies, agents discussing in a group): an optional adapter service. Its safeguards are an
allowlist of numeric user ids, discussion budgets, bot-loop termination, and optionally a distinct
bot per agent. **The board stays the source of truth.** Telegram is a window onto it: a question a
person asks in the group becomes a board request addressed to a project or capability, and the
agent's reply is mirrored back. Two constraints:

- The operator's own Telegram relay is a personal tool, not the base for an organisation product,
  and is not to be moved or bundled into one (operator rule 2026-09-29). The organisation's chat
  is the COM-08/09 adapter service.
- **Decision D4:** Telegram for enterprise teams, or Telegram for the operator plus a
  workplace chat (Slack, Teams) for customers. COM-08/09 are written transport-agnostic in the
  board. The mirror adapter is the only Telegram-specific part.

## Gaps and where they go

| Gap | What | Owner | Joins |
|---|---|---|---|
| G1 | `workplace-profile` catalogue item: pinned agents, Dashboards, Switchboard (optional), Claude Code MCP/plugin config, credential names, policy | Fabric (catalogue) + adapter (bundle format) | CE-10 |
| G2 | Dashboards on a managed node: an "organisation-owned" mark on agents installed by the profile, and the node's audit of admin actions on those agents visible to the person | Fabric Dashboards | after CE-9 |
| G3 | `service.read`: admin reads an agent's data through declared read capabilities, two keys, audited, visible to the person | Fabric (command) + contract (capability `readOnly`) | CE-9; D3 |
| G4 | Switchboard organisation pool: accounts issued by the organisation, quotas pushed by `config.push`, personal pool untouched | Fabric Switchboard | CE-9 |
| G5 | Per-person credentials issued from the organisation vault to the node (Observatory doors), never copied operator keys | Fabric (issuer) + Project Observatory (node vault) | CE-8 |
| G6 | Spend in `status.read`, budgets in `config.push`, fleet rollup with unknown kept unknown | Fabric console; service-host `summarizeUsage` shared | CE-9/CE-12; source of DEC-0021 built |
| G7 | Agents adopt DEC-0021: the `building-fabric-services` kits emit `surfaces.usage` from the receipts an agent already keeps | fabric-agent-adapter, then each agent | now (contract merged) |
| G8 | COM-01 contract schemas and capability name, which unblock COM-11 (Dashboards), the board and the Telegram mirror | fabric-agent-contract + Fabric | COM-01 |

## Decisions for the operator

Answered by the operator on 2026-10-05:

- **D1 — relay hosting:** a Cloudflare Worker behind Access, hosted by PassionCode, by default.
  A customer that requires it runs its own relay.
- **D2 — Switchboard:** only in profiles whose agents need several accounts.
- **D3 — content reads by the admin:** allowed in the first enterprise release, through the
  agent's declared read capabilities, with consent and an audit visible to the employee. G3 is
  in scope.
- **D4 — chat transport:** Telegram plus Slack/Teams, as two mirrors of the same board.
- **D5 — employee visibility:** everything the admin sees about their machine, including their own
  spend and every admin action, in Dashboards and in Fabric.

The COM choices C1–C9 were accepted the same day: DEC-0022 on fabric-agent-contract `main`.

## Данные и метод

Read the fleet design, ADR-0088, the COM plan and the Telegram research at the commits named in
the sources, plus the current Dashboards source. Two read-only searches across `fabric`,
`fabric-workspace`, `fabric-agent-contract`, `fabric-switchboard`,
`project-observatory-dashboard` and one of the operator's private repositories (2026-10-04) established what is decided,
what is only on a branch, and what is absent. No live system was changed for this report.

## Выводы для проекта

For Fabric Dashboards: FD-11 (Spend) and FD-12 (COM-11, blocked by COM-01) are in this
repository's backlog. G2 is this repository's next enterprise item once CE-9 exists. Dashboards
stays a local monitor with no inbound port, and the fleet reads machines through the Fabric node.

## Источники

See the header. Commit-addressed: fleet design at fabric-workspace `main` (merged `68904e1`,
`e41029f`); COM plan `3b2878fc`; Telegram research `b9aa8bff`; contract DEC-0021 `9091d3d`;
Dashboards `f294285` (ADR-0012) and branch `feat/spend-view` (ADR-0013).

## Поправки

None yet.
