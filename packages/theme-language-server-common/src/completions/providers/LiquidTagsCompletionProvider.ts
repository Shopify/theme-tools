import {
  BLOCKS,
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagLiquid,
  NamedTags,
  NodeTypes,
  RAW_TAGS,
} from '@shopify/liquid-html-parser';
import { TagEntry, ThemeDocset } from '@shopify/theme-check-common';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  InsertTextMode,
  Position,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { findLast } from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem, sortByName } from './common';

export class LiquidTagsCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    if (!node || node.type !== NodeTypes.LiquidTag) {
      return [];
    }

    if (typeof node.markup !== 'string' || node.markup !== '') {
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const blockParent = findParentNode(partial, ancestors);
    const tags = await this.themeDocset.tags();
    return tags
      .filter(({ name }) => name.startsWith(partial))
      .sort(sortByName)
      .map(toCompletionItem(params, node, ancestors, partial))
      .concat(
        blockParent && `end${blockParent.name}`.startsWith(partial)
          ? {
              label: `end${blockParent.name}`,
              kind: CompletionItemKind.Keyword,
              sortText: `!end${blockParent.name}`, // we want this first.
            }
          : [],
      );
  }
}

function findParentNode(partial: string, ancestors: LiquidHtmlNode[]): LiquidTag | undefined {
  if (!'end'.startsWith(partial)) return;

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
  if (parentNode && parentNode.type === 'LiquidTag' && parentNode.name === NamedTags.liquid) {
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
  if (
    parentNode &&
    parentNode.type === 'LiquidBranch' &&
    grandParentNode &&
    grandParentNode.type === 'LiquidTag' &&
    grandParentNode.name.startsWith(potentialParentName)
  ) {
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
  if (
    parentNode &&
    parentNode.type === 'LiquidTag' &&
    parentNode.name.startsWith(potentialParentName)
  ) {
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
  let previousNode: LiquidHtmlNode | undefined;
  if (
    parentNode &&
    'children' in parentNode &&
    Array.isArray(parentNode.children) &&
    (previousNode = findLast(
      parentNode.children,
      (node: LiquidHtmlNode): node is LiquidTag =>
        node.type === 'LiquidTag' &&
        node.name.startsWith(potentialParentName) &&
        (BLOCKS.includes(node.name) || RAW_TAGS.includes(node.name)),
    ))
  ) {
    return previousNode as LiquidTag;
  }
}

function toCompletionItem(
  params: LiquidCompletionParams,
  node: LiquidTag,
  ancestors: LiquidHtmlNode[],
  partial: string,
): (value: TagEntry) => CompletionItem {
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
  const whitespaceEnd = inferWhitespaceEnd(
    textDocument,
    endOfBlockStart,
    params,
    whitespaceStart,
    source,
    isInLiquidLiquidTag,
  );

  return (tag) => {
    const extraProperties: Partial<CompletionItem> = {
      kind: CompletionItemKind.Keyword,
      insertTextFormat: InsertTextFormat.PlainText,
    };

    if (shouldSnippetComplete(params, endOfBlockStart)) {
      extraProperties.insertTextFormat = InsertTextFormat.Snippet;
      extraProperties.insertTextMode = InsertTextMode.adjustIndentation;
      extraProperties.textEdit = TextEdit.replace(
        Range.create(startOfPartial, endOfBlockStart),
        toSnippetCompleteText(
          tag,
          node,
          params,
          whitespaceStart,
          whitespaceEnd,
          textDocument,
          isInLiquidLiquidTag,
        ),
      );
    }

    return createCompletionItem(tag, extraProperties, 'tag');
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
function shouldSnippetComplete(params: LiquidCompletionParams, endOfBlockStart: Position) {
  const { completionContext } = params;
  const { node, ancestors } = completionContext ?? {};
  if (!node || !ancestors || node.type !== NodeTypes.LiquidTag) return false;
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

function toSnippetCompleteText(
  tag: TagEntry,
  node: LiquidTag,
  params: LiquidCompletionParams,
  whitespaceStart: string,
  whitespaceEnd: string,
  textDocument: TextDocument,
  isInLiquidLiquidTag: boolean,
) {
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
      if (
        keyword.includes('expression') ||
        keyword.includes('code') ||
        keyword.includes('content')
      ) {
        // first_expression, second_expression, javascript_code,
        // forloop_content... we don't want those. Just the cursor position.
        snippet = snippet.replace(keyword, `\$${i}`);
      } else {
        snippet = snippet.replace(keyword, `\${${i}:${keyword}}`);
      }
      i++;
    }
  }

  // We need to add the whitespace stripping characters to the snippet if there are any to add
  snippet = withCorrectWhitespaceStrippingCharacters(snippet, whitespaceStart, whitespaceEnd);

  if (isInLiquidLiquidTag) {
    return snippet.trimStart();
  } else {
    // VS Code doesn't like it when the snippet starts before the word
    // being completed. So the completion item we offer starts off after
    // the {%-?\s part.
    return snippet.slice(2 + whitespaceStart.length + 1);
  }
}

function toSnippet(tag: TagEntry) {
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
  } else if (isBlockTag(tag.name)) {
    return `{% ${tag.name}$1 %}\n  $2\n{% end${tag.name} %}`;
  } else {
    return `{% ${tag.name}$1 %}`;
  }
}

/**
 * If the tag is on a new line, then we can use the snippet with newline.
 * If there's more content on that line, then we inline the snippet in one line.
 */
function shouldInline(
  textDocument: TextDocument,
  params: LiquidCompletionParams,
  node: LiquidTag,
  isInLiquidLiquidTag: boolean,
) {
  if (isInLiquidLiquidTag) return false;
  const endPosition = textDocument.positionAt(node.blockStartPosition.start);
  const startPosition = Position.create(endPosition.line, 0);
  const textBeforeTag = textDocument.getText(Range.create(startPosition, endPosition));
  return textBeforeTag.trim() !== '';
}

/**
 * We mirror the whitespace stripping of the start tag.
 * {% if -%} => {% if -%}{%- endif %}
 */
function withCorrectWhitespaceStrippingCharacters(
  snippet: string,
  whitespaceStart: string,
  whitespaceEnd: string,
) {
  let starti = 0;
  let endi = 0;
  let countOfEndTags = snippet.match(/%\}/g)?.length ?? 0;
  snippet = snippet
    .replace(/\{%/g, () => {
      if (starti++ === 0) {
        // mirror outside stripping
        return '{%' + whitespaceStart;
      } else {
        // mirror inside stripping
        return '{%' + whitespaceEnd;
      }
    })
    .replace(/%\}/g, () => {
      if (countOfEndTags > 1 && endi++ === countOfEndTags - 1) {
        // mirror outside stripping
        return whitespaceStart + '%}';
      } else {
        // mirror inside stripping
        return whitespaceEnd + '%}';
      }
    });
  return snippet;
}

function findEndOfBlockStart(
  context: LiquidCompletionParams,
  node: LiquidTag,
  isInLiquidLiquidTag: boolean,
): Position {
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
  } else {
    // return cursor position.
    return context.position;
  }
}

function existingMarkup(params: LiquidCompletionParams, endOfBlockStart: Position): string {
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
function inferWhitespaceEnd(
  textDocument: TextDocument,
  endOfBlockStart: Position,
  params: LiquidCompletionParams,
  whitespaceStart: string,
  source: string,
  isInLiquidLiquidTag: boolean,
) {
  if (isInLiquidLiquidTag) {
    return '';
  } else if (textDocument.offsetAt(endOfBlockStart) === textDocument.offsetAt(params.position)) {
    return whitespaceStart; // if the %} wasn't auto inserted, copy whatever was there on the other side
  } else if (source.charAt(textDocument.offsetAt(endOfBlockStart) - 3) === '-') {
    return '-';
  } else {
    return '';
  }
}

function isLiquidLiquidTag(parent: LiquidHtmlNode): parent is LiquidTagLiquid {
  return parent.type === NodeTypes.LiquidTag && parent.name === NamedTags.liquid;
}

function isBlockTag(name: string) {
  return BLOCKS.includes(name);
}
