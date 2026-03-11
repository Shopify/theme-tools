"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockTypeCompletionProvider = void 0;
exports.createBlockNameCompletionItems = createBlockNameCompletionItems;
exports.isBlockDefinitionPath = isBlockDefinitionPath;
exports.isPresetBlockPath = isPresetBlockPath;
exports.isBlockTypePath = isBlockTypePath;
exports.hasLocalBlockDefinitions = hasLocalBlockDefinitions;
exports.isLocalBlockDefinition = isLocalBlockDefinition;
exports.isSectionOrBlockSchema = isSectionOrBlockSchema;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
/**
 * The BlockTypeCompletionProvider offers value completions of the
 * `blocks.[].type` property inside section and theme block `{% schema %}` tags.
 *
 * @example
 * {% schema %}
 * {
 *   "blocks": [
 *     { "type": "█" },
 *   ]
 * }
 * {% endschema %}
 */
class BlockTypeCompletionProvider {
    constructor(getThemeBlockNames) {
        this.getThemeBlockNames = getThemeBlockNames;
    }
    async completeValue(context, path) {
        if (!(0, utils_1.isSectionOrBlockFile)(context.doc.uri) ||
            !(0, RequestContext_1.isLiquidRequestContext)(context) ||
            !isBlockDefinitionPath(path)) {
            return [];
        }
        const { doc } = context;
        const schema = await doc.getSchema();
        // Can't complete if we can't parse the schema
        if (!schema || (0, theme_check_common_1.isError)(schema.parsed) || !isSectionOrBlockSchema(schema)) {
            return [];
        }
        // Local blocks have their type defined in the schema, there's nothing to complete
        if (hasLocalBlockDefinitions(schema))
            return [];
        const blockNames = await this.getThemeBlockNames(doc.uri, true);
        return createBlockNameCompletionItems(blockNames);
    }
}
exports.BlockTypeCompletionProvider = BlockTypeCompletionProvider;
function createBlockNameCompletionItems(blockNames) {
    return blockNames.map((name) => ({
        kind: vscode_languageserver_protocol_1.CompletionItemKind.Value,
        label: `"${name}"`,
        insertText: `"${name}"`,
    }));
}
function isBlockDefinitionPath(path) {
    return path.at(0) === 'blocks';
}
function isPresetBlockPath(path) {
    return path.at(0) === 'presets';
}
function isBlockTypePath(path) {
    // We have these cases to support:
    // - top level blocks.[].type
    // - presets.[](recursive .blocks.[].type)
    // - presets.[](recursive .blocks.{}.type)
    const topLevel = path.at(0);
    if (topLevel !== 'blocks' && topLevel !== 'presets')
        return false;
    if (path.length < 4)
        return false; // minimum path length
    const [shouldBeBlocks, _idOrIndex, shouldBeType] = path.slice(-3);
    return shouldBeBlocks === 'blocks' && shouldBeType === 'type';
}
function hasLocalBlockDefinitions(schema) {
    if (schema.type !== theme_check_common_1.ThemeSchemaType.Section || (0, theme_check_common_1.isError)(schema.parsed))
        return false;
    const blocks = (0, theme_check_common_1.deepGet)(schema.parsed, ['blocks']);
    if (!blocks || !Array.isArray(blocks))
        return false;
    return blocks.some((block) => block && block.name !== undefined);
}
function isLocalBlockDefinition(schema, blockTypePath) {
    if (schema.type !== theme_check_common_1.ThemeSchemaType.Section)
        return false;
    const blockNamePath = [...blockTypePath.slice(0, -1), 'name'];
    const name = (0, theme_check_common_1.deepGet)(schema.parsed, blockNamePath);
    return name !== undefined;
}
const SectionOrBlockSchemaTypes = [theme_check_common_1.ThemeSchemaType.Section, theme_check_common_1.ThemeSchemaType.Block];
function isSectionOrBlockSchema(schema) {
    return SectionOrBlockSchemaTypes.includes(schema.type);
}
//# sourceMappingURL=BlockTypeCompletionProvider.js.map