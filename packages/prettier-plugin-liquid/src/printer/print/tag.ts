import { NodeTypes, Position } from '@shopify/liquid-html-parser';
import { Doc, doc } from 'prettier';

import {
  first,
  getLastDescendant,
  hasMeaningfulLackOfLeadingWhitespace,
  hasMeaningfulLackOfTrailingWhitespace,
  hasMoreThanOneNewLineBetweenNodes,
  hasNoChildren,
  hasNoCloseMarker,
  hasPrettierIgnore,
  isHtmlComment,
  isHtmlDanglingMarkerOpen,
  isHtmlElement,
  isHtmlNode,
  isLiquidNode,
  isPreLikeNode,
  isPrettierIgnoreAttributeNode,
  isSelfClosing,
  isTextLikeNode,
  isVoidElement,
  last,
  shouldPreserveContent,
} from '../utils';
import {
  AstPath,
  HtmlDanglingMarkerClose,
  HtmlElement,
  HtmlNode,
  HtmlSelfClosingElement,
  LiquidHtmlNode,
  LiquidParserOptions,
  LiquidPrinter,
} from '../../types';

const {
  builders: { breakParent, indent, join, line, softline, hardline },
} = doc;
const { replaceEndOfLine } = doc.utils as any;

function shouldNotPrintClosingTag(node: LiquidHtmlNode, _options: LiquidParserOptions) {
  return (
    !hasNoCloseMarker(node) && // has close marker
    !(node as any).blockEndPosition && // does not have blockEndPosition
    (hasPrettierIgnore(node) || shouldPreserveContent(node.parentNode!))
  );
}

export function needsToBorrowPrevClosingTagEndMarker(node: LiquidHtmlNode) {
  /**
   *     <p></p
   *     >123
   *     ^
   *
   *     <p></p
   *     ><a
   *     ^
   */
  return (
    !isLiquidNode(node) &&
    node.prev &&
    // node.prev.type !== 'docType' &&
    isHtmlNode(node.prev) &&
    hasMeaningfulLackOfLeadingWhitespace(node)
  );
}

export function needsToBorrowLastChildClosingTagEndMarker(node: LiquidHtmlNode) {
  /**
   *     <p
   *       ><a></a
   *       ></p
   *       ^
   *     >
   */
  return (
    isHtmlNode(node) &&
    node.lastChild &&
    hasMeaningfulLackOfTrailingWhitespace(node.lastChild) &&
    isHtmlNode(getLastDescendant(node.lastChild)) &&
    !isPreLikeNode(node)
  );
}

export function needsToBorrowParentClosingTagStartMarker(node: LiquidHtmlNode) {
  /**
   *     <p>
   *       123</p
   *          ^^^
   *     >
   *
   *         123</b
   *       ></a
   *        ^^^
   *     >
   */
  return (
    isHtmlNode(node.parentNode) &&
    !node.next &&
    hasMeaningfulLackOfTrailingWhitespace(node) &&
    !isLiquidNode(node) &&
    (isTextLikeNode(getLastDescendant(node)) || isLiquidNode(getLastDescendant(node)))
  );
}

export function needsToBorrowNextOpeningTagStartMarker(node: LiquidHtmlNode) {
  /**
   *     123<p
   *        ^^
   *     >
   */
  return (
    node.next &&
    isHtmlNode(node.next) &&
    isTextLikeNode(node) &&
    hasMeaningfulLackOfTrailingWhitespace(node)
  );
}

export function needsToBorrowParentOpeningTagEndMarker(node: LiquidHtmlNode) {
  /**
   *     <p
   *       >123
   *       ^
   *
   *     <p
   *       ><a
   *       ^
   */
  return (
    isHtmlNode(node.parentNode) &&
    !node.prev &&
    hasMeaningfulLackOfLeadingWhitespace(node) &&
    !isLiquidNode(node)
  );
}

/**
 * This is so complicated :')
 */
