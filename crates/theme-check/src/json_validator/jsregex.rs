//! JS `RegExp` sources on the Rust `regex` crate: `extendedRegExp` (utils/strings.js), glob
//! `createRegex` (utils/glob.js), and the translation both use.

use regex::Regex;

/// A JS pattern compiled for Rust.
#[derive(Clone)]
pub enum JsRegex {
    Re(Regex),
    /// `new RegExp` throws: TS gets `undefined`.
    Invalid,
    /// Valid JS that `regex` can't express (lookaround, backreferences, lone surrogates).
    Unsupported,
}

/// JS `\s` / `\S` contents (WhiteSpace + LineTerminator).
const WS: &str = r"\t\n\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";

/// `extendedRegExp(pattern)`: a leading `(?i)` becomes the `i` flag. TS tries the `u` flag and
/// then falls back to none; this is one permissive translation. ponytail: patterns that differ
/// between `u` and non-`u` mode (astral chars under `.`, `\u{...}` without `u`) follow `u` mode.
pub fn extended_regexp(pattern: &str) -> JsRegex {
    match pattern.strip_prefix("(?i)") {
        Some(rest) => compile(rest, true),
        None => compile(pattern, false),
    }
}

/// `new RegExp(source, i ? 'i' : '')`.
pub fn compile(source: &str, ignore_case: bool) -> JsRegex {
    match translate(source) {
        Err(t) => t,
        Ok(rs) => match Regex::new(&if ignore_case { format!("(?i){rs}") } else { rs }) {
            Ok(re) => JsRegex::Re(re),
            Err(_) => JsRegex::Invalid,
        },
    }
}

fn push_escaped(out: &mut String, c: char) {
    out.push_str(&regex::escape(c.encode_utf8(&mut [0; 4])));
}

fn hex(cs: &[char], i: usize, n: usize) -> Option<u32> {
    let s: String = cs.get(i..i + n)?.iter().collect();
    if s.chars().all(|c| c.is_ascii_hexdigit()) {
        u32::from_str_radix(&s, 16).ok()
    } else {
        None
    }
}

enum Esc {
    /// A class like `[0-9]`, written as a (possibly negated) bracket expression.
    Class(String),
    Char(char),
    /// Emitted verbatim (assertions, `\p{..}`).
    Raw(String),
}

/// The escape at `cs[i]` (just past the backslash). Returns the escape and the next index.
fn escape(cs: &[char], i: usize, in_class: bool) -> Result<(Esc, usize), JsRegex> {
    let Some(&c) = cs.get(i) else {
        return Err(JsRegex::Invalid);
    };
    let class =
        |neg: bool, body: &str| Esc::Class(format!("[{}{body}]", if neg { "^" } else { "" }));
    Ok(match c {
        'd' | 'D' => (class(c == 'D', "0-9"), i + 1),
        'w' | 'W' => (class(c == 'W', "0-9A-Za-z_"), i + 1),
        's' | 'S' => (class(c == 'S', WS), i + 1),
        'b' if in_class => (Esc::Char('\u{8}'), i + 1),
        // ASCII word boundaries, as JS. ponytail: `\B` can't be expressed on str haystacks.
        'b' => (Esc::Raw(r"(?-u:\b)".into()), i + 1),
        'B' => return Err(JsRegex::Unsupported),
        'n' => (Esc::Char('\n'), i + 1),
        'r' => (Esc::Char('\r'), i + 1),
        't' => (Esc::Char('\t'), i + 1),
        'f' => (Esc::Char('\u{c}'), i + 1),
        'v' => (Esc::Char('\u{b}'), i + 1),
        '0' if !cs.get(i + 1).is_some_and(char::is_ascii_digit) => (Esc::Char('\0'), i + 1),
        // Backreferences (and legacy octal escapes).
        '0'..='9' | 'k' => return Err(JsRegex::Unsupported),
        'x' => match hex(cs, i + 1, 2) {
            Some(n) => (Esc::Char(char::from_u32(n).unwrap()), i + 3),
            None => (Esc::Char('x'), i + 1),
        },
        'u' if cs.get(i + 1) == Some(&'{') => {
            let end = cs[i..]
                .iter()
                .position(|&c| c == '}')
                .ok_or(JsRegex::Invalid)?
                + i;
            let n = hex(cs, i + 2, end - i - 2).ok_or(JsRegex::Invalid)?;
            (
                Esc::Char(char::from_u32(n).ok_or(JsRegex::Unsupported)?),
                end + 1,
            )
        }
        'u' => match hex(cs, i + 1, 4) {
            Some(hi @ 0xD800..=0xDBFF) => {
                let lo = (cs.get(i + 5) == Some(&'\\') && cs.get(i + 6) == Some(&'u'))
                    .then(|| hex(cs, i + 7, 4))
                    .flatten();
                match lo {
                    Some(lo @ 0xDC00..=0xDFFF) => (
                        Esc::Char(
                            char::from_u32(0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00))
                                .unwrap(),
                        ),
                        i + 11,
                    ),
                    _ => return Err(JsRegex::Unsupported),
                }
            }
            Some(0xDC00..=0xDFFF) => return Err(JsRegex::Unsupported),
            Some(n) => (Esc::Char(char::from_u32(n).unwrap()), i + 5),
            None => (Esc::Char('u'), i + 1),
        },
        'c' => match cs.get(i + 1) {
            Some(l) if l.is_ascii_alphabetic() => {
                (Esc::Char(char::from_u32(*l as u32 % 32).unwrap()), i + 2)
            }
            _ => (Esc::Char('\\'), i),
        },
        'p' | 'P' if cs.get(i + 1) == Some(&'{') => {
            let end = cs[i..]
                .iter()
                .position(|&c| c == '}')
                .ok_or(JsRegex::Invalid)?
                + i;
            (Esc::Raw(cs[i - 1..=end].iter().collect()), end + 1)
        }
        c => (Esc::Char(c), i + 1),
    })
}

