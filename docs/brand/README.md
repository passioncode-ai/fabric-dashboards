Contract: brand-contract v1

# Fabric Dashboards brand pack

How Fabric Dashboards speaks to the person at the window. This pack holds only what differs from, or narrows, the
PassionCode.ai pack it inherits: `passioncode-ai/fabric` `docs/brand/` at commit
`69db245a927d22ce91ff75fa7f72cf667e39fcdb` (the last commit that touched that folder on 2026-10-24). Where this pack
is silent, the parent's voice, terminology, banned words and Russian locale apply.

| File | Owns |
|---|---|
| [`voice.md`](voice.md) | the invariants every interface string keeps (no em dash, punctuation, casing, where identifiers go) |
| [`terminology.md`](terminology.md) | one word for each thing and each state, in English and Russian, and the platform words |
| [`locales/ru.md`](locales/ru.md) | Russian choices: counts after their label, address, verbs that must not collide |

The strings themselves live in `src/core/i18n.ts` (English primary, Russian complete). The checks that read them:

- `test/copy.test.ts`: no em dash in any string composed in code (comments excluded), counts after their label in
  Russian, one name per term and state, protocol words kept out of the first sentence, platform-aware wording.
- `test/parts.test.ts`: every key exists in both languages with the same placeholders, and the parent's banned words
  are absent.

Visual brand files are pinned separately in [`../brand-source.json`](../brand-source.json) and checked by
`scripts/check-brand.mjs`.
