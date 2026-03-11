"use strict";
// A lot in here is adapted from prettier/prettier.
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentWithWhitespaceHelpers = void 0;
exports.isHtmlNode = isHtmlNode;
exports.isLiquidNode = isLiquidNode;
exports.isParentNode = isParentNode;
exports.isTrimmingOuterRight = isTrimmingOuterRight;
exports.isTrimmingOuterLeft = isTrimmingOuterLeft;
exports.isTrimmingInnerLeft = isTrimmingInnerLeft;
exports.isTrimmingInnerRight = isTrimmingInnerRight;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const constants_evaluate_1 = require("../../constants.evaluate");
const utils_1 = require("../utils");
const augmentWithWhitespaceHelpers = (_options, node) => {
    if (node.cssDisplay === 'should not be relevant') {
        return;
    }
    const augmentations = {
        isDanglingWhitespaceSensitive: isDanglingWhitespaceSensitiveNode(node),
        isIndentationSensitive: isIndentationSensitiveNode(node),
        isWhitespaceSensitive: isWhitespaceSensitiveNode(node),
        // If either isn't sensitive, then this one isn't
        isLeadingWhitespaceSensitive: isLeadingWhitespaceSensitiveNode(node) &&
            (!node.prev || isTrailingWhitespaceSensitiveNode(node.prev)),
        // If either isn't sensitive, then this one isn't
        isTrailingWhitespaceSensitive: isTrailingWhitespaceSensitiveNode(node) &&
            (!node.next || isLeadingWhitespaceSensitiveNode(node.next)),
        hasLeadingWhitespace: hasLeadingWhitespace(node),
        hasTrailingWhitespace: hasTrailingWhitespace(node),
        hasDanglingWhitespace: hasDanglingWhitespace(node),
    };
    Object.assign(node, augmentations);
};
exports.augmentWithWhitespaceHelpers = augmentWithWhitespaceHelpers;
/**
 * A node is dangling whitespace sensitive when whitespace in an empty node
 * (no children) has meaning in the rendered output.
 *
 * examples:
 *   - <span> </span> is dangling whitespace sensitive (cssDisplay === inline)
 *   - <div> </div> is not dangling whitespace sensitive (cssDisplay === block)
 *   - {% if %} {% endif %} is dangling whitespace sensitive
 *   - {% if -%} {% endif %} is not dangling whitespace sensitive
 */
function isDanglingWhitespaceSensitiveNode(node) {
    return (isDanglingSpaceSensitiveCssDisplay(node.cssDisplay) &&
        !(0, utils_1.isScriptLikeTag)(node) &&
        !isTrimmingInnerLeft(node) &&
        !isTrimmingInnerRight(node));
}
/**
 * A node is whitespace sensitive when its contents is sensitive to
 * whitespace. That is, whitespace between nodes must be maintained
 * otherwise the rendered output would be different.
 *
 * A special case of whitespace sensitive nodes are nodes that are also
 * indentation sensitive.
 *
 * examples:
 *   - script-like tags
 *   - indentation-sensitive tags (e.g. <pre></pre>)
 */
function isWhitespaceSensitiveNode(node) {
    return (
    // isScriptLikeTag(node) ||
    isIndentationSensitiveNode(node));
}
/**
 * A node is indentation sensitive when the indentation used in the output
 * must match the indentation used in the source, otherwise the rendered
 * output would be different.
 *
 * example:
 *  - <pre></pre>
 */
function isIndentationSensitiveNode(node) {
    return getNodeCssStyleWhiteSpace(node).startsWith('pre');
}
/**
 * A node is leading whitespace sensitive when whitespace to the outer left
 * of it has meaning. Removing or adding whitespace there would alter the
 * rendered output.
 * <div attr-{{ hi }}
 */
