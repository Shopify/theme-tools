"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printLiquidVariableOutput = printLiquidVariableOutput;
exports.printLiquidBlockStart = printLiquidBlockStart;
exports.printLiquidBlockEnd = printLiquidBlockEnd;
exports.printLiquidTag = printLiquidTag;
exports.printLiquidRawTag = printLiquidRawTag;
exports.printLiquidDoc = printLiquidDoc;
exports.printLiquidDocParam = printLiquidDocParam;
exports.printLiquidDocExample = printLiquidDocExample;
exports.printLiquidDocDescription = printLiquidDocDescription;
exports.printLiquidDocPrompt = printLiquidDocPrompt;
exports.printLiquidBranch = printLiquidBranch;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const prettier_1 = require("prettier");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
const children_1 = require("./children");
const LIQUID_TAGS_THAT_ALWAYS_BREAK = ['for', 'case'];
const { builders, utils } = prettier_1.doc;
const { group, hardline, ifBreak, indent, join, line, softline, literalline } = builders;
const { replaceEndOfLine } = prettier_1.doc.utils;
function printLiquidVariableOutput(path, _options, print, { leadingSpaceGroupId, trailingSpaceGroupId }) {
    const node = path.getValue();
    const whitespaceStart = (0, utils_2.getWhitespaceTrim)(node.whitespaceStart, (0, utils_2.hasMeaningfulLackOfLeadingWhitespace)(node), leadingSpaceGroupId);
    const whitespaceEnd = (0, utils_2.getWhitespaceTrim)(node.whitespaceEnd, (0, utils_2.hasMeaningfulLackOfTrailingWhitespace)(node), trailingSpaceGroupId);
    if (typeof node.markup !== 'string') {
        const whitespace = node.markup.filters.length > 0 ? line : ' ';
        return group([
            '{{',
            whitespaceStart,
            indent([whitespace, path.call((p) => print(p), 'markup')]),
            whitespace,
            whitespaceEnd,
            '}}',
        ]);
    }
    // This should probably be better than this but it'll do for now.
    const lines = (0, utils_2.markupLines)(node.markup);
    if (lines.length > 1) {
        return group([
            '{{',
            whitespaceStart,
            indent([hardline, join(hardline, lines.map(utils_2.trim))]),
            hardline,
            whitespaceEnd,
            '}}',
        ]);
    }
    return group(['{{', whitespaceStart, ' ', node.markup, ' ', whitespaceEnd, '}}']);
}
function printNamedLiquidBlockStart(path, _options, print, args, whitespaceStart, whitespaceEnd) {
    const node = path.getValue();
    const { isLiquidStatement } = args;
    // This is slightly more verbose than 3 ternaries, but I feel like I
    // should make it obvious that these three things work in tandem on the
    // same conditional.
    const { wrapper, prefix, suffix } = (() => {
        if (isLiquidStatement) {
            return {
                wrapper: utils.removeLines,
                prefix: '',
                suffix: () => '',
            };
        }
        else {
            return {
                wrapper: group,
                prefix: ['{%', whitespaceStart, ' '],
                suffix: (trailingWhitespace) => [trailingWhitespace, whitespaceEnd, '%}'],
            };
        }
    })();
    const tag = (trailingWhitespace) => wrapper([
        ...prefix,
        node.name,
        ' ',
        indent(path.call((p) => print(p, args), 'markup')),
        ...suffix(trailingWhitespace),
    ]);
    const tagWithArrayMarkup = (whitespace) => wrapper([
        ...prefix,
        node.name,
        ' ',
        indent([
            join([',', line], path.map((p) => print(p, args), 'markup')),
        ]),
        ...suffix(whitespace),
    ]);
    switch (node.name) {
        case liquid_html_parser_1.NamedTags.echo: {
            const trailingWhitespace = node.markup.filters.length > 0 ? line : ' ';
            return tag(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.assign: {
            const trailingWhitespace = node.markup.value.filters.length > 0 ? line : ' ';
            return tag(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.cycle: {
            const whitespace = node.markup.args.length > 1 ? line : ' ';
            return wrapper([
                ...prefix,
                node.name,
                // We want to break after the groupName
                node.markup.groupName ? ' ' : '',
                indent(path.call((p) => print(p, args), 'markup')),
                ...suffix(whitespace),
            ]);
        }
        case liquid_html_parser_1.NamedTags.content_for: {
            const markup = node.markup;
            const trailingWhitespace = markup.args.length > 0 ? line : ' ';
            return tag(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.include:
        case liquid_html_parser_1.NamedTags.render: {
            const markup = node.markup;
            const trailingWhitespace = markup.args.length > 0 || (markup.variable && markup.alias) ? line : ' ';
            return tag(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.capture:
        case liquid_html_parser_1.NamedTags.increment:
        case liquid_html_parser_1.NamedTags.decrement:
        case liquid_html_parser_1.NamedTags.layout:
        case liquid_html_parser_1.NamedTags.section: {
            return tag(' ');
        }
        case liquid_html_parser_1.NamedTags.sections: {
            return tag(' ');
        }
        case liquid_html_parser_1.NamedTags.form: {
            const trailingWhitespace = node.markup.length > 1 ? line : ' ';
            return tagWithArrayMarkup(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.tablerow:
        case liquid_html_parser_1.NamedTags.for: {
            const trailingWhitespace = node.markup.reversed || node.markup.args.length > 0 ? line : ' ';
            return tag(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.paginate: {
            return tag(line);
        }
        case liquid_html_parser_1.NamedTags.if:
        case liquid_html_parser_1.NamedTags.elsif:
        case liquid_html_parser_1.NamedTags.unless: {
            const trailingWhitespace = [liquid_html_parser_1.NodeTypes.Comparison, liquid_html_parser_1.NodeTypes.LogicalExpression].includes(node.markup.type)
                ? line
                : ' ';
            return tag(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.case: {
            return tag(' ');
        }
        case liquid_html_parser_1.NamedTags.when: {
            const trailingWhitespace = node.markup.length > 1 ? line : ' ';
            return tagWithArrayMarkup(trailingWhitespace);
        }
        case liquid_html_parser_1.NamedTags.liquid: {
            return group([
                ...prefix,
                node.name,
                indent([
                    hardline,
                    join(hardline, path.map((p) => {
                        const curr = p.getValue();
                        return [
                            getSpaceBetweenLines(curr.prev, curr),
                            print(p, { ...args, isLiquidStatement: true }),
                        ];
                    }, 'markup')),
                ]),
                ...suffix(hardline),
            ]);
        }
        default: {
            return (0, utils_1.assertNever)(node);
        }
    }
}
function printLiquidStatement(path, _options, _print, _args) {
    const node = path.getValue();
    const shouldSkipLeadingSpace = node.markup.trim() === '' || (node.name === '#' && node.markup.startsWith('#'));
    return prettier_1.doc.utils.removeLines([node.name, shouldSkipLeadingSpace ? '' : ' ', node.markup]);
}
function printLiquidBlockStart(path, options, print, args = {}) {
    const node = path.getValue();
    const { leadingSpaceGroupId, trailingSpaceGroupId } = args;
    if (!node.name)
        return '';
    const whitespaceStart = (0, utils_2.getWhitespaceTrim)(node.whitespaceStart, needsBlockStartLeadingWhitespaceStrippingOnBreak(node), leadingSpaceGroupId);
    const whitespaceEnd = (0, utils_2.getWhitespaceTrim)(node.whitespaceEnd, needsBlockStartTrailingWhitespaceStrippingOnBreak(node), trailingSpaceGroupId);
    if (typeof node.markup !== 'string') {
        return printNamedLiquidBlockStart(path, options, print, args, whitespaceStart, whitespaceEnd);
    }
    if (args.isLiquidStatement) {
        return printLiquidStatement(path, options, print, args);
    }
    const lines = (0, utils_2.markupLines)(node.markup);
    if (node.name === 'liquid') {
        return group([
            '{%',
            whitespaceStart,
            ' ',
            node.name,
            indent([hardline, join(hardline, (0, utils_2.reindent)(lines, true))]),
            hardline,
            whitespaceEnd,
            '%}',
        ]);
    }
    if (lines.length > 1) {
        return group([
            '{%',
            whitespaceStart,
            indent([hardline, node.name, ' ', join(hardline, lines.map(utils_2.trim))]),
            hardline,
            whitespaceEnd,
            '%}',
        ]);
    }
    const markup = node.markup;
    return group([
        '{%',
        whitespaceStart,
        ' ',
        node.name,
        markup ? ` ${markup}` : '',
        ' ',
        whitespaceEnd,
        '%}',
    ]);
}
function printLiquidBlockEnd(path, _options, _print, args = {}) {
    const node = path.getValue();
    const { isLiquidStatement, leadingSpaceGroupId, trailingSpaceGroupId } = args;
    if (!node.children || !node.blockEndPosition)
        return '';
    if (isLiquidStatement) {
        return ['end', node.name];
    }
    const whitespaceStart = (0, utils_2.getWhitespaceTrim)(node.delimiterWhitespaceStart ?? '', needsBlockEndLeadingWhitespaceStrippingOnBreak(node), leadingSpaceGroupId);
    const whitespaceEnd = (0, utils_2.getWhitespaceTrim)(node.delimiterWhitespaceEnd ?? '', (0, utils_2.hasMeaningfulLackOfTrailingWhitespace)(node), trailingSpaceGroupId);
    return group(['{%', whitespaceStart, ` end${node.name} `, whitespaceEnd, '%}']);
}
function getNodeContent(node) {
    if (!node.children || !node.blockEndPosition)
        return '';
    return node.source.slice(node.blockStartPosition.end, node.blockEndPosition.start);
}
function printLiquidTag(path, options, print, args) {
    const { leadingSpaceGroupId, trailingSpaceGroupId } = args;
    const node = path.getValue();
    if (!node.children || !node.blockEndPosition) {
        return printLiquidBlockStart(path, options, print, args);
    }
    if (!args.isLiquidStatement && (0, utils_2.shouldPreserveContent)(node)) {
        return [
            printLiquidBlockStart(path, options, print, {
                ...args,
                leadingSpaceGroupId,
                trailingSpaceGroupId: utils_2.FORCE_FLAT_GROUP_ID,
            }),
            ...replaceEndOfLine(getNodeContent(node)),
            printLiquidBlockEnd(path, options, print, {
                ...args,
                leadingSpaceGroupId: utils_2.FORCE_FLAT_GROUP_ID,
                trailingSpaceGroupId,
            }),
        ];
    }
    const tagGroupId = Symbol('tag-group');
    const blockStart = printLiquidBlockStart(path, options, print, {
        ...args,
        leadingSpaceGroupId,
        trailingSpaceGroupId: tagGroupId,
    }); // {% if ... %}
    const blockEnd = printLiquidBlockEnd(path, options, print, {
        ...args,
        leadingSpaceGroupId: tagGroupId,
        trailingSpaceGroupId,
    }); // {% endif %}
    let body = [];
    if ((0, liquid_html_parser_1.isBranchedTag)(node)) {
        body = cleanDoc(path.map((p) => print(p, {
            ...args,
            leadingSpaceGroupId: tagGroupId,
            trailingSpaceGroupId: tagGroupId,
        }), 'children'));
        if (node.name === 'case')
            body = indent(body);
    }
    else if (node.children.length > 0) {
        body = indent([
            innerLeadingWhitespace(node),
            (0, children_1.printChildren)(path, options, print, {
                ...args,
                leadingSpaceGroupId: tagGroupId,
                trailingSpaceGroupId: tagGroupId,
            }),
        ]);
    }
    return group([blockStart, body, innerTrailingWhitespace(node, args), blockEnd], {
        id: tagGroupId,
        shouldBreak: LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(node.name) ||
            (0, utils_2.originallyHadLineBreaks)(path, options) ||
            (0, utils_2.isAttributeNode)(node) ||
            (0, utils_2.isDeeplyNested)(node),
    });
}
function printLiquidRawTag(path, options, print, { isLiquidStatement }) {
    let body = [];
    const node = path.getValue();
    const hasEmptyBody = node.body.value.trim() === '';
    const shouldPrintAsIs = node.isIndentationSensitive ||
        !(0, utils_2.hasLineBreakInRange)(node.source, node.body.position.start, node.body.position.end);
    const blockStart = isLiquidStatement
        ? [node.name]
        : group([
            '{%',
            node.whitespaceStart,
            ' ',
            node.name,
            ' ',
            node.markup ? `${node.markup} ` : '',
            node.whitespaceEnd,
            '%}',
        ]);
    const blockEnd = isLiquidStatement
        ? ['end', node.name]
        : ['{%', node.whitespaceStart, ' ', 'end', node.name, ' ', node.whitespaceEnd, '%}'];
    if (shouldPrintAsIs) {
        body = [node.source.slice(node.blockStartPosition.end, node.blockEndPosition.start)];
    }
    else if (hasEmptyBody) {
        body = [hardline];
    }
    else {
        body = [path.call((p) => print(p), 'body')];
    }
    return [blockStart, ...body, blockEnd];
}
function printLiquidDoc(path, _options, print, _args) {
    const nodes = path.map((p) => print(p), 'nodes');
    if (nodes.length === 0)
        return [];
    const lines = [nodes[0]];
    for (let i = 1; i < nodes.length; i++) {
        lines.push(hardline);
        // If the tag name is different from the previous one, add an extra line break
        if (nodes[i - 1][0] !== nodes[i][0]) {
            lines.push(hardline);
        }
        lines.push(nodes[i]);
    }
    return [indent([hardline, lines]), hardline];
}
function printLiquidDocParam(path, options, _print, _args) {
    const node = path.getValue();
    const parts = ['@param'];
    if (node.paramType?.value) {
        parts.push(' ', `{${node.paramType.value}}`);
    }
    if (node.required) {
        parts.push(' ', node.paramName.value);
    }
    else {
        parts.push(' ', `[${node.paramName.value}]`);
    }
    if (node.paramDescription?.value) {
        const normalizedDescription = node.paramDescription.value.replace(/\s+/g, ' ').trim();
        if (options.liquidDocParamDash) {
            parts.push(' - ', normalizedDescription);
        }
        else {
            parts.push(' ', normalizedDescription);
        }
    }
    return parts;
}
function printLiquidDocExample(path, options, _print, _args) {
    const node = path.getValue();
    const parts = ['@example'];
    const content = node.content.value;
    if (content.trimEnd().includes('\n') || !node.isInline) {
        parts.push(hardline);
    }
    else {
        parts.push(' ');
    }
    parts.push(content.trim());
    return parts;
}
function printLiquidDocDescription(path, options, _print, _args) {
    const node = path.getValue();
    const parts = [];
    const content = node.content.value;
    if (node.isImplicit) {
        parts.push(content.trim());
        return parts;
    }
    parts.push('@description');
    if (content.trimEnd().includes('\n') || !node.isInline) {
        parts.push(hardline);
    }
    else {
        parts.push(' ');
    }
    parts.push(content.trim());
    return parts;
}
// This is a platform controlled tag, so we don't really want to modify this at all to preserve the additional indent
// This DOES mean we won't fix the formatting if a developer were to manually modify the @prompt.
function printLiquidDocPrompt(path, options, _print, _args) {
    const node = path.getValue();
    return ['@prompt', node.content.value.trimEnd()];
}
function innerLeadingWhitespace(node) {
    if (!node.firstChild) {
        if (node.isDanglingWhitespaceSensitive && node.hasDanglingWhitespace) {
            return line;
        }
        else {
            return '';
        }
    }
    if (node.firstChild.hasLeadingWhitespace && node.firstChild.isLeadingWhitespaceSensitive) {
        return line;
    }
    return softline;
}
function innerTrailingWhitespace(node, args) {
    if ((!args.isLiquidStatement && (0, utils_2.shouldPreserveContent)(node)) ||
        node.type === liquid_html_parser_1.NodeTypes.LiquidBranch ||
        !node.blockEndPosition ||
        !node.lastChild) {
        return '';
    }
    if (node.lastChild.hasTrailingWhitespace && node.lastChild.isTrailingWhitespaceSensitive) {
        return line;
    }
    return softline;
}
function printLiquidDefaultBranch(path, options, print, args) {
    const branch = path.getValue();
    const parentNode = path.getParentNode();
    // When the node is empty and the parent is empty. The space will come
    // from the trailingWhitespace of the parent. When this happens, we don't
    // want the branch to print another one so we collapse it.
    // e.g. {% if A %} {% endif %}
    const shouldCollapseSpace = (0, utils_2.isEmpty)(branch.children) && parentNode.children.length === 1;
    if (shouldCollapseSpace)
        return '';
    // When the branch is empty and doesn't have whitespace, we don't want
    // anything so print nothing.
    // e.g. {% if A %}{% endif %}
    // e.g. {% if A %}{% else %}...{% endif %}
    const isBranchEmptyWithoutSpace = (0, utils_2.isEmpty)(branch.children) && !branch.hasDanglingWhitespace;
    if (isBranchEmptyWithoutSpace)
        return '';
    // If the branch does not break, is empty and had whitespace, we might
    // want a space in there. We don't collapse those because the trailing
    // whitespace does not come from the parent.
    // {% if A %} {% else %}...{% endif %}
    if (branch.hasDanglingWhitespace) {
        return ifBreak('', ' ');
    }
    const shouldAddTrailingNewline = branch.next &&
        branch.children.length > 0 &&
        branch.source
            .slice((0, utils_2.last)(branch.children).position.end, branch.next.position.start)
            .replace(/ |\t/g, '').length >= 2;
    // Otherwise print the branch as usual
    // {% if A %} content...{% endif %}
    return indent([
        innerLeadingWhitespace(parentNode),
        (0, children_1.printChildren)(path, options, print, args),
        shouldAddTrailingNewline ? literalline : '',
    ]);
}
function printLiquidBranch(path, options, print, args) {
    const branch = path.getValue();
    const isDefaultBranch = !branch.name;
    if (isDefaultBranch) {
        return printLiquidDefaultBranch(path, options, print, args);
    }
    const leftSibling = branch.prev;
    // When the left sibling is empty, its trailing whitespace is its leading
    // whitespace. So we should collapse it here and ignore it.
    const shouldCollapseSpace = leftSibling && (0, utils_2.isEmpty)(leftSibling.children);
    const outerLeadingWhitespace = branch.hasLeadingWhitespace && !shouldCollapseSpace ? line : softline;
    const shouldAddTrailingNewline = branch.next &&
        branch.children.length > 0 &&
        branch.source
            .slice((0, utils_2.last)(branch.children).position.end, branch.next.position.start)
            .replace(/ |\t/g, '').length >= 2;
    return [
        outerLeadingWhitespace,
        printLiquidBlockStart(path, options, print, args),
        indent([
            innerLeadingWhitespace(branch),
            (0, children_1.printChildren)(path, options, print, args),
            shouldAddTrailingNewline ? literalline : '',
        ]),
    ];
}
function needsBlockStartLeadingWhitespaceStrippingOnBreak(node) {
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.LiquidTag: {
            return !(0, utils_2.isAttributeNode)(node) && (0, utils_2.hasMeaningfulLackOfLeadingWhitespace)(node);
        }
        case liquid_html_parser_1.NodeTypes.LiquidBranch: {
            return (!(0, utils_2.isAttributeNode)(node.parentNode) &&
                (0, utils_2.hasMeaningfulLackOfLeadingWhitespace)(node));
        }
        default: {
            return (0, utils_1.assertNever)(node);
        }
    }
}
function needsBlockStartTrailingWhitespaceStrippingOnBreak(node) {
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.LiquidTag: {
            if ((0, liquid_html_parser_1.isBranchedTag)(node)) {
                return needsBlockStartLeadingWhitespaceStrippingOnBreak(node.firstChild);
            }
            if (!node.children) {
                return (0, utils_2.hasMeaningfulLackOfTrailingWhitespace)(node);
            }
            return (0, utils_2.isEmpty)(node.children)
                ? (0, utils_2.hasMeaningfulLackOfDanglingWhitespace)(node)
                : (0, utils_2.hasMeaningfulLackOfLeadingWhitespace)(node.firstChild);
        }
        case liquid_html_parser_1.NodeTypes.LiquidBranch: {
            if ((0, utils_2.isAttributeNode)(node.parentNode)) {
                return false;
            }
            return node.firstChild
                ? (0, utils_2.hasMeaningfulLackOfLeadingWhitespace)(node.firstChild)
                : (0, utils_2.hasMeaningfulLackOfDanglingWhitespace)(node);
        }
        default: {
            return (0, utils_1.assertNever)(node);
        }
    }
}
function needsBlockEndLeadingWhitespaceStrippingOnBreak(node) {
    if (!node.children) {
        throw new Error('Should only call needsBlockEndLeadingWhitespaceStrippingOnBreak for tags that have closing tags');
    }
    else if ((0, utils_2.isAttributeNode)(node)) {
        return false;
    }
    else if ((0, liquid_html_parser_1.isBranchedTag)(node)) {
        return (0, utils_2.hasMeaningfulLackOfTrailingWhitespace)(node.lastChild);
    }
    else if ((0, utils_2.isEmpty)(node.children)) {
        return (0, utils_2.hasMeaningfulLackOfDanglingWhitespace)(node);
    }
    else {
        return (0, utils_2.hasMeaningfulLackOfTrailingWhitespace)(node.lastChild);
    }
}
function cleanDoc(doc) {
    return doc.filter((x) => x !== '');
}
function getSpaceBetweenLines(prev, curr) {
    if (!prev)
        return '';
    const source = curr.source;
    const whitespaceBetweenNodes = source.slice(prev.position.end, curr.position.start);
    const hasMoreThanOneNewLine = (whitespaceBetweenNodes.match(/\n/g) || []).length > 1;
    return hasMoreThanOneNewLine ? hardline : '';
}
//# sourceMappingURL=liquid.js.map