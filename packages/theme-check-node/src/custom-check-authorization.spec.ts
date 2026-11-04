import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  check,
  checkAndAutofix,
  getThemeAndConfig,
  JSONValidator,
  loadConfig,
  LoadConfigOptions,
  recommended,
  themeCheckRun,
} from './index';
import { loadConfig as internalLoadConfig } from './config/load-config';
import {
  createMockConfigFile,
  createMockNodeModule,
  makeTmpFolder,
  mockNodeModuleCheck,
  removeTmpFolder,
} from './test/test-helpers';

// Exercise the public wrappers, including the one imported by language-server clients.
const entryPoints: [string, (root: string, options?: LoadConfigOptions) => Promise<unknown>][] = [
  ['loadConfig', (root, options) => loadConfig(undefined, root, options)],
  [
    'explicit loadConfig',
    (root, options) => loadConfig(path.join(root, '.theme-check.yml'), root, options),
  ],
  [
    'internal loadConfig',
    (root, options) => internalLoadConfig(path.join(root, '.theme-check.yml'), root, options),
  ],
  ['getThemeAndConfig', (root, options) => getThemeAndConfig(root, undefined, options)],
  ['check', (root, options) => check(root, undefined, options)],
  ['themeCheckRun', (root, options) => themeCheckRun(root, undefined, undefined, options)],
  ['checkAndAutofix', (root, options) => checkAndAutofix(root, undefined, options)],
];

describe('custom check authorization', () => {
  let root: string;
  let marker: string;
  let moduleCode: string;

  beforeEach(async () => {
    root = await makeTmpFolder();
    marker = path.join(root, 'executed');
    moduleCode = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes');\n${mockNodeModuleCheck}`;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Schema downloads are unrelated to config loading and require network access.
    vi.spyOn(JSONValidator, 'create').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await removeTmpFolder(root);
  });

  describe.each(entryPoints)('%s', (_name, run) => {
    beforeEach(async () => {
      await createMockConfigFile(
        root,
        "require: './checks.js'\nNodeModuleCheck:\n  enabled: true\n",
      );
      await fs.writeFile(path.join(root, 'checks.js'), moduleCode);
    });

    it('does not evaluate custom code without authorization', async () => {
      await run(root);
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Custom Theme Checks are disabled'),
      );
    });

    it('forwards authorization and loads approved code', async () => {
      const authorizeCustomChecks = vi.fn(() => true);
      await run(root, { authorizeCustomChecks });
      expect(authorizeCustomChecks).toHaveBeenCalledExactlyOnceWith({
        root,
        candidates: [{ source: 'require', path: path.join(root, 'checks.js') }],
      });
      expect(await fs.readFile(marker, 'utf8')).toBe('yes');
    });
  });

  it.each(['relative', 'absolute', 'package', 'inherited', 'discovery'])(
    'does not evaluate a denied %s extension',
    async (source) => {
      let config = 'NodeModuleCheck:\n  enabled: true\n';
      if (source === 'package' || source === 'discovery') {
        const name = source === 'package' ? '@acme/custom-checks' : '@acme/theme-check-custom';
        await createMockNodeModule(root, name, moduleCode);
        if (source === 'package') config += `require: '${name}'\n`;
      } else {
        await fs.writeFile(path.join(root, 'checks.js'), moduleCode);
        const modulePath = source === 'absolute' ? path.join(root, 'checks.js') : './checks.js';
        const requireConfig = `require: ${JSON.stringify(modulePath)}\n`;
        if (source === 'inherited') {
          await createMockConfigFile(root, requireConfig, 'base.yml');
          config += "extends: ['./base.yml', 'theme-check:recommended']\n";
        } else {
          config += requireConfig;
        }
      }
      await createMockConfigFile(root, config);
      const authorizeCustomChecks = vi.fn(async () => false);
      const result = await loadConfig(undefined, root, { authorizeCustomChecks });
      expect(authorizeCustomChecks).toHaveBeenCalledOnce();
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(result.checks).toEqual(recommended);
      expect(result.settings).not.toHaveProperty('NodeModuleCheck');
      expect(result.settings).not.toHaveProperty('undefined');
    },
  );

  it('does not trust discovered modules merely because a trusted config is explicit', async () => {
    await createMockNodeModule(root, 'theme-check-custom', moduleCode);
    await loadConfig('theme-check:recommended', root);
    await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([undefined, null, 'true', 1, {}])(
    'rejects a non-boolean permission response: %s',
    async (response) => {
      await createMockConfigFile(root, "require: './checks.js'\n");
      await fs.writeFile(path.join(root, 'checks.js'), moduleCode);
      await loadConfig(undefined, root, { authorizeCustomChecks: () => response as boolean });
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('does not evaluate custom code if the authorization callback throws', async () => {
    await createMockConfigFile(root, "require: './checks.js'\n");
    await fs.writeFile(path.join(root, 'checks.js'), moduleCode);
    await expect(
      loadConfig(undefined, root, {
        authorizeCustomChecks: () => {
          throw new Error('Permission unavailable');
        },
      }),
    ).rejects.toThrow('Permission unavailable');
    await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not request authorization when there are no custom checks', async () => {
    const authorizeCustomChecks = vi.fn(() => false);
    await loadConfig(undefined, root, { authorizeCustomChecks });
    expect(authorizeCustomChecks).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
