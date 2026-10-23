//! Port of the npm `jsonc-parser` scanner and `visit` (v3.2.1), `jsonc/parse.ts` (`toJSONNode`,
//! the json-to-ast shaped tree), `json.ts` (`parseJSON`, `nodeAtPath`) and `visitJSON`.
//!
//! Offsets are UTF-8 bytes. jsonc-parser scans UTF-16 code units, but every character it treats
//! specially is ASCII, so byte offsets map 1:1 onto its UTF-16 offsets.

use serde_json::{Map, Value};
use std::borrow::Cow;

// ---------------------------------------------------------------------------------------------
// AST (jsonc/types.ts)

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Loc {
    pub start: usize,
    pub end: usize,
}

/// TS `ValueNode`: what the root, `Property.value` and array items can be.
#[derive(Clone, Debug)]
pub enum JsonNode<'a> {
    Object(ObjectNode<'a>),
    Array(ArrayNode<'a>),
    Literal(LiteralNode<'a>),
}

#[derive(Clone, Debug)]
pub struct ObjectNode<'a> {
    pub children: Vec<PropertyNode<'a>>,
    pub loc: Loc,
}

#[derive(Clone, Debug)]
pub struct ArrayNode<'a> {
    pub children: Vec<JsonNode<'a>>,
    pub loc: Loc,
}

#[derive(Clone, Debug)]
pub struct PropertyNode<'a> {
    pub key: IdentifierNode<'a>,
    pub value: JsonNode<'a>,
    pub loc: Loc,
}

#[derive(Clone, Debug)]
pub struct IdentifierNode<'a> {
    pub value: Cow<'a, str>,
    pub loc: Loc,
}

#[derive(Clone, Debug)]
pub struct LiteralNode<'a> {
    pub value: Lit<'a>,
    pub loc: Loc,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Lit<'a> {
    Str(Cow<'a, str>),
    Num(f64),
    Bool(bool),
    Null,
}

impl<'a> Lit<'a> {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Lit::Str(s) => Some(s),
            _ => None,
        }
    }
    /// The literal as a JS value would print it (`${value}` / `String(value)`).
    pub fn to_js_string(&self) -> String {
        match self {
            Lit::Str(s) => s.to_string(),
            Lit::Num(n) => js_number_to_string(*n),
            Lit::Bool(b) => b.to_string(),
            Lit::Null => "null".into(),
        }
    }
}

/// Bit for `JsonKind`, used by JSON checks' visit masks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum JsonKind {
    Object,
    Array,
    Property,
    Identifier,
    Literal,
}

impl JsonKind {
    pub fn bit(self) -> u64 {
        1 << (self as u8)
    }
    pub fn type_name(self) -> &'static str {
        match self {
            JsonKind::Object => "Object",
            JsonKind::Array => "Array",
            JsonKind::Property => "Property",
            JsonKind::Identifier => "Identifier",
            JsonKind::Literal => "Literal",
        }
    }
}

/// Any JSON AST node (TS `JSONNode`), borrowed.
#[derive(Clone, Copy, Debug)]
pub enum JsonRef<'a> {
    Object(&'a ObjectNode<'a>),
    Array(&'a ArrayNode<'a>),
    Property(&'a PropertyNode<'a>),
    Identifier(&'a IdentifierNode<'a>),
    Literal(&'a LiteralNode<'a>),
}

impl<'a> JsonNode<'a> {
    pub fn to_ref(&'a self) -> JsonRef<'a> {
        match self {
            JsonNode::Object(n) => JsonRef::Object(n),
            JsonNode::Array(n) => JsonRef::Array(n),
            JsonNode::Literal(n) => JsonRef::Literal(n),
        }
    }
    pub fn loc(&self) -> Loc {
        match self {
            JsonNode::Object(n) => n.loc,
            JsonNode::Array(n) => n.loc,
            JsonNode::Literal(n) => n.loc,
        }
    }
    pub fn as_object(&self) -> Option<&ObjectNode<'a>> {
        match self {
            JsonNode::Object(n) => Some(n),
            _ => None,
        }
    }
    pub fn as_array(&self) -> Option<&ArrayNode<'a>> {
        match self {
            JsonNode::Array(n) => Some(n),
            _ => None,
        }
    }
    pub fn as_literal(&self) -> Option<&LiteralNode<'a>> {
        match self {
            JsonNode::Literal(n) => Some(n),
            _ => None,
        }
    }
    /// `nodeAtPath(node, path)`. Path segments are property names or array indices.
    pub fn at_path(&self, path: &[PathSeg]) -> Option<&JsonNode<'a>> {
        let mut acc = self;
        for seg in path {
            acc = match (acc, seg) {
                (JsonNode::Object(o), PathSeg::Key(k)) => &o.get(k)?.value,
                (JsonNode::Array(a), PathSeg::Index(i)) => a.children.get(*i)?,
                // TS indexes arrays with `children[key]`, so "0" works like 0.
                (JsonNode::Array(a), PathSeg::Key(k)) => a.children.get(array_index(k)? as usize)?,
                // `child.key.value === key` never holds for a number key.
                _ => return None,
            };
        }
        Some(acc)
    }
}

impl<'a> ObjectNode<'a> {
    /// First property with this key (TS `children.find(c => c.key.value === key)`).
    pub fn get(&self, key: &str) -> Option<&PropertyNode<'a>> {
        self.children.iter().find(|p| p.key.value == key)
    }
}

#[derive(Clone, Copy, Debug)]
pub enum PathSeg<'p> {
    Key(&'p str),
    Index(usize),
}

impl<'p> From<&'p str> for PathSeg<'p> {
    fn from(k: &'p str) -> Self {
        PathSeg::Key(k)
    }
}
impl From<usize> for PathSeg<'_> {
    fn from(i: usize) -> Self {
        PathSeg::Index(i)
    }
}

