import { doc, Doc } from 'prettier';
import type { Printer as Printer2 } from 'prettier';
import type { Printer as Printer3 } from 'prettier3';
import {
  AttrDoubleQuoted,
  AttrEmpty,
  AttrSingleQuoted,
  AttrUnquoted,
  DocumentNode,
  HtmlDanglingMarkerClose,
  HtmlDanglingMarkerOpen,
  HtmlElement,
  HtmlRawNode,
  HtmlSelfClosingElement,
  HtmlVoidElement,
  LiquidAstPath,
  LiquidBranch,
  LiquidDrop,
  LiquidExpression,
  LiquidHtmlNode,
  LiquidParserOptions,
  LiquidPrinter,
  LiquidPrinterArgs,
  LiquidRawTag,
  LiquidTag,
  NodeTypes,
  Position,
  TextNode,
  nonTraversableProperties,
  AstPath,
} from '~/types';
import { assertNever } from '~/utils';

import { preprocess } from '~/printer/print-preprocess';
import {
  bodyLines,
  hasLineBreakInRange,
  isEmpty,
  isTextLikeNode,
  reindent,
} from '~/printer/utils';
import { printElement } from '~/printer/print/element';
import {
  printClosingTagSuffix,
  printOpeningTagPrefix,
} from '~/printer/print/tag';
import {
  printLiquidBranch,
  printLiquidDrop,
  printLiquidRawTag,
  printLiquidTag,
} from '~/printer/print/liquid';
import { printChildren } from '~/printer/print/children';
import { embed2, embed3 } from '~/printer/embed';
import { RawMarkupKinds } from '~/parser';
import { getConditionalComment } from '~/parser/conditional-comment';

const { builders, utils } = doc;
const { fill, group, hardline, indent, join, line, softline } = builders;

const oppositeQuotes = {
  '"': "'",
  "'": '"',
};

function printAttributeName(
  path: AstPath<AttrEmpty | AttrSingleQuoted | AttrUnquoted | AttrDoubleQuoted>,
  _options: LiquidParserOptions,
  print: LiquidPrinter,
): Doc {
  const node = path.getValue();
  node.name;
  return join(
    '',
    (path as any).map((part: AstPath<string | LiquidDrop>) => {
      const value = part.getValue();
      if (typeof value === 'string') {
        return value;
      } else {
        // We want to force the LiquidDrop to be on one line to avoid weird
        // shenanigans
        return utils.removeLines(print(part as AstPath<LiquidDrop>));
      }
    }, 'name'),
  );
}

function printAttribute<
  T extends Extract<LiquidHtmlNode, { attributePosition: Position }>,
>(path: AstPath<T>, options: LiquidParserOptions, print: LiquidPrinter): Doc {
  const node = path.getValue();
  const attrGroupId = Symbol('attr-group-id');
  // What should be the rule here? Should it really be "paragraph"?
  // ideally... if the thing is and the line is too long
  // use cases:
  //  - attr-{{ section.id }}--something.
  //  * We should try to put that "block" on one line
  //
  //  - attr {{ classname }} foo
  //  * we should try to put on one line?
  //
  //  - attr hello world ok fellow friends what do
  //  * if the line becomes too long do we want to break one per line?
  //    - for alt, would be paragraph
  //    - for classes, yeah maybe
  //    - for srcset?, it should be "split on comma"
  //    - for sizes?, it should be "split on comma"
  //    - for href?, it should be no space url
  //    - for others?, it should be keywords
  //    - for style, should be break on ;
  //    - for other?, should be...
  //    - how the fuck am I going to do that?
  //    - same way we do this? with a big ass switch case?
  //    - or we... don't and leave it as is?
  //
  // Anyway, for that reason ^, for now I'll just paste in what we have in
  // the source. It's too hard to get right.

  const value = node.source.slice(
    node.attributePosition.start,
    node.attributePosition.end,
  );
  const preferredQuote = options.singleQuote ? `'` : `"`;
  const attributeValueContainsQuote = !!node.value.find(
    (valueNode) =>
      isTextLikeNode(valueNode) && valueNode.value.includes(preferredQuote),
  );
  const quote = attributeValueContainsQuote
    ? oppositeQuotes[preferredQuote]
    : preferredQuote;

  return [
    printAttributeName(path, options, print),
    '=',
    quote,
    hasLineBreakInRange(
      node.source,
      node.attributePosition.start,
      node.attributePosition.end,
    )
      ? group(
          [
            indent([
              softline,
              join(hardline, reindent(bodyLines(value), true)),
            ]),
            softline,
          ],
          { id: attrGroupId },
        )
      : value,
    quote,
  ];
}

