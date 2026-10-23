use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Markup, NodeKind, NodeRef};

pub static UNSUPPORTED_FILTER_ARGUMENTS: CheckDef = CheckDef {
    code: "UnsupportedFilterArguments",
    name: "Unsupported Filter Arguments",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

const CHECKED_TAGS: &[&str] = &["render", "include", "content_for"];

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

/// `indexOfFilterPipe(markup)`: the first `|` outside a quoted string.
fn index_of_filter_pipe(markup: &str) -> Option<usize> {
    let mut quote = None;
    for (i, c) in markup.bytes().enumerate() {
        match quote {
            Some(q) if c == q => quote = None,
            Some(_) => {}
            None if c == b'\'' || c == b'"' => quote = Some(c),
            None if c == b'|' => return Some(i),
            None => {}
        }
    }
    None
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        // A string markup means the strict parse failed (e.g. because of a filter).
        let (true, Markup::Str(markup)) = (CHECKED_TAGS.contains(&tag.name.as_ref()), &tag.markup)
        else {
            return Ok(());
        };
        let Some(pipe) = index_of_filter_pipe(markup) else {
            return Ok(());
        };
        let start = tag.position.start;
        let Some(markup_start) = cx.source()[start..]
            .find(markup.as_ref())
            .map(|i| start + i)
        else {
            return Ok(());
        };
        cx.report(
            format!(
                "Filters cannot be used on arguments passed to the '{}' tag. Apply the filter beforehand (e.g. with {{% assign %}}) and pass the result instead.",
                tag.name
            ),
            markup_start + pipe,
            markup_start + markup.len(),
        );
        Ok(())
    }
}