/// JS pattern source → Rust syntax (no flags).
fn translate(src: &str) -> Result<String, JsRegex> {
    let cs: Vec<char> = src.chars().collect();
    let mut out = String::with_capacity(src.len() + 8);
    let mut i = 0;
    while i < cs.len() {
        let c = cs[i];
        match c {
            '\\' => {
                let (e, next) = escape(&cs, i + 1, false)?;
                match e {
                    Esc::Class(s) | Esc::Raw(s) => out.push_str(&s),
                    Esc::Char(c) => push_escaped(&mut out, c),
                }
                i = next;
            }
            '[' => i = class(&cs, i + 1, &mut out)?,
            '(' if cs.get(i + 1) == Some(&'?') => {
                match (cs.get(i + 2), cs.get(i + 3)) {
                    (Some(':'), _) => out.push_str("(?:"),
                    (Some('=' | '!'), _) | (Some('<'), Some('=' | '!')) => {
                        return Err(JsRegex::Unsupported)
                    }
                    (Some('<'), _) => {
                        out.push_str("(?P<");
                        i += 3;
                        continue;
                    }
                    _ => return Err(JsRegex::Invalid),
                }
                i += 3;
            }
            '.' => {
                out.push_str(r"[^\n\r\x{2028}\x{2029}]");
                i += 1;
            }
            '{' => {
                // A quantifier `{n}`, `{n,}`, `{n,m}`; otherwise a literal brace (non-`u` mode).
                let rest: String = cs[i..].iter().take_while(|&&c| c != '}').collect();
                let body = &rest[1..];
                let (a, b) = body.split_once(',').unwrap_or((body, "0"));
                let digits = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit());
                if i + rest.chars().count() < cs.len() && digits(a) && (b.is_empty() || digits(b)) {
                    out.push_str(&rest);
                    out.push('}');
                    i += rest.chars().count() + 1;
                } else {
                    out.push_str(r"\{");
                    i += 1;
                }
            }
            '}' | ']' => {
                out.push('\\');
                out.push(c);
                i += 1;
            }
            _ => {
                out.push(c);
                i += 1;
            }
        }
    }
    Ok(out)
}

/// A JS class body from `cs[i]` (just past `[`), written to `out`. Returns the index past `]`.
fn class(cs: &[char], mut i: usize, out: &mut String) -> Result<usize, JsRegex> {
    let negated = cs.get(i) == Some(&'^');
    if negated {
        i += 1;
    }
    if cs.get(i) == Some(&']') {
        // `[]` matches nothing, `[^]` anything.
        out.push_str(if negated {
            r"[\x{0}-\x{10FFFF}]"
        } else {
            r"[^\x{0}-\x{10FFFF}]"
        });
        return Ok(i + 1);
    }
    out.push('[');
    if negated {
        out.push('^');
    }
    // A class atom: a char (rangeable) or a class escape.
    let atom = |i: usize| -> Result<(Esc, usize), JsRegex> {
        match cs.get(i) {
            None => Err(JsRegex::Invalid),
            Some('\\') => escape(cs, i + 1, true),
            Some(&c) => Ok((Esc::Char(c), i + 1)),
        }
    };
    let push_char = |out: &mut String, c: char| {
        if matches!(c, '[' | ']' | '\\' | '&' | '~' | '-' | '^') {
            out.push('\\');
        }
        out.push(c);
    };
    loop {
        match cs.get(i) {
            None => return Err(JsRegex::Invalid),
            Some(']') => {
                out.push(']');
                return Ok(i + 1);
            }
            _ => {}
        }
        let (a, next) = atom(i)?;
        i = next;
        match a {
            Esc::Class(s) | Esc::Raw(s) => out.push_str(&s),
            Esc::Char(lo) => {
                if cs.get(i) == Some(&'-') && cs.get(i + 1).is_some_and(|&c| c != ']') {
                    let (b, next) = atom(i + 1)?;
                    if let Esc::Char(hi) = b {
                        if hi < lo {
                            return Err(JsRegex::Invalid);
                        }
                        push_char(out, lo);
                        out.push('-');
                        push_char(out, hi);
                        i = next;
                        continue;
                    }
                }
                push_char(out, lo);
            }
        }
    }
}

