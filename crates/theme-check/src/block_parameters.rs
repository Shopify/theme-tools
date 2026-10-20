//! `block-parameters.ts` and `schema-settings.ts`.

use crate::js;
use crate::liquid_doc::{
    normalize_named_param_type, parse_string_literals, DocDefinition, LiquidDocParameter,
};
use serde_json::Value;

pub const BLOCK_CONTENT_PARAMETER: &str = "content";

#[derive(Clone, Debug)]
pub struct BlockParameter {
    pub name: String,
    pub type_: Option<String>,
    pub required: bool,
    /// The schema setting object.
    pub schema_setting: Option<Value>,
    pub liquid_doc: Option<LiquidDocParameter>,
}

/// TS `Map<string, BlockParameter>`, in insertion order. ponytail: linear lookups, blocks have a
/// handful of parameters.
#[derive(Clone, Debug, Default)]
pub struct BlockParameters(pub Vec<BlockParameter>);

impl BlockParameters {
    pub fn get(&self, name: &str) -> Option<&BlockParameter> {
        self.0.iter().find(|p| p.name == name)
    }
    pub fn iter(&self) -> impl Iterator<Item = &BlockParameter> {
        self.0.iter()
    }
    /// `map.set(name, p)`: replaces in place or appends.
    fn set(&mut self, p: BlockParameter) {
        match self.0.iter_mut().find(|q| q.name == p.name) {
            Some(q) => *q = p,
            None => self.0.push(p),
        }
    }
}

/// `resolveBlockParameters(schema, docDefinition)`. ponytail: settings that aren't objects are
/// skipped where TS would throw.
pub fn resolve_block_parameters(
    schema: Option<&Value>,
    doc: Option<&DocDefinition>,
) -> BlockParameters {
    let mut params = BlockParameters(vec![BlockParameter {
        name: BLOCK_CONTENT_PARAMETER.into(),
        type_: Some("string".into()),
        required: false,
        schema_setting: None,
        liquid_doc: None,
    }]);
    let settings = schema
        .and_then(|s| s.get("settings"))
        .and_then(Value::as_array);
    for setting in settings.into_iter().flatten() {
        // isInputSetting
        let Some(id) = setting.get("id").and_then(Value::as_str) else {
            continue;
        };
        let ty = setting.get("type");
        if ty
            .and_then(Value::as_str)
            .is_some_and(|t| t == "header" || t == "paragraph")
        {
            continue;
        }
        params.set(BlockParameter {
            name: id.into(),
            type_: if id == BLOCK_CONTENT_PARAMETER {
                Some("string".into())
            } else {
                ty.and_then(Value::as_str)
                    .and_then(schema_setting_liquid_type)
                    .map(str::to_string)
            },
            required: false,
            schema_setting: Some(setting.clone()),
            liquid_doc: None,
        });
    }
    for doc_param in doc
        .and_then(|d| d.liquid_doc.as_ref())
        .map_or(&[][..], |d| &d.parameters)
    {
        let p = match params.get(&doc_param.name) {
            Some(existing) => BlockParameter {
                required: doc_param.required,
                liquid_doc: Some(doc_param.clone()),
                ..existing.clone()
            },
            None => BlockParameter {
                name: doc_param.name.clone(),
                type_: match doc_param.type_.as_deref() {
                    Some(t) if !t.is_empty() && parse_string_literals(t).is_some() => {
                        Some(js::trim(t).to_string())
                    }
                    t => liquid_doc_type(t),
                },
                required: doc_param.required,
                schema_setting: None,
                liquid_doc: Some(doc_param.clone()),
            },
        };
        params.set(p);
    }
    params
}

/// `liquidDocType(type)`
pub fn liquid_doc_type(ty: Option<&str>) -> Option<String> {
    ty.filter(|t| !t.is_empty())
        .and_then(normalize_named_param_type)
}

/// `schemaSettingLiquidType(settingType)`
pub fn schema_setting_liquid_type(setting_type: &str) -> Option<&str> {
    Some(match setting_type {
        "checkbox" => "boolean",
        "number" | "range" => "number",
        "color_background" | "color_palette" | "html" | "inline_richtext" | "liquid" | "radio"
        | "richtext" | "select" | "text" | "text_alignment" | "textarea" | "url" | "video_url" => {
            "string"
        }
        "article" | "blog" | "collection" | "color" | "color_scheme" | "page" | "product"
        | "video" => setting_type,
        "font_picker" => "font",
        "image_picker" => "image",
        "link_list" => "linklist",
        "collection_list" => "collection[]",
        "product_list" => "product[]",
        _ => return None,
    })
}
