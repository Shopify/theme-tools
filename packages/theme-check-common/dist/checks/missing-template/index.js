"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingTemplate = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const minimatch_1 = require("minimatch");
const types_1 = require("../../types");
const file_utils_1 = require("../../utils/file-utils");
const schema = {
    ignoreMissing: types_1.SchemaProp.array(types_1.SchemaProp.string(), []),
};
exports.MissingTemplate = {
    meta: {
        code: 'MissingTemplate',
        name: 'Avoid rendering missing templates',
        docs: {
            description: 'Reports missing include/render/section liquid file',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-template',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema,
        targets: [],
    },
    create(context) {
        const isNamedLiquidTag = (tag) => typeof tag.markup !== 'string';
        function isIgnored(relativePath) {
            return context.settings.ignoreMissing.some((pattern) => (0, minimatch_1.minimatch)(relativePath, pattern));
        }
        async function maybeReportMissing(relativePath, { position }) {
            const fileExists = await (0, file_utils_1.doesFileExist)(context, relativePath);
            if (fileExists || isIgnored(relativePath))
                return;
            context.report({
                message: `'${relativePath}' does not exist`,
                startIndex: position.start,
                endIndex: position.end,
            });
        }
        return {
            async RenderMarkup(node) {
                if (node.snippet.type === liquid_html_parser_1.NodeTypes.VariableLookup)
                    return;
                const snippet = node.snippet;
                const relativePath = `snippets/${snippet.value}.liquid`;
                await maybeReportMissing(relativePath, snippet);
            },
            async LiquidTag(node) {
                if (!isNamedLiquidTag(node))
                    return;
                if (node.name !== liquid_html_parser_1.NamedTags.section)
                    return;
                const markup = node.markup;
                const relativePath = `sections/${markup.value}.liquid`;
                await maybeReportMissing(relativePath, markup);
            },
        };
    },
};
//# sourceMappingURL=index.js.map