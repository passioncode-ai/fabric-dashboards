# ADR-0007 — Fabric Dashboards is AGPL-3.0 or commercial

Status: accepted · 2026-09-30 · follows [Fabric ADR-0092](https://github.com/passioncode-ai/fabric/blob/main/docs/adr/0092-every-repository-is-agpl-3-0-or-commercial.md)

## Context

On 2026-09-29 this repository moved from MIT to
`PolyForm-Noncommercial-1.0.0 OR LicenseRef-PolyForm-Internal-Use-1.0.0` (source-available, not
open source; [HANDOFF](../HANDOFF.md#license-change-2026-09-29)). Releases v0.2.0 and v0.3.0 were
published under that licence; v0.1.0 and the commits up to and including `7fb699d` stay MIT.

On 2026-09-30 the operator decided for every PassionCode.ai repository: open source under the GNU
Affero General Public License v3.0 only, or a commercial licence from PassionCode.ai (Fabric
ADR-0092; the knowledge base's
[licensing page](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/licensing.md)
owns the wording).

## Decision

1. **`LICENSE` is the unmodified AGPL-3.0 text**, byte for byte the knowledge base template
   (SHA-256 `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`).
   `COMMERCIAL-LICENSE.md` offers the commercial licence (contact@passioncode.ai, no price or
   term stated). `CLA.md` stays the organization's template: it is what allows the dual licence.
2. **Every manifest declares `AGPL-3.0-only OR LicenseRef-PassionCode-Commercial`**: the root
   `package.json`, `packages/service-host/package.json` and both entries in `package-lock.json`.
   `scripts/dist-mac.mjs` copies `license` from those manifests into the packaged app and its
   staged workspace package, so the built app carries the same expression.
3. **Earlier releases keep their licence.** v0.1.0 is MIT; v0.2.0 and v0.3.0 are PolyForm
   Noncommercial or Internal Use. The README's `## License` says so. This record and the
   2026-09-29 handoff section are the history; `CHANGELOG.md` sections of past releases are not
   rewritten.
4. **No release is cut for the licence.** The next release (after 0.3.0) is the first under
   AGPL-3.0 or commercial; its `CHANGELOG.md` section says so.

## Consequences

- Anyone may use, study, change and share Fabric Dashboards; a changed version shared with others
  or run as a service for them publishes its source under the AGPL. Shipping it inside a closed
  product needs the commercial licence.
- `@passioncode-ai/fabric-service-host` (`packages/service-host`, ADR-0006) carries the same
  licence. Fabric consumes it by commit; a third party that builds it into closed software needs
  the commercial licence.
- org-index `scripts/check_format.py` rules F7, F8, F9 and F11 hold for this repository.
