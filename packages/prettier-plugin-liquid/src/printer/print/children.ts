import { NodeTypes } from '@shopify/liquid-html-parser';
import { doc } from 'prettier';
import { locStart, locEnd } from '../../utils';
import {
  AstPath,
  LiquidAstPath,
  LiquidHtmlNode,
  LiquidParserOptions,
  LiquidPrinter,
  LiquidPrinterArgs,
} from '../../types';
import {
  FORCE_BREAK_GROUP_ID,
  FORCE_FLAT_GROUP_ID,
  forceBreakChildren,
  forceNextEmptyLine,
  hasPrettierIgnore,
  isEmpty,
  isLiquidNode,
  hasNoCloseMarker,
  isTextLikeNode,
  preferHardlineAsLeadingSpaces,
  hasNoChildren,
} from '../utils';
import {
  needsToBorrowNextOpeningTagStartMarker,
  needsToBorrowParentClosingTagStartMarker,
  needsToBorrowPrevClosingTagEndMarker,
  printClosingTagEndMarker,
  printClosingTagSuffix,
  printOpeningTagPrefix,
  printOpeningTagStartMarker,
} from './tag';

const {
  builders: { breakParent, group, ifBreak, line, softline, hardline },
} = doc;
const { replaceEndOfLine } = doc.utils as any;

function printChild(
  childPath: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
) {
  const child = childPath.getValue();

  if (hasPrettierIgnore(child)) {
    const isPrevBorrowingOpeningMarker =
      child.prev && needsToBorrowNextOpeningTagStartMarker(child.prev);
    const bodyStartOffset = isPrevBorrowingOpeningMarker
      ? printOpeningTagStartMarker(child).length
      : 0;
    const bodyStart = locStart(child) + bodyStartOffset;

    const isNextBorrowingClosingMarker =
      child.next && needsToBorrowPrevClosingTagEndMarker(child.next);

    // This could be "minus the `>` because the next tag borrows it"
    const bodyEndOffset = isNextBorrowingClosingMarker
      ? printClosingTagEndMarker(child, options).length
      : 0;
    const bodyEnd = locEnd(child) - bodyEndOffset;

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
    if (child.type === NodeTypes.HtmlElement && isNextBorrowingClosingMarker) {
      rawContent = rawContent.trimEnd();
    }

    return [
      printOpeningTagPrefix(child, options),
      ...replaceEndOfLine(rawContent),
      printClosingTagSuffix(child, options),
    ];
  }

  return print(childPath, args);
}

function printBetweenLine(
  prevNode: LiquidHtmlNode | undefined,
  nextNode: LiquidHtmlNode | undefined,
) {
  if (!prevNode || !nextNode) return '';

  const spaceBetweenLinesIsHandledSomewhereElse =
    (needsToBorrowNextOpeningTagStartMarker(prevNode) &&
      (hasPrettierIgnore(nextNode) ||
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
        hasNoChildren(nextNode) ||
        /**
         *     123<span
         *             ~
         *       attr
         */
        (nextNode.type === NodeTypes.HtmlElement && nextNode.attributes.length > 0))) ||
    /**
     *     <img
     *       src="long"
     *                 ~
     *     />123
     */
    (prevNode.type === NodeTypes.HtmlElement &&
      hasNoCloseMarker(prevNode) &&
      needsToBorrowPrevClosingTagEndMarker(nextNode));

  if (spaceBetweenLinesIsHandledSomewhereElse) {
    return '';
  }

  const shouldUseHardline =
    !nextNode.isLeadingWhitespaceSensitive ||
    preferHardlineAsLeadingSpaces(nextNode) ||
    /**
     *       Want to write us a letter? Use our<a
     *         ><b><a>mailing address</a></b></a
     *                                          ~
     *       >.
     */
    (needsToBorrowPrevClosingTagEndMarker(nextNode) &&
      prevNode.lastChild &&
      needsToBorrowParentClosingTagStartMarker(prevNode.lastChild) &&
      prevNode.lastChild.lastChild &&
      needsToBorrowParentClosingTagStartMarker(prevNode.lastChild.lastChild));

  if (shouldUseHardline) {
    return hardline;
  }

  return nextNode.hasLeadingWhitespace ? line : softline;
}

export type HasChildren = Extract<LiquidHtmlNode, { children?: LiquidHtmlNode[] }>;

type Whitespace = doc.builders.Line | doc.builders.Softline | doc.builders.IfBreak;

interface WhitespaceBetweenNode {
  /**
   * @doc Leading, doesn't break content
   */
  leadingHardlines: (typeof hardline)[];

  /**
   * @doc Leading, breaks first if content doesn't fit.
   */
  leadingWhitespace: Whitespace[];

  /**
   * @doc Leading, breaks first and trailing whitespace if content doesn't fit.
   */
  leadingDependentWhitespace: doc.builders.Softline[];

  /**
   * @doc Trailing, breaks when content breaks.
   */
  trailingWhitespace: Whitespace[];

  /**
   * @doc Trailing, doesn't break content
   */
  trailingHardlines: (typeof hardline)[];
}

