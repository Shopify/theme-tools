//! `utils/block.ts`, `utils/object.ts` (`deepGet`) and the JS value helpers the schema checks
//! share. Schemas are `any` in TS, so these follow JS semantics (and throws) on odd shapes.

use crate::context::{CheckError, CheckResult, Context};
use crate::js;
use crate::json::{JsonNode, PathSeg};
use crate::schema::StaticBlockDef;
use liquid_ast::{ContentForMarkup, LiquidTag, Markup, Node};
use serde_json::Value;
use std::borrow::Cow;

/// `v.key` (`None` = undefined); throws on null.
pub fn get<'v>(v: &'v Value, key: &str) -> Result<Option<&'v Value>, CheckError> {
    js::get(v, key).map_err(CheckError)
}

/// `v?.key`
pub fn get_opt<'v>(v: Option<&'v Value>, key: &str) -> Result<Option<&'v Value>, CheckError> {
    v.map_or(Ok(None), |v| get(v, key))
}

/// `key in v`; throws on primitives.
pub fn has(v: &Value, key: &str) -> Result<bool, CheckError> {
    js::has(v, key).map_err(CheckError)
}

pub fn truthy(v: Option<&Value>) -> bool {
    v.is_some_and(js::truthy)
}

/// `a === b`: primitives by value, objects and arrays by identity.
pub fn strict_eq(a: Option<&Value>, b: Option<&Value>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(x @ (Value::Array(_) | Value::Object(_))), Some(y)) => std::ptr::eq(x, y),
        (Some(x), Some(y)) => x == y,
        _ => false,
    }
}

/// `v === s`
pub fn is_str(v: Option<&Value>, s: &str) -> bool {
    v.and_then(Value::as_str) == Some(s)
}

/// The elements of `v` where TS calls an array method on it (`v.forEach`, `v.some`, ...), which
/// throws for anything that isn't an array.
pub fn array<'v>(v: Option<&'v Value>, what: &str) -> Result<&'v [Value], CheckError> {
    match v {
        Some(Value::Array(a)) => Ok(a),
        None => Err(CheckError::new(format!(
            "Cannot read properties of undefined (reading '{what}')"
        ))),
        Some(Value::Null) => Err(CheckError::new(format!(
            "Cannot read properties of null (reading '{what}')"
        ))),
        Some(_) => Err(CheckError::new(format!("{what} is not a function"))),
    }
}