function printAttributes(
  path: AstPath<HtmlNode>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  attrGroupId: symbol,
) {
  const node = path.getValue();

  if (isHtmlComment(node)) return '';
  if (node.type === NodeTypes.HtmlDanglingMarkerClose) return '';

  if (node.attributes.length === 0) {
    return isSelfClosing(node)
      ? /**
         *     <br />
         *        ^
         */
        ' '
      : '';
  }

  const prettierIgnoreAttributes = isPrettierIgnoreAttributeNode(node.prev);

  const printedAttributes = path.map((attr) => {
    const attrNode = attr.getValue();
    let extraNewline: Doc = '';
    if (
      attrNode.prev &&
      hasMoreThanOneNewLineBetweenNodes(attrNode.source, attrNode.prev, attrNode)
    ) {
      extraNewline = hardline;
    }
    const printed = print(attr, { trailingSpaceGroupId: attrGroupId });
    return [extraNewline, printed];
  }, 'attributes');

  const forceBreakAttrContent = node.source
    .slice(node.blockStartPosition.start, last(node.attributes).position.end)
    .includes('\n');

  const isSingleLineLinkTagException =
    options.singleLineLinkTags && typeof node.name === 'string' && node.name === 'link';

  const shouldNotBreakAttributes =
    ((isHtmlElement(node) && node.children.length > 0) ||
      isVoidElement(node) ||
      isSelfClosing(node)) &&
    !forceBreakAttrContent &&
    node.attributes.length === 1 &&
    !isLiquidNode(node.attributes[0]);

  const forceNotToBreakAttrContent = isSingleLineLinkTagException || shouldNotBreakAttributes;

  const whitespaceBetweenAttributes = forceNotToBreakAttrContent
    ? ' '
    : options.singleAttributePerLine && node.attributes.length > 1
    ? hardline
    : line;

  const attributes = prettierIgnoreAttributes
    ? replaceEndOfLine(
        node.source.slice(
          first(node.attributes).position.start,
          last(node.attributes).position.end,
        ),
      )
    : join(whitespaceBetweenAttributes, printedAttributes);

  let trailingInnerWhitespace: Doc;
  if (
    /**
     *     123<a
     *       attr
     *           ~
     *       >456
     */
    (node.firstChild && needsToBorrowParentOpeningTagEndMarker(node.firstChild)) ||
    /**
     *     <span
     *       >123<meta
     *                ~
     *     /></span>
     */
    (hasNoCloseMarker(node) && needsToBorrowLastChildClosingTagEndMarker(node.parentNode!)) ||
    forceNotToBreakAttrContent
  ) {
    trailingInnerWhitespace = isSelfClosing(node) ? ' ' : '';
  } else {
    trailingInnerWhitespace = options.bracketSameLine
      ? isSelfClosing(node)
        ? ' '
        : ''
      : isSelfClosing(node)
      ? line
      : softline;
  }

  return [
    indent([
      forceNotToBreakAttrContent ? ' ' : line,
      forceBreakAttrContent ? breakParent : '',
      attributes,
    ]),
    trailingInnerWhitespace,
  ];
}

export function printOpeningTag(
  path: AstPath<HtmlNode>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  attrGroupId: symbol,
) {
  const node = path.getValue();

  return [
    printOpeningTagStart(node, options),
    printAttributes(path, options, print, attrGroupId),
    hasNoChildren(node) ? '' : printOpeningTagEnd(node),
  ];
}

// If the current node's `<` isn't borrowed by the previous node, will print the prefix and `<`
export function printOpeningTagStart(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return node.prev && needsToBorrowNextOpeningTagStartMarker(node.prev)
    ? ''
    : [printOpeningTagPrefix(node, options), printOpeningTagStartMarker(node)];
}

// The opening tag prefix is the mechanism we use to "borrow" closing tags to maintain lack of whitespace
// It will print the parent's or the previous node's `>` if we need to.
export function printOpeningTagPrefix(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return needsToBorrowParentOpeningTagEndMarker(node)
    ? printOpeningTagEndMarker(node.parentNode) // opening tag '>' of parent
    : needsToBorrowPrevClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.prev, options) // closing '>' of previous
    : '';
}

// Will maybe print the `>` of the node.
//   If the first child needs to borrow the `>`, we won't print it
//
//   <a
//     ><img
//     ^ this is the opening tag end. Might be borrowed by the first child.
//   ></a>
function printOpeningTagEnd(node: LiquidHtmlNode) {
  return node.firstChild && needsToBorrowParentOpeningTagEndMarker(node.firstChild)
    ? ''
    : printOpeningTagEndMarker(node);
}

// Print the `<` equivalent for the node.
export function printOpeningTagStartMarker(node: LiquidHtmlNode | undefined) {
  if (!node) return '';
  switch (node.type) {
    case NodeTypes.HtmlComment:
      return '<!--';
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlSelfClosingElement:
      return `<${getCompoundName(node)}`;
    case NodeTypes.HtmlDanglingMarkerClose:
      return `</${getCompoundName(node)}`;
    case NodeTypes.HtmlVoidElement:
    case NodeTypes.HtmlRawNode:
      return `<${node.name}`;
    default:
      return ''; // TODO
  }
}

