#!/usr/bin/env node
// Code region markers — the org rule in passioncode-ai/.github CONTRIBUTING.md §4 ("Mark the
// code you write"). Copied from passioncode-ai/fabric scripts/check-regions.mjs@a33a3b9; the
// only change here is that files not yet committed are checked too, so the gate catches a
// broken marker before the commit that adds it.
//
//   // #region <slug> — docs: <path>#<anchor>
//   …code of one feature, module or special condition…
//   // #endregion <slug>
//
// Any comment leader works (`//`, `#`, `--`, `/*`, `<!--`). The reference is repository-root
// relative and must resolve: the file exists and the anchor is one of its headings (GitHub
// slug) or an explicit `id="…"` / `{#…}`. A region without an end, an end without a start, a
// region with no `docs:` reference and a reference that does not resolve all fail, each with
// its file and line — the point is that an agent searching the code always lands on
// documentation that exists.
import {readFileSync, existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const START = /(?:\/\/|#|--|\/\*|<!--)\s*#region\s+([a-z0-9][a-z0-9-]*)(?:\s+[—-]+\s+docs:\s+(\S+?))?\s*(?:\*\/|-->)?\s*$/
const END = /(?:\/\/|#|--|\/\*|<!--)\s*#endregion\s+([a-z0-9][a-z0-9-]*)\s*(?:\*\/|-->)?\s*$/

export function anchorsOf(text) {
  const anchors = new Set()
  for (const line of text.split('\n')) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
    if (heading) {
      anchors.add(heading[1].toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-'))
    }
    for (const m of line.matchAll(/\bid="([^"]+)"/g)) anchors.add(m[1])
    for (const m of line.matchAll(/\{#([A-Za-z0-9_-]+)\}/g)) anchors.add(m[1])
  }
  return anchors
}

export function checkRegions({root, files}) {
  const findings = []
  const anchorCache = new Map()
  const resolve = ref => {
    const [file, anchor] = ref.split('#')
    const full = path.join(root, file)
    if (!file || !existsSync(full)) return 'doc-missing'
    if (!anchor) return null
    if (!anchorCache.has(full)) anchorCache.set(full, anchorsOf(readFileSync(full, 'utf8')))
    return anchorCache.get(full).has(anchor) ? null : 'anchor-missing'
  }
  let regions = 0
  for (const file of files) {
    let text
    try { text = readFileSync(path.join(root, file), 'utf8') } catch { continue }
    if (!text.includes('#region') && !text.includes('#endregion')) continue
    const open = []
    text.split('\n').forEach((line, i) => {
      const start = line.match(START)
      if (start) {
        regions += 1
        open.push({slug: start[1], line: i + 1})
        if (!start[2]) findings.push({file, line: i + 1, code: 'no-docs-reference', detail: start[1]})
        else {
          const problem = resolve(start[2])
          if (problem) findings.push({file, line: i + 1, code: problem, detail: start[2]})
        }
        return
      }
      const end = line.match(END)
      if (end) {
        const at = open.map(o => o.slug).lastIndexOf(end[1])
        if (at < 0) findings.push({file, line: i + 1, code: 'end-without-start', detail: end[1]})
        else open.splice(at, 1)
      }
    })
    for (const o of open) findings.push({file, line: o.line, code: 'unclosed', detail: o.slug})
  }
  return {findings, regions}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  // Tracked and new, not ignored, text files: a build output or a dependency is not this repository's code.
  const files = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], {encoding: 'utf8'})
    .split('\0').filter(f => f && /\.(m?[jt]sx?|cjs|py|sh|sql|css|html|swift|rs|go|toml|ya?ml)$/.test(f) && !f.startsWith('docs/'))
  const {findings, regions} = checkRegions({root, files})
  for (const f of findings) console.error(`FAIL ${f.file}:${f.line} ${f.code} — ${f.detail}`)
  if (findings.length) process.exit(1)
  console.log(`PASS code regions: ${regions} marker(s), every one closed and every docs reference resolves`)
}
