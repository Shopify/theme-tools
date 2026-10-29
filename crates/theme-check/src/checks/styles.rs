//! `utils/styles.ts`: `extractCSSClassNames`, the `getCSSClassesForURI` helpers and
//! `collectUsedClasses` / `collectUsedClassesFromSvg`.

use super::utils::valued_html_attribute;
use crate::context::FileSystem;
use crate::js;
use liquid_ast::{Document, Node, NodeRef};
use std::collections::HashSet;

/// `extractCSSClassNames(css)`: the value of every `class` node in the
/// selector of every rule `postcss-safe-parser` builds, skipping selectors
/// that `postcss-selector-parser` throws on.
///
/// Byte-level port of postcss 8.5 + postcss-safe-parser 7 (which rules exist,
/// their `selector` text) and postcss-selector-parser 7.1 (whether a selector
/// throws, its class values). Only the state those outcomes depend on is kept.
/// Every byte either parser branches on is ASCII, so UTF-16 vs UTF-8 offsets
/// only matter where JS consumes a single code unit (see `low_surrogate`).
pub fn extract_css_class_names(css: &str) -> HashSet<String> {
    let mut names = HashSet::new();
    let mut parser = SelectorParser::default();
    for_each_rule_selector(css, |selector| {
        // Class nodes only come from words containing a `.`.
        if selector.contains('.') && parser.parse(selector).is_ok() {
            names.extend(parser.classes.drain(..));
        }
    });
    names
}

#[derive(Clone, Copy)]
struct Tok<K> {
    kind: K,
    start: usize,
    end: usize,
}

fn is_space(c: u8) -> bool {
    matches!(c, b' ' | b'\n' | b'\t' | b'\r' | b'\x0c')
}

fn utf8_len(lead: u8) -> usize {
    match lead {
        0..=0x7f => 1,
        0xc0..=0xdf => 2,
        0xe0..=0xef => 3,
        _ => 4,
    }
}

fn find(b: &[u8], c: u8, from: usize) -> Option<usize> {
    b.get(from..)?
        .iter()
        .position(|&x| x == c)
        .map(|i| from + i)
}

fn find_comment_end(b: &[u8], from: usize) -> Option<usize> {
    b.get(from..)?
        .windows(2)
        .position(|w| w == b"*/")
        .map(|i| from + i + 2)
}

/// Whether the byte at `i` follows an odd run of backslashes.
fn escaped(b: &[u8], mut i: usize) -> bool {
    let mut odd = false;
    while i > 0 && b[i - 1] == b'\\' {
        i -= 1;
        odd = !odd;
    }
    odd
}

// ---------------------------------------------------------------------------
// postcss

#[derive(Clone, Copy, PartialEq, Eq)]
enum Tk {
    Space,
    Word,
    Str,
    AtWord,
    Brackets,
    Comment,
    OpenParen,
    CloseParen,
    OpenSquare,
    CloseSquare,
    OpenCurly,
    CloseCurly,
    Colon,
    Semicolon,
}

/// `RE_WORD_END` searched from `from`.
fn word_end(b: &[u8], from: usize) -> usize {
    let mut i = from;
    while i < b.len() {
        match b[i] {
            b'\t' | b'\n' | b'\x0c' | b'\r' | b' ' | b'!' | b'"' | b'#' | b'\'' | b'(' | b')'
            | b':' | b';' | b'@' | b'[' | b'\\' | b']' | b'{' | b'}' => return i,
            b'/' if b.get(i + 1) == Some(&b'*') => return i,
            _ => i += 1,
        }
    }
    i
}

/// `RE_BAD_BRACKET` (`/.[\r\n"'(/\\]/`) on `(...)`. JS `.` skips line
/// terminators: `\n`, `\r`, U+2028 and U+2029 (`e2 80 a8`/`e2 80 a9`).
fn bad_bracket(s: &[u8]) -> bool {
    (1..s.len()).any(|k| {
        matches!(s[k], b'\r' | b'\n' | b'"' | b'\'' | b'(' | b'/' | b'\\')
            && !matches!(s[k - 1], b'\n' | b'\r')
            && !(k >= 3 && s[k - 3] == 0xe2 && s[k - 2] == 0x80 && matches!(s[k - 1], 0xa8 | 0xa9))
    })
}

