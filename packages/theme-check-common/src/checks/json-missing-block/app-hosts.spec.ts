import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { JSONMissingBlock } from './index';
import { check, MockTheme } from '../../test';
import { Severity } from '../../types';

interface Fixture {
  name: string;
  files: MockTheme;
  offenses?: { file: string; message: string; highlight?: string }[];
}

// Preserve the upstream app-host fixtures without bringing the newer spec runner into 3.x.
const { cases }: { cases: Fixture[] } = parse(
  readFileSync(join(__dirname, 'app-hosts.yml'), 'utf8'),
);

describe('JSONMissingBlock app hosts (Shopify/theme-tools#1391)', () => {
  it.each(cases)('$name', async ({ files, offenses: expected = [] }) => {
    const offenses = await check(files, [JSONMissingBlock]);
    expect(offenses.map(({ message, severity }) => ({ message, severity }))).toEqual(
      expected.map(({ message }) => ({ message, severity: Severity.ERROR })),
    );
    for (const [index, offense] of offenses.entries()) {
      expect(offense.uri).toContain(expected[index].file);
      if (expected[index].highlight) {
        expect(files[expected[index].file].slice(offense.start.index, offense.end.index)).toEqual(
          expected[index].highlight,
        );
      }
    }
  });
});
