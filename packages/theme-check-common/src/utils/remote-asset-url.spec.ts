import { describe, expect, it } from 'vitest';
import { isPublicIpAddress, toRemoteAssetUrl } from './remote-asset-url';

describe('Function: toRemoteAssetUrl', () => {
  it.each([
    ['https://cdn.example.com/theme.css', 'https://cdn.example.com/theme.css'],
    ['http://cdn.example.com:8080/theme.css?v=1', 'http://cdn.example.com:8080/theme.css?v=1'],
    ['//cdn.example.com/theme.css', 'https://cdn.example.com/theme.css'],
    ['HTTPS://CDN.Example.com/theme.css', 'https://cdn.example.com/theme.css'],
    ['https://8.8.8.8/theme.css', 'https://8.8.8.8/theme.css'],
    ['https://[2606:4700::1111]/theme.css', 'https://[2606:4700::1111]/theme.css'],
    ['https://[::ffff:8.8.8.8]/theme.css', 'https://[::ffff:808:808]/theme.css'],
    ['https://localhost.example.com/theme.css', 'https://localhost.example.com/theme.css'],
  ])('allows %s', (url, expected) => {
    expect(toRemoteAssetUrl(url)).toBe(expected);
  });

  it.each([
    ['a loopback address', 'http://127.0.0.1/theme.css'],
    ['a loopback address in hexadecimal', 'http://0x7f.1/theme.css'],
    ['a loopback address as one number', 'http://2130706433/theme.css'],
    ['a loopback address in octal', 'http://0177.0.0.1/theme.css'],
    ['a loopback address with a final dot', 'http://127.0.0.1./theme.css'],
    ['localhost', 'http://localhost:3000/theme.css'],
    ['localhost with a final dot', 'http://LOCALHOST./theme.css'],
    ['a name under localhost', 'http://app.localhost/theme.css'],
    ['a protocol-relative loopback address', '//127.0.0.1/theme.css'],
    ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
    ['a private address', 'https://10.0.0.1/theme.css'],
    ['a private address in 172.16.0.0/12', 'https://172.31.255.255/theme.css'],
    ['a private address in 192.168.0.0/16', 'https://192.168.1.1/theme.css'],
    ['a carrier-grade NAT address', 'https://100.64.0.1/theme.css'],
    ['the unspecified address', 'http://0.0.0.0/theme.css'],
    ['the broadcast address', 'http://255.255.255.255/theme.css'],
    ['the IPv6 loopback address', 'http://[::1]/theme.css'],
    ['the IPv6 unspecified address', 'http://[::]/theme.css'],
    ['an IPv4-mapped loopback address', 'http://[::ffff:127.0.0.1]/theme.css'],
    ['an IPv4-mapped metadata address', 'http://[::ffff:a9fe:a9fe]/theme.css'],
    ['a NAT64 private address', 'http://[64:ff9b::10.0.0.1]/theme.css'],
    ['an IPv6 unique local address', 'http://[fd00::1]/theme.css'],
    ['an IPv6 link-local address', 'http://[fe80::1]/theme.css'],
    ['a user name and password', 'https://user:password@cdn.example.com/theme.css'],
    ['a user name', 'https://user@cdn.example.com/theme.css'],
    ['another protocol', 'file:///etc/passwd'],
    ['an ftp URL', 'ftp://cdn.example.com/theme.css'],
    ['a relative URL', '/assets//theme.css'],
    ['text that is not a URL', 'https://{{ settings.cdn }}/theme.css'],
  ])('refuses %s', (_description, url) => {
    expect(toRemoteAssetUrl(url)).toBeUndefined();
  });

  it('reads a host name with a long run of dots in linear time', () => {
    const dots = '.'.repeat(100_000);
    const start = performance.now();
    expect(toRemoteAssetUrl(`http://a${dots}x/theme.css`)).toBe(`http://a${dots}x/theme.css`);
    expect(toRemoteAssetUrl(`http://localhost${dots}/theme.css`)).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('Function: isPublicIpAddress', () => {
  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '23.0.0.1',
    '100.63.255.255',
    '100.128.0.0',
    '172.15.255.255',
    '172.32.0.0',
    '192.0.1.1',
    '223.255.255.255',
    '2606:4700:4700::1111',
    '2a00:1450:4001:830::200e',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808',
  ])('says %s is public', (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.255.255.255',
    '100.64.0.0',
    '100.127.255.255',
    '127.0.0.1',
    '127.255.255.255',
    '169.254.169.254',
    '172.16.0.0',
    '192.0.0.192',
    '192.0.2.1',
    '192.168.0.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::127.0.0.1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '64:ff9b::7f00:1',
    '64:ff9b:1::1',
    '100::1',
    '2001::1',
    '2001:db8::1',
    '2002:7f00:1::1',
    'fc00::1',
    'fdff:ffff::1',
    'fe80::1',
    'fe80::1%eth0',
    'fec0::1',
    'ff02::1',
  ])('says %s is not public', (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each([
    '',
    'localhost',
    '1.2.3',
    '1.2.3.4.5',
    '256.0.0.1',
    '1::2::3',
    '1:2:3:4:5:6:7:8:9',
    'g::1',
  ])('says %j, which is not an IP address, is not public', (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });
});