function isLeadingWhitespaceSensitiveNode(node) {
    if (!node) {
        return false;
    }
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidBranch) {
        const isDefaultBranch = node.name === null;
        const hasNoChildren = !!node.firstChild;
        const isParentInnerRightSensitive = isInnerLeftSpaceSensitiveCssDisplay(node.parentNode.cssDisplay);
        const isFirstChildLeadingSensitive = isLeadingWhitespaceSensitiveNode(node.firstChild);
        // {% if %}<emptythis>{% endif %}
        // {% if %}this{% endif %}
        if (isDefaultBranch) {
            return isParentInnerRightSensitive && (!hasNoChildren || isFirstChildLeadingSensitive);
        }
        // {% if %}{% <elseasthis> %}anything{% endif %}
        return isParentInnerRightSensitive;
    }
    // <a data-{{ this }}="hi">
    if (node.parentNode &&
        (0, utils_1.isAttributeNode)(node.parentNode) &&
        node.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput) {
        return true;
    }
    // {{- this }}
    if (isTrimmingOuterLeft(node)) {
        return false;
    }
    // {{ drop -}} this
    if (node.prev && isTrimmingOuterRight(node.prev)) {
        return false;
    }
    // Invisible nodes aren't whitespace sensitive
    if (!node.parentNode || node.parentNode.cssDisplay === 'none') {
        return false;
    }
    // <pre> tags are whitespace sensitive, so nodes in 'em are all leading
    // whitespace sensitive.
    if ((0, utils_1.isPreLikeNode)(node.parentNode)) {
        return true;
    }
    // TODO I added this as a short term fix for HtmlRawNode printing.
    if ((0, utils_1.isScriptLikeTag)(node)) {
        return false;
    }
    // The first child of a node is NOT leading whitespace sensitive if one of
    // the following is true:
    //
    // - the parent is DocumentNode
    // - the node itself is pre-like (since pre are block-like)
    // - the parent is a script-like (since scripts are not rendered)
    // - the parent has a CSS display that strips whitespace from both ends
    // - the parent is whitespace stripping to the inner left
    //
    // prettier-ignore
    if (!node.prev && (node.parentNode.type === liquid_html_parser_1.NodeTypes.Document
        || (0, utils_1.isPreLikeNode)(node)
        || (0, utils_1.isScriptLikeTag)(node.parentNode)
        || !isInnerLeftSpaceSensitiveCssDisplay(node.parentNode.cssDisplay)
        || isTrimmingInnerLeft(node.parentNode))) {
        return false;
    }
    // This node is not leading whitespace sensitive if the previous node
    // creates a block rendering context.
    //
    // example:
    //   - <p><div>hello</div> this</p>
    if (node.prev && !isOuterRightWhitespaceSensitiveCssDisplay(node.prev.cssDisplay)) {
        return false;
    }
    // this node is not leading whitespace sensitive if it creates a block
    // rendering context
    //
    // example:
    //   - <p>hello <div>this</div></p>
    if (!isOuterLeftWhitespaceSensitiveCssDisplay(node.cssDisplay)) {
        return false;
    }
    return true;
}
/**
 * A node is trailing whitespace sensitive when removing (or adding) whitespace
 * between this node and the next sibling (or parent closing tag) would alter the
 * rendered output.
 *
 * As such, it is whitespace _to the right_ of this node (it is not
 * contained by the node).
 *
 * example:
 *   ```
 *   <p>
 *     hello <span>world</span>
 *   </p>
 *   ```
 *
 *  - "hello" is trailing whitespace sensitive
 *  - <span>world</span> is not
 *    - "world" is trailing whitespace sensitive
 *
 * This is really complicated to get right, so treat it as though it is not
 * the actual solution. We'll default to true and consider the edge cases.
 */
