// The MCP server's instructions and tool table: what `initialize` and `tools/list` answer. Data only; the
// dispatcher is in server.ts and the tools themselves in tools.ts (FD-302: moved out of server.ts unchanged).
import { ARRANGE } from './tools';

export const INSTRUCTIONS = [
  'Two doors (FD-339): `search` finds this server\'s operations by words, each with its schema, gate and an example;',
  '`execute` runs one by name with its arguments. An operation\'s effect is read, write or destructive; its gate is none, or relayed:',
  'an act on another agent, which takes the operator\'s words in params._meta.decision and an idempotencyKey. The same key with the same',
  'arguments answers the first result and does nothing again; with other arguments it is refused. Refusals are typed: unknown-operation,',
  'invalid-arguments, idempotency-required, idempotency-conflict, and the gate\'s decision refusals (FD-339; RO-801: each door\'s',
  'description stays under 200 characters). The names below, and the tool each declared action names, are operations.',
  'Fabric Dashboards watches the agent services of this Mac (fabric-service/0.1): local ones and',
  'online ones registered here (placement remote, an https origin supervised by its platform).',
  'Hand a person a link to what you started: `link` or `open` turn a service key (id.instance)',
  'and a path, or the service\'s own URL, into a fabric-dashboards:// link that',
  'opens that page inside the app, signed in. Return open_link as the primary dashboard link;',
  'http_url is for diagnostics or a confirmed-absent browser fallback. Never hand-build links',
  'or start another server/browser to show a registered dashboard. `host_status` checks this Mac.',
  '`open` uses the installed host; an installed host failure never falls back to the browser.',
  'Agent pages open in Fabric Dashboards, never in a browser: `open` refuses with host_not_installed when the',
  'app is absent unless you pass fallback=if_absent. accepted_by_os is not page_ready. A page no service',
  'descriptor names is refused with the step that registers it; do not open it in a browser instead.',
  'Links open on the device receiving them; remote chats need an addressed local open action.',
  '`control` and `update` act on another agent (DEC-0121 gate relayed): pass the operator\'s words about that act in',
  'params._meta.decision ({by: "operator", via: "relayed-instruction", action, target, instruction, at}) when you have',
  'them; they are recorded as the operator\'s. A call without one still runs, recorded as yours (MD-10).',
  '`control`, `doctor` and `update` are the operator\'s administration:',
  'say what you are about to do before calling them.',
].join(' ');

const serviceArg = { type: 'string', description: 'The service key, id.instance, as list_services names it' };
const pathArg = { type: 'string', description: 'A path on the service, starting with one / (for example /dashboard/job_1)' };
const urlArg = { type: 'string', description: 'The service\'s own URL (http://127.0.0.1:<port>/… for a local service, its registered https origin for an online one), instead of service + path' };

