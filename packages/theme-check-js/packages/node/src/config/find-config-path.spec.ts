import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createMockConfigFile, makeTmpFolder, removeTmpFolder } from '../test/test-helpers';
import { findConfigPath } from './find-config-path';

describe('Unit: findConfigPath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTmpFolder();
  });

  afterEach(async () => {
    await removeTmpFolder(tempDir);
  });

  it('finds a .theme-check.yml config file', async () => {
    const configPath = await createMockConfigFile(tempDir, 'dummy content', '.theme-check.yml');
    const foundConfigPath = await findConfigPath(tempDir);
    expect(foundConfigPath).to.eql(configPath);
  });

  it('returns undefined if no config file is found', async () => {
    const foundConfigPath = await findConfigPath(tempDir);
    expect(foundConfigPath).to.be.undefined;
  });
});
