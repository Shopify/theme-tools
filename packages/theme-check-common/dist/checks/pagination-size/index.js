"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationSize = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
const json_1 = require("../../json");
const schema = {
    minSize: types_1.SchemaProp.number(1),
    maxSize: types_1.SchemaProp.number(250),
};
exports.PaginationSize = {
    meta: {
        code: 'PaginationSize',
        name: 'Ensure paginate tags are used with performant sizes',
        docs: {
            description: 'This check is aimed at keeping response times low.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/pagination-size',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema,
        targets: [],
    },
    create(context) {
        const minSize = context.settings.minSize;
        const maxSize = context.settings.maxSize;
        let schemaSettings = [];
        const pageSizeLookups = [];
        function checkPageSize(pageSizeNode, value, message = `Pagination size must be a positive integer between ${minSize} and ${maxSize}.`) {
            if (minSize <= value && value <= maxSize)
                return;
            context.report({
                message,
                startIndex: pageSizeNode.position.start,
                endIndex: pageSizeNode.position.end,
            });
        }
        return {
            async LiquidTag(node) {
                if (typeof node.markup === 'string' || node.name !== 'paginate')
                    return;
                const pageSizeNode = node.markup.pageSize;
                if ((0, utils_2.isNodeOfType)(liquid_html_parser_1.NodeTypes.VariableLookup, pageSizeNode)) {
                    pageSizeLookups.push(pageSizeNode);
                }
                else if ((0, utils_2.isNodeOfType)(liquid_html_parser_1.NodeTypes.Number, pageSizeNode)) {
                    checkPageSize(pageSizeNode, Number(pageSizeNode.value));
                }
            },
            async LiquidRawTag(node) {
                if (node.name === 'schema') {
                    const schema = (0, json_1.parseJSON)(node.body.value);
                    if ((0, utils_1.isError)(schema))
                        return;
                    if (schema.settings && Array.isArray(schema.settings)) {
                        schemaSettings = schema.settings;
                    }
                }
            },
            async onCodePathEnd() {
                pageSizeLookups.forEach((pageSizeVariableLookup) => {
                    // Kind of assumes that you're using settings of some sort.
                    const lastLookup = (0, utils_1.last)(pageSizeVariableLookup.lookups);
                    if (lastLookup === undefined)
                        return;
                    if (lastLookup.type !== liquid_html_parser_1.NodeTypes.String)
                        return;
                    const settingId = lastLookup.value;
                    const setting = schemaSettings.find((setting) => setting.id === settingId);
                    if (setting === undefined)
                        return;
                    if (setting.default === undefined) {
                        context.report({
                            message: `Default pagination size should be defined in the section settings.`,
                            startIndex: pageSizeVariableLookup.position.start,
                            endIndex: pageSizeVariableLookup.position.end,
                        });
                        return;
                    }
                    checkPageSize(pageSizeVariableLookup, setting.default, `This setting's default value should be between ${minSize} and ${maxSize} but is currently ${setting.default}.`);
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map