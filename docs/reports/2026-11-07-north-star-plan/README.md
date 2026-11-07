---
report:
  id: fabric-dashboards/2026-11-07-north-star-plan
  title: "Plan 2026-11-07: what is left for Fabric Dashboards, ordered by the North Star"
  kind: plan
  project: fabric-dashboards
  domains: [organization, isolation, measure, places, sessions, release]
  as_of: 2026-11-07
  status: active
  valid_until: 2026-11-28
  summary: >-
    Every open row of this repository's backlog, the findings of the 2026-11-06 and 2026-11-07 board work (the agent
    audit, the estate review, DEC-0154, DEC-0149, CT-254) and the North Star of the organization, read side by side:
    where Dashboards already matches the target picture, what is missing, and the order to build it in, around the
    coordinator's pause and the 2026-11-21 organization slice.
---

# What is left for Fabric Dashboards, ordered by the North Star

## Sources

- The North Star: fabric-workspace `knowledge/north-star.md` at `52006d00` (2026-11-07), its gaps table §14, and the
  module pages `knowledge/system/measure.md` (S0) and `knowledge/system/fabric.md` (S1).
- This repository at `main` `5aa48d0`: [backlog](../../backlog.md), [handoff](../../HANDOFF.md), released 0.8.30.
- The board threads of 2026-11-06 and 2026-11-07: the estate review `eefa7959`, the agent audit `5d2a61f1`, ports and
  owners `1fe66e6e`, isolation `22876238`, sessions `b250bec9`.
- Our answer to the estate review: [2026-11-06-estate-flows](../2026-11-06-estate-flows/README.md).

## What the North Star asks of Dashboards

The page names Dashboards in five places:

| North Star | What it asks | Where Dashboards stands (2026-11-07) |
|---|---|---|
| §4 table | "what runs, its health, spend and connections, filtered by organization" | done: 0.8.29 (FD-162, FD-163), 0.8.30 (FD-159) |
| §4 «One system» | each agent's page, health, spend, load, connections; **a dashboard per role** (owner: money and the measure; administrator: the organization's agents and grants; architect: the project's work; member: what was granted) | per agent: done. Per role: not built (gap G26, no row until this plan: FD-170) |
| §0 and S0 G1-e | Dashboards shows the measure M per organization, and per role | FD-165 gives the inputs (spend, activity, organization); showing M waits for Observatory's join (G1-d) |
| §1 principle 2, §3 | levels, not questions: owner, administrator, architect commands approve automatically, logged with the level | no Dashboards action waits on a permission today; logging the level is FD-164 |
| §13 | every head machine "sees the organization in Dashboards" | Dashboards sees only its own macOS user's agents and online descriptors; one view of the organization across machines does not exist (FD-52, question 1 below) |

And it relies on Dashboards indirectly in four more:

| North Star | Dashboards' part |
|---|---|
| §11 one host, several accounts | a token goes only to this account's listener: done in 0.8.30 by DEC-0154; on the open connection by CT-254: FD-168 |
| §11 organization boundary | the auditor flags a cross-organization connection (FD-163); while both sides live in one macOS account the filter is a view, not isolation (question 2) |
| §2 places, §10 rebuild | an organization's agents in a headless space run as system daemons (OBS-361): Dashboards must read them without breaking them (FD-167); Dashboards' own copies there do not update themselves (the host agent keeps them current) |
| §6 Fabric as process manager | Fabric's one screen of sessions needs our open consoles (FD-166, CO-457); a board task that wakes a new session (FD-137) |
| §5 agent anatomy (source apart from instance, DEC-0149) | an agent that waits only for its setup reads "Waits for setup", never degraded (FD-169) |

## The plan

The coordinator's pause (thread `eefa7959`) holds new code until the shared source of truth; started steps and the
operator's direct requests continue. The 2026-11-21 organization slice (Fabric 0.4.0, the relay, member tokens) is the
next cross-product date. The waves below follow those two dates.

### Wave 0: now, inside the pause (security and started steps only)

