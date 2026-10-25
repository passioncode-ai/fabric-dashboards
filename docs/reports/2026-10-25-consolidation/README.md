---
report:
  id: fabric-dashboards/2026-10-25-consolidation
  title: "Consolidation 2026-10-25: every open item in one place, the plan for the first organization, the question batch"
  kind: audit
  project: fabric-dashboards
  domains: [backlog, release, organization, board]
  as_of: 2026-10-25
  status: active
  valid_until: 2026-11-08
  summary: >-
    The operator asked on 2026-10-25 to check what other sessions did here, the project board, debts, worktrees and
    branches; delete what is finished; bring everything unfinished into one place; split it into hotfixes and
    priorities, a product plan for rolling out to the first organization, later plans and backlog; then grill the
    missing points. This is stage 0 of a task-pipeline release iteration: the survey and the question batch. Nothing
    here changes code.
---

# Consolidation 2026-10-25

## Sources read (source ledger)

| Source | What it gave | State |
|---|---|---|
| Git: worktrees, local and remote branches, stash, open PRs | one worktree (`main`), one remote branch (`main`), no stash, no open PR; `main` fast-forwarded `8386db1` to `00eaaec` (0.8.1) | read 2026-10-25 11:32 UTC |
| Every clone of this repository under `~/DATA` (remote URL match, depth 4) | only `~/DATA/fabric-dashboards`, clean | read |
| `docs/backlog.md` | 117 rows: 88 done, 25 open or blocked or waiting, others closed or superseded | read in full (table parsed) |
| `docs/HANDOFF.md` top sections (0.7.24 to 0.8.1) | next tasks of the last five releases | read |
| `docs/reports/2026-10-24-ui-ux-iteration/` (README, inventory.json) | the next pool: 32 findings | read |
| Fabric project board (`com.status`, `com.list unread`) | 256 unread messages (2026-10-19 to 2026-10-25), 46 name Dashboards, 2 open requests to this project | all 256 parsed; the 46 read |
| Fabric task board (`fabric_tasks_list`, `fabric_work_list`) | one task in review (16b6948f), no claims, no other session | read |
| `fabric-dashboards` MCP `list_services` | 31 services on this Mac, none from the organization server | read 2026-10-25 |
| Installed copy (`Info.plist`, `main.log`) | 0.8.1 installed 2026-10-24 23:41:03 UTC by itself | read |
| fabric-workspace `knowledge/roadmap.md` (RM-21, RM-28), `vision.md` (V-01), `docs/reports/2026-10-12-org-contexts/pilot-2026-10-13.md` §4 | Dashboards' role in the organization pilot | read at `origin/main` `e5eae7f5` |
| `docs/evidence/retro.md` | 8 standing instructions; last stamp 2026-10-24 (`df2f895`) | read; no stamp for the 0.8.0 iteration |
| Claude Code transcripts of this folder | sessions of 10-12, 10-18, 10-22 (two), 10-23, 10-24 | listed, not replayed: the merges and the handoff carry their outcome |

Contradictions: (1) HANDOFF's header says 0.7.28 is current and 0.8.0 "being released"; 0.8.1 is published (`gh release list`) and
installed. (2) FD-53 says "blocked on the operator's sign-in"; the organization server's owner said on 2026-10-19 (board `54948011`) "the
organization's panels work", yet no organization descriptor is on this Mac, so the sign-in has not happened here. (3) The
board task 16b6948f waits in review for a release shipped two days ago.

## What the other sessions did (2026-10-19 to 2026-10-25)

Twelve releases in a week, 0.7.15 to 0.8.1, each with a validate run on five runners and an update proof on Windows and
Linux. The last stretch: 0.7.26 the Load tab (FD-93), 0.7.27 the unpriced subscription (FD-97), 0.7.28 the blind review
of both (FD-100) and DOCMAP (FD-99), 0.8.0 the UI and UX iteration (FD-104) with the Sessions mode (FD-103), adopted
mid-way from a session that stopped on a usage limit, then 0.8.1 the Sessions badge (FD-108). Every branch was merged
and deleted; no worktree survived.

## Cleaned up

- `/private/tmp/fd93-build.log`, `fd93-check.log`, `fd93-e2e.log`, `fd97-check.log`, `fd102-check.log`: logs of finished
  releases, deleted.
