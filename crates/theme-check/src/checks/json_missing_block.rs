use super::schema_utils::all;
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, JsonCheck, Severity};
use crate::js;
use crate::json::{JsonNode, PathSeg};
use crate::schema::get_schema_from_json;
use liquid_ast::Span;
use serde_json::Value;

pub static JSON_MISSING_BLOCK: CheckDef = CheckDef {
    code: "JSONMissingBlock",
    name: "Check for missing blocks types in JSON templates",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

struct Check;

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    cx.to_relative_path(cx.uri())
        .starts_with("templates/")
        .then(|| Box::new(Check) as Box<dyn JsonCheck<'a> + 'a>)
}

fn err(e: String) -> CheckError {
    CheckError(e)
}

impl<'a> JsonCheck<'a> for Check {
    fn end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let (parsed, ast) = get_schema_from_json(cx);
        let Some(ast) = ast else { return Ok(()) };
        let parsed = parsed.ok_or_else(|| {
            CheckError::new("Cannot read properties of undefined (reading 'sections')")
        })?;
        let Some(sections) = js::get(&parsed, "sections")
            .map_err(err)?
            .filter(|s| js::truthy(s))
        else {
            return Ok(());
        };
        let entries = js::entries(sections).map_err(err)?;
        all(entries.iter().map(|(key, section)| {
            // isPropertyNode(section) && 'blocks' in section && isPropertyNode(section.blocks) && 'type' in section
            if !js::is_non_null_object(section) || !js::has(section, "blocks").map_err(err)? {
                return Ok(());
            }
            let blocks = js::get(section, "blocks").map_err(err)?;
            if !blocks.is_some_and(js::is_non_null_object)
                || !js::has(section, "type").map_err(err)?
            {
                return Ok(());
            }
            let ty = js::get(section, "type").map_err(err)?;
            get_all_blocks(
                ast,
                0,
                ty,
                blocks,
                &["sections".into(), key.to_string(), "blocks".into()],
                cx,
            )
        }))
    }
}

fn is_nested_block(path: &[String]) -> bool {
    path.iter().filter(|s| *s == "blocks").count() > 1
}

/// `getAllBlocks(ast, offset, ancestorType, blocks, currentPath, context)`
fn get_all_blocks(
    ast: &JsonNode,
    offset: usize,
    ancestor_type: Option<&Value>,
    blocks: Option<&Value>,
    path: &[String],
    cx: &mut Context,
) -> CheckResult {
    let blocks =
        blocks.ok_or_else(|| CheckError::new("Cannot convert undefined or null to object"))?;
    let entries = js::entries(blocks).map_err(err)?;
    all(entries.iter().map(|(key, block)| {
        let ty = js::get(block, "type").map_err(err)?;
        if let Some(t) = ty.and_then(Value::as_str).filter(|t| !t.is_empty()) {
            let type_path: Vec<PathSeg> = path
                .iter()
                .map(String::as_str)
                .chain([&**key, "type"])
                .map(PathSeg::Key)
                .collect();
            if let Some(block_path) = ast.at_path(&type_path) {
                let block_static = js::get(block, "static").map_err(err)?;
                validate_block(t, block_static, block_path, ancestor_type, path, offset, cx)?;
            }
        }
        if js::has(block, "blocks").map_err(err)? {
            let nested: Vec<String> = path
                .iter()
                .cloned()
                .chain([key.to_string(), "blocks".into()])
                .collect();
            get_all_blocks(
                ast,
                offset,
                ty,
                js::get(block, "blocks").map_err(err)?,
                &nested,
                cx,
            )?;
        }
        Ok(())
    }))
}

/// `getAllowedBlocks(sectionType, currentPath, context)`: the host's schema blocks, or `None`
/// without a valid schema.
fn get_allowed_blocks(
    section_type: Option<&Value>,
    path: &[String],
    cx: &Context,
) -> Result<Option<Vec<Value>>, CheckError> {
    let Some(name) = section_type
        .and_then(Value::as_str)
        .filter(|t| !t.is_empty())
    else {
        return Ok(None);
    };
    let schema = if is_nested_block(path) {
        cx.get_block_schema(name)
    } else {
        cx.get_section_schema(name)
    };
    let Some(valid) = schema
        .and_then(|s| s.valid_value())
        .filter(|v| js::truthy(v))
    else {
        return Ok(None);
    };
    Ok(Some(match js::get(valid, "blocks").map_err(err)? {
        Some(Value::Array(blocks)) => blocks.clone(),
        _ => Vec::new(),
    }))
}

/// `block.type`, if it's a string.
fn block_type(block: &Value) -> Result<Option<&str>, CheckError> {
    Ok(js::get(block, "type").map_err(err)?.and_then(Value::as_str))
}

/// `validateBlock(...)`
fn validate_block(
    t: &str,
    block_static: Option<&Value>,
    block_path: &JsonNode,
    ancestor_type: Option<&Value>,
    path: &[String],
    offset: usize,
    cx: &mut Context,
) -> CheckResult {
    let Some(allowed_blocks) = get_allowed_blocks(ancestor_type, path, cx)? else {
        return Ok(());
    };
    let location = if is_nested_block(path) {
        "blocks"
    } else {
        "sections"
    };
    let span = block_path.span();
    let span = Span::new(offset + span.start, offset + span.end);
    let not_allowed = || {
        let ancestor = js::opt_to_string(ancestor_type);
        format!("Block type '{t}' is not allowed in '{location}/{ancestor}.liquid'.")
    };
    // App blocks are remote references and require permission from their immediate host.
    if t.starts_with("shopify://apps/") {
        let mut allows_apps = false;
        for block in &allowed_blocks {
            if !js::has(block, "name").map_err(err)? && block_type(block)? == Some("@app") {
                allows_apps = true;
                break;
            }
        }
        if !allows_apps {
            cx.report(not_allowed(), span);
        }
        return Ok(());
    }
    // Section blocks do not need a file in blocks/.
    let mut theme_blocks = Vec::new();
    for block in &allowed_blocks {
        let named = js::has(block, "name").map_err(err)?;
        let ty = block_type(block)?;
        if named && ty == Some(t) {
            return Ok(());
        }
        if !named && ty != Some("@app") {
            theme_blocks.push(ty);
        }
    }
    if theme_blocks.is_empty() {
        return Ok(());
    }
    let exists =
        matches!(t, "@theme" | "@app") || cx.file_exists(&cx.to_uri(&format!("blocks/{t}.liquid")));
    if !exists {
        cx.report(
            format!("Theme block 'blocks/{t}.liquid' does not exist."),
            span,
        );
        return Ok(());
    }
    if block_static.is_some_and(js::truthy) {
        return Ok(());
    }
    let includes_theme = theme_blocks.contains(&Some("@theme"));
    let includes_type = theme_blocks.contains(&Some(t));
    let allowed = if !t.starts_with('_') {
        includes_type || includes_theme
    } else {
        includes_type
    };
    if !allowed {
        cx.report(not_allowed(), span);
    }
    Ok(())
}
