//! `raw-tags/index.ts`: `{% schema %}`, `{% javascript %}` and `{% stylesheet %}` placement checks.

use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::schema::{is_block, is_section, is_snippet};
use liquid_ast::{NodeKind, NodeRef};

macro_rules! raw_tag_check {
    ($static:ident, $code:literal, $create:ident) => {
        pub static $static: CheckDef = CheckDef {
            code: $code,
            name: $code,
            aliases: &[],
            severity: Severity::Error,
            recommended: true,
            deprecated: false,
            schema: &[],
            create: Create::Liquid($create),
        };
    };
}

raw_tag_check!(
    JAVASCRIPT_ONCE_PER_FILE,
    "JavascriptOncePerFile",
    javascript_once_per_file
);
raw_tag_check!(
    JAVASCRIPT_TAG_IN_WRONG_FILE,
    "JavascriptTagInWrongFile",
    javascript_tag_in_wrong_file
);
raw_tag_check!(
    SCHEMA_ONCE_PER_FILE,
    "SchemaOncePerFile",
    schema_once_per_file
);
raw_tag_check!(
    SCHEMA_SECTION_OR_BLOCK_ONLY,
    "SchemaSectionOrBlockOnly",
    schema_section_or_block_only
);
raw_tag_check!(
    STYLESHEET_ONCE_PER_FILE,
    "StylesheetOncePerFile",
    stylesheet_once_per_file
);
raw_tag_check!(
    STYLESHEET_TAG_IN_WRONG_FILE,
    "StylesheetTagInWrongFile",
    stylesheet_tag_in_wrong_file
);

/// Reports each `{% tag_name %}` after the first `skip` ones.
struct Check {
    tag_name: &'static str,
    message: &'static str,
    skip: usize,
    count: usize,
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != self.tag_name {
            return Ok(());
        }
        self.count += 1;
        if self.count > self.skip {
            cx.report(
                self.message,
                tag.block_start_position.start,
                tag.block_start_position.end,
            );
        }
        Ok(())
    }
}

fn boxed<'a>(
    tag_name: &'static str,
    message: &'static str,
    skip: usize,
) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check {
        tag_name,
        message,
        skip,
        count: 0,
    }))
}

/// `sectionOrBlockOnlyUnlessAllowed`: nothing to check in sections, blocks (and snippets when allowed).
fn in_wrong_file<'a>(
    cx: &Context<'a>,
    tag_name: &'static str,
    message: &'static str,
    allow_snippets: bool,
) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let uri = cx.uri();
    if is_section(uri) || is_block(uri) || (allow_snippets && is_snippet(uri)) {
        return None;
    }
    boxed(tag_name, message, 0)
}

fn javascript_once_per_file<'a>(_: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    boxed(
        "javascript",
        "{% javascript %} can only appear once per file.",
        1,
    )
}

fn schema_once_per_file<'a>(_: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    boxed("schema", "{% schema %} can only appear once per file.", 1)
}

fn stylesheet_once_per_file<'a>(_: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    boxed(
        "stylesheet",
        "{% stylesheet %} can only appear once per file.",
        1,
    )
}

fn javascript_tag_in_wrong_file<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    in_wrong_file(
        cx,
        "javascript",
        "{% javascript %} is only valid in section, block, or snippet files.",
        true,
    )
}

fn schema_section_or_block_only<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    in_wrong_file(
        cx,
        "schema",
        "{% schema %} is only valid in section or block files.",
        false,
    )
}

fn stylesheet_tag_in_wrong_file<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    in_wrong_file(
        cx,
        "stylesheet",
        "{% stylesheet %} is only valid in section, block, or snippet files.",
        true,
    )
}