- Nothing to delete in Git: no branch, worktree, stash or open PR is left.
- Not ours, left in place: `~/DATA/_worktrees/dash-principles.md` (the board's perception principles, answered by FD-86)
  and `dash-scan.mjs` (an em dash counter used for FD-73); loose files of earlier sessions outside any repository.

## Hotfix lane

Empty. None of the five entries (production down, data lost, credential leaked, security hole open, money or legal
failing) holds for this app today.

## The consolidated inventory

Class: **P1** ours, actionable now, in the next release; **P2** ours, next release if it fits; **X** blocked on another
owner or a person; **B** backlog, later; **C** can be closed. Machine-readable: [inventory.json](inventory.json), built
by [build_inventory.py](build_inventory.py).

| ID | Class | Owner | What | Questions |
|---|---|---|---|---|
| FD-109 | P1 | fabric-dashboards | Board request e7a84f35 (company-assessment, operator 2026-10-24, deadline 2026-10-31): agent pages open only in Dashboards. (1) MCP `open` defaults to `fallback=never` for a registered service (today `if_absent`, src/mcp/tools.ts:305, server.ts:75); (2) the `fabric-dashboards://` handler raises or focuses the app and shows path and query; (3) an agent page with no descriptor: a clear refusal with the register step, or a safe loopback open; (4) the MCP server dropped out of a session on 2026-10-24. | Q-06, Q-07 |
| FD-110 | P1 | fabric-dashboards | Board request 870619ab (fabric-agent-contract, deadline 2026-11-14): adopt DEC-0121 `extensions/actions/0.1` (CT-126): read declarations with `actionsView`, audit FAC-SEM-142, show 'not adopted yet' for a dashboard with no actions, declare this app's own actions. Needs the contract re-pin from `4e5440cf` (v0.1.0+2026-10-24) to `52c7d798` (v0.1.0+2026-10-25). | - |
| FD-111 | P1 | fabric-dashboards | Post-release check of 0.8.0 and 0.8.1 (iteration step 11) was not run: `test/e2e/sessions.test.ts` never ran (the screen stayed locked), the FD-108 badge was not read against Switchboard `recovery` on the installed 0.8.1 (installed 2026-10-24 23:41:03 UTC), and SCN-077 to SCN-086 stay draft. | - |
| FD-115 | P1 | fabric-dashboards | Hygiene left by the 0.8.0/0.8.1 sessions: HANDOFF header still names 0.7.28 as current and 0.8.0 as 'being released'; no retro stamp for the 0.8.0 iteration; 256 board messages unread; replies owed on the roll call d008e0a9 (operator 2026-10-25 'close all debts') and on the two requests above. | - |
| FD-02 | P1 | fabric-dashboards | Draft scenarios reviewed against the running app: 18 still draft (of 86), SCN-077 to SCN-086 among them (FD-111). | - |
| FD-112 | P2 | fabric-dashboards | MCP `list_services` gives an instance its product's category: a cloud instance (placement remote, https origin) of a product that also has a local instance reads `category: local` because the product's primary is the local instance (`categoryOf`, src/core/products.ts:81). An agent reading the list misplaces a cloud instance. | - |
| FD-113 | P2 | fabric-dashboards | The 0.8.0 iteration's next pool: 32 findings, none high (17 medium, 15 low): UX-09, 11, 13, 15, 19 to 23; VIS-07, 10, 11, 14 to 18, 21, 24; COPY-14 to 16, 19, 21, 22, 24 to 26, 30 to 33 (docs/reports/2026-10-24-ui-ux-iteration/inventory.json). | Q-09 |
| FD-114 | P2 | fabric-dashboards | No e2e drives the app's own update against a fake feed (FD-98's stated prerequisite): build it, so the update path (the one path every installed copy needs) is provable before a change. | - |
| FD-94 | P2 | fabric-dashboards | windows-11-arm: PowerShell start takes about 48 s against the product's 60 s ACL read; the margin is thin. | Q-05 |
| FD-98 | P2 | fabric-dashboards | A copy with an update ready never checks again, so it lands one version behind (two restarts seen 2026-10-23). Deferred until FD-114 can prove the change. | - |
| FD-58 | P2 | fabric-dashboards (design), Project Observatory (channels.local) | Supervision on Windows/Linux through `node.lifecycle`: Observatory 0.29.0 serves it; our next step is to read its schemas and decide with ADR-0002. | Q-05 |
| FD-87 | X | Fabric CO-321, relay RLY-05, Observatory P6/P7 | (b) show another machine's services (the Mac Studio) from the MacBook; (a) holds. | Q-02 |
| FD-96 | X | passioncode-org-profile (signing action) | Re-run of a Windows package job loads a stale signing module from cache; workaround in RUNBOOK. | - |
| FD-105 | X | Fabric (Q-1, thread 1ddb20ce) | Sessions move to Fabric (V-01); Dashboards stops taking hand-overs once Fabric does. | Q-08 |
| FD-106 | X | fabric-switchboard SB-196 | A workflow handed over and still holding a limit stop; this app already treats the folder as live. | - |
| FD-12 | X | Fabric CO-344 (0.4.0) | Fabric's own fabric-service descriptor and the board link (issue #26). | - |
| FD-22 | X | fabric-agent-contract | A2A surface on the service page once `surfaces.a2a` exists. | - |
| FD-40 | X | Project Observatory (budget read after node.lifecycle) | Spend policy, budget left and grants per agent; approval requests in Needs attention. | Q-01 |
| FD-52 | X | Project Observatory node + the first organization server | 'This machine': group by placement context `personal` / `org:<id>`, host view sums only. | Q-01, Q-04 |
| FD-53 | X | the operator (passkey sign-in) | The organization server's pages embedded; host side done; no organization descriptor on this Mac (fabric-dashboards list_services, 2026-10-25: 31 services, none from org.passioncode.ai). | Q-03 |
| FD-59 | X | Project Observatory | Reach the node through `channels.local` in its descriptor; not announced yet. | - |
| FD-61 | X | Project Observatory node | One shared MCP server instead of one stdio process per session; served by the node, never by the app. | - |
| FD-68 | X | Fabric COM-02 | Runner-route events in an agent's activity. | - |
| FD-80 | B | Electron | A window on another Space or fully covered counts as shown, so a ready update waits; no Electron API on macOS reads it. | - |
| FD-95 | B | fabric-dashboards | NSIS smoke flake: two old processes outlived taskkill once; next miss names their command lines. | - |
| FD-08 | C | - | Superseded by ADR-0011; PR #11 closed. Status already says nothing remains. | - |
| FD-67 | C | - | Closed 2026-10-14, not reproduced. | - |
| task 16b6948f | C | the operator | Fabric board task 'Load (service-load/1), release 0.7.26' sits in review; 0.7.26 shipped 2026-10-23 (release run 39955756486). Closing is the operator's move. | - |

