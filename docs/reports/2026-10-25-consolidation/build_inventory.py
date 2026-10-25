"""Writes inventory.json and the inventory table of README.md from one list (2026-10-25 consolidation)."""
import json, pathlib

# class: H = hotfix lane (iteration.md, five entries); P1 = ours, actionable now, in the next release;
# P2 = ours, next release if room, else the pool after; X = blocked on another owner or a person;
# B = backlog, later; C = can be closed (evidence named).
ITEMS = [
  # --- new, from the board and the post-release state
  ("FD-109", "new", "P1", "fabric-dashboards", "Board request e7a84f35 (company-assessment, operator 2026-10-24, deadline 2026-10-31): agent pages open only in Dashboards. (1) MCP `open` defaults to `fallback=never` for a registered service (today `if_absent`, src/mcp/tools.ts:305, server.ts:75); (2) the `fabric-dashboards://` handler raises or focuses the app and shows path and query; (3) an agent page with no descriptor: a clear refusal with the register step, or a safe loopback open; (4) the MCP server dropped out of a session on 2026-10-24.", "Q-06, Q-07"),
  ("FD-110", "new", "P1", "fabric-dashboards", "Board request 870619ab (fabric-agent-contract, deadline 2026-11-14): adopt DEC-0121 `extensions/actions/0.1` (CT-126): read declarations with `actionsView`, audit FAC-SEM-142, show 'not adopted yet' for a dashboard with no actions, declare this app's own actions. Needs the contract re-pin from `4e5440cf` (v0.1.0+2026-10-24) to `52c7d798` (v0.1.0+2026-10-25).", ""),
  ("FD-111", "new", "P1", "fabric-dashboards", "Post-release check of 0.8.0 and 0.8.1 (iteration step 11) was not run: `test/e2e/sessions.test.ts` never ran (the screen stayed locked), the FD-108 badge was not read against Switchboard `recovery` on the installed 0.8.1 (installed 2026-10-24 23:41:03 UTC), and SCN-077 to SCN-086 stay draft.", ""),
  ("FD-112", "new", "P2", "fabric-dashboards", "MCP `list_services` gives an instance its product's category: a cloud instance (placement remote, https origin) of a product that also has a local instance reads `category: local` because the product's primary is the local instance (`categoryOf`, src/core/products.ts:81). An agent reading the list misplaces a cloud instance.", ""),
  ("FD-113", "new", "P2", "fabric-dashboards", "The 0.8.0 iteration's next pool: 32 findings, none high (17 medium, 15 low): UX-09, 11, 13, 15, 19 to 23; VIS-07, 10, 11, 14 to 18, 21, 24; COPY-14 to 16, 19, 21, 22, 24 to 26, 30 to 33 (docs/reports/2026-10-24-ui-ux-iteration/inventory.json).", "Q-09"),
  ("FD-114", "new", "P2", "fabric-dashboards", "No e2e drives the app's own update against a fake feed (FD-98's stated prerequisite): build it, so the update path (the one path every installed copy needs) is provable before a change.", ""),
  ("FD-115", "new", "P1", "fabric-dashboards", "Hygiene left by the 0.8.0/0.8.1 sessions: HANDOFF header still names 0.7.28 as current and 0.8.0 as 'being released'; no retro stamp for the 0.8.0 iteration; 256 board messages unread; replies owed on the roll call d008e0a9 (operator 2026-10-25 'close all debts') and on the two requests above.", ""),
  # --- open rows of docs/backlog.md
  ("FD-02", "backlog", "P1", "fabric-dashboards", "Draft scenarios reviewed against the running app: 18 still draft (of 86), SCN-077 to SCN-086 among them (FD-111).", ""),
  ("FD-80", "backlog", "B", "Electron", "A window on another Space or fully covered counts as shown, so a ready update waits; no Electron API on macOS reads it.", ""),
  ("FD-87", "backlog", "X", "Fabric CO-321, relay RLY-05, Observatory P6/P7", "(b) show another machine's services (the Mac Studio) from the MacBook; (a) holds.", "Q-02"),
  ("FD-94", "backlog", "P2", "fabric-dashboards", "windows-11-arm: PowerShell start takes about 48 s against the product's 60 s ACL read; the margin is thin.", "Q-05"),
  ("FD-95", "backlog", "B", "fabric-dashboards", "NSIS smoke flake: two old processes outlived taskkill once; next miss names their command lines.", ""),
  ("FD-96", "backlog", "X", "passioncode-org-profile (signing action)", "Re-run of a Windows package job loads a stale signing module from cache; workaround in RUNBOOK.", ""),
  ("FD-98", "backlog", "P2", "fabric-dashboards", "A copy with an update ready never checks again, so it lands one version behind (two restarts seen 2026-10-23). Deferred until FD-114 can prove the change.", ""),
  ("FD-105", "backlog", "X", "Fabric (Q-1, thread 1ddb20ce)", "Sessions move to Fabric (V-01); Dashboards stops taking hand-overs once Fabric does.", "Q-08"),
  ("FD-106", "backlog", "X", "fabric-switchboard SB-196", "A workflow handed over and still holding a limit stop; this app already treats the folder as live.", ""),
  ("FD-12", "backlog", "X", "Fabric CO-344 (0.4.0)", "Fabric's own fabric-service descriptor and the board link (issue #26).", ""),
  ("FD-22", "backlog", "X", "fabric-agent-contract", "A2A surface on the service page once `surfaces.a2a` exists.", ""),
  ("FD-40", "backlog", "X", "Project Observatory (budget read after node.lifecycle)", "Spend policy, budget left and grants per agent; approval requests in Needs attention.", "Q-01"),
  ("FD-52", "backlog", "X", "Project Observatory node + the first organization server", "'This machine': group by placement context `personal` / `org:<id>`, host view sums only.", "Q-01, Q-04"),
  ("FD-53", "backlog", "X", "the operator (passkey sign-in)", "The organization server's pages embedded; host side done; no organization descriptor on this Mac (fabric-dashboards list_services, 2026-10-25: 31 services, none from org.passioncode.ai).", "Q-03"),
  ("FD-58", "backlog", "P2", "fabric-dashboards (design), Project Observatory (channels.local)", "Supervision on Windows/Linux through `node.lifecycle`: Observatory 0.29.0 serves it; our next step is to read its schemas and decide with ADR-0002.", "Q-05"),
  ("FD-59", "backlog", "X", "Project Observatory", "Reach the node through `channels.local` in its descriptor; not announced yet.", ""),
  ("FD-61", "backlog", "X", "Project Observatory node", "One shared MCP server instead of one stdio process per session; served by the node, never by the app.", ""),
  ("FD-68", "backlog", "X", "Fabric COM-02", "Runner-route events in an agent's activity.", ""),
  ("FD-08", "backlog", "C", "", "Superseded by ADR-0011; PR #11 closed. Status already says nothing remains.", ""),
  ("FD-67", "backlog", "C", "", "Closed 2026-10-14, not reproduced.", ""),
  # --- the Fabric board task
  ("task 16b6948f", "fabric-board", "C", "the operator", "Fabric board task 'Load (service-load/1), release 0.7.26' sits in review; 0.7.26 shipped 2026-10-23 (release run 39955756486). Closing is the operator's move.", ""),
]

here = pathlib.Path(__file__).parent
json.dump([dict(id=i, source=s, cls=c, owner=o, what=w, questions=q) for i, s, c, o, w, q in ITEMS],
          open(here / "inventory.json", "w"), ensure_ascii=False, indent=1)
order = {"H": 0, "P1": 1, "P2": 2, "X": 3, "B": 4, "C": 5}
rows = ["| ID | Class | Owner | What | Questions |", "|---|---|---|---|---|"]
for i, s, c, o, w, q in sorted(ITEMS, key=lambda r: order[r[2]]):
    rows.append(f"| {i} | {c} | {o or '-'} | {w} | {q or '-'} |")
print("\n".join(rows))
print(f"\n{len(ITEMS)} items:", {k: sum(1 for r in ITEMS if r[2] == k) for k in order})
