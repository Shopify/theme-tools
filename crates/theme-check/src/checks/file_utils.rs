//! `utils/file-utils.ts`

use crate::context::{CheckError, Context};
use crate::{js, path};
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};

/// `isAssetFileName(context, fileName)`: only files directly in `assets`, both as written
/// and after the file system decodes the URI.
pub fn is_asset_file_name(cx: &Context, file_name: &str) -> bool {
    let uri = cx.to_uri(&format!("assets/{file_name}"));
    let base_name = path::basename(&uri, None);
    !file_name.contains(['/', '\\'])
        && !base_name.contains(['/', '\\'])
        && base_name != "."
        && base_name != ".."
        && path::dirname(&uri) == cx.to_uri("assets")
}

/// `isInThemeDirectory(context, relativePath)`: whether the path stays in the theme directory that
/// its first segment names, as the file system reads the path.
fn is_in_theme_directory(cx: &Context, relative_path: &str) -> bool {
    let directory = relative_path
        .split_once('/')
        .map_or("", |(directory, _)| directory);
    let mut directory_path = path::file_system_path(&cx.to_uri(directory));
    if !directory_path.ends_with('/') {
        directory_path.push('/');
    }
    path::file_system_path(&cx.to_uri(relative_path)).starts_with(&directory_path)
}

/// `doesFileExist(context, relativePath)`
pub fn does_file_exist(cx: &Context, relative_path: &str) -> bool {
    is_in_theme_directory(cx, relative_path) && cx.file_exists(&cx.to_uri(relative_path))
}

/// `doesFileExceedThreshold(context, relativePath, thresholdInBytes)`: `[fileSize > threshold,
/// fileSize]`.
pub fn does_file_exceed_threshold(
    cx: &Context,
    relative_path: &str,
    threshold: &Value,
) -> (bool, usize) {
    if !is_in_theme_directory(cx, relative_path) {
        return (false, 0);
    }
    let size = cx.file_size(&cx.to_uri(relative_path));
    (size as f64 > js::to_number(threshold), size)
}

/// `hasLocalAssetSizeExceededThreshold(context, relativePath, thresholdInBytes)`
pub fn has_local_asset_size_exceeded_threshold(
    cx: &Context,
    relative_path: &str,
    threshold: &Value,
) -> bool {
    does_file_exist(cx, relative_path) && does_file_exceed_threshold(cx, relative_path, threshold).0
}

const REMOTE_SIZE_DEP: &str = "remoteFileSize";

/// `hasRemoteAssetSizeExceededThreshold(context, url, thresholdInBytes)`: a check asks for the size
/// of a remote asset only at a URL that `remote_asset_host` allows.
pub fn has_remote_asset_size_exceeded_threshold(
    cx: &Context,
    url: &str,
    threshold: &Value,
) -> Result<bool, CheckError> {
    if remote_asset_host(url).is_none() {
        return Ok(false);
    }
    Ok(remote_file_size(cx, url)? > js::to_number(threshold))
}

/// `context.remoteFileSize(url)`: the injected dependency, else `getFileSize(url)`. A mocked one
/// answers 0 for a URL it has no answer for.
fn remote_file_size(cx: &Context, url: &str) -> Result<f64, CheckError> {
    if cx.deps.is_mocked(REMOTE_SIZE_DEP) {
        return match cx.deps.recorded(REMOTE_SIZE_DEP, None, &json!([url])) {
            Some(Ok(v)) => Ok(js::to_number(v)),
            Some(Err(e)) => Err(CheckError::new(e.clone())),
            None => Ok(0.0),
        };
    }
    Ok(get_file_size(url))
}

