//! `utils/file-utils.ts`

use crate::context::{CheckError, Context};
use crate::js;
use serde_json::{json, Value};

/// `doesFileExist(context, relativePath)`
pub fn does_file_exist(cx: &Context, relative_path: &str) -> bool {
    cx.file_exists(&cx.to_uri(relative_path))
}

/// `doesFileExceedThreshold(context, relativePath, thresholdInBytes)`: `[fileSize > threshold,
/// fileSize]`.
pub fn does_file_exceed_threshold(
    cx: &Context,
    relative_path: &str,
    threshold: &Value,
) -> (bool, usize) {
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

/// `hasRemoteAssetSizeExceededThreshold(context, url, thresholdInBytes)`
pub fn has_remote_asset_size_exceeded_threshold(
    cx: &Context,
    url: &str,
    threshold: &Value,
) -> Result<bool, CheckError> {
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

/// `getFileSize(url)`: `fetch(url, { method: 'HEAD' })` (cross-fetch, i.e. node-fetch 2), then
/// `parseFloat(Content-Length)`; 0 when the header is missing, the status isn't ok, or anything
/// throws. Same request as node-fetch: HTTP/1.1, its default headers, up to 20 redirects, no proxy,
/// no timeout.
/// ponytail: shells out to curl rather than adding an HTTP client crate. node-fetch's URL handling
/// is approximated: a URL with a scheme must parse as a WHATWG URL, one without goes through
/// legacy `url.parse`'s trimming only, and curl gets `serialize_for_curl(url)` rather than the
/// full WHATWG serialization (no IDNA, see `url_hostname`).
pub fn get_file_size(url: &str) -> f64 {
    let url = match url.strip_prefix("//") {
        Some(_) => format!("https:{url}"),
        None => url.to_string(),
    };
    // node-fetch: `/^[a-zA-Z][a-zA-Z\d+\-.]*:/` picks `new URL`, else legacy `url.parse`, which
    // first trims C0 controls, spaces, U+00A0 and U+FEFF.
    let scheme_end =
        url.find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.')));
    let has_scheme = url.starts_with(|c: char| c.is_ascii_alphabetic())
        && scheme_end.is_some_and(|i| url[i..].starts_with(':'));
    let url = if has_scheme {
        url
    } else {
        url.trim_matches(|c: char| c <= ' ' || c == '\u{a0}' || c == '\u{feff}')
            .to_string()
    };
    let scheme = url.split_once(':').map(|(s, _)| s.to_ascii_lowercase());
    let is_http = matches!(scheme.as_deref(), Some("http" | "https"));
    if !is_http || super::remote_asset::url_hostname(&url).is_none() {
        return 0.0;
    }
    let url = serialize_for_curl(&url);
    let Ok(out) = std::process::Command::new("curl")
        .args([
            "-q",
            "-s",
            "-o",
            "/dev/null",
            "-I",
            "-L",
            "--max-redirs",
            "20",
            "--http1.1",
            "--globoff",
            "--noproxy",
            "*",
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
        .args(["-w", "%{http_code}\n%{header_json}", "--url", &url])
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
}
