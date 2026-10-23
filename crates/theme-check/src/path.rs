//! Port of `path.ts` (vscode-uri 3.0.8 `URI.parse` / `toString(true)` and its posix helpers).

struct Uri {
    scheme: String,
    authority: String,
    path: String,
    query: String,
    fragment: String,
}

/// vscode-uri `percentDecode`: decodes runs of `%XX`, keeping undecodable prefixes as-is.
fn percent_decode(s: &str) -> String {
    if !s.contains('%') {
        return s.to_string();
    }
    let b = s.as_bytes();
    let is_pct = |i: usize| {
        i + 2 < b.len()
            && b[i] == b'%'
            && b[i + 1].is_ascii_alphanumeric()
            && b[i + 2].is_ascii_alphanumeric()
    };
    let mut out = String::new();
    let mut i = 0;
    while i < b.len() {
        if is_pct(i) {
            let start = i;
            while is_pct(i) {
                i += 3;
            }
            out.push_str(&decode_run(&s[start..i]));
        } else {
            let c = s[i..].chars().next().unwrap();
            out.push(c);
            i += c.len_utf8();
        }
    }
    out
}

/// `decodeURIComponent(run)`, retrying after the first 3 chars on failure.
fn decode_run(run: &str) -> String {
    let bytes: Option<Vec<u8>> = run
        .as_bytes()
        .chunks(3)
        .map(|c| u8::from_str_radix(std::str::from_utf8(&c[1..]).ok()?, 16).ok())
        .collect();
    if let Some(s) = bytes.and_then(|b| String::from_utf8(b).ok()) {
        return s;
    }
    if run.len() > 3 {
        format!("{}{}", &run[..3], decode_run(&run[3..]))
    } else {
        run.to_string()
    }
}

/// `URI.parse(value)` (non-strict).
fn parse(s: &str) -> Uri {
    // /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/
    let mut rest = s;
    let mut scheme = "";
    if let Some(i) = rest.find(|c| matches!(c, ':' | '/' | '?' | '#')) {
        if i > 0 && rest.as_bytes()[i] == b':' {
            scheme = &rest[..i];
            rest = &rest[i + 1..];
        }
    }
    let mut authority = "";
    if let Some(r) = rest.strip_prefix("//") {
        let i = r.find(|c| matches!(c, '/' | '?' | '#')).unwrap_or(r.len());
        authority = &r[..i];
        rest = &r[i..];
    }
    let i = rest.find(|c| matches!(c, '?' | '#')).unwrap_or(rest.len());
    let path = &rest[..i];
    rest = &rest[i..];
    let mut query = "";
    if let Some(r) = rest.strip_prefix('?') {
        let i = r.find('#').unwrap_or(r.len());
        query = &r[..i];
        rest = &r[i..];
    }
    let mut fragment = "";
    if let Some(r) = rest.strip_prefix('#') {
        // `.` stops at line terminators.
        fragment = &r[..r
            .find(['\n', '\r', '\u{2028}', '\u{2029}'])
            .unwrap_or(r.len())];
    }
    make(
        scheme.into(),
        percent_decode(authority),
        percent_decode(path),
        percent_decode(query),
        percent_decode(fragment),
    )
}

/// The `URI` constructor's scheme default and path fix-ups.
fn make(
    scheme: String,
    authority: String,
    mut path: String,
    query: String,
    fragment: String,
) -> Uri {
    let scheme = if scheme.is_empty() {
        "file".to_string()
    } else {
        scheme
    };
    if matches!(scheme.as_str(), "https" | "http" | "file") {
        if path.is_empty() {
            path = "/".into();
        } else if !path.starts_with('/') {
            path.insert(0, '/');
        }
    }
    Uri {
        scheme,
        authority,
        path,
        query,
        fragment,
    }
}

/// `encodeURIComponentMinimal`: only '#' and '?'.
fn encode_minimal(s: &str, out: &mut String) {
    for c in s.chars() {
        match c {
            '#' => out.push_str("%23"),
            '?' => out.push_str("%3F"),
            c => out.push(c),
        }
    }
}

/// `uri.toString(true)`.
fn format(u: &Uri) -> String {
    let mut out = String::new();
    out.push_str(&u.scheme);
    out.push(':');
    if !u.authority.is_empty() || u.scheme == "file" {
        out.push_str("//");
    }
    if !u.authority.is_empty() {
        let (userinfo, host) = match u.authority.find('@') {
            Some(i) => (&u.authority[..=i], &u.authority[i + 1..]),
            None => ("", u.authority.as_str()),
        };
        out.push_str(userinfo);
        out.push_str(&host.to_lowercase());
    }
    if !u.path.is_empty() {
        let p = u.path.as_bytes();
        let mut path = u.path.clone();
        if p.len() >= 3 && p[0] == b'/' && p[2] == b':' && p[1].is_ascii_uppercase() {
            path.replace_range(1..2, &(p[1] as char).to_ascii_lowercase().to_string());
        } else if p.len() >= 2 && p[1] == b':' && p[0].is_ascii_uppercase() {
            path.replace_range(0..1, &(p[0] as char).to_ascii_lowercase().to_string());
        }
        encode_minimal(&path, &mut out);
    }
    if !u.query.is_empty() {
        out.push('?');
        encode_minimal(&u.query, &mut out);
    }
    if !u.fragment.is_empty() {
        out.push('#');
        out.push_str(&u.fragment);
    }
    out
}

