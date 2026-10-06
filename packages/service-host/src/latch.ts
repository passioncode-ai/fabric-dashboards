// #region remote-token-latch — docs: packages/service-host/README.md#remote-token-latch
// DEC-0019 sends a remote placement's token with every health probe. An origin that answers as
// another service, or answers without fabric-service/0.1 (a parked domain, a taken-over
// subdomain), is not the service: the token is withheld from it from then on.
//
// - Another service's answer is kept as the verdict until the descriptor changes; nothing is
//   requested again (reason.remote.foreign).
// - A non-protocol answer is checked again without the token. The latch opens when the origin asks
//   for a token again (HTTP 401) or answers as this service; then the probe is repeated with the
//   token. Anything else keeps the token withheld (reason.remote.protocol).
import type { Descriptor, WellKnownResult } from './protocol';

type Held = { descriptor: string; why: 'foreign' | 'not-protocol'; probe: WellKnownResult };

const own = (d: Descriptor, p: WellKnownResult): boolean =>
  p.kind === 'answer' && p.doc.service.id === d.id && p.doc.service.instance === d.instance;

export class RemoteTokenLatch {
  private readonly held = new Map<string, Held>();

  /** Why the token is withheld from `d`'s origin now, or null. */
  withheld(d: Descriptor): Held['why'] | null {
    return this.current(d)?.why ?? null;
  }

  /**
   * One health probe of a remote placement through the latch. `send(true)` probes with the token,
   * `send(false)` without it; neither is called for a local placement, which is probed as is.
   */
  async probe(d: Descriptor, send: (withToken: boolean) => Promise<WellKnownResult>): Promise<WellKnownResult> {
    if (d.placement !== 'remote') return send(false);
    const key = `${d.id}.${d.instance}`;
    const held = this.current(d);
    if (held?.why === 'foreign') return held.probe;
    if (held?.why === 'not-protocol') {
      const bare = await send(false);
      if (bare.kind !== 'refused' && !own(d, bare)) {
        if (bare.kind === 'answer' || bare.kind === 'not-protocol') this.hold(key, d, bare);
        return bare;
      }
      this.held.delete(key);
    }
    const probe = await send(true);
    if ((probe.kind === 'answer' && !own(d, probe)) || probe.kind === 'not-protocol') this.hold(key, d, probe);
    return probe;
  }

  private hold(key: string, d: Descriptor, probe: WellKnownResult): void {
    this.held.set(key, { descriptor: JSON.stringify(d), why: probe.kind === 'answer' ? 'foreign' : 'not-protocol', probe });
  }

  /** The latch for `d` as it is now; a changed descriptor is a new claim and starts clear. */
  private current(d: Descriptor): Held | undefined {
    const key = `${d.id}.${d.instance}`;
    const held = this.held.get(key);
    if (held && held.descriptor !== JSON.stringify(d)) {
      this.held.delete(key);
      return undefined;
    }
    return held;
  }
}
// #endregion remote-token-latch
