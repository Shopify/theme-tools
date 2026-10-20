//! AssetSizeAppBlockCSS and AssetSizeAppBlockJavaScript: the same check on the schema's
//! `stylesheet` / `javascript` asset.

use super::file_utils::{does_file_exceed_threshold, does_file_exist};
use super::liquid_html_syntax_error::utils::add16;
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::parse_json;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static ASSET_SIZE_APP_BLOCK_CSS: CheckDef = CheckDef {
    code: "AssetSizeAppBlockCSS",
    name: "Asset Size App Block CSS",
    aliases: &[],
    severity: Severity::Error,
    // docs.recommended is true, but it only targets ThemeAppExtension, so `recommended` skips it.
    recommended: false,
    deprecated: false,
    schema: &[("thresholdInBytes", "100000")],
    create: Create::Liquid(create_css),
};

pub static ASSET_SIZE_APP_BLOCK_JAVASCRIPT: CheckDef = CheckDef {
    code: "AssetSizeAppBlockJavaScript",
    name: "Asset Size App Block JavaScript",
    schema: &[("thresholdInBytes", "10000")],
    create: Create::Liquid(create_js),
    ..ASSET_SIZE_APP_BLOCK_CSS
};

struct Check {
    /// The schema key holding the asset name.
    key: &'static str,
}

fn create_css<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check { key: "stylesheet" }))
}

fn create_js<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check { key: "javascript" }))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "schema" {
            return Ok(());
        }
        let key = self.key;
        // `parseJSON` is tolerant, so it never gives an Error; `undefined.stylesheet` throws.
        let schema = parse_json(&tag.body.value).ok_or_else(|| {
            CheckError::new(format!(
                "Cannot read properties of undefined (reading '{key}')"
            ))
        })?;
        let Some(asset) = js::get(&schema, key)
            .map_err(CheckError)?
            .filter(|v| js::truthy(v))
        else {
            return Ok(());
        };
        // ponytail: `asset.length` is `undefined` (an NaN end index) for numbers, booleans and
        // objects; those aren't reported.
        let length = match asset {
            Value::String(s) => js::len16(s),
            Value::Array(a) => a.len(),
            _ => return Ok(()),
        };
        let name = js::to_string(asset);
        let relative_path = format!("assets/{name}");
        let threshold = cx
            .settings
            .get("thresholdInBytes")
            .cloned()
            .unwrap_or(Value::Null);

        // `body.position.start + body.value.indexOf(asset)`: -1 lands on the `}` before the body.
        let body = &tag.body;
        let start = body
            .value
            .find(name.as_str())
            .map_or(body.position.start - 1, |i| body.position.start + i);
        let end = add16(cx.source(), start, length);

        if !does_file_exist(cx, &relative_path) {
            cx.report(format!("'{name}' does not exist."), start, end);
            return Ok(());
        }
        let (exceeds, file_size) = does_file_exceed_threshold(cx, &relative_path, &threshold);
        if exceeds {
            cx.report(
                format!(
                    "The file size for '{name}' ({file_size} B) exceeds the configured threshold ({} B)",
                    js::to_string(&threshold)
                ),
                start,
                end,
            );
        }
        Ok(())
    }
}
