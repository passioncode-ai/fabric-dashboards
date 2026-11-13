# The architect's validation of Fabric Dashboards

The operator's rule of 2026-11-13 (fabric-workspace `knowledge/north-star.md` §6, «Merged with the North Star,
validated by the architect»; board announcement `d4404828`): before an agent is built or changed, the architect is
consulted, and at each release the architect's audit runs and its verdict is kept in the agent's repository.

| Date | What ran | Result |
| --- | --- | --- |
| 2026-11-13 | `python3 tools/audit.py scan <this checkout>` in fabric-agents-database at `2ea5dd1`, on this repository at `7a8596b` (0.8.67); read only | [2026-11-13-scan.json](2026-11-13-scan.json): no template fits closely (best `delivery-gateway` 9.05, `host-operations` 7.75, by libraries and text). Fabric Dashboards is the host the agents run under (a desktop app, `fabric-service/0.1` reader), not an agent assembled from a template of the base, so the ranking names no template to follow and no blocking gap |

**Not run yet:** the judged half (`audit.py start`, which writes the audit folder in fabric-agents-database, judged by
its `playbooks/audit-agent.md`). It belongs to fabric-agents-database's G30 pass with each owner; this repository
asks it on the board (thread `16093ded`) instead of writing in that repository.