/// `nodeAtPath(ast, ['blocks', 0, 'type'])` → `node_at_path(ast, &["blocks".into(), 0.into(), "type".into()])`
pub fn node_at_path<'n, 'a>(node: &'n JsonNode<'a>, path: &[PathSeg]) -> Option<&'n JsonNode<'a>> {
    node.at_path(path)
}

impl<'a> JsonRef<'a> {
    pub fn kind(&self) -> JsonKind {
        match self {
            JsonRef::Object(_) => JsonKind::Object,
            JsonRef::Array(_) => JsonKind::Array,
            JsonRef::Property(_) => JsonKind::Property,
            JsonRef::Identifier(_) => JsonKind::Identifier,
            JsonRef::Literal(_) => JsonKind::Literal,
        }
    }
    pub fn loc(&self) -> Loc {
        match self {
            JsonRef::Object(n) => n.loc,
            JsonRef::Array(n) => n.loc,
            JsonRef::Property(n) => n.loc,
            JsonRef::Identifier(n) => n.loc,
            JsonRef::Literal(n) => n.loc,
        }
    }
    pub fn ptr_eq(&self, other: &JsonRef<'a>) -> bool {
        self.addr() == other.addr() && self.kind() == other.kind()
    }
    pub fn addr(&self) -> usize {
        match self {
            JsonRef::Object(n) => *n as *const _ as usize,
            JsonRef::Array(n) => *n as *const _ as usize,
            JsonRef::Property(n) => *n as *const _ as usize,
            JsonRef::Identifier(n) => *n as *const _ as usize,
            JsonRef::Literal(n) => *n as *const _ as usize,
        }
    }

    /// Pushes children the way `visitJSON` does: keys in order, arrays last-to-first. For a
    /// Property that is `key` then `value`, so the value pops (and is visited) first.
    pub fn push_children(self, stack: &mut Vec<(JsonRef<'a>, usize)>, depth: usize) {
        match self {
            JsonRef::Object(o) => {
                for p in o.children.iter().rev() {
                    stack.push((JsonRef::Property(p), depth));
                }
            }
            JsonRef::Array(a) => {
                for v in a.children.iter().rev() {
                    stack.push((v.to_ref(), depth));
                }
            }
            JsonRef::Property(p) => {
                stack.push((JsonRef::Identifier(&p.key), depth));
                stack.push((p.value.to_ref(), depth));
            }
            JsonRef::Identifier(_) | JsonRef::Literal(_) => {}
        }
    }
}

/// `visitJSON`: same traversal as `visit_liquid` (exit fires right after children are queued).
pub fn visit_json<'a>(root: JsonRef<'a>, mut visit: impl FnMut(JsonRef<'a>, &[JsonRef<'a>], bool)) {
    let mut stack = vec![(root, 0usize)];
    let mut path: Vec<JsonRef<'a>> = Vec::new();
    while let Some((node, depth)) = stack.pop() {
        path.truncate(depth);
        visit(node, &path, false);
        node.push_children(&mut stack, depth + 1);
        visit(node, &path, true);
        path.push(node);
    }
}

// ---------------------------------------------------------------------------------------------
// Errors

/// jsonc-parser `ParseErrorCode`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum ErrorCode {
    InvalidSymbol = 1,
    InvalidNumberFormat = 2,
    PropertyNameExpected = 3,
    ValueExpected = 4,
    ColonExpected = 5,
    CommaExpected = 6,
    CloseBraceExpected = 7,
    CloseBracketExpected = 8,
    EndOfFileExpected = 9,
    InvalidCommentToken = 10,
    UnexpectedEndOfComment = 11,
    UnexpectedEndOfString = 12,
    UnexpectedEndOfNumber = 13,
    InvalidUnicode = 14,
    InvalidEscapeCharacter = 15,
    InvalidCharacter = 16,
}

