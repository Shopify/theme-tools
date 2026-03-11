"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embed3 = exports.embed2 = exports.ParserMap = void 0;
const prettier_1 = require("prettier");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const { builders: { dedentToRoot, indent, hardline }, } = prettier_1.doc;
// null will pass through
exports.ParserMap = {
    [liquid_html_parser_1.RawMarkupKinds.css]: 'css',
    [liquid_html_parser_1.RawMarkupKinds.html]: null,
    [liquid_html_parser_1.RawMarkupKinds.javascript]: 'babel',
    [liquid_html_parser_1.RawMarkupKinds.json]: 'json',
    [liquid_html_parser_1.RawMarkupKinds.markdown]: 'markdown',
    [liquid_html_parser_1.RawMarkupKinds.typescript]: 'typescript',
    [liquid_html_parser_1.RawMarkupKinds.text]: null,
};
// Prettier 2 and 3 have a slightly different API for embed.
//
// https://github.com/prettier/prettier/wiki/How-to-migrate-my-plugin-to-support-Prettier-v3%3F
const embed2 = (path, _print, textToDoc, options) => {
    const node = path.getValue();
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.RawMarkup: {
            const parser = exports.ParserMap[node.kind];
            if (parser && node.value.trim() !== '') {
                const body = prettier_1.doc.utils.stripTrailingHardline(textToDoc(node.value, {
                    ...options,
                    singleQuote: options.embeddedSingleQuote,
                    parser,
                    __embeddedInHtml: true,
                }));
                if (shouldIndentBody(node, options)) {
                    return [indent([hardline, body]), hardline];
                }
                else {
                    return [dedentToRoot([hardline, body]), hardline];
                }
            }
        }
        default:
            return null;
    }
};
exports.embed2 = embed2;
const embed3 = (path, options) => {
    return (textToDoc) => {
        const node = path.node;
        switch (node.type) {
            case liquid_html_parser_1.NodeTypes.RawMarkup: {
                const parser = exports.ParserMap[node.kind];
                if (parser && node.value.trim() !== '') {
                    return textToDoc(node.value, {
                        ...options,
                        singleQuote: options.embeddedSingleQuote,
                        parser,
                        __embeddedInHtml: true,
                    }).then((document) => {
                        const body = prettier_1.doc.utils.stripTrailingHardline(document);
                        if (shouldIndentBody(node, options)) {
                            return [indent([hardline, body]), hardline];
                        }
                        else {
                            return [dedentToRoot([hardline, body]), hardline];
                        }
                    });
                }
            }
            default:
                return undefined;
        }
    };
};
exports.embed3 = embed3;
function shouldIndentBody(node, options) {
    const parentNode = node.parentNode;
    const shouldNotIndentBody = parentNode &&
        parentNode.type === liquid_html_parser_1.NodeTypes.LiquidRawTag &&
        parentNode.name === 'schema' &&
        !options.indentSchema;
    return node.kind !== liquid_html_parser_1.RawMarkupKinds.markdown && !shouldNotIndentBody;
}
//# sourceMappingURL=embed.js.map