/// vscode-uri `_validateUri` (non-strict): what makes `URI.parse` throw.
fn is_valid(u: &Uri) -> bool {
    let word = |c: char| c.is_ascii_alphanumeric() || c == '_';
    let mut cs = u.scheme.chars();
    let scheme_ok =
        cs.next().is_some_and(word) && cs.all(|c| word(c) || matches!(c, '+' | '.' | '-'));
    let path_ok = u.path.is_empty()
        || if u.authority.is_empty() {
            !u.path.starts_with("//")
        } else {
            u.path.starts_with('/')
        };
    scheme_ok && path_ok
}

/// jsonSchemaService `normalizeId`: `URI.parse(id).toString(true)`, or `id` when that throws.
pub fn normalize_id(id: &str) -> String {
    let u = parse(id);
    if is_valid(&u) {
        format(&u)
    } else {
        id.to_string()
    }
}

/// jsonSchemaService `normalizeResourceForMatching`: `normalizeId` without query and fragment.
pub fn normalize_resource_for_matching(uri: &str) -> String {
    let mut u = parse(uri);
    if !is_valid(&u) {
        return uri.to_string();
    }
    u.query.clear();
    u.fragment.clear();
    format(&u)
}

/// jsonSchemaService `toDisplayString`: the fs path of a `file` URI, else the URL.
pub fn display_string(url: &str) -> String {
    let u = parse(url);
    if is_valid(&u) && u.scheme == "file" {
        fs_path(url)
    } else {
        url.to_string()
    }
}

/// Node `path.posix.normalize`.
pub(crate) fn posix_normalize(p: &str) -> String {
    if p.is_empty() {
        return ".".into();
    }
    let abs = p.starts_with('/');
    let trailing = p.ends_with('/');
    let mut segs: Vec<&str> = Vec::new();
    for seg in p.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                if segs.last().is_some_and(|s| *s != "..") {
                    segs.pop();
                } else if !abs {
                    segs.push("..");
                }
            }
            s => segs.push(s),
        }
    }
    let mut out = segs.join("/");
    if out.is_empty() && !abs {
        out.push('.');
    }
    if !out.is_empty() && trailing {
        out.push('/');
    }
    if abs {
        out.insert(0, '/');
    }
    out
}

/// Node `path.posix.dirname`.
pub(crate) fn posix_dirname(p: &str) -> &str {
    let b = p.as_bytes();
    if b.is_empty() {
        return ".";
    }
    let has_root = b[0] == b'/';
    let mut end = None;
    let mut matched_slash = true;
    for i in (1..b.len()).rev() {
        if b[i] == b'/' {
            if !matched_slash {
                end = Some(i);
                break;
            }
        } else {
            matched_slash = false;
        }
    }
    match end {
        None if has_root => "/",
        None => ".",
        Some(1) if has_root => "//",
        Some(e) => &p[..e],
    }
}

/// Node `path.posix.basename` (no ext).
fn posix_basename(p: &str) -> &str {
    let t = p.trim_end_matches('/');
    match t.rfind('/') {
        Some(i) => &t[i + 1..],
        None => t,
    }
}

/// `normalize(uri)`.
/// `path.fsPath(uri)` (vscode-uri `uriToFsPath`, posix separators).
pub fn fs_path(uri: &str) -> String {
    let u = parse(uri);
    let p = u.path.as_bytes();
    if !u.authority.is_empty() && p.len() > 1 && u.scheme == "file" {
        format!("//{}{}", u.authority, u.path)
    } else if p.len() >= 3 && p[0] == b'/' && p[1].is_ascii_alphabetic() && p[2] == b':' {
        format!("{}{}", (p[1] as char).to_ascii_lowercase(), &u.path[2..])
    } else {
        u.path
    }
}

/// `normalize(URI.file(absolutePath))` for a posix path.
pub fn file_uri(fs_path: &str) -> String {
    // URI.file: a leading `//` is a UNC authority.
    let (authority, path) = match fs_path.strip_prefix("//") {
        Some(rest) => {
            let i = rest.find('/').unwrap_or(rest.len());
            (
                rest[..i].to_string(),
                if i == rest.len() {
                    "/".to_string()
                } else {
                    rest[i..].to_string()
                },
            )
        }
        None => (String::new(), fs_path.to_string()),
    };
    format(&make(
        "file".into(),
        authority,
        path,
        String::new(),
        String::new(),
    ))
    .replace('\\', "/")
}

