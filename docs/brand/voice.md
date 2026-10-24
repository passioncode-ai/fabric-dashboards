Contract: brand-contract v1

# Voice

Inherits the parent voice: specific, one builder to another, the fact first and then the step the person can take.
These invariants are checked or reviewed on every string in `src/core/i18n.ts` and on every string composed in code.

1. **No em dash** (U+2014), in either language, in a dictionary value or in a string joined in code (tray menu,
   tooltips, aria-labels, titles). Use a colon, a comma or parentheses. Joins live in the dictionary as templates
   (`join.nameState` `{name}: {state}`, `join.action` `{action}, {name}`, `tray.tooltip`), never as literals in a
   component. Checked by `test/copy.test.ts`.
2. **Labels carry no full stop; sentences do.** Buttons, chips, headings, column and field labels end bare. A status
   line or notice that is a whole sentence ends with a full stop, also when it ends with a link or an address.
3. **Sentence case** for buttons and labels. Title Case only in the macOS menu bar (`menu.*` keys), where the platform
   asks for it; body text quotes a menu item as the menu shows it ("Check for Updates…").
4. **The plain fact first, the identifier after it.** A person reads "Its install file is broken: … Reinstall the
   agent." An identifier the agent's owner needs (a rule such as FAC-SEM-133, a decision such as DEC-0021, an
   extension URL) trails the sentence in parentheses. Protocol words (descriptor, fabric-service/0.1, well-known
   document, launchd job, pid) stay out of a state chip, a reason line and an empty state; the Health tab's detail
   list may name them.
5. **A button says its result.** "Run self-check", "Continue last session", "Reload page", never a bare noun.
6. **Name the platform the app runs on.** "this Mac" and System Settings only where the app runs on macOS; "this
   computer" and "the system" everywhere else (see [terminology](terminology.md#platform-words)).