/// The URL that node-fetch requests for `url`, through cross-fetch: a protocol-relative URL over
/// https. node-fetch: `/^[a-zA-Z][a-zA-Z\d+\-.]*:/` picks `new URL`, else legacy `url.parse`, which
/// first trims C0 controls, spaces, U+00A0 and U+FEFF.
fn node_fetch_url(url: &str) -> String {
    let url = match url.strip_prefix("//") {
        Some(_) => format!("https:{url}"),
        None => url.to_string(),
    };
    let scheme_end =
        url.find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.')));
    let has_scheme = url.starts_with(|c: char| c.is_ascii_alphabetic())
        && scheme_end.is_some_and(|i| url[i..].starts_with(':'));
    if has_scheme {
        url
    } else {
        url.trim_matches(|c: char| c <= ' ' || c == '\u{a0}' || c == '\u{feff}')
            .to_string()
    }
}

/// The host of a URL that may be requested.
#[derive(Debug, PartialEq)]
enum Host {
    Ip(IpAddr),
    Name(String),
}

/// `toRemoteAssetUrl(url)`: the host to request for the size of a remote asset, or `None` when no
/// request may go to it. Theme authors write these URLs, and a service can lint themes that it
/// doesn't trust. So the URL must be http(s) with no user name or password, and its host must not
/// be `localhost` or an IP address that isn't public (`is_public_ip`). A name can still resolve to
/// such an address: `get_file_size` checks the addresses it connects to.
/// ponytail: hosts go through `url_hostname`, so a non-ASCII host is refused rather than
/// IDNA-mapped.
fn remote_asset_host(url: &str) -> Option<Host> {
    let url = node_fetch_url(url);
    let url: String = url
        .trim_matches(|c: char| c <= ' ')
        .chars()
        .filter(|c| !matches!(c, '\t' | '\n' | '\r'))
        .collect();
    let (scheme, rest) = url.split_once(':')?;
    if !matches!(scheme.to_ascii_lowercase().as_str(), "http" | "https") {
        return None;
    }
    let authority = rest.trim_start_matches(['/', '\\']);
    let authority = &authority[..authority
        .find(['/', '\\', '?', '#'])
        .unwrap_or(authority.len())];
    let host_port = match authority.rsplit_once('@') {
        // `URL`'s username and password: the user name ends at the first `:`.
        Some(("" | ":", host_port)) => host_port,
        Some(_) => return None,
        None => authority,
    };
    if let Some(bracketed) = host_port.strip_prefix('[') {
        let (address, port) = bracketed.split_once(']')?;
        let port = match port {
            "" => "",
            port => port.strip_prefix(':')?,
        };
        if !port.bytes().all(|b| b.is_ascii_digit()) || port.parse::<u32>().is_ok_and(|p| p > 65535)
        {
            return None;
        }
        let ip = IpAddr::V6(address.parse::<Ipv6Addr>().ok()?);
        return is_public_ip(ip).then_some(Host::Ip(ip));
    }
    let host = super::remote_asset::url_hostname(&url)?;
    match whatwg_ipv4(&host) {
        Some(Some(v4)) => is_public_ip(IpAddr::V4(v4)).then_some(Host::Ip(IpAddr::V4(v4))),
        Some(None) => None,
        None => {
            let name = host.trim_end_matches('.');
            (name != "localhost" && !name.ends_with(".localhost")).then_some(Host::Name(host))
        }
    }
}

/// The WHATWG IPv4 parser, for a host that ends in a number: `Some(None)` when it isn't a valid
/// address, which makes the URL invalid. `None` for a host that is a name.
fn whatwg_ipv4(host: &str) -> Option<Option<Ipv4Addr>> {
    let mut parts: Vec<&str> = host.split('.').collect();
    if parts.len() > 1 && parts.last() == Some(&"") {
        parts.pop();
    }
    let last = parts.last()?;
    let ends_in_a_number = (!last.is_empty() && last.bytes().all(|b| b.is_ascii_digit()))
        || ipv4_number(last).is_some();
    if !ends_in_a_number {
        return None;
    }
    if parts.len() > 4 {
        return Some(None);
    }
    let Some(numbers) = parts
        .iter()
        .map(|p| ipv4_number(p))
        .collect::<Option<Vec<u64>>>()
    else {
        return Some(None);
    };
    let (last, init) = numbers.split_last()?;
    if init.iter().any(|&n| n > 255) || *last >= 256u64.pow(5 - numbers.len() as u32) {
        return Some(None);
    }
    let address = init
        .iter()
        .enumerate()
        .fold(*last, |sum, (i, &n)| sum + n * 256u64.pow(3 - i as u32));
    Some(Some(Ipv4Addr::from(address as u32)))
}

