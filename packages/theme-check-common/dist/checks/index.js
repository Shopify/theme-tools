"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommended = exports.allChecks = void 0;
const types_1 = require("../types");
const app_block_valid_tags_1 = require("./app-block-valid-tags");
const asset_preload_1 = require("./asset-preload");
const asset_size_app_block_css_1 = require("./asset-size-app-block-css");
const asset_size_app_block_javascript_1 = require("./asset-size-app-block-javascript");
const asset_size_css_1 = require("./asset-size-css");
const asset_size_javascript_1 = require("./asset-size-javascript");
const block_id_usage_1 = require("./block-id-usage");
const cdn_preconnect_1 = require("./cdn-preconnect");
const content_for_header_modification_1 = require("./content-for-header-modification");
const deprecate_bgsizes_1 = require("./deprecate-bgsizes");
const deprecate_lazysizes_1 = require("./deprecate-lazysizes");
const deprecated_filter_1 = require("./deprecated-filter");
const deprecated_fonts_on_sections_and_blocks_1 = require("./deprecated-fonts-on-sections-and-blocks");
const deprecated_fonts_on_settings_schema_1 = require("./deprecated-fonts-on-settings-schema");
const deprecated_tag_1 = require("./deprecated-tag");
const duplicate_render_snippet_arguments_1 = require("./duplicate-render-snippet-arguments");
const duplicate_content_for_arguments_1 = require("./duplicate-content-for-arguments");
const empty_block_content_1 = require("./empty-block-content");
const hardcoded_routes_1 = require("./hardcoded-routes");
const img_width_and_height_1 = require("./img-width-and-height");
const json_missing_block_1 = require("./json-missing-block");
const json_syntax_error_1 = require("./json-syntax-error");
const liquid_free_settings_1 = require("./liquid-free-settings");
const liquid_html_syntax_error_1 = require("./liquid-html-syntax-error");
const matching_translations_1 = require("./matching-translations");
const missing_asset_1 = require("./missing-asset");
const missing_content_for_arguments_1 = require("./missing-content-for-arguments");
const missing_render_snippet_arguments_1 = require("./missing-render-snippet-arguments");
const missing_template_1 = require("./missing-template");
const orphaned_snippet_1 = require("./orphaned-snippet");
const pagination_size_1 = require("./pagination-size");
const parser_blocking_script_1 = require("./parser-blocking-script");
const schema_presets_block_order_1 = require("./schema-presets-block-order");
const schema_presets_static_blocks_1 = require("./schema-presets-static-blocks");
const remote_asset_1 = require("./remote-asset");
const required_layout_theme_object_1 = require("./required-layout-theme-object");
const reserved_doc_param_names_1 = require("./reserved-doc-param-names");
const static_stylesheet_and_javascript_tags_1 = require("./static-stylesheet-and-javascript-tags");
const translation_key_exists_1 = require("./translation-key-exists");
const unclosed_html_element_1 = require("./unclosed-html-element");
const undefined_object_1 = require("./undefined-object");
const unique_doc_param_names_1 = require("./unique-doc-param-names");
const unique_static_block_id_1 = require("./unique-static-block-id");
const unknown_filter_1 = require("./unknown-filter");
const unrecognized_content_for_arguments_1 = require("./unrecognized-content-for-arguments");
const unrecognized_render_snippet_arguments_1 = require("./unrecognized-render-snippet-arguments");
const unused_assign_1 = require("./unused-assign");
const unsupported_doc_tag_1 = require("./unsupported-doc-tag");
const unused_doc_param_1 = require("./unused-doc-param");
const valid_content_for_arguments_1 = require("./valid-content-for-arguments");
const valid_content_for_argument_types_1 = require("./valid-content-for-argument-types");
const valid_block_target_1 = require("./valid-block-target");
const valid_html_translation_1 = require("./valid-html-translation");
const valid_json_1 = require("./valid-json");
const valid_doc_param_types_1 = require("./valid-doc-param-types");
const valid_local_blocks_1 = require("./valid-local-blocks");
const valid_render_snippet_argument_types_1 = require("./valid-render-snippet-argument-types");
const valid_schema_1 = require("./valid-schema");
const valid_schema_name_1 = require("./valid-schema-name");
const valid_schema_translations_1 = require("./valid-schema-translations");
const valid_settings_key_1 = require("./valid-settings-key");
const valid_static_block_type_1 = require("./valid-static-block-type");
const valid_visible_if_1 = require("./valid-visible-if");
const variable_name_1 = require("./variable-name");
const app_block_missing_schema_1 = require("./app-block-missing-schema");
const unique_settings_id_1 = require("./unique-settings-id");
exports.allChecks = [
    app_block_valid_tags_1.AppBlockValidTags,
    asset_preload_1.AssetPreload,
    asset_size_app_block_css_1.AssetSizeAppBlockCSS,
    asset_size_app_block_javascript_1.AssetSizeAppBlockJavaScript,
    asset_size_css_1.AssetSizeCSS,
    asset_size_javascript_1.AssetSizeJavaScript,
    block_id_usage_1.BlockIdUsage,
    cdn_preconnect_1.CdnPreconnect,
    content_for_header_modification_1.ContentForHeaderModification,
    deprecate_bgsizes_1.DeprecateBgsizes,
    deprecate_lazysizes_1.DeprecateLazysizes,
    deprecated_filter_1.DeprecatedFilter,
    deprecated_fonts_on_sections_and_blocks_1.DeprecatedFontsOnSectionsAndBlocks,
    deprecated_fonts_on_settings_schema_1.DeprecatedFontsOnSettingsSchema,
    deprecated_tag_1.DeprecatedTag,
    duplicate_content_for_arguments_1.DuplicateContentForArguments,
    duplicate_render_snippet_arguments_1.DuplicateRenderSnippetArguments,
    empty_block_content_1.EmptyBlockContent,
    hardcoded_routes_1.HardcodedRoutes,
    img_width_and_height_1.ImgWidthAndHeight,
    json_missing_block_1.JSONMissingBlock,
    json_syntax_error_1.JSONSyntaxError,
    liquid_free_settings_1.LiquidFreeSettings,
    liquid_html_syntax_error_1.LiquidHTMLSyntaxError,
    matching_translations_1.MatchingTranslations,
    missing_asset_1.MissingAsset,
    missing_content_for_arguments_1.MissingContentForArguments,
    missing_render_snippet_arguments_1.MissingRenderSnippetArguments,
    missing_template_1.MissingTemplate,
    app_block_missing_schema_1.AppBlockMissingSchema,
    orphaned_snippet_1.OrphanedSnippet,
    pagination_size_1.PaginationSize,
    parser_blocking_script_1.ParserBlockingScript,
    schema_presets_block_order_1.SchemaPresetsBlockOrder,
    schema_presets_static_blocks_1.SchemaPresetsStaticBlocks,
    remote_asset_1.RemoteAsset,
    required_layout_theme_object_1.RequiredLayoutThemeObject,
    reserved_doc_param_names_1.ReservedDocParamNames,
    static_stylesheet_and_javascript_tags_1.StaticStylesheetAndJavascriptTags,
    translation_key_exists_1.TranslationKeyExists,
    unclosed_html_element_1.UnclosedHTMLElement,
    undefined_object_1.UndefinedObject,
    unique_doc_param_names_1.UniqueDocParamNames,
    unique_settings_id_1.UniqueSettingIds,
    unique_static_block_id_1.UniqueStaticBlockId,
    unknown_filter_1.UnknownFilter,
    unrecognized_content_for_arguments_1.UnrecognizedContentForArguments,
    unrecognized_render_snippet_arguments_1.UnrecognizedRenderSnippetArguments,
    unsupported_doc_tag_1.UnsupportedDocTag,
    unused_assign_1.UnusedAssign,
    unused_doc_param_1.UnusedDocParam,
    valid_block_target_1.ValidBlockTarget,
    valid_html_translation_1.ValidHTMLTranslation,
    valid_content_for_arguments_1.ValidContentForArguments,
    valid_content_for_argument_types_1.ValidContentForArgumentTypes,
    valid_json_1.ValidJSON,
    valid_doc_param_types_1.ValidDocParamTypes,
    valid_local_blocks_1.ValidLocalBlocks,
    valid_render_snippet_argument_types_1.ValidRenderSnippetArgumentTypes,
    valid_schema_1.ValidSchema,
    valid_settings_key_1.ValidSettingsKey,
    valid_static_block_type_1.ValidStaticBlockType,
    valid_visible_if_1.ValidVisibleIf,
    valid_visible_if_1.ValidVisibleIfSettingsSchema,
    variable_name_1.VariableName,
    valid_schema_name_1.ValidSchemaName,
    valid_schema_translations_1.ValidSchemaTranslations,
];
/**
 * The recommended checks is populated by all checks with the following conditions:
 * - meta.docs.recommended: true
 * - Either no meta.targets list exist or if it does exist then Recommended is a target
 */
exports.recommended = exports.allChecks.filter((check) => {
    const isRecommended = check.meta.docs.recommended;
    const isValidTarget = !check.meta.targets ||
        !check.meta.targets.length ||
        check.meta.targets.includes(types_1.ConfigTarget.Recommended);
    return isRecommended && isValidTarget;
});
//# sourceMappingURL=index.js.map