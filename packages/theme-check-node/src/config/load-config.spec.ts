import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, afterEach, beforeEach, assert, vi } from 'vitest';
import { loadConfig } from './load-config';
import {
  allChecks,
  CheckDefinition,
  ConfigTarget,
  recommended,
  Severity,
  SourceCodeType,
} from '@shopify/theme-check-common';
import {
  createMockConfigFile,
  createMockNodeModule,
  makeTmpFolder,
  mockNodeModuleCheck,
  removeTmpFolder,
} from '../test/test-helpers';
import { thisNodeModuleRoot } from './installation-location';
import { URI } from 'vscode-uri';
import * as resolveModule from './resolve';

describe('Unit: loadConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTmpFolder();
  });

  afterEach(async () => {
    await removeTmpFolder(tempDir);
  });

  it('loads the recommended config by default', async () => {
    const config = await loadConfig(undefined, __dirname);
    expect(config.checks).to.eql(recommended);
    expect(config.context).to.eql('theme');
  });

  describe.each(['shopify.extension.toml', 'shopify.app.toml'])(
    'when the root contains a %s file',
    (fileName) => {
      beforeEach(async () => {
        const filePath = path.join(tempDir, fileName);
        await fs.writeFile(filePath, '', 'utf8');
      });

      it('sets the context to app', async () => {
        const config = await loadConfig(undefined, tempDir);
        expect(config.context).to.eql('app');
      });

      it('calls resolveConfig with theme-check:theme-app-extension', async () => {
        const spy = vi.spyOn(resolveModule, 'resolveConfig');
        await loadConfig(undefined, tempDir);
        expect(spy).toHaveBeenCalledWith('theme-check:theme-app-extension', true);
        vi.restoreAllMocks();
      });
    },
  );

  it('extends the recommended config by default', async () => {
    const configPath = await createMockConfigFile(tempDir, `ignore: ['src/**']`);
    const config = await loadConfig(configPath, tempDir);
    expect(config.checks).to.eql(recommended);
    expect(config.ignore).to.include('src/**');
  });

  it('has no checks if it extends nothing', async () => {
    const configPath = await createMockConfigFile(tempDir, `extends: nothing`);
    const config = await loadConfig(configPath, tempDir);
    expect(config.checks).to.be.empty;
  });

  it('loads the nothing config', async () => {
    const configPath = await createMockConfigFile(tempDir, `extends: nothing`);
    const config = await loadConfig(configPath, tempDir);
    expect(config.checks).to.eql([]);
  });

  it('loads the recommended config', async () => {
    const configPath = await createMockConfigFile(tempDir, `extends: theme-check:recommended`);
    const config = await loadConfig(configPath, tempDir);
    expect(config.checks).to.eql(recommended);
  });

  it('loads the all config', async () => {
    const configPath = await createMockConfigFile(tempDir, `extends: theme-check:all`);
    const config = await loadConfig(configPath, tempDir);
    expect(config.checks).to.eql(
      allChecks.filter(
        (check) =>
          !check.meta.targets ||
          check.meta.targets.length === 0 ||
          check.meta.targets.includes(ConfigTarget.All),
      ),
    );
  });

  it('loads a compound config', async () => {
    const configPath = await createMockConfigFile(
      tempDir,
      `extends: theme-check:theme-app-extension`,
    );
    const config = await loadConfig(configPath, path.dirname(configPath));

    const ParserBlockingScript = check('ParserBlockingScript')!;
    expect(config.checks).to.include(ParserBlockingScript);

    const RequiredLayoutThemeObject = check('RequiredLayoutThemeObject');
    expect(config.checks).not.to.include(RequiredLayoutThemeObject);
  });

  it('loads a compound config, with overrides', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/theme-app-extension-with-overrides.yml');
    const config = await loadConfig(configPath, path.dirname(configPath));

    const ParserBlockingScript = check('ParserBlockingScript')!;
    expect(config.checks).not.to.include(ParserBlockingScript);

    const UnusedAssign = check('UnusedAssign')!;
    expect(UnusedAssign.meta.severity).to.equal(Severity.WARNING);
    expect(config.settings.UnusedAssign!.severity).to.equal(Severity.ERROR);
  });

  it('loads a multi-compound config, with overrides', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/multi-compound.yml');
    const config = await loadConfig(configPath, path.dirname(configPath));

    expect(config.settings.ImgWidthAndHeight!.ignore).to.eql(['snippets/**']);

    const ParserBlockingScript = check('ParserBlockingScript');
    expect(config.checks).to.include(ParserBlockingScript);

    const MatchingTranslations = check('MatchingTranslations');
    expect(config.checks).not.to.include(MatchingTranslations);

    const UnusedAssign = check('UnusedAssign')!;
    expect(UnusedAssign.meta.severity).to.equal(Severity.WARNING);
    expect(config.settings.UnusedAssign!.severity).to.equal(Severity.ERROR);
  });

  it('merges the ignore attribute with the default one', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/with-ignore.yml');
    const config = await loadConfig(configPath, path.dirname(configPath));
    expect(config.ignore).to.include('node_modules/**');
    expect(config.ignore).to.include('src/**');
  });

  it('does not automatically load a community-provided extensions that does not match the naming convention', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/node-module-rec.yml');
    await createMockNodeModule(thisNodeModuleRoot(), 'not-conventional', mockNodeModuleCheck);
    const config = await loadConfig(configPath, tempDir);
    const nodeModuleCheck = config.checks.find((check) => check.meta.code === 'NodeModuleCheck');
    expect(nodeModuleCheck).not.to.exist;
  });

  it('loads a community-provided extension that is sibling to the installation of this node module (e.g. global install)', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/node-module-rec.yml');
    const globalModulePath = await createMockNodeModule(
      thisNodeModuleRoot(),
      'theme-check-global-extension',
      mockNodeModuleCheck,
    );
    const config = await loadConfig(configPath, tempDir);
    await fs.rm(globalModulePath, { recursive: true });
    const nodeModuleCheck = config.checks.find((check) => check.meta.code === 'NodeModuleCheck');
    expect(nodeModuleCheck).to.exist;
  });

  it('loads a community-provided extension by automatic node_module discovery (unscoped)', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/node-module-rec.yml');
    await createMockNodeModule(tempDir, 'theme-check-node-example', mockNodeModuleCheck);
    const config = await loadConfig(configPath, tempDir);
    const nodeModuleCheck = config.checks.find((check) => check.meta.code === 'NodeModuleCheck');
    expect(nodeModuleCheck).to.exist;
  });

  it('loads a community-provided extension by automatic node_module discovery (scoped)', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/node-module-rec.yml');
    await createMockNodeModule(tempDir, '@acme/theme-check-node-example', mockNodeModuleCheck);
    const config = await loadConfig(configPath, tempDir);
    const nodeModuleCheck = config.checks.find((check) => check.meta.code === 'NodeModuleCheck');
    expect(nodeModuleCheck).to.exist;
  });

  it('loads a community-provided extension by the require property (scoped)', async () => {
    const configPath = await createMockConfigFile(
      tempDir,
      `
extends: nothing
require: '@acme/unconventional'
NodeModuleCheck:
  enabled: true
      `,
    );
    await createMockNodeModule(tempDir, '@acme/unconventional', mockNodeModuleCheck);
    const config = await loadConfig(configPath, tempDir);
    const nodeModuleCheck = config.checks.find((check) => check.meta.code === 'NodeModuleCheck');
    expect(nodeModuleCheck).to.exist;
  });

  it('loads an extension by the require property (relative)', async () => {
    const configPath = await createMockConfigFile(
      tempDir,
      `
extends: nothing
require: './checks.js'
NodeModuleCheck:
  enabled: true
      `,
    );
    await fs.writeFile(path.join(tempDir, 'checks.js'), mockNodeModuleCheck);
    const config = await loadConfig(configPath, tempDir);
    const nodeModuleCheck = config.checks.find((check) => check.meta.code === 'NodeModuleCheck');
    expect(nodeModuleCheck).to.exist;
  });

  it('loads an aliased check properly', async () => {
    const configPath = await createMockConfigFile(
      tempDir,
      `
extends: nothing
SyntaxError:
  enabled: true
      `,
    );
    const config = await loadConfig(configPath, tempDir);
    expect(config.settings).to.eql({
      LiquidHTMLSyntaxError: {
        enabled: true,
      },
    });
  });

  it('computes the root URI properly (no root property)', async () => {
    const configPath = await createMockConfigFile(tempDir, ``);
    const config = await loadConfig(configPath, tempDir);
    const uri = URI.parse(config.rootUri);
    expect(uri.scheme).to.equal('file');
    expect(uri.fsPath).to.equal(URI.file(tempDir).fsPath);
    assert(config.rootUri.startsWith('file://')); // should double slash for windows paths to work correctly
  });

  it('computes the root URI properly ', async () => {
    const configPath = await createMockConfigFile(tempDir, `root: ./src`);
    const config = await loadConfig(configPath, tempDir);
    const uri = URI.parse(config.rootUri);
    expect(uri.scheme).to.equal('file');
    expect(uri.fsPath).to.equal(URI.file(path.resolve(tempDir, 'src')).fsPath);
    assert(config.rootUri.startsWith('file://'));
  });

  function check(code: string) {
    return allChecks.find(isCheck(code));
  }

  function isCheck(code: string) {
    return (checkDef: CheckDefinition<SourceCodeType>) => checkDef.meta.code === code;
  }
});
