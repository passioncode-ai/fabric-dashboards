<sub>ssheleg skills — evidence-docs</sub>

# Product presentation kernel

## Kernel

P3-A pure preparation, 2026-10-04. Owning repository Fabric Dashboards; fetched base `f7e806919c81f88d0fc7129c355c06c7036387ef`, branch `codex/product-presentation`. Only new `src/core/presentation.ts`, `test/presentation.test.ts` and this design file are allocated. Existing lifecycle rules, including off-until-chosen launch-at-login, are preserved. No runtime call sites, settings, IPC, renderer, monitor, service-host package, descriptor, credential, lifecycle control, origin or installed preference changes.

The helper validates an explicit operator-owned display map and derives Products versus internal technical service entries. A group is presentation, not an autonomous agent, permission class, process or deployment. Technical services include dependencies and connections; independent background agents can be placed in technical inventory by a later explicit trusted operator choice. Neither names, same origins nor MCP capability lists automatically classify an agent or infer membership.

## API

`validatePresentation(input:unknown, options?:PresentationOptions):Validation`:

- null, undefined and a well-formed empty products map normalize to `{ok:true,map:null,proxyScreened}` for legacy behavior.
- Accepted map is an independent recursively frozen copy of closed own-data records and dense arrays.
- Rejection is `{ok:false,map:null,reason:'invalid_presentation',proxyScreened}`. Caller payload/error text is never reflected.
- `options.isProxy` is a TRUSTED CONTEXT function, not part of the untrusted map. Main must supply `node:util.types.isProxy` before accepting persisted operator input. `proxyScreened` describes that supplied validation path, not an authenticated capability: another caller can lie with a detector or manufacture a wrapper. Main must run the validator itself, not trust renderer-returned validation metadata.
- Browser-safe own-data inspection without detector cannot recognize every transparent Proxy. Test `transparent browser Proxy may validate but never obtains screened trust` executes this limitation. It returns `proxyScreened:false`; such input is not authority for persistence. Throwing/revoked proxies are converted to static refusal, but browser traps can run before rejection. No trap-free arbitrary-browser-JavaScript guarantee.

`derivePresentation<T extends PresentationSnapshot>(services:readonly T[], input:unknown, options?):PresentationView<T>`:

- Snapshots are TRUSTED HOST OUTPUTS. Derivation reads only key/state and descriptor identity/origin/placement; it does not validate arbitrary hostile snapshots or traverse tokens/auth/lifecycle/event objects.
- Output `technical` is the EXACT input array; all original object references, order and duplicate entries survive. Input snapshots/array are not frozen or mutated. This is a reference-preserving view, not an immutable/authenticated snapshot.
- `mode:'legacy'` uses no products and returns the complete array as `unassigned`; invalid maps have static reason, null/empty maps no reason.
- `mode:'grouped'` returns configured products, complete technical array and visible `unassigned` entries. Every exact successful primary/internal binding contributes its original object reference; every unknown/mismatched/conflicting snapshot remains unassigned and technical.
- Product fields are id, literal label, primary object/null, resolved internal objects, issues, and `primaryBound`. `primaryBound:true` means one exact safe identity binding exists, NOT operational dashboard availability: a correctly bound down/stopped/starting/degraded service retains its actual state. No aggregate Ready status is invented.
- Issues are static `missing`, `duplicate`, `invalid_descriptor`, `identity_mismatch`, `origin_mismatch`, `placement_mismatch`, `unsafe_state`, with validated configured key and primary/internal role. Missing primary NEVER promotes a reader/bridge/internal member. Duplicate snapshot keys suppress binding even if the same object occurs twice.

## Map and bounds

Version `dashboard-product-presentation/1`: root `{revision,products}`; each product exactly `{id,label,primary,internal}`; each binding exactly `{key,origin,placement}`. No unknown root/product/binding fields, symbols, getters, sparse/extended/nonordinary arrays or class/prototype records. Plain Object/null-prototype records are allowed; main detector rejects Proxy records/arrays before introspection.

Exported `PRESENTATION_LIMITS`: 32 products, 32 internal entries/product, 128 total binding occurrences, 4096 cumulative own keys, 65536 cumulative string UTF-16 units. All map strings are length-checked before allocation/copy: product ID ≤64 safe lowercase ASCII, label ≤80 trimmed units without controls/bidi override marks, key ≤96 and exact service-host id/instance grammar, origin ≤280. Keys cannot appear twice anywhere; product IDs unique. Labels remain plain literal text for future React escaping, never an alias or HTML renderer. Emoji/non-Latin text is not heuristically rewritten.

