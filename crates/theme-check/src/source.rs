//! `to-source-code.ts` and `utils/position.ts`.

use crate::json::{parse_json, to_json_node, JsonNode, JsonParseErrors};
use crate::path;
use crate::visitor::walk;
use liquid_ast::{Document, LiquidRawTag, NodeRef};
use serde_json::Value;
use std::sync::OnceLock;

pub enum Ast<'a> {
    Liquid(Result<Document<'a>, liquid_parser::ParseError>),
    Json(Result<JsonNode<'a>, JsonParseErrors>),
}

pub struct SourceCode<'a> {
    /// `path.normalize(uri)`.
    pub uri: String,
    pub source: &'a str,
    pub ast: Ast<'a>,
    lines: OnceLock<LineIndex>,
    /// The bodies of the `{% schema %}` tags, in document order.
    pub schemas: Vec<SchemaBody<'a>>,
}

/// A `{% schema %}` tag's body, which checks share: it's parsed once in each mode. The AST is
/// parsed with the file, since a lazy one would make `SourceCode` invariant in `'a`, and the
/// recommended checks read it anyway.
pub struct SchemaBody<'a> {
    /// The tag's `blockStartPosition.end`, where the body starts.
    pub offset: usize,
    pub value: &'a str,
    /// `toJSONAST(value)`, with TS's error message.
    pub ast: Result<JsonNode<'a>, String>,
    json: OnceLock<Option<Value>>,
}

impl SchemaBody<'_> {
    /// `parseJSON(value)`, which is tolerant.
    pub fn json(&self) -> Option<&Value> {
        self.json.get_or_init(|| parse_json(self.value)).as_ref()
    }
}

impl<'a> SourceCode<'a> {
    pub fn is_liquid(&self) -> bool {
        matches!(self.ast, Ast::Liquid(_))
    }
    pub fn liquid_ast(&self) -> Option<&Document<'a>> {
        match &self.ast {
            Ast::Liquid(Ok(d)) => Some(d),
            _ => None,
        }
    }
    pub fn json_ast(&self) -> Option<&JsonNode<'a>> {
        match &self.ast {
            Ast::Json(Ok(n)) => Some(n),
            _ => None,
        }
    }
    /// TS `file.ast instanceof Error`.
    pub fn ast_is_error(&self) -> bool {
        matches!(self.ast, Ast::Liquid(Err(_)) | Ast::Json(Err(_)))
    }

    /// `getPosition(source, index)` for a UTF-8 byte offset, in UTF-16 units like TS.
    pub fn position(&self, byte: usize) -> Position {
        self.lines
            .get_or_init(|| LineIndex::new(self.source))
            .position(self.source, byte)
    }

    /// The 0-based line of a UTF-8 byte offset, and the offset's byte column in it.
    pub fn line_column(&self, byte: usize) -> (usize, usize) {
        let starts = &self
            .lines
            .get_or_init(|| LineIndex::new(self.source))
            .starts;
        let line = starts.partition_point(|&(start, _)| start <= byte) - 1;
        (line, byte - starts[line].0)
    }

    /// UTF-16 length of the source (TS `source.length`).
    pub fn len_utf16(&self) -> usize {
        self.lines.get_or_init(|| LineIndex::new(self.source)).len16
    }

    /// The body of `tag`, a `{% schema %}` tag of this file.
    pub fn schema(&self, tag: &LiquidRawTag) -> &SchemaBody<'a> {
        let offset = tag.start_tag.end;
        self.schemas
            .iter()
            .find(|s| s.offset == offset)
            .expect("a schema tag of this file")
    }
}

