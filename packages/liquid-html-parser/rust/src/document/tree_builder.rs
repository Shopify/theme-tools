//! Port of `src/document/tree-builder.ts`.
//!
//! Offsets are byte offsets into the source, so a trimmed length is a byte
//! length here.

use crate::document::factories::make_text_node;
use crate::js::{js_is_whitespace, js_trim_end, js_trim_start};
use crate::types::NodeTypes;
use crate::value::JsVal;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChildFilterMode {
    /// Syntactic auto-skip: merge adjacent TextNodes, trim whitespace at boundaries, drop empty.
    Syntactic,
    /// Merge adjacent TextNodes, preserve all whitespace content.
    Preserve,
    /// Merge, then strip whitespace-only TextNodes from first/last positions only.
    StripEdges,
}

pub fn filter_children(mode: ChildFilterMode, children: Vec<JsVal>, source: &str) -> Vec<JsVal> {
    match mode {
        ChildFilterMode::Syntactic => merge_adjacent_text_nodes_trimmed(children, source),
        ChildFilterMode::Preserve => merge_adjacent_text_nodes(children, source),
        ChildFilterMode::StripEdges => merge_adjacent_text_nodes_strip_edges(children, source),
    }
}

fn is_text_node(node: &JsVal) -> bool {
    node.type_is(NodeTypes::TextNode.as_str())
}

fn is_liquid_variable_output(node: &JsVal) -> bool {
    node.type_is(NodeTypes::LiquidVariableOutput.as_str())
}

pub fn merge_adjacent_text_nodes(nodes: Vec<JsVal>, source: &str) -> Vec<JsVal> {
    if nodes.len() <= 1 {
        return nodes;
    }

    let mut result = Vec::new();
    let mut run_start: Option<usize> = None;

    for i in 0..=nodes.len() {
        let node = nodes.get(i);
        let is_text = node.is_some_and(is_text_node);

        if is_text && run_start.is_none() {
            run_start = Some(i);
            continue;
        }

        if let Some(start) = run_start.filter(|_| !is_text) {
            result.push(merged_run(&nodes[start..i], source));
            run_start = None;
        }

        if let Some(node) = node.filter(|_| !is_text) {
            result.push(node.clone());
        }
    }

    result
}

/// One run of adjacent TextNodes: the node itself when the run has one,
/// otherwise a new TextNode spanning the run.
fn merged_run(run: &[JsVal], source: &str) -> JsVal {
    if run.len() == 1 {
        return run[0].clone();
    }
    let start = run[0].start();
    let end = run[run.len() - 1].end();
    make_text_node(&source[start..end], start, end)
}

/// Merge adjacent text nodes then trim whitespace from text node boundaries
/// adjacent to non-text nodes. Used for raw tag bodies and branch children
/// where surrounding whitespace around Liquid tags should be dropped.
pub fn merge_adjacent_text_nodes_trimmed(nodes: Vec<JsVal>, source: &str) -> Vec<JsVal> {
    let merged = merge_adjacent_text_nodes(nodes, source);
    if merged.is_empty() {
        return merged;
    }

    let mut result = Vec::new();
    for (i, node) in merged.iter().enumerate() {
        if !is_text_node(node) {
            result.push(node.clone());
            continue;
        }

        let prev_is_text = i > 0 && is_text_node(&merged[i - 1]);
        let next_is_text = merged.get(i + 1).is_some_and(is_text_node);
        if let Some(text) = trimmed_text_node(node, prev_is_text, next_is_text) {
            result.push(text);
        }
    }

    result
}

/// A new TextNode for `node` with its edges trimmed where no text node
/// neighbours them, or `None` when nothing is left.
fn trimmed_text_node(node: &JsVal, prev_is_text: bool, next_is_text: bool) -> Option<JsVal> {
    let full = node.string("value");
    let mut value = full.as_str();
    let mut start = node.start();
    let mut end = node.end();

    // Trim leading whitespace if preceded by a non-text node or at start
    if !prev_is_text {
        // TS `value.replace(/^\s+/, '')` at `tree-builder.ts:110`.
        let trimmed = js_trim_start(value);
        start += value.len() - trimmed.len();
        value = trimmed;
    }

    // Trim trailing whitespace if followed by a non-text node or at end
    if !next_is_text {
        // TS `value.replace(/\s+$/, '')` at `tree-builder.ts:119`.
        let trimmed = js_trim_end(value);
        end -= value.len() - trimmed.len();
        value = trimmed;
    }

    (!value.is_empty()).then(|| make_text_node(value, start, end))
}

