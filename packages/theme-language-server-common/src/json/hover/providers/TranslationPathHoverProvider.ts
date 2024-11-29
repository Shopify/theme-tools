import { nodeAtPath } from '@shopify/theme-check-common';
import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { extractParams, paramsString } from '../../../translations';
import { isJSONRequestContext, JSONRequestContext, RequestContext } from '../../RequestContext';
import { fileMatch } from '../../utils';
import { JSONHoverProvider } from '../JSONHoverProvider';

export class TranslationPathHoverProvider implements JSONHoverProvider {
  private filePatterns = [/^.*\/locales\/[^\/]*\.json$/];

  canHover(context: RequestContext, path: JSONPath): context is JSONRequestContext {
    return (
      fileMatch(context.doc.uri, this.filePatterns) &&
      path.length > 0 &&
      isJSONRequestContext(context)
    );
  }

  async hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]> {
    // Redundant use for type assertion
    if (!this.canHover(context, path)) return [];
    const { doc } = context;
    const ast = doc.ast;
    const node = nodeAtPath(ast, path);

    switch (true) {
      // Because the JSON language service doesn't support composition of hover info,
      // We have to hardcode the docs for the translation file schema here.
      case ['zero', 'one', 'two', 'few', 'many', 'other'].includes(path.at(-1) as string): {
        if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
          return [`Pluralized translations should have a string value`];
        }
        return [contextualizedLabel(doc.uri, path.slice(0, -1), node.value)];
      }

      case path.at(-1)!.toString().endsWith('_html'): {
        if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
          return [`Translations ending in '_html' should have a string value`];
        }
        return [
          contextualizedLabel(doc.uri, path, node.value),
          `The '_html' suffix prevents the HTML content from being escaped.`,
        ];
      }

      default: {
        if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
          return [`Translation group: ${path.join('.')}`];
        }
        return [contextualizedLabel(doc.uri, path, node.value)];
      }
    }
  }
}

export function contextualizedLabel(
  uri: string,
  str: (string | number)[],
  value: string,
): MarkedString {
  if (uri.includes('.schema')) {
    return marked(`"t:${str.join('.')}"`, 'json');
  } else {
    const params = extractParams(value);
    return marked(`{{ '${str.join('.')}' | t${paramsString(params)} }}`, 'liquid');
  }
}

function marked(value: string, language = 'liquid'): { language: string; value: string } {
  return { language, value };
}
