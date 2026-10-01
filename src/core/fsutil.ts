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
