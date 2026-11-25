//! vscode-json-languageservice `parser/jsonParser.js` `parse`: the fault-tolerant document AST and
//! its syntax errors, on jsonc-parser's scanner (json.rs).

use super::FxBuild;
use crate::js::is_space;
use crate::json::{ScanError, Scanner, Tok};
use std::borrow::Cow;
use std::collections::HashMap;

pub enum Kind<'t> {
    Object(Vec<u32>),
    Array(Vec<u32>),
    Property { key: u32, value: Option<u32> },
    Str(Cow<'t, str>),
    Num { value: f64, is_integer: bool },
    Bool(bool),
    Null,
}

pub struct Node<'t> {
    pub offset: usize,
    pub length: usize,
    pub parent: Option<u32>,
    pub kind: Kind<'t>,
}

pub struct SyntaxError {
    pub message: &'static str,
    pub start: usize,
    pub end: usize,
    /// `DiagnosticSeverity.Warning` (duplicate keys); otherwise Error.
    pub warning: bool,
    /// `ErrorCode.TrailingComma`, which `trailingCommas: 'ignore'` drops.
    pub trailing_comma: bool,
}

pub struct Doc<'t> {
    pub nodes: Vec<Node<'t>>,
    pub root: Option<u32>,
    pub errors: Vec<SyntaxError>,
}

impl<'t> Doc<'t> {
    pub fn node(&self, id: u32) -> &Node<'t> {
        &self.nodes[id as usize]
    }

    pub fn str_value(&self, id: u32) -> &str {
        match &self.node(id).kind {
            Kind::Str(s) => s,
            _ => "",
        }
    }

    pub fn type_name(&self, id: u32) -> &'static str {
        match self.node(id).kind {
            Kind::Object(_) => "object",
            Kind::Array(_) => "array",
            Kind::Property { .. } => "property",
            Kind::Str(_) => "string",
            Kind::Num { .. } => "number",
            Kind::Bool(_) => "boolean",
            Kind::Null => "null",
        }
    }
}

enum Seen {
    Node(u32),
    /// Already reported as a duplicate.
    Dup,
}

struct Parser<'t> {
    text: &'t str,
    s: Scanner<'t>,
    nodes: Vec<Node<'t>>,
    errors: Vec<SyntaxError>,
    last_problem_offset: Option<usize>,
}

impl<'t> Parser<'t> {
    fn scan_next(&mut self) -> Tok {
        loop {
            let token = self.s.scan();
            self.check_scan_error();
            if !matches!(
                token,
                Tok::LineComment | Tok::BlockComment | Tok::Trivia | Tok::LineBreak
            ) {
                return token;
            }
        }
    }

    fn error_at_range(
        &mut self,
        message: &'static str,
        start: usize,
        end: usize,
        warning: bool,
        trailing_comma: bool,
    ) {
        if self.errors.is_empty() || Some(start) != self.last_problem_offset {
            self.errors.push(SyntaxError {
                message,
                start,
                end,
                warning,
                trailing_comma,
            });
            self.last_problem_offset = Some(start);
        }
    }

    fn error(
        &mut self,
        message: &'static str,
        node: Option<u32>,
        skip_after: &[Tok],
        skip_until: &[Tok],
    ) -> Option<u32> {
        let mut start = self.s.token_offset;
        let mut end = start + self.s.token_len();
        if start == end && start > 0 {
            // One char back, then back over whitespace. ponytail: JS steps UTF-16 units, so an astral
            // char there covers its low surrogate only.
            let prev = |i: usize| {
                self.text[..i]
                    .char_indices()
                    .next_back()
                    .map_or(0, |(j, _)| j)
            };
            start = prev(start);
            while start > 0 && self.text[start..].chars().next().is_some_and(is_space) {
                start = prev(start);
            }
            end = start + self.text[start..].chars().next().map_or(1, char::len_utf8);
        }
        self.error_at_range(message, start, end, false, false);
        if let Some(n) = node {
            self.finalize(n, false);
        }
        if !skip_after.is_empty() || !skip_until.is_empty() {
            let mut token = self.s.token;
            while token != Tok::Eof {
                if skip_after.contains(&token) {
                    self.scan_next();
                    break;
                } else if skip_until.contains(&token) {
                    break;
                }
                token = self.scan_next();
            }
        }
        node
    }

