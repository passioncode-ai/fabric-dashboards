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
structuredContent compatibility. The implementation stage used no subagents or installed app replacement; the
operator subsequently authorized release and installation.
Contradictions: the old boolean installation check equated all lookup failures with
absence. It also opened HTTP after an installed app's open failed.

MCP tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
Apple discovery: https://developer.apple.com/documentation/appkit/nsworkspace/urlforapplication(withbundleidentifier:)
Existing sources: src/mcp/tools.ts, src/core/deeplink.ts, packages/service-host/src/links.ts,
SCN-026/028, docs/adr/0005-service-links.md. No new normative Fabric contract fields.

## State

Initial implementation was tested on the branch. Release and installation are now
complete; see [release receipt](release.json) and the release section below.
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

## Released and installed — 0.3.2

[PR #14](https://github.com/passioncode-ai/fabric-dashboards/pull/14) merged as
`648b71118ecbe52d823f40c04cbf5460d273f573`. [Release v0.3.2](https://github.com/passioncode-ai/fabric-dashboards/releases/tag/v0.3.2)
contains the universal DMG, signed update zip, feed, hashes and build receipt.
`npm run dist -- --notary-profile fabric-notary` passed: Developer ID signature,
accepted/stapled notarization, Gatekeeper acceptance, both architectures and the
packaged MCP launcher. [Machine-readable receipt](release.json).

The operator's application was updated with a local rollback archive retained.
Installed signature and staple passed. The installed MCP answers initialize as
0.3.2 and `host_status` reports the expected available app/version/handler. A real
Claude Code 2.1.287 client called host_status, link and strict open through the
existing direct registration, with no permission denial.

For the UI check the app was placed on Overview, then the installed MCP opened a
registered service page with `fallback=never`. The native app showed the selected
service heading and embedded dashboard URL. The MCP receipt itself still proves
only OS acceptance; the UI observation is a separate check. Source Electron tests
cover ten-link view reuse and second-process forwarding.

Release checks: 106 tests, typecheck/brand/regions/UX and three Electron end-to-end
tests passed on the 0.3.2 candidate. No full hosted test suite was dispatched.

Current next task: consume this installed contract from the communicator renderer
and addressed remote-open transport. Native routing is shipped; a permanent
communicator and lifecycle broker are not part of this release.

## Cold-launch correction — 0.3.3

A follow-up check after 0.3.2 installation closed the GUI before MCP open. macOS
accepted the request but the application did not start. The packaged MCP exports
`ELECTRON_RUN_AS_NODE=1`; desktop dispatch inherited it. Removing that variable
from the dispatch child reproduced a successful graphical launch.

Regression `MCP desktop dispatch removes RunAsNode in the child and preserves the
server environment` failed before the fix (`1` versus null). The fix wraps the
existing open invocation with `/usr/bin/env -u ELECTRON_RUN_AS_NODE`, preserving
the app-path pin, single-instance policy and strict fallback. The MCP process
environment is untouched. This correction requires 0.3.3; the 0.3.2 release and
its successful already-running-host checks remain historical evidence.

0.3.3 is signed, notarized/stapled and Gatekeeper accepted; [release receipt](release-0.3.3.json).
It is installed on the operator Mac. With the GUI explicitly closed, a fresh
Claude Code 2.1.287 client called the installed MCP host_status/link/open with
fallback=never. The app transitioned from not running to running; its log records
startup as 0.3.3. The final visual-page check is **unverified**: CUA screenshots
and reconnection timed out, including after its session reset. Earlier warm
0.3.2 and sanitized cold diagnostic pages were visually observed; they are not
relabeled as a final 0.3.3 screenshot. Three source Electron page tests passed.

[Failing baseline and passing regression](cold-launch-regression.json).
The [runbook](../../RUNBOOK.md#installed-mcp-cold-start-check) now requires a cold
GUI start as well as a warm open. Next verification when computer use responds:
inspect the selected page in installed 0.3.3; no additional release action is
required unless that check reveals a defect.
