import { JSONNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { toJSONAST } from '../../to-source-code';
import { visit } from '../../visitor';
import { LiteralNode } from 'json-to-ast';

export const LiquidFreeSettings: LiquidCheckDefinition = {
  meta: {
    code: 'LiquidFreeSettings',
    name: 'Check for liquid free settings values',
    docs: {
      description: 'Ensures settings values are liquid free.',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/liquid-free-settings',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const jsonFile = toJSONAST(jsonString);
        if (jsonFile instanceof Error) return;

        visit<SourceCodeType.JSON, void>(jsonFile, {
          Property(schemaNode, ancestors) {
            if (isInArrayWithParentKey(ancestors, 'settings') && isLiteralNode(schemaNode.value)) {
              const value = schemaNode.value.value;
              if (typeof value === 'string' && value.includes('{%') && value.includes('%}')) {
                context.report({
                  message: 'Settings values cannot contain liquid logic.',
                  startIndex: node.blockStartPosition.end + schemaNode.value.loc!.start.offset,
                  endIndex: node.blockStartPosition.end + schemaNode.value.loc!.end.offset,
                });
              }
            }
          },
        });
      },
    };
  },
};

function isLiteralNode(node: JSONNode): node is LiteralNode {
  return node.type === 'Literal';
}

function isInArrayWithParentKey(ancestors: JSONNode[], parentKey: string): boolean {
  return ancestors.some((ancestor, index) => {
    const parent = ancestors[index - 1];
    return (
      (ancestor.type === 'Array' || ancestor.type === 'Object') &&
      parent?.type === 'Property' &&
      parent.key?.value === parentKey
    );
  });
}
