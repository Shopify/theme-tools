"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInvalidPipeSyntax = detectInvalidPipeSyntax;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
async function detectInvalidPipeSyntax(node) {
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput) {
        if (typeof node.markup !== 'string') {
            return [];
        }
        return detectPipeSyntaxInMarkup(node, node.markup);
    }
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag) {
        if (node.name === liquid_html_parser_1.NamedTags.echo && typeof node.markup !== 'string') {
            return [];
        }
        if (node.name === liquid_html_parser_1.NamedTags.assign && typeof node.markup !== 'string') {
            return [];
        }
        if (typeof node.markup === 'string' &&
            (node.name === liquid_html_parser_1.NamedTags.echo || node.name === liquid_html_parser_1.NamedTags.assign)) {
            return detectPipeSyntaxInMarkup(node, node.markup);
        }
    }
    return [];
}
async function detectPipeSyntaxInMarkup(node, markup) {
    const problems = [];
    const trimmedMarkup = markup.trim();
    // Check for multiple consecutive pipes
    const extraPipesPattern = /(\|\s*){2,}/g;
    const extraPipesMatches = Array.from(trimmedMarkup.matchAll(extraPipesPattern));
    for (const match of extraPipesMatches) {
        const markupStartInSource = node.source.indexOf(markup, node.position.start);
        if (markupStartInSource === -1) {
            continue;
        }
        const problemStartInSource = markupStartInSource + match.index;
        const problemEndInSource = problemStartInSource + match[0].length;
        problems.push({
            message: `${utils_1.INVALID_SYNTAX_MESSAGE}. Remove extra \`|\` character(s).`,
            startIndex: problemStartInSource,
            endIndex: problemEndInSource,
            fix: (corrector) => {
                corrector.replace(problemStartInSource, problemEndInSource, '| ');
            },
        });
    }
    // Check for trailing pipes
    const trailingPipePattern = /\s*\|\s*$/;
    const trailingPipeMatch = trimmedMarkup.match(trailingPipePattern);
    if (trailingPipeMatch) {
        const markupStartInSource = node.source.indexOf(markup, node.position.start);
        if (markupStartInSource === -1) {
            return problems;
        }
        const trailingPipeStartInMarkup = trailingPipeMatch.index;
        const problemStartInSource = markupStartInSource + trailingPipeStartInMarkup;
        const problemEndInSource = problemStartInSource + trailingPipeMatch[0].length;
        problems.push({
            message: `${utils_1.INVALID_SYNTAX_MESSAGE}. Remove the trailing \`|\` character.`,
            startIndex: problemStartInSource,
            endIndex: problemEndInSource,
            fix: (corrector) => {
                corrector.replace(problemStartInSource, problemEndInSource, '');
            },
        });
    }
    return problems;
}
//# sourceMappingURL=InvalidPipeSyntax.js.map