import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer as startCoreServer } from '@shopify/theme-language-server-common';
import { NodeFileSystem } from '@shopify/theme-check-node';
import { describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';
import { startServer } from './index';

vi.mock('@shopify/theme-language-server-common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/theme-language-server-common')>()),
  startServer: vi.fn(),
}));

describe('Module: index (server)', () => {
  it('should exist and run', () => {
    expect(startServer).to.exist;
  });
});

describe('startServer custom check authorization', () => {
  it.each([false, true])(
    'forwards authorization=%s through the injected loader',
    async (allowed) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'language-server-permission-'));
      const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const marker = path.join(root, 'executed');
        await fs.writeFile(path.join(root, '.theme-check.yml'), "require: './checks.cjs'\n");
        await fs.writeFile(
          path.join(root, 'checks.cjs'),
          `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes'); exports.checks = [];`,
        );
        const authorizeCustomChecks = vi.fn(async () => allowed);
        const onDiagnostic = vi.fn();
        startServer({} as any, NodeFileSystem, { authorizeCustomChecks, onDiagnostic });
        const dependencies = vi.mocked(startCoreServer).mock.calls.at(-1)![1];
        await dependencies.loadConfig(URI.file(root).toString(), NodeFileSystem);
        expect(authorizeCustomChecks).toHaveBeenCalledOnce();
        if (allowed) {
          expect(await fs.readFile(marker, 'utf8')).toBe('yes');
          expect(onDiagnostic).not.toHaveBeenCalled();
        } else {
          await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
          expect(onDiagnostic).toHaveBeenCalledExactlyOnceWith({
            code: 'custom-checks-disabled',
            level: 'warning',
            message: expect.any(String),
            root: URI.file(root).fsPath,
            candidates: [
              { source: 'require', path: path.join(URI.file(root).fsPath, 'checks.cjs') },
            ],
          });
        }
        expect(warning).not.toHaveBeenCalled();
      } finally {
        warning.mockRestore();
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
});
