import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { loadConfig } from './load-config';
import {
  allChecks,
  CheckDefinition,
  recommended,
  Severity,
  SourceCodeType,
} from '@shopify/theme-check-common';
import { createMockConfigFile, makeTmpFolder, removeTmpFolder } from '../test/test-helpers';

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
    expect(config.root).to.eql(__dirname);
  });

  it('loads the recommended config', async () => {
    const configPath = await createMockConfigFile(tempDir, `extends: theme-check:recommended`);
    const config = await loadConfig(configPath);
    expect(config.checks).to.eql(recommended);
  });

  it('loads the all config', async () => {
    const configPath = await createMockConfigFile(tempDir, `extends: theme-check:all`);
    const config = await loadConfig(configPath);
    expect(config.checks).to.eql(allChecks);
  });

  it('loads a compound config', async () => {
    const configPath = await createMockConfigFile(
      tempDir,
      `extends: theme-check:theme-app-extension`,
    );
    const config = await loadConfig(configPath);

    const ParserBlockingScript = check('ParserBlockingScript')!;
    expect(config.checks).to.include(ParserBlockingScript);

    const RequiredLayoutThemeObject = check('RequiredLayoutThemeObject');
    expect(config.checks).not.to.include(RequiredLayoutThemeObject);
  });

  it('loads a compound config, with overrides', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/theme-app-extension-with-overrides.yml');
    const config = await loadConfig(configPath);

    const ParserBlockingScript = check('ParserBlockingScript')!;
    expect(config.checks).not.to.include(ParserBlockingScript);

    const UnusedAssign = check('UnusedAssign')!;
    expect(UnusedAssign.meta.severity).to.equal(Severity.WARNING);
    expect(config.settings.UnusedAssign!.severity).to.equal(Severity.ERROR);
  });

  it('loads a multi-compound config, with overrides', async () => {
    const configPath = path.resolve(__dirname, 'fixtures/multi-compound.yml');
    const config = await loadConfig(configPath);

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
    const config = await loadConfig(configPath);
    expect(config.ignore).to.include('node_modules/**');
    expect(config.ignore).to.include('src/**');
  });

  function check(code: string) {
    return allChecks.find(isCheck(code));
  }

  function isCheck(code: string) {
    return (checkDef: CheckDefinition<SourceCodeType>) => checkDef.meta.code === code;
  }
});
