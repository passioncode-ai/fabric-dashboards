// Ports listening on every interface that no descriptor claims — the stray
// `python -m http.server` bound to every interface that served a source tree to the LAN (design O9).
import type { Runner } from './launchd';
import type { Listener } from './types';

export function parseLsof(stdout: string): Listener[] {
  const out: Listener[] = [];
  for (const line of stdout.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 9) continue;
    const name = cols[cols.length - 2] === '(LISTEN)' ? cols[cols.length - 3] : cols[cols.length - 2];
    const m = /^(.*):(\d+)$/.exec(name ?? '');
    if (!m) continue;
    out.push({ command: cols[0]!, pid: Number(cols[1]), address: m[1]!, port: Number(m[2]) });
  }
  const seen = new Set<string>();
  return out.filter((l) => { const k = `${l.pid}:${l.address}:${l.port}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function unattributed(listeners: Listener[], claimedPorts: Set<number>): Listener[] {
  return listeners
    .filter((l) => ['*', '0.0.0.0', '[::]', '::'].includes(l.address) && !claimedPorts.has(l.port))
    .sort((a, b) => a.port - b.port);
}

export async function listListeners(run: Runner): Promise<Listener[]> {
  const r = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], 10_000);
  // R-16: lsof exits 1 with nothing on stdout or stderr when nothing listens — that is "none", not a failure.
  if (r.code !== 0 && !r.stdout && r.stderr.trim()) throw new Error(r.stderr.trim());
  if (r.code !== 0 && !r.stdout && r.code !== 1) throw new Error(`lsof failed (exit ${r.code})`);
  return parseLsof(r.stdout);
}