/// The WHATWG IPv4 number parser: decimal, `0x` hexadecimal, or `0` octal.
fn ipv4_number(part: &str) -> Option<u64> {
    if part.is_empty() {
        return None;
    }
    let (digits, radix) = if let Some(hex) = part.strip_prefix("0x").or(part.strip_prefix("0X")) {
        (hex, 16)
    } else if part.len() > 1 && part.starts_with('0') {
        (&part[1..], 8)
    } else {
        (part, 10)
    };
    if digits.is_empty() {
        return Some(0);
    }
    if !digits.chars().all(|c| c.is_digit(radix)) {
        return None;
    }
    // Any number too large for an address is as invalid as an address.
    Some(u64::from_str_radix(digits, radix).unwrap_or(u64::MAX))
}

/// IPv4 ranges that aren't public: IANA's special-purpose addresses that aren't global.
const NON_PUBLIC_IPV4: &[(Ipv4Addr, u32)] = &[
    (Ipv4Addr::new(0, 0, 0, 0), 8),       // "this network"
    (Ipv4Addr::new(10, 0, 0, 0), 8),      // private
    (Ipv4Addr::new(100, 64, 0, 0), 10),   // shared address space (carrier-grade NAT)
    (Ipv4Addr::new(127, 0, 0, 0), 8),     // loopback
    (Ipv4Addr::new(169, 254, 0, 0), 16),  // link-local, where cloud metadata services are
    (Ipv4Addr::new(172, 16, 0, 0), 12),   // private
    (Ipv4Addr::new(192, 0, 0, 0), 24),    // IETF protocol assignments
    (Ipv4Addr::new(192, 0, 2, 0), 24),    // documentation
    (Ipv4Addr::new(192, 168, 0, 0), 16),  // private
    (Ipv4Addr::new(198, 18, 0, 0), 15),   // benchmarking
    (Ipv4Addr::new(198, 51, 100, 0), 24), // documentation
    (Ipv4Addr::new(203, 0, 113, 0), 24),  // documentation
    (Ipv4Addr::new(224, 0, 0, 0), 4),     // multicast
    (Ipv4Addr::new(240, 0, 0, 0), 4),     // reserved, and the broadcast address
];

/// IPv6 ranges that are public only when the IPv4 address in their last 32 bits is.
const IPV4_IN_IPV6: &[(Ipv6Addr, u32)] = &[
    (Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0, 0), 96), // IPv4-mapped
    (Ipv6Addr::new(0x64, 0xff9b, 0, 0, 0, 0, 0, 0), 96), // NAT64
];

/// IPv6 ranges that aren't public.
const NON_PUBLIC_IPV6: &[(Ipv6Addr, u32)] = &[
    (Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0), 96), // unspecified, loopback and IPv4-compatible
    (Ipv6Addr::new(0x64, 0xff9b, 1, 0, 0, 0, 0, 0), 48), // NAT64 for local use
    (Ipv6Addr::new(0x100, 0, 0, 0, 0, 0, 0, 0), 64), // discard
    (Ipv6Addr::new(0x2001, 0, 0, 0, 0, 0, 0, 0), 23), // IETF protocol assignments, Teredo included
    (Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 0), 32), // documentation
    (Ipv6Addr::new(0x2002, 0, 0, 0, 0, 0, 0, 0), 16), // 6to4
    (Ipv6Addr::new(0xfc00, 0, 0, 0, 0, 0, 0, 0), 7), // unique local
    (Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 0), 10), // link-local
    (Ipv6Addr::new(0xfec0, 0, 0, 0, 0, 0, 0, 0), 10), // site-local
    (Ipv6Addr::new(0xff00, 0, 0, 0, 0, 0, 0, 0), 8), // multicast
];

