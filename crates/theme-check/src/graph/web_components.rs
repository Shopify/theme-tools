//! `getWebComponentMap` (getWebComponentMap.ts): `<custom-element>` names defined in
//! `assets/**/*.js` by a `x.define('custom-element', ...)` call.
//!
//! ponytail: a token scan instead of acorn + acorn-walk. Unlike TS it doesn't skip files with
//! syntax errors, reads the regex-vs-division ambiguity after `)` and `}` as division, treats
//! `new x.define(...)` as a call only when parens sit in the callee chain, misses parenthesized
//! callees (`(x.define)('a-b')`), rejects legacy octal escapes and doesn't decode escapes in
//! identifiers. Upgrade path: a real JS parser.

use super::{recursive_read_directory, Range};
use crate::context::FileSystem;
use crate::path;
use std::collections::HashMap;

/// `WebComponentDefinition`: the asset path relative to `assets/`, and the `[define.start,
/// literal.end]` UTF-16 range in it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WebComponentDefinition {
    pub asset_name: String,
    pub range: Range,
}

/// `getWebComponentMap(rootUri, { fs, getSourceCode })`. Later definitions win (TS's file order
/// depends on IO; this goes in directory order).
pub fn get_web_component_map(
    root_uri: &str,
    fs: &dyn FileSystem,
) -> Result<HashMap<String, WebComponentDefinition>, String> {
    let asset_root = path::join(root_uri, &["assets"]);
    let mut map = HashMap::new();
    // theme-tools#1348: a theme without an assets folder defines no web components.
    if fs.stat(&asset_root).is_err() {
        return Ok(map);
    }
    for uri in recursive_read_directory(fs, &asset_root, &|uri| uri.ends_with(".js"))? {
        let source = fs.read_file(&uri)?;
        for (name, range) in find_definitions(&source) {
            map.insert(
                name,
                WebComponentDefinition {
                    asset_name: path::relative(&uri, &asset_root),
                    range,
                },
            );
        }
    }
    Ok(map)
}

/// `wcre.test(name)`: a valid custom element name (`/u`, so `\d` is ASCII and code points are
/// whole chars).
pub fn is_web_component_name(name: &str) -> bool {
    let pcen = |c: char| {
        matches!(c, '-' | '.' | '0'..='9' | '_' | 'a'..='z' | '\u{B7}' | '\u{C0}'..='\u{D6}' | '\u{D8}'..='\u{F6}'
            | '\u{F8}'..='\u{37D}' | '\u{37F}'..='\u{1FFF}' | '\u{200C}'..='\u{200D}' | '\u{203F}'..='\u{2040}'
            | '\u{2070}'..='\u{218F}' | '\u{2C00}'..='\u{2FEF}' | '\u{3001}'..='\u{D7FF}' | '\u{F900}'..='\u{FDCF}'
            | '\u{FDF0}'..='\u{FFFD}')
    };
    let mut chars = name.chars();
    matches!(chars.next(), Some('a'..='z')) && name.contains('-') && chars.all(pcen)
}