function isYamlFrontMatter(node: TextNode) {
  return (
    node.parentNode &&
    node.parentNode.type === NodeTypes.Document &&
    !node.prev &&
    /^---\r?\n/.test(node.value)
  );
}

function printTextNode(
  path: AstPath<TextNode>,
  options: LiquidParserOptions,
  _print: LiquidPrinter,
) {
  const node = path.getValue();

  if (isYamlFrontMatter(node)) return node.value;

  if (node.value.match(/^\s*$/)) return '';
  const text = node.value;

  const paragraphs = text
    .split(/(\r?\n){2,}/)
    .filter(Boolean) // removes empty paragraphs (trailingWhitespace)
    .map((curr) => {
      let doc = [];
      const words = curr.trim().split(/\s+/g);
      let isFirst = true;
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        if (isFirst) {
          isFirst = false;
        } else {
          doc.push(line);
        }
        doc.push(word);
      }
      return fill(doc);
    });

  return [
    printOpeningTagPrefix(node, options),
    join(hardline, paragraphs),
    printClosingTagSuffix(node, options),
  ];
}

function printNode(
  path: LiquidAstPath,
  options: LiquidParserOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArgs = {},
): Doc {
  const node = path.getValue();
  switch (node.type) {
    case NodeTypes.Document: {
      return [
        printChildren(path as AstPath<DocumentNode>, options, print, args),
        hardline,
      ];
    }

    case NodeTypes.HtmlElement: {
      return printElement(path as AstPath<HtmlElement>, options, print, args);
    }

    case NodeTypes.HtmlDanglingMarkerOpen: {
      return printElement(
        path as AstPath<HtmlDanglingMarkerOpen>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlDanglingMarkerClose: {
      return printElement(
        path as AstPath<HtmlDanglingMarkerClose>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlVoidElement: {
      return printElement(
        path as AstPath<HtmlVoidElement>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlSelfClosingElement: {
      return printElement(
        path as AstPath<HtmlSelfClosingElement>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlRawNode: {
      return printElement(path as AstPath<HtmlRawNode>, options, print, args);
    }

    case NodeTypes.RawMarkup: {
      const isRawMarkupIdentationSensitive = () => {
        switch (node.kind) {
          case RawMarkupKinds.typescript:
          case RawMarkupKinds.javascript: {
            return node.value.includes('`');
          }
          default: {
            return false;
          }
        }
      };

      if (isRawMarkupIdentationSensitive()) {
        return node.value;
      }

      const lines = bodyLines(node.value);

      const rawFirstLineIsntIndented = !!node.value
        .split(/\r?\n/)[0]
        ?.match(/\S/);
      const shouldSkipFirstLine = rawFirstLineIsntIndented;

      return lines.length > 0 && lines.find((line) => line.trim() !== '')
        ? join(hardline, reindent(lines, shouldSkipFirstLine))
        : softline;
    }

    case NodeTypes.LiquidDrop: {
      return printLiquidDrop(path as AstPath<LiquidDrop>, options, print, args);
    }

    case NodeTypes.LiquidRawTag: {
      return printLiquidRawTag(
        path as AstPath<LiquidRawTag>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.LiquidTag: {
      return printLiquidTag(path as AstPath<LiquidTag>, options, print, args);
    }

    case NodeTypes.LiquidBranch: {
      return printLiquidBranch(
        path as AstPath<LiquidBranch>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.AttrEmpty: {
      return printAttributeName(path as AstPath<AttrEmpty>, options, print);
    }

    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrDoubleQuoted: {
      return printAttribute(
        path as AstPath<AttrUnquoted | AttrSingleQuoted | AttrDoubleQuoted>,
        options,
        print,
      );
    }

    case NodeTypes.HtmlDoctype: {
      if (!node.legacyDoctypeString) return '<!doctype html>';
      return node.source.slice(node.position.start, node.position.end);
    }

    case NodeTypes.HtmlComment: {
      const conditionalComment = getConditionalComment(
        node.source.slice(node.position.start, node.position.end),
      );
      if (conditionalComment) {
        const { startTag, body, endTag } = conditionalComment;
        return [
          startTag,
          group([
            indent([line, join(hardline, reindent(bodyLines(body), true))]),
            line,
          ]),
          endTag,
        ];
      }
      if (
        node.body.includes('prettier-ignore') ||
        node.body.startsWith('display:') ||
        node.body.startsWith('white-space:')
      ) {
        return node.source.slice(node.position.start, node.position.end);
      }
      return [
        '<!--',
        group([
          indent([line, join(hardline, reindent(bodyLines(node.body), true))]),
          line,
        ]),
        '-->',
      ];
    }

    case NodeTypes.AssignMarkup: {
      return [node.name, ' = ', path.call(print, 'value')];
    }

    case NodeTypes.CycleMarkup: {
      const doc: Doc[] = [];

      if (node.groupName) {
        doc.push(path.call(print, 'groupName'), ':');
      }

      const whitespace = node.args.length > 1 ? line : ' ';
      doc.push(
        whitespace,
        join(
          [',', whitespace],
          path.map((p) => print(p), 'args'),
        ),
      );

      return doc;
    }

    case NodeTypes.ForMarkup: {
      const doc = [node.variableName, ' in ', path.call(print, 'collection')];

      if (node.reversed) {
        doc.push(line, 'reversed');
      }

      if (node.args.length > 0) {
        doc.push([
          line,
          join(
            line,
            path.map((p) => print(p), 'args'),
          ),
        ]);
      }

      return doc;
    }

    case NodeTypes.PaginateMarkup: {
      const doc = [
        path.call(print, 'collection'),
        line,
        'by ',
        path.call(print, 'pageSize'),
      ];

      if (node.args.length > 0) {
        doc.push([
          ',',
          line,
          join(
            [',', line],
            path.map((p) => print(p), 'args'),
          ),
        ]);
      }

      return doc;
    }

    case NodeTypes.RenderMarkup: {
      const snippet = path.call(print, 'snippet');
      const doc: Doc = [snippet];
      if (node.variable) {
        const whitespace = node.alias ? line : ' ';
        doc.push(whitespace, path.call(print, 'variable'));
      }
      if (node.alias) {
        doc.push(' ', 'as', ' ', node.alias);
      }
      if (node.args.length > 0) {
        doc.push(
          ',',
          line,
          join(
            [',', line],
            path.map((p) => print(p), 'args'),
          ),
        );
      }
      return doc;
    }

    case NodeTypes.RenderVariableExpression: {
      return [node.kind, ' ', path.call(print, 'name')];
    }

    case NodeTypes.LogicalExpression: {
      return [
        path.call(print, 'left'),
        line,
        node.relation,
        ' ',
        path.call(print, 'right'),
      ];
    }

    case NodeTypes.Comparison: {
      return group([
        path.call(print, 'left'),
        indent([line, node.comparator, ' ', path.call(print, 'right')]),
      ]);
    }

    case NodeTypes.LiquidVariable: {
      const name = path.call(print, 'expression');
      let filters: Doc = '';
      if (node.filters.length > 0) {
        filters = [
          line,
          join(
            line,
            path.map((p) => print(p), 'filters'),
          ),
        ];
      }
      return [name, filters];
    }

    case NodeTypes.LiquidFilter: {
      let args: Doc[] = [];

      if (node.args.length > 0) {
        const printed = path.map((p) => print(p), 'args');
        const shouldPrintFirstArgumentSameLine =
          node.args[0].type !== NodeTypes.NamedArgument;

        if (shouldPrintFirstArgumentSameLine) {
          const [firstDoc, ...rest] = printed;
          const restDoc = isEmpty(rest)
            ? ''
            : indent([',', line, join([',', line], rest)]);
          args = [': ', firstDoc, restDoc];
        } else {
          args = [':', indent([line, join([',', line], printed)])];
        }
      }

      return group(['| ', node.name, ...args]);
    }

    case NodeTypes.NamedArgument: {
      return [node.name, ': ', path.call(print, 'value')];
    }

    case NodeTypes.TextNode: {
      return printTextNode(path as AstPath<TextNode>, options, print);
    }

    case NodeTypes.YAMLFrontmatter: {
      return ['---', hardline, node.body, '---'];
    }

    case NodeTypes.String: {
      const preferredQuote = options.liquidSingleQuote ? `'` : `"`;
      const valueHasQuotes = node.value.includes(preferredQuote);
      const quote = valueHasQuotes
        ? oppositeQuotes[preferredQuote]
        : preferredQuote;
      return [quote, node.value, quote];
    }

    case NodeTypes.Number: {
      if (args.truncate) {
        return node.value.replace(/\.\d+$/, '');
      } else {
        return node.value;
      }
    }

    case NodeTypes.Range: {
      return [
        '(',
        path.call((p) => print(p, { truncate: true }), 'start'),
        '..',
        path.call((p) => print(p, { truncate: true }), 'end'),
        ')',
      ];
    }

    case NodeTypes.LiquidLiteral: {
      // We prefer null over nil.
      if (node.keyword === 'nil') {
        return 'null';
      }
      return node.keyword;
    }

    case NodeTypes.VariableLookup: {
      const doc: Doc[] = [];
      if (node.name) {
        doc.push(node.name);
      }
      const lookups: Doc[] = path.map((lookupPath, index) => {
        const lookup = lookupPath.getValue() as LiquidExpression;
        switch (lookup.type) {
          case NodeTypes.String: {
            const value = lookup.value;
            // We prefer direct access
            // (for everything but stuff with dashes)
            const isGlobalStringLookup = index === 0 && !node.name;
            if (!isGlobalStringLookup && /^[a-z0-9_]+\??$/i.test(value)) {
              return ['.', value];
            }
            return ['[', print(lookupPath), ']'];
          }
          default: {
            return ['[', print(lookupPath), ']'];
          }
        }
      }, 'lookups');
      return [...doc, ...lookups];
    }

    default: {
      return assertNever(node);
    }
  }
}

export const printerLiquidHtml2: Printer2<LiquidHtmlNode> & {
  preprocess: any;
} & { getVisitorKeys: any } = {
  print: printNode as any,
  embed: embed2,
  preprocess,
  getVisitorKeys(node: any, nonTraversableKeys: Set<string>) {
    return Object.keys(node).filter(
      (key) =>
        !nonTraversableKeys.has(key) && !nonTraversableProperties.has(key),
    );
  },
};

export const printerLiquidHtml3: Printer3<LiquidHtmlNode> & {
  preprocess: any;
} & { getVisitorKeys: any } = {
  print: printNode as any,
  embed: embed3,
  preprocess,
  getVisitorKeys(node: any, nonTraversableKeys: Set<string>) {
    return Object.keys(node).filter(
      (key) =>
        !nonTraversableKeys.has(key) && !nonTraversableProperties.has(key),
    );
  },
};
