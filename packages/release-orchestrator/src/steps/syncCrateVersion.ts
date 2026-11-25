import fs from 'fs/promises';
import path from 'path';

import { getRepoRoot } from '../utils';

/** Where each file has the version of the Rust crates, which they all share. */
const versionPatterns: Record<string, RegExp> = {
  'Cargo.toml': /^((?:version|liquid-(?:ast|parser) = \{.*\bversion) = )"[^"]*"/gm,
  'Cargo.lock': /^(name = "(?:liquid-ast|liquid-parser|theme-check)"\nversion = )"[^"]*"/gm,
};

export const setCrateVersion = (file: string, source: string, version: string) =>
  source.replace(versionPatterns[file], `$1"${version}"`);

/**
 * Changesets versions the Rust crates as the private theme-check-rs package,
 * in crates/theme-check/package.json. This copies its version into Cargo.
 */
export const syncCrateVersion = async () => {
  const root = await getRepoRoot();
  const packageJson = await fs.readFile(path.join(root, 'crates/theme-check/package.json'), 'utf8');
  const { version } = JSON.parse(packageJson);

  console.log(`Setting the Rust crates' version to ${version}...`);
  for (const file of Object.keys(versionPatterns)) {
    const filePath = path.join(root, file);
    await fs.writeFile(
      filePath,
      setCrateVersion(file, await fs.readFile(filePath, 'utf8'), version),
    );
  }
};
