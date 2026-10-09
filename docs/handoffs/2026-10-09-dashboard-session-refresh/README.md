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

Next: implement REF-1–4, run checks without launchd/UI side effects, request the
parent's independent diff review, resolve findings, record exact receipts here.
