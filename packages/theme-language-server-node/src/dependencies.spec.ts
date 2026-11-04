import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeFileSystem } from '@shopify/theme-check-node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';
import { loadConfig } from './dependencies';

afterEach(() => vi.restoreAllMocks());

describe('custom checks through the language server config loader', () => {
  it.each(['config', 'theme', 'app'] as const)(
    'requires authorization for a %s root',
    async (kind) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-check-permission-'));
      try {
        const marker = path.join(root, 'executed');
        const modulePath = path.join(root, 'node_modules', 'theme-check-custom');
        await fs.mkdir(modulePath, { recursive: true });
        await fs.mkdir(path.join(root, 'snippets'));
        await fs.mkdir(path.join(root, 'assets'));
        const document = path.join(root, 'snippets', 'example.liquid');
        await fs.writeFile(document, 'Hello');
        await fs.writeFile(
          path.join(modulePath, 'index.js'),
          `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes'); exports.checks = [];`,
        );
        if (kind === 'config') {
          await fs.writeFile(
            path.join(root, '.theme-check.yml'),
            "require: './node_modules/theme-check-custom'\n",
          );
        } else if (kind === 'theme') {
          await fs.mkdir(path.join(root, '.git'));
        } else if (kind === 'app') {
          await fs.writeFile(path.join(root, 'shopify.extension.toml'), '');
        }
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const uri = URI.file(document).toString();
        await loadConfig(uri, NodeFileSystem);
        await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });

        const denied = vi.fn(async () => false);
        await loadConfig(uri, NodeFileSystem, { authorizeCustomChecks: denied });
        expect(denied).toHaveBeenCalledOnce();
        await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });

        const approved = vi.fn(async () => true);
        await loadConfig(uri, NodeFileSystem, { authorizeCustomChecks: approved });
        expect(approved).toHaveBeenCalledWith({ root, candidates: expect.any(Array) });
        expect(await fs.readFile(marker, 'utf8')).toBe('yes');
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
});
