//! `checks/index.ts`. Register a check by adding its module and its `CheckDef` to `ALL_CHECKS`,
//! keeping the TS `allChecks` order.

use crate::context::CheckDef;

pub mod liquid_syntax_error;
pub mod styles;
pub mod utils;

mod app_block_missing_schema;
mod app_block_valid_tags;
mod args_utils;
mod asset_preload;
mod asset_size;
mod asset_size_app_block;
mod block_content_usage;
mod block_id_usage;
mod block_tag_syntax;
mod cdn_preconnect;
mod content_for_header_modification;
mod deprecate_bgsizes;
mod deprecate_lazysizes;
mod deprecated_filter;
mod deprecated_fonts_data;
mod deprecated_fonts_on_sections_and_blocks;
mod deprecated_fonts_on_settings_data;
mod deprecated_fonts_on_settings_schema;
mod deprecated_tag;
mod duplicate_block_arguments;
mod duplicate_content_for_arguments;
mod duplicate_render_snippet_arguments;
mod empty_block_content;
mod excessive_settings_count;
mod file_utils;
mod hardcoded_routes;
mod img_width_and_height;
mod json_missing_block;
mod json_missing_section;
mod json_syntax_error;
mod liquid_complexity;
mod liquid_free_settings;
mod liquid_html_syntax_error;
mod liquid_nesting_depth;
mod matching_translations;
mod max_file_size;
mod missing_asset;
mod missing_block_arguments;
mod missing_content_for_arguments;
mod missing_render_snippet_arguments;
mod missing_template;
mod orphaned_snippet;
mod pagination_size;
mod parser_blocking_script;
mod raw_tags;
mod remote_asset;
mod required_layout_theme_object;
mod reserved_doc_param_names;
mod schema_presets_block_order;
mod schema_presets_static_blocks;
mod schema_utils;
mod static_stylesheet_and_javascript_tags;
mod translation_key_exists;
mod unclosed_html_element;
mod undefined_object;
mod unique_doc_param_names;
mod unique_setting_id;
mod unique_static_block_id;
mod unknown_filter;
mod unrecognized_block_arguments;
mod unrecognized_content_for_arguments;
mod unrecognized_render_snippet_arguments;
mod unsupported_doc_tag;
mod unsupported_filter_arguments;
mod unused_assign;
mod unused_doc_param;
mod valid_block_argument_types;
mod valid_block_content_setting_type;
mod valid_block_tag_placement;
mod valid_block_target;
mod valid_content_for_argument_types;
mod valid_content_for_arguments;
mod valid_doc_param_types;
mod valid_html_translation;
mod valid_json;
mod valid_local_blocks;
mod valid_render_snippet_argument_types;
mod valid_schema;
mod valid_schema_name;
mod valid_schema_translations;
mod valid_scoped_css_class;
mod valid_settings_key;
mod valid_standard_event_data;
mod valid_static_block_type;
mod valid_visible_if;
mod variable_name;

