// The workspace aggregator (fabric-workspace lib/backlog.mjs `cells`) refuses a backlog row that does not split into
// the header's cells, and then the whole workspace cannot publish. Its rule, restated: a `|` inside a code span or
// written `\|` is content; any other `|` ends a cell. On 2026-10-15 a bare `|` between two code spans in FD-52 did that.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

export function cells(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let ticks = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '\\' && line[i + 1] === '|') { cell += '|'; i++; continue; }
    if (c === '`') { let n = 1; while (line[i + n] === '`') n++; if (!ticks) ticks = n; else if (ticks === n) ticks = 0; cell += '`'.repeat(n); i += n - 1; continue; }
    if (c === '|' && !ticks) { out.push(cell.trim()); cell = ''; } else cell += c;
  }
  out.push(cell.trim());
  if (out[0] === '') out.shift();
  if (out.at(-1) === '') out.pop();
  return out;
}

/** The rows that do not split into the header's cells, as `<first cell>: <n> cells`. */
export function malformedRows(markdown: string): string[] {
  let header: string[] | null = null;
  const bad: string[] = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const c = cells(line);
    if (!header) { header = c; continue; }
    if (c.length !== header.length) bad.push(`${c[0]}: ${c.length} cells`);
  }
  return bad;
}

test('every backlog row splits into the header\'s cells, as the workspace aggregator reads it', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'docs', 'backlog.md'), 'utf8');
  assert.match(text, /^\| ID \|/m, 'the backlog has its table');
  assert.deepEqual(malformedRows(text), [], 'a bare | outside a code span splits a row — write "or", or \\|');
});

test('the splitter matches the aggregator on the case that broke the publication', () => {
  assert.equal(cells('| FD-x | `personal` | `org:<id>` | open | src |').length, 5, 'a bare | between code spans is a cell boundary');
  assert.equal(cells('| FD-x | `personal | org` | open | src |').length, 4, 'inside one code span it is content');
  assert.equal(cells('| FD-x | a \\| b | open | src |').length, 4, 'an escaped one is content');
  assert.deepEqual(malformedRows('| ID | Item | Status | Source |\n|---|---|---|---|\n| FD-52 | `personal` | `org` | open | s |'), ['FD-52: 5 cells']);
});
