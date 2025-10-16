import {
  LiquidDocParamNode,
  LiquidHtmlNode,
  NamedTags,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { findInlineSnippetAncestor, isLoopScopedVariable } from '../utils';

export const UnusedDocParam: LiquidCheckDefinition = {
  meta: {
    code: 'UnusedDocParam',
    name: 'Prevent unused doc parameters',
    docs: {
      description:
        'This check exists to ensure any parameters defined in the `doc` tag are used within the snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-doc-param',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const fileScopedLiquidDocParams: Map<string, LiquidDocParamNode> = new Map();
    const inlineSnippetScopedLiquidDocParams: Map<
      LiquidHtmlNode,
      Map<string, LiquidDocParamNode>
    > = new Map();

    const fileScopedUsedVariables: Set<string> = new Set();
    const inlineSnippetScopedUsedVariables: Map<LiquidHtmlNode, Set<string>> = new Map();

    return {
      async LiquidTag(node) {
        if (node.name === NamedTags.snippet) {
          inlineSnippetScopedLiquidDocParams.set(node, new Map());
          inlineSnippetScopedUsedVariables.set(node, new Set());
        }
      },

      async LiquidDocParamNode(node, ancestors) {
        const snippetAncestor = findInlineSnippetAncestor(ancestors);

        if (snippetAncestor) {
          inlineSnippetScopedLiquidDocParams.get(snippetAncestor)!.set(node.paramName.value, node);
        } else {
          fileScopedLiquidDocParams.set(node.paramName.value, node);
        }
      },

      async VariableLookup(node, ancestors) {
        if (
          node.type === NodeTypes.VariableLookup &&
          node.name &&
          !isLoopScopedVariable(node.name, ancestors)
        ) {
          const snippetAncestor = findInlineSnippetAncestor(ancestors);

          if (snippetAncestor) {
            inlineSnippetScopedUsedVariables.get(snippetAncestor)!.add(node.name);
          } else {
            fileScopedUsedVariables.add(node.name);
          }
        }
      },

      async onCodePathEnd() {
        for (const [variable, node] of fileScopedLiquidDocParams.entries()) {
          if (!fileScopedUsedVariables.has(variable)) {
            context.report({
              message: `The parameter '${variable}' is defined but not used in this file.`,
              startIndex: node.position.start,
              endIndex: node.position.end,
              suggest: [
                {
                  message: `Remove unused parameter '${variable}'`,
                  fix: (corrector) => corrector.remove(node.position.start, node.position.end),
                },
              ],
            });
          }
        }
        for (const [snippet, docParams] of inlineSnippetScopedLiquidDocParams.entries()) {
          for (const [variable, node] of docParams.entries()) {
            if (!inlineSnippetScopedUsedVariables.get(snippet)?.has(variable)) {
              context.report({
                message: `The parameter '${variable}' is defined but not used in this inline snippet.`,
                startIndex: node.position.start,
                endIndex: node.position.end,
                suggest: [
                  {
                    message: `Remove unused parameter '${variable}'`,
                    fix: (corrector) => corrector.remove(node.position.start, node.position.end),
                  },
                ],
              });
            }
          }
        }
      },
    };
  },
};
