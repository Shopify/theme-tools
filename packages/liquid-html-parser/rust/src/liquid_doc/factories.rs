//! Port of `src/liquid-doc/factories.ts`.
//!
//! Offsets are byte offsets into the source. The `source` key holds `Null`,
//! which `hydrate` overwrites with the source string.

use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

pub fn make_text_node(value: &str, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => JsVal::node_type(NodeTypes::TextNode),
        "value" => JsVal::str(value),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_liquid_doc_param_node(
    param_name: JsVal,
    param_type: JsVal,
    param_description: JsVal,
    required: bool,
    start: usize,
    end: usize,
) -> JsVal {
    obj! {
        "type" => JsVal::node_type(NodeTypes::LiquidDocParamNode),
        "name" => JsVal::str("param"),
        "paramName" => param_name,
        "paramType" => param_type,
        "paramDescription" => param_description,
        "required" => JsVal::Bool(required),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_liquid_doc_description_node(
    content: JsVal,
    is_implicit: bool,
    is_inline: bool,
    start: usize,
    end: usize,
) -> JsVal {
    obj! {
        "type" => JsVal::node_type(NodeTypes::LiquidDocDescriptionNode),
        "name" => JsVal::str("description"),
        "content" => content,
        "isImplicit" => JsVal::Bool(is_implicit),
        "isInline" => JsVal::Bool(is_inline),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_liquid_doc_example_node(
    content: JsVal,
    is_inline: bool,
    start: usize,
    end: usize,
) -> JsVal {
    obj! {
        "type" => JsVal::node_type(NodeTypes::LiquidDocExampleNode),
        "name" => JsVal::str("example"),
        "content" => content,
        "isInline" => JsVal::Bool(is_inline),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_liquid_doc_prompt_node(content: JsVal, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => JsVal::node_type(NodeTypes::LiquidDocPromptNode),
        "name" => JsVal::str("prompt"),
        "content" => content,
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}
