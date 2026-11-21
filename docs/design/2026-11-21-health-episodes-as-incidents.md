# Health episodes as `incident/1` records, and the freshness trigger (FD-359, SD-DSH-01)

Status: design only, 2026-11-21. Nothing here is built. The build starts when `incident/1` is on the contract's main
(SD-CON-01) and Observatory's ledger accepts reports (SD-OBS-04); the owner's pause holds new behaviour until then.
Source of the order: the system plan's spec for this app, feature SD-DSH-01
([fabric-workspace `ea088d67`](https://github.com/passioncode-ai/fabric-workspace/blob/ea088d678037836ebdd678cacf9112658df0f59c/docs/plans/2026-11-21-system-design/specs/fabric-dashboards.md)),
row FD-359 of [the backlog](../backlog.md).

## What is asked

Each episode of this app's watcher is reported as one `incident/1` record, and one new trigger is added: a service
whose data is older than the freshness it declares. Acceptance is the plan's drill (f): a service's data cut on purpose
raises one incident within 5 minutes, the incident closes on good readings, and no second incident appears per poll.

Must not break: `fabric-service/0.1` readers, `fabric-dashboards://` links, the two MCP doors and their operations, the
standalone app, one watcher per machine (AH-D2).

## What exists today (read 2026-11-21 at `452b1a9e`)

| Fact | Proof |
|---|---|
| A health episode opens after two bad readings in a row and closes after two good ones | `src/core/agent-health.ts:20`, `:21`, `:158`, `:162` |
| A product's health report is read every 5 minutes | `src/core/agent-health.ts:18`, `src/electron/health-poller.ts:51` |
| A health episode's key is `<product>:<check id>@<UTC day of the opening report>`; a report nobody can read is one episode with the check id `blind` | `episodeKey`, `src/core/agent-health.ts:106`; `BLIND`, `:23` |
| A health episode holds counts and codes only: state, area, count, fix, reason, when it opened and closed | `HealthEpisode`, `src/core/agent-health.ts:119` |
| An outage episode opens when a service is confirmed unavailable, is told to the operator after 15 minutes and closes after 15 well minutes | `Episode`, `src/core/outage-alerts.ts:29`; `OUTAGE_ALERT_AFTER_MS`, `:17`; `OUTAGE_CLEAR_AFTER_MS`, `:20` |
| An outage episode's id is `outage:<service key>:<start, Unix seconds>`, the same across restarts | `idOf`, `src/core/outage-alerts.ts:189` |
| Both kinds live in one file, `outage-alerts.json`, written by the main process only | `OutageState`, `src/core/outage-alerts.ts:48`; `src/electron/outage-alerts.ts:154` |
| Agents read the health book through the operation `agent_health` | `src/mcp/schema.ts:205`, `agentHealth`, `src/mcp/tools.ts:379` |
| Only a load report is judged stale today, by its own window: older than two windows | `packages/service-host/src/load.ts:233` |
| `incident/1` is not in the contract yet: no file of `fabric-agent-contract` main (`699265601dfe`) names it | `gh api repos/passioncode-ai/fabric-agent-contract/git/trees/main?recursive=1`, filtered by `incident`: no match, read 2026-11-21 |
| No surface of `fabric-service/0.1` carries a declared freshness; the contract's self-healing draft speaks of a check such as `data_refresh` in the agent's own health report | the same tree filtered by `freshness`: no match; `docs/reports/2026-11-20-manifest-research/draft/self-healing.md` line 32 there |

The record's fields are known only from the system design (Layer A, item 3): fingerprint, class, scope (session, service,
machine, organization), severity (`notice`, `degraded`, `system`), first and last seen, count, the sensor, the owning
project, state (`open`, `held`, `fixing`, `verifying`, `closed`), the lesson id; counts and codes only, never content.
The mapping below is written against that list and is revised when the schema lands.

## Decisions

D-1. **The sensor reports transitions, the ledger owns the incident.** This app sends a report when an episode opens,
when its severity changes and when it closes. It never sets `held`, `fixing` or `verifying`, never writes a lesson id
and never raises `system`: joining sightings into a `system` incident is the ledger's rule (design Layer A, item 6).
Why: the design keeps sensors model-free and gives the ledger to Observatory.

D-2. **One incident per episode, by the episode's own key.** The report's idempotency key is the key the episode
already has (`<product>:<check>@<day>`, `outage:<key>:<start>`), so a retry, a restart and a second poll are the same
incident. A poll that changes nothing sends nothing. This is the "no second incident per poll" of the acceptance.

D-3. **The fingerprint carries no date and no instance of time.** It joins sightings across days and machines, so it is
built from codes only: see the table. The episode key (D-2) is the id of one sighting, the fingerprint its kind.

D-4. **Reporting an incident does not wait for the operator's message.** The 15 minutes of FD-76 hold back a message to
a person; the ledger is told when the episode opens. The messages, their timing and their channel stay as they are.

D-5. **Freshness is read only where it is declared, and never guessed.** A service with no declared freshness raises no
freshness incident. Until the contract names the declaration (open question Q-2), the only declared figure is a load
report's `windowSeconds`, and FD-359 does not turn its existing `stale` mark into an incident.

D-6. **A freshness reading is a third kind of cause in the same book**, beside a check's and `blind`, so it opens and
closes by the same two-readings rule, reaches the operator by the same channel and is listed by the same operations.
Why: one watcher per machine (AH-D2) and one place for episodes; a second ledger of the app's own would be a fourth
watcher.

D-7. **The agent door first, no screen.** A read-only operation `incidents` behind `search` and `execute` lists every
open or owed episode as the incident record this app would report, with whether the ledger took it. `agent_health`
keeps its answer unchanged. A screen is added only if a person turns out to need one (the plan's rule for every feature).

D-8. **What never becomes an incident:** an agent turned off (FD-123), an entry waiting for setup (`setup: true`,
DEC-0044), a degraded source that is not an outage (FD-76), an episode that closed before it was ever reported.

## The mapping

| `incident/1` field | Health episode (FD-285) | Outage episode (FD-48, FD-76) | Freshness episode (new) |
|---|---|---|---|
| id of the sighting (idempotency) | the episode key | `outage:<service key>:<start>` | `<product>:fresh_<surface>@<UTC day>` |
| fingerprint | `health.<product>.<check id>`; for an unreadable report `health.<product>.blind.<reason>` | `service.<id>.<instance>.down` | `data.<id>.<instance>.<surface>.stale` |
| class | the check's `area` (HL-3) | `lifecycle` | `connection` |
| scope | service: the product | service: `id.instance` | service: `id.instance` |
| severity | `warn` is `notice`; `fail` and an unreadable report are `degraded` | `degraded` | `degraded` |
| first seen | `openedAt` | `start` | when the second stale reading was taken |
| last seen | the book's `readAt` at the report | the look that last saw it unavailable | the last stale reading |
| count | bad readings in a row (`causes[id].bad`) | 1 | stale readings in a row |
| sensor | `fabric-dashboards` with its version | the same | the same |
| owning project | the repository Observatory's registry gives the agent (`organizations.json`, FD-162); unknown is said as unknown | the same | the same |
| state the sensor sends | `open`, then `closed` after two good readings | `open`, then `closed` when the episode ends (15 well minutes, or the service removed) | `open`, then `closed` after two fresh readings |
| lesson id | never set by the sensor | never | never |

A check's own `count` (HL-1) is a different number from the incident's count and is sent only if the schema has a field
for it. Nothing else of a report is sent: no name a service wrote, no path, no log line (DEC-0157, the HL rules).

## The freshness trigger

- **What is read.** For each local or online service that answers and declares a freshness for a surface, the time
  that surface says its data was produced (`generatedAt` on usage and load; the events feed's newest row) against the
  declared freshness. A reading is `stale` when the data is older than the declaration, `fresh` when it is not, and
  `unknown` when the surface did not answer or carried no time. `unknown` opens nothing here: a service that does not
  answer is already an outage or a `blind` episode, and one cause must not raise two incidents.
- **Cadence.** Its own pass every 2 minutes, only over services that declare a freshness (none today, so the idle
  budget of the Lifecycle section is unchanged until one does). A first stale reading is read again 60 seconds later;
  two stale readings open the episode. Worst case from the moment the data crosses its declared age to the incident:
  2 minutes to the pass, 1 minute to the second reading, inside the drill's 5 minutes.
- **Requests.** One GET per declaring service per pass with the descriptor token, after the loopback owner check
  (FD-156), 5 s deadline, one pass in flight at most. At most 30 an hour per declaring service, plus one per stale
  reading. A usage or load report read within the last 30 seconds for a screen is reused (ADR-0014's rule).
- **Closing.** Two fresh readings in a row close it (AH-D4), and the close is reported once.
- **Muted and turned off.** An agent whose outage messages the person muted is still read: muting holds the
  message, not the incident (D-4). An agent turned off is not read at all (FD-123).

## Delivery

- The queue is the state: `outage-alerts.json` gains, per episode, what the ledger took (`incidentOpened`,
  `incidentSeverity`, `incidentClosed`), set only when the ledger answered, as `failureDelivered` is today. A report
  the ledger did not take is tried again on the next 30 s tick, at most once a minute, with the same key.
- An episode that opened and closed before any report was taken is dropped unreported (D-8), as a message is today
  (`src/core/agent-health.ts:162`).
- The main process alone reports (one watcher per machine); each MCP server only reads the file.
- The route to the ledger is SD-OBS-04's to name. This app calls it as it calls a notification channel: a local
  service's door found through its descriptor, no key of this app's own, no token in a URL or a log.
- With no ledger on the machine (a standalone install), nothing is reported and nothing is queued for more than a day
  (`OUTAGE_GIVE_UP_MS`); the episodes, their messages and both operations work as they do now.

## Acceptance checks for the build

1. Unit: each row of the mapping table as a vector (`test-vectors/incident-mapping.json`), run by this app and offered
   to the contract.
2. Unit, on a fake clock: 12 polls of one bad check send one `open`; a `warn` that becomes `fail` sends one severity
   change; two good readings send one `closed`; a restart between them sends nothing twice.
3. Unit: `unknown` freshness beside a `blind` episode sends one incident, not two.
4. Lifecycle test: with no service declaring a freshness, a quiet hour makes no new request (LC-08 budget unchanged);
   with one, at most 30 an hour.
5. Drill (f) on the installed app, run twice: a sample service's usage data frozen, one incident in the ledger within
   5 minutes, closed after the data moves again, one incident in total.
6. `agent_health` answers the same bytes as before for the same file; `incidents` is found by `search`.

## Open questions, with the answer assumed until one arrives

- Q-1 (contract, SD-CON-01): the schema's names and the vocabulary of `class`. Assumed: the health areas of HL-3.
- Q-2 (contract): where a service declares freshness. Assumed: a field per surface in the service's well-known answer
  or its manifest (`agent-manifest/1`), in seconds; this app reads whichever the contract names and nothing else.
- Q-3 (Observatory, SD-OBS-04): the door that takes a report, and whether a sensor's `closed` closes the incident or
  moves it to `verifying` until a lesson is written (design Layer A, item 7). Assumed: the ledger decides; the sensor
  sends the reading.
- Q-4 (contract): whether a fingerprint may name an instance (`id.instance`) or only the product. Assumed: it may,
  since two instances of one agent fail apart.

## Not in this design

The diagnosis, the router, the «fix first» line and the lesson (Observatory, the pulse and Fabric own them); the
self-healing ladder a service runs on its own stale data (`self-heal/1`, the agent's side); any screen.
