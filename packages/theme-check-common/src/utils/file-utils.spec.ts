import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFileSize } from './file-utils';

const SIZE = 123456;

/**
 * A server on 127.0.0.1 that answers `/redirect` with a redirect to `/asset.css` on itself, and any
 * other path with a `Content-Length` of `SIZE`. It records the paths it is asked for.
 */
async function startServer() {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url!);
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: `http://127.0.0.1:${port()}/asset.css` }).end();
    } else {
      res.writeHead(200, { 'Content-Length': SIZE }).end();
    }
  });
  const port = () => (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { requests, port: port(), close: () => new Promise((resolve) => server.close(resolve)) };
}

describe('Function: getFileSize', () => {
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it.each([
    ['a loopback address', (port: number) => `http://127.0.0.1:${port}/asset.css`],
    ['a loopback address in hexadecimal', (port: number) => `http://0x7f000001:${port}/asset.css`],
    ['localhost', (port: number) => `http://localhost:${port}/asset.css`],
    ['a loopback address that redirects', (port: number) => `http://127.0.0.1:${port}/redirect`],
  ])('sends no request to %s', async (_description, url) => {
    expect(await getFileSize(url(server.port))).toBe(0);
    expect(server.requests).toEqual([]);
  });

  describe('with an agent that resolves every name to 127.0.0.1', () => {
    const agent = new http.Agent({
      lookup: (_hostname, options, callback) =>
        options.all
          ? callback(null, [{ address: '127.0.0.1', family: 4 }])
          : callback(null, '127.0.0.1', 4),
    });
    const options = { agent: () => agent };

    it('gives the Content-Length of a public URL', async () => {
      const url = `http://assets.example.test:${server.port}/asset.css`;

      expect(await getFileSize(url, options)).toBe(SIZE);
      expect(server.requests).toEqual(['/asset.css']);
    });

    it('does not follow a redirect', async () => {
      const url = `http://assets.example.test:${server.port}/redirect`;

      expect(await getFileSize(url, options)).toBe(0);
      expect(server.requests).toEqual(['/redirect']);
    });
  });
});
