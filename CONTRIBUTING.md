# Contributing

Contributions are accepted under the [Contributor License Agreement](CLA.md): tick its box in
the pull request template. It lets PassionCode.ai offer Fabric Dashboards both under the
[GNU AGPL-3.0](LICENSE) and under a [commercial license](COMMERCIAL-LICENSE.md).

```bash
npm ci
npm run check        # typecheck, unit + integration tests, brand pins, code regions, UX lint
npm run test:e2e     # builds, then drives the real Electron app against a live sample service
npm start            # run from source
npm run icon         # re-render build/icon.icns and the menu bar templates from the vendored mark
npm run dist -- --notary-profile fabric-notary   # signed, notarized DMG + update zip + feed
```

- `packages/service-host` is an npm workspace (`@passioncode-ai/fabric-service-host`, shared with
  Fabric, not published). `npm ci` at the root links it; `npm test`, `typecheck` and `build` build
  it first. A change to the state order updates its `test-vectors/state-precedence.json`.
- The integration test drives real launchd with the fixed label
  `ai.passioncode.fabric-dashboards.test.sample`; set `FD_SKIP_LAUNCHD=1` where there is no
  GUI login session (CI).
- Brand files under `src/renderer/brand/` are vendored from `passioncode-ai.github.io` and
  pinned in `docs/brand-source.json`; `scripts/check-brand.mjs` rejects an edit. Update the
  canonical file there, copy it, repin.
- Protocol fixtures under `test/fixtures/contract/` and the sample service under
  `test/fixtures/sample-service/` are copies with a `SOURCE.txt`; never edit them here.
- A user-facing change updates `docs/ux/scenarios.md` in the same change.
