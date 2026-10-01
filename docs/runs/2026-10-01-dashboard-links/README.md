# Dashboard link routing implementation

Authorized 2026-10-01: implement the reviewed dashboard deep-link design. Scope:
MCP host discovery, strict opening, consumer instructions and regression tests.
Existing protocol negotiation is retained; no MCP wire migration or service supervisor.

## Requirements and checks

- R1: installed host open failure never opens HTTP; failing test first in test/mcp.test.ts.
- R2: distinguish absent/unknown/incompatible/wrong handler; test/host.test.ts.
- R3: explicit fallback=never; JSON-RPC tool errors expose bounded machine reasons.
- R4: host-generated link is the primary action; initialize instructions + tool descriptions.
- R5: repeat links reuse the service view; real Electron test with a disposable service.

## Sources and route

AGENTS.md and fabric-workspace knowledge README/vision/principles/how-to-work/rules
were read. task-pipeline implementation profile: confirmed design → tests/code →
repository gate → branch handoff. Scope/evidence/dependencies/resume belong to this
file. ux-scenarios updates SCN-026/028; agent-interop preserves 2025-06-18 tools and
structuredContent compatibility. No subagents, releases or installed app replacement.
Contradictions: the old boolean installation check equated all lookup failures with
absence. It also opened HTTP after an installed app's open failed.

MCP tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
Apple discovery: https://developer.apple.com/documentation/appkit/nsworkspace/urlforapplication(withbundleidentifier:)
Existing sources: src/mcp/tools.ts, src/core/deeplink.ts, packages/service-host/src/links.ts,
SCN-026/028, docs/adr/0005-service-links.md. No new normative Fabric contract fields.

## State

Implemented and tested on the branch. Installation and release have not run.
Machine config, tokens, installed bundles, test data and dependency trees stay local-only.

## Host routing

`host_status` is read-only. It uses NSWorkspace through a static JXA query; only a
successful lookup with explicit null application and handler is `not_installed`.
Lookup failure is `unknown`; canonical service links require version >=0.3.0;
a missing/different handler is `handler_mismatch`. Opening targets the checked
application path via `open -a`, never `-n`. The app's existing single-instance
lock and service view map still own reuse.

`open` accepts optional `fallback: if_absent | never` (default `if_absent`). Only
confirmed absence permits HTTP fallback. Installed failure, incompatible version,
handler mismatch and unknown never do. These return MCP `isError` plus structured
`status`, `opened_in: nothing`, `open_link`, `http_url`; no raw OS error is returned.
Success is `status: accepted_by_os`, not a page readiness claim. Non-macOS returns
`unsupported`, opening nothing. This does not start/restart a service or remove a hold.

Consumers hand out the returned `open_link`; API/diagnostic URLs remain HTTP.
Remote chats must address an action to the intended computer: a native URI opens
on the device receiving it. This MCP does not implement a Telegram relay.

## Checks and handoff

- Baseline regression `installed host open failure must not fall back to HTTP`
  failed on the original implementation: it attempted HTTP after deep-link failure.
  The same test passes on this branch; test/host.test.ts covers absent/unknown,
  exceptions, version and handler mismatch; MCP cases exercise structured refusals.
- `npm run check`: 106 tests passed, 0 skipped; typecheck, brand pins, region and
  UX checks passed. Final focused rerun after tool-description/error-envelope changes
  is recorded in checks.json.
- `npm run test:e2e`: 3 passed. Disposable Electron + sample service: ten open-url
  events reused the same WebContents id with zero external opens; existing test
  separately checks a forwarding second process. This is not ten OS processes.
- Real Claude Code called the built server's host_status and link successfully:
  [real-client.json](real-client.json). Temporary MCP config/registry only; no
  persistent agent/gateway config edits. OS host discovery matched installed 0.3.1.
- No hosted suite dispatched; no application replacement, service install, merge,
  release tag, signed package, machine registration or production action.

Next: review/merge this branch with the matching Fabric Agent Adapter change,
then release/package/install through RUNBOOK. Test the installed new MCP via the
operator's gateway before claiming the rule active in long-running agent sessions.
Remote relay, lifecycle broker and managed communicator renderer remain separate
implementation work; this change supplies their host primitive and rule.

Local-only: dependencies, test profiles, tokens and service stores are not tracked.
Test applications/services exited; no background tasks retained. The worktree is
retained for review. Coordination: guarded registers were not edited in this repo;
scenarios and this task-specific handoff are unguarded. No contract pin changes.