// This code is adapted from prettier's language-html plugin.
export function printChildren(
  path: AstPath<HasChildren>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
) {
  const node = path.getValue();

  if (!node.children) {
    throw new Error('attempting to use printChildren on something without children');
  }

  if (forceBreakChildren(node)) {
    return [
      breakParent,

      ...path.map((childPath) => {
        const childNode = childPath.getValue();
        const prevBetweenLine = printBetweenLine(childNode.prev, childNode);
        return [
          !prevBetweenLine
            ? ''
            : [prevBetweenLine, forceNextEmptyLine(childNode.prev) ? hardline : ''],
          printChild(childPath, options, print, {
            ...args,
            leadingSpaceGroupId: FORCE_BREAK_GROUP_ID,
            trailingSpaceGroupId: FORCE_BREAK_GROUP_ID,
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
  const whitespaceBetweenNode = path.map(
    (childPath: AstPath<LiquidHtmlNode>, childIndex: number): WhitespaceBetweenNode => {
      const childNode = childPath.getValue();

      const leadingHardlines: (typeof hardline)[] = [];
      const leadingWhitespace: Whitespace[] = [];
      const leadingDependentWhitespace: doc.builders.Softline[] = [];
      const trailingWhitespace: Whitespace[] = [];
      const trailingHardlines: (typeof hardline)[] = [];

      const prevBetweenLine = printBetweenLine(childNode.prev, childNode);
      const nextBetweenLine = printBetweenLine(childNode, childNode.next);

      if (isTextLikeNode(childNode)) {
        return {
          leadingHardlines,
          leadingWhitespace,
          leadingDependentWhitespace,
          trailingWhitespace,
          trailingHardlines,
        };
      }

      if (prevBetweenLine) {
        if (forceNextEmptyLine(childNode.prev)) {
          leadingHardlines.push(hardline, hardline);
        } else if (prevBetweenLine === hardline) {
          leadingHardlines.push(hardline);
        } else {
          if (isTextLikeNode(childNode.prev)) {
            if (isLiquidNode(childNode) && prevBetweenLine === softline) {
              leadingDependentWhitespace.push(prevBetweenLine as typeof softline);
            } else {
              leadingWhitespace.push(prevBetweenLine as doc.builders.Line);
            }
          } else {
            // We're collapsing nextBetweenLine and prevBetweenLine of
            // adjacent nodes here. When the previous node breaks content,
            // then we want to print nothing here. If it doesn't, then add
            // a softline and give a chance to _this_ node to break.
            leadingWhitespace.push(
              ifBreak('', softline, {
                groupId: trailingSpaceGroupIds[childIndex - 1],
              }),
            );
          }
        }
      }

      if (nextBetweenLine) {
        if (forceNextEmptyLine(childNode)) {
          if (isTextLikeNode(childNode.next)) {
            trailingHardlines.push(hardline, hardline);
          }
        } else if (nextBetweenLine === hardline) {
          if (isTextLikeNode(childNode.next)) {
            trailingHardlines.push(hardline);
          }
          // there's a hole here, it's intentional!
        } else {
          // We know it's not a typeof hardline here because we do the
          // check on the previous condition.
          trailingWhitespace.push(nextBetweenLine as doc.builders.Line);
        }
      }

      return {
        leadingHardlines,
        leadingWhitespace,
        leadingDependentWhitespace,
        trailingWhitespace,
        trailingHardlines,
      } as WhitespaceBetweenNode;
    },
    'children',
  );

  return path.map((childPath, childIndex) => {
    const {
      leadingHardlines,
      leadingWhitespace,
      leadingDependentWhitespace,
      trailingWhitespace,
      trailingHardlines,
    } = whitespaceBetweenNode[childIndex];

    return [
      ...leadingHardlines, // independent
      group(
        [
          ...leadingWhitespace, // breaks first
          group(
            [
              ...leadingDependentWhitespace, // breaks with trailing
              printChild(childPath, options, print, {
                ...args,
                leadingSpaceGroupId: leadingSpaceGroupId(whitespaceBetweenNode, childIndex),
                trailingSpaceGroupId: trailingSpaceGroupId(whitespaceBetweenNode, childIndex),
              }),
              ...trailingWhitespace, // breaks second, if content breaks
            ],
            {
              id: trailingSpaceGroupIds[childIndex],
            },
          ),
        ],
        {
          id: leadingSpaceGroupIds[childIndex],
        },
      ),
      ...trailingHardlines, // independent
    ];
  }, 'children');

  function leadingSpaceGroupId(
    whitespaceBetweenNode: WhitespaceBetweenNode[],
    index: number,
  ): symbol[] | symbol | undefined {
    if (index === 0) {
      return args.leadingSpaceGroupId;
    }

    const prev = whitespaceBetweenNode[index - 1];
    const curr = whitespaceBetweenNode[index];
    const groupIds = [];

    if (!isEmpty(prev.trailingHardlines) || !isEmpty(curr.leadingHardlines)) {
      return FORCE_BREAK_GROUP_ID;
    }

    if (!isEmpty(prev.trailingWhitespace)) {
      groupIds.push(trailingSpaceGroupIds[index - 1]);
    }

    if (!isEmpty(curr.leadingWhitespace)) {
      groupIds.push(leadingSpaceGroupIds[index]);
    }

    if (!isEmpty(curr.leadingDependentWhitespace)) {
      groupIds.push(trailingSpaceGroupIds[index]);
    }

    if (isEmpty(groupIds)) {
      groupIds.push(FORCE_FLAT_GROUP_ID);
    }

    return groupIds;
  }

  function trailingSpaceGroupId(whitespaceBetweenNode: WhitespaceBetweenNode[], index: number) {
    if (index === whitespaceBetweenNode.length - 1) {
      return args.trailingSpaceGroupId;
    }

    const curr = whitespaceBetweenNode[index];
    const next = whitespaceBetweenNode[index + 1];
    const groupIds = [];

    if (!isEmpty(curr.trailingHardlines) || !isEmpty(next.leadingHardlines)) {
      return FORCE_BREAK_GROUP_ID;
    }

    if (!isEmpty(curr.trailingWhitespace)) {
      groupIds.push(trailingSpaceGroupIds[index]);
    }

    if (isEmpty(groupIds)) {
      groupIds.push(FORCE_FLAT_GROUP_ID);
    }

    return groupIds;
  }
}
