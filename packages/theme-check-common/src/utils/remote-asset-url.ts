/**
 * The URL to request for the size of a remote asset, or `undefined` when no request may go to it.
 *
 * Theme authors write these URLs, and a service can lint themes that it does not trust. So the URL
 * must be http(s) with no user name or password, and its host must not be `localhost` or an IP
 * address that is not public (`isPublicIpAddress`). A host name can still resolve to such an
 * address: a platform that resolves names checks the addresses it connects to, as
 * theme-check-node does.
 */
export function toRemoteAssetUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    // cross-fetch requests a protocol-relative URL over https.
    parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  if (parsed.username !== '' || parsed.password !== '') return undefined;
  if (!isPublicHost(parsed.hostname)) return undefined;
  return parsed.href;
}

/**
 * Whether `hostname`, as `URL` serializes it, can be public. `URL` writes every IPv4 address in
 * dotted decimal (`0x7f.1` is `127.0.0.1`) and every IPv6 address in brackets.
 */
function isPublicHost(hostname: string): boolean {
  if (hostname.startsWith('[')) return isPublicIpAddress(hostname.slice(1, -1));
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return isPublicIpAddress(hostname);
  const name = hostname.replace(/\.+$/, '');
  return name !== 'localhost' && !name.endsWith('.localhost');
}

type Range = [address: string, prefixLength: number];

/** IPv4 ranges that are not public: IANA's special-purpose addresses that are not global. */
const NON_PUBLIC_IPV4: Range[] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // shared address space (carrier-grade NAT)
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, where cloud metadata services are
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and the broadcast address
];

/** IPv6 ranges that are public only when the IPv4 address in their last 32 bits is. */
const IPV4_IN_IPV6: Range[] = [
  ['::ffff:0:0', 96], // IPv4-mapped
  ['64:ff9b::', 96], // NAT64
];

/** IPv6 ranges that are not public. */
const NON_PUBLIC_IPV6: Range[] = [
  ['::', 96], // unspecified, loopback and IPv4-compatible
  ['64:ff9b:1::', 48], // NAT64 for local use
  ['100::', 64], // discard
  ['2001::', 23], // IETF protocol assignments, Teredo included
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local
  ['ff00::', 8], // multicast
];

/**
 * Whether `address`, an IPv4 address in dotted decimal or an IPv6 address, is public. An address
 * in neither form is not.
 */
export function isPublicIpAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) return !NON_PUBLIC_IPV4.some((range) => isInRange(ipv4, range, parseIpv4));
  // An IPv6 address from a name lookup can carry a zone, as in `fe80::1%eth0`.
  const ipv6 = parseIpv6(address.replace(/%.*$/, ''));
  if (!ipv6) return false;
  if (IPV4_IN_IPV6.some((range) => isInRange(ipv6, range, parseIpv6))) {
    return isPublicIpAddress(ipv6.slice(12).join('.'));
  }
  return !NON_PUBLIC_IPV6.some((range) => isInRange(ipv6, range, parseIpv6));
}

function isInRange(
  bytes: number[],
  [address, prefixLength]: Range,
  parse: (address: string) => number[] | undefined,
): boolean {
  const rangeBytes = parse(address)!;
  for (let bit = 0; bit < prefixLength; bit++) {
    const mask = 0x80 >> (bit % 8);
    const i = Math.floor(bit / 8);
    if ((bytes[i] & mask) !== (rangeBytes[i] & mask)) return false;
  }
  return true;
}

/** The 4 bytes of an IPv4 address in dotted decimal. */
function parseIpv4(address: string): number[] | undefined {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return undefined;
  const bytes = address.split('.').map(Number);
  return bytes.every((byte) => byte <= 255) ? bytes : undefined;
}

/** The 16 bytes of an IPv6 address, which can end with an IPv4 address in dotted decimal. */
function parseIpv6(address: string): number[] | undefined {
  const halves = address.split('::');
  if (halves.length > 2) return undefined;
  const groups = halves.map((half) => (half === '' ? [] : half.split(':')));
  const last = groups[groups.length - 1];
  const ipv4 = last.length > 0 ? parseIpv4(last[last.length - 1]) : undefined;
  if (ipv4) {
    last.splice(
      -1,
      1,
      ((ipv4[0] << 8) | ipv4[1]).toString(16),
      ((ipv4[2] << 8) | ipv4[3]).toString(16),
    );
  }
  const count = groups.reduce((sum, group) => sum + group.length, 0);
  if (groups.length === 1 ? count !== 8 : count > 7) return undefined;
  const hextets = [...groups[0], ...Array(8 - count).fill('0'), ...(groups[1] ?? [])];
  if (!hextets.every((hextet) => /^[0-9a-f]{1,4}$/i.test(hextet))) return undefined;
  return hextets.flatMap((hextet) => {
    const value = parseInt(hextet, 16);
    return [value >> 8, value & 0xff];
  });
}
