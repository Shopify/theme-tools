import fs from 'node:fs/promises';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { check, JSONValidator } from './index';
import { createMockConfigFile, makeTmpFolder, removeTmpFolder } from './test/test-helpers';

/** A server on 127.0.0.1 that answers every request with a large `Content-Length`. */
async function startServer() {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url!);
    res.writeHead(200, { 'Content-Length': 1000000 }).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { requests, port, close: () => new Promise((resolve) => server.close(resolve)) };
}

describe('AssetSizeCSS and AssetSizeJavaScript', () => {
  let tmpDir: string;
  let root: string;
  let configPath: string;
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeEach(async () => {
    tmpDir = await makeTmpFolder();
    root = path.join(tmpDir, 'theme');
    await fs.mkdir(path.join(root, 'snippets'), { recursive: true });
    configPath = await createMockConfigFile(
      tmpDir,
      [
        'extends: nothing',
        'AssetSizeCSS:',
        '  enabled: true',
        '  thresholdInBytes: 1',
        'AssetSizeJavaScript:',
        '  enabled: true',
        '  thresholdInBytes: 1',
      ].join('\n'),
    );
    // Schema downloads are unrelated to these checks and require network access.
    vi.spyOn(JSONValidator, 'create').mockResolvedValue(undefined);
    server = await startServer();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await server.close();
    await removeTmpFolder(tmpDir);
  });

  it('sends no request to a loopback address and reports no size for it', async () => {
    const origin = `http://127.0.0.1:${server.port}`;
    await fs.writeFile(
      path.join(root, 'snippets', 'assets.liquid'),
      [
        `<link rel="stylesheet" href="${origin}/link.css">`,
        `{{ '${origin}/tag.css' | stylesheet_tag }}`,
        `<script src="http://localhost:${server.port}/script.js"></script>`,
        `{{ 'http://0x7f000001:${server.port}/tag.js' | script_tag }}`,
      ].join('\n'),
    );

    const offenses = await check(root, configPath);

    expect(offenses.map((offense) => offense.check)).toEqual([]);
    expect(server.requests).toEqual([]);
  });
});
