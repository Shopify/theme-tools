import { Doc, doc } from 'prettier';
import {
  AstPath,
  HtmlDanglingMarkerOpen,
  HtmlDanglingMarkerClose,
  HtmlElement,
  HtmlNode,
  HtmlSelfClosingElement,
  LiquidHtmlNode,
  LiquidParserOptions,
  LiquidPrinter,
  NodeTypes,
  Position,
} from '~/types';
import {
  getLastDescendant,
  hasPrettierIgnore,
  isHtmlNode,
  isVoidElement,
  isHtmlElement,
  isLiquidNode,
  isPreLikeNode,
  hasNoCloseMarker,
  isTextLikeNode,
  shouldPreserveContent,
  isSelfClosing,
  isHtmlComment,
  hasMeaningfulLackOfLeadingWhitespace,
  hasMeaningfulLackOfTrailingWhitespace,
  last,
  first,
  isPrettierIgnoreAttributeNode,
  hasMoreThanOneNewLineBetweenNodes,
} from '~/printer/utils';

const {
  builders: { breakParent, indent, join, line, softline, hardline },
} = doc;
const { replaceEndOfLine } = doc.utils as any;

export function printClosingTag(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return [
    hasNoCloseMarker(node) ? '' : printClosingTagStart(node, options),
    printClosingTagEnd(node, options),
  ];
}

export function printClosingTagStart(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return node.lastChild &&
    needsToBorrowParentClosingTagStartMarker(node.lastChild)
    ? ''
    : [
        printClosingTagPrefix(node, options),
        printClosingTagStartMarker(node, options),
      ];
}

export function printClosingTagEnd(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return (
    node.next
      ? needsToBorrowPrevClosingTagEndMarker(node.next)
      : needsToBorrowLastChildClosingTagEndMarker(node.parentNode!)
  )
    ? ''
    : [
        printClosingTagEndMarker(node, options),
        printClosingTagSuffix(node, options),
      ];
}

function printClosingTagPrefix(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return needsToBorrowLastChildClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.lastChild, options)
    : '';
}

export function printClosingTagSuffix(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
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
  if (shouldNotPrintClosingTag(node, options)) {
    return '';
  }

  switch (node.type) {
    // case 'ieConditionalComment':
    // case 'ieConditionalEndComment':
    //   return '[endif]-->';
    // case 'ieConditionalStartComment':
    //   return ']><!-->';
    // case 'interpolation':
    //   return '}}';
    case NodeTypes.HtmlSelfClosingElement: {
      // This looks like it doesn't make sense because it should be part of
      // the printOpeningTagEndMarker but this is handled somewhere else.
      // This function is used to determine what to borrow so the "end" to
      // borrow is actually the other end.
      return '/>';
    }

    default:
      return '>';
  }
}

function shouldNotPrintClosingTag(
  node: LiquidHtmlNode,
  _options: LiquidParserOptions,
) {
  return (
    !hasNoCloseMarker(node) &&
    !(node as any).blockEndPosition &&
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

export function needsToBorrowLastChildClosingTagEndMarker(
  node: LiquidHtmlNode,
) {
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
    (isTextLikeNode(getLastDescendant(node)) ||
      isLiquidNode(getLastDescendant(node)))
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
      hasMoreThanOneNewLineBetweenNodes(
        attrNode.source,
        attrNode.prev,
        attrNode,
      )
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
    options.singleLineLinkTags &&
    typeof node.name === 'string' &&
    node.name === 'link';

  const shouldNotBreakAttributes =
    ((isHtmlElement(node) && node.children.length > 0) ||
      isVoidElement(node) ||
      isSelfClosing(node)) &&
    !forceBreakAttrContent &&
    node.attributes.length === 1 &&
    !isLiquidNode(node.attributes[0]);

  const forceNotToBreakAttrContent =
    isSingleLineLinkTagException || shouldNotBreakAttributes;

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
    (node.firstChild &&
      needsToBorrowParentOpeningTagEndMarker(node.firstChild)) ||
    /**
     *     <span
     *       >123<meta
     *                ~
     *     /></span>
     */
    (hasNoCloseMarker(node) &&
      needsToBorrowLastChildClosingTagEndMarker(node.parentNode!)) ||
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

function printOpeningTagEnd(node: LiquidHtmlNode) {
  return node.firstChild &&
    needsToBorrowParentOpeningTagEndMarker(node.firstChild)
    ? ''
    : printOpeningTagEndMarker(node);
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
    hasNoCloseMarker(node) ? '' : printOpeningTagEnd(node),
  ];
}

export function printOpeningTagStart(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return node.prev && needsToBorrowNextOpeningTagStartMarker(node.prev)
    ? ''
    : [printOpeningTagPrefix(node, options), printOpeningTagStartMarker(node)];
}

export function printOpeningTagPrefix(
  node: LiquidHtmlNode,
  options: LiquidParserOptions,
) {
  return needsToBorrowParentOpeningTagEndMarker(node)
    ? printOpeningTagEndMarker(node.parentNode)
    : needsToBorrowPrevClosingTagEndMarker(node)
    ? printClosingTagEndMarker(node.prev, options)
    : '';
}

// TODO
export function printOpeningTagStartMarker(node: LiquidHtmlNode | undefined) {
  if (!node) return '';
  switch (node.type) {
    case NodeTypes.HtmlComment:
      return '<!--';
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlDanglingMarkerOpen:
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

export function printOpeningTagEndMarker(node: LiquidHtmlNode | undefined) {
  if (!node) return '';
  switch (node.type) {
    // case 'ieConditionalComment':
    //   return ']>';
    case NodeTypes.HtmlComment:
      return '-->';
    case NodeTypes.HtmlSelfClosingElement:
    case NodeTypes.HtmlVoidElement:
      return '';
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlDanglingMarkerOpen:
    case NodeTypes.HtmlDanglingMarkerClose:
    case NodeTypes.HtmlRawNode:
      return '>';
    default:
      return '>';
  }
}

export function getNodeContent(
  node: Extract<
    HtmlNode,
    { blockStartPosition: Position; blockEndPosition: Position }
  >,
  options: LiquidParserOptions,
) {
  let start = node.blockStartPosition.end;
  if (
    node.firstChild &&
    needsToBorrowParentOpeningTagEndMarker(node.firstChild)
  ) {
    start -= printOpeningTagEndMarker(node).length;
  }

  let end = node.blockEndPosition.start;
  if (
    node.lastChild &&
    needsToBorrowParentClosingTagStartMarker(node.lastChild)
  ) {
    end += printClosingTagStartMarker(node, options).length;
  } else if (
    node.lastChild &&
    needsToBorrowLastChildClosingTagEndMarker(node)
  ) {
    end -= printClosingTagEndMarker(node.lastChild, options).length;
  }

  return options.originalText.slice(start, end);
}

function getCompoundName(
  node:
    | HtmlElement
    | HtmlSelfClosingElement
    | HtmlDanglingMarkerOpen
    | HtmlDanglingMarkerClose,
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
