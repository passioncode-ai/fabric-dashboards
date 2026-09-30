// #region state-vectors — docs: packages/service-host/README.md#shared-test-vectors
// The shared state-precedence vectors, as data. A host runs every case against its own use of
// deriveState; the file ships in the package at test-vectors/state-precedence.json.
import fs from 'node:fs';
import path from 'node:path';
import type { Reason, ServiceState } from './protocol';
import type { StateInput } from './state';

export interface StateVectors {
  schema: 'fabric-service-host/state-precedence@1';
  about: string;
  downAfterMs: number;
  base: StateInput;
  cases: { name: string; input: Partial<StateInput>; expect: { state: ServiceState; reasons?: Reason[] } }[];
}

/** The path of the vectors file inside the installed package. */
export const STATE_VECTORS_PATH = path.join(__dirname, '..', 'test-vectors', 'state-precedence.json');

export function loadStateVectors(file = STATE_VECTORS_PATH): StateVectors {
  const v = JSON.parse(fs.readFileSync(file, 'utf8')) as StateVectors;
  if (v.schema !== 'fabric-service-host/state-precedence@1' || !Array.isArray(v.cases)) throw new Error(`${file} is not a state-precedence@1 vectors file`);
  return v;
}
// #endregion state-vectors