/// `Object.entries(v)` (arrays give index keys, strings their characters) for a non-null `v`.
pub fn entries(v: &Value) -> Vec<(Cow<'_, str>, Cow<'_, Value>)> {
    match v {
        Value::Object(m) => m
            .iter()
            .map(|(k, v)| (Cow::Borrowed(k.as_str()), Cow::Borrowed(v)))
            .collect(),
        Value::Array(a) => a
            .iter()
            .enumerate()
            .map(|(i, v)| (Cow::Owned(i.to_string()), Cow::Borrowed(v)))
            .collect(),
        // ponytail: chars, not UTF-16 units (astral characters differ; no schema does this).
        Value::String(s) => s
            .chars()
            .enumerate()
            .map(|(i, c)| {
                (
                    Cow::Owned(i.to_string()),
                    Cow::Owned(Value::String(c.into())),
                )
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// `${v}` of an optional value.
pub fn s(v: Option<&Value>) -> String {
    js::opt_to_string(v)
}

/// `v.startsWith(prefix)`, which throws unless `v` is a string.
pub fn starts_with(v: Option<&Value>, prefix: &str) -> Result<bool, CheckError> {
    match v {
        Some(Value::String(s)) => Ok(s.starts_with(prefix)),
        None => Err(CheckError::new(
            "Cannot read properties of undefined (reading 'startsWith')",
        )),
        Some(Value::Null) => Err(CheckError::new(
            "Cannot read properties of null (reading 'startsWith')",
        )),
        Some(_) => Err(CheckError::new("startsWith is not a function")),
    }
}

/// `nodeAtPath(ast, path)` over string segments.
pub fn node_at<'n, 'a>(ast: &'n JsonNode<'a>, path: &[String]) -> Option<&'n JsonNode<'a>> {
    let segs: Vec<PathSeg> = path.iter().map(|s| PathSeg::Key(s)).collect();
    ast.at_path(&segs)
}

/// `reportWarning(message, offset, astNode, context)`: `getLocStart(undefined)` throws.
pub fn report_warning(
    cx: &mut Context,
    message: String,
    offset: usize,
    node: Option<&JsonNode>,
) -> CheckResult {
    let loc = node
        .ok_or_else(|| CheckError::new("Cannot read properties of undefined (reading 'loc')"))?
        .loc();
    cx.report(message, offset + loc.start, offset + loc.end);
    Ok(())
}

/// Like `Promise.all`: every branch runs, the first error wins.
pub fn all(results: impl Iterator<Item = CheckResult>) -> CheckResult {
    results.fold(Ok(()), |acc, r| acc.and(r))
}

/// `deepGet(obj, path)`: `path.reduce((acc, key) => acc?.[key], obj)`. Strings index by UTF-16
/// unit and have `length`, like arrays.
///
/// ponytail: JS also finds prototype members (`constructor`, `toString`, ...); we don't, so a
/// translation key like `t:constructor` reads as missing.
pub fn deep_get<'v>(obj: Option<&'v Value>, path: &[&str]) -> Option<Cow<'v, Value>> {
    let mut acc = Cow::Borrowed(obj?);
    for key in path {
        let next = match &acc {
            Cow::Borrowed(v) => index(v, key)?,
            Cow::Owned(v) => Cow::Owned(index(v, key)?.into_owned()),
        };
        acc = next;
    }
    Some(acc)
}

fn index<'v>(v: &'v Value, key: &str) -> Option<Cow<'v, Value>> {
    let as_index = || key.parse::<usize>().ok().filter(|i| i.to_string() == key);
    match v {
        Value::Object(m) => m.get(key).map(Cow::Borrowed),
        Value::Array(a) if key == "length" => Some(Cow::Owned(a.len().into())),
        Value::Array(a) => a.get(as_index()?).map(Cow::Borrowed),
        Value::String(s) if key == "length" => Some(Cow::Owned(js::len16(s).into())),
        Value::String(s) => {
            let unit = *s.encode_utf16().collect::<Vec<_>>().get(as_index()?)?;
            Some(Cow::Owned(Value::String(String::from_utf16_lossy(&[unit]))))
        }
        _ => None,
    }
}

/// A `{% content_for 'block' ... %}` tag's markup (`isContentForBlock`).
pub fn content_for_block<'n, 'a>(tag: &'n LiquidTag<'a>) -> Option<&'n ContentForMarkup<'a>> {
    if tag.name != "content_for" {
        return None;
    }
    let Markup::Node(markup) = &tag.markup else {
        return None;
    };
    let Node::ContentForMarkup(m) = markup.as_ref() else {
        return None;
    };
    (m.content_for_type.value == "block").then_some(m)
}

/// The value of `args.find(arg => arg.name === name)` when it's a string node.
pub fn string_arg<'n, 'a>(
    m: &'n ContentForMarkup<'a>,
    name: &str,
) -> Option<&'n liquid_ast::LiquidString<'a>> {
    match m.args.iter().find(|a| a.name == name)?.value.as_ref() {
        Node::String(s) => Some(s),
        _ => None,
    }
}

// ---------------------------------------------------------------------------------------------
// utils/block.ts

pub struct BlockWithPath<'v> {
    pub node: &'v Value,
    pub path: Vec<String>,
}

impl<'v> BlockWithPath<'v> {
    /// `node.type`. Nodes are objects or arrays (`in` threw on anything else).
    pub fn ty(&self) -> Option<&'v Value> {
        self.node.get("type")
    }
}

