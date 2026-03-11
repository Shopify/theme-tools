"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidContentForArguments = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const content_for_1 = require("../../tags/content-for");
exports.ValidContentForArguments = {
    meta: {
        code: 'ValidContentForArguments',
        name: 'Prevent the use of invalid arguments to the content_for tag',
        docs: {
            description: 'This check is aimed at preventing the use of invalid arguments for the content_for tag.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-content-for-arguments',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        const validationStrategies = {
            blocks: (node) => {
                const problematicArguments = node.args.filter((arg) => !arg.name.startsWith(content_for_1.CLOSEST_ARGUMENT));
                for (const arg of problematicArguments) {
                    context.report({
                        message: `{% content_for "blocks" %} only accepts 'closest.*' arguments`,
                        startIndex: arg.position.start,
                        endIndex: arg.position.end,
                    });
                }
            },
            block: (node) => {
                // Make sure the id and string arguments are present and are strings
                for (const requiredArgumentName of content_for_1.REQUIRED_CONTENT_FOR_ARGUMENTS) {
                    const arg = node.args.find((arg) => arg.name === requiredArgumentName);
                    if (!arg) {
                        context.report({
                            message: `{% content_for "block" %} requires a '${requiredArgumentName}' argument`,
                            startIndex: node.position.start,
                            endIndex: node.position.end,
                            suggest: [],
                        });
                        continue;
                    }
                    const argValueNode = arg.value;
                    if (argValueNode.type !== liquid_html_parser_1.NodeTypes.String) {
                        context.report({
                            message: `The '${requiredArgumentName}' argument should be a string`,
                            startIndex: argValueNode.position.start,
                            endIndex: argValueNode.position.end,
                            suggest: [],
                        });
                    }
                }
                const problematicArguments = node.args.filter((arg) => content_for_1.RESERVED_CONTENT_FOR_ARGUMENTS.includes(arg.name));
                for (const arg of problematicArguments) {
                    context.report({
                        message: `{% content_for "block" %} doesn't support '${arg.name}' because it's a reserved argument.`,
                        startIndex: arg.position.start,
                        endIndex: arg.position.end,
                    });
                }
            },
        };
        return {
            async LiquidTag(node) {
                if (node.name !== 'content_for' || typeof node.markup === 'string') {
                    return;
                }
                /** "block", "blocks", etc. */
                const contentForType = node.markup.contentForType.value;
                const validate = validationStrategies[contentForType];
                if (!validate) {
                    return;
                }
                validate(node.markup);
            },
        };
    },
};
//# sourceMappingURL=index.js.map