/// Merge adjacent text nodes then strip whitespace-only text nodes from the
/// edges. Used at the document root and tag children where meaningful text
/// content (including its whitespace) should be preserved, but whitespace-only
/// edge nodes from template indentation should be dropped.
pub fn merge_adjacent_text_nodes_strip_edges(nodes: Vec<JsVal>, source: &str) -> Vec<JsVal> {
    let merged = merge_adjacent_text_nodes(nodes, source);
    let mut start = 0;
    let mut end = merged.len();
    while start < end && is_whitespace_only_text_node(&merged[start]) {
        start += 1;
    }
    while end > start && is_whitespace_only_text_node(&merged[end - 1]) {
        end -= 1;
    }
    if start == 0 && end == merged.len() {
        return merged;
    }
    merged[start..end].to_vec()
}

/// TS `isWhitespaceOnlyTextNode`.
fn is_whitespace_only_text_node(node: &JsVal) -> bool {
    if !is_text_node(node) {
        return false;
    }
    let value = node.string("value");
    // TS `/^\s+$/.test(node.value)` at `tree-builder.ts:153`.
    !value.is_empty() && value.chars().all(js_is_whitespace)
}

/// TS `typeof node.markup === 'string' ? node.markup : node.markup.rawSource`.
fn variable_output_markup(node: &JsVal) -> JsVal {
    match node.get("markup") {
        JsVal::Str(markup) => JsVal::Str(markup),
        markup => markup.get("rawSource"),
    }
}

fn same_string(a: &JsVal, b: &JsVal) -> bool {
    matches!((a, b), (JsVal::Str(a), JsVal::Str(b)) if a == b)
}

pub fn compound_names_match(a: &[JsVal], b: &[JsVal], source: &str) -> bool {
    // When the entire tag name is a Liquid control-flow block (e.g.
    // `<{% if cond %}sticky-header{% else %}div{% endif %}>`), the resolved
    // element name is determined at render time and cannot be verified
    // statically. Ruby's parser accepts these; trust the pair when both names
    // are wholly a single LiquidTag/LiquidRawTag segment.
    if is_wholly_liquid_tag_name(a) && is_wholly_liquid_tag_name(b) {
        return true;
    }

    if a.len() != b.len() {
        return false;
    }

    a.iter()
        .zip(b)
        .all(|(node_a, node_b)| segments_match(node_a, node_b, source))
}

/// One step of the TS `compoundNamesMatch` loop: `continue` is true and
/// `return false` is false.
fn segments_match(node_a: &JsVal, node_b: &JsVal, source: &str) -> bool {
    if node_a.type_name() != node_b.type_name() {
        return false;
    }

    if is_text_node(node_a) && is_text_node(node_b) {
        return same_string(&node_a.get("value"), &node_b.get("value"));
    }

    if is_liquid_variable_output(node_a) && is_liquid_variable_output(node_b) {
        return same_string(
            &variable_output_markup(node_a),
            &variable_output_markup(node_b),
        );
    }

    // LiquidTag or LiquidRawTag: compare by source text
    if node_a.has("source") && node_b.has("source") {
        let src_a = &source[node_a.start()..node_a.end()];
        let src_b = &source[node_b.start()..node_b.end()];
        return src_a == src_b;
    }

    false
}

/// A tag name that is entirely a Liquid control-flow block (LiquidTag/LiquidRawTag),
/// so the rendered element name is decided at runtime and cannot be matched
/// statically against its close tag. See `compound_names_match`.
fn is_wholly_liquid_tag_name(segments: &[JsVal]) -> bool {
    segments.len() == 1
        && (segments[0].type_is(NodeTypes::LiquidTag.as_str())
            || segments[0].type_is(NodeTypes::LiquidRawTag.as_str()))
}