28 items: {'H': 0, 'P1': 5, 'P2': 6, 'X': 12, 'B': 2, 'C': 3}

## Product plan: the first organization (Dashboards' part)

Recorded decisions fix the role: Dashboards **shows and embeds; it installs nothing and starts nothing** (ADR-0002,
pilot packet §4, К-3: the Observatory node installs organization agents, Fabric records placement and grant). Packaging
is Fabric with modules (V-01). What a first organization needs from this app, and where each stands:

| # | Need | State | Gate |
|---|---|---|---|
| O-1 | Every member installs and updates the app without help (signed builds for macOS, Windows, Linux; update every 5 minutes) | done (LC-16, FD-37) | - |
| O-2 | The organization server's pages (limits, weekly report, guest page) open inside the app, signed in | host side done (FD-53, FD-41, FD-56) | the operator's passkey sign-in to the organization server, which writes its descriptor on this Mac |
| O-3 | Services grouped by context, `personal` and `org:<id>`, the host view showing sums only | modelled (FD-52, DEC-0082) | Observatory node and organization listings |
| O-4 | Each agent's policy, budget left and grants | modelled (FD-40) | Observatory budget read |
| O-5 | Agent pages only in this app; links from chats and notifications land on the right page | FD-109 | ours, now |
| O-6 | Every dashboard button has an agent twin, declared (actions parity) | FD-110 | ours, now; contract re-pin |
| O-7 | Load and queue of a shared agent (S4) | done for the load report (FD-93); queue is Fabric's (RM21-S4) | Fabric CO-376 |
| O-8 | Another machine's services (the always-on Mac) | FD-87 (b) | relay and Fabric CO-321 |
| O-9 | Coding sessions | in this app since 0.8.0; move to Fabric (FD-105) | Fabric's answer to Q-1 |

So the first organization can start on O-1, O-5, O-6 and O-7 from this app alone; O-2 needs one person step; O-3, O-4,
O-8 and O-9 wait on Observatory, the relay and Fabric. Which organization, when, and on which machines is the first
question of the batch.

## Proposed next release iteration (0.9.0), pending the answers

1. P1: FD-109, FD-110 (with the contract re-pin), FD-111, FD-115, FD-02's remaining drafts.
2. P2 if they fit: FD-112, FD-114 then FD-98, FD-58's design note, FD-94, the medium half of FD-113.
3. Board answers: `row` to both requests with their dates; `still open` on the roll call with this page.
4. One release, then the post-release check on the installed copy (the step 0.8.0 skipped).

Questions: [../../evidence/specs/2026-10-25-consolidation-questions.md](../../evidence/specs/2026-10-25-consolidation-questions.md).

## Integration sync (board, 2026-10-25 15:46 UTC)

fabric-workspace now coordinates the integration's order (fabric-workspace `knowledge/integration.md`, iterations I1
and I2). Dashboards reported in sync thread `ee3326f5` (message `66be2386`) and agreed to that coordination. Dates
taken there, each recorded in its backlog row:

| Row | Iteration | Target | Condition |
|---|---|---|---|
| FD-109 | I2 | 2026-10-31 | ours |
| FD-110 | I2 | 2026-11-07 (contract asks 2026-11-14) | ours; the adapter's pilot check of 2026-11-07 (thread `0144d916`, message `47bc5941`) |
| FD-52 | I2 | 2026-11-14 (built against the contract field) | live with Fabric's organization contexts, 2026-11-21 |
| FD-87 (b) | I1 | 2026-11-14 | Fabric CO-321 (2026-11-07), relay decision (2026-10-31) |
| FD-40 | I2 | one week after Observatory's host budget read | Observatory, assumed 2026-11-14 |

The board also settles part of the question batch: the first organization is PassionCode.ai as a rehearsal on the
operator's two Macs (wave W1, earliest 2026-11-14), then a second organization on members' Macs and Windows machines
(Q-01, Q-02). If Windows members join in W2, FD-94, FD-95 and FD-96 move to P1. Legal questions of the rollout are
closed by the operator and add no rows here.
