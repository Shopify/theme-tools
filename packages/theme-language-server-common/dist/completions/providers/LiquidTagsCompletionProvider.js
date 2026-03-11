"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidTagsCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const utils_1 = require("../../utils");
const params_1 = require("../params");
const common_1 = require("./common");
class LiquidTagsCompletionProvider {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        if (!node || node.type !== liquid_html_parser_1.NodeTypes.LiquidTag) {
            return [];
        }
        if (typeof node.markup !== 'string' || node.markup !== '') {
            return [];
        }
        const partial = node.name.replace(params_1.CURSOR, '');
        const blockParent = findParentNode(partial, ancestors);
        const tags = await this.themeDocset.tags();
        return tags
            .filter(({ name }) => name.startsWith(partial))
            .sort(common_1.sortByName)
            .map(toCompletionItem(params, node, ancestors, partial))
            .concat(blockParent && `end${blockParent.name}`.startsWith(partial)
            ? {
                label: `end${blockParent.name}`,
                kind: vscode_languageserver_1.CompletionItemKind.Keyword,
                sortText: `!end${blockParent.name}`, // we want this first.
            }
            : []);
    }
}
exports.LiquidTagsCompletionProvider = LiquidTagsCompletionProvider;
function findParentNode(partial, ancestors) {
    if (!'end'.startsWith(partial))
        return;
    const potentialParentName = partial.replace(/^e(nd?)?/, '');
    const parentNode = ancestors.at(-1);
    const grandParentNode = ancestors.at(-2);
    // This covers the scenario where we have an open liquid tag as a parent
    //
    // e.g.
    // {% liquid
    //   echo 'hello'
    // %}
    //
    // In that scenario, we have the following tree:
    //
    // type: Document
    // children:
    //   - LiquidTag#liquid
    if (parentNode && parentNode.type === 'LiquidTag' && parentNode.name === liquid_html_parser_1.NamedTags.liquid) {
        return;
    }
    // This covers the scenario where we have a dangling conditional tag
    //
    // e.g.
    // {% if cond %}
    //   hello
    // {% end %}
    //
    // In that scenario, we have the following tree:
    //
    // type: Document
    // children:
    //   - LiquidTag#if
    //     children:
    //       - LiquidBranch
    //         children:
    //           - TextNode#hello
    //           - LiquidTag#end
    if (parentNode &&
        parentNode.type === 'LiquidBranch' &&
        grandParentNode &&
        grandParentNode.type === 'LiquidTag' &&
        grandParentNode.name.startsWith(potentialParentName)) {
        return grandParentNode;
    }
    // This covers the scenario where we have a dangling block tag
    //
    // e.g.
    // {% form "cart", cart %}
    //   hello
    // {% end %}
    //
    // In that scenario, we have the following tree:
    //
    // type: Document
    // children:
    //   - LiquidTag#form
    //     children:
    //       - TextNode#hello
    //       - LiquidTag#end
    if (parentNode &&
        parentNode.type === 'LiquidTag' &&
        parentNode.name.startsWith(potentialParentName)) {
        return parentNode;
    }
    // This covers the case where a raw tag is being parsed as a LiquidTag
    // because of the missing endtag.
    //
    // e.g.
    // {% comment %}
    //   hello
    // {% end %}
    //
    // In that scenario, we have the following tree:
    //
    // type: Document
    // children:
    //   - LiquidTag#comment
    //   - TextNode#hello
    //   - LiquidTag#end
    let previousNode;
    if (parentNode &&
        'children' in parentNode &&
        Array.isArray(parentNode.children) &&
        (previousNode = (0, utils_1.findLast)(parentNode.children, (node) => node.type === 'LiquidTag' &&
            node.name.startsWith(potentialParentName) &&
            (liquid_html_parser_1.BLOCKS.includes(node.name) || liquid_html_parser_1.RAW_TAGS.includes(node.name))))) {
        return previousNode;
    }
}
function toCompletionItem(params, node, ancestors, partial) {
    const { textDocument, source } = params.document;
    /** Are we in a {% liquid %} context? Where new lines imply new tags? */
    const isInLiquidLiquidTag = ancestors.some(isLiquidLiquidTag);
    /** 0-indexed offset of cursor position */
    const cursorOffset = textDocument.offsetAt(params.position);
    /** Position of where the start of the word being completed is */
    const startOfPartial = textDocument.positionAt(cursorOffset - partial.length);
    /** Position of the rightmost position in the doc... in {% partial %} it would be after '%}' */
    const endOfBlockStart = findEndOfBlockStart(params, node, isInLiquidLiquidTag);
    /** whitespaceStart is '-' or '' depending on if it strips whitespace to the left of the tag */
    const whitespaceStart = node.whitespaceStart;
    /** whitespaceEnd is '-' or '' depending on if it strips whitespace to the right of the tag */
    const whitespaceEnd = inferWhitespaceEnd(textDocument, endOfBlockStart, params, whitespaceStart, source, isInLiquidLiquidTag);
    return (tag) => {
        const extraProperties = {
            kind: vscode_languageserver_1.CompletionItemKind.Keyword,
            insertTextFormat: vscode_languageserver_1.InsertTextFormat.PlainText,
        };
        if (shouldSnippetComplete(params, endOfBlockStart)) {
            extraProperties.insertTextFormat = vscode_languageserver_1.InsertTextFormat.Snippet;
            extraProperties.insertTextMode = vscode_languageserver_1.InsertTextMode.adjustIndentation;
            extraProperties.textEdit = vscode_languageserver_1.TextEdit.replace(vscode_languageserver_1.Range.create(startOfPartial, endOfBlockStart), toSnippetCompleteText(tag, node, params, whitespaceStart, whitespaceEnd, textDocument, isInLiquidLiquidTag));
        }
        return (0, common_1.createCompletionItem)(tag, extraProperties, 'tag');
    };
}
/**
 * Turns out it's hard to tell if something needs an `end$tag` or not.
 *
 * The safest way to guess that something shouldn't be completed is to check whether markup already exists.
 *
 * Probably shouldn't snippet complete:
 * {% if| cond %}{% endif %}
 * {% render| 'product' %}
 *
 * Probably should snippet complete:
 * {% if| %}
 * {% render| %}
 *
 * It's not perfect, but it covers swapping if for unless and so on.
 */