function isTrailingWhitespaceSensitiveNode(node) {
    if (!node) {
        return false;
    }
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidBranch) {
        const isLastBranch = node.parentNode && node.parentNode.lastChild === node;
        const hasNoLastChild = !node.lastChild;
        const lastChild = node.lastChild;
        const isLastChildTrailingSensitive = !!lastChild && isTrailingWhitespaceSensitiveNode(lastChild);
        // {% if %}{% elsif cond %}<emptythis>{% endif %}
        // {% if %}{% elsif cond %}this{% endif %}
        // {% if %}{% else %}<emptythis>{% endif %}
        // {% if %}{% else %}this{% endif %}
        if (isLastBranch) {
            const isParentInnerRightSensitive = isInnerRightWhitespaceSensitiveCssDisplay(node.parentNode.cssDisplay);
            return isParentInnerRightSensitive && (hasNoLastChild || isLastChildTrailingSensitive);
        }
        // {% if %}<emptythis>{% endif %}
        // {% if %}<emptythis>{% else %}{% endif %}
        // {% if %}{% elsif cond %}<emptythis>{% else %}{% endif %}
        // {% if %}this{% endif %}
        // {% if %}this{% else %}{% endif %}
        // {% if %}{% elsif cond %}this{% else %}{% endif %}
        return hasNoLastChild || isLastChildTrailingSensitive;
    }
    // {% if cond %}<this>{% endif %}
    // {% if cond %}<this><a>{% endif %}
    // {% if cond %}<this><div>{% endif %}
    // {% if cond %}<this><div></div>{% endif %}
    // {% if cond %}<this>{% render 'icon' %}{% endif %}
    if (isHtmlElementWithoutCloseTag(node)) {
        if (!node.lastChild) {
            return isInnerLeftSpaceSensitiveCssDisplay(node.cssDisplay);
        }
        return (createsInlineFormattingContext(node.cssDisplay) &&
            isTrailingWhitespaceSensitiveNode(node.lastChild));
    }
    // '{{ drop -}} text'
    if (isTrimmingOuterRight(node)) {
        return false;
    }
    // <a data-{{ this }}="hi">
    if (node.parentNode &&
        (0, utils_1.isAttributeNode)(node.parentNode) &&
        node.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput) {
        return true;
    }
    // 'text {{- drop }}'
    if (node.next && isTrimmingOuterLeft(node.next)) {
        return false;
    }
    // the root node and invisible nodes are not trailing whitespace
    // sensitive
    if (!node.parentNode || node.parentNode.cssDisplay === 'none') {
        return false;
    }
    // pre-like nodes are whitespace sensitive (globally), therefore if this
    // node's parent is pre-like, this node is whitespace sensitive to the right.
    if ((0, utils_1.isPreLikeNode)(node.parentNode)) {
        return true;
    }
    // We do it slightly differently than prettier/prettier.
    if ((0, utils_1.isScriptLikeTag)(node)) {
        return false;
    }
    // BRs are not trailing whitespace sensitive, it's an exception as per prettier/language-html
    // https://github.com/prettier/prettier/blob/c36d89712a24fdef753c056f4c82bc87ebe07865/src/language-html/utils/index.js#L290-L296
    if (isHtmlNode(node) && typeof node.name === 'string' && node.name === 'br') {
        return false;
    }
    // The following block handles the case when the node is the last child of its parent.
    //
    // The node would not be trailing whitespace sensitive if any of the following conditions are true:
    //  - the parent is the root
    //  - this node is pre-like (whitespace outside pre tags is irrelevant)
    //  - this node is script-like (since the whitespace following a script is irrelevant)
    //  - the parent is not (inner) trailing whitespace sensitive (e.g. block)
    //  - the parent is trimming the inner right (e.g. {% form %} hello {%- endform %})
    //  - the node is an attribute node
    //
    // prettier-ignore
    if (!node.next && (node.parentNode.type === liquid_html_parser_1.NodeTypes.Document ||
        (0, utils_1.isPreLikeNode)(node) ||
        (0, utils_1.isScriptLikeTag)(node.parentNode) ||
        (!isHtmlElementWithoutCloseTag(node.parentNode) && !isInnerRightWhitespaceSensitiveCssDisplay(node.parentNode.cssDisplay)) ||
        isTrimmingInnerRight(node.parentNode) ||
        (0, utils_1.isAttributeNode)(node))) {
        return false;
    }
    // When the next child is not whitespace sensitive to the outer left.
    //
    // example:
    //  <p>Hello <div>world</div></p>
    //
    // 'Hello' is not whitespace sensitive to the right because the next
    // element is a block and doesn't care about whitespace to its left.
    if (node.next && !isOuterLeftWhitespaceSensitiveCssDisplay(node.next.cssDisplay)) {
        return false;
    }
    // That's for when the node would create a block formatting context.
    //
    // example:
    //   <p><div>hello</div> {{ drop }}</p>
    //
    // The div would create a block formatting context, so even though
    // {{ drop }} is inline, it isn't because of the block.
    if (!isOuterRightWhitespaceSensitiveCssDisplay(node.cssDisplay)) {
        return false;
    }
    // Default to true. We might be wrong, but we err on the side of caution.
    return true;
}
/**
 * Dangling whitespace is whitespace in an empty parent.
 *
 * examples
 *  - <div> </div>
 *  - {% if A %} {% else %} nope {% endif %}
 */
