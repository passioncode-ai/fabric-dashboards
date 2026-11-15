// FD-270 (FD-235 P5, security audit 2026-11-13; machine rule: never launch, quit or kill an enrolled app or job directly):
// the launchd jobs the local lifecycle broker enrolls are its to start, stop and restart. Its registry names each target
// with its kind and identity (`kind: "launchd"`, `identity.label`); Start, Stop and Restart here refuse such a job and name
// the broker's target, so the app never fights the broker that owns it. The registry is the broker's own file, read
// without its tokens; an absent or unreadable one changes nothing (the broker enrolls only apps today).
// #region broker-targets — docs: docs/ux/scenarios.md#scn-010-start-a-stopped-service
import { readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BROKER_REGISTRY = path.join(os.homedir(), 'Library', 'Application Support', 'local-lifecycle', 'default', 'registry.json');

/** The broker's launchd targets by label: label -> target id. Apps and malformed entries are left out. */
export function brokerLaunchdTargets(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const doc = JSON.parse(text) as { targets?: unknown };
  const targets = doc && typeof doc === 'object' ? doc.targets : undefined;
  const entries: [string, unknown][] = Array.isArray(targets)
    ? targets.map((t) => [String((t as { targetId?: unknown })?.targetId ?? ''), t])
    : targets && typeof targets === 'object' ? Object.entries(targets as Record<string, unknown>) : [];
  for (const [key, t] of entries) {
    if (!t || typeof t !== 'object') continue;
    const o = t as { kind?: unknown; targetId?: unknown; identity?: { label?: unknown } };
    if (o.kind !== 'launchd') continue;
    const label = o.identity?.label;
    const id = typeof o.targetId === 'string' && o.targetId ? o.targetId : key;
    if (typeof label === 'string' && label && id) out.set(label, id);
  }
  return out;
}

/** Which broker target holds a launchd label; the file is read again only when it changed, at most every `everyMs`. */
export class BrokerTargetReader {
  private checkedAt = -Infinity;
  private stamp = '';
  private current = new Map<string, string>();
  error: string | null = null;

  constructor(private readonly o: { file?: string; everyMs?: number; platform?: NodeJS.Platform; stat?: (f: string) => { mtimeMs: number; size: number }; read?: (f: string) => string } = {}) {}

  targetOf(label: string, now: number): string | null {
    if ((this.o.platform ?? process.platform) !== 'darwin') return null;
    return this.targets(now).get(label) ?? null;
  }

  private targets(now: number): Map<string, string> {
    if (now - this.checkedAt < (this.o.everyMs ?? 5000)) return this.current;
    this.checkedAt = now;
    const file = this.o.file ?? BROKER_REGISTRY;
    let info: { mtimeMs: number; size: number };
    try { info = (this.o.stat ?? statSync)(file); } catch {
      this.stamp = '';
      this.current = new Map();
      this.error = null;
      return this.current;
    }
    const stamp = `${info.mtimeMs}:${info.size}`;
    if (stamp === this.stamp) return this.current;
    this.stamp = stamp;
    try {
      this.current = brokerLaunchdTargets((this.o.read ?? ((f) => readFileSync(f, 'utf8')))(file));
      this.error = null;
    } catch (error) {
      this.current = new Map();
      this.error = (error as Error).message;
    }
    return this.current;
  }
}
// #endregion broker-targets