    fn check_scan_error(&mut self) {
        let message = match self.s.error {
            ScanError::None => return,
            ScanError::InvalidUnicode => "Invalid unicode sequence in string.",
            ScanError::InvalidEscapeCharacter => "Invalid escape character in string.",
            ScanError::UnexpectedEndOfNumber => "Unexpected end of number.",
            ScanError::UnexpectedEndOfComment => "Unexpected end of comment.",
            ScanError::UnexpectedEndOfString => "Unexpected end of string.",
            ScanError::InvalidCharacter => {
                "Invalid characters in string. Control characters must be escaped."
            }
        };
        self.error(message, None, &[], &[]);
    }

    fn finalize(&mut self, n: u32, scan_next: bool) -> Option<u32> {
        let end = self.s.token_offset + self.s.token_len();
        let node = &mut self.nodes[n as usize];
        node.length = end - node.offset;
        if scan_next {
            self.scan_next();
        }
        Some(n)
    }

    fn push(&mut self, parent: Option<u32>, kind: Kind<'t>) -> u32 {
        self.nodes.push(Node {
            offset: self.s.token_offset,
            length: 0,
            parent,
            kind,
        });
        (self.nodes.len() - 1) as u32
    }

    fn add_child(&mut self, n: u32, child: u32) {
        if let Kind::Object(c) | Kind::Array(c) = &mut self.nodes[n as usize].kind {
            c.push(child);
        }
    }

    fn parse_array(&mut self, parent: Option<u32>) -> Option<u32> {
        if self.s.token != Tok::OpenBracket {
            return None;
        }
        let node = self.push(parent, Kind::Array(Vec::new()));
        self.scan_next();
        let mut needs_comma = false;
        while self.s.token != Tok::CloseBracket && self.s.token != Tok::Eof {
            if self.s.token == Tok::Comma {
                if !needs_comma {
                    self.error("Value expected", None, &[], &[]);
                }
                let comma = self.s.token_offset;
                self.scan_next();
                if self.s.token == Tok::CloseBracket {
                    if needs_comma {
                        self.error_at_range("Trailing comma", comma, comma + 1, false, true);
                    }
                    continue;
                }
            } else if needs_comma {
                self.error("Expected comma", None, &[], &[]);
            }
            match self.parse_value(Some(node)) {
                None => {
                    self.error(
                        "Value expected",
                        None,
                        &[],
                        &[Tok::CloseBracket, Tok::Comma],
                    );
                }
                Some(item) => self.add_child(node, item),
            }
            needs_comma = true;
        }
        if self.s.token != Tok::CloseBracket {
            return self.error("Expected comma or closing bracket", Some(node), &[], &[]);
        }
        self.finalize(node, true)
    }

    fn parse_property(
        &mut self,
        parent: u32,
        keys_seen: &mut HashMap<Cow<'t, str>, Seen, FxBuild>,
    ) -> Option<u32> {
        let node = self.push(
            Some(parent),
            Kind::Property {
                key: u32::MAX,
                value: None,
            },
        );
        let key = match self.parse_string(Some(node)) {
            Some(key) => key,
            None if self.s.token == Tok::Unknown => {
                self.error("Property keys must be doublequoted", None, &[], &[]);
                let value = &self.text[self.s.token_offset..self.s.pos.min(self.text.len())];
                let key = self.push(Some(node), Kind::Str(Cow::Borrowed(value)));
                self.nodes[key as usize].length = self.s.token_len();
                self.scan_next();
                key
            }
            None => {
                self.nodes.pop();
                return None;
            }
        };
        if let Kind::Property { key: k, .. } = &mut self.nodes[node as usize].kind {
            *k = key;
        }
        let (key_offset, key_length) = (
            self.nodes[key as usize].offset,
            self.nodes[key as usize].length,
        );
        let key_value = match &self.nodes[key as usize].kind {
            Kind::Str(s) => s.clone(),
            _ => unreachable!(),
        };
        if key_value != "//" {
            match keys_seen.get_mut(&key_value) {
                Some(seen) => {
                    let first = std::mem::replace(seen, Seen::Dup);
                    self.error_at_range(
                        "Duplicate object key",
                        key_offset,
                        key_offset + key_length,
                        true,
                        false,
                    );
                    if let Seen::Node(first) = first {
                        let Kind::Property { key: k, .. } = self.nodes[first as usize].kind else {
                            unreachable!()
                        };
                        let (o, l) = (self.nodes[k as usize].offset, self.nodes[k as usize].length);
                        self.error_at_range("Duplicate object key", o, o + l, true, false);
                    }
                }
                None => {
                    keys_seen.insert(key_value, Seen::Node(node));
                }
            }
        }
        if self.s.token == Tok::Colon {
            self.scan_next();
        } else {
            self.error("Colon expected", None, &[], &[]);
            let key_end = key_offset + key_length;
            if self.s.token == Tok::String
                && self.text[key_end..self.s.token_offset].contains(['\r', '\n'])
            {
                self.nodes[node as usize].length = key_length;
                return Some(node);
            }
        }
        let Some(value) = self.parse_value(Some(node)) else {
            return self.error(
                "Value expected",
                Some(node),
                &[],
                &[Tok::CloseBrace, Tok::Comma],
            );
        };
        if let Kind::Property { value: v, .. } = &mut self.nodes[node as usize].kind {
            *v = Some(value);
        }
        let end = self.nodes[value as usize].offset + self.nodes[value as usize].length;
        let n = &mut self.nodes[node as usize];
        n.length = end - n.offset;
        Some(node)
    }