Local origin is exact canonical `http://127.0.0.1:<100..65535>`. Remote is exact lower-case DNS HTTPS, optional canonical port 1..65535, no path/query/userinfo/IP/reserved local host. No URL normalization, case conversion or fallback. Descriptor placement defaults to local only when absent, matching the actual host contract. Service descriptor id+instance must match snapshot/configured key.

Cumulative bounds are checked BEFORE bulk descriptor snapshots/expanded-record copies; array length and ordinary prototype precede index copies. Closed record enumeration rejects excess enumerable fields immediately. Tests cover huge sparse length and a 4096-key cheap record without copying its payload graph. Own-key intrinsic enumeration can itself allocate for a pathological record containing huge numbers of nonenumerable/symbol keys; these are rejected, but this module is not a hard memory/time sandbox for arbitrary in-process JavaScript. Map copying is bounded; trusted host snapshot inventory size remains owned by monitor, not this validator. No deep copy of the service graph occurs.

A valid matched primary in states ready/degraded/down/stopped/starting/stopping remains bound. Invalid/foreign/conflict/duplicate/unknown states suppress its binding; affected actual snapshot stays visible. Internal failures create issues without changing primary identity. Same labels/origins with distinct keys remain distinct products; build/version metadata has no membership semantics.

## RED to GREEN receipt

Executed in this source worktree, after parent dependency install completed:

- Meaningful stub run `node --import tsx --test --test-reporter=tap test/presentation.test.ts`: exit1, 68 tests, 30 FAIL/38 PASS, duration1455.173167ms. Stub always legacy/invalid; positive grouping, exact-binding, Proxy-screening and immutable-copy tests failed. Malformed-refusal tests passing alone were insufficient acceptance.
- First implementation focused 68/68 PASS, process1087.966417ms; added boundary/Proxy/API-semantics tests 76/76 PASS, process4062.546ms; final focused78/78 PASS, zero skipped/cancelled, process1301.43075ms.
- Final `npm run typecheck` exit0: builds the workspace service-host package, checks main and renderer projects. It ran after the final SOURCE change (`primaryBound` naming); the last two neutral test additions are interpreted by the focused Node/tsx suite. Source contains no Node runtime imports; tests alone import Node for the trusted detector/test harness.
- Owning `git diff --check` exit0. Region fence `product-presentation` points to this file's Kernel anchor.
- Only neutral fake identities/origins in public source/tests; no operator profile, credentials or machine paths copied. No file cleanup or descriptor ownership logic introduced.

Source SHA256 `614b54f19ef653d1d191f9097e7a469ef79e274b6ecad12269550f4f646674f9`; test SHA256 `52b628701838a1d2ff2c584fb67b413b02e484d88a952a51414adf03a0da73e2`. Enclosing source commit remains parent-owned until integration; this receipt does not invent a commit.

Coverage: two products/five exact technical references, null/empty legacy, immutable normalized copies, main pre-trap Proxy rejection plus browser limitation, nested/index accessors, cumulative/individual limits, unsafe/missing/moved/duplicate primary, internal failures, exact-case origins, unassigned visibility, same name/origin independence and no unrelated metadata traversal. `derivePresentation` contains no command/auth/view alias. Whole repository check, renderer/Electron scenario acceptance, package release, installed update and actual user map activation are NOT_RUN here; root independently runs the full gate after freeze.

## Next P3-B

Root must separately allocate Settings/typed IPC/status/rendering/editor files after scenarios and product choices. Main persists only its OWN successful detector-screened normalization; a serialized browser `proxyScreened:true` is not proof. Preserve latest LC-07 settings defaults and launchAtLoginAsked field; do not apply the older allocation's obsolete Settings shape verbatim. Settings should write candidate before publishing in-memory state, report typed static map errors separately from login-item errors, allow explicit Clear back to legacy and preserve unrelated notification/theme/lifecycle settings.

Render product entries using original primary service keys and `primaryBound` plus actual service state; expose all technical entries, unassigned and binding issues, never suppress internal health/events/attention. Keep full status.services for tray/dock/Activity/notifications/MCP; external service deep links and controls remain exact original keys. Unmapped services are visible. Group deletion changes preference, not lifecycle. Independent background agents are not inferred from a technical record; actual agent responsibility classification requires explicit trusted operator context outside this kernel.

This pure helper does not change any visible card or replace the installed app. Parent owns canonical host backlog/guarded docs under leases, org integration/PR, source handoff and profile activation. No descriptor/protocol extension or generic catalog framework is required for P3-B.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — pure product presentation kernel limits and RED GREEN source receipt

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