/// What `getBlocks(validSchema)` returns.
pub struct Blocks<'v> {
    pub root_level_theme_blocks: Vec<BlockWithPath<'v>>,
    pub root_level_local_blocks: Vec<BlockWithPath<'v>>,
    /// `presetLevelBlocks` by depth (`Object.entries` puts integer keys in ascending order, and
    /// depths are contiguous from 0).
    pub preset_level_blocks: Vec<Vec<BlockWithPath<'v>>>,
    pub default_level_blocks: Vec<BlockWithPath<'v>>,
    pub has_root_blocks_declaration: bool,
}

/// `path.concat(more)`
pub fn with(path: &[String], more: &[&str]) -> Vec<String> {
    path.iter()
        .cloned()
        .chain(more.iter().map(|s| s.to_string()))
        .collect()
}

/// `getBlocks(validSchema)` (`validSchema` is truthy).
pub fn get_blocks(valid_schema: &Value) -> Result<Blocks<'_>, CheckError> {
    let mut out = Blocks {
        root_level_theme_blocks: Vec::new(),
        root_level_local_blocks: Vec::new(),
        preset_level_blocks: Vec::new(),
        default_level_blocks: Vec::new(),
        has_root_blocks_declaration: false,
    };
    let root_level_blocks = get(valid_schema, "blocks")?;
    let presets = get(valid_schema, "presets")?;

    if let Some(Value::Array(blocks)) = root_level_blocks {
        out.has_root_blocks_declaration = true;
        for (index, block) in blocks.iter().enumerate() {
            if !js::truthy(block) {
                continue;
            }
            let path = vec!["blocks".to_string(), index.to_string(), "type".to_string()];
            if has(block, "name")? {
                out.root_level_local_blocks
                    .push(BlockWithPath { node: block, path });
            } else if !is_str(get(block, "type")?, "@app") {
                out.root_level_theme_blocks
                    .push(BlockWithPath { node: block, path });
            }
        }
    }

    if truthy(presets) {
        for (preset_index, preset) in array(presets, "presets.forEach")?.iter().enumerate() {
            if !has(preset, "blocks")? {
                continue;
            }
            let base = [
                "presets".to_string(),
                preset_index.to_string(),
                "blocks".to_string(),
            ];
            match get(preset, "blocks")? {
                Some(Value::Array(blocks)) => {
                    for (i, block) in blocks.iter().enumerate() {
                        categorize_preset_level_block(
                            &mut out,
                            block,
                            with(&base, &[&i.to_string()]),
                            0,
                        )?;
                    }
                }
                Some(Value::Object(blocks)) => {
                    for (key, block) in blocks {
                        categorize_preset_level_block(&mut out, block, with(&base, &[key]), 0)?;
                    }
                }
                _ => {}
            }
        }
    }

    if has(valid_schema, "default")? {
        // validSchema.default?.blocks?.forEach(...)
        let blocks = get_opt(
            get(valid_schema, "default")?.filter(|d| !d.is_null()),
            "blocks",
        )?;
        if let Some(blocks) = blocks.filter(|b| !b.is_null()) {
            for (index, block) in array(Some(blocks), "validSchema.default?.blocks?.forEach")?
                .iter()
                .enumerate()
            {
                if has(block, "name")? {
                    let path = ["default", "blocks", &index.to_string(), "type"]
                        .map(String::from)
                        .to_vec();
                    out.default_level_blocks
                        .push(BlockWithPath { node: block, path });
                }
            }
        }
    }

    Ok(out)
}

fn categorize_preset_level_block<'v>(
    out: &mut Blocks<'v>,
    block: &'v Value,
    path: Vec<String>,
    depth: usize,
) -> CheckResult {
    if !js::truthy(block) {
        return Ok(());
    }
    if out.preset_level_blocks.len() <= depth {
        out.preset_level_blocks.push(Vec::new());
    }
    out.preset_level_blocks[depth].push(BlockWithPath {
        node: block,
        path: with(&path, &["type"]),
    });
    if has(block, "blocks")? {
        match get(block, "blocks")? {
            Some(Value::Array(blocks)) => {
                for (i, nested) in blocks.iter().enumerate() {
                    categorize_preset_level_block(
                        out,
                        nested,
                        with(&path, &["blocks", &i.to_string()]),
                        depth + 1,
                    )?;
                }
            }
            Some(Value::Object(blocks)) => {
                for (key, nested) in blocks {
                    categorize_preset_level_block(
                        out,
                        nested,
                        with(&path, &["blocks", key]),
                        depth + 1,
                    )?;
                }
            }
            _ => {}
        }
    }
    Ok(())
}

