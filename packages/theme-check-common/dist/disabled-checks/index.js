"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDisabledChecksModule = createDisabledChecksModule;
exports.findNextLinePosition = findNextLinePosition;
const types_1 = require("../types");
const visitor_1 = require("../visitor");
const utils_1 = require("../utils");
function createDisabledChecksModule() {
    const SPECIFIC_CHECK_NOT_DEFINED = '@all';
    const INLINE_COMMENT_TAG = '#';
    const disabledChecks = new Map();
    function determineRanges(file, value, node) {
        const [_, command, checksJoined] = value.trim().match(/^(?:theme\-check\-(disable-next-line|disable|enable)) ?(.*)/) || [];
        const checks = checksJoined ? checksJoined.split(/,[ ]*/) : [SPECIFIC_CHECK_NOT_DEFINED];
        checks.forEach((check) => {
            const disabledRanges = disabledChecks.get(file.uri);
            if (command === 'disable-next-line' && !(0, utils_1.isError)(file.ast)) {
                const nextLinePosition = findNextLinePosition(file.ast, node);
                if (nextLinePosition) {
                    if (!disabledRanges.has(check)) {
                        disabledRanges.set(check, []);
                    }
                    disabledRanges.get(check).push({
                        from: nextLinePosition.start,
                        to: nextLinePosition.end,
                    });
                }
            }
            if (command === 'disable') {
                if (!disabledRanges.has(check)) {
                    disabledRanges.set(check, []);
                }
                disabledRanges.get(check).push({ from: node.position.end });
            }
            if (command === 'enable') {
                let disabledRangesForCheck = disabledRanges.get(check);
                if (disabledRangesForCheck) {
                    disabledRangesForCheck[disabledRangesForCheck.length - 1].to = node.position.start;
                }
                else {
                    if (check === SPECIFIC_CHECK_NOT_DEFINED) {
                        for (let ranges of disabledRanges.values()) {
                            for (let range of ranges) {
                                if (!range.to) {
                                    range.to = node.position.start;
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    const DisabledChecksVisitor = {
        meta: { schema: {} },
        create: ({ file }) => ({
            async onCodePathStart() {
                disabledChecks.set(file.uri, new Map());
            },
            async LiquidRawTag(node) {
                if (node.name !== 'comment') {
                    return;
                }
                determineRanges(file, node.body.value, node);
            },
            async LiquidTag(node) {
                if (typeof node.markup !== 'string' || node.name !== INLINE_COMMENT_TAG) {
                    return;
                }
                determineRanges(file, node.markup, node);
            },
        }),
    };
    function isDisabled(offense) {
        const ranges = [SPECIFIC_CHECK_NOT_DEFINED, offense.check].flatMap((check) => {
            if (!disabledChecks.has(offense.uri)) {
                return [];
            }
            if (!disabledChecks.get(offense.uri).has(check)) {
                return [];
            }
            return disabledChecks.get(offense.uri).get(check);
        });
        return ranges.some((range) => offense.start.index >= range.from && (!range.to || offense.end.index <= range.to));
    }
    return {
        DisabledChecksVisitor,
        isDisabled,
    };
}
function findNextLinePosition(ast, node) {
    const [currentNode, ancestors] = (0, visitor_1.findCurrentNode)(ast, node.position.end);
    const parentNode = ancestors.at(-1);
    const grandParentNode = ancestors.at(-2);
    let nextNode = getNextNode(parentNode, currentNode);
    /*
     * If there is no "next" node, assume they mean the parent block's next node.
     *
     * E.g. The following disables check for `elsif` tag
     *
     * {% if condition %}
     *   {% #theme-check-disable-next-line %}
     * {% elsif other_condition %}
     *   {{ prouduct }}
     * {% endif %}
     *
     * NOTE: We don't want to do this recursively since it doesn't make sense to go
     * past 1 depth.
     */
    if (!nextNode) {
        if (parentNode) {
            nextNode = getNextNode(grandParentNode, parentNode);
        }
        if (!nextNode) {
            return;
        }
    }
    /*
     * If the node contains children nodes, we don't want to disable checks for them.
     * We want to keep it exclusively to the tag itself.
     */
    if ('blockStartPosition' in nextNode) {
        return nextNode.blockStartPosition;
    }
    return nextNode.position;
}
function getNextNode(parentNode, node) {
    if (!parentNode) {
        return;
    }
    let siblingNodes = [];
    // Could be sibling nodes within a `liquid` tag
    if (parentNode.type === types_1.LiquidHtmlNodeTypes.LiquidTag && Array.isArray(parentNode.markup)) {
        siblingNodes = parentNode.markup;
    }
    else if ('children' in parentNode) {
        siblingNodes = parentNode.children || [];
    }
    const currentNodeIdx = siblingNodes.findIndex((c) => c === node);
    if (currentNodeIdx === -1)
        return;
    const nextNode = siblingNodes.at(currentNodeIdx + 1);
    return nextNode;
}
//# sourceMappingURL=index.js.map