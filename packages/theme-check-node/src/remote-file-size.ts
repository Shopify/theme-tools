import { getFileSize, isPublicIpAddress } from '@shopify/theme-check-common';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';

/**
 * A `lookup` for sockets that gives the addresses of `lookup`, and an error when any of them is not
 * public. The socket connects to the addresses that it gives.
 */
export function publicLookup(lookup: LookupFunction = dns.lookup): LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses, family) => {
      if (error) return callback(error, '');
      const all =
        typeof addresses === 'string' ? [{ address: addresses, family: family ?? 0 }] : addresses;
      const refused = all.find(({ address }) => !isPublicIpAddress(address));
      if (all.length === 0 || refused) {
        const reason = refused ? `${refused.address} is not a public address` : 'no address';
        return callback(new Error(`${hostname}: ${reason}`), '');
      }
      if (options.all) return callback(null, all);
      callback(null, all[0].address, all[0].family);
    });
  };
}

/**
 * `remoteFileSize` for theme-check-node: `getFileSize`, which refuses `localhost` and IP addresses
 * that are not public. A host name can resolve to such an address, so the request goes through
 * agents with a `publicLookup`, which refuses it.
 */
export function makeRemoteFileSize(lookup?: LookupFunction): (url: string) => Promise<number> {
  const agents = {
    http: new http.Agent({ lookup: publicLookup(lookup) }),
    https: new https.Agent({ lookup: publicLookup(lookup) }),
  };
  const agent = ({ protocol }: { protocol: string | null }) =>
    protocol === 'http:' ? agents.http : agents.https;
  return (url) => getFileSize(url, { agent });
}

export const remoteFileSize = makeRemoteFileSize();
