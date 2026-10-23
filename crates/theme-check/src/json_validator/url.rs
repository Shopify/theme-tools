//! `new URL(input, base).toString()` (the WHATWG basic URL parser) for `$ref` and `$schema`
//! resolution, plus `encodeURIComponent`. ponytail: hosts are lowercased ASCII only (no IDNA, no
//! IPv4 number normalization, IPv6 kept verbatim) and Windows drive letters in `file:` paths get
//! no special casing.

struct Url {
    scheme: String,
    user: String,
    pass: String,
    host: Option<String>,
    port: Option<u16>,
    /// `None`: an opaque path (`urn:x`), kept in `opaque`.
    path: Option<Vec<String>>,
    opaque: String,
    query: Option<String>,
    fragment: Option<String>,
}

fn special_port(scheme: &str) -> Option<Option<u16>> {
    Some(match scheme {
        "http" | "ws" => Some(80),
        "https" | "wss" => Some(443),
        "ftp" => Some(21),
        "file" => None,
        _ => return None,
    })
}

const C0: fn(char) -> bool = |c| c < ' ' || c > '~';
fn fragment_set(c: char) -> bool {
    C0(c) || matches!(c, ' ' | '"' | '<' | '>' | '`')
}
fn query_set(c: char) -> bool {
    C0(c) || matches!(c, ' ' | '"' | '#' | '<' | '>')
}
fn path_set(c: char) -> bool {
    query_set(c) || matches!(c, '?' | '^' | '`' | '{' | '}')
}
fn userinfo_set(c: char) -> bool {
    path_set(c) || matches!(c, '/' | ':' | ';' | '=' | '@' | '[' | '\\' | ']' | '|')
}

fn encode(s: &str, set: fn(char) -> bool, out: &mut String) {
    for c in s.chars() {
        if set(c) {
            for b in c.encode_utf8(&mut [0; 4]).bytes() {
                out.push_str(&format!("%{b:02X}"));
            }
        } else {
            out.push(c);
        }
    }
}

fn encoded(s: &str, set: fn(char) -> bool) -> String {
    let mut out = String::new();
    encode(s, set, &mut out);
    out
}

/// JS `encodeURIComponent`.
pub fn encode_uri_component(s: &str) -> String {
    encoded(s, |c| {
        !(c.is_ascii_alphanumeric() || "-_.!~*'()".contains(c))
    })
}

