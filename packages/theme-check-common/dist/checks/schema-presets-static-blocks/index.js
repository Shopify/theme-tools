"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaPresetsStaticBlocks = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const json_1 = require("../../json");
const to_schema_1 = require("../../to-schema");
const types_1 = require("../../types");
const markup_1 = require("../../utils/markup");
exports.SchemaPresetsStaticBlocks = {
    meta: {
        code: 'SchemaPresetsStaticBlocks',
        name: 'Ensure the preset static blocks are used in the liquid',
        docs: {
            description: 'Warns if a preset static block does not have a corresponding content_for "block" tag.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/schema-presets-static-blocks',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        let contentForBlockList = [];
        let staticBlockList = [];
        let offset = 0;
        function checkStaticBlocks() {
            staticBlockList.forEach((block) => {
                if (!contentForBlockList.some((contentBlock) => contentBlock.id === block.id && contentBlock.type === block.type)) {
                    context.report({
                        message: `Static block ${block.id} is missing a corresponding content_for "block" tag.`,
                        startIndex: block.startIndex,
                        endIndex: block.endIndex,
                    });
                }
            });
        }
        return {
            async LiquidTag(node) {
                var _a, _b;
                // Early return if not a content_for block tag
                if (node.name !== liquid_html_parser_1.NamedTags.content_for || !(0, markup_1.isContentForBlock)(node.markup))
                    return;
                // Extract id and type from markup args
                const idValue = (_a = node.markup.args.find((arg) => arg.name === 'id')) === null || _a === void 0 ? void 0 : _a.value;
                const typeArg = (_b = node.markup.args.find((arg) => arg.name === 'type')) === null || _b === void 0 ? void 0 : _b.value;
                if (!typeArg || typeArg.type !== liquid_html_parser_1.NodeTypes.String) {
                    return; // covered by VariableContentForArguments
                }
                const typeValue = typeArg.value;
                // Add to list if valid string id
                if ((idValue === null || idValue === void 0 ? void 0 : idValue.type) === liquid_html_parser_1.NodeTypes.String) {
                    contentForBlockList.push({ id: idValue.value, type: typeValue });
                }
            },
            async LiquidRawTag(node) {
                // when we get the schema tag, get the list of static blocks from each preset
                if (node.name === 'schema' && node.body.kind === 'json') {
                    offset = node.blockStartPosition.end;
                    const schema = await (0, to_schema_1.getSchema)(context);
                    const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                    if (!validSchema || validSchema instanceof Error)
                        return;
                    if (!ast || ast instanceof Error)
                        return;
                    const presets = validSchema.presets;
                    if (!presets)
                        return;
                    presets.forEach((preset, index) => {
                        if ('blocks' in preset && preset.blocks) {
                            let ast_path = ['presets', index, 'blocks'];
                            // blocks as an array
                            if (Array.isArray(preset.blocks)) {
                                preset.blocks.forEach((block, block_index) => {
                                    if (block.static === true && block.id) {
                                        let node = (0, json_1.nodeAtPath)(ast, ast_path.concat([block_index]));
                                        staticBlockList.push({
                                            id: block.id,
                                            type: block.type,
                                            startIndex: offset + (0, json_1.getLocStart)(node),
                                            endIndex: offset + (0, json_1.getLocEnd)(node),
                                        });
                                    }
                                });
                            }
                            // blocks as an object
                            else if (typeof preset.blocks === 'object') {
                                Object.entries(preset.blocks).forEach(([block_id, block]) => {
                                    if (block.static === true) {
                                        let node = (0, json_1.nodeAtPath)(ast, ast_path.concat(block_id));
                                        staticBlockList.push({
                                            id: block_id,
                                            type: block.type,
                                            startIndex: offset + (0, json_1.getLocStart)(node),
                                            endIndex: offset + (0, json_1.getLocEnd)(node),
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            },
            async onCodePathEnd() {
                checkStaticBlocks();
            },
        };
    },
};
//# sourceMappingURL=index.js.map