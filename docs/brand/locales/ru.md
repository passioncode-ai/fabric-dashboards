Contract: brand-contract v1
Locale: ru
Primary: no
Address form: «вы» or a neutral form (inherited)

# Russian

Inherits the parent `locales/ru.md`. Narrowed here:

1. **A count follows its label**, so no word agrees with the number: «Агентов: {count}», «Требуют внимания: {count}»,
   «Работают: {ready} из {total}». In the Overview strip the label is a heading over its number. Units of time keep
   the number first («{n} мин»). Checked by `test/copy.test.ts`.
2. **No em dash**, also in machine reasons translated by `src/core/machine-ru.ts`: «должен быть», «не является»,
   «не в формате JSON» instead of a copula dash.
3. **«агент для кода»** for the coding agent, never «кодинг-агент» and never «агент» alone where the coding agent is
   meant (inherited). What an agent runs on is «Работает на».
4. **«Обновить» is for a version.** Data: «Обновить данные»; a page: «Перезагрузить страницу».
5. **A quoted label is a real label.** A sentence that names a button quotes it exactly as the button reads.
6. «Mac» is written as Apple writes it, only in `.mac` keys and macOS-only flows; elsewhere «этот компьютер».
