// FD-94: on Windows, the app's compiled ACL reader (build/win/acl.cs) built once per test run with the .NET Framework
// compiler every Windows has, so token reads in tests go the way the installed app reads them. Elsewhere: null.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let built: string | null | undefined;

/** The reader's path, built on first use; null off Windows or where the compiler is missing. */
export function windowsAclReader(): string | null {
  if (built !== undefined) return built;
  built = null;
  if (process.platform !== 'win32') return built;
  const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  if (!fs.existsSync(csc)) return built;
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fd-acl-reader-')), 'fabric-dashboards-acl.exe');
  execFileSync(csc, ['-nologo', '-optimize', '-target:exe', '-platform:anycpu', `-out:${out}`, path.resolve(__dirname, '../build/win/acl.cs')], { stdio: 'ignore', windowsHide: true });
  built = fs.existsSync(out) ? out : null;
  return built;
}
