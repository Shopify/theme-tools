"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferencedBlockTypeCompletionProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
const BlockTypeCompletionProvider_1 = require("./BlockTypeCompletionProvider");
/**
 * The ReferencedBlockTypeCompletionProvider offers value completions of the
 * `presets.[](recursive .blocks.[]).type` value and `default.blocks.[].type` value inside
 * section and theme block `{% schema %}` tags.
 *
 * @example
 * {% schema %}
 * {
 *   "presets": [
 *     {
 *       "blocks": [
 *         { "type": "█" },
 *       ]
 *     },
 *   ],
 *   "default": {
 *     "blocks": [
 *       { "type": "█" },
 *     ]
 *   }
 * }
 * {% endschema %}
 */
class ReferencedBlockTypeCompletionProvider {
    constructor(getThemeBlockNames, getThemeBlockSchema) {
        this.getThemeBlockNames = getThemeBlockNames;
        this.getThemeBlockSchema = getThemeBlockSchema;
    }
    async completeValue(context, path) {
        if (!(0, utils_1.isSectionOrBlockFile)(context.doc.uri) ||
            !(0, RequestContext_1.isLiquidRequestContext)(context) ||
            !isBlockTypePath(path)) {
            return [];
        }
        const { doc } = context;
        const schema = await doc.getSchema();
        if (!schema || (0, theme_check_common_1.isError)(schema.parsed) || !(0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(schema)) {
            return [];
        }
        let parsedBlockSchema = schema.parsed;
        if (isNestedBlockPath(path)) {
            const parentBlockName = getParentBlockName(schema.parsed, path);
            if (!parentBlockName) {
                return [];
            }
            const parentBlockSchema = await this.getThemeBlockSchema(doc.uri, parentBlockName);
            if (!parentBlockSchema ||
                (0, theme_check_common_1.isError)(parentBlockSchema.parsed) ||
                !(0, BlockTypeCompletionProvider_1.isSectionOrBlockSchema)(parentBlockSchema)) {
                return [];
            }
            parsedBlockSchema = parentBlockSchema.parsed;
        }
        const blocks = parsedBlockSchema.blocks || [];
        const blockGroups = {
            themeBlocks: false,
            specificBlockNames: [],
        };
        blocks.forEach((block) => {
            if (block.type === '@theme') {
                blockGroups.themeBlocks = true;
            }
            else if (!block.type.startsWith('@')) {
                blockGroups.specificBlockNames.push(block.type);
            }
        });
        let blockNames = blockGroups.specificBlockNames;
        if (blockGroups.themeBlocks) {
            blockNames.push(...(await this.getThemeBlockNames(doc.uri, false)));
        }
        return (0, BlockTypeCompletionProvider_1.createBlockNameCompletionItems)(blockNames);
    }
}
exports.ReferencedBlockTypeCompletionProvider = ReferencedBlockTypeCompletionProvider;
// `blocks` can be nested within other `blocks`
// We need to ensure the last leg of the path is { "blocks": [{ "type": "█" }] }
function isBlockTypePath(path) {
    return ((path.at(0) === 'presets' || path.at(0) === 'default') &&
        path.at(-3) === 'blocks' &&
        path.at(-1) === 'type');
}
function isNestedBlockPath(path) {
    return path.at(-5) === 'blocks' && path.at(-3) === 'blocks' && path.at(-1) === 'type';
}
function getParentBlockName(parsedSchema, path) {
    return (0, theme_check_common_1.deepGet)(parsedSchema, [...path.slice(0, -3), 'type']);
}
//# sourceMappingURL=ReferencedBlockTypeCompletionProvider.js.map