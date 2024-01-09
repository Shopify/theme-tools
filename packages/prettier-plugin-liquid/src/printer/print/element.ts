'use strict';

import { doc, Doc } from 'prettier';
import { NodeTypes } from '@shopify/liquid-html-parser';
import { shouldPreserveContent, forceBreakContent, hasNoChildren } from '../utils';
import {
  printOpeningTagPrefix,
  printOpeningTag,
  printClosingTagSuffix,
  printClosingTag,
  needsToBorrowPrevClosingTagEndMarker,
  needsToBorrowLastChildClosingTagEndMarker,
  getNodeContent,
} from './tag';
import { printChildren } from './children';
import {
  AstPath,
  LiquidParserOptions,
  LiquidPrinter,
  HtmlNode,
  LiquidPrinterArgs,
  HtmlRawNode,
} from '../../types';

const {
  builders: { breakParent, dedentToRoot, group, indent, hardline, line, softline },
} = doc;
const { replaceEndOfLine } = doc.utils as any;

export function printRawElement(
  path: AstPath<HtmlRawNode>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  _args: LiquidPrinterArgs,
) {
  const node = path.getValue();
  const attrGroupId = Symbol('element-attr-group-id');
  let body: Doc = [];
  const hasEmptyBody = node.body.value.trim() === '';

  if (!hasEmptyBody) {
    body = [path.call((p: any) => print(p), 'body')];
  }

  return group([
    printOpeningTagPrefix(node, options),
    group(printOpeningTag(path, options, print, attrGroupId), {
      id: attrGroupId,
    }),
    ...body,
    ...printClosingTag(node, options),
    printClosingTagSuffix(node, options),
  ]);
}

export function printElement(
  path: AstPath<HtmlNode>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
) {
  const node = path.getValue();
  const attrGroupId = Symbol('element-attr-group-id');
  const elementGroupId = Symbol('element-group-id');

  if (node.type === NodeTypes.HtmlRawNode) {
    return printRawElement(path as AstPath<HtmlRawNode>, options, print, args);
  }

  if (hasNoChildren(node)) {
    // TODO, broken for HtmlComment but this code path is not used (so far).
    return [
      group(printOpeningTag(path, options, print, attrGroupId), {
        id: attrGroupId,
      }),
      ...printClosingTag(node, options),
      printClosingTagSuffix(node, options),
    ];
  }

  if (shouldPreserveContent(node)) {
    return [
      printOpeningTagPrefix(node, options),
      group(printOpeningTag(path, options, print, attrGroupId), {
        id: attrGroupId,
      }),
      ...replaceEndOfLine(getNodeContent(node, options)),
      ...printClosingTag(node, options),
      printClosingTagSuffix(node, options),
    ];
  }

  const printTag = (doc: Doc) =>
    group(
      [
        group(printOpeningTag(path, options, print, attrGroupId), {
          id: attrGroupId,
        }),
        doc,
        printClosingTag(node, options),
      ],
      { id: elementGroupId },
    );

  const printLineBeforeChildren = () => {
    if (node.firstChild!.hasLeadingWhitespace && node.firstChild!.isLeadingWhitespaceSensitive) {
      return line;
    }

    if (
      node.firstChild!.type === NodeTypes.TextNode &&
      node.isWhitespaceSensitive &&
      node.isIndentationSensitive
    ) {
      return dedentToRoot(softline);
    }
    return softline;
  };

  const printLineAfterChildren = () => {
    // does not have the closing tag
    if (node.blockEndPosition.start === node.blockEndPosition.end) {
      return '';
    }
    const needsToBorrow = node.next
      ? needsToBorrowPrevClosingTagEndMarker(node.next)
      : needsToBorrowLastChildClosingTagEndMarker(node.parentNode!);
    if (needsToBorrow) {
      if (node.lastChild!.hasTrailingWhitespace && node.lastChild!.isTrailingWhitespaceSensitive) {
        return ' ';
      }
      return '';
    }
    if (node.lastChild!.hasTrailingWhitespace && node.lastChild!.isTrailingWhitespaceSensitive) {
      return line;
    }
    return softline;
  };

  if (node.children.length === 0) {
    return printTag(
      node.hasDanglingWhitespace &&
        node.isDanglingWhitespaceSensitive &&
        node.blockEndPosition.end !== node.blockEndPosition.start
        ? line
        : '',
    );
  }

  return printTag([
    forceBreakContent(node) ? breakParent : '',
    indent([
      printLineBeforeChildren(),
      printChildren(path as AstPath<typeof node>, options, print, {
        leadingSpaceGroupId: elementGroupId,
        trailingSpaceGroupId: elementGroupId,
      }),
    ]),
    printLineAfterChildren(),
  ]);
}