/// glob.js `createRegex(glob, { extended: true, globstar: true })`, as JS source.
pub fn glob_source(glob: &str) -> String {
    let s: Vec<char> = glob.chars().collect();
    let mut re = String::new();
    let mut in_group = false;
    let mut i = 0;
    while i < s.len() {
        let c = s[i];
        match c {
            '/' | '$' | '^' | '+' | '.' | '(' | ')' | '=' | '!' | '|' => {
                re.push('\\');
                re.push(c);
            }
            '?' => re.push('.'),
            '[' | ']' => re.push(c),
            '{' => {
                in_group = true;
                re.push('(');
            }
            '}' => {
                in_group = false;
                re.push(')');
            }
            ',' if in_group => re.push('|'),
            ',' => re.push_str("\\,"),
            '*' => {
                let prev = i.checked_sub(1).map(|j| s[j]);
                let mut stars = 1;
                while s.get(i + 1) == Some(&'*') {
                    stars += 1;
                    i += 1;
                }
                let next = s.get(i + 1).copied();
                let globstar = stars > 1
                    && matches!(prev, None | Some('/' | '{' | ','))
                    && matches!(next, None | Some('/' | ',' | '}'));
                if globstar {
                    if next == Some('/') {
                        i += 1;
                    } else if prev == Some('/') && re.ends_with("\\/") {
                        re.truncate(re.len() - 2);
                    }
                    re.push_str("((?:[^/]*(?:\\/|$))*)");
                } else {
                    re.push_str("([^/]*)");
                }
            }
            c => re.push(c),
        }
        i += 1;
    }
    format!("^{re}$")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_match(src: &str, s: &str) -> bool {
        match extended_regexp(src) {
            JsRegex::Re(re) => re.is_match(s),
            _ => panic!("{src} didn't compile"),
        }
    }

    #[test]
    fn translates_js_syntax() {
        assert!(is_match(r"^[a-zA-Z]\w*$", "abc_1"));
        assert!(!is_match(r"^[a-zA-Z]\w*$", "aé"));
        assert!(is_match(r"^(-?[0-9]+(px|%) ?){1,2}$", "-1px 2%"));
        assert!(is_match(r"^[a-zA-Z0-9_-]+$", "a-b_c"));
        assert!(is_match(r".*_html$", "x_html"));
        assert!(is_match("(?i)^ab$", "AB"));
        assert!(is_match(r"a{", "a{"));
        assert!(is_match(r"^[^]$", "\n"));
        assert!(!is_match(r"[]", "a"));
        assert!(is_match(r"^\u00e9\x41$", "éA"));
        assert!(is_match(r"^[\w-]+$", "a-b"));
        assert!(is_match(r"^[&~]+$", "&~"));
        assert!(is_match(r"\bfoo\b", "a foo b"));
        assert!(!is_match(r"^.$", "\n"));
        assert!(is_match(r"^(?<x>a)$", "a"));
        assert!(is_match(r"^\<a\>$", "<a>"));
        assert!(matches!(extended_regexp("(?=a)"), JsRegex::Unsupported));
        assert!(matches!(extended_regexp(r"(a)\1"), JsRegex::Unsupported));
        assert!(matches!(extended_regexp("(a"), JsRegex::Invalid));
        assert!(matches!(extended_regexp("[b-a]"), JsRegex::Invalid));
    }

    #[test]
    fn globs() {
        assert_eq!(
            glob_source("**/sections/*.liquid"),
            r"^((?:[^/]*(?:\/|$))*)sections\/([^/]*)\.liquid$"
        );
        let re = |g: &str| match compile(&glob_source(g), false) {
            JsRegex::Re(re) => re,
            _ => panic!(),
        };
        assert!(re("**/**/sections/*.liquid").is_match("file:///sections/file.liquid"));
        assert!(!re("**/**/sections/*.liquid").is_match("file:///blocks/file.liquid"));
        assert!(re("**/file.json").is_match("file:///file.json"));
        assert!(re("**/locales/*.{json,txt}").is_match("file:///x/locales/en.json"));
    }
}