function shouldSnippetComplete(params, endOfBlockStart) {
    const { completionContext } = params;
    const { node, ancestors } = completionContext !== null && completionContext !== void 0 ? completionContext : {};
    if (!node || !ancestors || node.type !== liquid_html_parser_1.NodeTypes.LiquidTag)
        return false;
    /**
     * If the tag has non-empty markup, we can assume that the name is being
     * edited. So adding the close tag would be very weird.
     *
     * User replaces `if` with `unless`.
     *
     * Input
     *   {% if some_cond %}
     *   {% endif %}
     *
     * ❌ Stuff we DON'T want:
     *   {% unless some_cond %}
     *     expression
     *   {% endunless %}
     *   {% endif %}
     *
     * ✅ Stuff we DO want:
     *   {% unless some_cond %}
     *   {% endif %}
     *
     * We'll solve the negate condition differently.
     */
    const markup = existingMarkup(params, endOfBlockStart);
    return markup.trim() === '';
}
function toSnippetCompleteText(tag, node, params, whitespaceStart, whitespaceEnd, textDocument, isInLiquidLiquidTag) {
    let snippet = toSnippet(tag);
    if (shouldInline(textDocument, params, node, isInLiquidLiquidTag)) {
        // Then we need to remove the newlines from the snippet
        snippet = snippet.replace(/\n\s*/g, '');
    }
    if (isInLiquidLiquidTag) {
        // then we need to get rid of all the {% and %} from the snippet
        snippet = snippet.replace(/\{%-?[ \t]*/g, '').replace(/[ \t]*-?%\}/g, '');
    }
    if (tag.syntax_keywords) {
        // Then we need to replace the keywords from the snippet with ${n:keyword}
        let i = 1;
        for (const { keyword } of tag.syntax_keywords) {
            if (keyword.includes('expression') ||
                keyword.includes('code') ||
                keyword.includes('content')) {
                // first_expression, second_expression, javascript_code,
                // forloop_content... we don't want those. Just the cursor position.
                snippet = snippet.replace(keyword, `\$${i}`);
            }
            else {
                snippet = snippet.replace(keyword, `\${${i}:${keyword}}`);
            }
            i++;
        }
    }
    // We need to add the whitespace stripping characters to the snippet if there are any to add
    snippet = withCorrectWhitespaceStrippingCharacters(snippet, whitespaceStart, whitespaceEnd);
    if (isInLiquidLiquidTag) {
        return snippet.trimStart();
    }
    else {
        // VS Code doesn't like it when the snippet starts before the word
        // being completed. So the completion item we offer starts off after
        // the {%-?\s part.
        return snippet.slice(2 + whitespaceStart.length + 1);
    }
}
function toSnippet(tag) {
    // Some of those are exceptional and we don't really want to use the same syntax used on shopify.dev
    switch (tag.name) {
        case 'echo':
            return '{% echo $1 %}';
        case 'cycle':
            return "{% cycle '$1', '$2'$3 %}";
        case 'content_for':
            return "{% content_for '$1'$2 %}";
        case 'render':
            return "{% render '$1'$2 %}";
        case 'elsif':
            return '{% elsif ${1:condition} %}';
        case 'else':
            return '{% else %}';
        case 'doc':
            return '{% doc %}\n  $0\n{% enddoc %}';
    }
    if (tag.syntax) {
        return tag.syntax;
    }
    else if (isBlockTag(tag.name)) {
        return `{% ${tag.name}$1 %}\n  $2\n{% end${tag.name} %}`;
    }
    else {
        return `{% ${tag.name}$1 %}`;
    }
}
/**
 * If the tag is on a new line, then we can use the snippet with newline.
 * If there's more content on that line, then we inline the snippet in one line.
 */
