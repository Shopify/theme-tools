use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::minimatch::minimatch;
use liquid_ast::{Node, NodeKind, NodeRef, Position};

pub static MISSING_TEMPLATE: CheckDef = CheckDef {
    code: "MissingTemplate",
    name: "Avoid rendering missing templates",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[("ignoreMissing", "[]")],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

/// `maybeReportMissing(relativePath, { position })`
fn maybe_report_missing(cx: &mut Context, relative_path: String, position: Position) {
    if cx.file_exists(&cx.to_uri(&relative_path)) {
        return;
    }
    if cx
        .setting_strs("ignoreMissing")
        .iter()
        .any(|p| minimatch(&relative_path, p))
    {
        return;
    }
    cx.report(
        format!("'{relative_path}' does not exist"),
        position.start,
        position.end,
    );
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::RenderMarkup.bit() | NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::RenderMarkup(node) => {
                // `${snippet.value}`, with LiquidLiteral values stringified like JS.
                let value = match node.snippet.as_ref() {
                    Node::String(s) => &*s.value,
                    Node::Number(n) => &*n.value,
                    Node::LiquidLiteral(l) => match l.keyword {
                        "nil" | "null" => "null",
                        "blank" | "empty" => "",
                        k => k,
                    },
                    _ => return Ok(()),
                };
                maybe_report_missing(
                    cx,
                    format!("snippets/{value}.liquid"),
                    node.snippet.position(),
                );
            }
            NodeRef::LiquidTag(tag) if tag.name == "section" => {
                if let Some(Node::SectionMarkup(m)) = tag.markup.node() {
                    maybe_report_missing(
                        cx,
                        format!("sections/{}.liquid", m.name.value),
                        m.name.position,
                    );
                }
            }
            _ => {}
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The `ignoreMissing` globs.
    #[test]
    fn ignore_missing_globs() {
        for p in [
            "snippets/ignored.liquid",
            "snippets/*.liquid",
            "*/ignored.liquid",
        ] {
            assert!(minimatch("snippets/ignored.liquid", p));
        }
        assert!(minimatch("sections/ignored.liquid", "*/ignored.liquid"));
        assert!(!minimatch("sections/ignored.liquid", "snippets/*.liquid"));
    }
}
