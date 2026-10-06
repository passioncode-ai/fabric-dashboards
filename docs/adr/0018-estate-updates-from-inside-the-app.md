# ADR-0018 — The app watches contract and skill versions, and updates them by itself

Status: accepted · 2026-10-07 (operator) ([brief](../evidence/briefs/2026-10-07-estate-updater-brief.md))

## Context

On 2026-10-07 the operator asked for a mechanism that watches the versions of
the Fabric Agent Contract and of the operator's skills, auto-updates where safe,
and runs inside Fabric Dashboards, started at launch together with the app.

What exists today:

- **The app watches services, not versions.** The Monitor probes
  `fabric-service/0.1` descriptors; the Updater (LC-16) updates the app itself.
  Nothing watches the contract's `main`, consumer pins, or the skill family.
- **Contract updates are governed, never automatic.** A consumer pins the
  contract once, by full commit (`fabric-contract.lock.json`,
  `docs/specification/versioning.md` in the contract); moving the pin is a
  compatibility change reviewed per release, and a contract `0.x` minor is
  additive (contract DEC-0016). So "a new contract commit" is a *notification*,
  and the only unconditional safe action on a local clone is `git fetch`.
- **Skill updates have prior art.** `sshlg-skills` reconciles the family with
  `npx sshlg-skills update`; the `passioncode` installer's session-start hook is
  the template: a periodic probe, a publisher trust check, then a background
  `npx --yes … update`.
- **ADR-0002 and `SECURITY.md`** keep the app off ports and out of service
  supervision. A separate supervised process beside the app is therefore the
  wrong shape; the mechanism must live in the main process.

## Decision

<a id="decision"></a>

1. **An in-app component, not a new process.** The estate updater runs in the
   main process, started in `whenReady` next to `Monitor` and `Updater` and
   stopped in `will-quit`. It runs short-lived `git` and `npm` tool processes —
   the same lifecycle class as the Updater's `codesign`/`plutil` spawns, not a
   service process under ADR-0002. The app still listens on no port and owns no
   launchd job.
2. **Contract watch is opt-in and fetch-only.** Settings name a local clone of
   `fabric-agent-contract`. The probe compares `git ls-remote origin main` with
   the local `main`; consumer pins are *read* from sibling checkouts
   (`fabric-agent-adapter/fabric-contract.lock.json`, fabric's
   `SOURCE.json`, this repo's `test/fixtures/contract/SOURCE.txt`) and reported
   as drift. The only automatic mutation is `git fetch origin` — never pull,
   reset or rebase, and never a pin rewrite. A pin move stays a reviewed,
   per-consumer decision.
3. **Skills update behind a switch, after a trust check.** The probe reads the
   latest `sshlg-skills` version from the npm registry and compares it with the
   installed-version record this component keeps in its data file. Automatic
   apply (default off) runs `npm view sshlg-skills maintainers` first and
   refuses unless the expected owner is listed, then runs
   `npx --yes sshlg-skills update` in the background.
4. **LC-16 cadence and ledger.** First check 90 s after start, then every 6 h;
   one retry within the hour after a failure. Activity log codes
   `estate_check` / `estate_update` (LC-12); status on `AppStatus.estate`;
   a Settings section with English and Russian strings; a UX scenario.

## Consequences

- New code: `src/core/estate-update.ts` (pure decision logic),
  `src/electron/estate-updater.ts` (timers and child processes), wiring in
  `src/electron/main.ts`, settings fields `estate.{enabled,autoSkills,contractClone}`,
  `AppStatus.estate`, Settings-page UI, i18n keys, `test/estate-update.test.ts`.
- Idle budget: at most two short child processes per 6 h — negligible next to
  the LC-08 table; recorded here so the next lifecycle audit expects them.
- The component writes one state file in userData (`estate-skills.json`, LC-12)
  and appends to the existing activity log; uninstall keeps both with the rest
  of the data.
- Out of scope: moving any consumer's contract pin (a reviewed decision per
  consumer), updating the app itself (LC-16), Fabric-side aggregation
  (ADR-0013 boundary).
