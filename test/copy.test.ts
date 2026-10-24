// COPY-01 to COPY-29 (docs/reports/2026-10-24-ui-ux-iteration): the words of the interface, checked where the
// dictionary test cannot see them. The brand pack is docs/brand/ (voice.md, terminology.md, locales/ru.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { transformSync } from 'esbuild';
import { allKeys, dictionary, setWording, t, type Lang } from '../src/core/i18n';

const ROOT = path.join(import.meta.dirname, '..');
const EM_DASH = '—';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx|mts|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

/** Every em dash left in a file once its comments are gone: string literals, template literals, JSX text and
 *  regular expressions. esbuild drops every comment when it minifies whitespace, the `// #region <slug> — docs:`
 *  markers with them, so a dash in a comment is never counted. Each hit is shown with its surroundings. */
export function emDashesInCode(file: string, source = fs.readFileSync(file, 'utf8')): string[] {
  const code = transformSync(source, {
    loader: file.endsWith('x') ? 'tsx' : 'ts',
    legalComments: 'none',
    charset: 'utf8',
    jsx: 'preserve',
    minifyWhitespace: true,
  }).code;
  const hits: string[] = [];
  for (let i = code.indexOf(EM_DASH); i >= 0; i = code.indexOf(EM_DASH, i + 1)) hits.push(code.slice(Math.max(0, i - 40), i + 30));
  return hits;
}

/** Files another wave of the 0.8.0 iteration owns, with the dashes they still carry. Each is a limit, not a
 *  permission: the count may only fall. Empty since the Sessions mode (FD-103, node S3) removed the hand-over page. */
const PENDING: Record<string, number> = {};

test('operator 2026-10-18 (COPY-02, COPY-03): no em dash in any string composed in code, in either language', () => {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    const hits = emDashesInCode(file);
    if (hits.length) found.set(path.relative(ROOT, file).split(path.sep).join('/'), hits);
  }
  const over = [...found].filter(([file, hits]) => hits.length > (PENDING[file] ?? 0)).map(([file, hits]) => `${file}: ${hits.join(' | ')}`);
  assert.deepEqual(over, [], 'use a colon, a comma or parentheses instead');
});

test('the em dash scanner counts code and never a comment', () => {
  const sample = `// #region x ${EM_DASH} docs: a.md#b\n/** a ${EM_DASH} b */\nconst a = 'one ${EM_DASH} two'; // c ${EM_DASH} d\nconst b = <p>x ${EM_DASH} y{/* z ${EM_DASH} */}</p>;\n`;
  assert.equal(emDashesInCode('x.tsx', sample).length, 2, 'the string literal and the JSX text');
});

test('COPY-04, COPY-05: a Russian count follows its label, so no form depends on the number', () => {
  const ru = dictionary('ru');
  const before = Object.entries(ru).filter(([, v]) => /\{(count|n|ready|total|cap)\} (?!из )[а-яё]/i.test(v) && !/^\{n\} (мс|с|мин|ч|дн)( назад)?$/.test(v)).map(([k]) => k);
  assert.deepEqual(before, [], 'write «Агентов: {count}», not «{count} агентов»');
  assert.equal(ru['overview.count.one'], 'Агентов: 1');
  for (const key of ['overview.strip.ready', 'overview.strip.down', 'overview.strip.attention'] as const) {
    assert.match(dictionary('en')[key], /^[A-Z]/, `${key} is a heading over its number`);
    assert.match(ru[key], /^[А-ЯЁ]/, `${key} is a heading over its number`);
  }
});

test('COPY-06 to COPY-11: one word for each thing and each state, in both languages', () => {
  for (const lang of ['en', 'ru'] as Lang[]) {
    const d = dictionary(lang);
    assert.equal(d['map.fix'], d['agent.fix'], `${lang}: Fix has one name`);
    assert.equal(d['conn.state.degraded'], d['state.degraded'], `${lang}: partly working has one name`);
    assert.equal(d['conn.state.down'], d['state.down'], `${lang}: not answering has one name`);
    assert.equal(d['map.severity.warn'], d['state.degraded'], `${lang}: the map says what the chip says`);
    assert.equal(d['conn.kind.runner'], d['profile.runner'], `${lang}: what an agent runs on has one name`);
  }
  const en = dictionary('en');
  const ru = dictionary('ru');
  assert.equal(en['state.stopped'], 'Stopped', 'the chip says what the Stop button did');
  assert.deepEqual(Object.entries(ru).filter(([, v]) => /кодинг-агент/i.test(v)).map(([k]) => k), [], 'агент для кода');
  assert.deepEqual(Object.entries(en).filter(([, v]) => /\bwith agent\b|\bRuntime\b|\bruntimes?\b|\bRunner\b/.test(v)).map(([k]) => k), [], 'coding agent; what it runs on');
  assert.deepEqual(Object.entries(en).filter(([k, v]) => /\bDegraded\b/.test(v) && k.startsWith('state.')).map(([k]) => k), []);
  assert.match(ru['agent.fix'], /^Исправить с агентом для кода$/);
  assert.match(ru['setupCheck.repair'], /^Исправить /, 'one verb for Fix');
});

