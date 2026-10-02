// Test-only reach into an online service (DEC-0019): a name that does not resolve here and a
// certificate the system store does not trust. Set ONLY by the Electron main process, and only when
// the app is not packaged (main.ts) — an environment variable alone never turns this on, so a
// shipped app always resolves names and verifies certificates the normal way.
import fs from 'node:fs';
import type { TlsOptions } from '@passioncode-ai/fabric-service-host';

export interface TestRemote { name: string; connectHost: string; connectPort: number; caPem: string }

let current: TestRemote | null = null;

/** Parse `FD_TEST_REMOTE` = `{"name":"agent.example.com","connect":"127.0.0.1:47123","caFile":"/…/cert.pem"}`. */
export function parseTestRemote(raw: string | undefined): TestRemote | null {
  if (!raw) return null;
  const v = JSON.parse(raw) as { name?: string; connect?: string; caFile?: string };
  const [host, port] = String(v.connect ?? '').split(':');
  if (!v.name || !host || !port || !v.caFile) throw new Error('FD_TEST_REMOTE needs name, connect (host:port) and caFile');
  return { name: v.name, connectHost: host, connectPort: Number(port), caPem: fs.readFileSync(v.caFile, 'utf8') };
}

export function setTestRemote(t: TestRemote | null): void { current = t; }
export function testRemote(): TestRemote | null { return current; }

/** TLS options for a request to `origin`: the test override for its name, else none (system trust). */
export function tlsFor(origin: string): TlsOptions {
  if (!current) return {};
  let host = '';
  try { host = new URL(origin).hostname; } catch { return {}; }
  return host === current.name ? { ca: current.caPem, connect: { host: current.connectHost, port: current.connectPort } } : {};
}
