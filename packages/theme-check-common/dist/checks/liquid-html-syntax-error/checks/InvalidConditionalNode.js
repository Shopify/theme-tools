"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInvalidConditionalNode = detectInvalidConditionalNode;
const utils_1 = require("./utils");
const TOKEN_PATTERNS = {
    logical: /^(and|or)$/,
    comparison: /^(==|!=|>=|<=|>|<|contains)$/,
    invalid: /^[@#$&]$/,
    literal: /^(['"][^'"]*['"]|\d+(?:\.\d+)?|true|false|nil|empty|blank)$/,
};
function classifyToken(value) {
    for (const [type, pattern] of Object.entries(TOKEN_PATTERNS)) {
        if (pattern.test(value)) {
            return type;
        }
    }
    return 'variable';
}
function detectInvalidConditionalNode(node) {
    if (!('name' in node) || !node.name)
        return;
    if (!['if', 'elsif', 'unless'].includes(String(node.name)))
        return;
    const markup = node.markup;
    if (typeof markup !== 'string' || !markup.trim())
        return;
    const issue = analyzeConditionalExpression(markup);
    if (!issue)
        return;
    const openingTagRange = node.blockStartPosition || node.position;
    const openingTag = node.source.slice(openingTagRange.start, openingTagRange.end);
    const markupOffsetInOpening = openingTag.indexOf(markup);
    if (markupOffsetInOpening < 0)
        return;
    const startIndex = openingTagRange.start + markupOffsetInOpening;
    const endIndex = startIndex + markup.length;
    return {
        message: `${utils_1.INVALID_SYNTAX_MESSAGE}: ${issue.message}`,
        startIndex,
        endIndex,
        fix: (corrector) => {
            corrector.replace(startIndex, endIndex, issue.fix);
        },
    };
}
function isValueToken(token) {
    return token.type === 'literal' || token.type === 'variable';
}
function isOperatorToken(token) {
    return token.type === 'logical' || token.type === 'comparison';
}
function checkInvalidStartingToken(tokens) {
    const firstToken = tokens[0];
    if (firstToken.type === 'invalid' || firstToken.type === 'comparison') {
        return {
            message: `Conditional cannot start with '${firstToken.value}'. Use a variable or value instead`,
            fix: 'false',
        };
    }
    return null;
}
function checkTrailingTokensAfterComparison(tokens) {
    const COMPARISON_LENGTH = 3;
    const minTokensForTrailing = COMPARISON_LENGTH + 1;
    for (let i = 0; i <= tokens.length - minTokensForTrailing; i++) {
        const [v1, op, v2] = tokens.slice(i, i + 3);
        const remaining = tokens.slice(i + 3);
        if (isValueToken(v1) && op.type === 'comparison' && isValueToken(v2)) {
            if (remaining.length > 0) {
                if (remaining[0].type !== 'logical') {
                    const validExpr = tokens
                        .slice(0, i + 3)
                        .map((t) => t.value)
                        .join(' ');
                    const junk = remaining.map((t) => t.value).join(' ');
                    const containsLogicalOperators = /&&|\|\|/.test(junk);
                    if (containsLogicalOperators) {
                        return {
                            message: `Conditional is invalid. Anything after '${validExpr}' will be ignored. Use 'and'/'or' instead of '&&'/'||' for multiple conditions`,
                            fix: validExpr,
                        };
                    }
                    else {
                        return {
                            message: `Conditional is invalid. Anything after '${validExpr}' will be ignored`,
                            fix: validExpr,
                        };
                    }
                }
            }
        }
    }
    return null;
}
function checkLaxParsingIssues(tokens) {
    var _a;
    for (let i = 0; i < tokens.length - 1; i++) {
        const current = tokens[i];
        const next = tokens[i + 1];
        if (current.type === 'literal' && !isOperatorToken(next)) {
            const remaining = tokens.slice(i + 1);
            const hasUnknownOperator = ((_a = remaining[0]) === null || _a === void 0 ? void 0 : _a.type) === 'variable' && remaining.some(isOperatorToken);
            if (!hasUnknownOperator) {
                const ignored = remaining.map((t) => t.value).join(' ');
                const containsLogicalOperators = /&&|\|\|/.test(ignored);
                if (containsLogicalOperators) {
                    return {
                        message: `Expression stops at truthy value '${current.value}', and will ignore: '${ignored}'. Use 'and'/'or' instead of '&&'/'||' for multiple conditions`,
                        fix: current.value,
                    };
                }
                else {
                    return {
                        message: `Expression stops at truthy value '${current.value}', and will ignore: '${ignored}'`,
                        fix: current.value,
                    };
                }
            }
        }
    }
    return null;
}
function analyzeConditionalExpression(markup) {
    const trimmed = markup.trim();
    if (!trimmed)
        return null;
    const tokens = (0, utils_1.getValuesInMarkup)(trimmed).map(({ value }) => ({
        value,
        type: classifyToken(value),
    }));
    if (tokens.length === 0)
        return null;
    return (checkInvalidStartingToken(tokens) ||
        checkTrailingTokensAfterComparison(tokens) ||
        checkLaxParsingIssues(tokens));
}
//# sourceMappingURL=InvalidConditionalNode.js.map