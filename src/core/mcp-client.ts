// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48: the smallest MCP client the operator channel needs — streamable HTTP on this machine only (127.0.0.1),
// initialize, initialized, tools/list, one tools/call, then the session is closed. A local service on the
// operator's own Mac is trust tier T0 (ADR-0144 amendment 4); a service whose descriptor names a token file gets
// its own header. The host and port come from the service's origin only, never from the path.
import http from 'node:http';

export interface McpTarget { origin: string; path: string; headers?: Record<string, string> }

interface Answer { status: number; headers: http.IncomingHttpHeaders; body: string }

const MAX_BODY = 1_000_000;

function endpoint(target: McpTarget): { port: number; path: string } {
  const origin = new URL(target.origin);
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port) throw new Error('the operator channel is reached on this machine only');
  if (!/^\/(?!\/)[^\s]*$/.test(target.path)) throw new Error('the MCP path is a path on the service');
  return { port: Number(origin.port), path: target.path };
}

function send(target: McpTarget, method: 'POST' | 'DELETE', message: unknown, session: string | null, deadline: number): Promise<Answer> {
  let where: { port: number; path: string };
  try { where = endpoint(target); } catch (error) { return Promise.reject(error); }
  const body = message === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(message));
  const left = deadline - Date.now();
  if (left <= 0) return Promise.reject(new Error('the call ran out of time'));
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: where.port, path: where.path, method, timeout: left,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Content-Length': body.length, ...(session ? { 'Mcp-Session-Id': session } : {}), ...(target.headers ?? {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) { res.destroy(new Error(`the answer is larger than ${MAX_BODY} bytes`)); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    // The whole call has one deadline, not only an idle timeout: a server that trickles bytes cannot hold it.
    const timer = setTimeout(() => req.destroy(new Error('the call ran out of time')), left);
    req.on('close', () => clearTimeout(timer));
    req.on('timeout', () => req.destroy(new Error('no answer in time')));
    req.on('error', reject);
    req.end(body);
  });
}

/** A JSON-RPC answer from a JSON body or a server-sent-events stream: each event's `data:` lines joined, the one
 *  with this id taken. */
export function rpcResult(a: Pick<Answer, 'headers' | 'body'>, id: number): { result?: unknown; error?: { message?: string } } {
  const type = String(a.headers['content-type'] ?? '');
  const candidates = type.includes('text/event-stream')
    ? a.body.split(/\r?\n\r?\n/).map((event) => event.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n')).filter(Boolean)
    : [a.body];
  for (const text of candidates.reverse()) {
    try {
      const msg = JSON.parse(text) as { id?: unknown; result?: unknown; error?: { message?: string } };
      if (msg.id === id) return msg;
    } catch { /* not JSON: keep looking */ }
  }
  throw new Error('the MCP answer could not be read');
}

/**
 * Call the tool that serves a capability; a refusal (`isError` or a JSON-RPC error) is thrown with the server's own
 * words. Servers name a capability's tool with its dots (`relay.notify`) or with underscores (`relay_notify`, the
 * contract's capability-underscores spelling), so the session's `tools/list` decides which one this server has.
 */
export async function callCapability(target: McpTarget, capability: string, args: Record<string, unknown>, clientVersion: string, timeoutMs = 15_000): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  const init = await send(target, 'POST', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'fabric-dashboards', version: clientVersion } } }, null, deadline);
  if (init.status !== 200) throw new Error(`initialize answered HTTP ${init.status}`);
  const first = rpcResult(init, 1);
  if (first.error) throw new Error(`initialize refused: ${first.error.message ?? 'no reason'}`);
  const session = typeof init.headers['mcp-session-id'] === 'string' ? init.headers['mcp-session-id'] : null;
  try {
    await send(target, 'POST', { jsonrpc: '2.0', method: 'notifications/initialized' }, session, deadline);
    const listed = await send(target, 'POST', { jsonrpc: '2.0', id: 3, method: 'tools/list' }, session, deadline);
    const names = ((rpcResult(listed, 3).result as { tools?: { name?: unknown }[] } | undefined)?.tools ?? []).map((t) => t.name).filter((n): n is string => typeof n === 'string');
    const tool = [capability, capability.replace(/[.-]/g, '_')].find((n) => names.includes(n));
    if (!tool) throw new Error(`the server offers no tool for ${capability} (it lists ${names.slice(0, 8).join(', ') || 'none'})`);
    const call = await send(target, 'POST', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } }, session, deadline);
    if (call.status !== 200) throw new Error(`${tool} answered HTTP ${call.status}`);
    const answer = rpcResult(call, 2);
    if (answer.error) throw new Error(`${tool} refused: ${answer.error.message ?? 'no reason'}`);
    const result = answer.result as { isError?: boolean; content?: { type: string; text?: string }[] } | undefined;
    if (result?.isError) throw new Error(`${tool} refused: ${(result.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 300)}`);
    return result;
  } finally {
    // Best effort: the server keeps no session per message.
    if (session) await send(target, 'DELETE', undefined, session, Date.now() + 2_000).catch(() => undefined);
  }
}
// #endregion outage-alerts
