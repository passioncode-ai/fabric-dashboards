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
