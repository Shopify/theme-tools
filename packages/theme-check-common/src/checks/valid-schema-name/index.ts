import { JSONNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { toJSONAST } from '../../to-source-code';
import { visit } from '../../visitor';
import { LiteralNode } from 'json-to-ast';
import { ValueNode } from 'json-to-ast';

const MAX_SCHEMA_NAME_LENGTH = 25;
const ROOT_NODE_ANCESTORS_COUNT = 1;

export const ValidSchemaName: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSchemaName',
    name: 'Enforce valid schema name',
    docs: {
      description: 'This check is aimed at ensuring a valid schema name.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/thesadmes/tools/theme-check/checks/valid-schema-name',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonSchemaString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const jsonSchemaAst = toJSONAST(jsonSchemaString);
        visit<SourceCodeType.JSON, void>(jsonSchemaAst as JSONNode, {
          Property(nameNode, ancestors) {
            if (
              nameNode.key.value === 'name' &&
              ancestors.length === ROOT_NODE_ANCESTORS_COUNT &&
              isLiteralNode(nameNode.value)
            ) {
              const name = getLiteralValue(nameNode.value);

              // We will be handling the translation length in a follow up
              if (!name.startsWith('t:') && name.length > MAX_SCHEMA_NAME_LENGTH) {
                const startIndex = node.blockStartPosition.end + getLiteralLocStart(nameNode.value);
                const endIndex = node.blockStartPosition.end + getLiteralLocEnd(nameNode.value);
                context.report({
                  message: 'Schema name is too long (max 25 characters)',
                  startIndex: startIndex,
                  endIndex: endIndex,
                });
              }
            }
          },
        });
      },
    };
  },
};

function isLiteralNode(node: ValueNode): node is LiteralNode {
  return node.type === 'Literal';
}

function getLiteralValue(node: LiteralNode): string {
  if (typeof node.value === 'string') {
    return node.value;
  }
  return '';
}

function getLiteralLocStart(node: LiteralNode): number {
  return node.loc?.start.offset ?? 0;
}

function getLiteralLocEnd(node: LiteralNode): number {
  return node.loc?.end.offset ?? 0;
}