/// `isPublicIpAddress(address)`
fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => !NON_PUBLIC_IPV4.iter().any(|&(base, prefix)| {
            u32::from(v4) >> (32 - prefix) == u32::from(base) >> (32 - prefix)
        }),
        IpAddr::V6(v6) => {
            let in_range = |&(base, prefix): &(Ipv6Addr, u32)| {
                u128::from(v6) >> (128 - prefix) == u128::from(base) >> (128 - prefix)
            };
            if IPV4_IN_IPV6.iter().any(in_range) {
                let [.., a, b, c, d] = v6.octets();
                return is_public_ip(IpAddr::V4(Ipv4Addr::new(a, b, c, d)));
            }
            !NON_PUBLIC_IPV6.iter().any(in_range)
        }
    }
}

/// The address to connect to for `host`: the address itself, or the first address that a name
/// resolves to. `None` when the name resolves to no address, or to any address that isn't public.
fn connect_address(host: &Host) -> Option<IpAddr> {
    let name = match host {
        Host::Ip(ip) => return Some(*ip),
        Host::Name(name) => name,
    };
    let addresses: Vec<IpAddr> = (name.as_str(), 0)
        .to_socket_addrs()
        .ok()?
        .map(|a| a.ip())
        .collect();
    if addresses.iter().all(|&ip| is_public_ip(ip)) {
        addresses.first().copied()
    } else {
        None
    }
}

/// `getFileSize(url)`: `fetch(url, { method: 'HEAD', redirect: 'manual' })` (cross-fetch, i.e.
/// node-fetch 2), then `parseFloat(Content-Length)`; 0 when the header is missing, the status isn't
/// ok (a redirect included), or anything throws. Only a URL that `remote_asset_host` allows is
/// requested, and only at an address that `connect_address` checked. Same request as node-fetch:
/// HTTP/1.1, its default headers, no proxy, no timeout.
/// ponytail: shells out to curl rather than adding an HTTP client crate. node-fetch's URL handling
/// is approximated: a URL with a scheme must parse as a WHATWG URL, one without goes through
/// legacy `url.parse`'s trimming only, and curl gets `serialize_for_curl(url)` rather than the
/// full WHATWG serialization (no IDNA, see `url_hostname`).
pub fn get_file_size(url: &str) -> f64 {
    let Some(address) = remote_asset_host(url).and_then(|host| connect_address(&host)) else {
        return 0.0;
    };
    head_content_length(&serialize_for_curl(&node_fetch_url(url)), address)
}