impl ErrorCode {
    /// `PARSE_ERROR_MESSAGES` in utils/error.ts (what `asError(parseError).message` gives).
    pub fn message(self) -> &'static str {
        use ErrorCode::*;
        match self {
            InvalidSymbol => "Invalid symbol found in the input.",
            InvalidNumberFormat => "Invalid number format detected.",
            PropertyNameExpected => "Property name expected but not found.",
            ValueExpected => "A value was expected but not found.",
            ColonExpected => "Colon `:` expected after the property name.",
            CommaExpected => "Comma `,` expected between elements and properties.",
            CloseBraceExpected => "Closing brace `}` expected.",
            CloseBracketExpected => "Closing bracket `]` expected.",
            EndOfFileExpected => "End of file expected.",
            InvalidCommentToken => "Invalid comment token found.",
            UnexpectedEndOfComment => "Unexpected end of comment.",
            UnexpectedEndOfString => "Unexpected end of string.",
            UnexpectedEndOfNumber => "Unexpected end of number.",
            InvalidUnicode => "Invalid Unicode escape sequence.",
            InvalidEscapeCharacter => "Invalid escape character found.",
            InvalidCharacter => "Invalid character found in the input.",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ParseError {
    pub error: ErrorCode,
    pub offset: usize,
    pub length: usize,
}

/// TS `JSONCParseErrors` (message 'Failed to parse JSONC').
#[derive(Clone, Debug)]
pub struct JsonParseErrors {
    pub errors: Vec<ParseError>,
}

impl JsonParseErrors {
    pub const MESSAGE: &'static str = "Failed to parse JSONC";
}

// ---------------------------------------------------------------------------------------------
// Scanner (jsonc-parser impl/scanner.js)

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Tok {
    OpenBrace,
    CloseBrace,
    OpenBracket,
    CloseBracket,
    Comma,
    Colon,
    Null,
    True,
    False,
    String,
    Number,
    LineComment,
    BlockComment,
    LineBreak,
    Trivia,
    Unknown,
    Eof,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ScanError {
    None,
    UnexpectedEndOfComment,
    UnexpectedEndOfString,
    UnexpectedEndOfNumber,
    InvalidUnicode,
    InvalidEscapeCharacter,
    InvalidCharacter,
}

pub(crate) struct Scanner<'a> {
    text: &'a str,
    b: &'a [u8],
    pub(crate) pos: usize,
    /// Decoded string token value; for numbers see `number_end`.
    pub(crate) value: Cow<'a, str>,
    number_end: usize,
    pub(crate) token_offset: usize,
    pub(crate) token: Tok,
    pub(crate) error: ScanError,
}

fn is_ws(c: u8) -> bool {
    c == b' ' || c == b'\t'
}
fn is_lb(c: u8) -> bool {
    c == b'\n' || c == b'\r'
}

impl<'a> Scanner<'a> {
    pub(crate) fn new(text: &'a str) -> Self {
        Scanner {
            text,
            b: text.as_bytes(),
            pos: 0,
            value: Cow::Borrowed(""),
            number_end: 0,
            token_offset: 0,
            token: Tok::Unknown,
            error: ScanError::None,
        }
    }

    /// `text.charCodeAt(i)`; 0 past the end stands in for NaN (never equal to what's tested).
    fn at(&self, i: usize) -> u8 {
        self.b.get(i).copied().unwrap_or(0)
    }

    pub(crate) fn token_len(&self) -> usize {
        self.pos - self.token_offset
    }

    fn scan_hex4(&mut self) -> Option<u32> {
        let mut value = 0u32;
        for _ in 0..4 {
            let c = self.at(self.pos);
            let d = match c {
                b'0'..=b'9' => c - b'0',
                b'A'..=b'F' => c - b'A' + 10,
                b'a'..=b'f' => c - b'a' + 10,
                _ => return None,
            };
            value = value * 16 + d as u32;
            self.pos += 1;
        }
        Some(value)
    }

    fn scan_number(&mut self) -> usize {
        let len = self.b.len();
        if self.at(self.pos) == b'0' {
            self.pos += 1;
        } else {
            self.pos += 1;
            while self.pos < len && self.at(self.pos).is_ascii_digit() {
                self.pos += 1;
            }
        }
        if self.pos < len && self.at(self.pos) == b'.' {
            self.pos += 1;
            if self.pos < len && self.at(self.pos).is_ascii_digit() {
                self.pos += 1;
                while self.pos < len && self.at(self.pos).is_ascii_digit() {
                    self.pos += 1;
                }
            } else {
                self.error = ScanError::UnexpectedEndOfNumber;
                return self.pos;
            }
        }
        let mut end = self.pos;
        if self.pos < len && (self.at(self.pos) == b'E' || self.at(self.pos) == b'e') {
            self.pos += 1;
            // Upstream's `a && b || c` precedence: '-' is accepted even past the end check.
            if (self.pos < len && self.at(self.pos) == b'+') || self.at(self.pos) == b'-' {
                self.pos += 1;
            }
            if self.pos < len && self.at(self.pos).is_ascii_digit() {
                self.pos += 1;
                while self.pos < len && self.at(self.pos).is_ascii_digit() {
                    self.pos += 1;
                }
                end = self.pos;
            } else {
                self.error = ScanError::UnexpectedEndOfNumber;
            }
        }
        end
    }

    fn scan_string(&mut self) -> Cow<'a, str> {
        let len = self.b.len();
        let mut start = self.pos;
        let mut owned: Option<String> = None;
        // A `\uD8xx` escape waiting for its low half (JS strings hold lone surrogates; Rust
        // strings can't, so an unpaired one becomes U+FFFD).
        let mut high: Option<u32> = None;
        let mut closed = false;
        fn flush(out: &mut String, high: &mut Option<u32>) {
            if high.take().is_some() {
                out.push('\u{FFFD}');
            }
        }
        loop {
            if self.pos >= len {
                self.error = ScanError::UnexpectedEndOfString;
                break;
            }
            let ch = self.b[self.pos];
            if ch == b'"' {
                closed = true;
                break;
            }
            if ch == b'\\' {
                let out = owned.get_or_insert_with(String::new);
                if start < self.pos {
                    flush(out, &mut high);
                    out.push_str(&self.text[start..self.pos]);
                }
                self.pos += 1;
                if self.pos >= len {
                    self.error = ScanError::UnexpectedEndOfString;
                    start = self.pos;
                    break;
                }
                let ch2 = self.b[self.pos];
                self.pos += 1;
                let simple = match ch2 {
                    b'"' => Some('"'),
                    b'\\' => Some('\\'),
                    b'/' => Some('/'),
                    b'b' => Some('\u{8}'),
                    b'f' => Some('\u{c}'),
                    b'n' => Some('\n'),
                    b'r' => Some('\r'),
                    b't' => Some('\t'),
                    _ => None,
                };
                if let Some(c) = simple {
                    flush(out, &mut high);
                    out.push(c);
                } else if ch2 == b'u' {
                    match self.scan_hex4() {
                        Some(cu) if (0xDC00..0xE000).contains(&cu) => match high.take() {
                            Some(h) => out.push(
                                char::from_u32(0x10000 + ((h - 0xD800) << 10) + (cu - 0xDC00))
                                    .unwrap(),
                            ),
                            None => out.push('\u{FFFD}'),
                        },
                        Some(cu) if (0xD800..0xDC00).contains(&cu) => {
                            flush(out, &mut high);
                            high = Some(cu);
                        }
                        Some(cu) => {
                            flush(out, &mut high);
                            out.push(char::from_u32(cu).unwrap());
                        }
                        None => self.error = ScanError::InvalidUnicode,
                    }
                } else {
                    // Upstream drops the escaped character (after `pos++`).
                    self.error = ScanError::InvalidEscapeCharacter;
                    if ch2 >= 0x80 {
                        // Keep `pos` on a char boundary: JS skips one UTF-16 unit, we skip the
                        // whole character. ponytail: an escaped astral char drops both halves.
                        while self.pos < len && (self.b[self.pos] & 0xC0) == 0x80 {
                            self.pos += 1;
                        }
                    }
                }
                start = self.pos;
                continue;
            }
            if ch <= 0x1f {
                if is_lb(ch) {
                    self.error = ScanError::UnexpectedEndOfString;
                    break;
                }
                self.error = ScanError::InvalidCharacter;
            }
            self.pos += 1;
        }
        let tail = &self.text[start..self.pos.min(len)];
        let result = match owned {
            None => Cow::Borrowed(tail),
            Some(mut s) => {
                if !tail.is_empty() {
                    flush(&mut s, &mut high);
                    s.push_str(tail);
                }
                flush(&mut s, &mut high);
                Cow::Owned(s)
            }
        };
        if closed {
            self.pos += 1;
        }
        result
    }

    pub(crate) fn scan(&mut self) -> Tok {
        self.error = ScanError::None;
        self.token_offset = self.pos;
        let len = self.b.len();
        if self.pos >= len {
            self.token_offset = len;
            self.token = Tok::Eof;
            return Tok::Eof;
        }
        let code = self.b[self.pos];
        let tok = if is_ws(code) {
            while is_ws(self.at(self.pos)) && self.pos < len {
                self.pos += 1;
            }
            Tok::Trivia
        } else if is_lb(code) {
            self.pos += 1;
            if code == b'\r' && self.at(self.pos) == b'\n' {
                self.pos += 1;
            }
            Tok::LineBreak
        } else {
            match code {
                b'{' => {
                    self.pos += 1;
                    Tok::OpenBrace
                }
                b'}' => {
                    self.pos += 1;
                    Tok::CloseBrace
                }
                b'[' => {
                    self.pos += 1;
                    Tok::OpenBracket
                }
                b']' => {
                    self.pos += 1;
                    Tok::CloseBracket
                }
                b':' => {
                    self.pos += 1;
                    Tok::Colon
                }
                b',' => {
                    self.pos += 1;
                    Tok::Comma
                }
                b'"' => {
                    self.pos += 1;
                    self.value = self.scan_string();
                    Tok::String
                }
                b'/' => {
                    if self.at(self.pos + 1) == b'/' {
                        self.pos += 2;
                        while self.pos < len && !is_lb(self.b[self.pos]) {
                            self.pos += 1;
                        }
                        Tok::LineComment
                    } else if self.at(self.pos + 1) == b'*' {
                        self.pos += 2;
                        let safe_len = len.saturating_sub(1);
                        let mut closed = false;
                        while self.pos < safe_len {
                            if self.b[self.pos] == b'*' && self.b[self.pos + 1] == b'/' {
                                self.pos += 2;
                                closed = true;
                                break;
                            }
                            self.pos += 1;
                        }
                        if !closed {
                            // May step one past the end, like upstream.
                            self.pos += 1;
                            self.error = ScanError::UnexpectedEndOfComment;
                        }
                        Tok::BlockComment
                    } else {
                        self.pos += 1;
                        Tok::Unknown
                    }
                }
                b'-' if !(self.pos + 1 < len && self.b[self.pos + 1].is_ascii_digit()) => {
                    self.pos += 1;
                    Tok::Unknown
                }
                b'-' | b'0'..=b'9' => {
                    if code == b'-' {
                        self.pos += 1;
                    }
                    self.number_end = self.scan_number();
                    Tok::Number
                }
                _ => {
                    while self.pos < len && is_unknown_content(self.b[self.pos]) {
                        self.pos += 1;
                    }
                    if self.token_offset != self.pos {
                        match &self.text[self.token_offset..self.pos] {
                            "true" => Tok::True,
                            "false" => Tok::False,
                            "null" => Tok::Null,
                            _ => Tok::Unknown,
                        }
                    } else {
                        // Unreachable in practice (every char not handled above is content).
                        self.pos += self.text[self.pos..]
                            .chars()
                            .next()
                            .map_or(1, char::len_utf8);
                        Tok::Unknown
                    }
                }
            }
        };
        self.token = tok;
        tok
    }

    pub(crate) fn number_value(&self) -> &'a str {
        &self.text[self.token_offset..self.number_end]
    }
}

