use super::utils::is_html_tag;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::Fix;
use liquid_ast::{HtmlElement, NodeKind, NodeRef};

pub static REQUIRED_LAYOUT_THEME_OBJECT: CheckDef = CheckDef {
    code: "RequiredLayoutThemeObject",
    name: "Prevent missing required objects in theme.liquid",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

const REQUIRED_OBJECTS: [&str; 2] = ["content_for_header", "content_for_layout"];

#[derive(Default)]
struct Check<'a> {
    found: [bool; 2],
    head: Option<&'a HtmlElement<'a>>,
    body: Option<&'a HtmlElement<'a>>,
}

/// `/^layout\/[^/]+\.liquid$/i`
fn is_layout_path(path: &str) -> bool {
    let b = path.as_bytes();
    let (prefix, suffix) = (b"layout/".len(), b".liquid".len());
    b.len() > prefix + suffix
        && b[..prefix].eq_ignore_ascii_case(b"layout/")
        && b[b.len() - suffix..].eq_ignore_ascii_case(b".liquid")
        && !b[prefix..b.len() - suffix].contains(&b'/')
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    if !is_layout_path(&cx.to_relative_path(cx.uri())) {
        return None;
    }
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::VariableLookup.bit() | NodeKind::HtmlElement.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], _: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::VariableLookup(v) => {
                if let Some(i) = REQUIRED_OBJECTS
                    .iter()
                    .position(|o| v.name.as_deref() == Some(o))
                {
                    self.found[i] = true;
                }
            }
            NodeRef::HtmlElement(n) if is_html_tag(node, "head") => self.head = Some(n),
            NodeRef::HtmlElement(n) if is_html_tag(node, "body") => self.body = Some(n),
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for (i, object) in REQUIRED_OBJECTS.iter().enumerate() {
            if self.found[i] {
                continue;
            }
            let insertion = if i == 0 { self.head } else { self.body };
            let p = insertion.map_or(Default::default(), |n| n.position);
            let fix = insertion
                .map(|n| Fix::insert(n.block_end_position.start, format!("{{{{ {object} }}}}")));
            cx.report_with(
                format!(
                    "The required object '{{{{ {object} }}}}' is missing in layout/theme.liquid"
                ),
                p.start,
                p.end,
                fix,
                None,
            );
        }
        Ok(())
    }
}
