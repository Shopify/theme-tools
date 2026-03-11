"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInvalidFilterName = detectInvalidFilterName;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
async function detectInvalidFilterName(node, filters) {
    if (!filters) {
        return [];
    }
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput) {
        if (typeof node.markup !== 'string') {
            return [];
        }
        return detectInvalidFilterNameInMarkup(node, node.markup, filters);
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
            return detectInvalidFilterNameInMarkup(node, node.markup, filters);
        }
    }
    return [];
}
async function detectInvalidFilterNameInMarkup(node, markup, filters) {
    var _a;
    const knownFilters = filters;
    const trimmedMarkup = markup.trim();
    const problems = [];
    const filterPattern = /\|\s*([a-zA-Z][a-zA-Z0-9_]*)/g;
    const matches = Array.from(trimmedMarkup.matchAll(filterPattern));
    for (const match of matches) {
        const filterName = match[1];
        if (!knownFilters.some((filter) => filter.name === filterName)) {
            continue;
        }
        const filterEndIndex = match.index + match[0].length;
        const afterFilter = trimmedMarkup.slice(filterEndIndex);
        // This regex finds invalid trailing characters after a filter name using lookaheads:
        // 1. Skip valid syntax like ": parameter" or "| nextfilter"
        // 2. Capture any junk characters that shouldn't be there
        // 3. Stop before valid boundaries like colons or pipes
        // e.g. "upcase xyz" finds "xyz", but "upcase | downcase" is ignored as valid
        const invalidSegment = (_a = afterFilter.match(/^(?!\s*(?::|$|\|\s*[a-zA-Z]|\|\s*\||\s*\|\s*(?:[}%]|$)))([^:|]+?)(?=\s*(?::|$|\|))/)) === null || _a === void 0 ? void 0 : _a[1];
        if (!invalidSegment) {
            continue;
        }
        const markupStartInSource = node.source.indexOf(markup, node.position.start);
        const trailingStartInSource = markupStartInSource + filterEndIndex;
        const trailingEndInSource = trailingStartInSource + invalidSegment.length;
        problems.push({
            message: `${utils_1.INVALID_SYNTAX_MESSAGE} Filter '${filterName}' has trailing characters '${invalidSegment}' that should be removed.`,
            startIndex: trailingStartInSource,
            endIndex: trailingEndInSource,
            fix: (corrector) => {
                corrector.replace(trailingStartInSource, trailingEndInSource, '');
            },
        });
    }
    return problems;
}
//# sourceMappingURL=InvalidFilterName.js.map