test('COPY-12, COPY-13: protocol words stay out of what a person reads first', () => {
  for (const lang of ['en', 'ru'] as Lang[]) {
    const d = dictionary(lang);
    for (const key of ['state.invalid', 'reason.invalid', 'reason.foreign.protocol', 'reason.remote.protocol', 'reason.not-loaded', 'overview.empty.title', 'overview.empty.body', 'audit.state.invalid', 'result.noCommand', 'logs.none'] as const) {
      assert.doesNotMatch(d[key], /descriptor|дескриптор|fabric-service\/0\.1|launchd|building-fabric-services/i, `${lang} ${key}`);
    }
    // An identifier a person may need stays, after the plain sentence.
    for (const key of ['load.invalid.body', 'map.coverageHelp', 'spend.empty.body'] as const) {
      const m = /FAC-SEM-133|extensions\/connections\/0\.1|DEC-0021/.exec(d[key]);
      assert.ok(m && m.index > d[key].length / 2, `${lang} ${key}: the identifier trails the sentence`);
    }
  }
});

test('COPY-18, COPY-20, COPY-27, COPY-28: buttons a sentence names exist, and each verb means one thing', () => {
  const en = dictionary('en');
  const ru = dictionary('ru');
  // A label quoted in a Russian sentence is a real label (COPY-18); a quoted lowercase word is text to type.
  const labels = new Set(Object.values(ru));
  const quoted = Object.entries(ru).flatMap(([k, v]) => [...v.matchAll(/«([^«»]+)»/g)].map((m) => [k, m[1]!] as const));
  const missing = quoted.filter(([k, q]) => /^(console|sessions)\./.test(k) && /^[А-ЯЁ]/.test(q) && !labels.has(q)).map(([k, q]) => `${k}: «${q}»`);
  assert.deepEqual(missing, []);
  // «Обновить» alone is for a version; refreshing data or a page says so (COPY-20).
  assert.deepEqual(Object.entries(ru).filter(([, v]) => /^Обновить( страницу.*)?$/.test(v)).map(([k]) => k), []);
  assert.equal(en['action.reload'], 'Reload page');
  // Sentence case outside the macOS menu (COPY-28).
  assert.deepEqual(Object.entries(en).filter(([k, v]) => !k.startsWith('menu.') && /Restart to Update/.test(v)).map(([k]) => k), []);
  assert.equal(en['action.doctor'], 'Run self-check');
});

test('COPY-23: words name the platform the app runs on', () => {
  const was = setWording('other');
  try {
    assert.equal(t('en', 'nav.local'), 'On this computer');
    assert.equal(t('ru', 'nav.local'), 'На этом компьютере');
    assert.equal(t('en', 'instance.local'), 'this computer');
    // Flows that exist only on macOS may name it; everything else reads the same on Windows and Linux.
    const macOnly = /^(move\.|update\.misplaced|login\.approval|uninstall\.trashFailed|console\.(openTerminal|terminal|continueUnsupported)|L10N)/;
    for (const lang of ['en', 'ru'] as Lang[]) {
      const named = allKeys().filter((k) => !k.endsWith('.mac') && !macOnly.test(k)).filter((k) => /\bMac\b|macOS|System Settings|Системн/.test(t(lang, k)));
      assert.deepEqual(named, [], `${lang}: say this computer, or add a .mac variant`);
    }
    setWording('mac');
    assert.equal(t('en', 'nav.local'), 'On this Mac');
    assert.equal(t('ru', 'nav.local'), 'На этом Mac');
    assert.equal(t('en', 'settings.notifications.openSystem'), 'Open System Settings');
    for (const key of allKeys().filter((k) => k.endsWith('.mac'))) assert.ok(allKeys().includes(key.slice(0, -4) as never), `${key} varies a key that exists`);
  } finally {
    setWording(was);
  }
});