function hasDanglingWhitespace(node) {
    if (!isParentNode(node)) {
        return false;
    }
    else if (node.type === liquid_html_parser_1.NodeTypes.Document) {
        return node.children.length === 0 && node.source.length > 0;
    }
    else if (!node.children) {
        return false;
    }
    else if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag &&
        (0, liquid_html_parser_1.isBranchedTag)(node) &&
        node.children.length === 1) {
        return hasDanglingWhitespace(node.firstChild);
    }
    else if (node.children.length > 0) {
        return false;
    }
    return (0, utils_1.isWhitespace)(node.source, node.blockStartPosition.end);
}
function hasLeadingWhitespace(node) {
    // Edge case for default branch.
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidBranch && !node.prev) {
        return node.firstChild ? hasLeadingWhitespace(node.firstChild) : hasDanglingWhitespace(node);
    }
    return (0, utils_1.isWhitespace)(node.source, node.position.start - 1);
}
function hasTrailingWhitespace(node) {
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidBranch || isHtmlElementWithoutCloseTag(node)) {
        return node.lastChild ? hasTrailingWhitespace(node.lastChild) : hasDanglingWhitespace(node);
    }
    return (0, utils_1.isWhitespace)(node.source, node.position.end);
}
function isHtmlNode(node) {
    return liquid_html_parser_1.HtmlNodeTypes.includes(node.type);
}
function isLiquidNode(node) {
    return !!node && liquid_html_parser_1.LiquidNodeTypes.includes(node.type);
}
function isParentNode(node) {
    return 'children' in node;
}
function isTrimmingOuterRight(node) {
    if (!node)
        return false;
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.LiquidRawTag:
        case liquid_html_parser_1.NodeTypes.LiquidTag: // {% if a %}{% endif -%}, {% assign x -%}
            return (node.delimiterWhitespaceEnd ?? node.whitespaceEnd) === '-';
        case liquid_html_parser_1.NodeTypes.LiquidBranch:
            return false;
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput: // {{ foo -}}
            return node.whitespaceEnd === '-';
        default:
            return false;
    }
}
function isTrimmingOuterLeft(node) {
    if (!node)
        return false;
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.LiquidRawTag:
        case liquid_html_parser_1.NodeTypes.LiquidTag: // {%- if a %}{% endif %}, {%- assign x = 1 %}
        case liquid_html_parser_1.NodeTypes.LiquidBranch: // {%- else %}
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput: // {{- 'val' }}
            return node.whitespaceStart === '-';
        default:
            return false;
    }
}
function isTrimmingInnerLeft(node) {
    if (!node)
        return false;
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.LiquidRawTag:
        case liquid_html_parser_1.NodeTypes.LiquidTag: // {% form a -%}{% endform %}
            if (node.delimiterWhitespaceEnd === undefined)
                return false;
            return node.whitespaceEnd === '-';
        case liquid_html_parser_1.NodeTypes.LiquidBranch: // {% if a -%}{% else -%}{% endif %}
            // This branch should never happen.
            if (!node.parentNode || node.parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidTag) {
                return false;
            }
            // First branch gets this from the parent
            if (!node.prev) {
                return isTrimmingInnerLeft(node.parentNode);
            }
            // Otherwise gets it from the delimiter. e.g. {% else -%}
            return node.whitespaceEnd === '-';
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput:
        default:
            return false;
    }
}
function isTrimmingInnerRight(node) {
    if (!node)
        return false;
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.LiquidRawTag:
        case liquid_html_parser_1.NodeTypes.LiquidTag: // {% if a %}{%- endif %}
            if (node.delimiterWhitespaceStart === undefined)
                return false;
            return node.delimiterWhitespaceStart === '-';
        case liquid_html_parser_1.NodeTypes.LiquidBranch:
            // This branch should never happen.
            if (!node.parentNode || node.parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidTag) {
                return false;
            }
            // Last branch gets this from the parent
            if (!node.next) {
                return isTrimmingInnerRight(node.parentNode);
            }
            // Otherwise gets it from the next branch
            return isTrimmingOuterLeft(node.next);
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput:
        default:
            return false;
    }
}
function createsInlineFormattingContext(cssDisplay) {
    return (isBlockLikeCssDisplay(cssDisplay) || cssDisplay === 'inline' || cssDisplay === 'inline-block');
}
function isBlockLikeCssDisplay(cssDisplay) {
    return cssDisplay === 'block' || cssDisplay === 'list-item' || cssDisplay.startsWith('table');
}
function isInnerLeftSpaceSensitiveCssDisplay(cssDisplay) {
    return !isBlockLikeCssDisplay(cssDisplay) && cssDisplay !== 'inline-block';
}
function isInnerRightWhitespaceSensitiveCssDisplay(cssDisplay) {
    return !isBlockLikeCssDisplay(cssDisplay) && cssDisplay !== 'inline-block';
}
function isOuterLeftWhitespaceSensitiveCssDisplay(cssDisplay) {
    return !isBlockLikeCssDisplay(cssDisplay);
}
function isOuterRightWhitespaceSensitiveCssDisplay(cssDisplay) {
    return !isBlockLikeCssDisplay(cssDisplay);
}
function isDanglingSpaceSensitiveCssDisplay(cssDisplay) {
    return !isBlockLikeCssDisplay(cssDisplay) && cssDisplay !== 'inline-block';
}
function getNodeCssStyleWhiteSpace(node) {
    return ((isHtmlNode(node) && typeof node.name === 'string' && constants_evaluate_1.CSS_WHITE_SPACE_TAGS[node.name]) ||
        (isLiquidNode(node) &&
            'name' in node &&
            typeof node.name === 'string' &&
            constants_evaluate_1.CSS_WHITE_SPACE_LIQUID_TAGS[node.name]) ||
        constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT);
}
function isHtmlElementWithoutCloseTag(node) {
    return (!!node &&
        node.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
        node.blockEndPosition.start === node.blockEndPosition.end);
}
//# sourceMappingURL=augment-with-whitespace-helpers.js.map