fn is_unknown_content(c: u8) -> bool {
    !(is_ws(c) || is_lb(c) || matches!(c, b'}' | b']' | b'{' | b'[' | b'"' | b':' | b',' | b'/'))
}

// ---------------------------------------------------------------------------------------------
// Parser (jsonc-parser impl/parser.js `visit`), with comments allowed.

trait Visitor<'a> {
    fn object_begin(&mut self, offset: usize);
    fn object_property(&mut self, name: Cow<'a, str>, offset: usize, length: usize);
    fn object_end(&mut self, offset: usize, length: usize);
    fn array_begin(&mut self, offset: usize);
    fn array_end(&mut self, offset: usize, length: usize);
    fn literal(&mut self, value: Lit<'a>, offset: usize, length: usize);
    fn error(&mut self, e: ParseError);
}

struct Parser<'a, 'v, V: Visitor<'a>> {
    s: Scanner<'a>,
    v: &'v mut V,
    allow_trailing_comma: bool,
    /// Objects and arrays open around the token.
    depth: usize,
}

impl<'a, 'v, V: Visitor<'a>> Parser<'a, 'v, V> {
    fn on_error(&mut self, error: ErrorCode) {
        let e = ParseError {
            error,
            offset: self.s.token_offset,
            length: self.s.token_len(),
        };
        self.v.error(e);
    }

    fn scan_next(&mut self) -> Tok {
        loop {
            let token = self.s.scan();
            match self.s.error {
                ScanError::InvalidUnicode => self.on_error(ErrorCode::InvalidUnicode),
                ScanError::InvalidEscapeCharacter => {
                    self.on_error(ErrorCode::InvalidEscapeCharacter)
                }
                ScanError::UnexpectedEndOfNumber => self.on_error(ErrorCode::UnexpectedEndOfNumber),
                ScanError::UnexpectedEndOfComment => {
                    self.on_error(ErrorCode::UnexpectedEndOfComment)
                }
                ScanError::UnexpectedEndOfString => self.on_error(ErrorCode::UnexpectedEndOfString),
                ScanError::InvalidCharacter => self.on_error(ErrorCode::InvalidCharacter),
                ScanError::None => {}
            }
            match token {
                Tok::LineComment | Tok::BlockComment | Tok::Trivia | Tok::LineBreak => {}
                Tok::Unknown => self.on_error(ErrorCode::InvalidSymbol),
                _ => return token,
            }
        }
    }

    fn handle_error(&mut self, error: ErrorCode, skip_until_after: &[Tok], skip_until: &[Tok]) {
        self.on_error(error);
        if skip_until_after.len() + skip_until.len() > 0 {
            let mut token = self.s.token;
            while token != Tok::Eof {
                if skip_until_after.contains(&token) {
                    self.scan_next();
                    break;
                } else if skip_until.contains(&token) {
                    break;
                }
                token = self.scan_next();
            }
        }
    }

    fn parse_string(&mut self, is_value: bool) {
        let value = std::mem::replace(&mut self.s.value, Cow::Borrowed(""));
        let (offset, len) = (self.s.token_offset, self.s.token_len());
        if is_value {
            self.v.literal(Lit::Str(value), offset, len);
        } else {
            self.v.object_property(value, offset, len);
        }
        self.scan_next();
    }

    fn parse_literal(&mut self) -> bool {
        let (offset, len) = (self.s.token_offset, self.s.token_len());
        let lit = match self.s.token {
            Tok::Number => {
                // `Number(tokenValue)`: the token always matches JSON number syntax (maybe with
                // a trailing '.'), which Rust's f64 parser also accepts. Never NaN.
                let n = self.s.number_value().parse::<f64>().unwrap_or(0.0);
                Lit::Num(n)
            }
            Tok::Null => Lit::Null,
            Tok::True => Lit::Bool(true),
            Tok::False => Lit::Bool(false),
            _ => return false,
        };
        self.v.literal(lit, offset, len);
        self.scan_next();
        true
    }

    fn parse_property(&mut self) -> bool {
        use Tok::*;
        if self.s.token != String {
            self.handle_error(ErrorCode::PropertyNameExpected, &[], &[CloseBrace, Comma]);
            return false;
        }
        self.parse_string(false);
        if self.s.token == Colon {
            self.scan_next();
            if !self.parse_value() {
                self.handle_error(ErrorCode::ValueExpected, &[], &[CloseBrace, Comma]);
            }
        } else {
            self.handle_error(ErrorCode::ColonExpected, &[], &[CloseBrace, Comma]);
        }
        true
    }

    fn parse_object(&mut self) -> bool {
        use Tok::*;
        self.v.object_begin(self.s.token_offset);
        self.scan_next();
        let mut needs_comma = false;
        while self.s.token != CloseBrace && self.s.token != Eof {
            if self.s.token == Comma {
                if !needs_comma {
                    self.handle_error(ErrorCode::ValueExpected, &[], &[]);
                }
                self.scan_next();
                if self.s.token == CloseBrace && self.allow_trailing_comma {
                    break;
                }
            } else if needs_comma {
                self.handle_error(ErrorCode::CommaExpected, &[], &[]);
            }
            if !self.parse_property() {
                self.handle_error(ErrorCode::ValueExpected, &[], &[CloseBrace, Comma]);
            }
            needs_comma = true;
        }
        self.v.object_end(self.s.token_offset, self.s.token_len());
        if self.s.token != CloseBrace {
            self.handle_error(ErrorCode::CloseBraceExpected, &[CloseBrace], &[]);
        } else {
            self.scan_next();
        }
        true
    }

    fn parse_array(&mut self) -> bool {
        use Tok::*;
        self.v.array_begin(self.s.token_offset);
        self.scan_next();
        let mut needs_comma = false;
        while self.s.token != CloseBracket && self.s.token != Eof {
            if self.s.token == Comma {
                if !needs_comma {
                    self.handle_error(ErrorCode::ValueExpected, &[], &[]);
                }
                self.scan_next();
                if self.s.token == CloseBracket && self.allow_trailing_comma {
                    break;
                }
            } else if needs_comma {
                self.handle_error(ErrorCode::CommaExpected, &[], &[]);
            }
            if !self.parse_value() {
                self.handle_error(ErrorCode::ValueExpected, &[], &[CloseBracket, Comma]);
            }
            needs_comma = true;
        }
        self.v.array_end(self.s.token_offset, self.s.token_len());
        if self.s.token != CloseBracket {
            self.handle_error(ErrorCode::CloseBracketExpected, &[CloseBracket], &[]);
        } else {
            self.scan_next();
        }
        true
    }

    fn parse_value(&mut self) -> bool {
        match self.s.token {
            // ponytail: jsonc-parser recurses until it throws a RangeError, so TS fails the whole
            // file. This only rejects the too-deep value.
            Tok::OpenBracket | Tok::OpenBrace if self.depth == liquid_parser::MAX_DEPTH => false,
            Tok::OpenBracket | Tok::OpenBrace => {
                self.depth += 1;
                let ok = if self.s.token == Tok::OpenBracket {
                    self.parse_array()
                } else {
                    self.parse_object()
                };
                self.depth -= 1;
                ok
            }
            Tok::String => {
                self.parse_string(true);
                true
            }
            _ => self.parse_literal(),
        }
    }

    fn run(&mut self) {
        self.scan_next();
        if self.s.token == Tok::Eof {
            // allowEmptyContent is false for both parse() and parseTree() here.
            self.handle_error(ErrorCode::ValueExpected, &[], &[]);
            return;
        }
        if !self.parse_value() {
            self.handle_error(ErrorCode::ValueExpected, &[], &[]);
            return;
        }
        if self.s.token != Tok::Eof {
            self.handle_error(ErrorCode::EndOfFileExpected, &[], &[]);
        }
    }
}

