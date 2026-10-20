use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Node, NodeKind, NodeRef};

pub static MISSING_ASSET: CheckDef = CheckDef {
    code: "MissingAsset",
    name: "Avoid rendering missing asset files",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidVariable.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidVariable(var) = node else {
            return Ok(());
        };
        if var.filters.first().map_or(true, |f| f.name != "asset_url") {
            return Ok(());
        }
        let Node::String(expression) = var.expression.as_ref() else {
            return Ok(());
        };

        let original = format!("assets/{}", expression.value);
        let exists = |rel: &str| cx.file_exists(&cx.to_uri(rel));
        if exists(&original) {
            return Ok(());
        }
        let mut asset_path = original.clone();
        if asset_path.ends_with(".scss.css") {
            asset_path = asset_path.replacen(".scss.css", ".scss.liquid", 1);
            if exists(&asset_path) {
                return Ok(());
            }
        }
        if asset_path.ends_with(".js") || asset_path.ends_with(".css") {
            asset_path.push_str(".liquid");
            if exists(&asset_path) {
                return Ok(());
            }
        }
        cx.report(
            format!("'{original}' does not exist"),
            expression.position.start,
            expression.position.end,
        );
        Ok(())
    }
}
