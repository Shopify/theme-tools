//! Port of `src/tags/index.ts`: the builtin tag table, in its key order.

use crate::tag_definitions::BranchName::{Else, Elsif, When};
use crate::tag_definitions::TagDefinition::{self, Block, Raw, Tag};

use super::{
    assign, block, r#break, capture, case, content_for, r#continue, cycle, decrement, echo, r#for,
    form, r#if, ifchanged, increment, layout, liquid, paginate, partial, raw, render, section,
    sections,
};

pub static BUILTIN_TAGS: &[(&str, TagDefinition)] = &[
    (
        "assign",
        Tag {
            parse: assign::parse,
        },
    ),
    (
        "block",
        Block {
            parse: block::parse,
            branches: &[],
        },
    ),
    (
        "break",
        Tag {
            parse: r#break::parse,
        },
    ),
    (
        "capture",
        Block {
            parse: capture::parse,
            branches: &[],
        },
    ),
    (
        "case",
        Block {
            parse: case::parse,
            branches: &[When, Else],
        },
    ),
    (
        "content_for",
        Tag {
            parse: content_for::parse,
        },
    ),
    (
        "continue",
        Tag {
            parse: r#continue::parse,
        },
    ),
    (
        "cycle",
        Tag {
            parse: cycle::parse,
        },
    ),
    (
        "decrement",
        Tag {
            parse: decrement::parse,
        },
    ),
    ("echo", Tag { parse: echo::parse }),
    (
        "for",
        Block {
            parse: r#for::parse_for_markup,
            branches: &[Else],
        },
    ),
    (
        "form",
        Block {
            parse: form::parse,
            branches: &[],
        },
    ),
    (
        "if",
        Block {
            parse: r#if::parse_conditional_expression,
            branches: &[Elsif, Else],
        },
    ),
    (
        "ifchanged",
        Block {
            parse: ifchanged::parse,
            branches: &[],
        },
    ),
    (
        "include",
        Tag {
            parse: render::parse_include,
        },
    ),
    (
        "increment",
        Tag {
            parse: increment::parse,
        },
    ),
    (
        "layout",
        Tag {
            parse: layout::parse,
        },
    ),
    (
        "liquid",
        Tag {
            parse: liquid::parse,
        },
    ),
    (
        "paginate",
        Block {
            parse: paginate::parse,
            branches: &[],
        },
    ),
    (
        "partial",
        Block {
            parse: partial::parse,
            branches: &[],
        },
    ),
    (
        "render",
        Tag {
            parse: render::parse_render,
        },
    ),
    (
        "section",
        Tag {
            parse: section::parse,
        },
    ),
    (
        "sections",
        Tag {
            parse: sections::parse,
        },
    ),
    (
        "tablerow",
        Block {
            parse: r#for::parse_for_markup,
            branches: &[Else],
        },
    ),
    (
        "unless",
        Block {
            parse: r#if::parse_conditional_expression,
            branches: &[Elsif, Else],
        },
    ),
    (
        "comment",
        Raw {
            parse_liquid_in_body: Some(false),
            parse: raw::parse_no_markup,
        },
    ),
    (
        "doc",
        Raw {
            parse_liquid_in_body: None,
            parse: raw::parse_no_markup,
        },
    ),
    (
        "javascript",
        Raw {
            parse_liquid_in_body: Some(true),
            parse: raw::parse_no_markup,
        },
    ),
    (
        "raw",
        Raw {
            parse_liquid_in_body: Some(false),
            parse: raw::parse_no_markup,
        },
    ),
    (
        "schema",
        Raw {
            parse_liquid_in_body: Some(false),
            parse: raw::parse_no_markup,
        },
    ),
    (
        "style",
        Raw {
            parse_liquid_in_body: Some(true),
            parse: raw::parse_no_markup,
        },
    ),
    (
        "stylesheet",
        Raw {
            parse_liquid_in_body: Some(true),
            parse: raw::parse_no_markup,
        },
    ),
];

/// TS `Object.hasOwn(builtinTags, name) ? builtinTags[name] : undefined`.
pub fn builtin_tag(name: &str) -> Option<&'static TagDefinition> {
    BUILTIN_TAGS
        .iter()
        .find(|(tag_name, _)| *tag_name == name)
        .map(|(_, definition)| definition)
}
