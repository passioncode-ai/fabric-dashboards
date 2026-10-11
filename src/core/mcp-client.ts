// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48: the smallest MCP client the operator channel needs — streamable HTTP on this machine only (127.0.0.1),
// initialize, initialized, one tools/call. A local service on the operator's own Mac is trust tier T0 (ADR-0144
// amendment 4): no token is needed; a service whose descriptor names a token file gets its own header.
import http from 'node:http';

export interface McpTarget { origin: string; path: string; headers?: Record<string, string> }

interface Answer { status: number; headers: http.IncomingHttpHeaders; body: string }

function post(target: McpTarget, message: unknown, session: string | null, timeoutMs: number): Promise<Answer> {
  const url = new URL(target.path, target.origin);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') return Promise.reject(new Error('the operator channel is reached on this machine only'));
  const body = Buffer.from(JSON.stringify(message));
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: Number(url.port), path: `${url.pathname}${url.search}`, method: 'POST', timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Content-Length': body.length, ...(session ? { 'Mcp-Session-Id': session } : {}), ...(target.headers ?? {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => { size += c.length; if (size <= 1_000_000) chunks.push(c); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`no answer in ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end(body);
  });
}

/** A JSON-RPC answer from a JSON body or a server-sent-events stream (the last `data:` that parses). */
export function rpcResult(a: Pick<Answer, 'headers' | 'body'>, id: number): { result?: unknown; error?: { message?: string } } {
  const type = String(a.headers['content-type'] ?? '');
  const candidates = type.includes('text/event-stream')
    ? a.body.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim())
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
export async function callCapability(target: McpTarget, capability: string, args: Record<string, unknown>, clientVersion: string, timeoutMs = 10_000): Promise<unknown> {
  const init = await post(target, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'fabric-dashboards', version: clientVersion } } }, null, timeoutMs);
  if (init.status !== 200) throw new Error(`initialize answered HTTP ${init.status}`);
  const first = rpcResult(init, 1);
  if (first.error) throw new Error(`initialize refused: ${first.error.message ?? 'no reason'}`);
  const session = typeof init.headers['mcp-session-id'] === 'string' ? init.headers['mcp-session-id'] : null;
  await post(target, { jsonrpc: '2.0', method: 'notifications/initialized' }, session, timeoutMs);
  const listed = await post(target, { jsonrpc: '2.0', id: 3, method: 'tools/list' }, session, timeoutMs);
  const names = ((rpcResult(listed, 3).result as { tools?: { name?: unknown }[] } | undefined)?.tools ?? []).map((t) => t.name).filter((n): n is string => typeof n === 'string');
  const tool = [capability, capability.replace(/[.-]/g, '_')].find((n) => names.includes(n));
  if (!tool) throw new Error(`the server offers no tool for ${capability} (it lists ${names.slice(0, 8).join(', ') || 'none'})`);
  const call = await post(target, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } }, session, timeoutMs);
  if (call.status !== 200) throw new Error(`${tool} answered HTTP ${call.status}`);
  const answer = rpcResult(call, 2);
  if (answer.error) throw new Error(`${tool} refused: ${answer.error.message ?? 'no reason'}`);
  const result = answer.result as { isError?: boolean; content?: { type: string; text?: string }[] } | undefined;
  if (result?.isError) throw new Error(`${tool} refused: ${(result.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 300)}`);
  return result;
}
// #endregion outage-alerts
