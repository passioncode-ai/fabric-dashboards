// Electron fuses (lifecycle LC-13): switches compiled into the Electron Framework binary that
// decide what a local process can make the signed app do. dist-mac.mjs sets them on the packaged
// app before signing and then reads them back from the finished binary; the release fails when one
// is wrong. The wire format is Electron's (docs/tutorial/fuses.md, @electron/fuses): a sentinel,
// a version byte, a length byte, then one byte per fuse — '0' off, '1' on, 'r' removed. A universal
// binary carries one wire per architecture slice; every one is read and set.
//
// Run directly to read a built app:  node scripts/fuses.mjs "<path>/Fabric Dashboards.app"
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FUSE_SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';
export const FUSE_WIRE_VERSION = 1;

/** Fuse order of wire version 1 (FuseV1Options), index = byte position. */
export const FUSES = [
  'RunAsNode',
  'EnableCookieEncryption',
  'EnableNodeOptionsEnvironmentVariable',
  'EnableNodeCliInspectArguments',
  'EnableEmbeddedAsarIntegrityValidation',
  'OnlyLoadAppFromAsar',
  'LoadBrowserProcessSpecificV8Snapshot',
  'GrantFileProtocolExtraPrivileges',
  'WasmTrapHandlers',
];

/**
 * What a Fabric Dashboards release ships (AGENTS.md ## Lifecycle). Two declared exceptions to LC-13:
 * RunAsNode stays on because the MCP server runs inside this binary as Node
 * (Resources/bin/fabric-dashboards-mcp); cookie encryption stays off until an upgrade from a signed
 * build is shown to raise no Keychain prompt (the service sessions are 0600 files today, the same
 * trust level as the service token files).
 */
export const WANTED_FUSES = {
  RunAsNode: true,
  EnableCookieEncryption: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
};

/** The framework binary that carries the wire inside a macOS .app. */
export function frameworkBinary(app) {
  return path.join(app, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework');
}

function wireOffsets(buffer) {
  const sentinel = Buffer.from(FUSE_SENTINEL);
  const offsets = [];
  for (let i = buffer.indexOf(sentinel); i !== -1; i = buffer.indexOf(sentinel, i + 1)) offsets.push(i + sentinel.length);
  if (!offsets.length) throw new Error('no fuse wire in this binary');
  return offsets;
}

/** Every wire in the binary: { offset, version, fuses: { name: true | false | 'removed' } }. */
export function readFuseWires(buffer) {
  return wireOffsets(buffer).map((at) => {
    const version = buffer[at];
    if (version !== FUSE_WIRE_VERSION) throw new Error(`fuse wire version ${version} is not ${FUSE_WIRE_VERSION}; update scripts/fuses.mjs`);
    const length = buffer[at + 1];
    const fuses = {};
    for (let i = 0; i < length; i += 1) {
      const byte = String.fromCharCode(buffer[at + 2 + i]);
      fuses[FUSES[i] ?? `fuse${i}`] = byte === 'r' ? 'removed' : byte === '1';
    }
    return { offset: at, version, fuses };
  });
}

/** A copy of `buffer` with `wanted` set in every wire; size never changes. */
export function setFuses(buffer, wanted) {
  const out = Buffer.from(buffer);
  for (const at of wireOffsets(out)) {
    const length = out[at + 1];
    for (const [name, on] of Object.entries(wanted)) {
      const index = FUSES.indexOf(name);
      if (index < 0) throw new Error(`unknown fuse ${name}`);
      if (index >= length) throw new Error(`this Electron does not have fuse ${name}`);
      if (out[at + 2 + index] === 'r'.charCodeAt(0)) throw new Error(`fuse ${name} was removed from this Electron`);
      out[at + 2 + index] = (on ? '1' : '0').charCodeAt(0);
    }
  }
  return out;
}

/** Differences from `wanted`, one sentence each; empty when every wire matches. */
export function fuseProblems(buffer, wanted) {
  const problems = [];
  readFuseWires(buffer).forEach((wire, n) => {
    for (const [name, on] of Object.entries(wanted)) {
      if (wire.fuses[name] !== on) problems.push(`wire ${n + 1}: ${name} is ${JSON.stringify(wire.fuses[name])}, release needs ${on}`);
    }
  });
  return problems;
}

/** Set the release fuses in a packaged .app, in place. The caller re-signs afterwards. */
export function applyReleaseFuses(app, wanted = WANTED_FUSES) {
  const file = frameworkBinary(app);
  writeFileSync(file, setFuses(readFileSync(file), wanted));
  return file;
}

/** Read the fuses back from the finished binary; throws naming each wrong fuse. */
export function verifyReleaseFuses(app, wanted = WANTED_FUSES) {
  const buffer = readFileSync(frameworkBinary(app));
  const problems = fuseProblems(buffer, wanted);
  if (problems.length) throw new Error(`The built app has the wrong fuses:\n${problems.join('\n')}`);
  return readFuseWires(buffer).map((w) => FUSES.slice(0, Object.keys(w.fuses).length).map((n) => (w.fuses[n] === 'removed' ? 'r' : w.fuses[n] ? '1' : '0')).join(''));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = process.argv[2];
  if (!app) { console.error('usage: node scripts/fuses.mjs <path to .app>'); process.exit(2); }
  const wires = readFuseWires(readFileSync(frameworkBinary(app)));
  console.log(JSON.stringify({ wires: wires.map((w) => w.fuses), problems: fuseProblems(readFileSync(frameworkBinary(app)), WANTED_FUSES) }, null, 2));
}