    fn parse_object(&mut self, parent: Option<u32>) -> Option<u32> {
        if self.s.token != Tok::OpenBrace {
            return None;
        }
        let node = self.push(parent, Kind::Object(Vec::new()));
        let mut keys_seen = HashMap::default();
        self.scan_next();
        let mut needs_comma = false;
        while self.s.token != Tok::CloseBrace && self.s.token != Tok::Eof {
            if self.s.token == Tok::Comma {
                if !needs_comma {
                    self.error("Property expected", None, &[], &[]);
                }
                let comma = self.s.token_offset;
                self.scan_next();
                if self.s.token == Tok::CloseBrace {
                    if needs_comma {
                        self.error_at_range("Trailing comma", comma, comma + 1, false, true);
                    }
                    continue;
                }
            } else if needs_comma {
                self.error("Expected comma", None, &[], &[]);
            }
            match self.parse_property(node, &mut keys_seen) {
                None => {
                    self.error(
                        "Property expected",
                        None,
                        &[],
                        &[Tok::CloseBrace, Tok::Comma],
                    );
                }
                Some(p) => self.add_child(node, p),
            }
            needs_comma = true;
        }
        if self.s.token != Tok::CloseBrace {
            return self.error("Expected comma or closing brace", Some(node), &[], &[]);
        }
        self.finalize(node, true)
    }

    fn parse_string(&mut self, parent: Option<u32>) -> Option<u32> {
        if self.s.token != Tok::String {
            return None;
        }
        let value = std::mem::replace(&mut self.s.value, Cow::Borrowed(""));
        let node = self.push(parent, Kind::Str(value));
        self.finalize(node, true)
    }

    fn parse_number(&mut self, parent: Option<u32>) -> Option<u32> {
        if self.s.token != Tok::Number {
            return None;
        }
        let mut kind = Kind::Num {
            value: f64::NAN,
            is_integer: true,
        };
        if self.s.error == ScanError::None {
            // `JSON.parse(tokenValue)`: the token is valid JSON number syntax here.
            let v = self.s.number_value();
            kind = Kind::Num {
                value: v.parse().unwrap_or(f64::NAN),
                is_integer: !v.contains('.'),
            };
        }
        let node = self.push(parent, kind);
        self.finalize(node, true)
    }

    fn parse_literal(&mut self, parent: Option<u32>) -> Option<u32> {
        let kind = match self.s.token {
            Tok::Null => Kind::Null,
            Tok::True => Kind::Bool(true),
            Tok::False => Kind::Bool(false),
            _ => return None,
        };
        let node = self.push(parent, kind);
        self.finalize(node, true)
    }

    fn parse_value(&mut self, parent: Option<u32>) -> Option<u32> {
        self.parse_array(parent)
            .or_else(|| self.parse_object(parent))
            .or_else(|| self.parse_string(parent))
            .or_else(|| self.parse_number(parent))
            .or_else(|| self.parse_literal(parent))
    }
}

pub fn parse(text: &str) -> Doc<'_> {
    let mut p = Parser {
        text,
        s: Scanner::new(text),
        nodes: Vec::new(),
        errors: Vec::new(),
        last_problem_offset: None,
    };
    let mut root = None;
    if p.scan_next() != Tok::Eof {
        root = p.parse_value(None);
        if root.is_none() {
            p.error("Expected a JSON object, array or literal.", None, &[], &[]);
        } else if p.s.token != Tok::Eof {
            p.error("End of file expected.", None, &[], &[]);
        }
    }
    Doc {
        nodes: p.nodes,
        root,
        errors: p.errors,
    }
}
