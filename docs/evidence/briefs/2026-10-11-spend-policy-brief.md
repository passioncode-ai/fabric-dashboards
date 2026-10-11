# Brief — spend policy and access levels: agents check a record instead of asking (2026-10-11)

**Status: proposal.** It is written by the Fabric Dashboards session and handed to each owner. Nothing here changes
another product.

The operator's request (2026-10-11): other agents keep asking for proof. Set up access levels so that:

1. the first spend in a project settles its limit;
2. a task whose cost varies (research: how many paid tools, how deep) offers fixed options at launch;
3. a project can carry a standing policy;
4. work can also continue without limits, with only the API-level caps stopping it;
5. remote agents get a channel with a limit, so the operator can share an agent with other people for a given
   project.

The operator also gave an example of how not to ask: a cross-session approval request was held by the
receiving session's permission mode and expired undelivered, while the sender waited.

## Why agents ask today (measured 2026-10-11)

| Cause | Evidence |
|---|---|
| Authority lives where other agents cannot find it | The operator approved the Chinese model on 2026-10-10 (Copylot DEC-0045: "cancel DEC-0041, ceiling $30, wallet +$60, Chinese model — подтверждаю"). The translating agent (fabric-workspace session, PR #87) did not know and asked again with two options. |
| No rule on using another agent's key | `use_secret.py run` lets any local process run with any project's slot. It only audits (`use_secret.py:24-32`); it does not authorize. Switchboard's `#project/env/NAME` can pin any project's key. `handling-secrets` and CLAUDE.md say nothing about one agent's key paying for another agent's work. |
| Caps exist only per key | 12 OpenRouter keys, each with its own ceiling ($10 to $250, `openrouter.py list`). No project, task or estate total exists anywhere. Contract DEC-0021/0027 *report* budgets; the service enforces, the host only shows (`service.md:162`). `limits.costMicrounits` is declared but nothing enforces it. |
| Spending money is not classed | CLAUDE.md keeps only "business decisions" human. The one machine threshold is Research Agent's `agent_auto_approve_usd: 0.50`. |
| Grants carry no amount | Contract standing grants (`governance.schema.json`) and Fabric's `grants` table have no money field, though `governance-and-roles.md:27` requires amount limits. RM-03's "ask above an amount" is research. |
| Approvals travel as chat | A request held by a permission mode expires undelivered. OC-3 already says "chat membership is not consent". |
| Agents' picture of keys and caps goes stale | One agent said 3 agents hold OpenRouter keys; there are 12. Research Agent's cap is $70 in the ledger and $60 in its docs. Copylot's `humanSteps.connectModel` still contradicts DEC-0044/0045. |

## The model: four levels, the most specific one that exists decides

| Level | What it limits | Set by, when | Exists today |
|---|---|---|---|
| **L0 API**: each upstream key's ceiling, plus one **estate total** across keys | everything; the hard stop | the operator, in Observatory's provider door | per key yes; the estate total no |
| **L1 Project policy**: monthly cap, auto-approve threshold per task, allowed model classes (for example "Chinese models allowed"), the credential source (the project's own key, or a named agent's capability) | every agent working on the project | **asked once**, at the project's first paid run (LC "setup asks once"); later changed in one place | no |
| **L2 Task budget**: for tasks whose cost varies, the agent declares **presets** (Research: Quick $0.10 / 3 pages, Standard $0.50 / 10 pages, Deep $3 / 4×10 pages with paid tools); the launcher offers them, and the choice becomes the task's grant | one run | the person, at launch, from the offered options; an agent within L1's threshold picks itself | Research Agent only (`max_usd`, depth) |
| **L3 Call**: `maxChargeUsd`, `max_usd`, `limits.costMicrounits` | one call | derived from L2 | per service, not shared |

A project may choose **"no project limit"**. Then only L0 applies, and that is said in the policy: the choice is
recorded, not a missing value.

**The proof is a grant record, not a message.** Every level is a **grant** in one registry:

- **Fields:** issuer, principal (an agent, a session, or a remote party), project, capabilities or effects,
  credential source, `limitUsd` + period, `perCallMaxUsd`, `autoApproveUsd`, model classes, expiry, revocation,
  and the decision it came from (for example "Copylot DEC-0045").
- **Before spending:** the agent asks the registry (`grant check --project X --capability translate --spend 0.40`),
  not the operator. "Allowed" carries a receipt id that goes into the usage report and the activity row.
  "Denied" names the level that refused.
- **Above a threshold:** the agent files **one** approval request as a durable record, shown on the board and in
  Dashboards, and answered through the operator channel's confirm token (DEC-0034 OC-6). Then it **goes on with
  other work**. It never waits on a chat message.

**One agent never spends another agent's key.** It calls the owner's capability, whose own wallet and limits apply
(the translator calls Copylot's `copylot.write` with `zh-*` → Qwen, within DEC-0045's $30). Otherwise the project
policy names a key the provider door issues *for that project*, with its own ceiling. The registry refuses a
borrow, and so does the door.

**Sharing with other people (the remote channel).** A **share grant** has these fields: principal = an external
person or organization, callee = one of the operator's agents, the capabilities, the project, `limitUsd` + period,
expiry, the payer (the owner within the limit, or the guest's wallet), and revocation. The call goes through
Fabric's Hub (`agent.call`, ADR-0115 access grants, already built without an amount) or the A2A gateway (RM-17).
Metering is per grant: usage reports carry the grant id (DEC-0021 + a `grantRef`). The owner sees spend per
guest; the guest sees their own (plans D5). Principle §7 still holds: a private agent is shared only by an
explicit share grant, never listed.

## Where each part lands, and who owns it

| Owner (session) | Change |
|---|---|
| **Contract** (fabric-agent-contract) | A DEC for spend policy and grants with amounts: `limitUsd`, `period`, `perCallMaxUsd`, `autoApproveUsd`, `modelClasses`, `credentialSource`, `principal.kind = agent \| session \| external`, `grantRef` on execution context and usage. Task `costPresets` in `fabric-agent.json`. The no-borrowing rule. Make `limits.costMicrounits` enforced by the callee. |
| **Observatory** (project-observatory-3d) | The grant registry and `grant check` (CLI + MCP). The **estate total** cap. `use_secret run` checks the caller's principal against the project's grant, so a slot is no longer usable by any process. The provider door issues per-project keys. Approval requests as durable records. |
| **Fabric** (fabric-90) | Ask the project policy once at the first paid run. Offer task presets at launch (Quick / Standard / Deep, "no limit"). Admission reads grant state (ADR-0023: unknown means deny). Hub share grants gain amounts and a guest view. |
| **Switchboard** (fabric-switchboard-93) | Project pools carry daily USD ceilings (RM-20, SB-72). A fallback chain may pin only the keys the project policy names. |
| **Dashboards** (this session) | Spend shows each project's and agent's policy, remaining budget and grants, including "no project limit". Fix/Update with agent asks the preset when the agent declares `costPresets`. Approval requests appear in Overview's Needs attention. An MCP tool `policy` lets an agent read the project policy and grants. |
| **Copylot** (copylot-agent-e6) | Fix `humanSteps.connectModel` (stale since DEC-0044/0045). Take `maxChargeUsd` from the caller's grant. Offer translation as a capability other agents call, so nobody borrows its key. |
| **Research Agent** | Already the reference for L2 (presets, `max_usd`, auto-approve). Read the threshold from the project policy. Fix the ledger/docs cap drift ($70 vs $60). |
| **fabric-workspace** (fabric-workspace-91) | The principle "authority is a record agents check, not a question". The no-borrowing rule. Approvals never block. RM-03, RM-04, RM-17 and RM-21 link here. |
| **Global agent rules** (`~/.claude/CLAUDE.md`, the operator's file) | Until the registry exists: before asking, check the decision records of the agent that owns the capability. Never spend another agent's key; call its capability. Above a threshold, file the request and continue. |

## Decisions that are the operator's (with recommended defaults)

1. **The default at a project's first paid run:** offer $10 / $30 / $100 a month, or "no project limit", with $30
   preselected.
2. **The default auto-approve threshold per task:** $1. Above it, one durable request.
3. **Who pays for a share grant:** the owner, within the grant's limit. A guest wallet comes with commerce
   (PR #34).
4. **The estate total across all keys:** the sum of today's ceilings is $750/month (12 keys). Recommended: start at that, and
   alert at 80%.

## Immediate case: the Chinese-model translation

This needs no new decision. DEC-0045 (operator, 2026-10-10) already set the ceiling at $30, the wallet at +$60
and the Chinese model (Qwen 3.8 Max for `zh-*`). The translator should call Copylot's `copylot.write`
(`locale: zh-*`, with `maxChargeUsd` per call). Option 2, taking a private agent's OpenRouter key directly, is the
borrowing this brief rules out.
