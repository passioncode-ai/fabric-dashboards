// A temporary directory that is removed when the test process exits (each test file is its own process).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const made: string[] = [];
process.on('exit', () => {
  for (const dir of made) try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a file still held open (Windows) stays */ }
});

export function tmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}