/// postcss `tokenizer(input, { ignoreErrors: true })`, run to the end. The
/// parser's `back()` only re-delivers tokens, so tokenizing up front is
/// equivalent.
fn tokenize(css: &[u8]) -> Vec<Tok<Tk>> {
    let len = css.len();
    let at = |i: usize| css.get(i).copied().unwrap_or(0);
    let mut toks = Vec::with_capacity(len / 4);
    // `buffer`: default-case words; every `(` pops one to spot `url(`.
    let mut words: Vec<(usize, usize)> = Vec::new();
    let mut last_bad_paren = None;
    // Set when JS took only the high surrogate of an astral char: the low
    // surrogate then starts a word, which can never be `url`.
    let mut low_surrogate = false;
    let mut pos = 0;
    while pos < len {
        if std::mem::take(&mut low_surrogate) {
            words.push((pos, pos));
            let end = word_end(css, pos);
            if end > pos {
                toks.push(Tok {
                    kind: Tk::Word,
                    start: pos,
                    end,
                });
                pos = end;
                continue;
            }
        }
        let (kind, end) = match css[pos] {
            c if is_space(c) => (
                Tk::Space,
                (pos + 1..len).find(|&i| !is_space(css[i])).unwrap_or(len),
            ),
            b'[' => (Tk::OpenSquare, pos + 1),
            b']' => (Tk::CloseSquare, pos + 1),
            b'{' => (Tk::OpenCurly, pos + 1),
            b'}' => (Tk::CloseCurly, pos + 1),
            b':' => (Tk::Colon, pos + 1),
            b';' => (Tk::Semicolon, pos + 1),
            b')' => (Tk::CloseParen, pos + 1),
            b'(' => {
                let prev = words.pop().map_or(&b""[..], |(s, e)| &css[s..e]);
                let n = at(pos + 1);
                if prev == b"url" && n != b'\'' && n != b'"' && !is_space(n) {
                    let mut next = pos;
                    let close = loop {
                        match find(css, b')', next + 1) {
                            Some(i) if escaped(css, i) => next = i,
                            Some(i) => break i,
                            None => break pos,
                        }
                    };
                    (Tk::Brackets, close + 1)
                } else if last_bad_paren.is_some_and(|b| pos <= b) {
                    (Tk::OpenParen, pos + 1)
                } else {
                    match find(css, b')', pos + 1) {
                        Some(i) if !bad_bracket(&css[pos..=i]) => (Tk::Brackets, i + 1),
                        close => {
                            last_bad_paren = Some(close.unwrap_or(len));
                            (Tk::OpenParen, pos + 1)
                        }
                    }
                }
            }
            q @ (b'\'' | b'"') => {
                let mut next = pos;
                let end = loop {
                    match find(css, q, next + 1) {
                        Some(i) if escaped(css, i) => next = i,
                        Some(i) => break i + 1,
                        // Unclosed: the quote plus one UTF-16 code unit.
                        None => {
                            let n = utf8_len(at(pos + 1));
                            low_surrogate = n == 4;
                            break (pos + 1 + n).min(len);
                        }
                    }
                };
                (Tk::Str, end)
            }
            b'@' => {
                let end = (pos + 1..len)
                    .find(|&i| {
                        matches!(
                            css[i],
                            b'\t'
                                | b'\n'
                                | b'\x0c'
                                | b'\r'
                                | b' '
                                | b'"'
                                | b'#'
                                | b'\''
                                | b'('
                                | b')'
                                | b'/'
                                | b';'
                                | b'['
                                | b'\\'
                                | b']'
                                | b'{'
                                | b'}'
                        )
                    })
                    .unwrap_or(len);
                (Tk::AtWord, end)
            }
            b'\\' => {
                let mut next = pos;
                let mut escape = true;
                while at(next + 1) == b'\\' {
                    next += 1;
                    escape = !escape;
                }
                let c = at(next + 1);
                let mut end = next + 1;
                if escape && c != b'/' && !is_space(c) {
                    if c.is_ascii_hexdigit() {
                        end = next + 2;
                        while at(end).is_ascii_hexdigit() {
                            end += 1;
                        }
                        if at(end) == b' ' {
                            end += 1;
                        }
                    } else {
                        let n = utf8_len(c);
                        low_surrogate = n == 4;
                        end = (next + 1 + n).min(len);
                    }
                }
                (Tk::Word, end)
            }
            b'/' if at(pos + 1) == b'*' => {
                (Tk::Comment, find_comment_end(css, pos + 2).unwrap_or(len))
            }
            _ => {
                let end = word_end(css, pos + 1);
                words.push((pos, end));
                (Tk::Word, end)
            }
        };
        toks.push(Tok {
            kind,
            start: pos,
            end,
        });
        pos = end;
    }
    toks
}

