// #region console-channel-server — docs: docs/adr/0025-the-console-channel.md#decision
// ADR-0025: the channel's listening end in the main process. Made at start, removed at quit; a socket file a killed run
// left is removed only when nobody answers on it; on Windows the pipe must be this run's own first instance.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { CHANNEL_KEY_FILE, CHANNEL_MAX_BYTES, CHANNEL_READ_MS, RateLimit, channelAddress, keyMatches, newChannelKey, parseRequest, type ChannelAnswer, type ChannelRequest } from '../core/console-channel';

export interface ChannelOptions {
  userData: string;
  platform?: NodeJS.Platform;
  /** The buttons' own code path: start a console session, or a fix in one. */
  start: (request: ChannelRequest) => Promise<ChannelAnswer>;
  log: (line: string) => void;
  now?: () => number;
  /** Tests name their own address; the app uses `channelAddress`. */
  address?: string;
}

export interface Channel { address: string; close(): Promise<void> }

/** Whether something answers on a socket path (a live run of the app, or another program). */
function answers(address: string): Promise<boolean> {
  return new Promise((resolve) => {
    const c = net.connect(address);
    c.once('connect', () => { c.destroy(); resolve(true); });
    c.once('error', () => resolve(false));
  });
}

export async function openChannel(o: ChannelOptions): Promise<Channel | null> {
  const platform = o.platform ?? process.platform;
  const address = o.address ?? channelAddress(o.userData, platform);
  const keyFile = path.join(o.userData, CHANNEL_KEY_FILE);
  const now = o.now ?? Date.now;
  fs.mkdirSync(o.userData, { recursive: true, mode: 0o700 });
  if (platform !== 'win32') {
    fs.chmodSync(o.userData, 0o700);
    if (fs.existsSync(address)) {
      if (await answers(address)) { o.log('console channel: another program answers on the socket; the channel stays closed'); return null; }
      fs.rmSync(address, { force: true }); // left by a killed run
    }
  }
  const key = newChannelKey();
  const temp = `${keyFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, key, { mode: 0o600 });
  fs.renameSync(temp, keyFile);
  const limit = new RateLimit();
  const answer = (socket: net.Socket, a: ChannelAnswer) => { socket.end(`${JSON.stringify(a)}\n`); };
  const server = net.createServer((socket) => {
    let buffer = '';
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; answer(socket, { ok: false, code: 'timeout' }); } }, CHANNEL_READ_MS);
    socket.on('error', () => undefined);
    socket.on('data', (chunk) => {
      if (done) return;
      buffer += String(chunk);
      if (Buffer.byteLength(buffer) > CHANNEL_MAX_BYTES + 1) { done = true; clearTimeout(timer); answer(socket, { ok: false, code: 'too-large' }); return; }
      const nl = buffer.indexOf('\n');
      if (nl < 0) return;
      done = true;
      clearTimeout(timer);
      const parsed = parseRequest(buffer.slice(0, nl));
      if (!parsed.ok) return answer(socket, { ok: false, code: parsed.code });
      if (!keyMatches(parsed.request.key, key)) { o.log('console channel: a request with a wrong key was refused'); return answer(socket, { ok: false, code: 'bad-key' }); }
      if (!limit.take(now())) return answer(socket, { ok: false, code: 'busy' });
      o.log(`console channel: ${parsed.request.op} for ${parsed.request.service}`);
      o.start(parsed.request).then((a) => answer(socket, a), (error: Error) => answer(socket, { ok: false, code: 'internal', detail: error.message.slice(0, 200) }));
    });
  });
  server.maxConnections = 4;
  const listening = await new Promise<boolean>((resolve) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      o.log(`console channel: not opened (${error.code ?? error.message}); a second instance of the pipe is refused`);
      resolve(false);
    });
    server.listen(address, () => resolve(true));
  });
  if (!listening) { fs.rmSync(keyFile, { force: true }); return null; }
  if (platform !== 'win32') fs.chmodSync(address, 0o600);
  return {
    address,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      fs.rmSync(keyFile, { force: true });
      if (platform !== 'win32') fs.rmSync(address, { force: true });
    }),
  };
}

/** The buttons' answer as the channel says it: a started session, or why it did not start. */
export function startAnswer(service: string, r: { ok: true } | { ok: false; reason: string; detail?: string }): ChannelAnswer {
  return r.ok ? { ok: true, consoleKey: service } : { ok: false, code: r.reason, ...(r.detail ? { detail: r.detail.slice(0, 200) } : {}) };
}
// #endregion console-channel-server
