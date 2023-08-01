import fs from 'node:fs/promises';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { readYamlConfigDescription } from './read-yaml';
import { Severity } from '@shopify/theme-check-common';
import {
  createMockConfigFile,
  makeTmpFolder,
  removeTmpFolder,
  createMockNodeModule,
} from '../../test/test-helpers';

const mockYamlContent = `
root: ./dist
ignore:
  - assets
  - config
extends: theme-check:recommended
SomeCheck:
  enabled: false
  ignore: [snippets]
  some_setting: value
`;

describe('Unit: readYamlConfigDescription', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await makeTmpFolder();
  });

  afterAll(async () => {
    await removeTmpFolder(tempDir);
  });

  it('loads and parses a YAML config file', async () => {
    const filePath = await createMockYamlFile(mockYamlContent);
    const config = await readYamlConfigDescription(filePath);

    expect(config).toEqual({
      root: './dist',
      ignore: ['assets', 'config'],
      extends: ['theme-check:recommended'],
      require: [],
      checkSettings: {
        SomeCheck: {
          enabled: false,
          ignore: ['snippets'],
          someSetting: 'value',
        },
      },
    });
  });

  describe('Unit: extends', () => {
    it('supports array arguments', async () => {
      const filePath = await createMockYamlFile(
        `extends: ['theme-check:recommended', 'theme-check:all']`,
      );
      const config = await readYamlConfigDescription(filePath);
      expect(config).toEqual({
        ignore: [],
        require: [],
        extends: ['theme-check:recommended', 'theme-check:all'],
        checkSettings: {},
      });
    });

    it('uses an absolute path as is', async () => {
      const baseConfigPath = await createMockYamlFile(`extends: :nothing`);
      const filePath = await createMockYamlFile(`extends: '${baseConfigPath}'`);
      const config = await readYamlConfigDescription(filePath);
      expect(config).toEqual({
        extends: [baseConfigPath],
        ignore: [],
        require: [],
        checkSettings: {},
      });
    });

    it('interprets relative paths as relative to the config file', async () => {
      const filePath = await createMockYamlFile(`extends: './configurations/theme-check.yml'`);
      const mockConfigFolder = path.join(tempDir, 'configurations');

      // mock config-relative other config
      await fs.mkdir(mockConfigFolder, { recursive: true });

      // mock other config file
      await fs.writeFile(
        path.join(mockConfigFolder, 'theme-check.yml'),
        'extends: nothing',
        'utf8',
      );

      const config = await readYamlConfigDescription(filePath);
      expect(config).toEqual({
        extends: [path.join(tempDir, 'configurations', 'theme-check.yml')],
        ignore: [],
        require: [],
        checkSettings: {},
      });
    });

    it('translates a node_module into the resolved path of the node_module relative to the config file', async () => {
      const filePath = await createMockYamlFile(
        `extends: '@acme/theme-check-base/recommended.yml'`,
      );
      const mockNodeModulePath = path.join(tempDir, 'node_modules', '@acme', 'theme-check-base');

      // mock config-relative node_modules
      await fs.mkdir(mockNodeModulePath, { recursive: true });

      // mock node_module package.json
      await fs.writeFile(
        path.join(mockNodeModulePath, 'package.json'),
        JSON.stringify({ name: '@acme/theme-check-base', main: 'index.js', version: '0.0.1' }),
        'utf8',
      );

      // mock main entry
      await fs.writeFile(path.join(mockNodeModulePath, 'index.js'), '', 'utf8');

      // mock recommended.yml file
      await fs.writeFile(path.join(mockNodeModulePath, 'recommended.yml'), '', 'utf8');

      const config = await readYamlConfigDescription(filePath);
      expect(config).toEqual({
        ignore: [],
        extends: [realpathSync(path.join(mockNodeModulePath, 'recommended.yml'))],
        require: [],
        checkSettings: {},
      });
    });

    it('translates legacy extend values to modern ones', async () => {
      const testCases = [
        {
          testCase: 'translates legacy `:default` to `theme-check:recommended`',
          extendsValue: [':default'],
          expected: ['theme-check:recommended'],
        },
        {
          testCase: 'translates legacy `default` to `theme-check:recommended`',
          extendsValue: 'default',
          expected: ['theme-check:recommended'],
        },
        {
          testCase:
            'translates legacy `:theme_app_extensions` to `theme-check:theme-app-extension`',
          extendsValue: [':theme_app_extensions'],
          expected: ['theme-check:theme-app-extension'],
        },
        {
          testCase: 'translates legacy [`:nothing`] to []',
          extendsValue: [':nothing'],
          expected: [],
        },
      ];

      for (const { testCase, extendsValue, expected } of testCases) {
        const filePath = await createMockYamlFile(`extends: ${extendsValue}`);
        const config = await readYamlConfigDescription(filePath);
        expect(config.extends, testCase).toEqual(expected);
      }
    });
  });

  describe('Unit: require', () => {
    it('supports array arguments', async () => {
      const filePath = await createMockYamlFile(`require: ['./lib/index.js']`);
      const libPath = path.resolve(tempDir, 'lib', 'index.js');
      const config = await readYamlConfigDescription(filePath);
      expect(config.require).toEqual([libPath]);
    });

    it('resolves a relative path to an absolute path', async () => {
      const filePath = await createMockYamlFile(`require: './lib/index.js'`);
      const libPath = path.resolve(tempDir, 'lib', 'index.js');
      const config = await readYamlConfigDescription(filePath);
      expect(config.require).toEqual([libPath]);
    });

    it('translates a node_module into the resolved path of the node_module relative to the config file', async () => {
      const filePath = await createMockYamlFile(`require: '@acme/theme-check-extension'`);
      const nodeModuleRoot = await createMockNodeModule(tempDir, '@acme/theme-check-extension');
      const config = await readYamlConfigDescription(filePath);
      expect(config.require).toEqual([realpathSync(path.join(nodeModuleRoot, 'index.js'))]);
    });
  });

  describe('Unit: severity', () => {
    it('supports the legacy severities', async () => {
      const testCases = [
        { severity: 'error', expected: Severity.ERROR },
        { severity: 'suggestion', expected: Severity.WARNING },
        { severity: 'style', expected: Severity.INFO },
      ];

      for (const { severity, expected } of testCases) {
        const filePath = await createMockSeverityFile(severity);
        const config = await readYamlConfigDescription(filePath);
        expect(config.checkSettings.MockCheck!.severity).toEqual(expected);
      }
    });

    it('supports modern severities', async () => {
      const testCases = [
        { severity: 0, expected: Severity.ERROR },
        { severity: 1, expected: Severity.WARNING },
        { severity: 2, expected: Severity.INFO },
      ];

      for (const { severity, expected } of testCases) {
        const filePath = await createMockSeverityFile(severity);
        const config = await readYamlConfigDescription(filePath);
        expect(config.checkSettings.MockCheck!.severity).toEqual(expected);
      }
    });

    it('throws an error for unknown severities', async () => {
      const testCases = [{ severity: 3 }, { severity: 'unknown' }];
      for (const { severity } of testCases) {
        const filePath = await createMockSeverityFile(severity);
        await expect(readYamlConfigDescription(filePath)).rejects.toThrow(/Unsupported severity:/);
      }
    });
  });

  it('throws an error when the parsed YAML content is not a plain object', async () => {
    const filePath = await createMockYamlFile('- not_an_object: true');
    await expect(readYamlConfigDescription(filePath)).rejects.toThrow(
      `Expecting parsed contents of config file at path '${filePath}' to be a plain object`,
    );
  });

  it('throws an error when a check setting value is not a plain object', async () => {
    const filePath = await createMockYamlFile('SomeCheck: not_an_object');
    await expect(readYamlConfigDescription(filePath)).rejects.toThrow(
      'Expected a plain object value for SomeCheck but got string',
    );
  });

  async function createMockYamlFile(content: string): Promise<string> {
    return createMockConfigFile(tempDir, content);
  }

  function createMockSeverityFile(severity: string | number) {
    return createMockYamlFile(`
MockCheck:
  severity: ${severity}
`);
  }
});
