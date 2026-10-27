Contract: brand-contract v1

# Terminology

One word for each thing, in both languages. The parent pack's terminology applies first; this file narrows it for
this app (ADR-0022 for agents and services).

## Things

| English | Russian | Means | Never write |
|---|---|---|---|
| agent | агент | any item the app watches, local or online, in counts, filters, empty states, alerts and the tray | service (for a watched item), «сервис» (for a watched item) |
| service, Services (the sidebar section) | служебный сервис, «Служебные» (раздел) | a helper agent with no dashboard (ADR-0022) | |
| coding agent | агент для кода | the program the console starts (Claude Code, Codex and others) | runtime, Runner, «кодинг-агент», «агент» alone |
| runs on (what an agent's own model calls run on) | работает на | the runner an agent reports (DEC-0046), in the profile block and in Connections | «Агент для кода» for it |
| install file | файл установки | the descriptor in the services folder, as a person reads it | descriptor, «дескриптор» (outside the Health details) |
| services folder | папка сервисов | the folder descriptors are installed into (a path, not a category) | |
| spend report | отчёт о расходах | an agent's own report of calls, tokens and cost | usage report (in the interface; the contract and MCP machine sentences keep the contract's own word) |
| spend | расходы | the topic: what agents spent (the page, a profile line, a limit's name) | «траты» |
| Activity (the page and the tab) | События | what the agents and the app did, newest first | «Лента событий» (that is an agent's events surface on the Connections page, COPY-33) |
| job | задача | one piece of work an agent runs, which a per-job limit caps (`per_job`) | order, «заказ» (it reads as a purchase) |
| self-check | проверка | an agent's `doctor` command | Doctor, «Диагностика» |

## States

One name per state, the same on the chip, in Connections, in the map's summary and in alerts.

| State | English | Russian |
|---|---|---|
| ready | Ready | Работает |
| degraded | Partly working | Работает частично |
| down | Not answering | Не отвечает |
| stopped | Stopped (the result of Stop) | Выключен (the result of «Выключить») |
| invalid | Broken install file | Ошибка в файле установки |
| foreign | Wrong program on port | Чужая программа (short for the chip; the reason names the port) |

## Actions

| English | Russian |
|---|---|
| Fix with coding agent (short: Fix) | Исправить с агентом для кода (short: Исправить) |
| Update with coding agent | Обновить с агентом для кода |
| Update to {version} (installs a version) | Обновить до {version} |
| Refresh (data) | Обновить данные |
| Reload page | Перезагрузить страницу |

«Обновить» alone is never a button: it names a version update only with its object.

## Platform words

The app ships for macOS, Windows and Linux. A key that names the platform has two values: the plain key says "this
computer" / «этот компьютер» and "the system" / «система»; the same key with `.mac` appended says "this Mac" /
«этот Mac», "macOS" and System Settings. `t()` picks the `.mac` value on macOS (`process.platform` in the main
process, the user agent in the renderer). Flows that exist only on macOS (moving to Applications, login item
approval, Terminal) may name it in the plain key.

## Not in this pack yet

Hand-overs, limit stops and the console's idle close are rewritten by another wave of the 0.8.0 iteration; their
words are recorded when it lands.
