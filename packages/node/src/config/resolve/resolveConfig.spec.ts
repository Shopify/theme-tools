// packages/node/src/config/resolveConfig.spec.ts

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveConfig } from './resolveConfig';
import { ModernIdentifiers } from '../types';

describe('Unit: resolveConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp('/tmp/test-');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('resolves a config without extends', async () => {
    const filePath = await createMockYamlFile(`
root: ./dist
ignore:
  - assets
  - config
SomeCheck:
  enabled: false
  ignore: [snippets]
  some_setting: value
`);

    const config = await resolveConfig(filePath);

    expect(config).to.eql({
      root: './dist',
      extends: [],
      ignore: ['assets', 'config'],
      checkSettings: {
        SomeCheck: {
          enabled: false,
          ignore: ['snippets'],
          someSetting: 'value',
        },
      },
    });
  });

  it('resolves a config with extends', async () => {
    const baseConfigPath = path.join(__dirname, '..', 'fixtures', 'base.yml');
    const mockNodeModulePath = path.join(tempDir, 'node_modules', '@acme', 'theme-check-base');

    // mock config-relative node_modules
    await fs.mkdir(mockNodeModulePath, { recursive: true });

    // mock node_module package.json
    await fs.writeFile(
      path.join(mockNodeModulePath, 'package.json'),
      JSON.stringify({ name: '@acme/theme-check-base', main: 'index.js', version: '0.0.1' }),
      'utf8',
    );

    // mock recommended.yml file
    await fs.writeFile(
      path.join(mockNodeModulePath, 'recommended.yml'),
      await fs.readFile(path.join(__dirname, '..', 'fixtures', 'node_module_rec.yml')),
      'utf8',
    );

    const filePath = await createMockYamlFile(`
root: ./dist
ignore:
  - assets
  - config
extends:
  - '${baseConfigPath}'
  - '@acme/theme-check-base/recommended.yml'
SomeCheck:
  enabled: false
  ignore: [snippets]
  some_setting: value
`);

    const config = await resolveConfig(filePath);

    expect(config).toEqual({
      root: './dist',
      extends: [],
      ignore: ['base_assets', 'base_config', 'assets', 'config'],
      checkSettings: {
        BaseCheck: {
          enabled: true,
          ignore: ['base_snippets'],
          baseSetting: 'base_value',
        },
        SomeCheck: {
          enabled: false,
          ignore: ['snippets'],
          someSetting: 'value',
        },
        OtherCheck: {
          enabled: true,
        },
      },
    });
  });

  it(`resolves the modern identifier configs`, async () => {
    for (const modernIdentifier of ModernIdentifiers) {
      const filePath = await createMockYamlFile(`extends: ${modernIdentifier}`);
      const config = await resolveConfig(filePath);
      expect(config.checkSettings.ParserBlockingScript.enabled).to.be.true;
    }
  });

  async function createMockYamlFile(content: string): Promise<string> {
    const filePath = path.resolve(tempDir, '.theme-check.yml');
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }
});