| Row | What | Waits on | Exit check |
|---|---|---|---|
| FD-168 | check the listener's owner on the open connection before the token is written; the listener at 127.0.0.1 first; procfs read to the end | the contract's CT-254 on its main and tagged (PR #250) | tests for the swapped listener and both address orders on Linux and macOS; a five-platform validate; a release |
| audit, point 3 | the last descriptor without `source.repository` names it | its owner (request on thread `7c9c610d`) | the auditor reads its organization |

### Wave 1: after the shared source of truth, before 2026-11-21

| Row | North Star | What | Depends on |
|---|---|---|---|
| FD-169 | §5 | "Waits for setup" over `degraded` when every entry is `setup: true`; outward the state stays `degraded` | nothing (decided with the contract, message `5549a61a`) |
| FD-167 | §2, §10 | read agents that run as system daemons (`system/<label>`, the domain from `extensions` or `space-daemons.json`); start and stop only through the host agent's `studio.service.control` | contract CT-234 for the field's name (draft by 2026-11-13) |
| FD-166 | §6 | MCP `consoles`: each open console with the service, runtime, `sessionId`, `runtimeSessionId` and `open_link` | nothing (shape agreed with Fabric, message `c8788f35`) |
| FD-154 | §5 | the sample service on the adapter kit 0.74.0 (two new modules, the channel-agent schema, `fabric_peer_owner`) | nothing |
| FD-161 rest | §4 | group the list by where an agent came from (`installedBy`) next to the organization filter | nothing |
| FD-129, FD-130 | quality | the 28 low UI findings; the first e2e's cold start | nothing |
| audit rerun | §11 | the agent audit again: cross-organization links and descriptor modes | the pilot organization's agents on their own signal server (needs the operator's bot in the organization's cloud gateway), Observatory's fix R1 |

### Wave 2: with and after the 2026-11-21 organization slice

| Row | North Star | What | Depends on |
|---|---|---|---|
| FD-164 | §1 principle 2, §3 | log the caller's level (owner, administrator, architect, user) with each action; a user's action on an organization's agent through the organization's approval | the contract's CT-250 (architect role, approve by level), the organization service's VES-AUTHORITY-LEVELS |
| FD-52 | §13 head machines | "this machine": which agents this place holds, grouped by where they come from (one Dashboards per place, decided 2026-11-07) | Fabric's organization contexts (G5) |
| FD-171 (new) | §4 «One system» | a person's own dashboard as a small local service from the adapter's kit, and a *New dashboard* action that has an agent build it | the kit's template for a dashboard-only service |
| FD-165 | §0, S0 G1-e | hand the activity journal each agent's spend and activity with its organization | Observatory's event schema OBS-378 (by 2026-11-13) |
| FD-170 (new) | §4, G26 | a dashboard per role cut from the same record: owner (money and M), administrator (agents and grants), architect (the project's work), member (what was granted) | FD-165 and the journal (G1-d), the organization service's roles, FD-164 |
| FD-53 | §4 | the organization server's own pages embedded like a service's | the operator's sign-in to that server |
| FD-40 | §1 principle 3 | show each agent's spend policy and grants from the record | Observatory serving grants beyond `grant.check` |
| FD-58, FD-59 | §2 Linux places, G28 | supervise through the Observatory node on Windows and Linux; reach it through `channels.local` | the node's descriptor and lifecycle surface |

### Blocked on others, no date (kept, not planned)

FD-12 (Fabric's communication capability), FD-22 (`surfaces.a2a` in the contract), FD-68 (runner-route events in a
descriptor), FD-105 (sessions moving to Fabric), FD-61 (one shared MCP server, against the no-port promise),
FD-106 (Switchboard SB-196), FD-137 (a live board-dispatched session to check), FD-140 (Switchboard's model routing),
FD-138 (each release is a wave; continues).

## Contributions to North Star gaps owned by others

| Gap | What Dashboards gives |
|---|---|
| G1 the measure | inputs (FD-165) and the owner's view of M (FD-170) |
| G2 levels | FD-164 |
| G19 agents finishing their own acts | the app's actions (start, stop, restart, update, console, fix) have MCP twins that run without asking (`src/mcp/actions.ts`); only a person's own clicks keep a confirmation against losing work |
| G27 a security agent | the auditor's findings (descriptor modes, tokens in foreign folders, cross-organization links, ports held by another account) are a ready input; the agent audit of 2026-11-06 was run from them |
| G14, G28 rebuild and Linux | Dashboards installs in two minutes from the release and needs no port; its copies in headless spaces need the host agent to update them (measured 2026-11-07, message `85580023`) |

## Decided by the operator

1. **One Dashboards per place** (2026-11-07, in this repository's session `0edbdfdf`, in their words: «у каждого свой, агент один но если локально его поставить как репозиторий еще то можно сделать свой дашборд, так или подумай как лучше»). Each person, and each place, runs its own copy; there is one product. FD-52 stays "this machine"; the organization-wide picture a head machine needs (North Star §13) comes from the organization's hub as an online service with its own pages (FD-53), never from one Dashboards reaching into other machines.
2. **"Your own dashboard" is a page, not a fork** (our proposal on the operator's «или подумай как лучше»):
   - the layout, filters, pins and hidden agents are already per person (settings, MCP `arrange`); the role preset is FD-170;
   - a person's own dashboard is a small local service made from the adapter's kit: a `fabric-service/0.1` descriptor and a dashboard page that reads Dashboards' MCP (`list_services`, `spend`, `connections`) and Observatory; it appears in the list the moment it is installed, signs in like any agent, updates on its own and crosses no organization boundary (FD-171);
   - a *New dashboard* action starts a console session with that template and the person's words, so an agent builds it (the console already exists, MCP `console_new`);
   - a fork of this repository stays for contributors (AGPL): a forked app loses the signed update feed, needs its own signing, and holds every agent's token, so it is not the way to customise.

## Questions for the operator

1. **Until the organization's agents leave the personal macOS user, should Dashboards refuse to control them (start,
   stop, console) from a personal session?** North Star §11 forbids crossing; the filter only hides. The safe default
   proposed: allow, flag in the auditor (as now), and make control refuse once each organization has its own user.

## Next step

The first task is FD-168 the day the contract tags CT-254 (it will post on thread `1fe66e6e`); then wave 1 in the
order above once the coordinator lifts the pause.
