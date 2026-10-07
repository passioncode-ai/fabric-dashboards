// #region release-verify — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
// LC-16 "in detail": before anything is installed, the release's SHA256SUMS must carry a valid
// signature by the organization's release key (pinned here, ed25519, sign-only, expires 2029-10-02;
// passioncode-ai/.github release-signing), the zip's sha256 must be the one SHA256SUMS names, and the
// feed must name only its own release's files. Node-side only (openpgp runs in the main process).
import { createHash } from 'node:crypto';

/** The organization's release key, as published in passioncode-ai/.github `release-signing/passioncode-release-signing.asc`. */
export const RELEASE_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEasEA0BYJKwYBBAHaRw8BAQdAzg/il4KR76Liuy7pPkEmveL2sTU8kh3FZn+H
pfrbJV+0MFBhc3Npb25Db2RlLmFpIHJlbGVhc2VzIDxjb250YWN0QHBhc3Npb25j
b2RlLmFpPoi1BBMWCgBdFiEEY7MNwyS9aXSHqjGUT6+4rsgDtqcFAmrBANAbFIAA
AAAABAAObWFudTIsMi41KzEuMTIsMCwzAhsDBQkFo5qABQsJCAcCAiICBhUKCQgL
AgQWAgMBAh4HAheAAAoJEE+vuK7IA7anM7sBAItPsg0cAR8JcR97aXmgmg+X44cZ
PhciNxImjH/WhJBjAP9xU0g3+Y/af6sNeoV8PM2w1K1echJaa97VLI38Z/8lCA==
=5KqR
-----END PGP PUBLIC KEY BLOCK-----
`;
/** Its fingerprint: the key read above must be this one, or nothing verifies. */
export const RELEASE_FINGERPRINT = '63b30dc324bd697487aa31944fafb8aec803b6a7';

export const RELEASES = 'https://github.com/passioncode-ai/fabric-dashboards/releases/download';
export const zipName = (version: string) => `Fabric-Dashboards-${version}-mac.zip`;
export const releaseFile = (version: string, name: string) => `${RELEASES}/v${version}/${name}`;

/** `sha256  name` lines → name → sha256 (lower case). Anything else in the file is ignored. */
export function parseSums(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(\S.*)$/i.exec(line.trim());
    if (m) out.set(m[2]!, m[1]!.toLowerCase());
  }
  return out;
}

/** Whether the detached signature over SHA256SUMS is a valid one by the pinned release key. */
export async function sumsSignedByRelease(sums: Buffer | string, armoredSignature: string, armoredKey = RELEASE_KEY): Promise<{ ok: true } | { ok: false; why: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const openpgp = require('openpgp') as typeof import('openpgp');
  try {
    const key = await openpgp.readKey({ armoredKey });
    if (key.getFingerprint().toLowerCase() !== RELEASE_FINGERPRINT) return { ok: false, why: `the key is ${key.getFingerprint()}, not the organization's` };
    const message = await openpgp.createMessage({ binary: typeof sums === 'string' ? Buffer.from(sums, 'utf8') : sums });
    const signature = await openpgp.readSignature({ armoredSignature });
    const { signatures } = await openpgp.verify({ message, signature, verificationKeys: key, expectSigned: true, format: 'binary' });
    await signatures[0]!.verified;
    return { ok: true };
  } catch (error) {
    return { ok: false, why: (error as Error).message };
  }
}

/** The feed names only its own release's update zip (the release gate's rule, checked again here). */
export function feedNamesOwnRelease(feed: unknown, version: string): boolean {
  const releases = (feed as { releases?: { version?: unknown; updateTo?: { url?: unknown; version?: unknown } }[] })?.releases;
  if (!Array.isArray(releases)) return false;
  const entry = releases.find((r) => r.version === version);
  return entry?.updateTo?.version === version && entry.updateTo.url === releaseFile(version, zipName(version));
}

export const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

export const FEED_FILE = 'update-feed.json';

/** The release's own feed, as its signed SHA256SUMS names it: the version it announces and whether
 *  it needs a person come from bytes the organization signed, not from the `latest` redirect
 *  (fabric-inbox 95af4f7 does the same). `needsPerson` counts only as an https address. */
export function signedFeed(feedBytes: Buffer, sums: Map<string, string>, version: string): { ok: true; needsPerson: string | null } | { ok: false; why: string } {
  const expected = sums.get(FEED_FILE);
  if (!expected) return { ok: false, why: `SHA256SUMS of ${version} names no ${FEED_FILE}` };
  const actual = sha256(feedBytes);
  if (actual !== expected) return { ok: false, why: `${FEED_FILE} of ${version} has sha256 ${actual}, SHA256SUMS says ${expected}` };
  let feed: { currentRelease?: unknown; needsPerson?: unknown };
  try { feed = JSON.parse(feedBytes.toString('utf8')); } catch { return { ok: false, why: `${FEED_FILE} of ${version} is not JSON` }; }
  if (feed.currentRelease !== version) return { ok: false, why: `${FEED_FILE} of ${version} announces ${String(feed.currentRelease)}` };
  if (!feedNamesOwnRelease(feed, version)) return { ok: false, why: `${FEED_FILE} of ${version} names a file outside its own release` };
  const steps = typeof feed.needsPerson === 'string' && /^https:\/\/[^\s]+$/.test(feed.needsPerson) ? feed.needsPerson : null;
  return { ok: true, needsPerson: steps };
}

/** FD-29: the feed Squirrel.Mac reads after verification — it names the verified zip on this disk,
 *  so the bytes the organization signed are the bytes that get installed, the zip is not downloaded
 *  twice, and there is no window between our check and Squirrel's fetch (fabric-inbox 95af4f7's
 *  shape: currentRelease plus one releases entry whose updateTo.url is a file). `entry` carries the
 *  signed feed's notes and pub_date for Squirrel's "what's new" when they are there. */
export function localFeed(version: string, zipUrl: string, entry?: { notes?: unknown; pub_date?: unknown }): string {
  if (!zipUrl.startsWith('file://')) throw new Error(`the local feed names a zip on this disk, got ${zipUrl}`);
  return `${JSON.stringify({
    currentRelease: version,
    releases: [{ version, updateTo: {
      version,
      name: version,
      notes: typeof entry?.notes === 'string' ? entry.notes : '',
      pub_date: typeof entry?.pub_date === 'string' ? entry.pub_date : new Date(0).toISOString(),
      url: zipUrl,
    } }],
  })}\n`;
}
// #endregion release-verify
