use super::schema_utils::{array, content_for_block, get, has, string_arg, truthy};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::{JsonNode, PathSeg::*};
use liquid_ast::{NodeKind, NodeRef};
use serde_json::Value;

pub static SCHEMA_PRESETS_STATIC_BLOCKS: CheckDef = CheckDef {
    code: "SchemaPresetsStaticBlocks",
    name: "Ensure the preset static blocks are used in the liquid",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct StaticBlock<'a> {
    /// `id` when it's a string (the only kind a `content_for` id can equal).
    id: Option<&'a str>,
    display_id: String,
    ty: Option<&'a str>,
    start: usize,
    end: usize,
}

#[derive(Default)]
struct Check<'a> {
    content_for_block_list: Vec<(&'a str, &'a str)>,
    static_block_list: Vec<StaticBlock<'a>>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidTag(tag) => {
                let Some(markup) = content_for_block(tag) else {
                    return Ok(());
                };
                // A missing or non-string type is VariableContentForArguments' job.
                let Some(ty) = string_arg(markup, "type") else {
                    return Ok(());
                };
                if let Some(id) = string_arg(markup, "id") {
                    self.content_for_block_list.push((&id.value, &ty.value));
                }
                Ok(())
            }
            NodeRef::LiquidRawTag(tag) if tag.name == "schema" && tag.body.kind == "json" => {
                self.collect_static_blocks(tag.block_start_position.end, cx)
            }
            _ => Ok(()),
        }
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for block in &self.static_block_list {
            let used = self
                .content_for_block_list
                .iter()
                .any(|&(id, ty)| block.id == Some(id) && block.ty == Some(ty));
            if !used {
                let message = format!(
                    "Static block {} is missing a corresponding content_for \"block\" tag.",
                    block.display_id
                );
                cx.report(message, block.start, block.end);
            }
        }
        Ok(())
    }
}

impl<'a> Check<'a> {
    fn collect_static_blocks(&mut self, offset: usize, cx: &mut Context<'a>) -> CheckResult {
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };
        let presets = get(valid_schema, "presets")?;
        if !truthy(presets) {
            return Ok(());
        }
        // `nodeAtPath(...)!` then `getLocStart(node)`, which throws on undefined.
        let loc = |node: Option<&JsonNode>| {
            let loc = node
                .ok_or_else(|| {
                    CheckError::new("Cannot read properties of undefined (reading 'loc')")
                })?
                .loc();
            Ok::<_, CheckError>((offset + loc.start, offset + loc.end))
        };
        for (index, preset) in array(presets, "presets.forEach")?.iter().enumerate() {
            if !has(preset, "blocks")? {
                continue;
            }
            match get(preset, "blocks")? {
                Some(Value::Array(blocks)) => {
                    for (block_index, block) in blocks.iter().enumerate() {
                        let id = get(block, "static")?
                            .filter(|s| **s == Value::Bool(true))
                            .and(get(block, "id")?);
                        let Some(id) = id.filter(|id| js::truthy(id)) else {
                            continue;
                        };
                        let (start, end) = loc(ast.at_path(&[
                            Key("presets"),
                            Index(index),
                            Key("blocks"),
                            Index(block_index),
                        ]))?;
                        let ty = get(block, "type")?.and_then(Value::as_str);
                        self.static_block_list.push(StaticBlock {
                            id: id.as_str(),
                            display_id: js::to_string(id),
                            ty,
                            start,
                            end,
                        });
                    }
                }
                Some(Value::Object(map)) => {
                    for (block_id, block) in map {
                        if get(block, "static")? != Some(&Value::Bool(true)) {
                            continue;
                        }
                        let (start, end) = loc(ast.at_path(&[
                            Key("presets"),
                            Index(index),
                            Key("blocks"),
                            Key(block_id),
                        ]))?;
                        let ty = get(block, "type")?.and_then(Value::as_str);
                        self.static_block_list.push(StaticBlock {
                            id: Some(block_id),
                            display_id: block_id.clone(),
                            ty,
                            start,
                            end,
                        });
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }
}
