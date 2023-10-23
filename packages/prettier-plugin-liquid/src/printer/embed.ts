import { doc, Doc } from 'prettier';
import type { Printer as Printer2 } from 'prettier';
import type { Doc as Doc3, Printer as Printer3 } from 'prettier3';
import { NodeTypes, RawMarkupKinds } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, LiquidParserOptions, RawMarkup } from '../types';

const {
  builders: { dedentToRoot, indent, hardline },
} = doc;

// null will pass through
export const ParserMap: { [key in RawMarkupKinds]: string | null } = {
  [RawMarkupKinds.css]: 'css',
  [RawMarkupKinds.html]: null,
  [RawMarkupKinds.javascript]: 'babel',
  [RawMarkupKinds.json]: 'json',
  [RawMarkupKinds.markdown]: 'markdown',
  [RawMarkupKinds.typescript]: 'typescript',
  [RawMarkupKinds.text]: null,
};

// Prettier 2 and 3 have a slightly different API for embed.
//
// https://github.com/prettier/prettier/wiki/How-to-migrate-my-plugin-to-support-Prettier-v3%3F
export const embed2: Printer2<LiquidHtmlNode>['embed'] = (path, _print, textToDoc, options) => {
  const node = path.getValue();
  switch (node.type) {
    case NodeTypes.RawMarkup: {
      const parser = ParserMap[node.kind];
      if (parser && node.value.trim() !== '') {
        const body = doc.utils.stripTrailingHardline(
          textToDoc(node.value, {
            ...options,
            singleQuote: (options as any as LiquidParserOptions).embeddedSingleQuote,
            parser,
            __embeddedInHtml: true,
          }),
        );
        if (shouldIndentBody(node, options as any)) {
          return [indent([hardline, body]), hardline];
        } else {
          return [dedentToRoot([hardline, body]), hardline];
        }
      }
    }
    default:
      return null;
  }
};

export const embed3: Printer3<LiquidHtmlNode>['embed'] = (path, options) => {
  return (textToDoc) => {
    const node = path.node as LiquidHtmlNode;
    switch (node.type) {
      case NodeTypes.RawMarkup: {
        const parser = ParserMap[node.kind];
        if (parser && node.value.trim() !== '') {
          return textToDoc(node.value, {
            ...options,
            singleQuote: (options as LiquidParserOptions).embeddedSingleQuote,
            parser,
            __embeddedInHtml: true,
          }).then((document) => {
            const body = doc.utils.stripTrailingHardline(document);
            if (shouldIndentBody(node, options as any)) {
              return [indent([hardline, body]), hardline];
            } else {
              return [dedentToRoot([hardline, body]), hardline];
            }
          }) as Promise<Doc3>;
        }
      }
      default:
        return undefined;
    }
  };
};

function shouldIndentBody(node: RawMarkup, options: { indentSchema?: boolean }): boolean {
  const parentNode = node.parentNode;
  const shouldNotIndentBody =
    parentNode &&
    parentNode.type === NodeTypes.LiquidRawTag &&
    parentNode.name === 'schema' &&
    !options.indentSchema;
  return node.kind !== RawMarkupKinds.markdown && !shouldNotIndentBody;
}
