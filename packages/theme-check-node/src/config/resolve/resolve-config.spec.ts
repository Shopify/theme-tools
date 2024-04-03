import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveConfig } from './resolve-config';
import { ModernIdentifiers } from '../types';
import { createMockConfigFile, makeTmpFolder, removeTmpFolder } from '../../test/test-helpers';

describe('Unit: resolveConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTmpFolder();
  });

  afterEach(async () => {
    await removeTmpFolder(tempDir);
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
      require: [],
      context: 'theme',
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
      await fs.readFile(path.join(__dirname, '..', 'fixtures', 'node-module-rec.yml')),
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
      require: [],
      context: 'theme',
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
        NodeModuleCheck: {
          enabled: true,
        },
      },
    });
  });

  it(`resolves the modern identifier configs`, async () => {
    for (const modernIdentifier of ModernIdentifiers) {
      const filePath = await createMockYamlFile(`extends: ${modernIdentifier}`);
      const config = await resolveConfig(filePath);
      if (modernIdentifier === 'theme-check:nothing') {
        expect(config.checkSettings.ParserBlockingScript).not.to.exist;
      } else {
        expect(config.checkSettings.ParserBlockingScript!.enabled).to.be.true;
      }
    }
  });

  it('correctly resolves the theme app extension context', async () => {
    const filePath = await createMockYamlFile(`extends: theme-check:theme-app-extension`);
    const config = await resolveConfig(filePath);
    expect(config.context).to.equal('app');
  });

  async function createMockYamlFile(content: string): Promise<string> {
    return createMockConfigFile(tempDir, content);
  }
});
