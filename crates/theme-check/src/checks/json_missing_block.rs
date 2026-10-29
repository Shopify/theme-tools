use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, JsonCheck, Severity};
use crate::js;
use crate::json::{JsonNode, PathSeg};
use crate::schema::get_schema_from_json;
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

/// Like `Promise.all`: every branch runs, the first error wins.
fn first_error(results: impl Iterator<Item = CheckResult>) -> CheckResult {
    results.fold(Ok(()), |acc, r| acc.and(r))
}

impl<'a> JsonCheck<'a> for Check {
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
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
        first_error(entries.iter().map(|(key, section)| {
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
                &["sections".into(), key.clone(), "blocks".into()],
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
    first_error(entries.iter().map(|(key, block)| {
        let ty = js::get(block, "type").map_err(err)?;
        if let Some(ty) = ty.filter(|t| js::truthy(t)) {
            let type_path: Vec<PathSeg> = path
                .iter()
                .map(String::as_str)
                .chain([key.as_str(), "type"])
                .map(PathSeg::Key)
                .collect();
            if let Some(block_path) = ast.at_path(&type_path) {
                let block_static = js::get(block, "static").map_err(err)?;
                validate_block(
                    ty,
                    block_static,
                    block_path,
                    ancestor_type,
                    path,
                    offset,
                    cx,
                )?;
            }
        }
        if js::has(block, "blocks").map_err(err)? {
            let nested: Vec<String> = path
                .iter()
                .cloned()
                .chain([key.clone(), "blocks".into()])
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

/// `getThemeBlocks(sectionType, currentPath, context)`. `Null` stands for `undefined` types.
fn get_theme_blocks(
    section_type: Option<&Value>,
    path: &[String],
    cx: &Context,
) -> Result<Vec<Value>, CheckError> {
    let mut theme_blocks = Vec::new();
    // Map lookups by a non-string key find nothing.
    let Some(name) = section_type
        .filter(|t| js::truthy(t))
        .and_then(Value::as_str)
    else {
        return Ok(theme_blocks);
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
        return Ok(theme_blocks);
    };
    if let Some(Value::Array(blocks)) = js::get(valid, "blocks").map_err(err)? {
        for block in blocks {
            if !js::has(block, "name").map_err(err)? {
                let ty = js::get(block, "type").map_err(err)?;
                if ty.and_then(Value::as_str) != Some("@app") {
                    theme_blocks.push(ty.cloned().unwrap_or(Value::Null));
                }
            }
        }
    }
    Ok(theme_blocks)
}

/// `validateBlock(...)`
fn validate_block(
    block_type: &Value,
    block_static: Option<&Value>,
    block_path: &JsonNode,
    ancestor_type: Option<&Value>,
    path: &[String],
    offset: usize,
    cx: &mut Context,
) -> CheckResult {
    let theme_blocks = get_theme_blocks(ancestor_type, path, cx)?;
    if theme_blocks.is_empty() {
        return Ok(());
    }
    let type_str = js::to_string(block_type);
    let exists = matches!(block_type.as_str(), Some("@theme" | "@app"))
        || cx.file_exists(&cx.to_uri(&format!("blocks/{type_str}.liquid")));
    let loc = block_path.loc();
    if !exists {
        cx.report(
            format!("Theme block 'blocks/{type_str}.liquid' does not exist."),
            offset + loc.start,
            offset + loc.end,
        );
        return Ok(());
    }
    if block_static.is_some_and(js::truthy) {
        return Ok(());
    }
    let Some(t) = block_type.as_str() else {
        return Err(CheckError::new("blockType.startsWith is not a function"));
    };
    let includes_theme = theme_blocks.iter().any(|b| b.as_str() == Some("@theme"));
    let includes_type = theme_blocks.iter().any(|b| b == block_type);
    let allowed = if !t.starts_with('_') {
        includes_type || includes_theme
    } else {
        includes_type
    };
    if !allowed {
        let location = if is_nested_block(path) {
            "blocks"
        } else {
            "sections"
        };
        let ancestor = js::opt_to_string(ancestor_type);
        cx.report(
            format!("Block type '{t}' is not allowed in '{location}/{ancestor}.liquid'."),
            offset + loc.start,
            offset + loc.end,
        );
    }
    Ok(())
}
