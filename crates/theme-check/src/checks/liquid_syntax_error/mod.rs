//! `checks/liquid-syntax-error/index.ts`

mod assign;
mod base;
pub mod block;
mod branch;
mod capture;
mod case;
mod comment;
mod content_for;
mod cycle;
mod decrement;
mod doc;
mod echo;
mod for_tag;
mod form;
mod if_tag;
mod include;
mod increment;
mod inline_comment;
mod javascript;
mod layout;
mod paginate;
mod partial;
mod raw;
mod render;
mod schema;
mod section;
mod sections;
mod style;
mod stylesheet;
mod tablerow;
mod unless;
pub mod utils;
mod variable;

use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::source::Ast;
use liquid_ast::{NodeKind, NodeRef};
use liquid_parser::ParseError;
use std::collections::HashSet;

pub static LIQUID_SYNTAX_ERROR: CheckDef = CheckDef {
    code: "LiquidSyntaxError",
    name: "LiquidSyntaxError",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check<'a> {
    error: Option<&'a ParseError>,
    /// `reportedUnknownLiquidBlockTags` (node addresses).
    reported_unknown: HashSet<usize>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let error = match &cx.file.ast {
        Ast::Liquid(Err(e)) => Some(e),
        _ => None,
    };
    Some(Box::new(Check {
        error,
        reported_unknown: HashSet::new(),
    }))
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
            | NodeKind::LiquidTag.bit()
            | NodeKind::LiquidBranch.bit()
            | NodeKind::LiquidVariableOutput.bit()
    }

    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(error) = self.error else {
            return Ok(());
        };
        let source = cx.source();
        comment::check_comment_tag(error, cx, source);
        block::check_block_parser_error(error, cx, source);
        doc::check_doc_parser_error(error, cx, source);
        partial::check_partial_parser_error(error, cx, source);
        raw::check_raw_parser_error(error, cx, source);
        javascript::check_javascript_parser_error(error, cx, source);
        Ok(())
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidRawTag(node) => match &*node.name {
                "comment" => comment::check_comment_raw_tag(node, cx),
                "doc" => doc::check_doc_tag(node, cx),
                "javascript" => javascript::check_javascript_tag(node, cx),
                "schema" => schema::check_schema_tag(node, cx),
                "style" => style::check_style_tag(node, cx),
                "stylesheet" => stylesheet::check_stylesheet_tag(node, cx),
                "raw" => raw::check_raw_tag(node, cx),
                _ => {}
            },
            NodeRef::LiquidTag(node) => match &*node.name {
                "#" => inline_comment::check_inline_comment_tag(node, cx),
                "assign" => assign::check_assign_tag(node, cx),
                "block" => block::check_block_tag(node, cx),
                "break" | "continue" | "ifchanged" => {}
                "capture" => capture::check_capture_tag(node, cx),
                "case" => case::check_case_tag(node, cx),
                "content_for" => content_for::check_content_for_tag(node, cx),
                "cycle" => cycle::check_cycle_tag(node, cx),
                "decrement" => decrement::check_decrement_tag(node, cx),
                "echo" => echo::check_echo_tag(node, cx),
                "form" => form::check_form_tag(node, cx),
                "for" => for_tag::check_for_tag(node, cx),
                "tablerow" => tablerow::check_tablerow_tag(node, cx),
                "if" => if_tag::check_if_tag(node, cx),
                "include" => include::check_include_tag(node, cx),
                "increment" => increment::check_increment_tag(node, cx),
                "layout" => layout::check_layout_tag(node, cx),
                "paginate" => paginate::check_paginate_tag(node, cx),
                "partial" => partial::check_partial_tag(node, cx),
                "render" => render::check_render_tag(node, cx),
                "section" => section::check_section_tag(node, cx),
                "sections" => sections::check_sections_tag(node, cx),
                "unless" => unless::check_unless_tag(node, cx),
                // misplacedTagCheckers: branch keywords reach this path only when they are out of
                // context.
                "else" | "elsif" | "when" => branch::check_misplaced_branch_tag(node, cx),
                _ => base::check_base_tag(node, cx, &mut self.reported_unknown),
            },
            NodeRef::LiquidBranch(node) => branch::check_branch_tag(node, cx),
            NodeRef::LiquidVariableOutput(node) => variable::check_variable_output(node, cx),
            _ => {}
        }
        Ok(())
    }
}