fn run_visitor<'a, V: Visitor<'a>>(text: &'a str, v: &mut V, allow_trailing_comma: bool) {
    Parser {
        s: Scanner::new(text),
        v,
        allow_trailing_comma,
        depth: 0,
    }
    .run();
}

// ---------------------------------------------------------------------------------------------
// toJSONNode (parseTree + jsoncToJsonAst). The tree only matters when there are no errors, so the
// builder stops building at the first one and just collects errors.

enum Frame<'a> {
    Object(
        usize,
        Vec<PropertyNode<'a>>,
        Option<(IdentifierNode<'a>, usize)>,
    ),
    Array(
        usize,
        Vec<JsonNode<'a>>,
        Option<(IdentifierNode<'a>, usize)>,
    ),
}

struct TreeBuilder<'a> {
    stack: Vec<Frame<'a>>,
    /// Pending property key of the innermost object (with its start offset).
    key: Option<(IdentifierNode<'a>, usize)>,
    root: Option<JsonNode<'a>>,
    errors: Vec<ParseError>,
}

impl<'a> TreeBuilder<'a> {
    fn push_value(&mut self, v: JsonNode<'a>) {
        let end = v.loc().end;
        match self.stack.last_mut() {
            None => self.root = Some(v),
            Some(Frame::Array(_, items, _)) => items.push(v),
            Some(Frame::Object(_, props, _)) => {
                if let Some((key, start)) = self.key.take() {
                    props.push(PropertyNode {
                        key,
                        value: v,
                        loc: Loc { start, end },
                    });
                }
            }
        }
    }
}

impl<'a> Visitor<'a> for TreeBuilder<'a> {
    fn object_begin(&mut self, offset: usize) {
        if self.errors.is_empty() {
            let key = self.key.take();
            self.stack.push(Frame::Object(offset, Vec::new(), key));
        }
    }
    fn object_property(&mut self, name: Cow<'a, str>, offset: usize, length: usize) {
        if self.errors.is_empty() {
            let loc = Loc {
                start: offset,
                end: offset + length,
            };
            self.key = Some((IdentifierNode { value: name, loc }, offset));
        }
    }
    fn object_end(&mut self, offset: usize, length: usize) {
        if !self.errors.is_empty() {
            return;
        }
        if let Some(Frame::Object(start, children, key)) = self.stack.pop() {
            self.key = key;
            let loc = Loc {
                start,
                end: offset + length,
            };
            self.push_value(JsonNode::Object(ObjectNode { children, loc }));
        }
    }
    fn array_begin(&mut self, offset: usize) {
        if self.errors.is_empty() {
            let key = self.key.take();
            self.stack.push(Frame::Array(offset, Vec::new(), key));
        }
    }
    fn array_end(&mut self, offset: usize, length: usize) {
        if !self.errors.is_empty() {
            return;
        }
        if let Some(Frame::Array(start, children, key)) = self.stack.pop() {
            self.key = key;
            let loc = Loc {
                start,
                end: offset + length,
            };
            self.push_value(JsonNode::Array(ArrayNode { children, loc }));
        }
    }
    fn literal(&mut self, value: Lit<'a>, offset: usize, length: usize) {
        if self.errors.is_empty() {
            let loc = Loc {
                start: offset,
                end: offset + length,
            };
            self.push_value(JsonNode::Literal(LiteralNode { value, loc }));
        }
    }
    fn error(&mut self, e: ParseError) {
        self.errors.push(e);
    }
}

