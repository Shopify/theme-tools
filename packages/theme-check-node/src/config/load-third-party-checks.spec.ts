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

describe('Module: ThirdPartyChecks', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTmpFolder();
  });

  afterEach(async () => {
    await removeTmpFolder(tempDir);
  });

  describe('Unit: findThirdPartyChecks', () => {
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

    it('does not find modules that do not match the naming convention', async () => {
      await createMockNodeModule(tempDir, '@acme/not-theme-check-extension', mockNodeModuleCheck);
      await createMockNodeModule(tempDir, 'not-theme-check-extension', mockNodeModuleCheck);
      await createMockNodeModule(tempDir, 'glob', mockNodeModuleCheck);
      const modulePaths = await findThirdPartyChecks(tempDir);
      expect(modulePaths).to.have.lengthOf(0);
    });
  });

  describe('Unit: loadThirdPartyChecks', () => {
    it('loads third-party checks from relative paths', async () => {
      await fs.mkdir(path.join(tempDir, 'lib'));
      const localModulePath = path.join(tempDir, 'lib', 'local-check.js');
      await fs.writeFile(localModulePath, mockNodeModuleCheck);
      const modulePaths = [localModulePath];
      const checks = loadThirdPartyChecks(modulePaths);
      expect(checks.length).to.be.greaterThan(0);
      expect(checks[0].meta.code).to.equal('NodeModuleCheck');
    });

    it('loads third-party checks from node_modules', async () => {
      await createMockNodeModule(tempDir, 'theme-check-react', mockNodeModuleCheck);
      const modulePaths = await findThirdPartyChecks(tempDir);
      const checks = loadThirdPartyChecks(modulePaths);
      expect(checks.length).to.be.greaterThan(0);
      expect(checks[0].meta.code).to.equal('NodeModuleCheck');
    });

    it('loads third-party checks from node_modules (scoped)', async () => {
      await createMockNodeModule(tempDir, '@acme/theme-check-extension', mockNodeModuleCheck);
      const modulePaths = await findThirdPartyChecks(tempDir);
      const checks = loadThirdPartyChecks(modulePaths);
      expect(checks.length).to.be.greaterThan(0);
      expect(checks[0].meta.code).to.equal('NodeModuleCheck');
    });

    it('handles errors when loading third-party checks', async () => {
      await createMockNodeModule(
        tempDir,
        'theme-check-error',
        `throw new Error('This module loads with an error');`,
      );
      const modulePaths = await findThirdPartyChecks(tempDir);
      const checks = loadThirdPartyChecks(modulePaths);
      expect(checks.length).to.equal(0);
    });

    it('throws an error if you are requiring a path that does not exist', async () => {
      // this path does not exist
      const pathToFileThatDoesNotExist = path.join(tempDir, 'lib', 'index.js');
      const modulePaths = [pathToFileThatDoesNotExist];
      const checks = loadThirdPartyChecks(modulePaths);
      expect(checks.length).to.equal(0);
    });
  });
});
