// FD-354 (SCN-080 step 6): Open session, a session's own conversation read here. A coding agent writes its transcript as
// JSON lines (Claude Code: `{type, message: {role, content}}`; Codex: `{type: 'response_item', payload: {type, role,
// content}}`); this module turns the end of one into what a person reads: what they asked, what the agent answered, and
// the tools it ran, named. Pure, so the renderer and the tests can import it; the file is read in the main process only.

export interface TranscriptEntry {
  /** `you`: the person's message; `agent`: the agent's answer; `tools`: the tools the agent ran next, by name. */
  who: 'you' | 'agent' | 'tools';
  text: string;
  /** Milliseconds since the epoch, or null when the line carries no time. */
  at: number | null;
}

export interface TranscriptRead {
  entries: TranscriptEntry[];
  /** Messages before the first one shown exist in the file (the read began past its start, or more were cut). */
  truncated: boolean;
  /** No line was a message this module knows: another runtime's format, or a file that is not a transcript. */
  unknown: boolean;
}

/** What Open session answers the page: the messages, or why there are none. */
export type TranscriptAnswer = ({ ok: true } & TranscriptRead) | { ok: false; reason: 'unknown' | 'no-transcript' | 'spawn'; detail?: string };

/** The end of a transcript the main process reads (bytes): a long session's file runs to hundreds of megabytes. */
export const TRANSCRIPT_TAIL_BYTES = 4 * 1024 * 1024;
/** The most messages shown; the rest are said to be in the file. */
export const TRANSCRIPT_MAX_ENTRIES = 200;
/** One message's text past this is cut, with an ellipsis. */
export const TRANSCRIPT_MAX_TEXT = 6000;

type Part = { type?: unknown; text?: unknown; name?: unknown };

/** `text` cut at the limit; whitespace at the ends dropped. */
function clip(text: string): string {
  const s = text.trim();
  return s.length > TRANSCRIPT_MAX_TEXT ? `${s.slice(0, TRANSCRIPT_MAX_TEXT)}…` : s;
}

function timeOf(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** A person's message that only carries the runtime's own wrapping (a slash command's echo, a reminder) is not shown. */
const wrapped = (text: string) => /^<(command-|local-command-|system-reminder|user-prompt-submit-hook|environment_context|user_instructions)/.test(text);

/** One JSON line as messages: its text and the tools it ran. */
function partsOf(line: Record<string, unknown>): { role: 'user' | 'assistant'; texts: string[]; tools: string[] } | null {
  // Codex wraps each item in `payload`; Claude Code puts the message in `message`.
  const item = (line.type === 'response_item' && line.payload && typeof line.payload === 'object' ? line.payload : line) as Record<string, unknown>;
  if (item.isMeta === true || item.isSidechain === true) return null;
  if (item.type === 'function_call' || item.type === 'custom_tool_call' || item.type === 'local_shell_call') {
    return { role: 'assistant', texts: [], tools: [typeof item.name === 'string' ? item.name : 'shell'] };
  }
  const msg = (item.message && typeof item.message === 'object' ? item.message : item) as Record<string, unknown>;
  const role = msg.role ?? item.type;
  if (role !== 'user' && role !== 'assistant') return null;
  const texts: string[] = [];
  const tools: string[] = [];
  const content = msg.content;
  if (typeof content === 'string') texts.push(content);
  else if (Array.isArray(content)) {
    for (const p of content as Part[]) {
      if (!p || typeof p !== 'object') continue;
      if ((p.type === 'text' || p.type === 'input_text' || p.type === 'output_text') && typeof p.text === 'string') texts.push(p.text);
      else if (p.type === 'tool_use' && typeof p.name === 'string') tools.push(p.name);
      // tool_result, thinking, images: not shown; a tool's output is the agent's to summarise.
    }
  }
  return { role, texts, tools };
}

/** The messages of a transcript's text. `partial`: the text starts mid-file, so its first line may be cut and is dropped. */
export function parseTranscript(text: string, o: { partial?: boolean } = {}): TranscriptRead {
  const lines = text.split('\n');
  if (o.partial) lines.shift();
  const entries: TranscriptEntry[] = [];
  let known = false;
  for (const raw of lines) {
    const s = raw.trim();
    if (!s.startsWith('{')) continue;
    let line: unknown;
    try { line = JSON.parse(s); } catch { continue; }
    if (!line || typeof line !== 'object' || Array.isArray(line)) continue;
    const parts = partsOf(line as Record<string, unknown>);
    if (!parts) continue;
    known = true;
    const at = timeOf((line as Record<string, unknown>).timestamp);
    const said = parts.texts.map((x) => x.trim()).filter((x) => x && !(parts.role === 'user' && wrapped(x)));
    if (said.length) entries.push({ who: parts.role === 'user' ? 'you' : 'agent', text: clip(said.join('\n\n')), at });
    if (parts.tools.length) {
      const last = entries[entries.length - 1];
      // Tools run one after another read as one line: "Read, Edit, Bash".
      if (last?.who === 'tools') last.text = clip(`${last.text}, ${parts.tools.join(', ')}`);
      else entries.push({ who: 'tools', text: parts.tools.join(', '), at });
    }
  }
  const cut = entries.length > TRANSCRIPT_MAX_ENTRIES;
  return { entries: cut ? entries.slice(-TRANSCRIPT_MAX_ENTRIES) : entries, truncated: Boolean(o.partial) || cut, unknown: !known };
}