pub fn normalize(uri: &str) -> String {
    format(&parse(uri)).replace('\\', "/")
}

/// `join(rootUri, ...paths)`.
pub fn join(root: &str, paths: &[&str]) -> String {
    let u = parse(root);
    let mut joined = String::new();
    for p in std::iter::once(u.path.as_str()).chain(paths.iter().copied()) {
        if p.is_empty() {
            continue;
        }
        if !joined.is_empty() {
            joined.push('/');
        }
        joined.push_str(p);
    }
    let path = if joined.is_empty() {
        ".".into()
    } else {
        posix_normalize(&joined)
    };
    let u = make(u.scheme, u.authority, path, u.query, u.fragment);
    format(&u).replace('\\', "/")
}

/// `relative(uri, rootUri)`.
pub fn relative(uri: &str, root: &str) -> String {
    let n = normalize(uri);
    let replaced = n.replacen(root, "", 1).replace("\\\\", "/");
    replaced.trim_start_matches('/').to_string()
}

/// `dirname(uri)`.
pub fn dirname(uri: &str) -> String {
    let u = parse(uri);
    if u.path.is_empty() || u.path == "/" {
        return format(&u).replace('\\', "/");
    }
    let d = posix_dirname(&u.path);
    let d = if d == "." {
        String::new()
    } else {
        d.to_string()
    };
    format(&make(u.scheme, u.authority, d, u.query, u.fragment)).replace('\\', "/")
}

/// `basename(uri, ext?)`.
pub fn basename(uri: &str, ext: Option<&str>) -> String {
    let u = parse(uri);
    let base = posix_basename(&u.path);
    match ext {
        Some(ext) if !ext.is_empty() => base.strip_suffix(ext).unwrap_or(base).to_string(),
        _ => base.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_vscode_uri() {
        // Expected values from vscode-uri 3.0.8 through path.ts.
        assert_eq!(normalize("file:/"), "file:///");
        assert_eq!(
            normalize("file:///snippets/a%20b.liquid"),
            "file:///snippets/a b.liquid"
        );
        assert_eq!(normalize("file:///a/b#c?d"), "file:///a/b#c?d");
        assert_eq!(normalize("file:///C:/x"), "file:///c:/x");
        assert_eq!(
            join("file:///", &["assets", "foo.js"]),
            "file:///assets/foo.js"
        );
        assert_eq!(
            join("file:///", &["snippets/../x.liquid"]),
            "file:///x.liquid"
        );
        assert_eq!(
            relative("file:///sections/a.liquid", "file:///"),
            "sections/a.liquid"
        );
        assert_eq!(dirname("file:///sections/a.liquid"), "file:///sections");
        assert_eq!(dirname("file:///a.liquid"), "file:///");
        assert_eq!(basename("file:///sections/a.liquid", Some(".liquid")), "a");
        assert_eq!(basename("file:///sections/a.liquid", None), "a.liquid");
        assert_eq!(normalize("file:///a/%zz%41"), "file:///a/%zzA");
        assert_eq!(
            file_uri("/Users/me/a b/#x?.liquid"),
            "file:///Users/me/a b/%23x%3F.liquid"
        );
        assert_eq!(file_uri("//server/share/x"), "file://server/share/x");
        assert_eq!(file_uri("/c:/x"), "file:///c:/x");
        assert_eq!(
            fs_path("file:///Users/me/a%20b/%23x%3F.liquid"),
            "/Users/me/a b/#x?.liquid"
        );
        assert_eq!(fs_path("file://server/share/x"), "//server/share/x");
        assert_eq!(fs_path("file:///C:/x"), "c:/x");
        assert_eq!(fs_path("file:///a/b"), "/a/b");
        assert_eq!(
            normalize_id("http://json-schema.org/draft-07/schema#"),
            "http://json-schema.org/draft-07/schema"
        );
        assert_eq!(
            normalize_id("https://Ex.com/a%20b.json#/x"),
            "https://ex.com/a b.json#/x"
        );
        assert_eq!(normalize_id("file:////x"), "file:////x");
        assert_eq!(normalize_id("a b:c"), "a b:c");
        assert_eq!(normalize_id("x.json"), "file:///x.json");
        assert_eq!(
            normalize_resource_for_matching("file:///a.json?q#f"),
            "file:///a.json"
        );
        assert_eq!(display_string("file:///a/b.json"), "/a/b.json");
        assert_eq!(display_string("https://x/a.json"), "https://x/a.json");
    }
}
