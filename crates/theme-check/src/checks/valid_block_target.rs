use super::schema_utils::{
    all, block_id, get, get_blocks, has, is_invalid_default_block, is_invalid_preset_block,
    node_at, report_warning, s, starts_with, truthy, validate_block_file_existence,
    validate_nested_blocks,
};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static VALID_BLOCK_TARGET: CheckDef = CheckDef {
    code: "ValidBlockTarget",
    name: "Validate block targeting in presets",
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
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "schema" || tag.body.kind != "json" {
            return Ok(());
        }
        let offset = tag.block_start_position.end;
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };
        let static_block_defs = &schema.static_block_defs;

        let b = get_blocks(valid_schema)?;
        if !b.root_level_local_blocks.is_empty() {
            return Ok(());
        }
        let root = &b.root_level_theme_blocks;

        let mut errors_in_root_level_blocks = false;
        all(root.iter().map(|block| {
            let type_node = node_at(ast, &block.path);
            if !validate_block_file_existence(cx, block.ty()) {
                errors_in_root_level_blocks = true;
                report_warning(
                    cx,
                    block_does_not_exist_error(block.ty()),
                    offset,
                    type_node,
                )?;
            }
            Ok(())
        }))?;
        if errors_in_root_level_blocks {
            return Ok(());
        }

        // Only depth 0: validateNestedBlocks covers the deeper ones.
        all(b
            .preset_level_blocks
            .first()
            .into_iter()
            .flatten()
            .map(|block| {
                let (node, path) = (block.node, &block.path);
                let type_node = node_at(ast, path);
                let id = block_id(node, path)?;
                let is_static_block = truthy(get(node, "static")?);
                if is_invalid_preset_block(
                    &id,
                    node,
                    root,
                    static_block_defs,
                    b.has_root_blocks_declaration,
                )? {
                    let message = if is_static_block {
                        format!(
                        "Could not find a static block of type \"{}\" with id \"{}\" in this file.",
                        s(block.ty()),
                        js::to_string(&id)
                    )
                    } else {
                        missing_theme_block_definition_error(block.ty())?
                    };
                    report_warning(cx, message, offset, type_node)?;
                }
                if validate_block_file_existence(cx, block.ty()) {
                    if has(node, "blocks")? {
                        if let Some(blocks) = get(node, "blocks")?.filter(|b| js::truthy(b)) {
                            validate_nested_blocks(
                                cx,
                                node,
                                blocks,
                                &path[..path.len() - 1],
                                offset,
                                ast,
                            )?;
                        }
                    }
                } else {
                    report_warning(
                        cx,
                        block_does_not_exist_error(block.ty()),
                        offset,
                        type_node,
                    )?;
                }
                Ok(())
            }))?;

        all(b.default_level_blocks.iter().map(|block| {
            let type_node = node_at(ast, &block.path);
            if is_invalid_default_block(block.node, root, b.has_root_blocks_declaration)? {
                report_warning(
                    cx,
                    missing_theme_block_definition_error(block.ty())?,
                    offset,
                    type_node,
                )?;
            }
            if !validate_block_file_existence(cx, block.ty()) {
                report_warning(
                    cx,
                    block_does_not_exist_error(block.ty()),
                    offset,
                    type_node,
                )?;
            }
            Ok(())
        }))
    }
}

fn missing_theme_block_definition_error(ty: Option<&Value>) -> Result<String, CheckError> {
    Ok(if starts_with(ty, "_")? {
        format!(
            "Theme block type \"{}\" is a private block so it must be explicitly allowed in \"blocks\" at the root of this schema.",
            s(ty)
        )
    } else {
        format!(
            "Theme block type \"{}\" must be allowed in \"blocks\" at the root of this schema.",
            s(ty)
        )
    })
}

fn block_does_not_exist_error(name: Option<&Value>) -> String {
    format!("Theme block 'blocks/{}.liquid' does not exist.", s(name))
}
