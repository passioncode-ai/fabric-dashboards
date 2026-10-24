// #region e2e-runner — docs: CONTRIBUTING.md#end-to-end-tests
// Runs the e2e suite (HV-02). Serial by default: every file starts its own Electron, and files in parallel filled
// the disk and swap of a loaded Mac (0.7.28). `--parallel` (`npm run test:e2e -- --parallel`) or
// FD_E2E_CONCURRENCY=<n> opts in; file arguments after the flags run only those files.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The node --test concurrency flags for this run: serial unless asked otherwise. */
export function concurrencyArgs(env, argv) {
  if (argv.includes('--parallel')) return []; // node's own default: available parallelism minus one
  const raw = env.FD_E2E_CONCURRENCY;
  if (raw === undefined || raw === '') return ['--test-concurrency=1'];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`FD_E2E_CONCURRENCY must be a whole number of at least 1, not ${JSON.stringify(raw)}`);
  return [`--test-concurrency=${n}`];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  let flags;
  try {
    flags = concurrencyArgs(process.env, argv);
  } catch (error) {
    console.error(`e2e: ${error.message}`);
    process.exit(1);
  }
  const named = argv.filter((a) => !a.startsWith('--'));
  const files = named.length ? named : readdirSync('test/e2e').filter((f) => f.endsWith('.test.ts')).sort().map((f) => path.join('test/e2e', f));
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...flags, ...files], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
// #endregion e2e-runner
