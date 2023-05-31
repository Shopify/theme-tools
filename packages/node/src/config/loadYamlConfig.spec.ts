import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadYamlConfig } from './loadYamlConfig';

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

describe('Unit: loadYamlConfig', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp('/tmp/test-');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('loads and parses a YAML config file', async () => {
    const filePath = await createMockYamlFile(mockYamlContent);
    const config = await loadYamlConfig(filePath);

    expect(config).toEqual({
      root: path.resolve(path.dirname(filePath), 'dist'),
      ignore: ['assets', 'config'],
      extends: 'theme-check:recommended',
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
      const filePath = await createMockYamlFile(`extends: ['theme-check:recommended', 'theme-check:all']`);
      const config = await loadYamlConfig(filePath);
      expect(config).toEqual({
        root: path.resolve(path.dirname(filePath)),
        extends: [
          'theme-check:recommended',
          'theme-check:all',
        ],
        checkSettings: {},
      });
    });

    it('uses an absolute path as is', async () => {
      const baseConfigPath = await createMockYamlFile(`extends: :nothing`);
      const filePath = await createMockYamlFile(`extends: '${baseConfigPath}'`);
      const config = await loadYamlConfig(filePath);
      expect(config).toEqual({
        root: path.resolve(path.dirname(filePath)),
        extends: baseConfigPath,
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

      const config = await loadYamlConfig(filePath);
      expect(config).toEqual({
        root: path.resolve(path.dirname(filePath)),
        extends: path.join(tempDir, 'configurations', 'theme-check.yml'),
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

      const config = await loadYamlConfig(filePath);
      expect(config).toEqual({
        root: path.resolve(path.dirname(filePath)),
        extends: await fs.realpath(path.join(mockNodeModulePath, 'recommended.yml')),
        checkSettings: {},
      });
    });

    [
      {
        testCase: 'translates legacy `:default` to `theme-check:recommended`',
        extendsValue: ':default',
        expected: 'theme-check:recommended',
      },
      {
        testCase: 'translates legacy `default` to `theme-check:recommended`',
        extendsValue: 'default',
        expected: 'theme-check:recommended',
      },
      {
        testCase: 'translates legacy `:theme_app_extensions` to `theme-check:theme-app-extensions`',
        extendsValue: ':theme_app_extensions',
        expected: 'theme-check:theme-app-extensions',
      },
      {
        testCase: 'translates legacy `:nothing` to `undefined`',
        extendsValue: ':nothing',
        expected: undefined,
      },
    ].forEach(({ testCase, extendsValue, expected }) => {
      it(testCase, async () => {
        const filePath = await createMockYamlFile(`extends: ${extendsValue}`);
        const config = await loadYamlConfig(filePath);
        expect(config).toEqual({
          root: path.resolve(path.dirname(filePath)),
          extends: expected,
          checkSettings: {},
        });
      });
    });
  });

  it('throws an error when the parsed YAML content is not a plain object', async () => {
    const filePath = await createMockYamlFile('- not_an_object: true');
    await expect(loadYamlConfig(filePath)).rejects.toThrow(
      `Expecting parsed contents of config file at path '${filePath}' to be a plain object`,
    );
  });

  it('throws an error when the root property is an absolute path', async () => {
    const filePath = await createMockYamlFile('root: /absolute/path');
    await expect(loadYamlConfig(filePath)).rejects.toThrow(
      'the `root` property can only be relative',
    );
  });

  it('throws an error when a check setting value is not a plain object', async () => {
    const filePath = await createMockYamlFile('SomeCheck: not_an_object');
    await expect(loadYamlConfig(filePath)).rejects.toThrow(
      'Expected a plain object value for SomeCheck but got string',
    );
  });

  async function createMockYamlFile(content: string): Promise<string> {
    const filePath = path.resolve(tempDir, '.theme-check.yml');
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }
});