/// TS `allChecks` (ported ones), in the same order.
pub static ALL_CHECKS: &[&CheckDef] = &[
    &app_block_valid_tags::APP_BLOCK_VALID_TAGS,
    &asset_preload::ASSET_PRELOAD,
    &asset_size_app_block::ASSET_SIZE_APP_BLOCK_CSS,
    &asset_size_app_block::ASSET_SIZE_APP_BLOCK_JAVASCRIPT,
    &asset_size::ASSET_SIZE_CSS,
    &asset_size::ASSET_SIZE_JAVASCRIPT,
    &block_id_usage::BLOCK_ID_USAGE,
    &cdn_preconnect::CDN_PRECONNECT,
    &content_for_header_modification::CONTENT_FOR_HEADER_MODIFICATION,
    &deprecate_bgsizes::DEPRECATE_BGSIZES,
    &deprecate_lazysizes::DEPRECATE_LAZYSIZES,
    &deprecated_filter::DEPRECATED_FILTER,
    &deprecated_fonts_on_sections_and_blocks::DEPRECATED_FONTS_ON_SECTIONS_AND_BLOCKS,
    &deprecated_fonts_on_settings_data::DEPRECATED_FONTS_ON_SETTINGS_DATA,
    &deprecated_fonts_on_settings_schema::DEPRECATED_FONTS_ON_SETTINGS_SCHEMA,
    &deprecated_tag::DEPRECATED_TAG,
    &duplicate_content_for_arguments::DUPLICATE_CONTENT_FOR_ARGUMENTS,
    &duplicate_render_snippet_arguments::DUPLICATE_RENDER_SNIPPET_ARGUMENTS,
    &empty_block_content::EMPTY_BLOCK_CONTENT,
    &hardcoded_routes::HARDCODED_ROUTES,
    &img_width_and_height::IMG_WIDTH_AND_HEIGHT,
    &json_missing_block::JSON_MISSING_BLOCK,
    &json_missing_section::JSON_MISSING_SECTION,
    &json_syntax_error::JSON_SYNTAX_ERROR,
    &liquid_free_settings::LIQUID_FREE_SETTINGS,
    &liquid_html_syntax_error::LIQUID_HTML_SYNTAX_ERROR,
    &matching_translations::MATCHING_TRANSLATIONS,
    &missing_asset::MISSING_ASSET,
    &missing_content_for_arguments::MISSING_CONTENT_FOR_ARGUMENTS,
    &missing_render_snippet_arguments::MISSING_RENDER_SNIPPET_ARGUMENTS,
    &missing_template::MISSING_TEMPLATE,
    &unsupported_filter_arguments::UNSUPPORTED_FILTER_ARGUMENTS,
    &app_block_missing_schema::APP_BLOCK_MISSING_SCHEMA,
    &orphaned_snippet::ORPHANED_SNIPPET,
    &pagination_size::PAGINATION_SIZE,
    &parser_blocking_script::PARSER_BLOCKING_SCRIPT,
    &schema_presets_block_order::SCHEMA_PRESETS_BLOCK_ORDER,
    &schema_presets_static_blocks::SCHEMA_PRESETS_STATIC_BLOCKS,
    &remote_asset::REMOTE_ASSET,
    &required_layout_theme_object::REQUIRED_LAYOUT_THEME_OBJECT,
    &reserved_doc_param_names::RESERVED_DOC_PARAM_NAMES,
    &static_stylesheet_and_javascript_tags::STATIC_STYLESHEET_AND_JAVASCRIPT_TAGS,
    &translation_key_exists::TRANSLATION_KEY_EXISTS,
    &unclosed_html_element::UNCLOSED_HTML_ELEMENT,
    &undefined_object::UNDEFINED_OBJECT,
    &unique_doc_param_names::UNIQUE_DOC_PARAM_NAMES,
    &unique_setting_id::UNIQUE_SETTING_ID,
    &unique_static_block_id::UNIQUE_STATIC_BLOCK_ID,
    &unknown_filter::UNKNOWN_FILTER,
    &unrecognized_content_for_arguments::UNRECOGNIZED_CONTENT_FOR_ARGUMENTS,
    &unrecognized_render_snippet_arguments::UNRECOGNIZED_RENDER_SNIPPET_ARGUMENTS,
    &unsupported_doc_tag::UNSUPPORTED_DOC_TAG,
    &unused_assign::UNUSED_ASSIGN,
    &unused_doc_param::UNUSED_DOC_PARAM,
    &valid_block_target::VALID_BLOCK_TARGET,
    &valid_html_translation::VALID_HTML_TRANSLATION,
    &valid_content_for_arguments::VALID_CONTENT_FOR_ARGUMENTS,
    &valid_content_for_argument_types::VALID_CONTENT_FOR_ARGUMENT_TYPES,
    &valid_scoped_css_class::VALID_SCOPED_CSS_CLASS,
    &valid_json::VALID_JSON,
    &valid_doc_param_types::VALID_DOC_PARAM_TYPES,
    &valid_local_blocks::VALID_LOCAL_BLOCKS,
    &valid_render_snippet_argument_types::VALID_RENDER_SNIPPET_ARGUMENT_TYPES,
    &valid_schema::VALID_SCHEMA,
    &valid_settings_key::VALID_SETTINGS_KEY,
    &valid_standard_event_data::VALID_STANDARD_EVENT_DATA,
    &valid_static_block_type::VALID_STATIC_BLOCK_TYPE,
    &valid_visible_if::VALID_VISIBLE_IF,
    &valid_visible_if::VALID_VISIBLE_IF_SETTINGS_SCHEMA,
    &variable_name::VARIABLE_NAME,
    &valid_schema_name::VALID_SCHEMA_NAME,
    &valid_schema_translations::VALID_SCHEMA_TRANSLATIONS,
    &raw_tags::JAVASCRIPT_ONCE_PER_FILE,
    &raw_tags::JAVASCRIPT_TAG_IN_WRONG_FILE,
    &raw_tags::SCHEMA_ONCE_PER_FILE,
    &raw_tags::SCHEMA_SECTION_OR_BLOCK_ONLY,
    &raw_tags::STYLESHEET_ONCE_PER_FILE,
    &raw_tags::STYLESHEET_TAG_IN_WRONG_FILE,
    &block_content_usage::BLOCK_CONTENT_USAGE,
    &duplicate_block_arguments::DUPLICATE_BLOCK_ARGUMENTS,
    &excessive_settings_count::EXCESSIVE_SETTINGS_COUNT,
    &liquid_complexity::LIQUID_COMPLEXITY,
    &liquid_nesting_depth::LIQUID_NESTING_DEPTH,
    &liquid_syntax_error::LIQUID_SYNTAX_ERROR,
    &max_file_size::MAX_FILE_SIZE,
    &max_file_size::MAX_FILE_SIZE_JSON,
    &missing_block_arguments::MISSING_BLOCK_ARGUMENTS,
    &unrecognized_block_arguments::UNRECOGNIZED_BLOCK_ARGUMENTS,
    &valid_block_argument_types::VALID_BLOCK_ARGUMENT_TYPES,
    &valid_block_content_setting_type::VALID_BLOCK_CONTENT_SETTING_TYPE,
    &valid_block_tag_placement::VALID_BLOCK_TAG_PLACEMENT,
];

/// TS `recommended`: `docs.recommended` and (no targets or targets include Recommended).
pub fn recommended() -> Vec<&'static CheckDef> {
    ALL_CHECKS
        .iter()
        .copied()
        .filter(|c| c.recommended)
        .collect()
}

/// A check by code or alias.
pub fn find(code: &str) -> Option<&'static CheckDef> {
    ALL_CHECKS
        .iter()
        .copied()
        .find(|c| c.code == code || c.aliases.contains(&code))
}
