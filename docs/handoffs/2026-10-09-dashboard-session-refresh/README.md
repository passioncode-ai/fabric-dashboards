# Dashboard session refresh — bounded implementation brief

Base: `a7a92aa` on `origin/main`. Operator task via Nicegram community-manager
release, 2026-10-09. Scope: an explicit dashboard refresh/reopen uses the existing
registered service's sign-in flow once, preserves the validated same-origin
page, and shows failure. No generic 404 retry, grant, secret change, service
restart, merge, release or installed-app change is authorized in this task.

## Requirements and delivery profile

| ID | Requirement | Check |
|---|---|---|
| REF-1 | Explicit refresh renews a login-capable live service session once, then reopens the current safe page | Regression through ServiceViews with a recording Electron boundary and local fixture service |
| REF-2 | No token goes to unavailable/changed service; unsupported paths fall back to dashboard; no automatic 404 loop | Negative cases and same-origin validation |
| REF-3 | Coalesce concurrent refreshes, preserve view ownership, expose failure for Retry | Concurrency, switch, failure cases |
| REF-4 | Preserve ordinary non-login navigation and existing 401 behavior | Regression cases plus npm run check |
| REF-5 | Scenarios and evidence accompany the branch; independent reader before final handoff | SCN-015/039, dated receipt, draft PR |

Profile: committed brief/scenario update → bounded implementation + regression →
repository local gate → independent review → pushed draft PR. Parent owns reviewer
assignment. Existing source supplies the scope; no new interview is needed.
Native E2E and signed release are separate outstanding gates, not local test claims.

## Source evidence and decisions

- `src/electron/views.ts:68` only retries main-frame 401; parent Nicegram owner
  HTTP checks establish anonymous protected pages return 404. The handler body
  is identical in installed release tag `v0.6.6` and inspected head `e9fe13b`.
- Read-only source-derived listener replay: HTTP200 → zero reauth; HTTP401 → one;
  HTTP404 → zero. This does not reproduce the operator's previous blank window.
- `src/electron/views.ts:290` uses `wc.reload()` for Refresh; fresh `show`/`load`
  already owns the service-token to single-use-login flow. Reuse that authority.
- No change to layout or public strings is planned. Existing error/Retry UI owns
  recovery. Super-ux Update covers SCN-015 and SCN-039. No vision file exists;
  this is a bounded correction of the existing reload scenario, not a new product.
- Foreign work is preserved: primary checkout `agent/release-067`, additional
  `codex/product-presentation` worktree. Expired foreign HANDOFF/backlog/changelog
  leases were reported, never cleared. This run holds git leases for
  `src/electron/views.ts` and `docs/ux/scenarios.md`; Codex has no enforcement hook,
  so guard checks are explicit (the generated gated label is not enforcement).

## Release boundary and next task

`docs/RUNBOOK.md:56–57`: “Someone from `release-approvers` approves it … An agent
never approves a release run, even when its account could.” The `publish` stage
requires a second approval (`docs/RUNBOOK.md:84`). Required release path: checks
and native E2E, reviewed PR to main, annotated version tag, signed/notarized CI,
two human approvals. This task stops at a reviewable draft PR.

## Implementation and local receipt

`src/electron/views.ts` implements the existing SCN-039 recovery path: one fresh
sign-in on explicit Refresh, current same-origin route retained, overlapping
clicks coalesced, spinner through sign-in, and HTTP failure surfaced through the
existing error/Retry panel. Pending attempts stop before navigation if the view,
owner, service origin, token-file identity or live state changed. Explicit fresh
reopen suppresses the automatic 401 retry for the existing one-minute window.
The generic automatic 401 behavior remains; a 404 alone does nothing.

`test/dashboard-refresh.test.ts` executes production `ServiceViews` with a
recording Electron module boundary and an actual local HTTP login-code fixture.
It covers 26 cases including 401/404/500 failure, refusal, network error,
coalescing, loading state, stale owner/identity/drop, fresh reopen retry,
non-login reload and the retained automatic 401 bound. It does not launch
Electron, reproduce Chromium cookies or prove a native window rendered.

Validation, 2026-10-09, Node 26.10.0:

- `FD_SKIP_LAUNCHD=1 npm run check`: exit 0, **355 passed / 1 skipped / 0 failed**
  (356 total). The explicit skip is the real launchd integration test. Typechecks,
  brand pins, 74 code-region markers and UX consistency also passed. Full output:
  [raw/check.log](raw/check.log).
- `git diff --check`: exit 0.
- `npm ci --ignore-scripts`: installed dependencies without native install hooks;
  npm reported one high advisory: development-only `source-map-js <1.2.2`,
  GHSA-68fv-2mgg-jv7q (indexed source-map denial of service). `npm audit --omit=dev
  --json` reported zero vulnerabilities. No dependency change is included in this fix.
- Native `npm run test:e2e`: **NOT_RUN**, because this task excludes UI actions.
  Installed app, Nicegram runtime, estate memberships and service tokens were not
  changed. Local checks do not establish the cause of the earlier blank window.

## Handoff status and next task

Independent reader `/root/v2_protection` reproduced four important edge cases
against `2c51cd8`: an in-flight automatic login overwrote a newer explicit one;
a fresh view could start a second login on 401; fresh reopen did not recheck live
service identity; a failed fresh HTTP page could remain cached as successfully
loaded. This revision addresses all four with navigation generation, current
service checks, suppression on newly created views, and failure invalidation.
The last six cases in `test/dashboard-refresh.test.ts` cover these findings.
Final independent re-review by `/root/v2_protection` **PASS** at source commit
`f7f948bdca85020a81735985cf1b3ae889bf24b3`: original four independent reproductions
4/4 passed; committed refresh tests 26/26 passed; diff check clean; no remaining
Critical/Important finding in the bounded diff. The reviewer inspected the full
355-pass/1-skip gate receipt but did not rerun that full gate. Native acceptance
was not run by either reader. This final documentation commit changes no source.

Fresh authorized shallow clone of the pushed branch at `f7f948b` resolved all six
source/scenario/handoff/evidence files. The PR was verified draft with that head.
`npm run clean` reported nothing to remove.

REF-1–5 are complete through the authorized draft-PR handoff. Draft PR:
https://github.com/passioncode-ai/fabric-dashboards/pull/58. Next: perform native Electron acceptance before integration for SCN-015/039:
existing authorized service with an expired session, explicit Refresh, same page,
visible refusal, and switch-away during pending sign-in. Use existing identity
only; absent membership is an access decision and is not repaired by this patch.

Routes actually used: task-pipeline (bounded brief/delivery), agent-sync (isolated
branch and exclusive leases), super-ux/ux-scenarios Update (SCN-015/039 and SCR-02),
evidence-docs (local receipts and native acceptance boundary), copywriting
(boundary check: no local voice pack; reused the existing localized error/Retry
copy and a locale-neutral HTTP status, with no new prose shipped).
