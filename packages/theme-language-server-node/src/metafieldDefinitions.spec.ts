import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const exec = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({ exec }));

// The language server finds the CLI with `which` on macOS and Linux, and
// with `where.exe` on Windows, where it only runs a .bat file.
const cliPath =
  process.platform === 'win32' ? 'C:\\shopify\\bin\\shopify.bat' : '/usr/local/bin/shopify';
const isCliLookup = (command: string) =>
  command.startsWith('which') || command.startsWith('where.exe');

describe('fetchMetafieldDefinitionsForURI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    exec.mockImplementation((command: string, ...args: any[]) => {
      const callback = args[args.length - 1];
      const stdout = isCliLookup(command) ? `${cliPath}\n` : '';
      callback(null, { stdout, stderr: '' });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    exec.mockReset();
  });

  it('pulls metafield definitions without letting the CLI prompt for a login', async () => {
    const { fetchMetafieldDefinitionsForURI } = await import('./metafieldDefinitions');

    await fetchMetafieldDefinitionsForURI('file:///path/to/theme');

    expect(exec).toHaveBeenCalledWith(
      `${cliPath} theme metafields pull`,
      expect.objectContaining({
        env: expect.objectContaining({
          SHOPIFY_LANGUAGE_SERVER: '1',
          SHOPIFY_FLAG_NO_INPUT: '1',
          CI: '1',
        }),
      }),
      expect.any(Function),
    );
  });

  it('stays silent when the CLI fails', async () => {
    exec.mockImplementation((command: string, ...args: any[]) => {
      const callback = args[args.length - 1];
      if (isCliLookup(command)) return callback(null, { stdout: `${cliPath}\n` });
      callback(new Error('Authorization is required to continue'));
    });
    const { fetchMetafieldDefinitionsForURI } = await import('./metafieldDefinitions');

    await expect(fetchMetafieldDefinitionsForURI('file:///path/to/theme')).resolves.toBeUndefined();
  });
});
