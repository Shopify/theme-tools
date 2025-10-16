import { isSnippet, isBlock } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { filePathSupportsLiquidDoc } from '../../liquid-doc/utils';
import { LiquidRawTag, NodeTypes, LiquidHtmlNode } from '@shopify/liquid-html-parser';

export const UnsupportedDocTag: LiquidCheckDefinition = {
  meta: {
    code: 'UnsupportedDocTag',
    name: 'Prevent unsupported doc tag usage',
    docs: {
      description: 'This check exists to prevent use of `doc` tag outside of snippet file.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unsupported-doc-tag',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const docTagName = 'doc';
    const snippetTagName = 'snippet';

    return {
      async LiquidRawTag(node: LiquidRawTag, ancestors: LiquidHtmlNode[]) {
        if (node.name !== docTagName) {
          return;
        }

        const isInSnippetOrBlockFile = filePathSupportsLiquidDoc(context.file.uri);
        const immediateParent = ancestors.at(-1);
        const isTopLevelInFile = immediateParent?.type === NodeTypes.Document;
        const isDirectChildOfSnippetTag =
          immediateParent?.type === NodeTypes.LiquidTag && immediateParent.name === snippetTagName;

        if ((isInSnippetOrBlockFile && isTopLevelInFile) || isDirectChildOfSnippetTag) {
          return;
        }

        const message = isInSnippetOrBlockFile
          ? `The \`${docTagName}\` tag must be a top-level tag within a snippet/block file`
          : `The \`${docTagName}\` must be placed directly within an inline snippet tag, not nested inside other tags`;

        context.report({
          message,
          startIndex: node.position.start,
          endIndex: node.position.end,
          suggest: [
            {
              message: `Remove unsupported \`${docTagName}\` tag`,
              fix: (corrector) => corrector.remove(node.position.start, node.position.end),
            },
          ],
        });
      },
    };
  },
};