/// `toJSONNode` / `toJSONAST`: the json-to-ast shaped tree, or every parse error.
pub fn to_json_node(source: &str) -> Result<JsonNode<'_>, JsonParseErrors> {
    let mut b = TreeBuilder {
        stack: Vec::new(),
        key: None,
        root: None,
        errors: Vec::new(),
    };
    run_visitor(source, &mut b, true);
    match b.root {
        Some(root) if b.errors.is_empty() => Ok(root),
        _ => Err(JsonParseErrors { errors: b.errors }),
    }
}

// ---------------------------------------------------------------------------------------------
// parse() → JS value, mirrored on serde_json::Value with JS object key order.

enum Slot {
    None,
    Index(usize),
    Key(String),
}

enum Container {
    Object(Map<String, Value>, Slot),
    Array(Vec<Value>, Slot),
}

struct ValueBuilder {
    /// `previousParents` + `currentParent`; index 0 is the artificial root array.
    stack: Vec<Container>,
    current_property: Option<String>,
    first_error: Option<ParseError>,
    errors: usize,
}

impl ValueBuilder {
    /// `onValue`: arrays push, objects assign `currentParent[currentProperty]` if set.
    fn slot_for(&mut self, value: Value) -> Slot {
        match self.stack.last_mut().unwrap() {
            Container::Array(items, _) => {
                items.push(value);
                Slot::Index(items.len() - 1)
            }
            Container::Object(map, _) => match &self.current_property {
                Some(k) => {
                    js_insert(map, k.clone(), value);
                    Slot::Key(k.clone())
                }
                None => Slot::None,
            },
        }
    }
    fn close(&mut self) {
        // `currentParent = previousParents.pop()`; the closed container is final now, so write it
        // into the slot `onValue` reserved for it.
        if self.stack.len() < 2 {
            return;
        }
        let (value, slot) = match self.stack.pop().unwrap() {
            Container::Object(m, s) => (Value::Object(m), s),
            Container::Array(a, s) => (Value::Array(a), s),
        };
        match (self.stack.last_mut().unwrap(), slot) {
            (Container::Array(items, _), Slot::Index(i)) => items[i] = value,
            (Container::Object(map, _), Slot::Key(k)) => {
                map.insert(k, value);
            }
            _ => {}
        }
    }
}

