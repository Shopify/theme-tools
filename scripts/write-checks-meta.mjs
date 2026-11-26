// Writes the check metadata that the Rust crate embeds, one field per line so
// branches that touch different checks merge cleanly. Needs a built
// theme-check-common (`pnpm build:ts`). After a merge conflict in the file,
// keep either side and rerun this.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { allChecks } = require('../packages/theme-check-common');

writeFileSync(
  new URL('../crates/theme-check/src/node/checks-meta.json', import.meta.url),
  JSON.stringify(
    allChecks.map((check) => check.meta),
    null,
    2,
  ) + '\n',
);