#[derive(Debug, PartialEq)]
enum Tok<'s> {
    Ident(&'s str),
    Punct(&'s str),
    /// The decoded value (`None` if it can't match: lone surrogates, octal escapes) and the end.
    Str(Option<String>, usize),
    /// Numbers, regexes, template literals.
    Other,
}

const REGEX_AFTER_KEYWORDS: [&str; 15] = [
    "return",
    "typeof",
    "instanceof",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "throw",
    "case",
    "do",
    "else",
    "yield",
    "await",
    "extends",
];

fn is_ident_char(c: char) -> bool {
    c.is_ascii_alphanumeric()
        || c == '_'
        || c == '$'
        || c == '\\'
        || (!c.is_ascii() && !c.is_whitespace() && c != '\u{feff}')
}

/// Tokens with their start offsets (bytes).
fn tokenize(src: &str) -> Vec<(Tok<'_>, usize)> {
    let b = src.as_bytes();
    let mut toks: Vec<(Tok, usize)> = Vec::new();
    // Open `{` (false) and `${` (true) of template literals.
    let mut braces: Vec<bool> = Vec::new();
    let mut i = 0;
    let regex_ok = |toks: &[(Tok, usize)]| match toks.last() {
        None => true,
        Some((Tok::Punct(p), _)) => !matches!(*p, ")" | "]" | "}"),
        Some((Tok::Ident(w), _)) => REGEX_AFTER_KEYWORDS.contains(w),
        _ => false,
    };
    while i < b.len() {
        let c = src[i..].chars().next().unwrap();
        let start = i;
        if c.is_whitespace() || c == '\u{feff}' {
            i += c.len_utf8();
        } else if src[i..].starts_with("//") {
            i = src[i..]
                .find(['\n', '\r', '\u{2028}', '\u{2029}'])
                .map_or(b.len(), |j| i + j);
        } else if src[i..].starts_with("/*") {
            i = src[i + 2..].find("*/").map_or(b.len(), |j| i + 2 + j + 2);
        } else if c == '\'' || c == '"' {
            let (value, end) = string_literal(src, i);
            i = end;
            toks.push((Tok::Str(value, end), start));
        } else if c == '`' || (c == '}' && braces.last() == Some(&true)) {
            if c == '}' {
                braces.pop();
            }
            // Template chars up to the closing '`' or the next `${`.
            i += 1;
            while i < b.len() && b[i] != b'`' && !(b[i] == b'$' && b.get(i + 1) == Some(&b'{')) {
                i += if b[i] == b'\\' { 2 } else { 1 };
            }
            if i < b.len() && b[i] == b'$' {
                braces.push(true);
                i += 2;
            } else {
                i += 1;
            }
            toks.push((Tok::Other, start));
        } else if c.is_ascii_digit() || (c == '.' && b.get(i + 1).is_some_and(u8::is_ascii_digit)) {
            while i < b.len() && (b[i].is_ascii_alphanumeric() || b[i] == b'_' || b[i] == b'.') {
                i += 1;
                if matches!(b[i - 1], b'e' | b'E')
                    && matches!(b.get(i), Some(b'+' | b'-'))
                    && !src[start..].starts_with("0x")
                {
                    i += 1;
                }
            }
            toks.push((Tok::Other, start));
        } else if is_ident_char(c) || c == '#' {
            i += c.len_utf8();
            while let Some(c) = src[i..].chars().next().filter(|&c| is_ident_char(c)) {
                i += c.len_utf8();
            }
            toks.push((Tok::Ident(&src[start..i]), start));
        } else if c == '/' && regex_ok(&toks) {
            i += 1;
            let mut class = false;
            while i < b.len() && !matches!(b[i], b'\n' | b'\r') && (class || b[i] != b'/') {
                match b[i] {
                    b'\\' => i += 1,
                    b'[' => class = true,
                    b']' => class = false,
                    _ => {}
                }
                i += 1;
            }
            i += 1;
            while i < b.len() && (b[i].is_ascii_alphanumeric() || b[i] == b'_' || b[i] == b'$') {
                i += 1;
            }
            toks.push((Tok::Other, start));
        } else {
            let p = ["?.", "..."].into_iter().find(|p| {
                src[i..].starts_with(p)
                    && !(*p == "?." && b.get(i + 2).is_some_and(u8::is_ascii_digit))
            });
            let p = p.unwrap_or(&src[i..i + c.len_utf8()]);
            match p {
                "{" => braces.push(false),
                "}" => {
                    braces.pop();
                }
                _ => {}
            }
            i += p.len();
            toks.push((Tok::Punct(p), start));
        }
    }
    toks
}

/// The string literal at `start` (its quote): decoded value and end offset.
fn string_literal(src: &str, start: usize) -> (Option<String>, usize) {
    let quote = src.as_bytes()[start] as char;
    let mut units: Vec<u16> = Vec::new();
    let mut ok = true;
    let mut chars = src[start + 1..].char_indices().peekable();
    let hex = |s: &str| u32::from_str_radix(s, 16).ok();
    while let Some((j, c)) = chars.next() {
        let at = start + 1 + j;
        match c {
            c if c == quote => {
                return (
                    ok.then(|| String::from_utf16(&units).ok()).flatten(),
                    at + 1,
                )
            }
            '\n' | '\r' => return (None, at),
            '\\' => {
                let Some((_, e)) = chars.next() else { break };
                let code = match e {
                    'n' => Some(0x0A),
                    't' => Some(0x09),
                    'r' => Some(0x0D),
                    'b' => Some(0x08),
                    'f' => Some(0x0C),
                    'v' => Some(0x0B),
                    '0' if !chars.peek().is_some_and(|(_, d)| d.is_ascii_digit()) => Some(0),
                    // Legacy octal and `\8` `\9`: syntax errors in module code.
                    '0'..='9' => {
                        ok = false;
                        None
                    }
                    'x' => {
                        let s: String = (0..2)
                            .filter_map(|_| chars.next().map(|(_, c)| c))
                            .collect();
                        hex(&s).filter(|_| s.len() == 2)
                    }
                    'u' if chars.peek().is_some_and(|&(_, c)| c == '{') => {
                        chars.next();
                        let mut s = String::new();
                        for (_, c) in chars.by_ref() {
                            if c == '}' {
                                break;
                            }
                            s.push(c);
                        }
                        hex(&s)
                    }
                    'u' => {
                        let s: String = (0..4)
                            .filter_map(|_| chars.next().map(|(_, c)| c))
                            .collect();
                        hex(&s).filter(|_| s.len() == 4)
                    }
                    // Line continuations.
                    '\r' => {
                        if chars.peek().is_some_and(|&(_, c)| c == '\n') {
                            chars.next();
                        }
                        continue;
                    }
                    '\n' | '\u{2028}' | '\u{2029}' => continue,
                    e => {
                        units.extend(e.encode_utf16(&mut [0; 2]).iter());
                        continue;
                    }
                };
                // Surrogate escapes stay units: `from_utf16` pairs them up or rejects lone ones.
                match code {
                    Some(u) if u <= 0xFFFF => units.push(u as u16),
                    Some(u) => match char::from_u32(u) {
                        Some(c) => units.extend(c.encode_utf16(&mut [0; 2]).iter()),
                        None => ok = false,
                    },
                    None => ok = false,
                }
            }
            c => units.extend(c.encode_utf16(&mut [0; 2]).iter()),
        }
    }
    (None, src.len())
}

/// `findWebComponentReferences`' matches, in source order: string literals that are direct
/// arguments (parens allowed, as acorn drops them) of a call whose callee is `<expr>.define`,
/// `<expr>?.define` or `<expr>[define]`.
pub fn find_definitions(src: &str) -> Vec<(String, Range)> {
    let toks = tokenize(src);
    let utf16 = |byte: usize| src[..byte].encode_utf16().count();
    let punct = |k: usize, p: &str| matches!(toks.get(k), Some((Tok::Punct(q), _)) if *q == p);
    let mut out = Vec::new();
    for (d, (tok, define_start)) in toks.iter().enumerate() {
        if *tok != Tok::Ident("define") || d == 0 {
            continue;
        }
        // The member access, and where its object ends.
        let (object_end, mut k) = if punct(d - 1, ".") || punct(d - 1, "?.") {
            (d - 1, d + 1)
        } else if punct(d - 1, "[") && punct(d + 1, "]") {
            (d - 1, d + 2)
        } else {
            continue;
        };
        if object_end == 0
            || matches!(toks[object_end - 1].0, Tok::Punct(p) if !matches!(p, ")" | "]"))
        {
            continue;
        }
        if punct(object_end, "[")
            && matches!(toks[object_end - 1].0, Tok::Ident(w) if REGEX_AFTER_KEYWORDS.contains(&w))
        {
            continue;
        }
        // `new a.b.define(...)` is a NewExpression: walk the plain member chain back to `new`.
        let mut c = object_end;
        while c >= 2
            && matches!(toks[c - 1].0, Tok::Ident(_))
            && (punct(c - 2, ".") || punct(c - 2, "?."))
        {
            c -= 2;
        }
        if c >= 2
            && matches!(toks[c - 1].0, Tok::Ident(_))
            && matches!(toks[c - 2].0, Tok::Ident("new"))
        {
            continue;
        }
        if punct(k, "?.") {
            k += 1;
        }
        if !punct(k, "(") {
            continue;
        }
        // Arguments: token ranges between top-level commas.
        let mut depth = 0;
        let mut arg_start = k + 1;
        let mut j = k;
        while j < toks.len() {
            match toks[j].0 {
                Tok::Punct("(" | "[" | "{") => depth += 1,
                Tok::Punct(")" | "]" | "}") => depth -= 1,
                _ => {}
            }
            let arg_end = (depth == 0 || (depth == 1 && punct(j, ","))).then_some(j);
            if let Some(end) = arg_end {
                let arg = &toks[arg_start..end];
                let parens = arg.iter().take_while(|t| t.0 == Tok::Punct("(")).count();
                if arg.len() == 2 * parens + 1
                    && arg[arg.len() - parens..]
                        .iter()
                        .all(|t| t.0 == Tok::Punct(")"))
                {
                    if let Tok::Str(Some(value), end) = &arg[parens].0 {
                        if is_web_component_name(value) {
                            out.push((value.clone(), (utf16(*define_start), utf16(*end))));
                        }
                    }
                }
                arg_start = j + 1;
            }
            if depth == 0 {
                break;
            }
            j += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_define_calls() {
        let src = r#"
            // customElements.define('in-comment', X);
            const s = "customElements.define('in-string', X)";
            customElements.define('parent-element', ParentElement);
            window.customElements?.define(("child-element"), class extends HTMLElement {});
            if (!customElements.get('x-y')) customElements.define('x-y', Y, { extends: 'div' });
            new Registry.define('new-thing');
            customElements.define(`tpl-${a}`, Z);
            customElements.define('Upper-case', Z);
            customElements.define('café-x', Z);
            customElements.define('no' + '-concat', Z);
            const re = /customElements.define('in-regex')/;
        "#;
        let names: Vec<String> = find_definitions(src).into_iter().map(|(n, _)| n).collect();
        assert_eq!(names, ["parent-element", "child-element", "x-y", "café-x"]);
        let (_, (start, end)) = &find_definitions("customElements.define('a-b', X)")[0];
        assert_eq!((*start, *end), (15, 27));
        assert!(!is_web_component_name("a-\u{1F600}"));
        assert!(is_web_component_name("a.b-c_d"));
    }
}