/// `'id' in node ? node.id : path.at(-2)`
pub fn block_id<'v>(node: &'v Value, path: &[String]) -> Result<Cow<'v, Value>, CheckError> {
    Ok(match has(node, "id")? {
        true => Cow::Borrowed(node.get("id").unwrap_or(&Value::Null)),
        false => Cow::Owned(Value::String(path[path.len() - 2].clone())),
    })
}

/// `isInvalidPresetBlock(blockId, blockNode, rootLevelThemeBlocks, staticBlockDefs, hasRootBlocksDeclaration)`
pub fn is_invalid_preset_block(
    block_id: &Value,
    block_node: &Value,
    root_level_theme_blocks: &[BlockWithPath],
    static_block_defs: &[StaticBlockDef],
    has_root_blocks_declaration: bool,
) -> Result<bool, CheckError> {
    let ty = get(block_node, "type")?;
    if truthy(get(block_node, "static")?) {
        let (Some(ty), Some(id)) = (ty.and_then(Value::as_str), block_id.as_str()) else {
            return Ok(true);
        };
        return Ok(!static_block_defs
            .iter()
            .any(|b| b.block_type == ty && b.id == id));
    }
    is_invalid_block(ty, root_level_theme_blocks, has_root_blocks_declaration)
}

/// `isInvalidDefaultBlock(blockNode, rootLevelThemeBlocks, hasRootBlocksDeclaration)`
pub fn is_invalid_default_block(
    block_node: &Value,
    root_level_theme_blocks: &[BlockWithPath],
    has_root_blocks_declaration: bool,
) -> Result<bool, CheckError> {
    is_invalid_block(
        get(block_node, "type")?,
        root_level_theme_blocks,
        has_root_blocks_declaration,
    )
}

fn is_invalid_block(
    ty: Option<&Value>,
    root: &[BlockWithPath],
    has_root_blocks_declaration: bool,
) -> Result<bool, CheckError> {
    let is_private = starts_with(ty, "_")?;
    if is_private && !has_root_blocks_declaration {
        return Ok(false);
    }
    let is_theme_in_root_level = root.iter().any(|b| is_str(b.ty(), "@theme"));
    let needs_explicit_root_block = is_private || !is_theme_in_root_level;
    let is_in_root_level = root.iter().any(|b| strict_eq(b.ty(), ty));
    Ok(!is_in_root_level && needs_explicit_root_block)
}

/// `validateBlockFileExistence(blockType, context)`
pub fn validate_block_file_existence(cx: &Context, block_type: Option<&Value>) -> bool {
    if is_str(block_type, "@theme") || is_str(block_type, "@app") {
        return true;
    }
    cx.file_exists(&cx.to_uri(&format!("blocks/{}.liquid", s(block_type))))
}

