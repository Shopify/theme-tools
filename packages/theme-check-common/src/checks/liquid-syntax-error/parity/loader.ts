import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface Scenario {
  id: string;
  template: string;
  error_path: string;
  file_path?: string;
}

export interface SnapshotEntry {
  id: string;
  error: string | null;
  type: string | null;
}

export function loadScenarios(tag: string): Scenario[] {
  const path = resolve(__dirname, 'scenarios', `${tag}.yml`);
  const content = readFileSync(path, 'utf-8');
  return parse(content) as Scenario[];
}

export function loadSnapshots(tag: string): SnapshotEntry[] {
  const path = resolve(__dirname, 'snapshots', `${tag}.snap.yml`);
  const content = readFileSync(path, 'utf-8');
  return parse(content) as SnapshotEntry[];
}
