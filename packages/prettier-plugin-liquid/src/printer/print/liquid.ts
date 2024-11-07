import { NodeTypes, NamedTags, isBranchedTag } from '@shopify/liquid-html-parser';
import { Doc, doc } from 'prettier';

import {
  AstPath,
  LiquidAstPath,
  LiquidBranch,
  LiquidBranchNamed,
  LiquidParserOptions,
  LiquidPrinter,
  LiquidPrinterArgs,
  LiquidRawTag,
  LiquidStatement,
  LiquidTag,
  LiquidTagNamed,
  LiquidVariableOutput,
} from '../../types';
import { assertNever } from '../../utils';

import {
  FORCE_FLAT_GROUP_ID,
  getWhitespaceTrim,
  hasLineBreakInRange,
  hasMeaningfulLackOfDanglingWhitespace,
  hasMeaningfulLackOfLeadingWhitespace,
  hasMeaningfulLackOfTrailingWhitespace,
  isAttributeNode,
  isDeeplyNested,
  isEmpty,
  last,
  markupLines,
  originallyHadLineBreaks,
  reindent,
  shouldPreserveContent,
  trim,
} from '../utils';

import { printChildren } from './children';

const LIQUID_TAGS_THAT_ALWAYS_BREAK = ['for', 'case'];

const { builders, utils } = doc;
const { group, hardline, ifBreak, indent, join, line, softline, literalline } = builders;
const { replaceEndOfLine } = doc.utils as any;

export function printLiquidVariableOutput(
  path: LiquidAstPath,
  _options: LiquidParserOptions,
  print: LiquidPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: LiquidPrinterArgs,
) {
  const node: LiquidVariableOutput = path.getValue() as LiquidVariableOutput;
  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    hasMeaningfulLackOfLeadingWhitespace(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    hasMeaningfulLackOfTrailingWhitespace(node),
    trailingSpaceGroupId,
  );

  if (typeof node.markup !== 'string') {
    const whitespace = node.markup.filters.length > 0 ? line : ' ';
    return group([
      '{{',
      whitespaceStart,
      indent([whitespace, path.call((p: any) => print(p), 'markup')]),
      whitespace,
      whitespaceEnd,
      '}}',
    ]);
  }

  // This should probably be better than this but it'll do for now.
  const lines = markupLines(node.markup);
  if (lines.length > 1) {
    return group([
      '{{',
      whitespaceStart,
      indent([hardline, join(hardline, lines.map(trim))]),
      hardline,
      whitespaceEnd,
      '}}',
    ]);
  }

  return group(['{{', whitespaceStart, ' ', node.markup, ' ', whitespaceEnd, '}}']);
}

