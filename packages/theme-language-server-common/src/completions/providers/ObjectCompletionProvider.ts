import { LiquidHtmlNode, LiquidTag, NodeTypes } from '@shopify/liquid-html-parser';
import { DocsetEntry, SourceCodeType, ThemeDocset } from '@shopify/theme-check-common';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { visit } from '../../visitor';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem, sortByName } from './common';

export class ObjectCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { partialAst, node, ancestors } = params.completionContext;
    if (!node || node.type !== NodeTypes.VariableLookup) {
      return [];
    }

    if (!node.name || node.lookups.length > 0) {
      // We only do top level in this one.
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const globals = await this.themeDocset.objects();
    const context = collectVariables(partialAst, ancestors);
    const options = globals.concat(context);
    return options
      .filter(({ name }) => name.startsWith(partial))
      .sort(sortByName)
      .map((tag) => createCompletionItem(tag, { kind: CompletionItemKind.Variable }, 'object'));
  }
}

// I want the names of the things that are in range.
function collectVariables(
  partialAst: LiquidHtmlNode,
  currentAncestors: LiquidHtmlNode[],
): DocsetEntry[] {
  const entries = visit<SourceCodeType.LiquidHtml, string>(partialAst, {
    // {% assign x = foo %}
    AssignMarkup(node) {
      // Can't use x in {% assign x = x %}
      if (currentAncestors.includes(node)) {
        return;
      }

      return node.name;
    },

    // This also covers tablerow
    ForMarkup(node, ancestors) {
      const parentNode = ancestors.at(-1)! as LiquidTag;

      // We can't do {% for a in a %}
      // Nor {% for a in a limit: a %}
      if (currentAncestors.includes(node)) {
        return;
      }

      // A for loop is out of scope if it is closed.
      // {% for el in col %}
      //   ...
      // {% endfor %}
      // {% # el is undefined here %}
      // {% echo █ %}
      const isOutOfScope = parentNode.blockEndPosition && parentNode.blockEndPosition.end !== -1;
      if (isOutOfScope) return;

      return node.variableName;
    },

    // {% capture foo %}
    //   ...
    // {% endcapture}
    LiquidTag(node) {
      if (node.name === 'capture' && typeof node.markup !== 'string') {
        return node.markup.name!;
      }
    },
  });
  return entries.map((name) => ({ name }));
}
