import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { findThirdPartyChecks, loadThirdPartyChecks } from './load-third-party-checks';
import {
  makeTmpFolder,
  removeTmpFolder,
  createMockNodeModule,
  mockNodeModuleCheck,
} from '../test/test-helpers';

describe('Unit: loadThirdPartyChecks', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTmpFolder();
  });

  afterEach(async () => {
    await removeTmpFolder(tempDir);
  });

  it('finds third-party checks in node_modules', async () => {
    await createMockNodeModule(tempDir, 'theme-check-react', mockNodeModuleCheck);
    const modulePaths = await findThirdPartyChecks(tempDir);
    expect(modulePaths.length).to.be.greaterThan(0);
  });

  it('finds third-party checks in node_modules (scoped module)', async () => {
    await createMockNodeModule(tempDir, '@acme/theme-check-extension', mockNodeModuleCheck);
    const modulePaths = await findThirdPartyChecks(tempDir);
    expect(modulePaths.length).to.be.greaterThan(0);
  });

  it('loads third-party checks from requirePaths', async () => {
    await fs.mkdir(path.join(tempDir, 'lib'));
    const localModulePath = path.join(tempDir, 'lib', 'local-check.js');
    await fs.writeFile(localModulePath, mockNodeModuleCheck);
    const checks = await loadThirdPartyChecks(tempDir, [localModulePath]);
    expect(checks.length).to.be.greaterThan(0);
    expect(checks[0].meta.code).to.equal('MockCheck');
  });

  it('loads third-party checks from node_modules', async () => {
    await createMockNodeModule(tempDir, 'theme-check-react', mockNodeModuleCheck);
    const checks = await loadThirdPartyChecks(tempDir);
    expect(checks.length).to.be.greaterThan(0);
    expect(checks[0].meta.code).to.equal('MockCheck');
  });

  it('loads third-party checks from node_modules (scoped)', async () => {
    await createMockNodeModule(tempDir, '@acme/theme-check-extension', mockNodeModuleCheck);
    const checks = await loadThirdPartyChecks(tempDir);
    expect(checks.length).to.be.greaterThan(0);
    expect(checks[0].meta.code).to.equal('MockCheck');
  });

  it('handles errors when loading third-party checks', async () => {
    const nodeModuleRoot = await createMockNodeModule(
      tempDir,
      'theme-check-error',
      `throw new Error('This module loads with an error');`,
    );
    const requirePaths = [path.join(nodeModuleRoot, 'package.json')];
    const checks = await loadThirdPartyChecks(nodeModuleRoot, requirePaths);
    expect(checks.length).to.equal(0);
  });
});
