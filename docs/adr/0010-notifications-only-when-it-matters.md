# ADR-0010 — Notifications only when it matters

Status: accepted · 2026-10-01 · refines the notification rule of the
[design §3.6](../design/2026-09-28-fabric-dashboards-design.md#36-notifications-and-updates) and SCN-020

## Context

On 2026-10-01 the operator's services sent 405 events with `notify: true`. The installed app turned
every one that passed the level filter into a macOS banner titled with the service name alone:

| Events | What it was |
|---|---|
| 302 | one low-disk warning from two instances of one agent, re-sent at each flap between degraded and healthy |
| 86 | findings re-opened after being cleared, the same subjects again and again |
| 39 | questions waiting for a choice, many on the same subject |
| 14 | deliveries the operator had not asked to hear about |

Two instances of one agent read alike (one name, twice), a banner did not say what
the agent wanted, and several events at once became "3 new from X". A second channel also existed:
one service raised its own banners through `osascript`, so the operator saw the same finding twice,
from a sender that was not Fabric Dashboards. Counted from
`~/Library/Application Support/Fabric Dashboards/activity.jsonl` on the operator's Mac (all days).

## Decision

1. **The service asks, the host decides.** `notify: true` stays the protocol's request
   (`fabric-service/0.1` is unchanged). The host turns a request into a banner only when its
   **intent** is one of three (`intentOf` in `src/core/notify.ts`):
   - **ask** — the agent is blocked on the operator: a kind containing `awaiting`, `approval`,
     `human_step.opened`, `needs_review`, `review_requested`, `confirmation_requested`;
   - **failed** — level `error`;
   - **attention** — level `warning`.

   Endings and progress (`*.recovered`, `*.cleared`, `*.choice_made`, `*.delivered`, `*.done`,
   `*.finished`, `*.started`, `*.queued`, …) and plain notices are **quiet**: Activity only.
2. **One episode, one banner.** An episode is a subject's event kind on one instance
   (`subject.type:subject.id`). A warning without a subject is a state of the agent's world, so all
   instances of that agent share it; a failure without a subject is told apart by its sentence. An
   episode is told again only after its cool-down: failed 6 h, attention 12 h, ask 24 h
   (`COOLDOWN_MS`). The record (`notified.json` in the app's data; episodes older than 48 h are
   forgotten) survives a restart.
3. **Who and what.** Title: the agent, with its instance when it is not `default`
   (`displayName` in `src/core/names.ts`, also used in the sidebar). Subtitle: what it wants —
   "Needs your decision", "Failed", "Needs attention". Body: the agent's own sentence. A click opens
   the event's link in that service. Several admitted events from one poll make one banner —
   "3 need you · needs your decision", the most urgent sentence — and a click opens Activity.
4. **One channel.** A service that has a descriptor delivers through its events feed and raises no
   banners of its own. The rules for service authors are in the `building-fabric-services` skill
   (`fabric-agent-adapter`).
5. Unchanged: the switch, pause, quiet hours and the per-service level floor (`shouldNotify`)
   apply first; outages keep [ADR-0008](0008-a-missed-probe-is-not-an-outage.md).

## Consequences

- Per agent and subject, one banner a cool-down where there were dozens; questions and failures
  still arrive at once.
- A delivery is no longer a banner. It is in Activity and in the unread count.
- An agent that names its kinds badly is quiet rather than noisy: a request meant as a question
  must say so in its kind (`*.awaiting_*`, `*.approval_*`, `human_step.opened`).
- `test/notify.test.ts` holds the 2026-10-01 cases; `test/monitor.test.ts` checks a repeated
  question and a delivery against a live sample service.

## Amendment 2026-10-11 — outages reach the operator away from the Mac (FD-48)

The operator decided on 2026-10-11, after a service's live database was down for 3 h 07 min and nobody was told: *if a
service is unavailable for more than five minutes, one message goes to the operator's channel, and a second when it
comes back; the shared service watcher in Fabric Dashboards sends it, not each service on its own.*

- **The channel.** An installed service on this machine that declares an MCP capability `<id>.notify` on a
  streamable-HTTP surface (the contract's operator channel, OC-4; `notifyChannelOf` in `src/core/outage-alerts.ts`).
  Settings → Notifications → *Also send outages to*: **Automatic** (the one service that offers it; none or several
  is no channel, and Settings says which), **Off**, or a chosen service (one that is installed but not answering
  is *unreachable*, and messages wait for it). The call goes to `127.0.0.1` only (trust
  tier T0, ADR-0144 amendment 4) with the service's own descriptor header when it names a token file
  (`src/core/mcp-client.ts`). The tool is found in the session's `tools/list` under either spelling
  (`relay.notify` or `relay_notify`).
- **An episode.** One per service, open while it has a cause: a confirmed outage (`down`, ADR-0008), or a degraded
  source the service did not report when it started. The baseline is the degraded sources at the service's
  `process.startedAt`. It is kept across the app's restarts, and a baseline source that recovers leaves it, so its
  next failure counts. A setup state present since the start is never an outage; a source that appears later is.
  The episode closes only after the service has stayed well for two minutes (`OUTAGE_CLEAR_AFTER_MS`), so a
  flicker is one outage; going from `down` to a degraded source is not a recovery.
- **What it owes, and when it is delivered** (`observe`, `owed`, `delivered` in `src/core/outage-alerts.ts`). Once
  an episode has lasted five minutes (`OUTAGE_ALERT_AFTER_MS`) it owes one `failure`, and after the failure one
  `recovery` (or "was removed", for a service gone from the folder). A message counts as delivered only when the
  channel answered; the state is the queue (`outage-alerts.json`, its last good copy `.bak`). So a failed delivery,
  a missing channel or a restart loses nothing, and the first failure stops the round, so a recovery never comes
  before its failure. An outage that closed before its failure could be delivered (the channel itself was down) is
  told once afterwards: unavailable N minutes, why, and that it works again. A message the channel never takes is
  given up a day after its episode closed. One eventId per episode and step (`outage:<key>:<start s>`, `…:back`,
  with no `/` and at most 160 characters) makes a repeated try a single message.
- **The call.** At most 15 s overall, an answer of at most 1 MB, the session closed after the call. The host and
  port come from the service's origin only.
- **Banners too.** An events-feed banner whose intent is *failed* or *attention* (decision 1) is also sent: a
  `failure` and a `result` respectively. An *ask* stays on the Mac, because a question needs its own record in the
  channel.
- **The person's rules apply.** The switch, the pause, quiet hours and the per-service switch (`shouldNotify`) gate
  the channel as they gate banners. An episode they muted is not sent, and neither is its recovery.
- **Known limit.** A failure that appears under a source before the watcher's first look after the service started
  becomes part of the baseline, until that source recovers once. A failure that is already there when the service
  restarts does too. A `down` still counts. The services' own report after recovery (a `notify: true` warning) covers the rest, and an explicit
  `degraded[].setup` flag is proposed to the contract, which would end the guess.
- **Proof.** `test/outage-alerts.test.ts` covers the episodes on a fake clock: the five-minute rule, a flicker, down to
  degraded, setup baselines, delivery that fails or whose channel is down, removal, muting and eventId length. It
  also runs the client against a local streamable-HTTP server: JSON and multi-line SSE, both tool spellings,
  refusals, a path that names another host, and the session's close. On 2026-10-11 a read-only call
  (`<id>.status`) to this Mac's real operator-channel service answered through `callCapability`. No test message was
  sent to the operator.