function printNamedLiquidBlockStart(
  path: AstPath<LiquidTagNamed | LiquidBranchNamed>,
  _options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
  whitespaceStart: Doc,
  whitespaceEnd: Doc,
): Doc {
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
    } else {
      return {
        wrapper: group,
        prefix: ['{%', whitespaceStart, ' '],
        suffix: (trailingWhitespace: Doc) => [trailingWhitespace, whitespaceEnd, '%}'],
      };
    }
  })();

  const tag = (trailingWhitespace: Doc) =>
    wrapper([
      ...prefix,
      node.name,
      ' ',
      indent(path.call((p: any) => print(p, args), 'markup')),
      ...suffix(trailingWhitespace),
    ]);

  const tagWithArrayMarkup = (whitespace: Doc) =>
    wrapper([
      ...prefix,
      node.name,
      ' ',
      indent([
        join(
          [',', line],
          path.map((p) => print(p, args), 'markup'),
        ),
      ]),
      ...suffix(whitespace),
    ]);

  switch (node.name) {
    case NamedTags.echo: {
      const trailingWhitespace = node.markup.filters.length > 0 ? line : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.assign: {
      const trailingWhitespace = node.markup.value.filters.length > 0 ? line : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.cycle: {
      const whitespace = node.markup.args.length > 1 ? line : ' ';
      return wrapper([
        ...prefix,
        node.name,
        // We want to break after the groupName
        node.markup.groupName ? ' ' : '',
        indent(path.call((p: any) => print(p, args), 'markup')),
        ...suffix(whitespace),
      ]);
    }

    case NamedTags.content_for: {
      const markup = node.markup;
      const trailingWhitespace = markup.args.length > 0 ? line : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.include:
    case NamedTags.render: {
      const markup = node.markup;
      const trailingWhitespace =
        markup.args.length > 0 || (markup.variable && markup.alias) ? line : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.capture:
    case NamedTags.increment:
    case NamedTags.decrement:
    case NamedTags.layout:
    case NamedTags.section: {
      return tag(' ');
    }
    case NamedTags.sections: {
      return tag(' ');
    }

    case NamedTags.form: {
      const trailingWhitespace = node.markup.length > 1 ? line : ' ';
      return tagWithArrayMarkup(trailingWhitespace);
    }

    case NamedTags.tablerow:
    case NamedTags.for: {
      const trailingWhitespace = node.markup.reversed || node.markup.args.length > 0 ? line : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.paginate: {
      return tag(line);
    }

    case NamedTags.if:
    case NamedTags.elsif:
    case NamedTags.unless: {
      const trailingWhitespace = [NodeTypes.Comparison, NodeTypes.LogicalExpression].includes(
        node.markup.type,
      )
        ? line
        : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.case: {
      return tag(' ');
    }

    case NamedTags.when: {
      const trailingWhitespace = node.markup.length > 1 ? line : ' ';
      return tagWithArrayMarkup(trailingWhitespace);
    }

    case NamedTags.liquid: {
      return group([
        ...prefix,
        node.name,
        indent([
          hardline,
          join(
            hardline,
            path.map((p) => {
              const curr = p.getValue();
              return [
                getSpaceBetweenLines(curr.prev as LiquidStatement | null, curr as LiquidStatement),
                print(p, { ...args, isLiquidStatement: true }),
              ];
            }, 'markup'),
          ),
        ]),
        ...suffix(hardline),
      ]);
    }

    default: {
      return assertNever(node);
    }
  }
}

function printLiquidStatement(
  path: AstPath<Extract<LiquidTag, { name: string; markup: string }>>,
  _options: LiquidParserOptions,
  _print: LiquidPrinter,
  _args: LiquidPrinterArgs,
): Doc {
  const node = path.getValue();
  const shouldSkipLeadingSpace =
    node.markup.trim() === '' || (node.name === '#' && node.markup.startsWith('#'));
  return doc.utils.removeLines([node.name, shouldSkipLeadingSpace ? '' : ' ', node.markup]);
}

export function printLiquidBlockStart(
  path: AstPath<LiquidTag | LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs = {},
): Doc {
  const node = path.getValue();
  const { leadingSpaceGroupId, trailingSpaceGroupId } = args;

  if (!node.name) return '';

  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    needsBlockStartLeadingWhitespaceStrippingOnBreak(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    needsBlockStartTrailingWhitespaceStrippingOnBreak(node),
    trailingSpaceGroupId,
  );

  if (typeof node.markup !== 'string') {
    return printNamedLiquidBlockStart(
      path as AstPath<LiquidTagNamed | LiquidBranchNamed>,
      options,
      print,
      args,
      whitespaceStart,
      whitespaceEnd,
    );
  }

  if (args.isLiquidStatement) {
    return printLiquidStatement(
      path as AstPath<Extract<LiquidTag, { name: string; markup: string }>>,
      options,
      print,
      args,
    );
  }

  const lines = markupLines(node.markup);

  if (node.name === 'liquid') {
    return group([
      '{%',
      whitespaceStart,
      ' ',
      node.name,
      indent([hardline, join(hardline, reindent(lines, true))]),
      hardline,
      whitespaceEnd,
      '%}',
    ]);
  }

  if (lines.length > 1) {
    return group([
      '{%',
      whitespaceStart,
      indent([hardline, node.name, ' ', join(hardline, lines.map(trim))]),
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

export function printLiquidBlockEnd(
  path: AstPath<LiquidTag>,
  _options: LiquidParserOptions,
  _print: LiquidPrinter,
  args: LiquidPrinterArgs = {},
): Doc {
  const node = path.getValue();
  const { isLiquidStatement, leadingSpaceGroupId, trailingSpaceGroupId } = args;
  if (!node.children || !node.blockEndPosition) return '';
  if (isLiquidStatement) {
    return ['end', node.name];
  }
  const whitespaceStart = getWhitespaceTrim(
    node.delimiterWhitespaceStart ?? '',
    needsBlockEndLeadingWhitespaceStrippingOnBreak(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.delimiterWhitespaceEnd ?? '',
    hasMeaningfulLackOfTrailingWhitespace(node),
    trailingSpaceGroupId,
  );
  return group(['{%', whitespaceStart, ` end${node.name} `, whitespaceEnd, '%}']);
}

function getNodeContent(node: LiquidTag) {
  if (!node.children || !node.blockEndPosition) return '';
  return node.source.slice(node.blockStartPosition.end, node.blockEndPosition.start);
}

export function printLiquidTag(
  path: AstPath<LiquidTag>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
): Doc {
  const { leadingSpaceGroupId, trailingSpaceGroupId } = args;
  const node = path.getValue();
  if (!node.children || !node.blockEndPosition) {
    return printLiquidBlockStart(path, options, print, args);
  }

  if (!args.isLiquidStatement && shouldPreserveContent(node)) {
    return [
      printLiquidBlockStart(path, options, print, {
        ...args,
        leadingSpaceGroupId,
        trailingSpaceGroupId: FORCE_FLAT_GROUP_ID,
      }),
      ...replaceEndOfLine(getNodeContent(node)),
      printLiquidBlockEnd(path, options, print, {
        ...args,
        leadingSpaceGroupId: FORCE_FLAT_GROUP_ID,
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

  let body: Doc = [];

  if (isBranchedTag(node)) {
    body = cleanDoc(
      path.map(
        (p) =>
          print(p, {
            ...args,
            leadingSpaceGroupId: tagGroupId,
            trailingSpaceGroupId: tagGroupId,
          }),
        'children',
      ),
    );
    if (node.name === 'case') body = indent(body);
  } else if (node.children.length > 0) {
    body = indent([
      innerLeadingWhitespace(node),
      printChildren(path, options, print, {
        ...args,
        leadingSpaceGroupId: tagGroupId,
        trailingSpaceGroupId: tagGroupId,
      }),
    ]);
  }

  return group([blockStart, body, innerTrailingWhitespace(node, args), blockEnd], {
    id: tagGroupId,
    shouldBreak:
      LIQUID_TAGS_THAT_ALWAYS_BREAK.includes(node.name) ||
      originallyHadLineBreaks(path, options) ||
      isAttributeNode(node) ||
      isDeeplyNested(node),
  });
}

export function printLiquidRawTag(
  path: AstPath<LiquidRawTag>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  { isLiquidStatement }: LiquidPrinterArgs,
): Doc {
  let body: Doc = [];
  const node = path.getValue();
  const hasEmptyBody = node.body.value.trim() === '';
  const shouldPrintAsIs =
    node.isIndentationSensitive ||
    !hasLineBreakInRange(node.source, node.body.position.start, node.body.position.end);
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
  } else if (hasEmptyBody) {
    body = [hardline];
  } else {
    body = [path.call((p) => print(p), 'body')];
  }

  return [blockStart, ...body, blockEnd];
}

function innerLeadingWhitespace(node: LiquidTag | LiquidBranch) {
  if (!node.firstChild) {
    if (node.isDanglingWhitespaceSensitive && node.hasDanglingWhitespace) {
      return line;
    } else {
      return '';
    }
  }

  if (node.firstChild.hasLeadingWhitespace && node.firstChild.isLeadingWhitespaceSensitive) {
    return line;
  }

  return softline;
}

function innerTrailingWhitespace(node: LiquidTag | LiquidBranch, args: LiquidPrinterArgs) {
  if (
    (!args.isLiquidStatement && shouldPreserveContent(node)) ||
    node.type === NodeTypes.LiquidBranch ||
    !node.blockEndPosition ||
    !node.lastChild
  ) {
    return '';
  }

  if (node.lastChild.hasTrailingWhitespace && node.lastChild.isTrailingWhitespaceSensitive) {
    return line;
  }

  return softline;
}

function printLiquidDefaultBranch(
  path: AstPath<LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
): Doc {
  const branch = path.getValue();
  const parentNode: LiquidTag = path.getParentNode() as any;

  // When the node is empty and the parent is empty. The space will come
  // from the trailingWhitespace of the parent. When this happens, we don't
  // want the branch to print another one so we collapse it.
  // e.g. {% if A %} {% endif %}
  const shouldCollapseSpace = isEmpty(branch.children) && parentNode.children!.length === 1;
  if (shouldCollapseSpace) return '';

  // When the branch is empty and doesn't have whitespace, we don't want
  // anything so print nothing.
  // e.g. {% if A %}{% endif %}
  // e.g. {% if A %}{% else %}...{% endif %}
  const isBranchEmptyWithoutSpace = isEmpty(branch.children) && !branch.hasDanglingWhitespace;
  if (isBranchEmptyWithoutSpace) return '';

  // If the branch does not break, is empty and had whitespace, we might
  // want a space in there. We don't collapse those because the trailing
  // whitespace does not come from the parent.
  // {% if A %} {% else %}...{% endif %}
  if (branch.hasDanglingWhitespace) {
    return ifBreak('', ' ');
  }

  const shouldAddTrailingNewline =
    branch.next &&
    branch.children.length > 0 &&
    branch.source
      .slice(last(branch.children).position.end, branch.next.position.start)
      .replace(/ |\t/g, '').length >= 2;

  // Otherwise print the branch as usual
  // {% if A %} content...{% endif %}
  return indent([
    innerLeadingWhitespace(parentNode),
    printChildren(path, options, print, args),
    shouldAddTrailingNewline ? literalline : '',
  ]);
}

export function printLiquidBranch(
  path: AstPath<LiquidBranch>,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs,
): Doc {
  const branch = path.getValue();
  const isDefaultBranch = !branch.name;

  if (isDefaultBranch) {
    return printLiquidDefaultBranch(path, options, print, args);
  }

  const leftSibling = branch.prev as LiquidBranch | undefined;

  // When the left sibling is empty, its trailing whitespace is its leading
  // whitespace. So we should collapse it here and ignore it.
  const shouldCollapseSpace = leftSibling && isEmpty(leftSibling.children);
  const outerLeadingWhitespace =
    branch.hasLeadingWhitespace && !shouldCollapseSpace ? line : softline;
  const shouldAddTrailingNewline =
    branch.next &&
    branch.children.length > 0 &&
    branch.source
      .slice(last(branch.children).position.end, branch.next.position.start)
      .replace(/ |\t/g, '').length >= 2;

  return [
    outerLeadingWhitespace,
    printLiquidBlockStart(path as AstPath<LiquidBranch>, options, print, args),
    indent([
      innerLeadingWhitespace(branch),
      printChildren(path, options, print, args),
      shouldAddTrailingNewline ? literalline : '',
    ]),
  ];
}

function needsBlockStartLeadingWhitespaceStrippingOnBreak(node: LiquidTag | LiquidBranch): boolean {
  switch (node.type) {
    case NodeTypes.LiquidTag: {
      return !isAttributeNode(node) && hasMeaningfulLackOfLeadingWhitespace(node);
    }
    case NodeTypes.LiquidBranch: {
      return (
        !isAttributeNode(node.parentNode! as LiquidTag) &&
        hasMeaningfulLackOfLeadingWhitespace(node)
      );
    }
    default: {
      return assertNever(node);
    }
  }
}

function needsBlockStartTrailingWhitespaceStrippingOnBreak(
  node: LiquidTag | LiquidBranch,
): boolean {
  switch (node.type) {
    case NodeTypes.LiquidTag: {
      if (isBranchedTag(node)) {
        return needsBlockStartLeadingWhitespaceStrippingOnBreak(node.firstChild! as LiquidBranch);
      }

      if (!node.children) {
        return hasMeaningfulLackOfTrailingWhitespace(node);
      }

      return isEmpty(node.children)
        ? hasMeaningfulLackOfDanglingWhitespace(node)
        : hasMeaningfulLackOfLeadingWhitespace(node.firstChild!);
    }

    case NodeTypes.LiquidBranch: {
      if (isAttributeNode(node.parentNode! as LiquidTag)) {
        return false;
      }

      return node.firstChild
        ? hasMeaningfulLackOfLeadingWhitespace(node.firstChild)
        : hasMeaningfulLackOfDanglingWhitespace(node);
    }

    default: {
      return assertNever(node);
    }
  }
}

function needsBlockEndLeadingWhitespaceStrippingOnBreak(node: LiquidTag) {
  if (!node.children) {
    throw new Error(
      'Should only call needsBlockEndLeadingWhitespaceStrippingOnBreak for tags that have closing tags',
    );
  } else if (isAttributeNode(node)) {
    return false;
  } else if (isBranchedTag(node)) {
    return hasMeaningfulLackOfTrailingWhitespace(node.lastChild!);
  } else if (isEmpty(node.children)) {
    return hasMeaningfulLackOfDanglingWhitespace(node);
  } else {
    return hasMeaningfulLackOfTrailingWhitespace(node.lastChild!);
  }
}

function cleanDoc(doc: Doc[]): Doc[] {
  return doc.filter((x) => x !== '');
}

function getSpaceBetweenLines(prev: LiquidStatement | null, curr: LiquidStatement): Doc {
  if (!prev) return '';
  const source = curr.source;
  const whitespaceBetweenNodes = source.slice(prev.position.end, curr.position.start);
  const hasMoreThanOneNewLine = (whitespaceBetweenNodes.match(/\n/g) || []).length > 1;
  return hasMoreThanOneNewLine ? hardline : '';
}
