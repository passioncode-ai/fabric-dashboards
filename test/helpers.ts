import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const SAMPLE = path.join(__dirname, 'fixtures/sample-service/sample_service.py');

const made: string[] = [];
process.on('exit', () => {
  for (const dir of made) try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a file still held open (Windows) stays */ }
});
/** A temporary directory removed when the test process exits (each test file is its own process). */
export const tmp = (prefix = 'fd-') => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); made.push(dir); return dir; };

export async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

export function register(port: number, dataDir: string, servicesDir: string, extra: string[] = []): void {
  const r = spawnSync('python3', [SAMPLE, 'register', '--port', String(port), '--data-dir', dataDir, '--services-dir', servicesDir, ...extra], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
}

export function serve(port: number, dataDir: string, extra: string[] = []): ChildProcess {
  return spawn('python3', [SAMPLE, 'serve', '--port', String(port), '--data-dir', dataDir, ...extra], { stdio: 'ignore' });
}

export async function waitFor<T>(what: string, fn: () => T | Promise<T>, timeoutMs = 15_000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last as NonNullable<T>;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

export async function waitAnswering(port: number): Promise<void> {
  await waitFor(`port ${port}`, () => new Promise<boolean>((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => { s.end(); resolve(true); });
    s.on('error', () => resolve(false));
  }));
}

export function stopProcess(p: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (p.exitCode !== null || p.signalCode !== null) return resolve();
    p.once('exit', () => resolve());
    p.kill('SIGTERM');
  });
}