impl<'a> Visitor<'a> for ValueBuilder {
    fn object_begin(&mut self, _: usize) {
        let slot = self.slot_for(Value::Null);
        self.stack.push(Container::Object(Map::new(), slot));
        self.current_property = None;
    }
    fn object_property(&mut self, name: Cow<'a, str>, _: usize, _: usize) {
        self.current_property = Some(name.into_owned());
    }
    fn object_end(&mut self, _: usize, _: usize) {
        self.close();
    }
    fn array_begin(&mut self, _: usize) {
        let slot = self.slot_for(Value::Null);
        self.stack.push(Container::Array(Vec::new(), slot));
        self.current_property = None;
    }
    fn array_end(&mut self, _: usize, _: usize) {
        self.close();
    }
    fn literal(&mut self, value: Lit<'a>, _: usize, _: usize) {
        let v = match value {
            Lit::Str(s) => Value::String(s.into_owned()),
            Lit::Num(n) => js_number_value(n),
            Lit::Bool(b) => Value::Bool(b),
            Lit::Null => Value::Null,
        };
        self.slot_for(v);
    }
    fn error(&mut self, e: ParseError) {
        if self.first_error.is_none() {
            self.first_error = Some(e);
        }
        self.errors += 1;
    }
}

/// jsonc-parser `parse(text, errors, { allowTrailingComma, allowEmptyContent: false })`: the
/// fault-tolerant value (`None` for JS `undefined`) and the first error, if any.
pub fn parse(source: &str) -> (Option<Value>, Option<ParseError>) {
    parse_with(source, true)
}

/// `parse(text, errors, { allowTrailingComma })`; jsonc-parser's default options disallow it.
pub fn parse_with(source: &str, allow_trailing_comma: bool) -> (Option<Value>, Option<ParseError>) {
    let mut b = ValueBuilder {
        stack: vec![Container::Array(Vec::new(), Slot::None)],
        current_property: None,
        first_error: None,
        errors: 0,
    };
    run_visitor(source, &mut b, allow_trailing_comma);
    let root = match b.stack.into_iter().next() {
        Some(Container::Array(items, _)) => items.into_iter().next(),
        _ => None,
    };
    (root, b.first_error)
}

/// `parseJSON(source)` / `parseJSON(source, undefined, false)`: tolerant, `None` = `undefined`.
pub fn parse_json(source: &str) -> Option<Value> {
    parse(source).0
}

/// `parseJSON(source, undefined, true)`: `Err(message)` (the TS Error's message) on any error.
pub fn parse_json_strict(source: &str) -> Result<Option<Value>, &'static str> {
    match parse(source) {
        (_, Some(e)) => Err(e.error.message()),
        (v, None) => Ok(v),
    }
}

/// JS integer-like property keys ("0", "42") come first, in numeric order.
pub(crate) fn array_index(k: &str) -> Option<u32> {
    if k.is_empty() || k.len() > 10 || (k.len() > 1 && k.starts_with('0')) {
        return None;
    }
    let n: u64 = k.parse().ok()?;
    (n < u32::MAX as u64).then_some(n as u32)
}

/// `obj[key] = value` with JS key ordering. ponytail: `__proto__` is a plain key here.
pub fn js_insert(map: &mut Map<String, Value>, key: String, value: Value) {
    if let Some(slot) = map.get_mut(&key) {
        *slot = value;
        return;
    }
    match array_index(&key) {
        Some(n) => {
            let at = map
                .keys()
                .take_while(|k| array_index(k).is_some_and(|m| m < n))
                .count();
            map.shift_insert(at, key, value);
        }
        None => {
            map.insert(key, value);
        }
    }
}

/// A JS number as a JSON value: integral values as integers so `Value` prints like JS.
/// ponytail: ±Infinity (e.g. `1e400`) becomes null, as `JSON.stringify` would print it.
pub fn js_number_value(n: f64) -> Value {
    if n.fract() == 0.0 && n.abs() < 9007199254740992.0 {
        Value::from(n as i64)
    } else {
        serde_json::Number::from_f64(n).map_or(Value::Null, Value::Number)
    }
}

