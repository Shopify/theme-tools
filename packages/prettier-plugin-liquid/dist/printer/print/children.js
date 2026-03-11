"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printChildren = printChildren;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const prettier_1 = require("prettier");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
const tag_1 = require("./tag");
const { builders: { breakParent, group, ifBreak, line, softline, hardline }, } = prettier_1.doc;
const { replaceEndOfLine } = prettier_1.doc.utils;
function printChild(childPath, options, print, args) {
    const child = childPath.getValue();
    if ((0, utils_2.hasPrettierIgnore)(child)) {
        const isPrevBorrowingOpeningMarker = child.prev && (0, tag_1.needsToBorrowNextOpeningTagStartMarker)(child.prev);
        const bodyStartOffset = isPrevBorrowingOpeningMarker
            ? (0, tag_1.printOpeningTagStartMarker)(child).length
            : 0;
        const bodyStart = (0, utils_1.locStart)(child) + bodyStartOffset;
        const isNextBorrowingClosingMarker = child.next && (0, tag_1.needsToBorrowPrevClosingTagEndMarker)(child.next);
        // This could be "minus the `>` because the next tag borrows it"
        const bodyEndOffset = isNextBorrowingClosingMarker
            ? (0, tag_1.printClosingTagEndMarker)(child, options).length
            : 0;
        const bodyEnd = (0, utils_1.locEnd)(child) - bodyEndOffset;
        let rawContent = options.originalText.slice(bodyStart, bodyEnd);
        // This is an idempotence edge case that I don't know how to solve
        // "cleanly." I feel like there's a more elegant solution, but I can't
        // find one right now.
        //
        // The gist: We might pretty-print something like this:
        //   <!-- prettier-ignore -->
        //   <b>{%cycle a,b,c%}</b
        //   >hi
        // Which would mean the closing tag is '</b\n  >'
        //
        // For idempotence to be maintained, we need to strip the '\n  '
        // from the raw source.
        if (child.type === liquid_html_parser_1.NodeTypes.HtmlElement && isNextBorrowingClosingMarker) {
            rawContent = rawContent.trimEnd();
        }
        return [
            (0, tag_1.printOpeningTagPrefix)(child, options),
            ...replaceEndOfLine(rawContent),
            (0, tag_1.printClosingTagSuffix)(child, options),
        ];
    }
    return print(childPath, args);
}
function printBetweenLine(prevNode, nextNode) {
    if (!prevNode || !nextNode)
        return '';
    const spaceBetweenLinesIsHandledSomewhereElse = ((0, tag_1.needsToBorrowNextOpeningTagStartMarker)(prevNode) &&
        ((0, utils_2.hasPrettierIgnore)(nextNode) ||
            /**
             *     123<a
             *          ~
             *       ><b>
             */
            nextNode.firstChild ||
            /**
             *     123<!--
             *            ~
             *     -->
             */
            (0, utils_2.hasNoChildren)(nextNode) ||
            /**
             *     123<span
             *             ~
             *       attr
             */
            (nextNode.type === liquid_html_parser_1.NodeTypes.HtmlElement && nextNode.attributes.length > 0))) ||
        /**
         *     <img
         *       src="long"
         *                 ~
         *     />123
         */
        (prevNode.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
            (0, utils_2.hasNoCloseMarker)(prevNode) &&
            (0, tag_1.needsToBorrowPrevClosingTagEndMarker)(nextNode));
    if (spaceBetweenLinesIsHandledSomewhereElse) {
        return '';
    }
    const shouldUseHardline = !nextNode.isLeadingWhitespaceSensitive ||
        (0, utils_2.preferHardlineAsLeadingSpaces)(nextNode) ||
        /**
         *       Want to write us a letter? Use our<a
         *         ><b><a>mailing address</a></b></a
         *                                          ~
         *       >.
         */
        ((0, tag_1.needsToBorrowPrevClosingTagEndMarker)(nextNode) &&
            prevNode.lastChild &&
            (0, tag_1.needsToBorrowParentClosingTagStartMarker)(prevNode.lastChild) &&
            prevNode.lastChild.lastChild &&
            (0, tag_1.needsToBorrowParentClosingTagStartMarker)(prevNode.lastChild.lastChild));
    if (shouldUseHardline) {
        return hardline;
    }
    return nextNode.hasLeadingWhitespace ? line : softline;
}
// This code is adapted from prettier's language-html plugin.
function printChildren(path, options, print, args) {
    const node = path.getValue();
    if (!node.children) {
        throw new Error('attempting to use printChildren on something without children');
    }
    if ((0, utils_2.forceBreakChildren)(node)) {
        return [
            breakParent,
            ...path.map((childPath) => {
                const childNode = childPath.getValue();
                const prevBetweenLine = printBetweenLine(childNode.prev, childNode);
                return [
                    !prevBetweenLine
                        ? ''
                        : [prevBetweenLine, (0, utils_2.forceNextEmptyLine)(childNode.prev) ? hardline : ''],
                    printChild(childPath, options, print, {
                        ...args,
                        leadingSpaceGroupId: utils_2.FORCE_BREAK_GROUP_ID,
                        trailingSpaceGroupId: utils_2.FORCE_BREAK_GROUP_ID,
                    }),
                ];
            }, 'children'),
        ];
    }
    const leadingSpaceGroupIds = node.children.map((_, i) => Symbol(`leading-${i}`));
    const trailingSpaceGroupIds = node.children.map((_, i) => Symbol(`trailing-${i}`));
    /**
     * Whitespace handling. My favourite topic.
     *
     * TL;DR we sort the output of printBetweenLine into buckets.
     *
     * What we want:
     * - Hardlines should go in as is and not break unrelated content
     * - When we want the content to flow as a paragraph, we'll immitate
     *   prettier's `fill` builder with this:
     *     group([whitespace, group(content, whitespace)])
     * - When we want the content to break surrounding whitespace in pairs,
     *   we'll do this:
     *     group([whitespace, content, whitespace])
     * - We want to know the whitespace beforehand because conditional whitespace
     *   stripping depends on the groupId of the already printed group that
     *   breaks.
     */
    const whitespaceBetweenNode = path.map((childPath, childIndex) => {
        const childNode = childPath.getValue();
        const leadingHardlines = [];
        const leadingWhitespace = [];
        const leadingDependentWhitespace = [];
        const trailingWhitespace = [];
        const trailingHardlines = [];
        const prevBetweenLine = printBetweenLine(childNode.prev, childNode);
        const nextBetweenLine = printBetweenLine(childNode, childNode.next);
        if ((0, utils_2.isTextLikeNode)(childNode)) {
            return {
                leadingHardlines,
                leadingWhitespace,
                leadingDependentWhitespace,
                trailingWhitespace,
                trailingHardlines,
            };
        }
        if (prevBetweenLine) {
            if ((0, utils_2.forceNextEmptyLine)(childNode.prev)) {
                leadingHardlines.push(hardline, hardline);
            }
            else if (prevBetweenLine === hardline) {
                leadingHardlines.push(hardline);
            }
            else {
                if ((0, utils_2.isTextLikeNode)(childNode.prev)) {
                    if ((0, utils_2.isLiquidNode)(childNode) && prevBetweenLine === softline) {
                        leadingDependentWhitespace.push(prevBetweenLine);
                    }
                    else {
                        leadingWhitespace.push(prevBetweenLine);
                    }
                }
                else {
                    // We're collapsing nextBetweenLine and prevBetweenLine of
                    // adjacent nodes here. When the previous node breaks content,
                    // then we want to print nothing here. If it doesn't, then add
                    // a softline and give a chance to _this_ node to break.
                    leadingWhitespace.push(ifBreak('', softline, {
                        groupId: trailingSpaceGroupIds[childIndex - 1],
                    }));
                }
            }
        }
        if (nextBetweenLine) {
            if ((0, utils_2.forceNextEmptyLine)(childNode)) {
                if ((0, utils_2.isTextLikeNode)(childNode.next)) {
                    trailingHardlines.push(hardline, hardline);
                }
            }
            else if (nextBetweenLine === hardline) {
                if ((0, utils_2.isTextLikeNode)(childNode.next)) {
                    trailingHardlines.push(hardline);
                }
                // there's a hole here, it's intentional!
            }
            else {
                // We know it's not a typeof hardline here because we do the
                // check on the previous condition.
                trailingWhitespace.push(nextBetweenLine);
            }
        }
        return {
            leadingHardlines,
            leadingWhitespace,
            leadingDependentWhitespace,
            trailingWhitespace,
            trailingHardlines,
        };
    }, 'children');
    return path.map((childPath, childIndex) => {
        const { leadingHardlines, leadingWhitespace, leadingDependentWhitespace, trailingWhitespace, trailingHardlines, } = whitespaceBetweenNode[childIndex];
        return [
            ...leadingHardlines, // independent
            group([
                ...leadingWhitespace, // breaks first
                group([
                    ...leadingDependentWhitespace, // breaks with trailing
                    printChild(childPath, options, print, {
                        ...args,
                        leadingSpaceGroupId: leadingSpaceGroupId(whitespaceBetweenNode, childIndex),
                        trailingSpaceGroupId: trailingSpaceGroupId(whitespaceBetweenNode, childIndex),
                    }),
                    ...trailingWhitespace, // breaks second, if content breaks
                ], {
                    id: trailingSpaceGroupIds[childIndex],
                }),
            ], {
                id: leadingSpaceGroupIds[childIndex],
            }),
            ...trailingHardlines, // independent
        ];
    }, 'children');
    function leadingSpaceGroupId(whitespaceBetweenNode, index) {
        if (index === 0) {
            return args.leadingSpaceGroupId;
        }
        const prev = whitespaceBetweenNode[index - 1];
        const curr = whitespaceBetweenNode[index];
        const groupIds = [];
        if (!(0, utils_2.isEmpty)(prev.trailingHardlines) || !(0, utils_2.isEmpty)(curr.leadingHardlines)) {
            return utils_2.FORCE_BREAK_GROUP_ID;
        }
        if (!(0, utils_2.isEmpty)(prev.trailingWhitespace)) {
            groupIds.push(trailingSpaceGroupIds[index - 1]);
        }
        if (!(0, utils_2.isEmpty)(curr.leadingWhitespace)) {
            groupIds.push(leadingSpaceGroupIds[index]);
        }
        if (!(0, utils_2.isEmpty)(curr.leadingDependentWhitespace)) {
            groupIds.push(trailingSpaceGroupIds[index]);
        }
        if ((0, utils_2.isEmpty)(groupIds)) {
            groupIds.push(utils_2.FORCE_FLAT_GROUP_ID);
        }
        return groupIds;
    }
    function trailingSpaceGroupId(whitespaceBetweenNode, index) {
        if (index === whitespaceBetweenNode.length - 1) {
            return args.trailingSpaceGroupId;
        }
        const curr = whitespaceBetweenNode[index];
        const next = whitespaceBetweenNode[index + 1];
        const groupIds = [];
        if (!(0, utils_2.isEmpty)(curr.trailingHardlines) || !(0, utils_2.isEmpty)(next.leadingHardlines)) {
            return utils_2.FORCE_BREAK_GROUP_ID;
        }
        if (!(0, utils_2.isEmpty)(curr.trailingWhitespace)) {
            groupIds.push(trailingSpaceGroupIds[index]);
        }
        if ((0, utils_2.isEmpty)(groupIds)) {
            groupIds.push(utils_2.FORCE_FLAT_GROUP_ID);
        }
        return groupIds;
    }
}
//# sourceMappingURL=children.js.map