#!/usr/bin/env ts-node
import { makeConfig } from './language-configuration';
import * as fs from 'fs/promises';

async function main() {
  try {
    await fs.writeFile(
      './language-configuration.json',
      JSON.stringify(await makeConfig(), null, 2),
      'utf8',
    );
  } catch (_) {
    process.exit(1);
  }

  process.exit(0);
}

main();