/// JS `decodeURIComponent`; `None` where it throws `URIError: URI malformed` (a bad escape or
/// escapes that aren't UTF-8).
pub fn decode_uri_component(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let hex = b
                .get(i + 1..i + 3)
                .filter(|h| h.iter().all(u8::is_ascii_hexdigit))?;
            out.push(u8::from_str_radix(std::str::from_utf8(hex).ok()?, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

fn percent_decode(s: &str) -> Vec<u8> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        let hex = |j: usize| b.get(j).and_then(|c| (*c as char).to_digit(16));
        match (b[i], hex(i + 1), hex(i + 2)) {
            (b'%', Some(h), Some(l)) => {
                out.push((h * 16 + l) as u8);
                i += 3;
            }
            (c, _, _) => {
                out.push(c);
                i += 1;
            }
        }
    }
    out
}

impl Url {
    fn special(&self) -> bool {
        special_port(&self.scheme).is_some()
    }

    fn is_sep(&self, c: char) -> bool {
        c == '/' || (c == '\\' && self.special())
    }

    fn shorten(&mut self) {
        if let Some(p) = &mut self.path {
            p.pop();
        }
    }

    /// The authority state onwards: `s` starts right after the slashes.
    fn authority(&mut self, s: &str) -> Option<()> {
        let end = s
            .find(|c| matches!(c, '/' | '?' | '#') || (c == '\\' && self.special()))
            .unwrap_or(s.len());
        let (auth, rest) = s.split_at(end);
        let hostport = match auth.rfind('@') {
            Some(i) => {
                let (user, pass) = auth[..i].split_once(':').unwrap_or((&auth[..i], ""));
                self.user = encoded(user, userinfo_set);
                self.pass = encoded(pass, userinfo_set);
                &auth[i + 1..]
            }
            None => auth,
        };
        let bracket_end = hostport.rfind(']').map_or(0, |i| i + 1);
        let (host, port) = match hostport[bracket_end..].rfind(':') {
            Some(i) => (
                &hostport[..bracket_end + i],
                Some(&hostport[bracket_end + i + 1..]),
            ),
            None => (hostport, None),
        };
        if let Some(port) = port.filter(|p| !p.is_empty()) {
            if !port.bytes().all(|b| b.is_ascii_digit()) {
                return None;
            }
            let n: u32 = port.trim_start_matches('0').parse().unwrap_or(0);
            if n > 65535 {
                return None;
            }
            self.port = (special_port(&self.scheme) != Some(Some(n as u16))).then_some(n as u16);
        }
        self.host = Some(self.parse_host(host)?);
        if self.special() && self.scheme != "file" && self.host.as_deref() == Some("") {
            return None;
        }
        self.path_start(rest)
    }

    fn parse_host(&self, host: &str) -> Option<String> {
        let forbidden = |c: char| "\0\t\n\r #/:<>?@[\\]^|".contains(c);
        if host.starts_with('[') {
            return host.ends_with(']').then(|| host.to_ascii_lowercase());
        }
        if !self.special() {
            return (!host.chars().any(forbidden)).then(|| encoded(host, C0));
        }
        let decoded = String::from_utf8(percent_decode(host)).ok()?;
        if decoded
            .chars()
            .any(|c| forbidden(c) || c < ' ' || c == '%' || c == '\u{7f}')
        {
            return None;
        }
        let lower = decoded.to_ascii_lowercase();
        Some(if self.scheme == "file" && lower == "localhost" {
            String::new()
        } else {
            lower
        })
    }

    /// The path start state: `s` may start with a separator, which is skipped.
    fn path_start(&mut self, s: &str) -> Option<()> {
        self.path = Some(Vec::new());
        let s = match s.chars().next() {
            Some(c) if self.is_sep(c) => &s[1..],
            Some('?' | '#') if !self.special() => return self.query(s),
            None if !self.special() => return Some(()),
            _ => s,
        };
        self.path_state(s)
    }

    /// The path state, appending `s`'s segments to the current path.
    fn path_state(&mut self, s: &str) -> Option<()> {
        let end = s.find(['?', '#']).unwrap_or(s.len());
        let (p, rest) = s.split_at(end);
        let special = self.special();
        let segs: Vec<&str> = p.split(|c| c == '/' || (c == '\\' && special)).collect();
        let last = segs.len() - 1;
        for (i, seg) in segs.into_iter().enumerate() {
            let buf = encoded(seg, path_set);
            let lower = buf.to_ascii_lowercase();
            if matches!(lower.as_str(), ".." | ".%2e" | "%2e." | "%2e%2e") {
                self.shorten();
                if i == last {
                    self.path.as_mut()?.push(String::new());
                }
            } else if matches!(lower.as_str(), "." | "%2e") {
                if i == last {
                    self.path.as_mut()?.push(String::new());
                }
            } else {
                self.path.as_mut()?.push(buf);
            }
        }
        self.query(rest)
    }

    /// `s` is empty or starts with `?` or `#`.
    fn query(&mut self, s: &str) -> Option<()> {
        let (q, f) = match s.find('#') {
            Some(i) => (&s[..i], Some(&s[i + 1..])),
            None => (s, None),
        };
        if let Some(q) = q.strip_prefix('?') {
            let special = self.special();
            self.query = Some(encoded(
                q,
                if special {
                    |c| query_set(c) || c == '\''
                } else {
                    query_set
                },
            ));
        }
        if let Some(f) = f {
            self.fragment = Some(encoded(f, fragment_set));
        }
        Some(())
    }

    fn from_base(base: &Url) -> Url {
        Url {
            scheme: base.scheme.clone(),
            user: base.user.clone(),
            pass: base.pass.clone(),
            host: base.host.clone(),
            port: base.port,
            path: base.path.clone(),
            opaque: base.opaque.clone(),
            query: base.query.clone(),
            fragment: None,
        }
    }

    /// The relative state (and the file state, which differs only in ponytailed ways).
    fn relative(s: &str, base: &Url) -> Option<Url> {
        let mut url = Url::from_base(base);
        let mut cs = s.chars();
        match cs.next() {
            None => {}
            Some(c) if url.is_sep(c) => {
                let next = cs.next();
                if next.is_some_and(|n| url.is_sep(n)) && url.scheme != "file" {
                    url.user.clear();
                    url.pass.clear();
                    url.port = None;
                    url.query = None;
                    let rest = &s[2..];
                    url.authority(if url.special() {
                        rest.trim_start_matches(['/', '\\'])
                    } else {
                        rest
                    })?;
                } else if next.is_some_and(|n| url.is_sep(n)) {
                    // file host state
                    let rest = &s[2..];
                    let end = rest.find(['/', '\\', '?', '#']).unwrap_or(rest.len());
                    url.host = Some(url.parse_host(&rest[..end])?);
                    url.query = None;
                    url.path_start(&rest[end..])?;
                } else {
                    url.query = None;
                    url.path = Some(Vec::new());
                    url.path_state(&s[1..])?;
                }
            }
            Some('?') => {
                url.query = None;
                url.query(s)?;
            }
            Some('#') => url.query(s)?,
            Some(_) => {
                url.query = None;
                url.shorten();
                url.path_state(s)?;
            }
        }
        Some(url)
    }

    fn parse(input: &str, base: Option<&Url>) -> Option<Url> {
        let input: String = input
            .trim_matches(|c| c <= ' ')
            .chars()
            .filter(|c| !matches!(c, '\t' | '\n' | '\r'))
            .collect();
        let scheme_end = input
            .find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.')))
            .filter(|&i| {
                i > 0 && input.as_bytes()[0].is_ascii_alphabetic() && input.as_bytes()[i] == b':'
            });
        let Some(i) = scheme_end else {
            let base = base?;
            if base.path.is_none() {
                let mut url = Url::from_base(base);
                return input
                    .starts_with('#')
                    .then(|| url.query(&input))
                    .flatten()
                    .map(|_| url);
            }
            return Url::relative(&input, base);
        };
        let scheme = input[..i].to_ascii_lowercase();
        let rest = &input[i + 1..];
        let mut url = Url {
            scheme,
            user: String::new(),
            pass: String::new(),
            host: None,
            port: None,
            path: Some(Vec::new()),
            opaque: String::new(),
            query: None,
            fragment: None,
        };
        let base = base.filter(|b| b.scheme == url.scheme);
        if url.scheme == "file" {
            url.host = Some(String::new());
            return match base {
                Some(base) => Url::relative(rest, base),
                None if rest.starts_with(['/', '\\']) => Url::relative(rest, &url),
                None => url.path_state(rest).map(|_| url),
            };
        }
        if url.special() {
            if let Some(base) = base.filter(|_| !rest.starts_with("//")) {
                return Url::relative(rest, base);
            }
            url.authority(rest.trim_start_matches(['/', '\\']))?;
        } else if let Some(r) = rest.strip_prefix("//") {
            url.authority(r)?;
        } else if rest.starts_with('/') {
            url.path_state(&rest[1..])?;
        } else {
            let end = rest.find(['?', '#']).unwrap_or(rest.len());
            url.path = None;
            url.opaque = encoded(&rest[..end], C0);
            url.query(&rest[end..])?;
        }
        Some(url)
    }

    fn serialize(&self) -> String {
        let mut out = format!("{}:", self.scheme);
        if let Some(host) = &self.host {
            out.push_str("//");
            if !self.user.is_empty() || !self.pass.is_empty() {
                out.push_str(&self.user);
                if !self.pass.is_empty() {
                    out.push(':');
                    out.push_str(&self.pass);
                }
                out.push('@');
            }
            out.push_str(host);
            if let Some(port) = self.port {
                out.push_str(&format!(":{port}"));
            }
        }
        match &self.path {
            None => out.push_str(&self.opaque),
            Some(path) => {
                if self.host.is_none() && path.len() > 1 && path[0].is_empty() {
                    out.push_str("/.");
                }
                for seg in path {
                    out.push('/');
                    out.push_str(seg);
                }
            }
        }
        if let Some(q) = &self.query {
            out.push('?');
            out.push_str(q);
        }
        if let Some(f) = &self.fragment {
            out.push('#');
            out.push_str(f);
        }
        out
    }
}

/// `new URL(input, base).toString()`; `None` where it throws `TypeError: Invalid URL`.
pub fn resolve(input: &str, base: &str) -> Option<String> {
    let base = Url::parse(base, None)?;
    Some(Url::parse(input, Some(&base))?.serialize())
}

#[cfg(test)]
mod tests {
    #[test]
    fn matches_node() {
        // [input, base, Node's `new URL(input, base).toString()`], from Node 24.
        let cases: &[(&str, &str, Option<&str>)] = &[
            ("./settings.json", "https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/schemas/theme/section.json", Some("https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/schemas/theme/settings.json")),
            ("../a/b.json", "https://x.com/s/t/u.json", Some("https://x.com/s/a/b.json")),
            ("/abs.json", "https://x.com/s/t/u.json", Some("https://x.com/abs.json")),
            ("x y^{}`|.json", "https://x.com/s/", Some("https://x.com/s/x%20y%5E%7B%7D%60|.json")),
            ("é.json", "https://x.com/s/", Some("https://x.com/s/%C3%A9.json")),
            ("?q", "https://x.com/a/b?z#f", Some("https://x.com/a/b?q")),
            ("#f2", "https://x.com/a/b?z#f", Some("https://x.com/a/b?z#f2")),
            ("", "https://x.com/a/b?z#f", Some("https://x.com/a/b?z")),
            ("//h.com/p", "https://x.com/a", Some("https://h.com/p")),
            ("a\\b.json", "https://x.com/s/", Some("https://x.com/s/a/b.json")),
            ("a.json", "schemaservice://combinedSchema/file%3A%2F%2F%2Fx", Some("schemaservice://combinedSchema/a.json")),
            ("a.json", "urn:foo", None),
            ("urn:bar", "https://x.com/", Some("urn:bar")),
            ("x.json", "file:///a/b.json", Some("file:///a/x.json")),
            ("schema.json", "file:///sections/x.liquid", Some("file:///sections/schema.json")),
            ("%2e%2e/x", "https://x.com/a/b/c", Some("https://x.com/a/x")),
            ("./.", "https://x.com/a/b/c", Some("https://x.com/a/b/")),
            ("a.json", "https://X.COM:443/", Some("https://x.com/a.json")),
            ("https:foo", "https://x.com/a/", Some("https://x.com/a/foo")),
            ("http://a b/", "https://x.com", None),
            ("a.json", "foo:/x/y", Some("foo:/x/a.json")),
            ("a.json", "foo://h/x/y", Some("foo://h/x/a.json")),
            ("../../../../x", "foo://h/x/y", Some("foo://h/x")),
            ("../../x", "foo:/x/y", Some("foo:/x")),
            ("a?b c#d e", "https://x.com/", Some("https://x.com/a?b%20c#d%20e")),
            ("a?'", "https://x.com/", Some("https://x.com/a?%27")),
            ("a?'", "foo://x/", Some("foo://x/a?'")),
            (" \t a\nb.json ", "https://x.com/", Some("https://x.com/ab.json")),
            ("a.json", "file:///sections/x.liquid?x#y", Some("file:///sections/a.json")),
            ("x", "No", None),
            ("x", "https://user:pa ss@x.com:8080/a", Some("https://user:pa%20ss@x.com:8080/x")),
            ("x", "http://x.com:80/a", Some("http://x.com/x")),
            ("//X.Com", "https://y/", Some("https://x.com/")),
            ("a%zz.json", "https://x.com/", Some("https://x.com/a%zz.json")),
            ("a#b#c", "https://x.com/", Some("https://x.com/a#b#c")),
            ("\\\\h\\x", "https://x.com/", Some("https://h/x")),
            ("c:/x", "file:///a", Some("c:/x")),
            ("/x", "file://host/a", Some("file://host/x")),
            ("a", "foo:", None),
            ("#x", "urn:foo", Some("urn:foo#x")),
            ("//", "foo://h/x", Some("foo://")),
            ("//h", "foo://a/x", Some("foo://h")),
            ("", "foo://h/x?y#z", Some("foo://h/x?y")),
            ("a.json", "file:///", Some("file:///a.json")),
            (".", "https://x.com/a/b", Some("https://x.com/a/")),
            ("..", "https://x.com/a/b", Some("https://x.com/")),
            ("a/..", "https://x.com/a/b", Some("https://x.com/a/")),
            ("foo:bar", "https://x/", Some("foo:bar")),
            ("x", "http://[::1]/a", Some("http://[::1]/x")),
        ];
        for (input, base, want) in cases {
            assert_eq!(
                super::resolve(input, base).as_deref(),
                *want,
                "{input:?} against {base:?}"
            );
        }
        assert_eq!(
            super::encode_uri_component("file:///a b/é"),
            "file%3A%2F%2F%2Fa%20b%2F%C3%A9"
        );
    }
}
