# ADR-0008 — A missed probe is not an outage

Status: accepted · 2026-10-01 · refines the down rule of the
[design §3.3](../design/2026-09-28-fabric-dashboards-design.md#33-service-states) and the
notification rule of §3.6

## Context

On 2026-10-01 the installed 0.3.0 kept sending "<Service> is not answering", then "<Service> is
back", for services that were running. The Mac's load average had reached 192. Between load
spikes the services answered a direct `curl` in 2–20 ms. The app's probe gave up after 2 s, and
the MCP `activity` call reported "no answer within 2000 ms" for services that `list_services`
had shown ready a moment earlier.

The code already measured an outage by time: silence counted from the first missed probe, `down`
after 15 s (`DOWN_AFTER_MS`), a notification after 30 s. But the time was measured with too few
probes. In the background the probe runs every 30 s, so two slow answers 30 s apart made a
service `down` and sent the notification at once. The recovery that followed then sent "is
back". Two missed probes are a slow Mac, not an outage.

## Decision

1. **A probe waits 5 s** (`PROBE_TIMEOUT_MS` in `src/core/probe.ts`), in the window and in the
   MCP server. A loaded Mac answers late, not never.
2. **Silence counts only after three missed probes in a row** (`DOWN_AFTER_MISSES` in
   `src/core/monitor.ts`). The time window is kept as it was, and a count is added to it,
   because the code already models the window (`firstUnansweredAt`, `DOWN_AFTER_MS`) and the
   count fixes how it was measured. Until the third miss, the last answer stands. Two
   exceptions: launchd says the job is off (then the service is Off at once), or launchd now
   runs another pid (then the old answer is not replayed, and the service shows as waiting).
   The outage still counts from the first miss.
3. **A missed probe is checked again at the visible cadence (5 s)**, even when the window is
   hidden. Three misses take about 10 s, not 90 s.
4. **The not-answering notification needs a failed probe after 60 s of silence**
   (`DOWN_NOTIFY_AFTER_MS` in `src/core/notify.ts`, which was 30 s). A tick with no probe never
   decides. So a service that answers again before that sends nothing.
5. **"Is back" is sent only after a not-answering notification was sent**, as before. Activity
   still records every `down` and `back`, so a flap is visible without anyone being notified.

The shared `deriveState` in `@passioncode-ai/fabric-service-host` and its state-precedence
vectors do not change. The monitor decides what evidence it passes to them. The MCP
`list_services` call is still a single look with no history. It only gets the longer timeout.

## Consequences

- An outage now takes 60 s or more to notify, where it took 30 s.
- A service that does not answer for 10–15 s first shows as waiting, then as not answering.
- `test/flap.test.ts` drives the monitor with a scripted clock and scripted probe answers. When
  single-probe flipping (`DOWN_AFTER_MISSES = 1`) or the 2 s timeout is planted back, those
  tests fail.
