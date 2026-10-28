import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Both parsers are test dependencies of theme-check-common.
const require = createRequire(
  new URL('../packages/theme-check-common/package.json', import.meta.url),
);
const { parse: parseYaml } = require('yaml');
const { parse: parseToml } = require('smol-toml');
const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.argv[2] ?? 'origin/main';
const directories = ['specs/checks', 'specs/graph'];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const originals = git('ls-tree', '-r', '--name-only', base, '--', ...directories)
  .trim()
  .split('\n')
  .filter((file) => file.endsWith('.yml'));

assert.ok(originals.length > 0, `No YAML check or graph specs found at ${base}`);

const current = directories.flatMap((directory) =>
  readdirSync(resolve(root, directory), { recursive: true })
    .filter((file) => /\.(?:toml|ya?ml)$/.test(file))
    .map((file) => resolve(root, directory, file)),
);
assert.deepEqual(
  current.sort(),
  originals.map((file) => resolve(root, file.replace(/\.yml$/, '.toml'))).sort(),
  'Every YAML spec must have exactly one TOML replacement',
);

let cases = 0;
for (const original of originals) {
  const before = parseYaml(git('show', `${base}:${original}`));
  const converted = original.replace(/\.yml$/, '.toml');
  const after = parseToml(readFileSync(resolve(root, converted), 'utf8'));
  // TOML tables have null prototypes; compare the language-neutral data.
  assert.deepEqual(JSON.parse(JSON.stringify(after)), before, converted);
  cases += before.cases?.length ?? 0;
}

console.log(`Before (${base}): ${originals.length} YAML files, ${cases} cases.`);
console.log(`After: ${current.length} TOML files, ${cases} cases.`);
console.log('All parsed data matches exactly, including fixture whitespace.');