function shouldInline(textDocument, params, node, isInLiquidLiquidTag) {
    if (isInLiquidLiquidTag)
        return false;
    const endPosition = textDocument.positionAt(node.blockStartPosition.start);
    const startPosition = vscode_languageserver_1.Position.create(endPosition.line, 0);
    const textBeforeTag = textDocument.getText(vscode_languageserver_1.Range.create(startPosition, endPosition));
    return textBeforeTag.trim() !== '';
}
/**
 * We mirror the whitespace stripping of the start tag.
 * {% if -%} => {% if -%}{%- endif %}
 */
function withCorrectWhitespaceStrippingCharacters(snippet, whitespaceStart, whitespaceEnd) {
    var _a, _b;
    let starti = 0;
    let endi = 0;
    let countOfEndTags = (_b = (_a = snippet.match(/%\}/g)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    snippet = snippet
        .replace(/\{%/g, () => {
        if (starti++ === 0) {
            // mirror outside stripping
            return '{%' + whitespaceStart;
        }
        else {
            // mirror inside stripping
            return '{%' + whitespaceEnd;
        }
    })
        .replace(/%\}/g, () => {
        if (countOfEndTags > 1 && endi++ === countOfEndTags - 1) {
            // mirror outside stripping
            return whitespaceStart + '%}';
        }
        else {
            // mirror inside stripping
            return whitespaceEnd + '%}';
        }
    });
    return snippet;
}
function findEndOfBlockStart(context, node, isInLiquidLiquidTag) {
    const doc = context.document.textDocument;
    const source = context.document.source;
    const start = node.position.start;
    if (isInLiquidLiquidTag) {
        return doc.positionAt(source.indexOf('\n', start));
    }
    const end = source.indexOf('%}', start);
    const endOpen = source.indexOf('{%', start + 2);
    const isThere = end !== -1 && (endOpen === -1 || end < endOpen);
    if (isThere) {
        // %} => + 2
        return doc.positionAt(end + 2);
    }
    else {
        // return cursor position.
        return context.position;
    }
}
function existingMarkup(params, endOfBlockStart) {
    const { document } = params;
    const { source, textDocument } = document;
    return source
        .slice(textDocument.offsetAt(params.position), textDocument.offsetAt(endOfBlockStart))
        .replace(/-?%\}/, '');
}
// We're trying to infer if we should trim the whitespace to the right given what the user has already written
// {%  if|        => ''
// {%- if|        => '-'
// {%- if|  %}    => ''
// {%- if| -%}    => '-'
// {%  if| -%}    => '-'
// {% liquid
//       if|      => ''
// %}
function inferWhitespaceEnd(textDocument, endOfBlockStart, params, whitespaceStart, source, isInLiquidLiquidTag) {
    if (isInLiquidLiquidTag) {
        return '';
    }
    else if (textDocument.offsetAt(endOfBlockStart) === textDocument.offsetAt(params.position)) {
        return whitespaceStart; // if the %} wasn't auto inserted, copy whatever was there on the other side
    }
    else if (source.charAt(textDocument.offsetAt(endOfBlockStart) - 3) === '-') {
        return '-';
    }
    else {
        return '';
    }
}
function isLiquidLiquidTag(parent) {
    return parent.type === liquid_html_parser_1.NodeTypes.LiquidTag && parent.name === liquid_html_parser_1.NamedTags.liquid;
}
function isBlockTag(name) {
    return liquid_html_parser_1.BLOCKS.includes(name);
}
//# sourceMappingURL=LiquidTagsCompletionProvider.js.map