/// `validateNestedBlocks(context, parentNode, nestedBlocks, currentPath, offset, ast)`
pub fn validate_nested_blocks(
    cx: &mut Context,
    parent_node: &Value,
    nested_blocks: &Value,
    current_path: &[String],
    offset: usize,
    ast: &JsonNode,
) -> CheckResult {
    if !js::truthy(nested_blocks) {
        return Ok(());
    }
    let parent_type = get(parent_node, "type")?;
    let Some(parent_schema) = parent_type
        .and_then(Value::as_str)
        .and_then(|t| cx.get_block_schema(t))
    else {
        return Ok(());
    };
    let Some(valid_schema) = parent_schema.valid_value().filter(|v| js::truthy(v)) else {
        return Ok(());
    };
    let static_block_defs = &parent_schema.static_block_defs;
    let root = get_blocks(valid_schema)?.root_level_theme_blocks;
    let allowed_block_types: Vec<String> = root
        .iter()
        .map(|b| {
            b.ty().map_or(String::new(), |t| {
                if t.is_null() {
                    String::new()
                } else {
                    js::to_string(t)
                }
            })
        })
        .collect();
    let allowed = allowed_block_types.join(", ");

    let mut targets: Vec<(&Value, Vec<String>)> = Vec::new();
    match nested_blocks {
        Value::Array(blocks) => {
            for (i, b) in blocks.iter().enumerate() {
                targets.push((b, with(current_path, &["blocks", &i.to_string(), "type"])));
            }
        }
        Value::Object(blocks) => {
            for (key, b) in blocks {
                targets.push((b, with(current_path, &["blocks", key, "type"])));
            }
        }
        _ => {}
    }
    all(targets.into_iter().map(|(nested_block, nested_path)| {
        validate_block_targeting(
            cx,
            nested_block,
            &nested_path,
            parent_type,
            &root,
            &allowed,
            offset,
            ast,
            static_block_defs,
        )
    }))
}

#[allow(clippy::too_many_arguments)]
fn validate_block_targeting(
    cx: &mut Context,
    nested_block: &Value,
    nested_path: &[String],
    parent_type: Option<&Value>,
    root: &[BlockWithPath],
    allowed_block_types: &str,
    offset: usize,
    ast: &JsonNode,
    static_block_defs: &[StaticBlockDef],
) -> CheckResult {
    let type_node = node_at(ast, nested_path);
    let id = block_id(nested_block, nested_path)?;
    if type_node.is_some() {
        let ty = get(nested_block, "type")?;
        if is_invalid_preset_block(&id, nested_block, root, static_block_defs, true)? {
            let is_static = truthy(get(nested_block, "static")?);
            let is_private = starts_with(ty, "_")?;
            let message = if is_static {
                format!(
                    "Could not find a static block of type \"{}\" with id \"{}\" in \"blocks/{}.liquid\".",
                    s(ty),
                    js::to_string(&id),
                    s(parent_type)
                )
            } else if is_private {
                format!(
                    "Private block type \"{}\" is not allowed in \"{}\" blocks.",
                    s(ty),
                    s(parent_type)
                )
            } else {
                format!(
                    "Block type \"{}\" is not allowed in \"{}\" blocks. Allowed types are: {allowed_block_types}.",
                    s(ty),
                    s(parent_type)
                )
            };
            report_warning(cx, message, offset, type_node)?;
        }
        if !validate_block_file_existence(cx, ty) {
            report_warning(
                cx,
                format!("Theme block 'blocks/{}.liquid' does not exist.", s(ty)),
                offset,
                type_node,
            )?;
        }
    }
    if has(nested_block, "blocks")? {
        if let Some(blocks) = get(nested_block, "blocks")?.filter(|b| js::truthy(b)) {
            validate_nested_blocks(
                cx,
                nested_block,
                blocks,
                &nested_path[..nested_path.len() - 1],
                offset,
                ast,
            )?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn deep_get_follows_js() {
        let v = json!({ "a": { "b": "héllo" }, "l": [1, 2] });
        assert_eq!(
            deep_get(Some(&v), &["a", "b"]).as_deref(),
            Some(&json!("héllo"))
        );
        assert_eq!(
            deep_get(Some(&v), &["a", "b", "length"]).as_deref(),
            Some(&json!(5))
        );
        assert_eq!(
            deep_get(Some(&v), &["a", "b", "1"]).as_deref(),
            Some(&json!("é"))
        );
        assert_eq!(deep_get(Some(&v), &["l", "01"]), None);
        assert_eq!(deep_get(Some(&v), &["l", "1"]).as_deref(), Some(&json!(2)));
        assert_eq!(deep_get(Some(&v), &["x", "y"]), None);
        assert_eq!(deep_get(None, &["x"]), None);
    }
}
