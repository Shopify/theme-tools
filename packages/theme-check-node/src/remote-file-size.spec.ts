import http from 'node:http';
import { AddressInfo, LookupFunction } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRemoteFileSize, publicLookup } from './remote-file-size';

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

/** A `lookup` that answers with `addresses` for every name, and records the names. */
function lookupAnswering(...addresses: string[]) {
  const names: string[] = [];
  const all = addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  const lookup: LookupFunction = (hostname, options, callback) => {
    names.push(hostname);
    options.all ? callback(null, all) : callback(null, all[0].address, all[0].family);
  };
  return Object.assign(lookup, { names });
}

describe('Function: makeRemoteFileSize', () => {
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it.each(['http', 'https'])(
    'sends no request to an %s URL whose name resolves to a loopback address',
    async (protocol) => {
      const lookup = lookupAnswering('127.0.0.1');
      const remoteFileSize = makeRemoteFileSize(lookup);

      expect(await remoteFileSize(`${protocol}://assets.example.test:${server.port}/a.css`)).toBe(
        0,
      );
      expect(lookup.names).toEqual(['assets.example.test']);
      expect(server.requests).toEqual([]);
    },
  );
});

describe('Function: publicLookup', () => {
  function lookup(addresses: string[], all: boolean) {
    return new Promise((resolve, reject) =>
      publicLookup(lookupAnswering(...addresses))('cdn.example.com', { all }, (error, ...answer) =>
        error ? reject(error) : resolve(answer),
      ),
    );
  }

  it('gives every address when all of them are public', async () => {
    expect(await lookup(['1.1.1.1', '2606:4700::1111'], true)).toEqual([
      [
        { address: '1.1.1.1', family: 4 },
        { address: '2606:4700::1111', family: 6 },
      ],
    ]);
  });

  it('gives the first address when the socket asks for one', async () => {
    expect(await lookup(['1.1.1.1', '2606:4700::1111'], false)).toEqual(['1.1.1.1', 4]);
  });

  it.each([
    ['a loopback address', ['127.0.0.1']],
    ['the cloud metadata address', ['169.254.169.254']],
    ['a private address after a public one', ['1.1.1.1', '10.0.0.1']],
    ['an IPv6 loopback address', ['::1']],
  ])('refuses a name with %s', async (_description, addresses) => {
    await expect(lookup(addresses, true)).rejects.toThrow('is not a public address');
    await expect(lookup(addresses, false)).rejects.toThrow('is not a public address');
  });
});
