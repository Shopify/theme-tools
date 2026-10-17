//! The backend wire format that `src/backend.ts` hydrates.
//!
//! `{"ok":true,"ast":...}` or `{"ok":false,"error":{...}}`. The walk is
//! pre-order in key order. Each `Arr` or `Obj` takes the next index on its
//! first visit, from 0, which is the order `hydrateValue` pushes to `objects`.
//! A second visit to the same object writes `{"\u0000alias": n}`,
//! `Undefined` writes `{"\u0000undefined": 0}`, and `ProtoKey` writes
//! `{"\u0000proto": "<name>"}`. No marker takes an index.

use std::collections::HashMap;
use std::fmt::Write;
use std::rc::Rc;

use crate::errors::ParseError;
use crate::js::js_json_stringify_str;
use crate::offsets::Utf16Offsets;
use crate::value::JsVal;

pub fn emit_result(result: &Result<JsVal, ParseError>, offsets: &Utf16Offsets) -> String {
    let mut out = String::new();
    match result {
        Ok(ast) => {
            out.push_str("{\"ok\":true,\"ast\":");
            Emitter::new(offsets, &mut out).value(ast);
            out.push('}');
        }
        Err(error) => {
            out.push_str("{\"ok\":false,\"error\":");
            emit_error(error, offsets, &mut out);
            out.push('}');
        }
    }
    out
}

fn emit_error(error: &ParseError, offsets: &Utf16Offsets, out: &mut String) {
    match error {
        ParseError::LiquidHtmlAstParsing {
            message,
            start,
            end,
            unclosed,
        } => {
            out.push_str("{\"ctor\":\"LiquidHTMLASTParsingError\",\"message\":");
            push_json_string(out, message);
            let _ = write!(
                out,
                ",\"start\":{},\"end\":{},\"unclosed\":",
                offsets.utf16(*start),
                offsets.utf16(*end)
            );
            match unclosed {
                Some(node) => Emitter::new(offsets, out).value(node),
                None => out.push_str("null"),
            }
            out.push('}');
        }
        ParseError::Error { message } => {
            out.push_str("{\"ctor\":\"Error\",\"message\":");
            push_json_string(out, message);
            out.push_str(",\"start\":0,\"end\":0,\"unclosed\":null}");
        }
    }
}

struct Emitter<'a> {
    offsets: &'a Utf16Offsets,
    out: &'a mut String,
    seen: HashMap<usize, usize>,
}

impl<'a> Emitter<'a> {
    fn new(offsets: &'a Utf16Offsets, out: &'a mut String) -> Self {
        Self {
            offsets,
            out,
            seen: HashMap::new(),
        }
    }

    fn value(&mut self, value: &JsVal) {
        match value {
            JsVal::Undefined => self.out.push_str("{\"\\u0000undefined\":0}"),
            JsVal::Null => self.out.push_str("null"),
            JsVal::Bool(flag) => self.out.push_str(if *flag { "true" } else { "false" }),
            JsVal::ProtoKey(name) => {
                self.out.push_str("{\"\\u0000proto\":");
                push_json_string(self.out, name);
                self.out.push('}');
            }
            JsVal::Offset(byte) => {
                let _ = write!(self.out, "{}", self.offsets.utf16(*byte));
            }
            JsVal::OffsetPlusUnits(byte, units) => {
                let _ = write!(self.out, "{}", self.offsets.utf16(*byte) + units);
            }
            JsVal::Str(text) => push_json_string(self.out, text),
            JsVal::Arr(items) => {
                if self.alias(Rc::as_ptr(items) as usize) {
                    return;
                }
                self.out.push('[');
                for (i, item) in items.borrow().iter().enumerate() {
                    if i > 0 {
                        self.out.push(',');
                    }
                    self.value(item);
                }
                self.out.push(']');
            }
            JsVal::Obj(entries) => {
                if self.alias(Rc::as_ptr(entries) as usize) {
                    return;
                }
                self.out.push('{');
                for (i, (key, item)) in entries.borrow().iter().enumerate() {
                    if i > 0 {
                        self.out.push(',');
                    }
                    push_json_string(self.out, key);
                    self.out.push(':');
                    self.value(item);
                }
                self.out.push('}');
            }
        }
    }

    /// Writes an alias marker and returns true when the object at `address`
    /// was already visited. Otherwise gives it the next index.
    fn alias(&mut self, address: usize) -> bool {
        if let Some(index) = self.seen.get(&address) {
            let _ = write!(self.out, "{{\"\\u0000alias\":{index}}}");
            return true;
        }
        let index = self.seen.len();
        self.seen.insert(address, index);
        false
    }
}

fn push_json_string(out: &mut String, text: &str) {
    out.push_str(&js_json_stringify_str(text));
}
