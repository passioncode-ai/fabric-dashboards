// The name a person reads for a service. Pure: the renderer and the main process share it.

/** The instance is added when it is not the default and not already in the name, so two
 *  instances of one agent never read alike (ADR-0010). */
export function displayName(name: string, instance: string): string {
  return instance === 'default' || name.toLowerCase().includes(instance.toLowerCase()) ? name : `${name} · ${instance}`;
}