// this function's job is to print the closing part of the tag </a>
// curious: it also prints void elements `>` and self closing node's `/>`
//   that's because we might want to borrow it
export function printClosingTag(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return [
    hasNoCloseMarker(node) ? '' : printClosingTagStart(node, options),
    printClosingTagEnd(node, options),
  ];
}

export function printClosingTagStart(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return node.lastChild && needsToBorrowParentClosingTagStartMarker(node.lastChild)
    ? ''
    : [printClosingTagPrefix(node, options), printClosingTagStartMarker(node, options)];
}

export function printClosingTagEnd(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return (
    node.next
      ? needsToBorrowPrevClosingTagEndMarker(node.next)
      : needsToBorrowLastChildClosingTagEndMarker(node.parentNode!)
  )
    ? ''
    : [printClosingTagEndMarker(node, options), printClosingTagSuffix(node, options)];
}

function printClosingTagPrefix(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return needsToBorrowLastChildClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.lastChild, options)
    : '';
}

export function printClosingTagSuffix(node: LiquidHtmlNode, options: LiquidParserOptions) {
  return needsToBorrowParentClosingTagStartMarker(node)
    ? printClosingTagStartMarker(node.parentNode, options)
    : needsToBorrowNextOpeningTagStartMarker(node)
    ? printOpeningTagStartMarker(node.next)
    : '';
}

export function printClosingTagStartMarker(
  node: LiquidHtmlNode | undefined,
  options: LiquidParserOptions,
) {
  if (!node) return '';
  /* istanbul ignore next */
  if (shouldNotPrintClosingTag(node, options)) {
    return '';
  }
  switch (node.type) {
    case NodeTypes.HtmlElement:
      return `</${getCompoundName(node)}`;
    case NodeTypes.HtmlRawNode:
      return `</${node.name}`;
    default:
      return '';
  }
}

export function printClosingTagEndMarker(
  node: LiquidHtmlNode | undefined,
  options: LiquidParserOptions,
) {
  if (!node) return '';
  if (shouldNotPrintClosingTag(node, options) || isHtmlDanglingMarkerOpen(node)) {
    return '';
  }

  switch (node.type) {
    case NodeTypes.HtmlSelfClosingElement: {
      // looks like it doesn't make sense because it should be part of
      // the printOpeningTagEndMarker but this is handled somewhere else.
      // This function is used to determine what to borrow so the "end" to
      // borrow is actually the other end.
      return '/>';
    }

    default:
      return '>';
  }
}

// Print the opening tag's `>`
export function printOpeningTagEndMarker(node: LiquidHtmlNode | undefined) {
  if (!node) return '';
  switch (node.type) {
    case NodeTypes.HtmlComment:
      return '-->';
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlVoidElement:
      return ''; // the `>` is printed by the printClosingTagEndMarker for self closing things
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlDanglingMarkerClose:
    // TODO why is this one not with the other group?
    case NodeTypes.HtmlRawNode:
      return '>';
    default:
      return '>';
  }
}

export function getNodeContent(
  node: Extract<HtmlNode, { blockStartPosition: Position; blockEndPosition: Position }>,
  options: LiquidParserOptions,
) {
  let start = node.blockStartPosition.end;
  if (node.firstChild && needsToBorrowParentOpeningTagEndMarker(node.firstChild)) {
    start -= printOpeningTagEndMarker(node).length;
  }

  let end = node.blockEndPosition.start;
  if (node.lastChild && needsToBorrowParentClosingTagStartMarker(node.lastChild)) {
    end += printClosingTagStartMarker(node, options).length;
  } else if (node.lastChild && needsToBorrowLastChildClosingTagEndMarker(node)) {
    end -= printClosingTagEndMarker(node.lastChild, options).length;
  }

  return options.originalText.slice(start, end);
}

function getCompoundName(
  node: HtmlElement | HtmlSelfClosingElement | HtmlDanglingMarkerClose,
): string {
  return node.name
    .map((part) => {
      if (part.type === NodeTypes.TextNode) {
        return part.value;
      } else if (typeof part.markup === 'string') {
        return `{{ ${part.markup.trim()} }}`;
      } else {
        return `{{ ${part.markup.rawSource} }}`;
      }
    })
    .join('');
}
