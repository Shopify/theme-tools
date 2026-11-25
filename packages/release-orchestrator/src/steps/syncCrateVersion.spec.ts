import { readFileSync } from 'node:fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { setCrateVersion } from './syncCrateVersion';

describe('setCrateVersion', () => {
  it.each(['Cargo.toml', 'Cargo.lock'])(
    'sets the version of the three crates in %s, and nothing else',
    (file) => {
      const source = readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');
      const lines = source.split('\n');
      const changed = setCrateVersion(file, source, '9.8.7')
        .split('\n')
        .filter((line, i) => line !== lines[i]);
      expect(changed).toHaveLength(3);
      for (const line of changed) expect(line).toMatch(/version = "9\.8\.7"/);
    },
  );
});