/// node-fetch's `HEAD` request to `url`, with curl connected to `address`, whatever host curl
/// reads in the URL. It doesn't follow redirects.
fn head_content_length(url: &str, address: IpAddr) -> f64 {
    let connect_to = match address {
        IpAddr::V4(v4) => format!("::{v4}:"),
        IpAddr::V6(v6) => format!("::[{v6}]:"),
    };
    let Ok(out) = std::process::Command::new("curl")
        .args([
            "-q",
            "-s",
            "-o",
            "/dev/null",
            "-I",
            "--http1.1",
            "--globoff",
            "--noproxy",
            "*",
            "--connect-to",
            &connect_to,
        ])
        .args([
            "-A",
            "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
        ])
        .args([
            "-H",
            "Accept-Encoding: gzip,deflate",
            "-H",
            "Connection: close",
        ])
        .args(["-w", "%{http_code}\n%{header_json}", "--url", url])
        .output()
    else {
        return 0.0;
    };
    if !out.status.success() {
        return 0.0;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let (status, headers) = text.split_once('\n').unwrap_or((&text, ""));
    if !status.parse::<u16>().is_ok_and(|s| (200..300).contains(&s)) {
        return 0.0;
    }
    // `headers.get('Content-Length')`: repeated headers are joined with ", ".
    let headers: Value = serde_json::from_str(headers).unwrap_or(Value::Null);
    match headers.get("content-length").and_then(Value::as_array) {
        Some(values) => js::parse_float(
            &values
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(", "),
        ),
        None => 0.0,
    }
}

/// Enough of the WHATWG URL serializer for curl, which rejects spaces and controls: strip leading
/// and trailing C0 controls and spaces, drop tabs and newlines, and percent-encode the remaining
/// controls, spaces, `"<>` and non-ASCII bytes.
fn serialize_for_curl(url: &str) -> String {
    let mut out = String::with_capacity(url.len());
    for b in url
        .trim_matches(|c: char| c <= ' ')
        .bytes()
        .filter(|b| !matches!(b, b'\t' | b'\n' | b'\r'))
    {
        if b <= b' ' || b >= 0x7f || matches!(b, b'"' | b'<' | b'>') {
            out.push_str(&format!("%{b:02X}"));
        } else {
            out.push(b as char);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curl_urls() {
        assert_eq!(
            serialize_for_curl(" https://a.com/a b?c\t\"d\"é \n"),
            "https://a.com/a%20b?c%22d%22%C3%A9"
        );
        // Not http(s), or not a URL: no request.
        assert_eq!(get_file_size("ftp://a.com/x"), 0.0);
        assert_eq!(get_file_size("not a url // at all"), 0.0);
        assert_eq!(get_file_size("https://{{ settings.url }}"), 0.0);
    }

    #[test]
    fn remote_asset_hosts() {
        let name = |s: &str| Some(Host::Name(s.into()));
        let ip = |s: &str| Some(Host::Ip(s.parse().unwrap()));
        for (url, host) in [
            ("https://cdn.example.com/theme.css", name("cdn.example.com")),
            (
                "http://cdn.example.com:8080/theme.css?v=1",
                name("cdn.example.com"),
            ),
            ("//cdn.example.com/theme.css", name("cdn.example.com")),
            ("HTTPS://CDN.Example.com/theme.css", name("cdn.example.com")),
            ("https://8.8.8.8/theme.css", ip("8.8.8.8")),
            ("https://[2606:4700::1111]/theme.css", ip("2606:4700::1111")),
            ("https://[::ffff:8.8.8.8]/theme.css", ip("::ffff:8.8.8.8")),
            (
                "https://localhost.example.com/theme.css",
                name("localhost.example.com"),
            ),
        ] {
            assert_eq!(remote_asset_host(url), host, "{url}");
        }
        for url in [
            "http://127.0.0.1/theme.css",
            "http://0x7f.1/theme.css",
            "http://2130706433/theme.css",
            "http://0177.0.0.1/theme.css",
            "http://127.0.0.1./theme.css",
            "http://localhost:3000/theme.css",
            "http://LOCALHOST./theme.css",
            "http://app.localhost/theme.css",
            "//127.0.0.1/theme.css",
            "http://169.254.169.254/latest/meta-data/",
            "https://10.0.0.1/theme.css",
            "https://172.31.255.255/theme.css",
            "https://192.168.1.1/theme.css",
            "https://100.64.0.1/theme.css",
            "http://0.0.0.0/theme.css",
            "http://255.255.255.255/theme.css",
            "http://[::1]/theme.css",
            "http://[::]/theme.css",
            "http://[::ffff:127.0.0.1]/theme.css",
            "http://[::ffff:a9fe:a9fe]/theme.css",
            "http://[64:ff9b::10.0.0.1]/theme.css",
            "http://[fd00::1]/theme.css",
            "http://[fe80::1]/theme.css",
            "https://user:password@cdn.example.com/theme.css",
            "https://user@cdn.example.com/theme.css",
            "file:///etc/passwd",
            "ftp://cdn.example.com/theme.css",
            "/assets//theme.css",
            "https://{{ settings.cdn }}/theme.css",
            // Ends in a number, but isn't an address: not a URL.
            "http://1.2.3.4.5/theme.css",
            "http://256.0.0.1/theme.css",
        ] {
            assert_eq!(remote_asset_host(url), None, "{url}");
        }
    }

    #[test]
    fn public_ips() {
        for address in [
            "1.1.1.1",
            "8.8.8.8",
            "23.0.0.1",
            "100.63.255.255",
            "100.128.0.0",
            "172.15.255.255",
            "172.32.0.0",
            "192.0.1.1",
            "223.255.255.255",
            "2606:4700:4700::1111",
            "2a00:1450:4001:830::200e",
            "::ffff:8.8.8.8",
            "64:ff9b::808:808",
        ] {
            assert!(is_public_ip(address.parse().unwrap()), "{address}");
        }
        for address in [
            "0.0.0.0",
            "10.255.255.255",
            "100.64.0.0",
            "100.127.255.255",
            "127.0.0.1",
            "127.255.255.255",
            "169.254.169.254",
            "172.16.0.0",
            "192.0.0.192",
            "192.0.2.1",
            "192.168.0.1",
            "198.18.0.1",
            "198.51.100.1",
            "203.0.113.1",
            "224.0.0.1",
            "240.0.0.1",
            "255.255.255.255",
            "::",
            "::1",
            "::127.0.0.1",
            "::ffff:127.0.0.1",
            "::ffff:7f00:1",
            "::ffff:169.254.169.254",
            "64:ff9b::7f00:1",
            "64:ff9b:1::1",
            "100::1",
            "2001::1",
            "2001:db8::1",
            "2002:7f00:1::1",
            "fc00::1",
            "fdff:ffff::1",
            "fe80::1",
            "fec0::1",
            "ff02::1",
        ] {
            assert!(!is_public_ip(address.parse().unwrap()), "{address}");
        }
    }

    const SIZE: &str = "123456";

    /// A server on 127.0.0.1 that answers `/redirect` with a redirect to `/asset.css` on itself,
    /// and any other path with a `Content-Length` of `SIZE`. It records the paths it is asked for.
    fn server() -> (u16, std::sync::Arc<std::sync::Mutex<Vec<String>>>) {
        use std::io::{BufRead, BufReader, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let requests = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let recorded = requests.clone();
        std::thread::spawn(move || {
            for mut stream in listener.incoming().flatten() {
                let mut lines = BufReader::new(stream.try_clone().unwrap()).lines();
                let path = lines.next().and_then(Result::ok).unwrap_or_default();
                let path = path.split(' ').nth(1).unwrap_or_default().to_string();
                while lines
                    .next()
                    .and_then(Result::ok)
                    .is_some_and(|l| !l.is_empty())
                {}
                let response = if path == "/redirect" {
                    format!("HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:{port}/asset.css\r\nContent-Length: 0\r\n\r\n")
                } else {
                    format!("HTTP/1.1 200 OK\r\nContent-Length: {SIZE}\r\n\r\n")
                };
                recorded.lock().unwrap().push(path);
                let _ = stream.write_all(response.as_bytes());
            }
        });
        (port, requests)
    }

    #[test]
    fn requests_no_local_address() {
        let (port, requests) = server();
        for url in [
            format!("http://127.0.0.1:{port}/asset.css"),
            format!("http://0x7f000001:{port}/asset.css"),
            format!("http://localhost:{port}/asset.css"),
            format!("http://127.0.0.1:{port}/redirect"),
        ] {
            assert_eq!(get_file_size(&url), 0.0, "{url}");
        }
        assert_eq!(*requests.lock().unwrap(), Vec::<String>::new());
    }

    #[test]
    fn connects_to_the_checked_address_and_follows_no_redirect() {
        let (port, requests) = server();
        let loopback = IpAddr::V4(Ipv4Addr::LOCALHOST);
        let url = |path: &str| format!("http://assets.example.test:{port}{path}");

        assert_eq!(head_content_length(&url("/asset.css"), loopback), 123456.0);
        assert_eq!(head_content_length(&url("/redirect"), loopback), 0.0);
        assert_eq!(*requests.lock().unwrap(), ["/asset.css", "/redirect"]);
    }
}
