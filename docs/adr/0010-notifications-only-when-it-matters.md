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
  source that is not setup. First the contract's flag (DEC-0044, fabric-agent-contract `c6c5af1`): an entry with
  `setup: true` waits for a person and never opens an episode, nor enters the baseline; the service page says it as
  waiting for setup (`reason.setup`). For a service that does not send the flag yet, the fallback is a degraded
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
  restarts does too. A `down` still counts. The services' own report after recovery (a `notify: true` warning) covers the rest, and a service that sends
  DEC-0044's `setup` flag is never guessed about.
- **Proof.** `test/outage-alerts.test.ts` covers the episodes on a fake clock: the five-minute rule, a flicker, down to
  degraded, setup baselines, delivery that fails or whose channel is down, removal, muting and eventId length. It
  also runs the client against a local streamable-HTTP server: JSON and multi-line SSE, both tool spellings,
  refusals, a path that names another host, and the session's close. On 2026-10-11 a read-only call
  (`<id>.status`) to this Mac's real operator-channel service answered through `callCapability`. No test message was
  sent to the operator.


## Amendment 2026-10-19: the Telegram channel carries only outages over fifteen minutes (FD-76)

The operator set a rule for every agent on 2026-10-19 (fabric-workspace `knowledge/agents-first.md`, *Messages to
the operator in Telegram*; board thread `a28f6852`): the channel carries only what needs the operator's attention (a
failure lasting over 15 minutes, money, a decision only the operator can make), one case once, and no routine. The
installed 0.7.14 had sent 798 messages in 8 days through FD-48's channel: 311 outages, 309 recoveries and 203 event
banners (`main.log`, 2026-10-12 to 2026-10-19). So, from 0.7.15:

- **Only an agent that does not answer opens an episode** (`down`, ADR-0008). A degraded source the agent reports while
  it answers stays on the Mac: the operator's decision of 2026-10-11 named an agent that is *unavailable*, and the
  degraded sources were this app's own extension. While an episode is open, a degraded source still keeps it open,
  so going from down to degraded is not a recovery.
- **Fifteen minutes each way.** The failure is sent once the agent has not answered for 15 minutes
  (`OUTAGE_ALERT_AFTER_MS`); the episode closes, and "back" is sent, once it has stayed well for 15 minutes
  (`OUTAGE_CLEAR_AFTER_MS`). An agent that falls again within those 15 minutes is the same case: no second failure
  and no second recovery.
- **Event banners stay on the Mac.** A *failed* or *attention* banner from an events feed is no longer sent to the
  channel (it was sent as `failure` and `result` since FD-48).
- **No daily summary.** The rule's daily summary is per agent, about its work. Dashboards does no work of its own to
  report; its outages already reach the channel when they happen.
- **Proof.** `test/outage-alerts.test.ts`, *FD-76* tests: nothing under 15 minutes; one failure and one recovery
  after a 15-minute calm; a fall within the calm is one case; a degraded source alone sends nothing.

**Correction 2026-10-20 (0.7.16).** The installed 0.7.15 sent 12 messages in its first seven hours (about 100 a day
before), but two of its four outages were false: an agent down for about 20 seconds got "down" and "back" 18 seconds
apart fifteen minutes later (`main.log`, 2026-10-19 21:21 UTC; another, down about 2 minutes, got them 2 minutes
apart). The failure was owed by the age of the open episode, and an episode stays open through its fifteen-minute
calm. Since 0.7.16 the failure is owed only while the agent is unavailable at that moment (`owed`, `clearSince ===
null`); a fall within the calm is still the same case and is told at once. Proof: `test/outage-alerts.test.ts`, *FD-76:
a short outage looked at every minute through its calm sends nothing*.

## Amendment 2026-10-27: a decision reaches the operator away from the Mac (FD-125)

**Context.** sshlg-growth's config draft `19b6e758` waited eleven hours (2026-10-25): growth wrote a notifying events-feed
row (`draft.awaiting_approval`, `notify: true`) at night, it stayed a banner on the Mac under the 2026-10-19 rule, and the
operator never saw it. The operator, relayed by another of the operator's projects (finding `5792c0e4`, 2026-10-25): «передай
агенту гроуз что по UX на дашборде полная беда и уведомления пусть включит»; in growth's chat 2026-10-27: «делай».
Growth's request on this board: `482a8030`.

**Decision.** A notifying events-feed row whose intent is `ask` (a person must act: an approval, a choice, a decision
owed, a guardrail stop; `intentOf` in `src/core/notify.ts`, which now also reads `decision_needed` and
`guardrail_stopped`/`guardrail_breached`) also goes to the operator channel, from any agent: one message per event id
(`ask:<service key>:<event id>`), with the agent's own words and the `fabric-dashboards://` link to the page the row names.
The same question (its notification episode) is not sent again within a day. The person's own rules hold at send time:
a pause, quiet hours or a muted agent hold the message until they allow it (it is not lost), and a message the channel
never takes is given up a day after the event. The queue lives in `outage-alerts.json` beside the outages, which are sent
first. Failures, warnings and routine stay on the Mac, as the 2026-10-19 rule says.

**Why not a kind list per agent.** Growth offered a list of its kinds, or a field it would set. The contract's events
already carry what a host needs (`notify` and the kind), and the ask intent is the one the Mac banner uses for "Needs
your decision"; every agent that waits for the operator gets the same treatment without a list to keep. A field that
marks a decision explicitly belongs to the contract (CT-150, Fabric CO-448), not to one host.

**Correction 2026-10-27 (FD-131).** The message goes as the channel's kind `result`, never `question`: the channel's
`question` carries a binding (`questionId`, `revision`, `expiresAt`) and a peer it routes the person's reply to
(the channel's own check of each event), and refuses one without it (`question_binding_required`).
The decision is taken on the agent's page the message links, so nothing waits for a reply in the channel.