export const TOOLS = [
  {
    name: 'host_status',
    description: 'Read this machine’s Fabric Dashboards installation, version and protocol handler without opening anything. Unknown is not absent.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_services',
    description: 'Every installed service, local and online: its product (every instance of one id is one product) and row (FD-244: the product, or <product>@<organization> for an instance run for another organization than its product\'s primary, a row of its own in the list), placement, state (ready, degraded, down, stopped…; stopped with reason.elsewhere when this machine\'s placement record puts it on another machine, duplicate with reason.duplicate.elsewhere when it runs here anyway, FD-132; ready with reason.reached.elsewhere when this machine reaches the placed copy through a forwarded port, FD-179), launchd_domain (FD-181: gui, or system for a system daemon of this space that only the administrator starts or stops; null when launchd does not supervise it), version, dashboard URL, the dashboard\'s declared minimum width (dashboard_min_width, null when it declares none), a fabric-dashboards:// link, tiles, pending update, and how the app lists it: category (local, online, or service: the section its product is listed in, so every instance of one product carries its product\'s; placement says where this instance runs) and hidden (the person hid it; it is still watched); organization (FD-162: {name, label} of the organization its repository belongs to in Project Observatory\'s registry, null when not known; personal: true for the operator\'s own organization, FD-195). organizations lists only those organizations\' agents (by name; "" is not attributed; @mine the personal organization\'s, @others every other organization\'s, @shared a product that runs here in two organizations or more).',
    inputSchema: { type: 'object', properties: { organizations: { type: 'array', items: { type: 'string', maxLength: 64 }, maxItems: 50, description: 'Only the agents of these organizations, by name (acme, personal), or by GitHub owner as gh:<owner> (FD-237); "" is the agents not attributed; @mine, @others and @shared (kept for agents and earlier choices; the menu no longer offers them) are the filter\'s kinds (FD-195). Omit for every agent.' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },  {
    name: 'organizations',
    description: 'Every organization Project Observatory names on this Mac, as the sidebar\'s Organizations menu lists them (FD-248, SCN-113): name, label, whether it is the personal one, how many installed agents are attributed to it (0 for one with no agent here), own_label (the person\'s label in Settings → Organizations, null when none), hidden (left out of the menu) and seen_in (observatory, or switchboard for one only Switchboard names). Read from the map the app last read (organizations.json); read_at null means none was read yet. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },

  {
    name: 'service_status',
    description: 'One service\'s state and reasons, read now.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'link',
    description: 'Resolve a dashboard page. Give open_link as the primary action; http_url is diagnostic or confirmed-absent fallback. Opens nothing.',
    inputSchema: { type: 'object', properties: { service: serviceArg, path: pathArg, url: urlArg }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'open',
    description: 'Open in the existing Fabric Dashboards host. No browser by default (fallback=never); a browser only for a confirmed absent host when fallback=if_absent is passed, never after an installed host fails. The receipt proves OS dispatch, not page readiness.',
    inputSchema: { type: 'object', properties: { service: serviceArg, path: pathArg, url: urlArg, fallback: { type: 'string', enum: ['if_absent', 'never'], default: 'never' } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'control',
    description: 'Start, stop or restart a local service through launchd, and wait for the expected answer. Stop keeps it off across logins. An online service is supervised by its platform and is refused; so are start and restart of one this machine\'s placement record puts on another machine (FD-132: a second copy).',
    inputSchema: {
      type: 'object',
      properties: { service: serviceArg, action: { type: 'string', enum: ['start', 'stop', 'restart'] } },
      required: ['service', 'action'], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'doctor',
    description: 'Run the service\'s own doctor command (its descriptor declares it) and return its output. It runs a program the service ships: announce it first.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    // M-1: it executes the descriptor's program, so a client must not auto-approve it as read-only.
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'update',
    description: 'Run the service\'s own update command (list_services shows update_available) and return its output. What the command does (install, restart) is the service\'s; call service_status afterwards to see the result.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'console_new',
    description: 'Start a new coding-agent session in the agent\'s console inside the running Fabric Dashboards, as its New session button does (ADR-0025): the runtime chosen for that agent, in its folder, with its context pack. FD-182: service `fabric-dashboards.setup` starts the Setup console, as Set up with my coding agent does, its brief opening with the last Check setup\'s findings (Fix with my coding agent). Answers app-not-running when the app is not open; never starts the app. Pass the operator\'s words in params._meta.decision when you have them (action new-session).',
    inputSchema: { type: 'object', properties: { service: serviceArg, mode: { type: 'string', enum: ['new', 'continue'], description: 'continue: Continue last session, as the console\'s button (FD-249); default new.' } }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'session_new',
    description: 'Start a coding session of its own in the running Fabric Dashboards, as the Sessions mode\'s New session button does, a new agent with kind agent, as the agent list\'s New agent button does, or a new dashboard with kind dashboard, as its New dashboard button does (FD-191, FD-171, SCN-101, SCN-102, SCN-119): the coding agent (runtime, an id installed here), the folder (absolute; default the last chosen, else the projects folder), without permission prompts (bypass, default the last choice, on at first) and isolated on a Switchboard account\'s own home (isolated, default false; needs Switchboard and Claude Code or Codex). A new agent\'s session starts with the brief to create one with the person; a new dashboard\'s, the brief to make a dashboard-only fabric-service/0.1 service with the adapter recipe recipes/dashboard-only/. Answers the console key, its Sessions row and open_link, or a refusal (no-runtime, no-folder, isolated with why, admission_disk, admission_cap, admission_pool when the machine session limit Switchboard sets is reached (FD-261), admission_swap). Answers app-not-running when the app is not open. Pass the operator\'s words in params._meta.decision when you have them (action new-standalone-session, new-agent or new-dashboard). FD-247 (SCN-111): kind terminal with machine opens a login shell on that machine in a console of its own (no other field). FD-206: machine (as ssh knows it, one of Switchboard\'s targets) starts it on another machine through that machine\'s Switchboard, with folder a path there (required with machine); Claude Code or Codex only; kind session only (FD-300: agent and dashboard answer remote: kind, their brief is written on this Mac).',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['session', 'agent', 'dashboard', 'terminal'] }, runtime: { type: 'string', maxLength: 64 }, folder: { type: 'string', maxLength: 4096 }, bypass: { type: 'boolean' }, isolated: { type: 'boolean' }, machine: { type: 'string', maxLength: 320 } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'console_fix',
    description: 'Start a coding-agent session that fixes an agent, as Fix with coding agent does (ADR-0025): kind fix (the agent\'s problem), audit (the auditor\'s findings) or ask (a task in your own words, as the page\'s task line takes a person\'s, FD-249; read for instruction-like text like a service\'s), with the findings or the task as text. When that agent\'s console already runs a session, the task is typed into it without Enter, as the console\'s Send the task to this session does (answers typed: true). FD-187: with service `fabric-dashboards.setup` the findings are your request for the Setup console: a new one opens its brief with it, a running one gets it in `request.md` with one line typed in. Answers app-not-running when the app is not open. Pass the operator\'s words in params._meta.decision when you have them (action fix-with-coding-agent).',
    inputSchema: { type: 'object', properties: { service: serviceArg, kind: { type: 'string', enum: ['fix', 'audit', 'ask'] }, findings: { type: 'string', maxLength: 16384 } }, required: ['service', 'kind', 'findings'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'this_machine',
    description: 'What this computer gives each context, as the This computer page sums it (FD-52, SCN-116): totals (agents, running, attention, stopped) and one entry per context: the organization of Project Observatory\'s map (name, label, personal), confirmed false until Fabric reports each instance\'s own context (CO-422), \'\' for agents with none; its counts and agent keys. Sums only: spend per agent is the spend tool, and people is null until an agent reports them (only groups of 5 or more will be shown).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'organization_join',
    description: 'Join an organization, as Settings → Organizations → Join does (FD-248, SCN-115): membership is kept by the organizations service, never by this app. Answers the page that joins it: the service\'s own (https://org.passioncode.ai/), or the invite link given when it is https on that host (anything else is refused with host). open: true has the running app open it in the browser (app-not-running when it is closed). The organization appears at the next read of the organizations map.',
    inputSchema: { type: 'object', properties: { link: { type: 'string', maxLength: 2048 }, open: { type: 'boolean' } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'sessions',
    description: 'Every coding session Fabric Dashboards lists, as its Sessions mode shows it (FD-247, SCN-109, SCN-110): this Mac\'s and those of the other machines it reads over ssh, one row each with id, project, folder, machine (null: this Mac), coding agent, account, context, state, group (needs-you, running, waiting, ended), origin (handover, resume, limit, switchboard, here, machine, dispatch), startedAt, endedAt, the actions it offers (pass id to session_action) and open_link to its page; machines[] says how each other machine\'s last read went. Filters as All sessions: machines (\'\' for this Mac), groups, origins, query (every word in project, folder, account, agent or machine). Never what a session printed. Answers app-not-running when the app is not open.',
    inputSchema: { type: 'object', properties: { machines: { type: 'array', items: { type: 'string', maxLength: 255 }, maxItems: 20 }, groups: { type: 'array', items: { type: 'string', enum: ['needs-you', 'running', 'waiting', 'ended'] }, maxItems: 4 }, origins: { type: 'array', items: { type: 'string', enum: ['handover', 'resume', 'limit', 'switchboard', 'here', 'machine', 'dispatch'] }, maxItems: 7 }, query: { type: 'string', maxLength: 200 } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'consoles',
    description: 'The coding-agent consoles running now in Fabric Dashboards on this machine (FD-166, for one screen of sessions): one row each with the agent it belongs to (service, or null for a console of its own: a hand-over, a session continued after a limit), the runtime, the folder, sessionId (Switchboard\'s provider_session_id, null when it named none, never guessed), runtimeSessionId (the runtime\'s own session id, the one fabric_session_observe records, null when not known), since, the Sessions row and open_link, which opens that session\'s page in the app. Never what a console printed. Answers app-not-running when the app is not open.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'settings',
    description: 'Settings as a person changes them in the window (FD-175, the operator 2026-11-07: every action of the interface by an agent at their request): without patch, the settings an agent may change as they stand; with patch, a partial change applied through Settings\' own code in the running app: language (system, en, ru), theme (dark, light, system), pageTheme, autoUpdate, analytics, launchAtLogin, notifications (its fields), resumeAfterLimit, remoteSessions, estate, layout.list.sort, layout.list.orgs, layout.list.groupByOrg, layout.list.orgSource (org or github, FD-237), layout.list.orgLabels ({organization name: label} shown in this app only) and layout.list.orgHidden (organization names left out of the Organizations menu, FD-248). Answers the fields changed and the ones refused (anything else, such as a console\'s folder). A change needs the app running (app-not-running otherwise).',
    inputSchema: { type: 'object', properties: { patch: { type: 'object' } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'session_action',
    description: 'A Sessions row\'s buttons in the running app (FD-175): continue (Continue, or Continue now with account, an account id of the row\'s candidates), end (End, which stops the coding session), dismiss (removes an ended row), clear-ended (Clear: every ended row; takes no row), attach (Open here, FD-211: a session Switchboard\'s session host holds opens in a console of its own; closing that console leaves the session running). row is the Sessions row id that consoles and the Sessions page give. Pass the operator\'s words in params._meta.decision when you have them (actions session-continue, session-end, session-dismiss, sessions-clear-ended, session-attach).',
    inputSchema: { type: 'object', properties: { act: { type: 'string', enum: ['continue', 'end', 'dismiss', 'clear-ended', 'attach'] }, row: { type: 'string', maxLength: 500 }, account: { type: 'string', maxLength: 64 } }, required: ['act'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'app_update',
    description: 'Check for updates, or Restart to update, as the window\'s buttons do (FD-175). check reads the update feed now (also with automatic updates off) and answers the update\'s state; restart installs a ready update, which may first ask the person when coding sessions run, as the button does. Pass the operator\'s words in params._meta.decision when you have them (actions check-for-updates, restart-to-update).',
    inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['check', 'restart'] } }, required: ['action'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'spend_limit_set',
    description: 'Change one of an agent\'s spending limits, as Change on Spend does (FD-324, contract DEC-0183): the agent\'s own `spend.limits.set` records it. limitId is a limit the spend tool lists with editable: true; give limitUsd (dollars, inside its minUsd..maxUsd), enforced, or both, and the reason it is recorded with. A lower amount or turning a limit on is your own act; a higher amount or turning it off is the operator\'s: pass their words in params._meta.decision (action spend.limits.set), else the answer is operator-decision-required. Answers the change the agent recorded (before, after, its id); the same idempotencyKey answers the first change.',
    inputSchema: { type: 'object', properties: {
      service: serviceArg,
      limitId: { type: 'string', minLength: 1, maxLength: 128 },
      limitUsd: { type: 'number', exclusiveMinimum: 0 },
      enforced: { type: 'boolean' },
      reason: { type: 'string', minLength: 1, maxLength: 500 },
      idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
    }, required: ['service', 'limitId', 'reason'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'agent_connect',
    description: 'Connect an organization\'s agents to this Mac from an invitation link, as the window\'s Connect an agent does (FD-331, FD-193): link is the whole fabric-dashboards://register?origin=…&invite=… link. The running app parses it, asks the person to confirm, redeems the one-time invitation for a token of this computer and adds the showcase and each agent its grant names. Answers host, added and skipped, or refused with why. Needs the app running.',
    inputSchema: { type: 'object', properties: { link: { type: 'string', maxLength: 2048 } }, required: ['link'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: 'console_choose',
    description: 'The console\'s pickers for one agent (FD-175): runtime, the coding agent that runs in its console (an id such as claude-code or codex, installed on this machine), and folder, the absolute path of an existing folder it opens in. For an agent placed on another machine (FD-205), where: there (the default) runs the console on that machine over ssh, here runs it on this Mac in the folder here. Saved as the person\'s choice; the next New session takes them. FD-334: clone: true alone is Clone and open, for an agent with a GitHub repository and no checkout here: Switchboard clones it with the person\'s gh into ~/DATA/<name> and the console opens there. Answers the runtime, folder and where in force, or unknown-runtime (with the ids installed here), no-folder or not-placed-elsewhere. Needs the app running.',
    inputSchema: { type: 'object', properties: { service: serviceArg, runtime: { type: 'string', maxLength: 64 }, folder: { type: 'string', maxLength: 4096 }, where: { type: 'string', enum: ['here', 'there'] }, clone: { type: 'boolean' } }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'app_install',
    description: 'Move to Applications, and Uninstall from Settings, as their buttons do (FD-175). Call only when the operator asked for this act. move-to-applications: the app moves itself to /Applications and opens from there (macOS; answers moved: false with why when it is not needed). uninstall: the app removes its login item and its MCP entry (this tool\'s own), moves itself to the Trash and quits; settings and history stay for a reinstall. uninstall-all: the same, and settings and history are deleted too, which cannot be undone. confirm repeats the action. The app answers before it quits; a refusal after that is in its main.log.',
    inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['move-to-applications', 'uninstall', 'uninstall-all'] }, confirm: { type: 'string', maxLength: 40 } }, required: ['action', 'confirm'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'arrange',
    description: 'Arrange the app\'s sidebar as its row menu and eye do (FD-122): pin or unpin an agent, hide it or show it again, show it as a service or as an agent, turn it off or on (FD-123), move it one place up or down within its section (move-up, move-down: the sidebar\'s drag, FD-121; the list\'s sort turns to manual) or move its open dashboard\'s tab one place left or right (tab-left, tab-right, FD-240), or pin or unpin that tab (tab-pin, tab-unpin, FD-280: a pinned tab stands first and has no close button). A hidden agent is still watched and still alerts; one turned off is also hidden, the app no longer probes it or alerts about it, and turning it on leaves it hidden and watched (show brings it back and turns it on). The choice is written to the app\'s settings and shows at once in a running app; with the app closed it applies when it opens. Answers the agent\'s list state after the change.',
    inputSchema: { type: 'object', properties: { service: serviceArg, action: { type: 'string', enum: [...ARRANGE] } }, required: ['service', 'action'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'rename',
    description: 'Give an agent a name of the operator\'s, as the row menu\'s Rename does (FD-135): the name is committed to the agent\'s own GitHub repository (`.fabric/names.json` on its default branch, a commit made with the GitHub CLI\'s sign-in), so every Mac running Fabric Dashboards shows it; null gives the agent its own name back. The agent\'s descriptor must name its repository (`source.repository`) on GitHub. Answers the name shown now, the agent\'s own name, the repository and the commit (null when nothing changed). Pass the operator\'s words in params._meta.decision when you have them (action rename).',
    inputSchema: { type: 'object', properties: { service: serviceArg, name: { type: ['string', 'null'], maxLength: 80 } }, required: ['service', 'name'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'bugs',
    description: 'The app\'s own bug journal (FD-263), newest first: each failure Fabric Dashboards noticed (an exception or unhandled rejection in its main process, an error in its window, a crashed process, an action that failed) once per fingerprint, with its scrubbed message, our own stack frames, how often, first and last seen, the versions and the GitHub issue it was filed as. Read-only; nothing in it names a person, a path or a secret.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 300 } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'agent_health',
    description: 'What each product\'s agent-health/1 report says now and the episodes Fabric Dashboards holds on it (FD-285, contract DEC-0179): per product when it was last read, the reader\'s state (unknown with its reason for a report that could not be read: no-answer, schema, FAC-SEM-181, other-product), the version and checks of the last trusted report (id, area, state, count, fix), and per check the open or owed episode (key <product>:<check>@<UTC day>, opened, state, count, fix, whether its message went out). Read every 5 minutes; Switchboard first. Read-only; counts and codes only.',
    inputSchema: { type: 'object', properties: { product: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,62}$' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'bug_report',
    description: 'File one bug of the journal (by its fingerprint, from bugs) as a GitHub issue in passioncode-ai/fabric-dashboards, a PUBLIC repository. Without publish: true it only answers the title and body it would file. With publish: true it files it once (an issue that already names the fingerprint is answered instead) with the GitHub CLI\'s sign-in and records the issue in the journal. Pass the operator\'s words in params._meta.decision when you have them (action bug-report).',
    inputSchema: { type: 'object', properties: { fp: { type: 'string', pattern: '^[0-9a-f]{12}$' }, publish: { type: 'boolean' } }, required: ['fp'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'service_context',
    description: 'Everything about one service a coding agent needs before working on it, read now: state and reasons as sentences, descriptor problems, version and pending update, repository, origin, dashboard, its descriptor (auth left out), its recent events and the rules for a console session. Call it first when a console was opened for this service (the first call of a session-handoff/1 pack, with key).',
    // FD-47 (DEC-0042 SH-7): the handoff's first call passes the agent's key as `key`; `service` is kept for older callers.
    // One of them is required, checked in `call`: a top-level anyOf makes the Anthropic API refuse the schema, so Claude Code drops the tool.
    inputSchema: { type: 'object', properties: { key: serviceArg, service: serviceArg }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'activity',
    description: 'The service\'s recent events as sentences, newest last; each with a link when it points at a page.',
    inputSchema: {
      type: 'object',
      properties: { service: serviceArg, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      required: ['service'], additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'connections',
    description: 'What one agent is connected to, as its Connections tab shows it: used_by (agents that declare calling it), offers (surfaces and MCP capabilities), uses (other agents with their own chain, models from its spend report, its runner, connectors, data stores, channels, parts it reports failing), each with a state (ok, degraded, down, unknown), and worst: the worst state of the agent and its whole chain. declared: false means the agent does not declare its connections yet (extensions/connections/0.1) and only what the app sees is listed; errors name why a declaration was refused.',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'setup_check',
    description: 'Check what is set up on this computer, as Settings → Check setup does: runs the PassionCode launcher\'s read-only doctor at its pinned version (npx, never --fix, up to two minutes) and returns its report: a summary (fail, warn, ok, info) and every check with its area, its own words and its fix, then `steps` (FD-185: one per area in order, done, attention or todo, with the first check that keeps it from done) and `next`, the first step not done, and `setup` (FD-208, FD-209: the same steps as fabric-agent-contract\'s draft `setup-layer/1` records, CT-290: `layers` in order, each with its owner and steps (state, actor, a person\'s `gate` and `why`), `sheet` the person\'s steps not done, `next` {steps, yours}). kind no-node: Node.js is not installed. It runs a program from npm: say so before calling it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'audit',
    description: 'The auditor over every installed agent, as the Agent map shows it: findings (worst first) with the agent to fix (key, name), severity (error: does not work; warn: works in part; setup: waits for a person; info: worth knowing), kind (state, part, connection, chain, declaration, update, limit; declaration also covers DEC-0121 actions: an invalid declaration, a button without an agent twin, FAC-SEM-142, and, as info, a dashboard that declares no actions yet) and the sentence the app shows; counts by severity; coverage (how many agents declare their connections); and the edges of the map (from, to, state); limitStops: the coding sessions Switchboard holds as stopped on a usage limit (folder, session, provider, when) with a verdict (resume: the app continues it; open: its terminal is still open; waiting, billing, old, no-folder, no-transcript, claimed: left for a person). Read-only; call it before and after a fix.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'load',
    description: 'How busy one agent is, from its own load report (Fabric Agent Contract DEC-0104, service-load/1), as its Load tab shows it: kind report with the declaration (path, windowSeconds, limits: concurrency, perCaller, queueMax) and the summary (running and queued at the end of the latest window, completed and failed in the last 24 h, per context with the latest wait and run times p50/p95 in ms, a series of the last windows, stale when the report is older than two windows); kind none when the agent declares no load; kind invalid with errors when its declaration is refused (FAC-SEM-133); kind error with the reason when the report cannot be read or fails its checks (FAC-SEM-132).',
    inputSchema: { type: 'object', properties: { service: serviceArg }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'spend',
    description: 'What each agent spent, from its own usage report (Fabric Agent Contract DEC-0021): today, the last 7 and 30 UTC days, per model, its budget and every spending limit it applies (limits: DEC-0027, ranked: tripped, breach, near, ok, unknown, cap (per order), threshold (approval), off (not enforced)). costUsd null means unknown, never $0; partial: true means the cost is a lower bound, tokensPartial: true that the token counts are (DEC-0091). costUsd is money only: calls paid by a subscription (route subscription, DEC-0046) are counted in subscriptionCalls and their list-price value in estimateUsd, an estimate never added to costUsd (FD-88); estimateUsd null means none of them is priced, estimatePartial: true that it is a lower bound (FD-97, DEC-0110); sides holds the calls, priced calls and known costs each of the two is read from (FD-101). One service, or every one.',
    inputSchema: {
      type: 'object',
      properties: { service: { ...serviceArg, description: 'One service key (id.instance); omit for every service' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'access',
    description: 'Who holds access to each product, from its own access-grants/1 list (contract DEC-0187): products with state read (grants, active, doors to issue and revoke), not-declared (it does not offer the list yet) or unreadable and refused with why, never "holds nothing". With service: that agent\'s holds (grants naming it as holder) and grantedTo (grants that open it), each with issuer, scopes, limit and its window, spent today, issued and revoked (by, via) and its state now (active, revoked, expired). No key value is read.',
    inputSchema: {
      type: 'object',
      properties: { service: { ...serviceArg, description: 'One agent (id.instance): also list what it holds and what opens it' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
] as const;
