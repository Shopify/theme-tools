//! JS-shaped AST values.
//!
//! The TS parser builds plain JS objects. Some are shared by two nodes, some
//! keys hold `undefined`, and some keys are reassigned after a node is built.
//! `JsVal` follows JS's own rules for all three, so the Rust reads line for
//! line against the TS:
//! - cloning an `Arr` or `Obj` copies the reference, so the clone is shared;
//! - setting a key that exists replaces its value in place, and a new key
//!   appends, which is JS key order for non-integer keys;
//! - `Offset` is a UTF-8 byte offset, converted to UTF-16 only when emitted;
//! - `OffsetPlusUnits` is a byte offset plus a UTF-16 length that is not
//!   source text there, emitted as the offset's UTF-16 value plus the length;
//! - `ProtoKey` names a value inherited from `Object.prototype`.

use std::cell::RefCell;
use std::rc::Rc;

use crate::types::NodeTypes;

#[derive(Clone, Debug)]
pub enum JsVal {
    Undefined,
    Null,
    Bool(bool),
    Offset(usize),
    OffsetPlusUnits(usize, usize),
    Str(String),
    Arr(Rc<RefCell<Vec<JsVal>>>),
    Obj(Rc<RefCell<Vec<(String, JsVal)>>>),
    /// JS `({})[name]`, the value a plain object inherits from
    /// `Object.prototype`. A function or `Object.prototype` cannot cross JSON,
    /// so the name crosses and JS looks the value up.
    ProtoKey(&'static str),
}

/// A JS object literal: `obj! { "type" => a, "value" => b }`, keys in order.
macro_rules! obj {
    ($($key:literal => $value:expr),* $(,)?) => {
        $crate::value::JsVal::object(vec![$(($key, $value)),*])
    };
}

pub(crate) use obj;

impl JsVal {
    /// A new object holding `entries` in order.
    pub fn object(entries: Vec<(&str, JsVal)>) -> JsVal {
        let entries = entries
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect();
        JsVal::Obj(Rc::new(RefCell::new(entries)))
    }

    /// A new array holding `items`.
    pub fn array(items: Vec<JsVal>) -> JsVal {
        JsVal::Arr(Rc::new(RefCell::new(items)))
    }

    pub fn str(value: &str) -> JsVal {
        JsVal::Str(value.to_string())
    }

    /// JS `NodeTypes.X`, the string a node's `type` key holds.
    pub fn node_type(kind: NodeTypes) -> JsVal {
        JsVal::str(kind.as_str())
    }

    /// JS `{ start, end }`, a new position object.
    pub fn position(start: usize, end: usize) -> JsVal {
        obj! { "start" => JsVal::Offset(start), "end" => JsVal::Offset(end) }
    }

    /// JS `{ start, end: start + units }`, where `units` is a UTF-16 length
    /// that is not source text at `start`, so it cannot be a byte count.
    pub fn position_plus_units(start: usize, units: usize) -> JsVal {
        obj! { "start" => JsVal::Offset(start), "end" => JsVal::OffsetPlusUnits(start, units) }
    }

    /// JS `obj[key]`: `undefined` for a missing key or a value that is not an
    /// object.
    pub fn get(&self, key: &str) -> JsVal {
        let JsVal::Obj(entries) = self else {
            return JsVal::Undefined;
        };
        entries
            .borrow()
            .iter()
            .find(|(name, _)| name == key)
            .map_or(JsVal::Undefined, |(_, value)| value.clone())
    }

    /// JS `key in obj` for an own key: `false` for a value that is not an
    /// object.
    pub fn has(&self, key: &str) -> bool {
        let JsVal::Obj(entries) = self else {
            return false;
        };
        entries.borrow().iter().any(|(name, _)| name == key)
    }

    /// The items of an array, as a new `Vec`: empty for a value that is not an
    /// array.
    pub fn items(&self) -> Vec<JsVal> {
        match self {
            JsVal::Arr(items) => items.borrow().clone(),
            _ => Vec::new(),
        }
    }

    /// JS `obj[key] = value`. An existing key keeps its slot.
    pub fn set(&self, key: &str, value: JsVal) {
        let JsVal::Obj(entries) = self else {
            panic!("JsVal::set on a value that is not an object");
        };
        let mut entries = entries.borrow_mut();
        match entries.iter_mut().find(|(name, _)| name == key) {
            Some(slot) => slot.1 = value,
            None => entries.push((key.to_string(), value)),
        }
    }

    /// JS `{ ...obj }`: a new object with the same entries in the same order.
    pub fn spread(&self) -> JsVal {
        let JsVal::Obj(entries) = self else {
            panic!("JsVal::spread on a value that is not an object");
        };
        JsVal::Obj(Rc::new(RefCell::new(entries.borrow().clone())))
    }

    /// The offset held in `self`, which must be an `Offset`.
    pub fn offset(&self) -> usize {
        let JsVal::Offset(offset) = self else {
            panic!("JsVal::offset on a value that is not an offset");
        };
        *offset
    }

    /// JS `self > byte` for an end offset in `source`. TS compares UTF-16
    /// numbers, so an `OffsetPlusUnits` before `byte` counts the units between.
    pub fn offset_after(&self, byte: usize, source: &str) -> bool {
        match *self {
            JsVal::Offset(offset) => offset > byte,
            JsVal::OffsetPlusUnits(offset, units) if offset < byte => {
                units > source[offset..byte].encode_utf16().count()
            }
            JsVal::OffsetPlusUnits(offset, units) => offset > byte || units > 0,
            _ => panic!("JsVal::offset_after on a value that is not an offset"),
        }
    }

    /// JS `node.position.start`.
    pub fn start(&self) -> usize {
        self.get("position").get("start").offset()
    }

    /// JS `node.position.end`.
    pub fn end(&self) -> usize {
        self.get("position").get("end").offset()
    }

    /// JS `node.type === kind`.
    pub fn type_is(&self, kind: &str) -> bool {
        matches!(self.get("type"), JsVal::Str(value) if value == kind)
    }

    /// JS `` `${node.type}` `` for a node whose `type` is a string.
    pub fn type_name(&self) -> String {
        match self.get("type") {
            JsVal::Str(value) => value,
            _ => panic!("JsVal::type_name on a node without a string type"),
        }
    }

    /// JS `node[key]` for a key that holds a string.
    pub fn string(&self, key: &str) -> String {
        match self.get(key) {
            JsVal::Str(value) => value,
            _ => panic!("JsVal::string on a key that does not hold a string"),
        }
    }
}