/// `toSourceCode(uri, source)`: Liquid if the uri ends in `.liquid`, JSON otherwise.
pub fn to_source_code<'a>(uri: &str, source: &'a str) -> SourceCode<'a> {
    let ast = if uri.ends_with(".liquid") {
        Ast::Liquid(liquid_parser::parse(source))
    } else {
        Ast::Json(to_json_node(source))
    };
    let schemas = match &ast {
        Ast::Liquid(Ok(doc)) => walk(NodeRef::Document(doc))
            .filter_map(|n| match n {
                NodeRef::LiquidRawTag(t) if t.name == "schema" => {
                    let (start, end) = (t.start_tag.end, t.end_tag.start);
                    let value = source.get(start..end).unwrap_or_default();
                    Some(SchemaBody {
                        offset: start,
                        value,
                        ast: to_json_node(value).map_err(|_| JsonParseErrors::MESSAGE.to_string()),
                        json: OnceLock::new(),
                    })
                }
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    };
    SourceCode {
        uri: path::normalize(uri),
        source,
        ast,
        lines: OnceLock::new(),
        schemas,
    }
}

/// TS `Position` of an offense: UTF-16 `index`, 0-based `line` and `character`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Position {
    pub index: i64,
    pub line: i64,
    pub character: i64,
}

struct LineIndex {
    /// (byte offset, UTF-16 offset) of each line start.
    starts: Vec<(usize, usize)>,
    len16: usize,
    ascii: bool,
}

fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

impl LineIndex {
    fn new(src: &str) -> Self {
        let ascii = src.is_ascii();
        let mut starts = vec![(0, 0)];
        let mut prev = 0;
        let mut u = 0;
        for (i, _) in src.match_indices('\n') {
            u += if ascii {
                i + 1 - prev
            } else {
                utf16_len(&src[prev..=i])
            };
            prev = i + 1;
            starts.push((prev, u));
        }
        let len16 = if ascii {
            src.len()
        } else {
            u + utf16_len(&src[prev..])
        };
        LineIndex {
            starts,
            len16,
            ascii,
        }
    }

    /// Byte offset → UTF-16 index. Offsets past the end count one unit per byte; "negative"
    /// offsets (TS -1 as `usize::MAX`) stay negative.
    fn to_utf16(&self, src: &str, byte: usize) -> i64 {
        if (byte as isize) < 0 {
            return byte as isize as i64;
        }
        if self.ascii {
            return byte as i64;
        }
        if byte >= src.len() {
            return (self.len16 + (byte - src.len())) as i64;
        }
        let line = self.starts.partition_point(|&(b, _)| b <= byte) - 1;
        let (b0, u0) = self.starts[line];
        let mut end = byte;
        while !src.is_char_boundary(end) {
            end -= 1;
        }
        (u0 + utf16_len(&src[b0..end])) as i64
    }

    fn position(&self, src: &str, byte: usize) -> Position {
        let index = self.to_utf16(src, byte);
        // getPosition: past the end is at the end, negative (an unclosed block's end) is -1.
        if index < 0 {
            return Position {
                index,
                line: -1,
                character: -1,
            };
        }
        let i = index.min(self.len16 as i64);
        let line = self.starts.partition_point(|&(_, u)| u as i64 <= i) - 1;
        Position {
            index,
            line: line as i64,
            character: i - self.starts[line].1 as i64,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positions_are_utf16() {
        let f = to_source_code("file:///a.json", "{\n\"é😀\": 1\n}");
        // '1' is at byte 13: "{\n" (2) + "\"é😀\": " (1+2+4+3 = 10) + ...
        let p = f.position(f.source.find('1').unwrap());
        assert_eq!(
            p,
            Position {
                index: 9,
                line: 1,
                character: 7
            }
        );
        // the end of the file is past its last char; further clamps to it, keeps the index
        let end = f.position(f.source.len());
        assert_eq!(
            end,
            Position {
                index: 12,
                line: 2,
                character: 1
            }
        );
        let past = f.position(f.source.len() + 2);
        assert_eq!(
            past,
            Position {
                index: 14,
                line: 2,
                character: 1
            }
        );
        let empty = to_source_code("file:///b.json", "");
        assert_eq!(
            empty.position(0),
            Position {
                index: 0,
                line: 0,
                character: 0
            }
        );
        assert_eq!(
            f.position(usize::MAX),
            Position {
                index: -1,
                line: -1,
                character: -1
            }
        );
    }
}
