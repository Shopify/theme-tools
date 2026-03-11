"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnclosedHTMLElement = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
exports.UnclosedHTMLElement = {
    meta: {
        code: 'UnclosedHTMLElement',
        aliases: ['UnclosedHTMLElement'],
        name: 'Unclosed HTML Element',
        docs: {
            description: 'Warns you of unbalanced HTML tags in branching code',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unclosed-html-element',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        /**
         * Algorithm explanation:
         *
         * When we have unclosed nodes, we have something a bit like this:
         *
         * <grandparent>
         *   {% if condition %}
         *     <unclosed1>
         *   {% else %}
         *     <unclosed2>
         *   {% endif %}
         *
         *   {% if condition %}
         *     </unclosed1>
         *   {% else %}
         *     </unclosed2>
         *   {% endif %}
         * </grandparent>
         *
         * When things are proper, we can see the following:
         *   - unclosed nodes must have the same parent condition,
         *   - unclosed nodes must have the same grandparent node.
         *
         * So what we can do is create stacks of unclosed nodes grouped by
         *   - parent condition, and
         *   - grandparent node.
         *
         * Thus we have
         *   - the stackByGrandparent Map which is the index by grandparent node
         *   - the Stacks object which is a by-condition-identifier index of open/close nodes
         *
         * When we're done with the file, we verify that the stacks push and
         * pop to the empty stack. When it isn't, then we have a problem to
         * report.
         */
        const stacksByGrandparent = new Map();
        return {
            async HtmlElement(node, ancestors) {
                if (isClosed(node))
                    return;
                const [branch, index] = (0, utils_1.findLastAndIndex)(ancestors, utils_2.isLiquidBranch);
                if (!branch)
                    return;
                const parent = ancestors[index - 1];
                const grandparent = ancestors[index - 2];
                if (!parent || !grandparent || parent.type !== liquid_html_parser_1.NodeTypes.LiquidTag)
                    return;
                if (!stacksByGrandparent.has(grandparent)) {
                    stacksByGrandparent.set(grandparent, {
                        open: new Map(),
                        close: new Map(),
                        identifiers: new Set(),
                    });
                }
                const stacks = stacksByGrandparent.get(grandparent);
                const identifier = getConditionIdentifier(branch, parent);
                stacks.identifiers.add(identifier);
                if (!stacks.open.has(identifier))
                    stacks.open.set(identifier, []);
                stacks.open.get(identifier).push(node);
            },
            async HtmlDanglingMarkerClose(node, ancestors) {
                const [branch, index] = (0, utils_1.findLastAndIndex)(ancestors, utils_2.isLiquidBranch);
                if (!branch)
                    return;
                const parent = ancestors[index - 1];
                const grandparent = ancestors[index - 2];
                if (!parent || !grandparent || parent.type !== liquid_html_parser_1.NodeTypes.LiquidTag)
                    return;
                if (!stacksByGrandparent.has(grandparent)) {
                    stacksByGrandparent.set(grandparent, {
                        open: new Map(),
                        close: new Map(),
                        identifiers: new Set(),
                    });
                }
                const stacks = stacksByGrandparent.get(grandparent);
                const identifier = getConditionIdentifier(branch, parent);
                stacks.identifiers.add(identifier);
                if (!stacks.close.has(identifier))
                    stacks.close.set(identifier, []);
                stacks.close.get(identifier).push(node);
            },
            async onCodePathEnd() {
                var _a, _b;
                for (const [grandparent, stacks] of stacksByGrandparent) {
                    for (const identifier of stacks.identifiers) {
                        const openNodes = (_a = stacks.open.get(identifier)) !== null && _a !== void 0 ? _a : [];
                        const closeNodes = (_b = stacks.close.get(identifier)) !== null && _b !== void 0 ? _b : [];
                        // We sort them in the order they are found in the file because we
                        // otherwise don't have an order guarantee with everything running
                        // async.
                        const nodes = []
                            .concat(openNodes, closeNodes)
                            .sort((a, b) => a.position.start - b.position.start);
                        // If everything is balanced,
                        //   Then we're going to push on open and pop when the close match.
                        // If a close doesn't match,
                        //   Then we'll push it onto the stack and everything after won't match.
                        const stack = [];
                        for (const node of nodes) {
                            if (node.type === liquid_html_parser_1.NodeTypes.HtmlElement) {
                                stack.push(node);
                            }
                            else if (stack.length > 0 &&
                                getName(node) === getName(stack.at(-1)) &&
                                stack.at(-1).type === liquid_html_parser_1.NodeTypes.HtmlElement &&
                                node.type === liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose) {
                                stack.pop();
                            }
                            else {
                                stack.push(node);
                            }
                        }
                        // At the end, whatever is left in the stack is a reported offense.
                        for (const node of stack) {
                            if (node.type === liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose) {
                                context.report({
                                    message: `Closing tag does not have a matching opening tag for condition \`${identifier}\` in ${grandparent.type} '${getName(grandparent)}'`,
                                    startIndex: node.position.start,
                                    endIndex: node.position.end,
                                });
                            }
                            else {
                                context.report({
                                    message: `Opening tag does not have a matching closing tag for condition \`${identifier}\` in ${grandparent.type} '${getName(grandparent)}'`,
                                    startIndex: node.blockStartPosition.start,
                                    endIndex: node.blockStartPosition.end,
                                });
                            }
                        }
                    }
                }
            },
        };
    },
};
function isClosed(node) {
    return node.blockEndPosition.start !== node.blockEndPosition.end;
}
function getConditionIdentifier(branch, parent) {
    if (branch.name === null) {
        switch (parent.name) {
            case liquid_html_parser_1.NamedTags.if:
                return getConditionIdentifierForMarkup(parent.markup);
            case liquid_html_parser_1.NamedTags.unless:
                return negateIdentifier(getConditionIdentifierForMarkup(parent.markup));
            default:
                return '??';
        }
    }
    switch (branch.name) {
        case 'else':
            switch (parent.name) {
                case liquid_html_parser_1.NamedTags.if:
                    return negateIdentifier(getConditionIdentifierForMarkup(parent.markup));
                case liquid_html_parser_1.NamedTags.unless:
                    return getConditionIdentifierForMarkup(parent.markup);
                case liquid_html_parser_1.NamedTags.case:
                    return `case ${getConditionIdentifierForMarkup(parent.markup)}`;
                default:
                    return '??';
            }
        case liquid_html_parser_1.NamedTags.elsif:
            return getConditionIdentifierForMarkup(branch.markup);
        case liquid_html_parser_1.NamedTags.when:
            if (parent.name !== liquid_html_parser_1.NamedTags.case)
                return '??';
            return `case ${getConditionIdentifierForMarkup(parent.markup)} == ${getConditionIdentifierForWhenMarkup(branch.markup)}`;
        default:
            return '??';
    }
}
function getConditionIdentifierForWhenMarkup(conditions) {
    if (typeof conditions === 'string')
        return conditions;
    return conditions.map(getConditionIdentifierForMarkup).join(' or ');
}
function getConditionIdentifierForMarkup(condition) {
    var _a;
    if (typeof condition === 'string')
        return condition;
    switch (condition.type) {
        case liquid_html_parser_1.NodeTypes.String:
            return `'` + condition.value + `'`;
        case liquid_html_parser_1.NodeTypes.LiquidLiteral:
            if (condition.value === null)
                return 'null';
            return condition.value.toString();
        case liquid_html_parser_1.NodeTypes.Number:
            return condition.value;
        case liquid_html_parser_1.NodeTypes.VariableLookup:
            return `${(_a = condition.name) !== null && _a !== void 0 ? _a : ''}${condition.lookups.map((expression) => `[${getConditionIdentifierForMarkup(expression)}]`)}`;
        case liquid_html_parser_1.NodeTypes.Range:
            return `(${getConditionIdentifierForMarkup(condition.start)}..${getConditionIdentifierForMarkup(condition.end)})`;
        case liquid_html_parser_1.NodeTypes.Comparison:
            return [
                getConditionIdentifierForMarkup(condition.left),
                condition.comparator,
                getConditionIdentifierForMarkup(condition.right),
            ].join(' ');
        case liquid_html_parser_1.NodeTypes.LogicalExpression:
            return [
                getConditionIdentifierForMarkup(condition.left),
                condition.relation,
                getConditionIdentifierForMarkup(condition.right),
            ].join(' ');
        default: {
            return (0, utils_1.assertNever)(condition);
        }
    }
}
function negateIdentifier(conditionIdentifier) {
    return conditionIdentifier.startsWith('-')
        ? conditionIdentifier.slice(1)
        : `-${conditionIdentifier}`;
}
function getName(node) {
    if (node.type === liquid_html_parser_1.NodeTypes.HtmlElement || node.type === liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose) {
        if (node.name.length === 0)
            return '';
        return node.source.slice(node.name.at(0).position.start, node.name.at(-1).position.end);
    }
    else if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag) {
        return node.name;
    }
    else {
        return node.type;
    }
}
//# sourceMappingURL=index.js.map