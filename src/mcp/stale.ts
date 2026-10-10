// A per-session MCP server leaves with the code it was started from (lifecycle LC-10). An app
// update replaces the bundle while Claude Code sessions keep their server processes running from the
// deleted inode: old tools, old version, nobody told. This watch notices.
// #region stale-server — docs: AGENTS.md#lifecycle
import fs from 'node:fs';
import path from 'node:path';

// Either separator: the code is the same on every system, the tests run on all of them (FD-37).
const ASAR_MARK = /[\\/]Contents[\\/]Resources[\\/]app\.asar[\\/]/;

/**
 * The file whose identity stands for "the installed code". Inside the packaged app that is
 * Contents/Info.plist: a real file outside app.asar (Electron's archive reader keeps the old
 * archive open, so a read through it can return the replaced code), rewritten by every update. In
 * a checkout it is the server's own compiled file.
 */
export function codeFile(from = __filename): string {
  const m = ASAR_MARK.exec(from);
  if (!m) return from;
  const sep = m[0][0]!; // the path keeps the separators it came with, on any system
  return [from.slice(0, m.index), 'Contents', 'Info.plist'].join(sep);
}

/** CFBundleShortVersionString from an XML Info.plist, read with plain fs. */
export function plistVersion(file: string): string | null {
  try {
    return /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? null;
  } catch {
    return null;
  }
}

function stamp(file: string): string | null {
  try {
    const s = fs.statSync(file);
    return `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

export interface Staleness { stale: boolean; running: string; installed: string | null }

export class StaleWatch {
  private readonly started: { version: string; stamp: string | null };

  constructor(private readonly file: string, private readonly installedVersion: () => string | null) {
    this.started = { version: installedVersion() ?? '0.0.0', stamp: stamp(file) };
  }

  /** Stale when the file is gone or replaced, or the installed version moved. */
  check(): Staleness {
    const installed = this.installedVersion();
    const now = stamp(this.file);
    const stale = now === null || now !== this.started.stamp || (installed !== null && installed !== this.started.version);
    return { stale, running: this.started.version, installed };
  }

  get runningVersion(): string {
    return this.started.version;
  }
}
// #endregion stale-server
