#!/usr/bin/env node
// FD-146: a unit test that asserts a POSIX file mode or runs a POSIX shell breaks the Windows runners (validate on
// Windows x64 and arm64), which a check on macOS never sees; it happened in 0.7.11 and again on 2026-11-05
// (validate 41948124243). Every such line must sit in a test Windows skips (`skip: process.platform === 'win32' …`, a
// shared `POSIX` option) or behind `process.platform !== 'win32'` on its own line or just above it.
// Usage: node scripts/check-posix-tests.mjs [files…]; exit 1 names each unguarded line as file:line.
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['test', 'packages/service-host/test'];
// test/e2e runs on Windows only through desktop-other.test.ts (the e2e-other job); the rest is macOS-only.
const WINDOWS_E2E = new Set(['test/e2e/desktop-other.test.ts']);
// An assertion on a file's mode bits, and a POSIX shell run as a command. A shebang written into a fake script is not
// counted: writing it is harmless, and the tests that run such scripts are the ones this check reads.
const RISKY = [/assert[\w.]*\(.*\.mode\s*&\s*0o[0-7]+/, /\b(?:spawn|spawnSync|execFile|execFileSync|run)\(\s*['"`]\/bin\/(?:sh|bash|zsh)['"`]/];
const GUARD = /process\.platform\s*(?:!==|===)\s*['"]win32['"]|\bPOSIX\b/;

function files(args) {
  if (args.length) return args;
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'fixtures' && e.name !== 'contract') walk(p); }
      else if (/\.test\.ts$/.test(e.name)) out.push(p);
    }
  };
  for (const r of ROOTS) if (fs.existsSync(r)) walk(r);
  return out.filter((f) => !f.startsWith(`test${path.sep}e2e${path.sep}`) || WINDOWS_E2E.has(f.split(path.sep).join('/')));
}

/** The line indexes where each top-level test( starts, and the header text up to its body. */
function testsOf(lines) {
  const starts = [];
  lines.forEach((l, i) => { if (/^(?:test|it)\(/.test(l)) starts.push(i); });
  return starts.map((s) => {
    let header = '';
    for (let i = s; i < Math.min(lines.length, s + 6); i++) { header += lines[i]; if (/=>\s*\{|\)\s*\{\s*$/.test(lines[i])) break; }
    return { start: s, header };
  });
}

export function unguarded(text) {
  const lines = text.split('\n');
  const tests = testsOf(lines);
  const fileGuard = /^if\s*\(process\.platform\s*===\s*['"]win32['"]\)/m.test(text);
  const out = [];
  lines.forEach((l, i) => {
    if (!RISKY.some((r) => r.test(l))) return;
    if (fileGuard || GUARD.test(l) || GUARD.test(lines[i - 1] ?? '') || GUARD.test(lines[i - 2] ?? '')) return;
    // A line outside any test( is a helper; what it does is judged where a test runs it.
    const t = [...tests].reverse().find((x) => x.start <= i);
    if (!t || GUARD.test(t.header) || /\bskip:/.test(t.header)) return;
    out.push(i + 1);
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bad = [];
  for (const f of files(process.argv.slice(2))) for (const n of unguarded(fs.readFileSync(f, 'utf8'))) bad.push(`${f}:${n}`);
  if (bad.length) {
    console.error(`FAIL posix tests: ${bad.length} line(s) assert a POSIX mode or run a POSIX shell in a test Windows does not skip (FD-146):`);
    for (const b of bad) console.error(`  ${b}`);
    process.exit(1);
  }
  console.log('PASS posix tests: every POSIX-only assertion is skipped on Windows');
}