/// postcss `SafeParser#parse`, calling `f` with the `selector` of each rule it
/// creates. Which container is current never changes which rules get created,
/// so no tree is kept.
fn for_each_rule_selector(css: &str, mut f: impl FnMut(&str)) {
    let toks = tokenize(css.as_bytes());
    let mut brackets = Vec::new();
    let mut selector = String::new();
    let mut i = 0;
    while i < toks.len() {
        let start = i;
        i += 1;
        match toks[start].kind {
            // `{` is `emptyRule`, whose selector '' holds no classes.
            Tk::Space | Tk::Semicolon | Tk::CloseCurly | Tk::Comment | Tk::OpenCurly => {}
            Tk::AtWord => {
                // `atrule`: params up to a top-level `;`, `{` or `}`.
                brackets.clear();
                while let Some(t) = toks.get(i) {
                    i += 1;
                    match t.kind {
                        Tk::OpenParen => brackets.push(Tk::CloseParen),
                        Tk::OpenSquare => brackets.push(Tk::CloseSquare),
                        Tk::OpenCurly if !brackets.is_empty() => brackets.push(Tk::CloseCurly),
                        k if brackets.last() == Some(&k) => {
                            brackets.pop();
                        }
                        _ => {}
                    }
                    if brackets.is_empty()
                        && matches!(t.kind, Tk::Semicolon | Tk::OpenCurly | Tk::CloseCurly)
                    {
                        break;
                    }
                }
            }
            _ => {
                // `other`: a declaration, a rule, or unknown words.
                let custom = css[toks[start].start..].starts_with("--");
                let mut colon = false;
                brackets.clear();
                i = start;
                while let Some(t) = toks.get(i) {
                    i += 1;
                    match t.kind {
                        Tk::OpenParen => brackets.push(Tk::CloseParen),
                        Tk::OpenSquare => brackets.push(Tk::CloseSquare),
                        Tk::OpenCurly if custom && colon => brackets.push(Tk::CloseCurly),
                        k if !brackets.is_empty() => {
                            if brackets.last() == Some(&k) {
                                brackets.pop();
                            }
                        }
                        // `}` is pushed back for `end`, a no-op here.
                        Tk::Semicolon | Tk::CloseCurly => break,
                        Tk::Colon => colon = true,
                        Tk::OpenCurly => {
                            // `rule`: trailing spaces and comments go to
                            // `raws.between`, the rest through `raw`.
                            let sel = &toks[start..i - 1];
                            let n = sel
                                .iter()
                                .rposition(|t| !matches!(t.kind, Tk::Space | Tk::Comment));
                            let sel = &sel[..n.map_or(0, |n| n + 1)];
                            selector.clear();
                            for (k, t) in sel.iter().enumerate() {
                                // `raw` keeps a comment only between two
                                // non-space tokens, and not right after a `,`.
                                if t.kind == Tk::Comment {
                                    let wedged = k > 0
                                        && sel[k - 1].kind != Tk::Space
                                        && sel.get(k + 1).is_some_and(|n| n.kind != Tk::Space);
                                    if !wedged || selector.ends_with(',') {
                                        continue;
                                    }
                                }
                                selector.push_str(&css[t.start..t.end]);
                            }
                            f(&selector);
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// postcss-selector-parser

#[derive(Clone, Copy, PartialEq, Eq)]
enum St {
    Space,
    Combinator,
    Asterisk,
    Ampersand,
    Bang,
    Comma,
    Equals,
    Dollar,
    Caret,
    OpenSquare,
    CloseSquare,
    Colon,
    Semicolon,
    OpenParen,
    CloseParen,
    Str,
    Comment,
    Slash,
    Word,
}

/// The selector `tokenize`; `Err` where it throws on an unclosed quote or comment.
fn sel_tokenize(s: &[u8], toks: &mut Vec<Tok<St>>) -> Result<(), ()> {
    toks.clear();
    let len = s.len();
    let mut start = 0;
    while start < len {
        let (kind, end) = match s[start] {
            c if is_space(c) => (
                St::Space,
                (start + 1..len).find(|&i| !is_space(s[i])).unwrap_or(len),
            ),
            b'+' | b'>' | b'~' | b'|' => {
                let end = (start + 1..len)
                    .find(|&i| !matches!(s[i], b'+' | b'>' | b'~' | b'|'))
                    .unwrap_or(len);
                (St::Combinator, end)
            }
            b'*' => (St::Asterisk, start + 1),
            b'&' => (St::Ampersand, start + 1),
            b'!' => (St::Bang, start + 1),
            b',' => (St::Comma, start + 1),
            b'=' => (St::Equals, start + 1),
            b'$' => (St::Dollar, start + 1),
            b'^' => (St::Caret, start + 1),
            b'[' => (St::OpenSquare, start + 1),
            b']' => (St::CloseSquare, start + 1),
            b':' => (St::Colon, start + 1),
            b';' => (St::Semicolon, start + 1),
            b'(' => (St::OpenParen, start + 1),
            b')' => (St::CloseParen, start + 1),
            q @ (b'\'' | b'"') => {
                let mut next = start;
                loop {
                    next = find(s, q, next + 1).ok_or(())?;
                    if !escaped(s, next) {
                        break;
                    }
                }
                (St::Str, next + 1)
            }
            b'/' if s.get(start + 1) == Some(&b'*') => {
                (St::Comment, find_comment_end(s, start + 2).ok_or(())?)
            }
            b'/' => (St::Slash, start + 1),
            _ => (St::Word, consume_word(s, start)),
        };
        toks.push(Tok { kind, start, end });
        start = end;
    }
    Ok(())
}

/// `consumeWord`, returning the end (exclusive).
fn consume_word(s: &[u8], start: usize) -> usize {
    let mut next = start;
    while next < s.len() {
        match s[next] {
            b' ' | b'\t' | b'\n' | b'\r' | b'\x0c' | b'&' | b'*' | b'!' | b',' | b':' | b';'
            | b'(' | b')' | b'[' | b']' | b'\'' | b'"' | b'+' | b'|' | b'~' | b'>' | b'='
            | b'$' | b'^' | b'/' => return next,
            b'\\' => next = consume_escape(s, next) + 1,
            _ => next += 1,
        }
    }
    next.min(s.len())
}

/// `consumeEscape`: the index of the escape's last byte.
fn consume_escape(s: &[u8], start: usize) -> usize {
    let at = |i: usize| s.get(i).copied().unwrap_or(0);
    let mut next = start;
    let c = at(next + 1);
    if matches!(c, b'\t' | b'\n' | b'\r' | b'\x0c') {
        // Unescapable: only the backslash.
    } else if c.is_ascii_hexdigit() {
        let mut digits = 0;
        loop {
            next += 1;
            digits += 1;
            if !(at(next + 1).is_ascii_hexdigit() && digits < 6) {
                break;
            }
        }
        if digits < 6 && at(next + 1) == b' ' {
            next += 1;
        }
    } else {
        next += 1;
    }
    next
}

/// `util/unesc`.
fn unesc(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut copied = 0;
    let mut i = 0;
    while i < b.len() {
        if b[i] != b'\\' {
            i += 1;
            continue;
        }
        out.push_str(&s[copied..i]);
        let hex = b[i + 1..]
            .iter()
            .take(6)
            .take_while(|c| c.is_ascii_hexdigit())
            .count();
        if hex > 0 {
            let cp = u32::from_str_radix(&s[i + 1..i + 1 + hex], 16).unwrap_or(0);
            out.push(
                char::from_u32(cp)
                    .filter(|&c| c != '\0')
                    .unwrap_or('\u{FFFD}'),
            );
            i += 1 + hex;
            if hex < 6 && b.get(i) == Some(&b' ') {
                i += 1;
            }
        } else if b.get(i + 1) == Some(&b'\\') {
            out.push('\\');
            i += 2;
        } else {
            if i + 1 == b.len() {
                out.push('\\');
            }
            i += 1;
        }
        copied = i;
    }
    out.push_str(&s[copied..]);
    out
}

/// `/^\d+\.\d+%$/`: keyframe selectors like `50.5%` hold no class.
fn is_keyframes_percent(w: &[u8]) -> bool {
    let Some(rest) = w.strip_suffix(b"%") else {
        return false;
    };
    let Some(dot) = rest.iter().position(|&c| c == b'.') else {
        return false;
    };
    let (int, frac) = (&rest[..dot], &rest[dot + 1..]);
    !int.is_empty()
        && !frac.is_empty()
        && int.iter().all(u8::is_ascii_digit)
        && frac.iter().all(u8::is_ascii_digit)
}

/// `util/maxNestingDepth` default.
const MAX_NESTING_DEPTH: usize = 256;

/// The last node of the open selector, as far as later tokens care.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Last {
    None,
    Comment,
    Pseudo,
    Class(usize),
    Other,
}

/// The open `Selector` container.
#[derive(Clone, Copy)]
struct Container {
    last: Last,
    only_comments: bool,
}

const EMPTY: Container = Container {
    last: Last::None,
    only_comments: true,
};

type R = Result<(), ()>;

#[derive(Default)]
struct SelectorParser {
    toks: Vec<Tok<St>>,
    classes: Vec<String>,
}

impl SelectorParser {
    /// `selectorParser().astSync(selector)`, leaving the class values in
    /// `classes`; `Err` where it throws.
    fn parse(&mut self, selector: &str) -> R {
        self.classes.clear();
        sel_tokenize(selector.as_bytes(), &mut self.toks)?;
        let mut p = Parser {
            css: selector,
            toks: &self.toks,
            pos: 0,
            cur: EMPTY,
            depth: 0,
            walk_cut: None,
            classes: &mut self.classes,
        };
        while p.pos < p.toks.len() {
            p.parse(true)?;
        }
        if let Some(n) = p.walk_cut {
            self.classes.truncate(n);
        }
        Ok(())
    }
}

/// `Parser`, keeping only what decides throws and class values.
struct Parser<'a> {
    css: &'a str,
    toks: &'a [Tok<St>],
    pos: usize,
    cur: Container,
    depth: usize,
    /// How many classes `walk` visits before it throws, if it does.
    walk_cut: Option<usize>,
    classes: &'a mut Vec<String>,
}

impl Parser<'_> {
    fn kind(&self, i: usize) -> Option<St> {
        self.toks.get(i).map(|t| t.kind)
    }

    fn next_is_pipe(&self) -> bool {
        self.toks
            .get(self.pos + 1)
            .is_some_and(|t| &self.css[t.start..t.end] == "|")
    }

    /// `newNode`.
    fn add(&mut self, last: Last) {
        // `walk` throws on entering a non-empty selector this deep (two levels
        // per pseudo), after the callback already saw the classes before it.
        if 2 * self.depth + 1 > MAX_NESTING_DEPTH && self.walk_cut.is_none() {
            self.walk_cut = Some(match last {
                Last::Class(i) => i,
                _ => self.classes.len(),
            });
        }
        self.cur.last = last;
        if last != Last::Comment {
            self.cur.only_comments = false;
        }
    }

    fn parse(&mut self, throw_on_paren: bool) -> R {
        match self.toks[self.pos].kind {
            St::Space => self.space(),
            St::Comment => {
                self.add(Last::Comment);
                self.pos += 1;
                Ok(())
            }
            St::OpenParen => self.parentheses(),
            St::CloseParen => match throw_on_paren {
                true => Err(()),
                false => Ok(()),
            },
            St::OpenSquare => self.attribute(),
            St::Dollar | St::Caret | St::Equals | St::Word => self.word(),
            St::Colon => self.pseudo(),
            St::Comma => {
                // A trailing comma opens no selector.
                if self.pos + 1 < self.toks.len() {
                    self.cur = EMPTY;
                }
                self.pos += 1;
                Ok(())
            }
            St::Asterisk => self.universal(),
            St::Ampersand => {
                // `&|` skips to the pipe without a nesting node.
                if !self.next_is_pipe() {
                    self.add(Last::Other);
                }
                self.pos += 1;
                Ok(())
            }
            St::Slash | St::Combinator => self.combinator(),
            St::Str => {
                self.add(Last::Other);
                self.pos += 1;
                Ok(())
            }
            St::CloseSquare | St::Semicolon | St::Bang => Err(()),
        }
    }

    fn word(&mut self) -> R {
        if self.next_is_pipe() {
            self.pos += 1;
            return self.namespace();
        }
        self.split_word(false)
    }

    fn universal(&mut self) -> R {
        if self.next_is_pipe() {
            self.pos += 1;
            return self.namespace();
        }
        self.add(Last::Other);
        self.pos += 1;
        Ok(())
    }

    fn namespace(&mut self) -> R {
        match self.kind(self.pos + 1) {
            Some(St::Word) => {
                self.pos += 1;
                self.word()
            }
            Some(St::Asterisk) => {
                self.pos += 1;
                self.universal()
            }
            _ => Err(()),
        }
    }

    fn space(&mut self) -> R {
        let p = self.pos;
        if p == 0
            || matches!(self.kind(p - 1), Some(St::Comma | St::OpenParen))
            || self.cur.only_comments
            || p + 1 == self.toks.len()
            || matches!(self.kind(p + 1), Some(St::Comma | St::CloseParen))
        {
            self.pos += 1;
            return Ok(());
        }
        self.combinator()
    }

    fn combinator(&mut self) -> R {
        let t = self.toks[self.pos];
        if &self.css[t.start..t.end] == "|" {
            return self.namespace();
        }
        let len = self.toks.len();
        let Some(sig) =
            (self.pos..len).find(|&i| !matches!(self.toks[i].kind, St::Space | St::Comment))
        else {
            self.pos = len;
            return Ok(());
        };
        if matches!(self.toks[sig].kind, St::Comma | St::CloseParen) {
            self.pos = sig;
            return Ok(());
        }
        let spaced = sig > self.pos;
        self.pos = sig;
        if self.kind(sig) == Some(St::Slash)
            && self.kind(sig + 1) == Some(St::Word)
            && self.kind(sig + 2) == Some(St::Slash)
        {
            self.pos += 3;
        } else if self.toks[sig].kind == St::Combinator {
            self.pos += 1;
        } else if !spaced {
            return Err(());
        }
        if self.kind(self.pos) == Some(St::Space) {
            self.pos += 1;
        }
        self.add(Last::Other);
        Ok(())
    }

    fn pseudo(&mut self) -> R {
        while self.kind(self.pos) == Some(St::Colon) {
            self.pos += 1;
        }
        if self.kind(self.pos) != Some(St::Word) {
            return Err(());
        }
        self.split_word(true)
    }

    /// `splitWord`: a word, with any `$ ^ =` and words glued on, split at each
    /// unescaped `.` and `#` into a tag (or the pseudo's name), classes and ids.
    fn split_word(&mut self, pseudo: bool) -> R {
        let first = self.pos;
        while matches!(
            self.kind(self.pos + 1),
            Some(St::Dollar | St::Caret | St::Equals | St::Word)
        ) {
            self.pos += 1;
            let t = self.toks[self.pos];
            if self.css[t.start..t.end].ends_with('\\')
                && self.kind(self.pos + 1) == Some(St::Space)
            {
                self.pos += 1;
            }
        }
        // Tokens tile the selector, so the glued word is one slice.
        let css = self.css;
        let word = &css[self.toks[first].start..self.toks[self.pos].end];
        let w = word.as_bytes();
        let percent = is_keyframes_percent(w);
        let split = |i: usize| {
            (i == 0 || w[i - 1] != b'\\')
                && match w[i] {
                    b'.' => !percent,
                    // `#{` is a Sass interpolation, not an id.
                    b'#' => w.get(i + 1) != Some(&b'{'),
                    _ => false,
                }
        };
        let mut start = 0;
        loop {
            let end = (start + 1..w.len()).find(|&i| split(i)).unwrap_or(w.len());
            if start == 0 && pseudo {
                self.add(Last::Pseudo);
                if end < w.len() && self.kind(self.pos + 1) == Some(St::OpenParen) {
                    return Err(()); // "Misplaced parenthesis."
                }
            } else if w[start] == b'.' && split(start) {
                let v = &word[start + 1..end];
                self.classes.push(if v.contains('\\') {
                    unesc(v)
                } else {
                    v.to_owned()
                });
                self.add(Last::Class(self.classes.len() - 1));
            } else {
                self.add(Last::Other);
            }
            if end == w.len() {
                break;
            }
            start = end;
        }
        self.pos += 1;
        Ok(())
    }

    fn parentheses(&mut self) -> R {
        let last = self.cur.last;
        let len = self.toks.len();
        let mut unbalanced = 1;
        self.pos += 1;
        if last == Last::Pseudo {
            // The argument is a nested selector list; its classes count. A
            // nested `(` is counted here and again by its own `parentheses`,
            // so the closing `)` is seen (and decremented) twice.
            if self.pos >= len {
                return Err(());
            }
            self.depth += 1;
            if self.depth > MAX_NESTING_DEPTH {
                return Err(());
            }
            let outer = std::mem::replace(&mut self.cur, EMPTY);
            while self.pos < len && unbalanced > 0 {
                match self.toks[self.pos].kind {
                    St::OpenParen => unbalanced += 1,
                    St::CloseParen => unbalanced -= 1,
                    _ => {}
                }
                if unbalanced > 0 {
                    self.parse(false)?;
                } else {
                    self.pos += 1;
                }
            }
            self.cur = outer;
            self.depth -= 1;
        } else {
            // Raw text, glued onto the last node's value (`.a(.b)` is class
            // `a(.b)`) or kept as a string node.
            let open = self.pos - 1;
            while self.pos < len && unbalanced > 0 {
                match self.toks[self.pos].kind {
                    St::OpenParen => unbalanced += 1,
                    St::CloseParen => unbalanced -= 1,
                    _ => {}
                }
                self.pos += 1;
            }
            match last {
                Last::Class(i) => self.classes[i]
                    .push_str(&self.css[self.toks[open].start..self.toks[self.pos - 1].end]),
                Last::None => self.add(Last::Other),
                _ => {}
            }
        }
        if unbalanced > 0 {
            return Err(()); // "Expected closing parenthesis."
        }
        Ok(())
    }

    /// `attribute`: only whether it throws matters; nothing inside `[...]` is a class.
    fn attribute(&mut self) -> R {
        #[derive(Clone, Copy, PartialEq, Eq)]
        enum Part {
            None,
            Namespace,
            Attribute,
            Operator,
            Value,
            Insensitive,
        }
        let first = self.pos + 1;
        let close = (first..self.toks.len())
            .find(|&i| self.toks[i].kind == St::CloseSquare)
            .ok_or(())?;
        let attr = &self.toks[first..close];
        if attr.len() == 1 && attr[0].kind != St::Word {
            return Err(());
        }
        let content = |t: &Tok<St>| &self.css[t.start..t.end];
        let (mut attribute, mut operator, mut namespace, mut quoted, mut space_after) =
            (false, false, false, false, false);
        // `node.value`: `None` while undefined, else whether it's non-empty.
        let mut value: Option<bool> = None;
        let mut last = Part::None;
        for (k, t) in attr.iter().enumerate() {
            // JS reads `next[TYPE]` unguarded in places; on `undefined` it throws.
            let next = attr.get(k + 1).map(|n| n.kind);
            match t.kind {
                St::Space => space_after = true,
                St::Asterisk => {
                    if next.ok_or(())? == St::Equals {
                        operator = true;
                        last = Part::Operator;
                    } else if !namespace || (last == Part::Namespace && !space_after) {
                        namespace = true;
                        last = Part::Namespace;
                    }
                    space_after = false;
                }
                St::Dollar if last == Part::Value => value = Some(true),
                St::Dollar | St::Caret => {
                    if next.ok_or(())? == St::Equals {
                        operator = true;
                        last = Part::Operator;
                    }
                    space_after = false;
                }
                St::Combinator => {
                    let c = content(t);
                    if c == "~" || c == "|" {
                        if next.ok_or(())? == St::Equals {
                            operator = true;
                            last = Part::Operator;
                        } else if c == "|" && !namespace && !attribute {
                            namespace = true;
                        }
                    }
                    space_after = false;
                }
                St::Word => {
                    let pipe_next = attr.get(k + 1).is_some_and(|n| content(n) == "|");
                    if pipe_next
                        && attr.get(k + 2).is_some_and(|n| n.kind != St::Equals)
                        && !operator
                        && !namespace
                    {
                        namespace = true;
                        last = Part::Namespace;
                    } else if !attribute || (last == Part::Attribute && !space_after) {
                        attribute = true;
                        last = Part::Attribute;
                    } else if value.is_none() || (last == Part::Value && !(space_after || quoted)) {
                        value = Some(true);
                        quoted = false;
                        last = Part::Value;
                    } else if quoted || space_after {
                        last = Part::Insensitive;
                    } else {
                        value = Some(true);
                        last = Part::Value;
                    }
                    space_after = false;
                }
                St::Str => {
                    if !attribute || !operator {
                        return Err(());
                    }
                    value = Some(t.end - t.start > 2);
                    quoted = true;
                    last = Part::Value;
                    space_after = false;
                }
                St::Equals => {
                    if !attribute || value == Some(true) {
                        return Err(());
                    }
                    operator = true;
                    last = Part::Operator;
                    space_after = false;
                }
                St::Comment => {}
                _ => return Err(()),
            }
        }
        self.add(Last::Other);
        self.pos = close + 1;
        Ok(())
    }
}

/// A used class: `{ className, startIndex, endIndex }`.
pub type UsedClass<'a> = (&'a str, usize, usize);

/// `collectUsedClasses(attributes, usedClasses)`: the `\S+` tokens of `class` attribute
/// TextNodes, minus the ones glued to an adjacent Liquid node. `src` is the string the attribute
/// positions index into, and `offset` is added to the pushed positions (for the svg re-parse).
pub fn collect_used_classes<'a>(
    attributes: &[Node],
    src: &'a str,
    offset: usize,
    used: &mut Vec<UsedClass<'a>>,
) {
    for attr in attributes {
        let Some(attr) = valued_html_attribute(attr) else {
            continue;
        };
        // HTML attribute names are case-insensitive (no non-ASCII char lowercases into "class").
        if !matches!(&attr.name[..], [Node::TextNode(t)] if t.value.eq_ignore_ascii_case("class")) {
            continue;
        }
        let nodes = &attr.value;
        for (i, node) in nodes.iter().enumerate() {
            let Node::TextNode(t) = node else { continue };
            let base = t.position.start;
            let value = &src[base..t.position.end];
            debug_assert_eq!(value, &*t.value);
            let first = used.len();
            let mut token_start = None;
            for (j, c) in value.char_indices().chain([(value.len(), ' ')]) {
                match (token_start, js::is_space(c)) {
                    (None, false) => token_start = Some(j),
                    (Some(k), true) => {
                        used.push((&value[k..j], offset + base + k, offset + base + j));
                        token_start = None;
                    }
                    _ => {}
                }
            }
            if used.len() == first {
                continue;
            }
            if i > 0
                && !matches!(nodes[i - 1], Node::TextNode(_))
                && !value.starts_with(js::is_space)
            {
                used.remove(first);
            }
            let next_is_liquid = nodes
                .get(i + 1)
                .is_some_and(|n| !matches!(n, Node::TextNode(_)));
            if next_is_liquid && !value.ends_with(js::is_space) && used.len() > first {
                used.pop();
            }
        }
    }
}

/// `collectUsedClassesFromSvg(attributes, bodyValue, bodyStartOffset, usedClasses)`: the svg
/// tag's own classes, then those of the elements in its re-parsed body.
pub fn collect_used_classes_from_svg<'a>(
    attributes: &[Node],
    source: &'a str,
    body: &'a str,
    body_start: usize,
    used: &mut Vec<UsedClass<'a>>,
) {
    collect_used_classes(attributes, source, 0, used);
    let Ok(inner) = liquid_parser::to_liquid_html_ast(body) else {
        return;
    };
    for node in crate::visitor::walk(NodeRef::Document(&inner)) {
        let attributes = match node {
            NodeRef::HtmlElement(n) => &n.attributes,
            NodeRef::HtmlVoidElement(n) => &n.attributes,
            NodeRef::HtmlSelfClosingElement(n) => &n.attributes,
            _ => continue,
        };
        collect_used_classes(attributes, body, body_start, used);
    }
}

/// `extractCSSClassesFromLiquidAST(ast)`: classes from every `{% stylesheet %}` body.
pub fn extract_css_classes_from_liquid_ast(ast: &Document) -> HashSet<String> {
    let mut classes = HashSet::new();
    for node in crate::visitor::walk(NodeRef::Document(ast)) {
        if let NodeRef::LiquidRawTag(t) = node {
            if t.name == "stylesheet" {
                classes.extend(extract_css_class_names(&t.body.value));
            }
        }
    }
    classes
}

/// `/\{%-?\s*stylesheet/.test(source)`
fn has_stylesheet_tag(source: &str) -> bool {
    source.match_indices("{%").any(|(i, _)| {
        let rest = &source[i + 2..];
        js::trim_start(rest.strip_prefix('-').unwrap_or(rest)).starts_with("stylesheet")
    })
}

/// `extractCSSClassesFromLiquidUri(uri, fs)`: empty when the file can't be read or parsed.
pub fn extract_css_classes_from_liquid_uri(uri: &str, fs: &dyn FileSystem) -> HashSet<String> {
    let Ok(source) = fs.read_file(uri) else {
        return HashSet::new();
    };
    if !has_stylesheet_tag(&source) {
        return HashSet::new();
    }
    match liquid_parser::to_liquid_html_ast(&source) {
        Ok(ast) => extract_css_classes_from_liquid_ast(&ast),
        Err(_) => HashSet::new(),
    }
}

/// `extractCSSClassesFromAssetUri(uri, fs)`
pub fn extract_css_classes_from_asset_uri(uri: &str, fs: &dyn FileSystem) -> HashSet<String> {
    fs.read_file(uri).map_or_else(
        |_| HashSet::new(),
        |source| extract_css_class_names(&source),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(css: &str) -> Vec<String> {
        let mut v: Vec<String> = extract_css_class_names(css).into_iter().collect();
        v.sort();
        v
    }

    #[test]
    fn spec_cases() {
        let cases: &[(&str, &[&str])] = &[
            (".my-class { color: red; }", &["my-class"]),
            (".a .b { color: red; }", &["a", "b"]),
            (".a, .b { color: red; }", &["a", "b"]),
            (
                ".parent > .child + .sibling ~ .cousin { color: red; }",
                &["child", "cousin", "parent", "sibling"],
            ),
            (
                ".btn:hover { color: red; } .link::before { content: \"\"; }",
                &["btn", "link"],
            ),
            (
                "@media (min-width: 768px) { .responsive { display: block; } }",
                &["responsive"],
            ),
            (
                "/* .commented-out { color: red; } */ .real { color: blue; }",
                &["real"],
            ),
            ("this is {{ not }} valid css {{{", &[]),
            ("", &[]),
            (
                ".my-class_name { color: red; } ._private { color: blue; }",
                &["_private", "my-class_name"],
            ),
            (".a.b { color: red; }", &["a", "b"]),
        ];
        for (css, want) in cases {
            assert_eq!(sorted(css), *want, "{css:?}");
        }
    }

    /// Outputs checked against the Node packages.
    #[test]
    fn node_quirks() {
        let cases: &[(&str, &[&str])] = &[
            (".md\\:flex {}", &["md:flex"]),
            (".\\31 0 {}", &["10"]),
            (".\\41  x {}", &["A"]),
            (".a\\\\.b {}", &["a\\.b"]),
            (
                "@keyframes k { 0% {} 50.5% {} .5% {} 10.a% {} from {} to {} }",
                &["5%", "a%"],
            ),
            (".a(.b).c {}", &["a(.b)", "c"]),
            (":is((.a)) .b {}", &["b"]),
            (".a:not(.b)(.c) {}", &["a", "b", "c"]),
            (".a [ {} ] .b {}", &["a", "b"]),
            (".a ( {} .b {}", &[]),
            (".a { color: red .b { } }", &["a"]),
            (".a { --x: { .y {} } } .z {}", &["a", "z"]),
            ("[a=\"x\"=\"y\"] .a {}", &[]),
            (".a / .b {} .a/deep/.b {}", &["a", "b"]),
            (".a.#b {}", &["", "a"]),
            (".a-{{ x }}-b {}", &["a-"]),
            (".a/*x*/b {} .c /*unclosed {}", &["a"]),
        ];
        for (css, want) in cases {
            assert_eq!(sorted(css), *want, "{css:?}");
        }
    }

    /// `CSS_CLASSES_CORPUS`: JSONL of `{"css", "classes"}` produced by the
    /// Node packages.
    fn used(source: &str) -> Vec<UsedClass<'_>> {
        let ast = liquid_parser::to_liquid_html_ast(source).unwrap();
        let mut out = Vec::new();
        for node in crate::visitor::walk(NodeRef::Document(&ast)) {
            match node {
                NodeRef::HtmlElement(n) => collect_used_classes(&n.attributes, source, 0, &mut out),
                NodeRef::HtmlRawNode(n) => {
                    let body = &source[n.body.position.start..n.body.position.end];
                    collect_used_classes_from_svg(
                        &n.attributes,
                        source,
                        body,
                        n.body.position.start,
                        &mut out,
                    )
                }
                _ => {}
            }
        }
        out
    }

    #[test]
    fn used_classes() {
        let src = r#"<div CLASS="btn-{{ size }} active {{ x }}-y z{{ w }}" id="a b">x</div>"#;
        assert_eq!(used(src), [("active", 27, 33)]);
        assert_eq!(
            used(r#"<p class="{{ a }} b c {{ d }}"></p>"#)[..],
            [("b", 18, 19), ("c", 20, 21)]
        );
        let src = r#"<svg class="icon"><g class="a"><rect class="b"/></g></svg>"#;
        let got = used(src);
        assert_eq!(
            got.iter().map(|u| u.0).collect::<Vec<_>>(),
            ["icon", "a", "b"]
        );
        assert!(got.iter().all(|&(c, s, e)| &src[s..e] == c));
    }

    #[test]
    fn liquid_stylesheet_tags() {
        assert!(has_stylesheet_tag("a {%- \n stylesheet %}"));
        assert!(has_stylesheet_tag("{% if %}{%stylesheet%}"));
        assert!(!has_stylesheet_tag("{%- - stylesheet %}"));
        let ast = liquid_parser::to_liquid_html_ast("{% stylesheet %}.a, .b .c {}{% endstylesheet %}<p>{% stylesheet %}.d{}{% endstylesheet %}</p>").unwrap();
        let mut got: Vec<_> = extract_css_classes_from_liquid_ast(&ast)
            .into_iter()
            .collect();
        got.sort();
        assert_eq!(got, ["a", "b", "c", "d"]);
    }
}
