import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Temporary file in the same directory, fsync, rename: a reader never sees half a file. */
export function atomicWrite(file: string, data: string | Buffer, mode = 0o600): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}`);
  const fd = fs.openSync(tmp, 'wx', mode);
  try {
    try {
      fs.writeSync(fd, typeof data === 'string' ? Buffer.from(data, 'utf8') : data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true }); // a full disk fails the write, not only the rename: never leave the temp file
    throw error;
  }
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** The last `maxLines` lines of a file, reading at most `maxBytes` from its end. */
export function tail(file: string, maxLines = 300, maxBytes = 256 * 1024): string {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift(); // a partial first line
    return lines.slice(-maxLines).join('\n');
  } finally {
    fs.closeSync(fd);
  }
}

/** atomicWrite's temporary name: `.<file>.<pid>.<8 hex>`. */
const TEMP = /^\..+\.(\d+)\.[0-9a-f]{8}$/;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'; // someone else's live process
  }
}

/**
 * Remove atomicWrite temporaries left by a process that died between write and rename (a
 * SIGKILL, a power cut). A live writer's temporary is kept. Run at start-up (lifecycle LC-12).
 */
export function sweepTemps(dir: string): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of names) {
    const m = TEMP.exec(name);
    if (!m) continue;
    const pid = Number(m[1]);
    if (pid === process.pid || alive(pid)) continue;
    try {
      fs.rmSync(path.join(dir, name), { force: true });
      removed.push(name);
    } catch { /* unremovable now; the next start tries again */ }
  }
  return removed;
}

/**
 * Append one line to a log, mode 0600, rotated by size (lifecycle LC-12): past `maxBytes` the file
 * becomes `<name>.1`, older ones shift up, and at most `keep` files exist. Never throws — logging
 * must not take the app down.
 */
export function appendLog(file: string, line: string, maxBytes = 5 * 1024 * 1024, keep = 5): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    let size = 0;
    try {
      const st = fs.statSync(file);
      size = st.size;
      if ((st.mode & 0o777) !== 0o600) fs.chmodSync(file, 0o600); // a log an earlier version left readable
    } catch { /* a new log */ }
    if (size >= maxBytes) {
      fs.rmSync(`${file}.${keep - 1}`, { force: true });
      for (let i = keep - 2; i >= 1; i -= 1) if (fs.existsSync(`${file}.${i}`)) fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`);
      fs.renameSync(file, `${file}.1`);
    }
    fs.appendFileSync(file, line.endsWith('\n') ? line : `${line}\n`, { mode: 0o600 });
  } catch { /* logging must never take the app down */ }
}