/// JS `Number.prototype.toString()` (`${n}`).
pub fn js_number_to_string(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    if n == 0.0 {
        return "0".into();
    }
    // Shortest round-trip digits, as "d.ddde±x".
    let e = format!("{:e}", n.abs());
    let (mantissa, exp) = e.split_once('e').unwrap();
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i32;
    let n10 = exp.parse::<i32>().unwrap() + 1;
    let mut s = String::new();
    if n < 0.0 {
        s.push('-');
    }
    if k <= n10 && n10 <= 21 {
        s.push_str(&digits);
        s.extend(std::iter::repeat('0').take((n10 - k) as usize));
    } else if 0 < n10 && n10 <= 21 {
        s.push_str(&digits[..n10 as usize]);
        s.push('.');
        s.push_str(&digits[n10 as usize..]);
    } else if -6 < n10 && n10 <= 0 {
        s.push_str("0.");
        s.extend(std::iter::repeat('0').take((-n10) as usize));
        s.push_str(&digits);
    } else {
        s.push_str(&digits[..1]);
        if k > 1 {
            s.push('.');
            s.push_str(&digits[1..]);
        }
        s.push('e');
        s.push(if n10 - 1 >= 0 { '+' } else { '-' });
        s.push_str(&(n10 - 1).abs().to_string());
    }
    s
}

/// JS truthiness of a parsed JSON value.
pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn errs(s: &str) -> Vec<(u8, usize, usize)> {
        match to_json_node(s) {
            Ok(_) => vec![],
            Err(e) => e
                .errors
                .iter()
                .map(|e| (e.error as u8, e.offset, e.length))
                .collect(),
        }
    }

    #[test]
    fn rejects_values_past_max_depth() {
        let n = liquid_parser::MAX_DEPTH;
        assert_eq!(errs(&("[".repeat(n) + &"]".repeat(n))), vec![]);
        let deep = "[".repeat(n + 1) + &"]".repeat(n + 1);
        let value_expected = (ErrorCode::ValueExpected as u8, n, 1);
        assert_eq!(errs(&deep)[0], value_expected);
    }

    #[test]
    fn tree_shapes_and_locs() {
        let src = r#"{"a": [1, "x\ny", true], // c
          "b": {"c": null},}"#;
        let ast = to_json_node(src).unwrap();
        let o = ast.as_object().unwrap();
        assert_eq!(
            o.loc,
            Loc {
                start: 0,
                end: src.len()
            }
        );
        assert_eq!(o.children[0].key.value, "a");
        assert_eq!(o.children[0].key.loc, Loc { start: 1, end: 4 });
        assert_eq!(o.children[0].loc, Loc { start: 1, end: 23 });
        let arr = o.children[0].value.as_array().unwrap();
        assert_eq!(
            arr.children[1].as_literal().unwrap().value,
            Lit::Str("x\ny".into())
        );
        let c = ast.at_path(&["b".into(), "c".into()]).unwrap();
        assert_eq!(c.as_literal().unwrap().value, Lit::Null);
    }

    #[test]
    fn errors_match_jsonc_parser() {
        // Expected values from jsonc-parser 3.2.1 `parseTree` / `parse`.
        let cases: &[(&str, &[(u8, usize, usize)], &str)] = &[
            ("", &[(4, 0, 0)], "undefined"),
            ("{", &[(7, 1, 0)], "{}"),
            (r#"{"a" 1}"#, &[(5, 5, 1)], "{}"),
            (r#"{"a": 1 "b": 2}"#, &[(6, 8, 3)], r#"{"a":1,"b":2}"#),
            ("[1,,2]", &[(4, 3, 1)], "[1,2]"),
            (r#""abc"#, &[(12, 0, 4)], r#""abc""#),
            ("/*", &[(11, 0, 3), (4, 2, 1)], "undefined"),
            ("1 2", &[(9, 2, 1)], "1"),
            ("[01]", &[(6, 2, 1)], "[0,1]"),
            (r#""\x""#, &[(15, 0, 4)], r#""""#),
            (r#""\u12""#, &[(14, 0, 6)], r#""""#),
            ("tru", &[(1, 0, 3), (4, 3, 0)], "undefined"),
            (
                r#"{"a": [1, 2"#,
                &[(8, 11, 0), (7, 11, 0)],
                r#"{"a":[1,2]}"#,
            ),
            ("{,}", &[(4, 1, 1)], "{}"),
            (
                "[1e5, -0.5e-3, 1., -]",
                &[(13, 15, 2), (1, 19, 1)],
                "[100000,-0.0005,1]",
            ),
            (r#"{"a":1,}"#, &[], r#"{"a":1}"#),
            ("  \t\r\n x", &[(1, 6, 1), (4, 7, 0)], "undefined"),
            ("[\"a\u{1}b\"]", &[(16, 1, 5)], r#"["a\u0001b"]"#),
            ("\"\\", &[(12, 0, 2)], r#""""#),
        ];
        for (src, want, value) in cases {
            assert_eq!(&errs(src)[..], *want, "errors for {src:?}");
            let got = parse_json(src).map_or("undefined".to_string(), |v| v.to_string());
            assert_eq!(got, *value, "value for {src:?}");
        }
    }

    #[test]
    fn tolerant_values() {
        assert_eq!(
            parse_json(r#"{"b": 1, "2": 2, "1": 1, "b": 3}"#)
                .unwrap()
                .to_string(),
            r#"{"1":1,"2":2,"b":3}"#
        );
        assert_eq!(
            parse_json(r#"{"a": [1, 2"#).unwrap().to_string(),
            r#"{"a":[1,2]}"#
        );
        assert_eq!(parse_json(""), None);
        assert_eq!(
            parse_json_strict("{,}"),
            Err("A value was expected but not found.")
        );
        assert_eq!(parse_json(r#""😀""#).unwrap(), Value::String("😀".into()));
    }

    #[test]
    fn js_numbers() {
        for (n, s) in [
            (1.0, "1"),
            (-1.5, "-1.5"),
            (1e21, "1e+21"),
            (1e20, "100000000000000000000"),
            (1e-7, "1e-7"),
            (0.000001, "0.000001"),
            (123.456, "123.456"),
            (-0.0, "0"),
            (2.5e-10, "2.5e-10"),
        ] {
            assert_eq!(js_number_to_string(n), s);
        }
    }
}
